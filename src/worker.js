import {validateCheckin, CONSENT_VERSION, RESOURCES} from '../public/domain.js';

const SESSION_DAYS=30;
const securityHeaders={
  'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'X-Frame-Options':'DENY'
};
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{...securityHeaders,'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
const digest=async token=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
const cookie=(value,url,maxAge=SESSION_DAYS*86400)=>`saathi_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${url.protocol==='https:'?'; Secure':''}`;

async function readBody(request) {
  if(!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('Send JSON.');
  // Check the actual streamed bytes too: Content-Length alone is untrusted.
  const reader=request.body?.getReader(); if(!reader) throw new Error('Request body is missing.');
  let chunks=[],length=0;
  for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>8192){await reader.cancel();throw new Error('Request is too large.');}chunks.push(value);}
  const bytes=new Uint8Array(length);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw new Error('Invalid JSON.');}
}

async function session(request,env) {
  const raw=request.headers.get('Cookie')?.match(/(?:^|;\s*)saathi_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if(!raw)return null;
  const id=await digest(raw);
  return env.DB.prepare('SELECT id, expires_at FROM sessions WHERE id = ? AND expires_at > ?').bind(id,new Date().toISOString()).first();
}

export async function handleApi(request,env) {
  const url=new URL(request.url), path=url.pathname, method=request.method;
  if(path==='/api/health'&&method==='GET')return json({ok:true,storage:env.DB?'configured':'unavailable',mode:'research-prototype',forecasting:false,realReferrals:false});
  if(!env.DB)return json({error:'Personal storage is not configured. Sample mode is still available.'},503);
  // No cross-origin CORS grants. Mutation requests must originate on this site.
  if(!['GET','HEAD'].includes(method)&&request.headers.get('Origin')!==url.origin)return json({error:'Cross-origin request rejected.'},403);
  try {
    if(path==='/api/session'&&method==='POST') {
      const body=await readBody(request);
      if(body.consent!==true||body.version!==CONSENT_VERSION)return json({error:'Current privacy consent is required.'},400);
      const existing=await session(request,env);if(existing)return json({ok:true,expiresAt:existing.expires_at});
      const raw=token(), id=await digest(raw), now=new Date(), expires=new Date(now.getTime()+SESSION_DAYS*86400000).toISOString();
      // Expired records are swept on new sessions and by the scheduled handler.
      await env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now.toISOString()).run();
      await env.DB.prepare('INSERT INTO sessions (id,created_at,expires_at,consent_version) VALUES (?,?,?,?)').bind(id,now.toISOString(),expires,CONSENT_VERSION).run();
      return json({ok:true,expiresAt:expires},201,{'Set-Cookie':cookie(raw,url)});
    }
    const user=await session(request,env);
    if(!user)return json({error:'Start a private space to continue.'},401);
    if(path==='/api/me'&&method==='GET') {
      const records=await env.DB.prepare('SELECT id,created_at,payload FROM checkins WHERE session_id = ? ORDER BY created_at ASC').bind(user.id).all();
      const plans=await env.DB.prepare('SELECT resource_id,status,updated_at FROM plans WHERE session_id = ?').bind(user.id).all();
      return json({records:records.results.map(r=>({id:r.id,created_at:r.created_at,...JSON.parse(r.payload)})),plans:plans.results,expiresAt:user.expires_at});
    }
    if(path==='/api/checkins'&&method==='POST') {
      const body=validateCheckin(await readBody(request)), id=crypto.randomUUID(), now=new Date().toISOString();
      const count=await env.DB.prepare('SELECT COUNT(*) AS total FROM checkins WHERE session_id = ?').bind(user.id).first();
      if(count.total>=500)return json({error:'This private space has reached its 500 check-in limit. Export and clear it to start again.'},429);
      await env.DB.prepare('INSERT INTO checkins (id,session_id,created_at,kind,payload) VALUES (?,?,?,?,?)').bind(id,user.id,now,body.kind,JSON.stringify(body)).run();
      return json({id,created_at:now,...body},201);
    }
    if(path==='/api/plans'&&method==='POST') {
      const body=await readBody(request);
      if(!RESOURCES.some(r=>r.id===body.resourceId)||!['saved','tried','helpful','not-helpful'].includes(body.status))return json({error:'Invalid support plan.'},400);
      await env.DB.prepare('INSERT INTO plans (session_id,resource_id,status,updated_at) VALUES (?,?,?,?) ON CONFLICT(session_id,resource_id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at').bind(user.id,body.resourceId,body.status,new Date().toISOString()).run();
      return json({ok:true});
    }
    if(path==='/api/me'&&method==='DELETE') {
      // User-initiated deletion removes records via foreign-key cascades.
      await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(user.id).run();
      return json({ok:true},200,{'Set-Cookie':cookie('',url,0)});
    }
    return json({error:'Endpoint not found.'},404);
  }catch(error){
    // Never echo database errors, SQL, tokens, or health payloads to clients/logs.
    const safe=['Please answer','Check mood','Unknown check','Invalid check','Send JSON','Request body','Request is too large','Invalid JSON'].some(prefix=>error.message.startsWith(prefix));
    return json({error:safe?error.message:'Unable to save right now. Please try again.'},safe?400:500);
  }
}

export default {
  async fetch(request,env) {
    if(new URL(request.url).pathname.startsWith('/api/'))return handleApi(request,env);
    const response=await env.ASSETS.fetch(request);
    const headers=new Headers(response.headers);for(const [key,value]of Object.entries(securityHeaders))headers.set(key,value);
    return new Response(response.body,{status:response.status,headers});
  },
  async scheduled(event,env,ctx) {
    ctx.waitUntil(env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(new Date().toISOString()).run());
  }
};

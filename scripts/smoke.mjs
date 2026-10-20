/** Run against an explicitly supplied local or deployed URL. Creates only
 * synthetic test records in two new sessions, then deletes those sessions.
 * Never logs session tokens or reads anyone else's records. */
import assert from 'node:assert/strict';
import {CONSENT_VERSION} from '../public/domain.js';
const base=process.argv[2];if(!base)throw new Error('Usage: node scripts/smoke.mjs https://your-worker.workers.dev');
const origin=new URL(base).origin;
async function request(path,method='GET',body,cookie){return fetch(origin+'/api'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});}
const cookies=[];
try{
  const home=await fetch(origin);assert.equal(home.status,200);assert.match(home.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
  const script=await (await fetch(origin+'/app.js')).text();assert.ok(script.includes('© 2026 Palak Tomar. All rights reserved.'));
  assert.equal((await request('/me')).status,401);
  for(let i=0;i<2;i++){const r=await request('/session','POST',{consent:true,version:CONSENT_VERSION});assert.equal(r.status,201,await r.clone().text());const c=r.headers.get('set-cookie');assert.match(c,/HttpOnly/);if(origin.startsWith('https:'))assert.match(c,/Secure/);cookies.push(c.split(';')[0]);}
  const record=await request('/checkins','POST',{kind:'daily',mood:3,energy:3,sleep:7,concerns:['Just checking in']},cookies[0]);assert.equal(record.status,201,await record.clone().text());
  assert.equal((await request('/plans','POST',{resourceId:'pause',status:'tried'},cookies[0])).status,200);
  const a=await (await request('/me','GET',undefined,cookies[0])).json();const b=await (await request('/me','GET',undefined,cookies[1])).json();
  assert.equal(a.records.length,1);assert.equal(a.plans.length,1);assert.equal(b.records.length,0);assert.equal(b.plans.length,0);
  console.log('PASS: HTTPS assets, copyright, security headers, session consent, record persistence, saved plans and cross-session isolation.');
}finally{
  for(const cookie of cookies){const r=await request('/me','DELETE',undefined,cookie);assert.equal(r.status,200);assert.equal((await request('/me','GET',undefined,cookie)).status,401);}
  if(cookies.length)console.log('PASS: synthetic test sessions deleted and access revoked.');
}

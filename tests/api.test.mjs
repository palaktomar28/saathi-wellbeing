import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handleApi} from '../src/worker.js';
import {CONSENT_VERSION} from '../public/domain.js';

function setup(){
  const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON;');sqlite.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
  const env={DB:{prepare(sql){return {bind(...args){const s=sqlite.prepare(sql);return {async first(){return s.get(...args)||null;},async all(){return {results:s.all(...args)};},async run(){return s.run(...args);}};}};}}};
  const request=(path,method='GET',body,cookie,origin='https://saathi.test')=>handleApi(new Request('https://saathi.test/api'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})}),env);
  const create=async()=>{const r=await request('/session','POST',{consent:true,version:CONSENT_VERSION});assert.equal(r.status,201);const c=r.headers.get('Set-Cookie');assert.match(c,/HttpOnly/);assert.match(c,/Secure/);assert.match(c,/SameSite=Strict/);return c.split(';')[0];};
  return {sqlite,request,create};
}
test('consent is required and other origins cannot create a session',async()=>{
  const {request,sqlite}=setup();assert.equal((await request('/me')).status,401);assert.equal((await request('/session','POST',{consent:false,version:CONSENT_VERSION})).status,400);assert.equal((await request('/session','POST',{consent:true,version:CONSENT_VERSION},null,'https://evil.test')).status,403);sqlite.close();
});
test('two sessions are isolated; records and plans survive reads and cascade on deletion',async()=>{
  const {request,create,sqlite}=setup();const a=await create(),b=await create();
  const saved=await request('/checkins','POST',{kind:'daily',mood:4,energy:3,sleep:8,concerns:['Sleep'],session_id:'tampered'},a);assert.equal(saved.status,201);
  assert.equal((await (await request('/me','GET',undefined,a)).json()).records.length,1);
  assert.equal((await (await request('/me','GET',undefined,b)).json()).records.length,0);
  assert.equal((await request('/plans','POST',{resourceId:'sleep',status:'saved'},a)).status,200);
  assert.equal((await (await request('/me','GET',undefined,a)).json()).plans.length,1);
  assert.equal((await request('/me','DELETE',undefined,a)).status,200);
  assert.equal((await request('/me','GET',undefined,a)).status,401);
  assert.equal(sqlite.prepare('SELECT count(*) AS n FROM checkins').get().n,0);assert.equal(sqlite.prepare('SELECT count(*) AS n FROM plans').get().n,0);sqlite.close();
});
test('assessment scores are recomputed server-side and invalid answers rejected',async()=>{
  const {request,create,sqlite}=setup();const c=await create();
  const result=await request('/checkins','POST',{kind:'phq9',answers:[0,0,0,0,0,0,0,0,1],score:0,needsSupport:false},c);
  const data=await result.json();assert.equal(data.score,1);assert.equal(data.needsSupport,true);
  assert.equal((await request('/checkins','POST',{kind:'gad7',answers:[1]},c)).status,400);
  assert.equal((await request('/plans','POST',{resourceId:'unknown',status:'saved'},c)).status,400);sqlite.close();
});
test('expired cookies cannot read records and new-session sweep removes expired data',async()=>{
  const {request,create,sqlite}=setup();const c=await create();sqlite.exec("UPDATE sessions SET expires_at='2000-01-01T00:00:00.000Z'");assert.equal((await request('/me','GET',undefined,c)).status,401);await create();assert.equal(sqlite.prepare('SELECT count(*) AS n FROM sessions').get().n,1);sqlite.close();
});
test('oversized bodies and missing database fail closed',async()=>{
  const {request,create,sqlite}=setup();const c=await create();assert.equal((await request('/checkins','POST',{padding:'x'.repeat(9000)},c)).status,400);assert.equal((await handleApi(new Request('https://saathi.test/api/me'),{})).status,503);sqlite.close();
});

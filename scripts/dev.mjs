/** Dependency-free local adapter. The production handler is the same module
 * used on Cloudflare. Node SQLite mimics only the D1 operations we actually use.
 * Bind loopback only; this development server is not a public hosting server. */
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import worker from '../src/worker.js';
mkdirSync('.data',{recursive:true});
const sqlite=new DatabaseSync('.data/development.sqlite');
sqlite.exec('PRAGMA foreign_keys=ON;');
sqlite.exec(readFileSync('migrations/0001_initial.sql','utf8'));
export const DB={prepare(sql){
  const statement=sqlite.prepare(sql);
  return {bind(...args){
    return {
      async first(){return statement.get(...args)||null;},
      async all(){return {results:statement.all(...args)};},
      async run(){return statement.run(...args);}
    };
  }};
}};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
const root=resolve('public');
const env={DB,ASSETS:{async fetch(request){let path;try{path=decodeURIComponent(new URL(request.url).pathname);}catch{return new Response('Bad path',{status:400});}const file=resolve(root,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(root+'\\')&&!file.startsWith(root+'/'))return new Response('Forbidden',{status:403});if(!existsSync(file))return new Response('Not found',{status:404});return new Response(readFileSync(file),{headers:{'Content-Type':mime[extname(file)]||'application/octet-stream'}});}}};
const port=Number(process.env.PORT||8787);
createServer(async(req,res)=>{try{const request=new Request(`http://127.0.0.1:${port}${req.url}`,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:req,duplex:'half'}:{})});const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('Local server error');}}).listen(port,'127.0.0.1',()=>console.log(`Saathi local preview: http://127.0.0.1:${port}`));

/** Official-dashboard deployment alternative: embed the small static assets in
 * one ES module so no CLI token or GitHub integration grant is needed. The API
 * and its security rules remain identical. This route counts asset requests as
 * Worker requests; free-tier limits still apply. Never embed raw datasets. */
import {build} from 'esbuild';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const files=['index.html','app.js','domain.js','styles.css','mark.svg'];
const mime={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml'};
const assets=Object.fromEntries(files.map(name=>['/'+name,{body:readFileSync('public/'+name,'utf8'),type:mime[name.split('.').at(-1)]}]));
const source=`import worker from './src/worker.js';
const assets=${JSON.stringify(assets)};
const ASSETS={async fetch(request){
 const url=new URL(request.url); const key=url.pathname==='/'?'/index.html':url.pathname;
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const asset=assets[key];if(!asset)return new Response('Not found',{status:404});
 return new Response(request.method==='HEAD'?null:asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'public, max-age=0, must-revalidate'}});
}};
export default {
 fetch(request,env,ctx){return worker.fetch(request,{...env,ASSETS});},
 scheduled(event,env,ctx){return worker.scheduled(event,env,ctx);}
};`;
mkdirSync('dist',{recursive:true});
const result=await build({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'dashboard-entry.js'},bundle:true,format:'esm',platform:'browser',target:'es2022',write:false,minify:false});
writeFileSync('dist/dashboard-worker.js',result.outputFiles[0].text);
console.log(`Dashboard bundle ready: ${result.outputFiles[0].text.length} characters. Includes only app assets and API code.`);

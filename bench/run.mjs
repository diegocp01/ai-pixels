// Opt-in live benchmark. Run from the project root with Node 22.15+ and Playwright.
import http from 'node:http';
import {readFile,writeFile,mkdir,appendFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {runArchitecture,png} from './architectures.mjs';
import {raster} from './tiles.mjs';
import {fixture,pixelChecks,tasks} from './workloads.mjs';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PIXEL_PLAYWRIGHT||'playwright');
const key=process.env.OPENAI_API_KEY||parseEnv(await readFile(process.env.PIXEL_KEY_FILE,'utf8')).OPENAI_API_KEY;
const dest=process.env.PIXEL_BENCH_OUT;
if(!dest)throw Error('Set PIXEL_BENCH_OUT to a results directory.');
await mkdir(dest,{recursive:true});
const pool={
  sol:['gpt-6.2-sol','ultrafast'],astra:['gpt-6.2-astra','ultrafast'],sol61:['gpt-6.1-sol','ultrafast'],
  astra6:['gpt-6-astra','ultrafast'],terra:['gpt-6.1-terra','fast'],luna:['gpt-6-luna','fast']
};
const candidates=(process.env.PIXEL_CANDIDATES||'sol:none,astra:none,sol61:none,astra6:none,terra:none,luna:none,sol:before,sol:middle,sol:after').split(',');
const workloads=(process.env.PIXEL_TASKS||'balloon,skate,edit').split(',');
const tag=process.env.PIXEL_TAG||'screen';
const nonce=randomUUID(),allowed=new Map([['/','index.html'],...['app.mjs','scene.mjs','art.mjs','style.css','mark.svg'].map(name=>['/'+name,name])]);
let trial;
const server=http.createServer(async(req,res)=>{
  try{
    if(req.headers['x-bench-key']!==nonce){res.writeHead(403).end();return;}
    if(req.method==='GET'&&trial?.phase==='quadrants' && ['/scene.mjs','/bench/tiles.mjs','/public/scene.mjs','/public/art.mjs'].includes(req.url)){
      const path=req.url==='/scene.mjs'?'bench/tiles.mjs':req.url.slice(1);
      res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});
      res.end(await readFile(new URL('../'+path,import.meta.url)));return;
    }
    if(req.method==='GET'&&allowed.has(req.url)){
      const name=allowed.get(req.url),type=name.endsWith('.mjs')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.svg')?'image/svg+xml':'text/html';
      res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(await readFile(new URL('../public/'+name,import.meta.url)));return;
    }
    if(req.url!=='/api/edit'||req.method!=='POST'||!trial){res.writeHead(404).end();return;}
    let raw='';for await(const bytes of req)raw+=bytes;
    const {scene,prompt}=JSON.parse(raw);
    res.writeHead(200,{'Content-Type':'application/x-ndjson'});res.flushHeaders();
    const emit=e=>res.write(JSON.stringify(e)+'\n');
    if(prompt==='Load the benchmark fixture'){emit({type:'done',scene:fixture,engine:'fixture'});res.end();return;}
    const trace=trial;
    const result=await runArchitecture({state:trace.state,key,scene,prompt,emit,signal:AbortSignal.timeout(55000),model:trace.model,serviceTier:trace.tier,transport:'responses',hint:''},trace.phase,trace);
    trace.scene=result.scene;emit({type:'done',...result});res.end();
  }catch(e){res.end(JSON.stringify({type:'error',message:e.message})+'\n');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.PIXEL_CHROME||undefined});
const context=await browser.newContext({viewport:{width:900,height:800},extraHTTPHeaders:{'x-bench-key':nonce}});
const page=await context.newPage();
await page.addInitScript(()=>{
  // Observe the exact live client without adding telemetry to the studio.
  let revision=0;
  const original=CanvasRenderingContext2D.prototype.putImageData;
  CanvasRenderingContext2D.prototype.putImageData=function(...args){
    const value=original.apply(this,args);if(this.canvas.id==='canvas')revision++;return value;
  };
  window.addEventListener('keydown',e=>{
    if(e.key!=='Enter'||e.target.id!=='prompt'||e.shiftKey)return;
    const start=performance.now(),canvas=document.querySelector('#canvas'),ctx=canvas.getContext('2d');
    function copy(){return new Uint32Array(ctx.getImageData(0,0,128,128).data.buffer);}
    let seen=revision,last=copy(),first=null,final=null,settled=false;window.timing=null;
    function frame(){
      const now=Math.round(performance.now()-start);
      if(revision!==seen){
        seen=revision;const pic=copy();
        if(pic.some((v,i)=>v!==last[i])){first??=now;final=now;last=pic;}
      }
      const ready=document.querySelector('#status').textContent==='Drawing complete.'&&!document.getElementById('form').hasAttribute('data-busy');
      const error=document.getElementById('error');
      if(!error.hidden){window.timing={error:error.textContent,readyMs:now};return;}
      if(ready){
        if(settled){window.timing={firstMs:first,finalMs:final,readyMs:now};return;}
        settled=true;
      }
      if(now<65500)requestAnimationFrame(frame);
      else window.timing={error:'browser timeout',readyMs:now};
    }
    requestAnimationFrame(frame);
  },true);
});
async function enter(value){
  await page.locator('#prompt').fill(value);await page.locator('#prompt').press('Enter');
  await page.waitForFunction(()=>window.timing!==null,undefined,{timeout:66500});
  return page.evaluate(()=>window.timing);
}
try{
  for(const [round,task] of workloads.entries()){
    // Each contender sees the exact same brief and initial state. Rotate order each block.
    const shift=(round*4)%candidates.length;
    const sequence=candidates.slice(shift).concat(candidates.slice(0,shift));
    if(round%2)sequence.reverse();
    for(const candidate of sequence){
      const [alias,phase]=candidate.split(':'),[model,tier]=pool[alias];
      if(phase==='layers'&&task==='edit')continue;
      trial={model,tier,phase,state:{},usage:[],decisions:[],retries:0,repairs:0};
      await page.goto(origin);await page.waitForFunction(()=>document.getElementById('dimensions').textContent.includes('128'));
      if(task==='edit')await enter('Load the benchmark fixture');
      const timing=await enter(tasks[task]);
      const {state,scene,...meta}=trial;
      const row={tag,round,task,candidate,...meta,...timing};
      if(scene){
        const image=raster(scene);
        row.checks=pixelChecks(task,scene,image);
        row.commands=scene.tiles?scene.tiles.reduce((sum,tile)=>sum+tile.ops.length,0):scene.ops.length;
        const screenHash=await page.evaluate(async()=>{
          const canvas=document.getElementById('canvas');
          const bytes=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
          const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
          return Array.from(hash,n=>n.toString(16).padStart(2,'0')).join('');
        });
        row.renderMatches=screenHash===createHash('sha256').update(image.pixels).digest('hex');
        row.image=tag+'-'+round+'-'+alias+'-'+phase+'-'+task+'.png';
        await writeFile(join(dest,row.image),png(scene));
      }
      await appendFile(join(dest,'runs.jsonl'),JSON.stringify(row)+'\n');
      console.log([tag,task,candidate,timing.finalMs,timing.readyMs,timing.error||JSON.stringify(row.checks),row.usage.map(x=>x.tier).join(',')].join(' | '));
    }
  }
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}

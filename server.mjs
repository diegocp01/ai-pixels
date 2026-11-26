import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {parseEnv} from 'node:util';
import {editCanvas} from './provider.mjs';
import {validateScene} from './public/scene.mjs';

const port=Number(process.env.PORT||4681),host='127.0.0.1';
let key=process.env.OPENAI_API_KEY;
if(!key && process.env.PIXEL_KEY_FILE)key=parseEnv(await readFile(process.env.PIXEL_KEY_FILE,'utf8')).OPENAI_API_KEY;
const sessions=new Map();
const resources=new Map(Object.entries({'/':['index.html','text/html'],'/style.css':['style.css','text/css'],'/app.mjs':['app.mjs','text/javascript'],'/art.mjs':['art.mjs','text/javascript'],'/scene.mjs':['scene.mjs','text/javascript'],'/mark.svg':['mark.svg','image/svg+xml']}));
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};

const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.headers.host!==host+':'+port && req.headers.host!=='localhost:'+port)return json(res,403,{error:'Local requests only.'});
  const url=new URL(req.url,'http://'+req.headers.host);
  try{
    if(req.method==='GET' && resources.has(url.pathname)){
      const [name,type]=resources.get(url.pathname);
      const file=await readFile(fileURLToPath(new URL('./public/'+name,import.meta.url)));
      res.writeHead(200,{'Content-Type':type+'; charset=utf-8'});res.end(file);return;
    }
    if(req.method==='GET' && url.pathname==='/api/status')return json(res,200,{configured:Boolean(key)});
    if(req.method!=='POST'||url.pathname!=='/api/edit')return json(res,404,{error:'Not found.'});
    if(req.headers.origin && req.headers.origin!==url.origin)return json(res,403,{error:'Origin rejected.'});
    if(!req.headers['content-type']?.startsWith('application/json'))return json(res,415,{error:'Expected JSON.'});
    if(!key)return json(res,503,{error:'Set OPENAI_API_KEY on the server to enable live drawing.'});
    let raw='';
    for await(const chunk of req){raw+=chunk;if(raw.length>160000)return json(res,413,{error:'Canvas is too large.'});}
    let input,scene;
    try{input=JSON.parse(raw);scene=validateScene(input.scene);}catch{return json(res,400,{error:'Invalid canvas data.'});}
    if(input.scene.size===undefined)return json(res,409,{error:'Refresh AI pixels to edit this canvas at 128 × 128. Your saved drawing will reopen.'});
    const {canvas,prompt}=input;
    if(typeof canvas!=='string'||!/^[-a-z0-9]{36}$/.test(canvas)||typeof prompt!=='string'||!prompt.trim()||prompt.length>1200)return json(res,400,{error:'Enter a drawing instruction up to 1,200 characters.'});
    const state=sessions.get(canvas)||{};
    if(state.busy)return json(res,409,{error:'The previous edit is finishing.'});
    state.busy=true;state.used=Date.now();sessions.set(canvas,state);
    for(const [id,s] of sessions)if(!s.busy && s.used<Date.now()-86400000)sessions.delete(id);
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),60000);
    res.on('close',()=>controller.abort());
    res.writeHead(200,{'Content-Type':'application/x-ndjson','X-Accel-Buffering':'no'});res.flushHeaders();
    const emit=e=>{if(!res.destroyed)res.write(JSON.stringify(e)+'\n');};
    try{
      const result=await editCanvas({state,key,scene,prompt:prompt.trim(),signal:controller.signal,emit});
      emit({type:'done',...result});
    }catch(e){
      // Abandon an uncertain turn. The next request anchors a fresh session to the committed canvas.
      delete state.session;delete state.previous;
      const reason=controller.signal.aborted?'The edit timed out. Try again.':e.message;
      emit({type:'error',message:reason||'Could not complete this edit.'});
    }finally{clearTimeout(timer);state.busy=false;res.end();controller.abort();}
  }catch{if(!res.headersSent)json(res,500,{error:'The studio could not complete this request.'});else res.end();}
});
server.listen(port,host,()=>console.log('AI pixels studio at http://'+host+':'+port));

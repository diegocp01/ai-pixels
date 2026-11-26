import {deflateSync,crc32} from 'node:zlib';
import {applyGenerated,quadrants,raster,SIZE} from './tiles.mjs';
import {compactDrawingHint,editCanvas} from '../provider.mjs';

export function png(scene){
  const {pixels}=raster(scene),rows=Buffer.alloc((128*4+1)*128);
  for(let i=0;i<128;i++)rows.set(pixels.subarray(i*512,(i+1)*512),i*513+1);
  function chunk(type,data){
    const header=Buffer.alloc(8),tail=Buffer.alloc(4);
    header.writeUInt32BE(data.length);header.write(type,4);tail.writeUInt32BE(crc32(data,crc32(header.subarray(4))));
    return Buffer.concat([header,data,tail]);
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(128,0);header.writeUInt32BE(128,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}

async function decide({key,signal,prompt,scene},phase,trace){
  const start=performance.now();
  const question=phase==='before'
    ? {name:'action',instructions:'Does the user want a fresh drawing or a modification to the current picture?',choices:[{value:'fresh_scene'},{value:'edit_existing'}]}
    : {name:'check',instructions:phase==='middle'
      ? 'This is an unfinished draft. Request repair ONLY if the marks ALREADY drawn clearly contradict the request. Missing or unfinished details are normal.'
      : 'Does this finished pixel drawing show the requested subject and its main requested details? Request repair for a clear mismatch.',choices:[{value:'continue'},{value:'repair'}]};
  const content=[{type:'input_text',text:prompt}];
  if(phase!=='before')content.push({type:'input_image',image_url:'data:image/png;base64,'+png(scene).toString('base64')});
  const res=await fetch('https://api.openai.com/v1/decisions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},signal,body:JSON.stringify({model:'gpt-6-luna',input:[{role:'user',content}],questions:[{type:'choice',...question}]})});
  if(!res.ok)throw Error('Decisions returned '+res.status+': '+(await res.text()).slice(0,200));
  const data=await res.json(),answer=data.answers?.[0];
  trace.decisions.push({phase,ms:Math.round(performance.now()-start),choice:answer?.choice,confidence:answer?.confidence});
  if(answer?.type!=='choice')throw Error('No usable Decisions choice.');
  return answer;
}

// Two concurrent original drawings, merged in a fixed back-to-front order.
async function twoLayers(request,trace){
  const front=[];
  let frontLive=false,merged=request.scene;
  const put=line=>{merged=applyGenerated(merged,line);request.emit({type:'draw',line});};
  const shared={...request,state:{},onUsage:u=>trace.usage.push(u)};
  const bg=editCanvas({...shared,hint:'BACKGROUND layer only. Draw just the setting, scenery and sky (including a requested sun), with 1–4 commands. Start with scene. The foreground worker draws the main object, all attached features, wheels, basket, lantern, handles and cast shadow. Keep the center free.',emit:e=>{
    if(e.type==='restart'){merged=request.scene;request.emit(e);trace.retries++;}
    if(e.type==='draw')put(e.line);
  }}).then(()=>{frontLive=true;for(const line of front)put(line);front.length=0;});
  const fg=editCanvas({...shared,state:{},hint:'FOREGROUND layer only. Draw the main recognizable subject, including all attached features and accessories, centered and large. Output its named shapes with a title. Another worker supplies ALL ground, sky, sun and background. Avoid full-canvas shapes. Use 6–16 purposeful shapes.',emit:e=>{
    if(e.type==='restart'){front.length=0;trace.retries++;if(frontLive)throw Error('Foreground stream needs a fresh composition.');}
    if(e.type!=='draw'||/^(scene |base |(?:rect|gradient) (?:background|bg|sky|backdrop)(?:[. ]|$))/.test(e.line))return;
    if(frontLive)put(e.line);else front.push(e.line);
  }});
  const parts=await Promise.allSettled([bg,fg]);
  for(const part of parts)if(part.status==='rejected')throw part.reason;
  return {scene:merged,engine:'Layered Responses'};
}

async function fourQuadrants(request,trace){
  let merged=request.scene;
  const started=performance.now();
  trace.workers=[];
  const workers=quadrants.map(async({name,x,y},index)=>{
    const half=SIZE/2;
    const hint=`Four artists share one ${SIZE}×${SIZE} artwork. Your only visible area is the ${name} quadrant, global x=${x}..${x+half-1}, y=${y}..${y+half-1}. Use global coordinates. Imagine ONE composition centered at (64,64) with the main subject spanning approximately x=16..111 and y=16..111, unless the request specifies a layout. Use the requested background color and lighting from the upper left. Start with scene. Draw only features intersecting your area. For shapes crossing an edge, give their natural global coordinates; the renderer clips them. Preserve the original subject's scale and position. Use a few purposeful commands.`;
    const timing={quadrant:name,startMs:Math.round(performance.now()-started)};
    trace.workers.push(timing);
    let pending=[];
    function paint(command){
      const line='tile '+index+' '+command;
      merged=applyGenerated(merged,line);
      request.emit({type:'draw',line});
    }
    // Like the studio, wait for the first foreground mark before revealing a blank background.
    await editCanvas({...request,state:{},hint,onUsage:u=>trace.usage.push(u),emit:e=>{
      if(e.type==='restart'){trace.retries++;pending=[];paint('restart');}
      if(e.type!=='draw')return;
      if(pending && /^(scene |base |title |(?:rect|gradient) (?:background|bg|backdrop|sky)(?:\.| ))/.test(e.line)){
        pending.push(e.line);return;
      }
      if(pending){pending.forEach(paint);pending=null;}
      paint(e.line);
    }});
    if(pending)pending.forEach(paint);
    timing.endMs=Math.round(performance.now()-started);
  });
  const results=await Promise.allSettled(workers);
  for(const result of results)if(result.status==='rejected')throw result.reason;
  return {scene:merged,engine:'Four parallel quadrants'};
}

export async function runArchitecture(request,phase,trace){
  if(phase==='quadrants')return fourQuadrants(request,trace);
  if(phase==='layers')return twoLayers(request,trace);
  if(phase==='compact')request={...request,hint:compactDrawingHint};
  const {emit}=request;
  let partial=request.scene,marks=0,mid;
  if(phase==='before'){
    const vote=await decide(request,phase,trace);
    request={...request,hint:vote.choice==='fresh_scene'?'Compose a new scene.':'Modify the existing scene.'};
  }
  const generate=async(req)=>editCanvas({...req,onUsage:usage=>trace.usage.push(usage),emit:e=>{
    if(e.type==='restart'){partial=request.scene;trace.retries++;}
    if(e.type==='draw'){
      partial=applyGenerated(partial,e.line);
      if(!/^(scene |title |base )/.test(e.line)){
        marks++;
        if(phase==='middle'&&!mid&&(marks===3||/^(color |remove )/.test(e.line))){
          // Check the actual in-flight raster while the same model keeps drawing.
          mid=decide({...request,scene:partial},phase,trace).then(value=>({value}),error=>({error}));
        }
      }
    }
    emit(e);
  }});
  let result=await generate(request);
  let vote;
  if(phase==='middle'){
    if(mid){const out=await mid;if(out.error)throw out.error;vote=out.value;}
    else vote=await decide({...request,scene:result.scene},phase,trace);
  }
  if(phase==='after')vote=await decide({...request,scene:result.scene},phase,trace);
  if(vote?.choice==='repair'&&vote.confidence>=.85){
    trace.repairs++;
    result=await generate({...request,scene:result.scene,hint:'Inspect the previous drawing against the original brief and correct any mismatch.'});
  }
  return result;
}

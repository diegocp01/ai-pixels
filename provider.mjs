import {createHash,randomUUID} from 'node:crypto';
import {SIZE,applyGenerated,description} from './public/scene.mjs';

const root='https://api.openai.com/v1';
export const compactDrawingHint='For a new scene, aim for 7–10 intentional shapes: a strong silhouette, every requested feature, then a highlight or shadow if useful. Add shapes when the brief needs them. For an edit, use the fewest commands that preserve all other pixels.';
const instructions=`Draw original pixel art from any prompt on a ${SIZE}×${SIZE} canvas. Output ONLY newline-delimited commands. Coordinates are integer pixels 0..${SIZE-1}. A short subject by itself requests a new drawing. For a new composition, start with scene, then draw the subject's dominant silhouette immediately, then distinguishing features, requested accessories, and lighting. Favor a readable subject with about 8–18 purposeful shapes; add detail when requested. For a change to the current drawing, edit its named parts and preserve other pixels. Match colors, counts, and placement. Use short lowercase dot-separated semantic IDs for parts so later edits can target them.
Commands (replace placeholders, use six-digit RGB hex colors):
scene #rrggbb Short title  — clears to a solid background. No built-in subjects.
rect id #rrggbb x y width height
oval id #rrggbb x y width height
poly id #rrggbb x1 y1 x2 y2 x3 y3 ...  — filled polygon
line id #rrggbb x1 y1 x2 y2
gradient id #from #to x y width height v|h steps  — rectangular gradient, two six-digit hex colors, 2–128 steps
color id #rrggbb  — recolor all matching parts, including id.* children
remove id  — remove this part and its children
title New title
refine  — use only for an explicit detail upgrade to legacyArt.
Shape coordinates and bounds are supplied in native pixels. The latest canvas is authoritative. Paint back to front; every new shape is opaque. Make each generated scene specific to the request. Emit each command as soon as it is ready.`;

async function request(path,{key,signal,body,method,headers}) {
  const response=await fetch(root+path,{method:method||(body?'POST':'GET'),signal,headers:{
    Authorization:'Bearer '+key,'Content-Type':'application/json',...headers
  },body:body?JSON.stringify(body):undefined});
  if(!response.ok){
    const data=await response.json().catch(()=>({}));
    const err=new Error((data.error?.message||'OpenAI request failed.').slice(0,280));
    err.status=response.status;
    throw err;
  }
  return response;
}
async function* events(response){
  const stream=response.body.pipeThrough(new TextDecoderStream());
  let buffer='';
  for await(const chunk of stream){
    buffer+=chunk;
    let cut;
    while((cut=buffer.indexOf('\n'))>=0){
      const line=buffer.slice(0,cut).trimEnd(); buffer=buffer.slice(cut+1);
      if(!line.startsWith('data:'))continue;
      const raw=line.slice(5).trim();
      if(raw && raw!=='[DONE]')yield JSON.parse(raw);
    }
  }
}

class DrawingFormatError extends Error {}

function drawing(scene,emit) {
  let buffer='',current=scene,count=0;
  function command(line) {
    line=line.trim();
    if(!line||line.startsWith('```'))return;
    if(++count>100||line.length>650)throw Error('Drawing exceeded its size limit.');
    try {current=applyGenerated(current,line);}
    catch(cause){throw new DrawingFormatError(cause.message+' Invalid line: '+line.slice(0,180));}
    emit({type:'draw',line});
  }
  function append(text){
    buffer+=text;
    let i;
    while((i=buffer.indexOf('\n'))!==-1){command(buffer.slice(0,i));buffer=buffer.slice(i+1);}
    if(buffer.length>700)throw Error('Invalid drawing output.');
  }
  function endText(){command(buffer);buffer='';}
  return {append,endText,finish(){endText();if(!count)throw Error('No drawing commands received.');return current;}};
}

async function runSession({state,input,key,signal,emit,scene,model,serviceTier}){
  const opts={key,signal,headers:{'OpenAI-Beta':'agents=v1'}};
  let response;
  if(!state.session){
    response=await request('/agents/sessions',{...opts,body:{agent:{model,instructions,reasoning:{effort:'low'},service_tier:serviceTier},environment:{type:'none'},input,stream:true}});
  }else{
    const path='/agents/sessions/'+encodeURIComponent(state.session)+'/events';
    response=await request(path+'?stream=true',opts);
    await request(path,{...opts,headers:{...opts.headers,'Idempotency-Key':randomUUID()},body:{events:[{type:'agent.session.input.message',input:[{role:'user',content:[{type:'input_text',text:input}]}]}]}});
  }
  const draw=drawing(scene,emit);
  const parts=new Map();
  for await(const e of events(response)){
    state.session ||= e.session?.id || e.session_id || null;
    if(e.turn?.subagent_id||e.subagent_id)continue;
    if(e.turn?.id)state.turn=e.turn.id;
    const part=e.item_id+':'+(e.content_index||0);
    if(e.type==='agent.session.turn.output_text.delta'){
      parts.set(part,(parts.get(part)||'')+e.delta);draw.append(e.delta);
    }else if(e.type==='agent.session.turn.output_text.done'){
      const previous=parts.get(part)||'';
      if(!e.text.startsWith(previous))throw Error('Drawing stream changed while being received.');
      draw.append(e.text.slice(previous.length));draw.endText();parts.set(part,e.text);
    }else if(e.type==='agent.session.turn.completed'){
      if(!state.session)throw Error('OpenAI did not return a canvas session.');
      return draw.finish();
    }else if(e.type==='error'||/\.(failed|cancelled|requires_action)$/.test(e.type)){
      throw Error(e.turn?.error?.message||e.error?.message||'OpenAI could not finish this drawing.');
    }
  }
  throw Error('The drawing stream ended early.');
}

async function runResponses({state,input,key,signal,scene,emit,model,serviceTier,onUsage}){
  const messages=[{role:'user',content:input}];
  if(!state.previous)messages.unshift({role:'developer',content:instructions});
  const response=await request('/responses',{key,signal,body:{model,input:messages,stream:true,store:true,service_tier:serviceTier,reasoning:{effort:'low'},max_output_tokens:3200,...(state.previous?{previous_response_id:state.previous}:{})}});
  const draw=drawing(scene,emit);
  let received='';
  for await(const e of events(response)){
    if(e.type==='response.output_text.delta'){received+=e.delta;draw.append(e.delta);}
    if(e.type==='response.output_text.done' && e.text.startsWith(received)){draw.append(e.text.slice(received.length));draw.endText();received=e.text;}
    if(e.type==='response.completed'){
      onUsage?.({model:e.response.model,tier:e.response.service_tier,outputTokens:e.response.usage?.output_tokens});
      const result=draw.finish();state.previous=e.response.id;return result;
    }
    if(e.type==='error'||e.type==='response.failed'||e.type==='response.incomplete')throw Error('The model could not finish this edit.');
  }
  throw Error('The drawing stream ended early.');
}

function signature(scene){
  const data=[scene.base,scene.title,scene.legacyCount,scene.detailCount,scene.ops];
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

export async function editCanvas({
  state,key,scene,prompt,emit,signal,transport=process.env.PIXEL_API_MODE,
  model=transport==='sessions'?'gpt-6.2-sol':'gpt-6.1-sol',serviceTier='ultrafast',
  hint=transport==='sessions'?undefined:compactDrawingHint,onUsage
}){
  const resume=state.signature===signature(scene);
  if(!resume){delete state.previous;delete state.session;}
  const canvas=description(scene);
  const sessionMode=transport==='sessions';
  const run=sessionMode?runSession:runResponses;
  // The previous turn already contains its geometry. Send full context on a new
  // conversation, branch, or recovery; send current visible bounds on a follow-up.
  const message={request:prompt,currentCanvas:canvas};
  if(hint)message.drawingHint=hint;
  if(resume && (state.previous||state.session))message.currentCanvas={...canvas,edits:undefined};
  async function generate(input){
    const result=await run({state,key,scene,input:JSON.stringify(input),emit,signal,model,serviceTier,onUsage});
    state.signature=signature(result);
    return {scene:result,engine:sessionMode?'Sessions':'Responses'};
  }
  try{return await generate(message);}
  catch(error){
    const staleResponse=!sessionMode && state.previous && (error.status===400||error.status===404) && /previous.response|response.+not found/i.test(error.message);
    if(!(error instanceof DrawingFormatError) && !staleResponse)throw error;
    signal.throwIfAborted();
    delete state.previous;delete state.session;
    emit({type:'restart'});
    const retry={...message,currentCanvas:canvas};
    if(error instanceof DrawingFormatError)retry.correction='Rewrite the whole requested drawing with valid commands. '+error.message;
    return generate(retry);
  }
}

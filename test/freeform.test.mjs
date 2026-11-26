import test from 'node:test';
import assert from 'node:assert/strict';
import {editCanvas} from '../provider.mjs';
import {initial} from '../public/scene.mjs';

function fakeOpenAI(t,outputs){
  const calls=[];
  t.mock.method(globalThis,'fetch',async(url,{body})=>{
    assert.equal(url,'https://api.openai.com/v1/responses');
    const index=calls.length;
    calls.push(JSON.parse(body));
    const text=outputs[index];
    assert.equal(typeof text,'string');
    // Include partial command chunks and a final line without a newline.
    const events=[{type:'response.output_text.delta',delta:text.slice(0,5)},{type:'response.output_text.delta',delta:text.slice(5)},{type:'response.output_text.done',text},{type:'response.completed',response:{id:'resp_'+index}}];
    return new Response(events.map(event=>'data: '+JSON.stringify(event)+'\n\n').join(''));
  });
  return calls;
}
const options=()=>({state:{},scene:initial(),prompt:'Draw a cat',key:'mock',signal:new AbortController().signal,emit:()=>{}});

test('an ordinary subject takes one generative call and follow-ups use committed geometry',async t=>{
  const calls=fakeOpenAI(t,['scene #f8dda1 Curious Cat\noval cat.head #402b19 18 19 48 57','color cat.head #604812','rect mark #102030 1 1 1 1']);
  const ctx=options();
  const result=await editCanvas(ctx);
  assert.equal(result.scene.base,'blank');assert.equal(result.engine,'Responses');
  assert.equal(result.scene.ops.length,2);assert.equal(calls.length,1);
  assert.equal(calls[0].model,'gpt-6.1-sol');
  assert.equal(calls[0].service_tier,'ultrafast');
  assert.ok(JSON.parse(calls[0].input.at(-1).content).drawingHint);
  assert.equal(calls[0].input[0].role,'developer');
  const follow=await editCanvas({...ctx,scene:result.scene,prompt:'Make its head brown.'});
  assert.equal(calls[1].previous_response_id,'resp_0');
  const second=JSON.parse(calls[1].input.at(-1).content).currentCanvas;
  assert.ok(second.visibleRegions['cat.head']);assert.equal(second.edits,undefined);
  assert.equal(follow.scene.ops.length,3);
  await editCanvas({...ctx,scene:result.scene,prompt:'Add a mark.'});
  assert.equal(calls[2].previous_response_id,undefined);
  assert.deepEqual(JSON.parse(calls[2].input.at(-1).content).currentCanvas.edits,result.scene.ops);
});

test('a rejected template restarts the stream once from the original canvas',async t=>{
  const calls=fakeOpenAI(t,['scene #ccbbaa Wrong\nbase cat','scene #332211 New cat\npoly cat.ear #665544 5 2 7 8 2 8']);
  const events=[],ctx={...options(),emit:e=>events.push(e)};
  const result=await editCanvas(ctx);
  assert.equal(calls.length,2);
  assert.deepEqual(events.map(e=>e.type),['draw','restart','draw','draw']);
  assert.equal(result.scene.title,'New cat');assert.equal(result.scene.ops.length,2);
  assert.equal(JSON.parse(calls[1].input.at(-1).content).currentCanvas.title,ctx.scene.title);
});

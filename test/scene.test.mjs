import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SIZE,apply,applyGenerated,description,initial,parseLine,raster,validateScene} from '../public/scene.mjs';

test('existing cat and tree scenes can still replay their original meadow',()=>{
  const tree=initial(),cat=apply(tree,'base cat');
  assert.equal(cat.base,'cat');
  const a=raster(tree),b=raster(cat);
  assert.deepEqual(a.pixels.slice(0,4*SIZE*4),b.pixels.slice(0,4*SIZE*4));
  assert.ok(b.regions.includes('cat.eyes.iris'));
});
test('the eye edit touches every visible iris pixel and nothing outside them',()=>{
  const cat=apply(initial(),'base cat'),before=raster(cat),after=raster(applyGenerated(cat,'color cat.eyes.iris #428ce0'));
  let count=0;
  before.regions.forEach((id,i)=>{
    const a=before.pixels.slice(i*4,i*4+4),b=after.pixels.slice(i*4,i*4+4);
    if(id==='cat.eyes.iris'){assert.deepEqual([...b],[66,140,224,255]);count++;}else assert.deepEqual(a,b);
  });
  assert.ok(count>=8);
});
test('custom shapes remain editable and removable across a saved scene',()=>{
  const base=initial(),edit=apply(base,'oval balloon.envelope #ff6438 42 4 13 16');
  assert.deepEqual(description(edit).visibleRegions['balloon.envelope'],[42,4,54,19]);
  const saved=validateScene(JSON.parse(JSON.stringify(edit)));
  const removed=apply(saved,'remove balloon');assert.deepEqual(raster(removed),raster(base));
});
test('live scenes use new geometry while historical bases remain readable',()=>{
  const scene=applyGenerated(initial(),'scene #123456 Coral Observatory');
  assert.equal(scene.base,'blank');assert.equal(scene.title,'Coral Observatory');
  assert.deepEqual(raster(scene).pixels.slice(0,4),new Uint8ClampedArray([18,52,86,255]));
  for(const line of ['base cat','base tree','base meadow','base\tcat','season autumn'])assert.throws(()=>applyGenerated(scene,line));
  assert.equal(applyGenerated(scene,'oval dome #f19184 34 20 60 60').ops.length,2);
});
test('malformed geometry and invalid scenes are rejected',()=>{
  for(const line of ['rect bad #ffffff 0 0 -1 4','poly p #ffffff 0 0 2 2','line p transparent 0 0 1 1','base constructor','rect x #aabbcc 0 Infinity 1 1'])assert.throws(()=>parseLine(line));
  assert.throws(()=>validateScene({base:'tree',title:'Test',ops:['base cat']}));
});
test('new canvases have four times the addressable pixels and a richer palette',()=>{
  const scene=initial(),{pixels,regions}=raster(scene);
  assert.equal(SIZE,128);assert.equal(pixels.length,4*128*128);
  assert.ok(new Set(new Uint32Array(pixels.buffer)).size>=90);
  const edited=apply(scene,'rect point #12abfe 127 127 1 1'),after=raster(edited);
  assert.deepEqual([...after.pixels.slice(-4)],[18,171,254,255]);
  assert.deepEqual(after.pixels.slice(0,-4),pixels.slice(0,-4));
  assert.equal(after.regions.length,regions.length);
  assert.deepEqual(description(edited).visibleRegions.point,[127,127,127,127]);
});
test('native gradients respect orientation, clipping, endpoints and region edits',()=>{
  for(const axis of ['h','v']){
    const scene=apply(initial(),'gradient ribbon #000000 #ffffff 121 121 7 7 '+axis+' 7');
    const {pixels,regions}=raster(scene);
    const read=(x,y)=>pixels[(y*SIZE+x)*4];
    assert.equal(read(121,121),0);assert.equal(read(127,127),255);
    assert.equal(read(124,121),axis==='h'?128:0);assert.equal(read(121,124),axis==='v'?128:0);
    assert.equal(regions.filter(id=>id==='ribbon').length,49);
    assert.equal(raster(apply(scene,'color ribbon #bb0077')).pixels.at(-4),187);
    assert.deepEqual(raster(apply(scene,'remove ribbon')),raster(initial()));
  }
  for(const line of ['gradient band #000000 #ffffff 0 0 2 2 v 1','gradient band #000000 #ffffff 0 0 2 2 diagonal 8','gradient band #000000 #123 0 0 2 2 h 4'])assert.throws(()=>parseLine(line));
});
test('old canvases preserve every pixel and allow native edits after reload',()=>{
  const old={base:'cat',title:'Vintage',ops:['color cat.eyes.iris #fc11dc','oval badge #ff0000 49 51 7 6','line ribbon #aa66cc 21 7 53 31','poly ribbon #66aaff 4 2 10 17 1 9','remove hills.mid']};
  const migrated=validateScene(old),{pixels}=raster(migrated),downsampled=Buffer.alloc(64*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    const i=(y*2*SIZE+x*2)*4,original=pixels.subarray(i,i+4);
    downsampled.set(original,(y*64+x)*4);
    for(const offset of [4,SIZE*4,SIZE*4+4])assert.deepEqual(pixels.subarray(i+offset,i+offset+4),original);
  }
  assert.equal(createHash('sha256').update(downsampled).digest('hex'),'fb72e9b68cc553a4faa503c3019c74b9b391960d1482c812297994ca683c99e4');
  const saved=validateScene(JSON.parse(JSON.stringify(apply(migrated,'rect pin #102030 127 127 1 1'))));
  assert.deepEqual(raster(saved).pixels.slice(0,-4),pixels.slice(0,-4));
  assert.deepEqual(description(saved).edits.slice(-1),['rect pin #102030 127 127 1 1']);
  assert.equal(description(saved).edits[1],'oval badge #ff0000 98 102 14 12');
  assert.deepEqual(apply(saved,'base tree'),initial());
});
test('optional refinement keeps older subjects in place while using native art and contours',()=>{
  const saved=validateScene({base:'meadow',title:'Meadow Pup',ops:['oval pup.body #ab652b 18 25 30 20','rect pup.nose #171717 46 27 2 1']});
  const oldPixels=raster(saved),upgraded=applyGenerated(saved,'refine');
  assert.equal(upgraded.title,saved.title);assert.equal(upgraded.legacyCount,undefined);
  assert.deepEqual(description(upgraded).visibleRegions['pup.nose'],description(saved).visibleRegions['pup.nose']);
  const newPixels=raster(upgraded);
  assert.ok(new Set(new Uint32Array(newPixels.pixels.buffer)).size>new Set(new Uint32Array(oldPixels.pixels.buffer)).size);
  assert.deepEqual(apply(upgraded,'refine'),upgraded);
});
test('refining custom art on a blank base adds shades and later exact colors still win',()=>{
  const old=validateScene({base:'blank',title:'Custom',ops:['rect sky #ccddff 0 0 64 64','poly dog #84512d 20 18 43 20 39 46 22 48','oval dog.nose #111111 28 27 3 2']});
  const refined=validateScene(apply(old,'refine'));
  const {pixels,regions}=raster(refined);
  assert.ok(new Set(new Uint32Array(pixels.buffer)).size>20);
  assert.ok(regions.includes('dog.nose'));
  const recolored=raster(apply(refined,'color dog #a2b3c4'));
  for(const [i,id] of regions.entries())if(id.startsWith('dog'))assert.deepEqual([...recolored.pixels.slice(i*4,i*4+3)],[162,179,196]);
});

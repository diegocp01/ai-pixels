import {template,titles,autumnLeaves} from './art.mjs';

export const SIZE=128;
const OLD_SIZE=64;
export const initial=()=>({size:SIZE,base:'tree',title:titles.tree,ops:[]});
const idPattern=/^[a-z][a-z0-9_.-]{0,47}$/;
const hex=/^#[a-f0-9]{6}$/i;
const dimensions={rect:4,oval:4,line:4};
const belongs=(id,prefix)=>id===prefix || id.startsWith(prefix+'.');
const autumn=new Map(Object.entries({'#294e43':'#684739','#3b6450':'#8e5538','#527e53':'#b76937','#789957':'#d88c42','#90aa63':'#e9a950','#a8b76f':'#f3c668',...autumnLeaves}));

const validCoord=v=>Number.isInteger(v)&&v>=-SIZE&&v<=2*SIZE;

export function parseLine(line) {
  if(line.trim()==='refine')return {kind:'refine'};
  const [kind,id,color,...args]=line.trim().split(/\s+/);
  if(kind==='base' && Object.hasOwn(titles,id) && color===undefined)return {kind,id};
  if(kind==='title' && /^title\s+[^<>\r\n]{1,48}$/.test(line))return {kind,title:line.slice(6).trim()};
  if(kind==='season' && id==='autumn' && !color)return {kind,id};
  if(!idPattern.test(id||''))throw Error('Invalid drawing region.');
  if(kind==='remove' && !color)return {kind,id};
  if(!hex.test(color||''))throw Error('Invalid pixel color.');
  if(kind==='color' && !args.length)return {kind,id,color};
  if(kind==='gradient'){
    const [end,...values]=args;
    const [x,y,w,h]=values.slice(0,4).map(Number),axis=values[4],steps=Number(values[5]);
    if(!hex.test(end)||values.length!==6||![x,y,w,h].every(validCoord)||w<1||h<1||
       !['h','v'].includes(axis)||!Number.isInteger(steps)||steps<2||steps>SIZE)throw Error('Invalid gradient.');
    return {kind,id,color,end,coords:[x,y,w,h],axis,steps};
  }
  const coords=args.map(Number);
  if(!coords.every(validCoord))throw Error('Invalid pixel coordinates.');
  if(kind==='poly' ? coords.length>=6&&coords.length<=96&&coords.length%2===0 : Object.hasOwn(dimensions,kind)&&coords.length===dimensions[kind]){
    if((kind==='rect'||kind==='oval') && (coords[2]<1||coords[3]<1))throw Error('Shape is empty.');
    return {kind,id,color,coords};
  }
  throw Error('Unknown drawing command.');
}

export function apply(scene,line) {
  const op=parseLine(line);
  if(op.kind==='base')return {size:SIZE,base:op.id,title:titles[op.id],ops:[]};
  if(op.kind==='refine'){
    if(scene.legacyCount===undefined)return scene;
    const ops=nativeCommands(scene);
    return {size:SIZE,base:scene.base,title:scene.title,ops,detailCount:scene.legacyCount};
  }
  if(op.kind==='title')return {...scene,title:op.title};
  if(scene.ops.length>=650)throw Error('Canvas edit limit reached.');
  return {...scene,ops:[...scene.ops,line]};
}

const presets=new Map();
function shapesFor(scene) {
  const legacy=scene.legacyCount!==undefined;
  const key=scene.base+(legacy?'-64':'-128');
  if(!presets.has(key)){
    const base=template(scene.base,legacy);
    presets.set(key,legacy?base.map(s=>({...s,legacy:true})):base);
  }
  let shapes=[...presets.get(key)];
  for(const [i,line] of scene.ops.entries()){
    const op=parseLine(line);
    if(i<scene.legacyCount)op.legacy=true;
    if(i<scene.detailCount)op.detail=true;
    if(op.kind==='remove')shapes=shapes.filter(s=>!belongs(s.id,op.id));
    else if(op.kind==='color')shapes=shapes.map(s=>belongs(s.id,op.id)?{...s,kind:s.kind==='gradient'?'rect':s.kind,color:op.color,detail:Boolean(op.detail)}:s);
    else if(op.kind==='season')shapes=shapes.map(s=>belongs(s.id,'tree.leaves')&&autumn.has(s.color)?{...s,color:autumn.get(s.color)}:s);
    else shapes.push(op);
  }
  return shapes;
}
export function validateScene(s) {
  if(!s||!Object.hasOwn(titles,s.base)||typeof s.title!=='string'||s.title.length>48||!Array.isArray(s.ops)||s.ops.length>650)throw Error('Invalid canvas.');
  for(const line of s.ops)if(typeof line!=='string'||line.length>650||['title','base','refine'].includes(parseLine(line).kind))throw Error('Invalid canvas operation.');
  if(s.size!==undefined && s.size!==SIZE)throw Error('Unsupported canvas size.');
  const scene={size:SIZE,base:s.base,title:s.title,ops:s.ops};
  const count=s.size===undefined?s.ops.length:s.legacyCount;
  if(count!==undefined){
    if(!Number.isInteger(count)||count<0||count>s.ops.length)throw Error('Invalid legacy drawing.');
    scene.legacyCount=count;
  }
  if(s.detailCount!==undefined){
    if(count!==undefined||!Number.isInteger(s.detailCount)||s.detailCount<0||s.detailCount>s.ops.length)throw Error('Invalid detail range.');
    scene.detailCount=s.detailCount;
  }
  return scene;
}

function paint(shape,put,limit) {
  const a=shape.coords;
  if(shape.kind==='line'){
    let [x,y,x2,y2]=a;
    const dx=Math.abs(x2-x),dy=-Math.abs(y2-y),sx=x<x2?1:-1,sy=y<y2?1:-1;
    let err=dx+dy;
    for(;;){put(x,y);if(x===x2&&y===y2)break;const e=2*err;if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}}
    return;
  }
  if(shape.kind==='poly'){
    const ys=a.filter((_,i)=>i%2===1);
    for(let y=Math.max(0,Math.min(...ys));y<Math.min(limit,Math.max(...ys));y++){
      const cuts=[],scan=y+0.5;
      for(let i=0,j=a.length-2;i<a.length;j=i,i+=2){
        if((a[i+1]>scan)!==(a[j+1]>scan))cuts.push(a[i]+(scan-a[i+1])*(a[j]-a[i])/(a[j+1]-a[i+1]));
      }
      cuts.sort((u,v)=>u-v);
      for(let k=0;k+1<cuts.length;k+=2)for(let x=Math.max(0,Math.ceil(cuts[k]-0.5));x<Math.min(limit,Math.ceil(cuts[k+1]-0.5));x++)put(x,y);
    }
    return;
  }
  const [x,y,w,h]=a;
  for(let yy=Math.max(0,y);yy<Math.min(limit,y+h);yy++)for(let xx=Math.max(0,x);xx<Math.min(limit,x+w);xx++){
    if(shape.kind==='rect'||((xx+0.5-x-w/2)/(w/2))**2+((yy+0.5-y-h/2)/(h/2))**2<=1)put(xx,yy);
  }
}

function colorRamp(first,last,length,steps){
  return Array.from({length},(_,n)=>{
    const t=Math.round(n/Math.max(1,length-1)*(steps-1))/(steps-1);
    const channel=shift=>Math.round(((first>>shift)&255)*(1-t)+((last>>shift)&255)*t);
    return (channel(16)<<16)|(channel(8)<<8)|channel(0);
  });
}

function detailRamp(shape,rgb){
  // Add a few bands of light to broad areas of an old drawing. Fine marks keep their exact ink.
  if(shape.kind==='line')return null;
  const a=shape.coords;
  let top=a[1],height=a[3];
  if(shape.kind==='poly'){
    const ys=a.filter((_,i)=>i%2===1);
    top=Math.min(...ys);height=Math.max(...ys)-top;
  }
  if(height<8)return null;
  const r=rgb>>16,g=(rgb>>8)&255,b=rgb&255;
  const light=(Math.round(r+(255-r)*.13)<<16)|(Math.round(g+(255-g)*.11)<<8)|Math.round(b+(255-b)*.09);
  const dark=(Math.round(r*.88)<<16)|(Math.round(g*.90)<<8)|Math.round(b*.94);
  return {top,colors:colorRamp(light,dark,height,Math.min(18,Math.ceil(height/3)))};
}

export function raster(scene) {
  const pixels=new Uint8ClampedArray(SIZE*SIZE*4);
  const regions=new Array(SIZE*SIZE).fill('');
  for(const shape of shapesFor(scene)){
    const first=parseInt(shape.color.slice(1),16);
    function put(x,y,rgb=first){
      if(x<0||y<0||x>=SIZE||y>=SIZE)return;
      const i=y*SIZE+x,j=i*4;
      pixels[j]=rgb>>16;pixels[j+1]=(rgb>>8)&255;pixels[j+2]=rgb&255;pixels[j+3]=255;regions[i]=shape.id;
    }
    if(shape.legacy){
      // Each historical pixel occupies an exact 2x2 block, including thin diagonals.
      paint(shape,(x,y)=>{put(2*x,2*y);put(2*x+1,2*y);put(2*x,2*y+1);put(2*x+1,2*y+1);},OLD_SIZE);
    }else if(shape.kind==='gradient'){
      const [x,y,w,h]=shape.coords, last=parseInt(shape.end.slice(1),16);
      const length=shape.axis==='v'?h:w;
      const ramp=colorRamp(first,last,length,shape.steps);
      paint({...shape,kind:'rect'},(xx,yy)=>put(xx,yy,ramp[shape.axis==='v'?yy-y:xx-x]),SIZE);
    }else{
      const shade=shape.detail && detailRamp(shape,first);
      paint(shape,shade?(x,y)=>put(x,y,shade.colors[y-shade.top]):put,SIZE);
    }
  }
  return {pixels,regions};
}
function nativeCommands(scene){
  if(!scene.legacyCount)return scene.ops;
  return scene.ops.map((line,i)=>{
    if(i>=scene.legacyCount)return line;
    const op=parseLine(line);
    return op.coords?[op.kind,op.id,op.color,...op.coords.map(v=>v*2)].join(' '):line;
  });
}

export function description(scene) {
  const {regions}=raster(scene);
  const bounds=new Map();
  regions.forEach((id,i)=>{
    if(!id)return;
    const x=i%SIZE,y=Math.floor(i/SIZE),box=bounds.get(id)||[x,y,x,y];
    box[0]=Math.min(box[0],x);box[1]=Math.min(box[1],y);box[2]=Math.max(box[2],x);box[3]=Math.max(box[3],y);
    bounds.set(id,box);
  });
  return {width:SIZE,height:SIZE,legacyArt:scene.legacyCount!==undefined,title:scene.title,base:scene.base,edits:nativeCommands(scene),visibleRegions:Object.fromEntries(bounds)};
}

// Saved scenes still replay their original named bases. Live generation accepts only
// a plain canvas and general drawing operations, even when the prompt names a familiar subject.
export function applyGenerated(scene,line){
  const open=line.match(/^scene (#[0-9a-f]{6})(?: (.{1,48}))?$/i);
  if(open){
    const cleared=apply(scene,'base blank');
    const named=open[2]?apply(cleared,'title '+open[2]):cleared;
    return apply(named,'rect background '+open[1]+' 0 0 '+SIZE+' '+SIZE);
  }
  const [kind,base]=line.trim().split(/\s+/);
  if((kind==='base' && base!=='blank') || kind==='season'){
    throw Error('Use drawing primitives for the requested subject.');
  }
  return apply(scene,line);
}

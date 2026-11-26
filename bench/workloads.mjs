import {applyGenerated, initial, raster} from '../public/scene.mjs';

export const tasks={
  porthole:'Draw one continuous, perfectly round orange ring on flat navy. Center it at (64,64) with outer radius 46 pixels and inner radius 34 pixels. Use only #f18439 for the ring and #14243a inside and outside. The ring must connect across all four quarters.',
  robot:'Draw a little green robot holding a red open umbrella above its head, standing in blue rain. Use #419765 for the robot, #d34652 for the umbrella canopy and #54769b for the rainy sky.',
  balloon:'Draw a teal hot-air balloon with a brown basket and a round yellow sun in a pale blue sky. Use #168c91 on the envelope, #895c37 on the basket, and #ffe083 on the sun.',
  skate:'Draw a side-view purple roller skate with exactly three separate orange wheels in a row on a cream background. Use #774092 for the boot and #f28132 for the wheels.',
  edit:'Change only the left balloon to #ff6b35. Keep every other pixel exactly as it is.',
  lighthouse:'Draw a red lighthouse with a single bright yellow lantern on a navy night sky. Use #ce414a for the tower, #ffe083 for the lantern and #172843 for the sky.',
  teapot:'Draw a cobalt blue teapot with a yellow handle on the right, a spout on the left, and a cream background. Use #2459aa for the pot and #ffbf40 for the handle.'
};
export const fixture=['scene #eee5cf Balloons','line left.string #504c45 37 70 43 108','line right.string #504c45 88 70 83 110','oval left.balloon #658fbe 22 35 31 39','oval right.balloon #c98eba 70 30 36 44'].reduce(applyGenerated,initial());

export function pixelChecks(task,scene,{pixels}=raster(scene)){
  const rgb=(p,i)=>(p[4*i]<<16)|(p[4*i+1]<<8)|p[4*i+2];
  if(task==='edit'){
    const expected=raster(applyGenerated(fixture,'color left.balloon #ff6b35')).pixels;
    return {exact:Buffer.from(expected).equals(Buffer.from(pixels))};
  }
  function region(c){
    const seen=new Uint8Array(128*128);const pieces=[];
    for(let i=0;i<seen.length;i++){
      if(seen[i]||rgb(pixels,i)!==c)continue;
      let n=0,sx=0,sy=0;const stack=[i];seen[i]=1;
      while(stack.length){
        const j=stack.pop(),x=j%128,y=j>>7;n++;sx+=x;sy+=y;
        for(const k of [x>0?j-1:-1,x<127?j+1:-1,y>0?j-128:-1,y<127?j+128:-1]){
          if(k>=0&&!seen[k]&&rgb(pixels,k)===c){seen[k]=1;stack.push(k);}
        }
      }
      pieces.push({n,x:sx/n,y:sy/n});
    }
    return pieces.sort((a,b)=>b.n-a.n);
  }
  const sq=(c)=>region(c)[0]||{n:0,x:0,y:0};
  if(task==='porthole'){
    const orange=0xf18439,navy=0x14243a;
    const ring=region(orange);
    const at=(x,y)=>rgb(pixels,y*128+x);
    return {
      continuous:ring.length===1 && ring[0].n>=2000,
      crossesBothAxes:[[64,24],[104,64],[64,104],[24,64]].every(([x,y])=>at(x,y)===orange),
      hollow:at(64,64)===navy && at(0,0)===navy
    };
  }
  if(task==='robot'){
    const robot=sq(0x419765),umbrella=sq(0xd34652);
    return {robot:robot.n>=60,umbrellaAbove:umbrella.n>=80&&umbrella.y<robot.y,sky:sq(0x54769b).n>=600};
  }
  if(task==='balloon'){
    const shell=sq(0x168c91),basket=sq(0x895c37),sun=sq(0xffe083);
    return {envelope:shell.n>=50,basketBelow:basket.n>=12&&basket.y>shell.y,sun:sun.n>=12};
  }
  if(task==='skate'){
    const boot=sq(0x774092),wheels=region(0xf28132).filter(p=>p.n>=12&&p.y>boot.y);
    return {boot:boot.n>=60,threeWheelPositions:[...wheels].sort((a,b)=>a.x-b.x).reduce((centers,p)=>{if(!centers.some(x=>Math.abs(x-p.x)<8))centers.push(p.x);return centers;},[]).length===3};
  }
  if(task==='lighthouse'){
    const tower=sq(0xce414a),lamp=sq(0xffe083);return {tower:tower.n>=50,lanternAbove:lamp.n>=8&&lamp.y<tower.y,sky:sq(0x172843).n>=600};
  }
  const body=sq(0x2459aa),handle=sq(0xffbf40);
  return {pot:body.n>=60,handleRight:handle.n>=18&&handle.x>body.x};
}

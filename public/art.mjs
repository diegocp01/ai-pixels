// Sprites are built out of the same named, editable shapes as live drawings.
function brush() {
  const shapes = [];
  const mark = (kind, id, color, coords) => shapes.push({kind, id, color, coords});
  return {
    shapes,
    rect: (id,c,...a) => mark('rect',id,c,a),
    oval: (id,c,...a) => mark('oval',id,c,a),
    poly: (id,c,...a) => mark('poly',id,c,a),
    line: (id,c,...a) => mark('line',id,c,a),
  };
}

function random(seed) {
  return () => {
    seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function meadow(b) {
  const r = random(92);
  b.rect('sky','#b9d7c5',0,0,64,64);
  b.rect('sky.haze','#cde0c1',0,16,64,9);
  b.rect('sky.haze','#e0e5bd',0,25,64,10);
  b.rect('sky.haze','#ede8bd',0,35,64,8);
  b.oval('sun','#f9edb8',46,5,12,12);
  b.oval('sun','#fff2c8',47,5,10,10);
  const clouds = [[-3,10,14],[7,5,8],[27,15,10],[51,23,13],[1,27,9]];
  for(const [x,y,w] of clouds) {
    b.rect('clouds','#eaf0d2',x,y,w,1);
    b.rect('clouds','#eaf0d2',x+2,y-1,w-5,1);
  }
  b.poly('hills.far','#a5bda2',0,34,9,30,16,33,27,27,33,31,42,25,51,28,60,24,65,26,65,48,0,48);
  b.poly('hills.mid','#83a78b',0,42,0,36,7,33,14,35,21,32,29,36,39,33,46,36,57,30,65,31,65,48,0,48);
  b.poly('hills.near','#688d70',0,38,8,39,19,38,29,43,41,38,53,37,64,33,64,51,0,51);
  b.poly('grass','#91ab69',0,40,10,41,22,43,35,44,48,41,64,38,64,64,0,64);
  b.poly('grass.light','#b4bc76',0,40,9,41,22,43,38,44,50,41,64,38,64,40,53,43,37,46,23,45,8,43,0,43);
  b.poly('grass.middle','#80a060',0,54,9,50,24,50,36,52,49,48,64,47,64,64,0,64);
  b.poly('grass.front','#638454',0,59,10,58,15,56,26,57,35,55,46,57,57,53,64,52,64,64,0,64);
  for(let i=0;i<240;i++) {
    const x=Math.floor(r()*64),y=41+Math.floor(r()*23);
    const c=y<51?['#a8b573','#8da365','#bfd08a']:['#88a365','#506f4c','#a9b976'];
    b.rect('grass.blades',c[i%3],x,y,1+(i%5===0?2:0),1);
  }
  for(const [x,y] of [[4,53],[9,58],[12,51],[19,60],[49,55],[54,49],[57,58],[60,55],[3,61],[47,61]]) {
    b.rect('flowers.stems','#496e4c',x,y,1,2);
    b.rect('flowers.petals','#f1d59b',x,y-1,1,1);
    if(y>55)b.rect('flowers.petals','#f6e6bd',x-1,y,1,1);
  }
}

function oak(b) {
  b.oval('tree.shadow','#6c8853',13,46,39,5);
  b.oval('tree.shadow','#54754e',22,46,22,3);
  b.poly('tree.trunk','#543f32',25,48,29,44,30,35,27,29,19,23,21,22,29,27,33,32,35,27,42,21,43,23,37,31,35,38,35,45,40,48,36,48,33,47,31,48);
  b.poly('tree.trunk.light','#996b43',28,47,31,44,32,37,30,29,33,32,34,37,33,44,34,47);
  b.line('tree.trunk.bark','#c38c54',30,45,32,42);
  b.line('tree.trunk.bark','#715035',35,34,39,29);
  const lobes=[[11,23,15,10],[13,17,15,14],[18,12,16,15],[25,9,18,18],[34,12,15,13],[40,17,13,14],[44,21,11,10],[31,22,18,13],[19,24,18,12]];
  for(const [x,y,w,h] of lobes)b.oval('tree.leaves.deep','#294e43',x,y,w,h);
  for(const [x,y,w,h] of lobes)b.oval('tree.leaves.shade','#3b6450',x,y,w-1,h-2);
  const foliage=[[11,23,14,7],[15,18,12,10],[20,13,15,12],[25,10,16,11],[36,14,11,9],[41,18,11,9],[30,21,15,9],[21,25,13,7]];
  for(const [x,y,w,h] of foliage)b.oval('tree.leaves.mid','#527e53',x,y,w,h);
  const light=[[14,20,10,5],[19,16,10,6],[23,12,11,6],[29,10,9,5],[33,14,10,5],[40,18,7,4],[23,24,8,4],[31,22,8,4],[12,24,7,3]];
  for(const [x,y,w,h] of light)b.oval('tree.leaves.light','#789957',x,y,w,h);
  const r=random(151);
  for(let i=0;i<140;i++) {
    const [x,y,w,h]=light[i%light.length];
    const xx=x+1+Math.floor(r()*(w-2)),yy=y+Math.floor(r()*h);
    if(((xx-x-w/2)/(w/2))**2+((yy-y-h/2)/(h/2))**2>0.92)continue;
    b.rect('tree.leaves.glints',i%3?'#90aa63':'#a8b76f',xx,yy,1+(i%8===0?1:0),1);
  }
}

function cat(b) {
  b.oval('cat.shadow','#688455',14,48,37,5);
  b.poly('cat.tail','#664b38',39,44,44,44,48,40,48,34,50,32,53,33,54,36,53,42,48,47,43,49,37,48);
  b.poly('cat.tail.fur','#c57c48',40,45,45,45,49,41,49,35,51,34,52,35,52,40,49,44,44,47,39,47);
  b.poly('cat.body','#654a37',24,29,33,27,38,31,41,37,44,43,44,48,40,50,23,50,20,48,22,39);
  b.poly('cat.body.fur','#c98750',25,30,32,28,37,33,39,39,42,43,42,47,39,48,25,48,22,46);
  b.poly('cat.chest','#edc192',25,31,32,33,30,39,30,46,26,47,24,43,23,37);
  b.oval('cat.haunch','#ae693f',32,38,11,10);
  b.rect('cat.paws','#eac396',22,47,7,2); b.rect('cat.paws','#dfab78',32,47,8,2);
  b.poly('cat.head','#644738',15,14,24,18,30,17,38,13,38,25,40,28,37,32,31,35,24,35,17,32,14,28,15,23);
  b.poly('cat.head.fur','#d49155',16,16,24,20,30,19,37,15,36,24,38,28,35,31,30,33,24,33,18,30,16,27,17,23);
  b.poly('cat.ears','#df9e85',17,18,22,21,18,23);
  b.poly('cat.ears','#df9e85',33,21,36,17,35,23);
  b.rect('cat.stripes','#9e5e3d',24,20,2,3);b.rect('cat.stripes','#a26440',28,19,2,3);
  b.rect('cat.eyes','#774634',19,24,5,3);b.rect('cat.eyes','#774634',30,24,5,3);
  b.rect('cat.eyes.iris','#92aa75',19,25,4,2);b.rect('cat.eyes.iris','#92aa75',30,25,4,2);
  b.rect('cat.pupils','#3b4037',21,25,1,2);b.rect('cat.pupils','#3b4037',32,25,1,2);
  b.rect('cat.muzzle','#f2d4ab',22,29,4,2);b.rect('cat.muzzle','#f2d4ab',28,29,4,2);
  b.rect('cat.nose','#985f58',25,28,4,2); b.rect('cat.nose','#80524b',26,30,2,1);
  for(const [x,y,x2,y2] of [[20,29,11,27],[20,30,12,31],[34,29,42,27],[34,30,42,31]])b.line('cat.whiskers','#85684d',x,y,x2,y2);
}

function legacyTemplate(name) {
  const b=brush();
  if(name==='blank') b.rect('background','#e9e7d3',0,0,64,64);
  else {meadow(b); if(name==='tree')oak(b); if(name==='cat')cat(b);}
  return b.shapes;
}
export const titles={tree:'Meadow oak', cat:'Meadow cat', meadow:'Open meadow', blank:'Untitled scene'};

// The native templates are composed directly on the 128-pixel grid.
const leafPalette=['#234c50','#2e5d54','#3c7058','#558260','#6e945e','#88a75f','#a5b96a','#c4ca77','#dfdb8d'];
const autumnPalette=['#603e46','#784643','#934f3c','#b15d39','#c9773c','#d88b45','#eaa451','#f2bb69','#f8d487'];
export const autumnLeaves=Object.fromEntries(leafPalette.map((c,i)=>[c,autumnPalette[i]]));

function landscape(b) {
  const rng=random(815);
  b.shapes.push({kind:'gradient',id:'sky',color:'#89b8ce',end:'#ffe0b8',coords:[0,0,128,80],axis:'v',steps:55});
  b.rect('ground','#829761',0,80,128,48);
  b.oval('sun.glow','#f6d8a5',92,12,26,26);
  b.oval('sun','#ffe7a7',94,14,22,22);
  b.oval('sun.core','#fff0bb',96,15,18,19);
  for(const [x,y,w] of [[-6,17,29],[12,10,16],[40,21,13],[84,8,20],[110,34,26],[8,37,18],[78,31,10]]){
    b.rect('clouds.shade','#c6d2cc',x,y+1,w,1);
    b.rect('clouds','#efdfcc',x,y,w,1);
    b.rect('clouds.light','#f8e6d2',x+3,y-1,w-7,1);
    b.rect('clouds.light','#f8e6d2',x+5,y-2,Math.max(2,w-13),1);
  }
  b.poly('hills.far','#aba8b7',0,65,0,53,9,49,17,52,30,42,36,47,47,39,63,54,74,47,86,52,103,38,120,50,128,44,128,74);
  b.poly('hills.sunlit','#d9c2be',15,55,30,42,35,47,30,45,27,49,25,48);
  b.poly('hills.sunlit','#d3bfba',84,54,103,38,110,43,104,42,100,44,97,48,98,44);
  b.poly('hills.mid','#8c9fab',0,66,0,60,12,52,23,59,39,50,54,56,73,47,82,53,90,48,104,55,119,48,128,51,128,78);
  b.poly('hills.near','#75928a',0,64,11,61,29,58,48,66,68,55,86,60,110,57,128,52,128,82,0,82);
  b.poly('hills.forest','#597d72',0,68,16,65,32,63,54,71,75,65,95,69,109,64,128,60,128,83,0,83);
  for(let i=0;i<92;i++){
    const x=Math.floor(rng()*128),y=Math.round(69-3*Math.cos((x-20)*.07)-Math.max(0,x-100)*.17+rng()*2);
    const h=2+Math.floor(rng()*4);
    b.poly('hills.pines',i%3?'#608578':'#668b7a',x-1,y+2,x,y-h,x+2,y+2);
  }
  b.poly('grass','#a0ad6f',0,72,20,71,39,75,57,78,78,77,104,73,128,68,128,128,0,128);
  b.poly('grass.light','#bbc27a',0,72,20,71,39,75,61,78,82,76,103,73,128,68,128,71,104,76,80,80,60,81,37,78,16,74,0,75);
  b.poly('grass.middle','#91a364',0,92,17,87,37,88,55,91,77,88,99,83,128,81,128,128,0,128);
  b.poly('grass.front','#7d945c',0,103,22,100,42,101,64,99,82,95,105,96,128,91,128,128,0,128);
  b.poly('grass.front','#67845b',0,119,22,112,41,113,65,108,87,111,107,103,128,104,128,128,0,128);
  const blades=['#849e60','#9eaf6f','#b4ba72','#c3c481','#698b62','#7a965d','#a7b477','#597c5b','#d1cb8e'];
  for(let i=0;i<580;i++){
    const x=Math.floor(rng()*128),y=77+Math.floor(rng()*51),w=1+Math.floor(rng()*3);
    const color=blades[Math.floor(rng()*blades.length)];
    b.rect('grass.blades',color,x,y,w,1);
    if(y>110&&i%7===0)b.line('grass.blades',color,x,y,x-1,y-2);
  }
  const flowers=[['#a85e78','#e79bb0','#ffe1c0'],['#a36c46','#f4b75d','#ffda84'],['#8a6f9b','#bba0cd','#e4d3e5'],['#b7b7a1','#f2e4c5','#dfaf64']];
  for(let i=0;i<82;i++){
    const x=Math.floor(rng()*128),y=83+Math.floor(rng()*45),[dark,petal,core]=flowers[i%4];
    const h=y>109?3:1;
    b.rect('flowers.stems','#4e745a',x,y,1,h+1);
    b.rect('flowers.petals',dark,x-1,y,2,1);
    b.rect('flowers.petals',petal,x,y-1,1,1);
    if(y>102){b.rect('flowers.petals',petal,x+1,y,1,1);b.rect('flowers.centers',core,x,y,1,1);}
  }
}

function paintedOak(b) {
  b.oval('tree.shadow','#849453',29,92,69,10);
  b.oval('tree.shadow','#667e50',37,94,47,6);
  b.oval('tree.shadow','#546b49',49,95,25,4);
  b.poly('tree.trunk','#523f36',44,99,54,93,58,83,58,73,54,66,44,60,36,57,29,48,34,49,40,54,50,57,56,60,51,52,54,52,62,62,68,57,70,49,73,42,75,42,74,54,82,47,90,44,88,48,79,54,73,62,68,69,67,79,69,90,73,94,82,97,73,98,65,95,61,96,56,99);
  b.poly('tree.trunk.light','#896448',49,97,56,92,60,83,60,70,55,63,45,58,54,61,61,65,63,70,62,82,59,90,60,94);
  b.poly('tree.trunk.light','#a47a52',63,92,64,85,63,75,64,66,68,60,72,53,71,59,68,64,66,74,66,85,69,92,73,95);
  for(const [x,y,x2,y2,c] of [[54,94,58,89,'#bd9867'],[58,88,60,78,'#bd9867'],[66,91,66,86,'#c09a65'],[60,92,62,87,'#604c3c'],[64,80,62,76,'#6d5340'],[67,66,73,59,'#bb9263'],[44,57,51,60,'#af875f']]){
    b.line('tree.trunk.bark',c,x,y,x2,y2);
  }
  const rng=random(515);
  // Paint overlapping boughs from back to front. Each has a cool underside and a warm sunlit edge.
  const crowns=[[23,39,26,17],[31,26,30,26],[48,18,31,24],[61,18,29,24],[76,25,23,22],[84,35,23,22],[71,46,28,19],[52,48,26,18],[35,45,24,17],[22,42,23,16],[38,34,24,19],[55,30,26,20],[68,25,23,18],[48,22,21,17],[57,17,19,15]];
  for(const [x,y,w,h] of crowns){
    const p=leafPalette,shade=1+Math.floor(rng()*2);
    b.oval('tree.leaves.deep',p[0],x,y+2,w,h);
    b.oval('tree.leaves.shade',p[shade],x,y,w,h-2);
    b.oval('tree.leaves.mid',p[shade+1],x+2,y,w-3,h-5);
    b.oval('tree.leaves.light',p[shade+2],x+4,y,w-8,Math.max(4,h-9));
    for(let i=0;i<25;i++){
      const u=rng(),v=rng();
      if(((u-.5)/.48)**2+((v-.5)/.47)**2>1)continue;
      const xx=x+Math.floor(u*w),yy=y+Math.floor(v*h);
      const j=v<.43?4+Math.floor(rng()*4):1+Math.floor(rng()*4);
      b.rect('tree.leaves.texture',p[j],xx,yy,1+Math.floor(rng()*3),1);
      if(i%5===0)b.rect('tree.leaves.texture',p[Math.min(8,j+1)],xx+1,yy-1,1,1);
    }
  }
}

function paintedCat(b) {
  const sprite=brush();cat(sprite);
  for(const shape of sprite.shapes)b.shapes.push({...shape,coords:shape.coords.map(v=>v*2)});
  for(const [x,y,w,h] of [[35,47,5,1],[36,48,5,1],[64,46,5,1],[65,47,5,1],[49,64,4,1],[61,63,4,1],[50,70,3,2],[54,72,2,1],[68,80,4,2],[69,84,5,2],[70,88,4,1],[99,73,5,2],[96,81,5,2]]){
    b.rect('cat.stripes','#a76a44',x,y,w,h);
  }
  for(const [x,y] of [[39,50],[61,50]])b.rect('cat.eyes.glints','#fdf0c9',x,y,1,1);
  for(const [x,y] of [[46,59],[49,60],[57,60],[60,59]])b.rect('cat.muzzle.freckles','#ad7b64',x,y,1,1);
  for(const [x,y] of [[50,95],[53,95],[70,95],[74,95]])b.rect('cat.paws.toes','#b98666',x,y,1,2);
  b.line('cat.tail.highlight','#dd9863',103,70,102,77);
}

export function template(name,legacy=false) {
  if(legacy)return legacyTemplate(name);
  const b=brush();
  if(name==='blank')b.rect('background','#e9e7d3',0,0,128,128);
  else {
    landscape(b);
    if(name==='tree')paintedOak(b);
    if(name==='cat')paintedCat(b);
  }
  return b.shapes;
}

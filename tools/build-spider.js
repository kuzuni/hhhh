/* Build the spider-mech deliverables from the single source of truth
   (spider/spider.js) + the pinned THREE (tools/three.min.js):
     - spiderbot.html          : self-contained interactive showcase (artifact + GitHub Pages)
     - tools/spider-inspect.html: multi-angle critique montage -> PNG via headless Edge
   Run: node tools/build-spider.js
*/
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const THREEJS = fs.readFileSync(path.join(ROOT, 'tools', 'three.min.js'), 'utf8');
const SPIDER = fs.readFileSync(path.join(ROOT, 'spider', 'spider.js'), 'utf8');

/* ---- shared scene / lighting / trail, emitted as a JS string into both pages ---- */
const SHARED = `
const T = THREE;
/* radial-gradient backdrop as a CanvasTexture */
function backdropTexture(){
  const c=document.createElement('canvas'); c.width=c.height=512; const x=c.getContext('2d');
  const g=x.createRadialGradient(256,210,40, 256,256,360);
  g.addColorStop(0,'#241640'); g.addColorStop(0.45,'#140d24'); g.addColorStop(1,'#07050d');
  x.fillStyle=g; x.fillRect(0,0,512,512);
  const t=new T.CanvasTexture(c); return t;
}
function buildScene(){
  const scene=new T.Scene();
  scene.background=backdropTexture();
  scene.fog=new T.Fog(0x0a0812, 22, 46);

  // hangar floor
  const floorMat=new T.MeshStandardMaterial({color:0x140f1e, metalness:0.6, roughness:0.55});
  const floor=new T.Mesh(new T.CircleGeometry(26,64), floorMat);
  floor.rotation.x=-Math.PI/2; floor.position.y=0; floor.receiveShadow=true; scene.add(floor);
  const grid=new T.GridHelper(40,40, 0x3a2a6a, 0x1d1533); grid.position.y=0.02;
  grid.material.transparent=true; grid.material.opacity=0.5; scene.add(grid);

  // lights: cool key + purple fill + green rim + pink accent on the axe
  const hemi=new T.HemisphereLight(0x6a5cff, 0x0a0810, 0.42); scene.add(hemi);
  const key=new T.DirectionalLight(0xffffff, 1.85); key.position.set(-7,11,8);
  key.castShadow=true; key.shadow.mapSize.set(2048,2048);
  key.shadow.camera.near=1; key.shadow.camera.far=40;
  key.shadow.camera.left=-12; key.shadow.camera.right=12; key.shadow.camera.top=12; key.shadow.camera.bottom=-12;
  key.shadow.bias=-0.0004; scene.add(key);
  const fill=new T.DirectionalLight(0x8a4fff, 0.9); fill.position.set(9,5,4); scene.add(fill);
  const rim=new T.DirectionalLight(0x35ff9d, 1.2); rim.position.set(2,6,-10); scene.add(rim);
  const pink=new T.PointLight(0xff3fa8, 1.6, 14, 2); pink.position.set(2.5,3.2,2.5); scene.add(pink);
  scene.userData.pink=pink;

  const rig=SPIDER.build(T); scene.add(rig.root);
  rig.root.traverse(o=>{ if(o.isMesh){o.castShadow=true;} });
  return {scene, rig};
}

/* ---- pink energy trail: ribbon between the two edge empties over recent phases ---- */
function edgeWorld(rig, node){ const v=new T.Vector3(); node.getWorldPosition(v); return v; }
function buildTrailGeo(samples){
  // samples: [{top:Vec3, bot:Vec3}] oldest->newest
  const n=samples.length; if(n<2) return null;
  const pos=[], col=[];
  const base=new T.Color(0xff2e9e), hot=new T.Color(0xff86cf), DIM=0.6;
  for(let i=0;i<n-1;i++){
    const a=samples[i], b=samples[i+1];
    const ageA=i/(n-1), ageB=(i+1)/(n-1);      // 0 tail -> 1 head
    const fA=Math.pow(ageA,1.7)*DIM, fB=Math.pow(ageB,1.7)*DIM;
    const cA=base.clone().lerp(hot, ageA).multiplyScalar(fA);
    const cB=base.clone().lerp(hot, ageB).multiplyScalar(fB);
    // two triangles: aTop,aBot,bBot | aTop,bBot,bTop
    const T0=a.top,B0=a.bot,T1=b.top,B1=b.bot;
    pos.push(T0.x,T0.y,T0.z, B0.x,B0.y,B0.z, B1.x,B1.y,B1.z,
             T0.x,T0.y,T0.z, B1.x,B1.y,B1.z, T1.x,T1.y,T1.z);
    col.push(cA.r,cA.g,cA.b, cA.r,cA.g,cA.b, cB.r,cB.g,cB.b,
             cA.r,cA.g,cA.b, cB.r,cB.g,cB.b, cB.r,cB.g,cB.b);
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos,3));
  g.setAttribute('color', new T.Float32BufferAttribute(col,3));
  return g;
}
const trailMat=()=>new T.MeshBasicMaterial({vertexColors:true, blending:T.AdditiveBlending, transparent:true, depthWrite:false, side:T.DoubleSide});
/* sample the swing over a phase window ending at 'phase' and return trail samples */
function sampleTrail(rig, phase, span, steps){
  const out=[];
  for(let i=0;i<=steps;i++){
    const p=Math.max(0, phase - span + span*(i/steps));
    SPIDER.pose(rig, 0, {mode:'attack', phase:p});
    rig.root.updateMatrixWorld(true);
    out.push({top:edgeWorld(rig,rig.axeEdgeTop), bot:edgeWorld(rig,rig.axeEdgeBot)});
  }
  return out;
}
`;

/* ============================= MONTAGE (critique) ============================= */
const inspectBody = `
window.onerror=function(m,s,l,c,e){ document.title='ERR: '+m+' @'+l+':'+c; var d=document.getElementById('err'); if(d) d.textContent='ERR: '+m+' @'+l+':'+c+' | '+(e&&e.stack||''); };
try{
${SHARED}
const COLS=3, ROWS=2, CW=760, CH=620, PAD=6, LBL=30;
const W=COLS*CW+PAD*2, H=ROWS*(CH+LBL)+PAD*2;
const comp=document.getElementById('cv'); comp.width=W; comp.height=H;
const g=comp.getContext('2d'); g.fillStyle='#05040a'; g.fillRect(0,0,W,H);

const renderer=new T.WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
renderer.setSize(CW,CH); renderer.setPixelRatio(1);
renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.outputEncoding=T.sRGBEncoding; renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=1.0;

const {scene, rig}=buildScene();
const cam=new T.PerspectiveCamera(38, CW/CH, 0.1, 100);

const views=SPIDER.VIEWS;
let done=0;
function renderView(i){
  const v=views[i];
  // pose
  SPIDER.pose(rig, 0.7, {mode:v.mode, phase:v.phase});
  rig.root.updateMatrixWorld(true);
  // trail on attack frames
  let trail=null;
  if(v.mode==='attack'){
    const samples=sampleTrail(rig, v.phase, 0.16, 16);
    SPIDER.pose(rig, 0.7, {mode:v.mode, phase:v.phase});   // restore current pose
    rig.root.updateMatrixWorld(true);
    const geo=buildTrailGeo(samples);
    if(geo){ trail=new T.Mesh(geo, trailMat()); scene.add(trail); }
    scene.userData.pink.position.set(v.target[0]+1, v.target[1]+1, v.target[2]+2);
  } else {
    scene.userData.pink.position.set(2.5,3.2,2.5);
  }
  cam.position.set(v.pos[0],v.pos[1],v.pos[2]);
  cam.lookAt(v.target[0],v.target[1],v.target[2]);
  renderer.render(scene,cam);
  const col=i%COLS, row=Math.floor(i/COLS);
  const x=PAD+col*CW, y=PAD+row*(CH+LBL);
  g.drawImage(renderer.domElement, x, y, CW, CH);
  // label
  g.fillStyle='#0d0a16'; g.fillRect(x, y+CH, CW, LBL);
  g.fillStyle='#c9b8ff'; g.font='bold 18px Consolas,monospace';
  g.fillText((i+1)+'.  '+v.name+(v.mode==='attack'?'  [phase '+v.phase.toFixed(2)+']':''), x+10, y+CH+21);
  if(trail){ scene.remove(trail); trail.geometry.dispose(); trail.material.dispose(); }
}
for(let i=0;i<views.length;i++) renderView(i);

// footer banner
g.fillStyle='#e7c24a'; g.font='bold 20px Consolas,monospace';
g.fillText('SPIDER-MECH "ORB WEAVER" — Gundam-style spider unit  |  purple/green armour, pink energy axe + trail', PAD+8, H-10);

window.__done=true; document.title='RENDER_DONE';
}catch(e){ document.title='ERR: '+e.message; var d=document.getElementById('err'); if(d) d.textContent='ERR: '+e.message+' | '+e.stack; }
`;

const inspectHTML = `<!doctype html><html><head><meta charset="utf8"><style>
html,body{margin:0;background:#05040a;} canvas{display:block;} #err{position:fixed;top:0;left:0;color:#f66;font:14px monospace;white-space:pre-wrap;max-width:100%;z-index:9;}
</style></head><body>
<div id="err"></div>
<canvas id="cv"></canvas>
<script>${THREEJS}</script>
<script>${SPIDER}</script>
<script>${inspectBody}</script>
</body></html>`;

fs.writeFileSync(path.join(ROOT, 'tools', 'spider-inspect.html'), inspectHTML, 'utf8');

/* ============================= SHOWCASE (artifact + deploy) ============================= */
const showcaseBody = `
${SHARED}
const canvas=document.getElementById('gl');
const renderer=new T.WebGLRenderer({antialias:true, canvas});
renderer.setPixelRatio(Math.min(devicePixelRatio||1, 2));
renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.outputEncoding=T.sRGBEncoding; renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=1.0;

const {scene, rig}=buildScene();
const cam=new T.PerspectiveCamera(40, 1, 0.1, 200);

// minimal orbit control
let az=-0.62, pol=1.02, rad=15.5, tx=0, ty=2.75;
function applyCam(){
  const sp=Math.sin(pol), cp=Math.cos(pol);
  cam.position.set(tx+rad*sp*Math.sin(az), ty+rad*cp, rad*sp*Math.cos(az));
  cam.lookAt(tx,ty,0);
}
let drag=false, px=0, py=0;
canvas.addEventListener('pointerdown', e=>{drag=true; px=e.clientX; py=e.clientY; canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove', e=>{ if(!drag)return; az-=(e.clientX-px)*0.008; pol=Math.max(0.35,Math.min(1.5,pol-(e.clientY-py)*0.006)); px=e.clientX; py=e.clientY; });
canvas.addEventListener('pointerup', ()=>drag=false);
canvas.addEventListener('wheel', e=>{ rad=Math.max(7,Math.min(24, rad+Math.sign(e.deltaY)*0.9)); e.preventDefault(); }, {passive:false});

function resize(){
  const w=canvas.clientWidth, h=canvas.clientHeight;
  if(canvas.width!==w||canvas.height!==h){ renderer.setSize(w,h,false); cam.aspect=w/h; cam.updateProjectionMatrix(); }
}

// rolling trail history for live swing
let trailMesh=null; const history=[];
function updateTrail(active){
  if(!active){ history.length=0; if(trailMesh){scene.remove(trailMesh); trailMesh.geometry.dispose(); trailMesh=null;} return; }
  rig.root.updateMatrixWorld(true);
  history.push({top:edgeWorld(rig,rig.axeEdgeTop), bot:edgeWorld(rig,rig.axeEdgeBot)});
  while(history.length>18) history.shift();
  const geo=buildTrailGeo(history);
  if(trailMesh){scene.remove(trailMesh); trailMesh.geometry.dispose();}
  if(geo){ trailMesh=new T.Mesh(geo, trailMat()); scene.add(trailMesh); }
}

let auto=true; const btn=document.getElementById('spin'); if(btn) btn.onclick=()=>{auto=!auto; btn.textContent=auto?'⏸ orbit':'▶ orbit';};
let atkBtn=document.getElementById('atk'); let manualAtk=-1;
if(atkBtn) atkBtn.onclick=()=>{ manualAtk=0; };

const clock=new T.Clock();
function frame(){
  requestAnimationFrame(frame); resize();
  const dt=clock.getDelta(), t=clock.elapsedTime;
  if(auto && !drag) az+=dt*0.25;
  // attack cadence: swing every ~4.5s, or on demand
  let phase=-1;
  const cyc=(t%4.5);
  if(manualAtk>=0){ manualAtk+=dt; phase=manualAtk/1.5; if(phase>=1){manualAtk=-1; phase=-1;} }
  else if(cyc<1.5){ phase=cyc/1.5; }
  if(phase>=0){ SPIDER.pose(rig, t, {mode:'attack', phase}); updateTrail(phase>0.28 && phase<0.62); }
  else { SPIDER.pose(rig, t, {mode:'idle'}); updateTrail(false); }
  scene.userData.pink.position.set(2.5,3.0,2.6);
  applyCam(); renderer.render(scene,cam);
}
frame();
`;

const showcaseHTML = `<title>ORB WEAVER — Gundam Spider Mech</title>
<div id="stage">
<canvas id="gl"></canvas>
<div id="hud">
  <div id="title">거미로봇 · <b>ORB&nbsp;WEAVER</b></div>
  <div id="sub">Gundam-style spider unit — purple/green armour · pink energy axe</div>
  <div id="ctl"><button id="spin">⏸ orbit</button><button id="atk">⚔ axe strike</button></div>
  <div id="hint">drag to rotate · scroll to zoom</div>
</div>
</div>
<style>
#stage{position:fixed; inset:0; background:#07050d; overflow:hidden; font-family:'Segoe UI',system-ui,sans-serif;}
#gl{position:absolute; inset:0; width:100%; height:100%; display:block; touch-action:none;}
#hud{position:absolute; left:22px; top:20px; color:#e9e2ff; text-shadow:0 2px 12px #000; pointer-events:none;}
#title{font-size:26px; letter-spacing:.5px;} #title b{color:#c69bff;}
#sub{font-size:13px; opacity:.8; margin-top:3px; color:#9affc9;}
#ctl{margin-top:14px; pointer-events:auto;}
#ctl button{background:rgba(106,47,176,.35); border:1px solid #9a5fd6; color:#f0e9ff; padding:8px 14px; margin-right:8px; border-radius:8px; font-size:13px; cursor:pointer; backdrop-filter:blur(4px);}
#ctl button:hover{background:rgba(255,63,168,.35); border-color:#ff3fa8;}
#hint{position:absolute; left:0; bottom:-320px;}
#hint{margin-top:10px; font-size:11px; opacity:.5; position:static;}
</style>
<script>${THREEJS}</script>
<script>${SPIDER}</script>
<script>${showcaseBody}</script>`;

// body-only version for the Artifact tool (it supplies doctype/head/body)
fs.writeFileSync(path.join(ROOT, 'tools', 'artifact-spider.html'), showcaseHTML, 'utf8');
// full standalone page for GitHub / local viewing
const fullPage = `<!doctype html><html lang="ko"><head><meta charset="utf8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ORB WEAVER — Gundam-style Spider Mech</title>
<style>html,body{margin:0;height:100%;background:#07050d;}</style>
</head><body>
${showcaseHTML}
</body></html>`;
fs.writeFileSync(path.join(ROOT, 'spiderbot.html'), fullPage, 'utf8');

console.log('built: tools/spider-inspect.html ('+inspectHTML.length+' b), spiderbot.html ('+fullPage.length+' b), tools/artifact-spider.html');

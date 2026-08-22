/* Build a standalone Canvas2D forward-kinematics inspector for the Ark Knight
   mecha animation. Keeps index.html as the single source of truth: it extracts
   the RETARGET data + mechaPose() module verbatim, then wraps it in a montage
   renderer (walk cycle, pelvis-height / torso-angle curves, saber sequence).
   Run:  node tools/build-inspect.js   ->  tools/inspect.html                 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* --- slice out the animation module (RETARGET .. MECHA_ANIM IIFE close) --- */
const startTok = 'const RETARGET=';
const endTok = 'global.MECHA_ANIM=api;';
const s = html.indexOf(startTok);
if (s < 0) throw new Error('RETARGET marker not found');
const e0 = html.indexOf(endTok, s);
if (e0 < 0) throw new Error('MECHA_ANIM marker not found');
const closeIdx = html.indexOf(');', html.indexOf('})(', e0));
const animJS = html.slice(s, closeIdx + 2);

const out = `<!doctype html><html><head><meta charset="utf8"><style>
  html,body{margin:0;background:#0d0b12;}
  canvas{display:block;}
</style></head><body>
<canvas id="cv" width="1680" height="1500"></canvas>
<script>
/* ==== extracted verbatim from index.html ==== */
${animJS}
/* ==== end extracted ==== */

const MP = window.MECHA_ANIM.mechaPose;
const TAU = Math.PI*2;

/* ---- rig rest offsets (from buildMechaDef in index.html) ---- */
const JOINTS = {
  root:{parent:null, off:[0,2.42,0]},
  torso:{parent:'root', off:[0,0.34,0]},
  head:{parent:'torso', off:[0,1.16,0.08]},
  shoulderR:{parent:'torso', off:[0.68,0.62,0]},
  elbowR:{parent:'shoulderR', off:[0.16,-0.54,0.06]},
  handR:{parent:'elbowR', off:[0,-0.78,0]},
  shoulderL:{parent:'torso', off:[-0.68,0.62,0]},
  elbowL:{parent:'shoulderL', off:[-0.16,-0.54,0.06]},
  handL:{parent:'elbowL', off:[0,-0.78,0]},
  hipR:{parent:'root', off:[0.42,-0.12,0]},
  kneeR:{parent:'hipR', off:[0,-0.92,0]},
  ankleR:{parent:'kneeR', off:[0,-1.02,0.02]},
  toeR:{parent:'ankleR', off:[0,-0.20,0.57]},
  heelR:{parent:'ankleR', off:[0,-0.24,-0.28]},
  hipL:{parent:'root', off:[-0.42,-0.12,0]},
  kneeL:{parent:'hipL', off:[0,-0.92,0]},
  ankleL:{parent:'kneeL', off:[0,-1.02,0.02]},
  toeL:{parent:'ankleL', off:[0,-0.20,0.57]},
  heelL:{parent:'ankleL', off:[0,-0.24,-0.28]},
};
const ORDER = ['root','torso','head','shoulderR','elbowR','handR','shoulderL','elbowL','handL',
  'hipR','kneeR','ankleR','toeR','heelR','hipL','kneeL','ankleL','toeL','heelL'];

/* ---- mat4 helpers (column-major, THREE-compatible XYZ euler) ---- */
function idm(){return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];}
function mul(a,b){ // a*b
  const o=new Array(16);
  for(let c=0;c<4;c++)for(let r=0;r<4;r++){
    o[c*4+r]=a[0*4+r]*b[c*4+0]+a[1*4+r]*b[c*4+1]+a[2*4+r]*b[c*4+2]+a[3*4+r]*b[c*4+3];
  }
  return o;
}
function trans(x,y,z){const m=idm();m[12]=x;m[13]=y;m[14]=z;return m;}
function eulerXYZ(x,y,z){ // matches THREE.Matrix4.makeRotationFromEuler order 'XYZ'
  const a=Math.cos(x),b=Math.sin(x),c=Math.cos(y),d=Math.sin(y),e=Math.cos(z),f=Math.sin(z);
  const ae=a*e,af=a*f,be=b*e,bf=b*f;
  const m=idm();
  m[0]=c*e;        m[4]=-c*f;       m[8]=d;
  m[1]=af+be*d;    m[5]=ae-bf*d;    m[9]=-b*c;
  m[2]=bf-ae*d;    m[6]=be+af*d;    m[10]=a*c;
  return m;
}
function apply(m,p){ // transform point
  return [
    m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],
    m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],
    m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14],
  ];
}

/* compute world positions of every joint for a given pose */
function fk(pose){
  const J = pose.joints, R = pose.root;
  const world = {};
  const mats = {};
  for(const name of ORDER){
    const def = JOINTS[name];
    let local;
    if(name==='root'){
      local = mul(trans(R.x, R.y, 0), eulerXYZ(R.rx||0, 0, R.rz||0));
    } else {
      const rot = J[name] || [0,0,0];
      local = mul(trans(def.off[0],def.off[1],def.off[2]), eulerXYZ(rot[0],rot[1],rot[2]));
    }
    const pm = def.parent ? mats[def.parent] : idm();
    const wm = mul(pm, local);
    mats[name] = wm;
    world[name] = apply(wm, [0,0,0]);
  }
  return world;
}

/* ---- camera: yawed side view, project (x,y,z)->screen ---- */
const camYaw = -0.32;                 // slight 3/4 so L/R legs separate
const cy = Math.cos(camYaw), sy = Math.sin(camYaw);
function proj(p){ // returns [sx, sy] in model units (z-right, y-up), yawed
  const zr = p[2]*cy + p[0]*sy;       // depth-rotated horizontal
  return [zr, p[1]];
}

const cv = document.getElementById('cv');
const g = cv.getContext('2d');
g.fillStyle='#0d0b12'; g.fillRect(0,0,cv.width,cv.height);

const BONES = [
  ['root','torso'],['torso','head'],
  ['torso','shoulderR'],['shoulderR','elbowR'],['elbowR','handR'],
  ['torso','shoulderL'],['shoulderL','elbowL'],['elbowL','handL'],
  ['root','hipR'],['hipR','kneeR'],['kneeR','ankleR'],['ankleR','toeR'],['ankleR','heelR'],
  ['root','hipL'],['hipL','kneeL'],['kneeL','ankleL'],['ankleL','toeL'],['ankleL','heelL'],
];
function isRight(n){return /R$/.test(n);}
function boneColor(a,b){
  if(a==='root'&&b==='torso') return '#f0d68a';
  if(b==='head') return '#dfe6ee';
  if(isRight(a)||isRight(b)) return '#7fb2ff';   // right limbs blue
  return '#ff8f9c';                                // left limbs pink
}

/* draw one figure at cell (ox,oy) with given world->screen scale, groundY(screen) */
function drawFigure(world, ox, oy, scale, showBlade, bladeK){
  // find model->screen mapping so feet sit near groundline
  function S(name){ const p=proj(world[name]); return [ox + p[0]*scale, oy - p[1]*scale]; }
  // limbs
  for(const [a,b] of BONES){
    const pa=S(a), pb=S(b);
    g.strokeStyle=boneColor(a,b);
    g.lineWidth = (a==='root'&&b==='torso')?11: (b==='head'?9: 6);
    g.lineCap='round';
    g.beginPath(); g.moveTo(pa[0],pa[1]); g.lineTo(pb[0],pb[1]); g.stroke();
  }
  // pelvis marker
  const pr=S('root');
  g.fillStyle='#ffe9a8'; g.beginPath(); g.arc(pr[0],pr[1],5,0,TAU); g.fill();
  // head cap
  const hd=S('head'); g.fillStyle='#eef3f8'; g.beginPath(); g.arc(hd[0],hd[1],9,0,TAU); g.fill();
  // saber blade from right hand
  if(showBlade){
    const h=world.handR, el=world.elbowR;
    // blade continues along hand-from-elbow direction
    const dir=[h[0]-el[0],h[1]-el[1],h[2]-el[2]];
    const L=Math.hypot(dir[0],dir[1],dir[2])||1;
    const tip=[h[0]+dir[0]/L*1.7, h[1]+dir[1]/L*1.7, h[2]+dir[2]/L*1.7];
    const ph=proj(h), pt=proj(tip);
    const a=[ox+ph[0]*scale, oy-ph[1]*scale], t=[ox+pt[0]*scale, oy-pt[1]*scale];
    g.strokeStyle='rgba(120,240,255,0.35)'; g.lineWidth=10;
    g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(t[0],t[1]); g.stroke();
    g.strokeStyle='#bfffff'; g.lineWidth=3.5;
    g.beginPath(); g.moveTo(a[0],a[1]); g.lineTo(t[0],t[1]); g.stroke();
    return t; // blade tip screen pos (for arc trace)
  }
  return null;
}
function label(txt,x,y,col){ g.fillStyle=col||'#9aa4b2'; g.font='13px Consolas,monospace'; g.fillText(txt,x,y); }
function title(txt,x,y){ g.fillStyle='#e8c46a'; g.font='bold 16px Consolas,monospace'; g.fillText(txt,x,y); }

/* ============ PANEL A: walk cycle ============ */
title('WALK CYCLE (gait=0.55, walk regime)  — right leg blue, left pink, pelvis dot yellow', 24, 28);
const NW=10, cellW=158, baseX=40, groundYA=300, scaleA=64;
for(let i=0;i<NW;i++){
  const ph=(i/NW)*TAU;
  const pose=MP({ph, gait:0.55, state:'walk', slashK:-1, breath:0, headBob:0});
  const world=fk(pose);
  // ground line at model y=0.08
  const gscr = groundYA - (0.08)*scaleA*0; // we place feet by using pose root y directly
  const ox=baseX + i*cellW + cellW/2;
  // vertical placement: put model y=0 at groundYA
  const oy=groundYA;
  // ground tick
  g.strokeStyle='#26202c'; g.lineWidth=1; g.beginPath(); g.moveTo(ox-60,groundYA-0.08*scaleA); g.lineTo(ox+60,groundYA-0.08*scaleA); g.stroke();
  drawFigure(world, ox, oy, scaleA, false, 0);
  label('t='+(i/NW).toFixed(2), ox-24, groundYA+22);
}

/* ============ PANEL B: pelvis height + foot heights over cycle ============ */
const bx=40, bw=1600, by=360, bh=150;
title('PELVIS & FEET VERTICAL vs phase  (pelvis should PEAK over each stance/planted foot)', bx, by-8);
g.strokeStyle='#26202c'; g.strokeRect(bx,by,bw,bh);
const N2=128;
let rootYs=[], footR=[], footL=[];
for(let i=0;i<=N2;i++){
  const ph=(i/N2)*TAU;
  const pose=MP({ph, gait:0.55, state:'walk', slashK:-1, breath:0, headBob:0});
  const w=fk(pose);
  rootYs.push(pose.root.y);
  footR.push(Math.min(w.toeR[1], w.heelR[1]));
  footL.push(Math.min(w.toeL[1], w.heelL[1]));
}
function plot(arr,col,lw){
  const mn=Math.min(...arr), mx=Math.max(...arr), rng=(mx-mn)||1;
  g.strokeStyle=col; g.lineWidth=lw; g.beginPath();
  for(let i=0;i<arr.length;i++){
    const x=bx+ i/(arr.length-1)*bw;
    const y=by+bh-8 - (arr[i]-mn)/rng*(bh-16);
    i?g.lineTo(x,y):g.moveTo(x,y);
  }
  g.stroke();
}
// normalize all three on the same scale for phase comparison
(function(){
  const all=rootYs.concat(footR,footL);
  const mn=Math.min(...all), mx=Math.max(...all), rng=(mx-mn)||1;
  function pl(arr,col,lw){ g.strokeStyle=col; g.lineWidth=lw; g.beginPath();
    for(let i=0;i<arr.length;i++){ const x=bx+i/(arr.length-1)*bw; const y=by+bh-8-(arr[i]-mn)/rng*(bh-16); i?g.lineTo(x,y):g.moveTo(x,y);} g.stroke(); }
  pl(footR,'#3d5a8a',2); pl(footL,'#8a4a55',2); pl(rootYs,'#ffe9a8',3);
})();
label('pelvis(yellow)  R-foot(blue)  L-foot(pink)   pelvisΔ='+(Math.max(...rootYs)-Math.min(...rootYs)).toFixed(3)+'  (want ~0.06-0.12, two peaks/stride)', bx+8, by+bh+16, '#c9d3df');

/* ============ PANEL C: torso pitch over cycle (waist snap check) ============ */
const cx=40, cw=1600, cyy=560, ch=130;
title('TORSO/WAIST PITCH vs phase  (want smooth small oscillation, NO violent snap)', cx, cyy-8);
g.strokeStyle='#26202c'; g.strokeRect(cx,cyy,cw,ch);
let torso=[], maxJump=0, prev=null;
for(let i=0;i<=N2;i++){
  const ph=(i/N2)*TAU;
  const pose=MP({ph, gait:0.55, state:'walk', slashK:-1, breath:0, headBob:0});
  const t=pose.joints.torso[0];
  torso.push(t);
  if(prev!==null) maxJump=Math.max(maxJump, Math.abs(t-prev));
  prev=t;
}
(function(){
  const mn=Math.min(...torso), mx=Math.max(...torso), rng=(mx-mn)||1;
  g.strokeStyle='#8dff8a'; g.lineWidth=2.5; g.beginPath();
  for(let i=0;i<torso.length;i++){ const x=cx+i/(torso.length-1)*cw; const y=cyy+ch-8-(torso[i]-mn)/rng*(ch-16); i?g.lineTo(x,y):g.moveTo(x,y);} g.stroke();
  // zero line
  const zy=cyy+ch-8-(0-mn)/rng*(ch-16);
  g.strokeStyle='#443'; g.setLineDash([4,4]); g.beginPath(); g.moveTo(cx,zy); g.lineTo(cx+cw,zy); g.stroke(); g.setLineDash([]);
})();
const tRangeDeg=((Math.max(...torso)-Math.min(...torso))*180/Math.PI).toFixed(1);
label('range='+tRangeDeg+'°  maxStepJump='+(maxJump*180/Math.PI).toFixed(1)+'°/frame   (want range<12°, jump<4°)', cx+8, cyy+ch+16, '#c9d3df');

/* ============ PANEL D: saber slash sequence ============ */
const dy=770, groundYD=980, scaleD=58;
title('SABER SLASH (kesa-giri)  — frames across the strike, cyan = blade, faint = tip arc', 24, dy);
const SK=[0.02,0.09,0.16,0.22,0.26,0.29,0.32,0.36,0.44,0.55];
const SKlab=['coil','coil','raise','raise','STRIKE','STRIKE','strike','hold','settle','guard'];
const cellD=162; const baseXD=40;
let arcPts=[];
for(let i=0;i<SK.length;i++){
  const pose=MP({ph:0, gait:0.15, state:'slash', slashK:SK[i], breath:0, headBob:0});
  const world=fk(pose);
  const ox=baseXD + i*cellD + cellD/2;
  g.strokeStyle='#26202c'; g.lineWidth=1; g.beginPath(); g.moveTo(ox-60,groundYD-0.08*scaleD); g.lineTo(ox+60,groundYD-0.08*scaleD); g.stroke();
  const tip=drawFigure(world, ox, groundYD, scaleD, true, SK[i]);
  label(SKlab[i]+' '+SK[i].toFixed(2), ox-30, groundYD+22, SKlab[i].includes('STRIKE')?'#ff9a5a':'#9aa4b2');
}

/* ============ PANEL E: blade-tip speed profile (snap = uneven spacing) ============ */
const ex=40, ew=1600, ey=1050, eh=150;
title('BLADE-TIP ANGULAR SPEED vs slash-time  (snap = sharp fast STRIKE spike, slow settle)', ex, ey-8);
g.strokeStyle='#26202c'; g.strokeRect(ex,ey,ew,eh);
let tips=[], speeds=[];
const NS=120;
for(let i=0;i<=NS;i++){
  const k=i/NS*0.6;
  const pose=MP({ph:0, gait:0.15, state:'slash', slashK:k, breath:0, headBob:0});
  const w=fk(pose);
  const h=w.handR, el=w.elbowR;
  const dir=[h[0]-el[0],h[1]-el[1],h[2]-el[2]];
  const Ln=Math.hypot(dir[0],dir[1],dir[2])||1;
  tips.push([h[0]+dir[0]/Ln*1.7, h[1]+dir[1]/Ln*1.7, h[2]+dir[2]/Ln*1.7]);
}
for(let i=1;i<tips.length;i++){
  const a=tips[i-1], b=tips[i];
  speeds.push(Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]));
}
(function(){
  const mx=Math.max(...speeds)||1;
  g.strokeStyle='#ffb24a'; g.lineWidth=2.5; g.beginPath();
  for(let i=0;i<speeds.length;i++){ const x=ex+i/(speeds.length-1)*ew; const y=ey+eh-8-(speeds[i]/mx)*(eh-16); i?g.lineTo(x,y):g.moveTo(x,y);} g.stroke();
  // phase boundaries at k=0.26,0.36,0.46 (fraction of 0.6)
  [0.26,0.36,0.46].forEach(k=>{ const x=ex+(k/0.6)*ew; g.strokeStyle='#443'; g.setLineDash([3,3]); g.beginPath(); g.moveTo(x,ey); g.lineTo(x,ey+eh); g.stroke(); g.setLineDash([]); });
})();
const peakIdx=speeds.indexOf(Math.max(...speeds));
label('peak speed at k='+((peakIdx/speeds.length)*0.6).toFixed(3)+'  peak/mean='+(Math.max(...speeds)/(speeds.reduce((a,b)=>a+b,0)/speeds.length)).toFixed(1)+'x  (want >4x, peak in STRIKE 0.26-0.36)', ex+8, ey+eh+16, '#c9d3df');

/* signal render-complete */
window.__done=true;
document.title='RENDER_DONE';
</script></body></html>`;

fs.writeFileSync(path.join(__dirname, 'inspect.html'), out, 'utf8');
console.log('wrote tools/inspect.html ('+out.length+' bytes); anim module '+animJS.length+' bytes');

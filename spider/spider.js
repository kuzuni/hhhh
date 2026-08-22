/* =====================================================================
   SPIDER — "ORB WEAVER", a Gundam-style spider-mech with a pink energy axe.
   Single source of truth for model + rig + animation.
   window.SPIDER = { build(THREE), pose(rig,t,opts), VIEWS, PALETTE }.

   Colour language:  royal-PURPLE angular armour  +  lime-GREEN carapace,
   sensors & trim  +  hot-PINK energy war-axe with a swept trail.
   Everything is composed from THREE primitives with dark panel-line edge
   overlays so it reads like a paneled Gunpla model kit.
   ===================================================================== */
window.SPIDER = (function () {
  let T;                       // THREE, injected in build()
  const M = {};                // material cache

  /* ---------- palette ---------- */
  const PALETTE = {
    purple:    0x6a2fb0,   // primary armour
    purpleLt:  0x8a4fd0,   // highlight plates (kept below white to avoid blow-out)
    purpleDk:  0x37195e,   // shadow / secondary armour
    frame:     0x201d29,   // inner gunmetal frame
    frameLt:   0x494455,   // lighter frame / pistons
    green:     0x2fbf6e,   // painted green carapace / armour
    greenDk:   0x1c6f45,   // deep green shadow panels
    glow:      0x66ffa6,   // emissive sensors / vents / eyes
    gold:      0xd9b23f,   // sparse hero accent (V-fin, trim)
    steel:     0x8f96a4,   // bare axe steel
    pink:      0xff4fb2,   // axe energy edge
    pinkHot:   0xffc2e6,   // axe energy core hot spot
    line:      0x090810,   // panel line colour
  };

  function mkMats() {
    const std = (c, metal, rough, emis, ei) => new T.MeshStandardMaterial({
      color: c, metalness: metal, roughness: rough,
      emissive: emis || 0x000000, emissiveIntensity: ei || 0,
    });
    M.purple   = std(PALETTE.purple,   0.55, 0.42);
    M.purpleLt = std(PALETTE.purpleLt, 0.55, 0.36);
    M.purpleDk = std(PALETTE.purpleDk, 0.62, 0.48);
    M.frame    = std(PALETTE.frame,    0.90, 0.50);
    M.frameLt  = std(PALETTE.frameLt,  0.88, 0.44);
    // carapace: deep saturated green, low emissive so it doesn't wash to mint
    M.carapace = std(0x149648, 0.42, 0.52, 0x0a7a38, 0.10);
    M.green    = std(0x1aa554,          0.45, 0.44, 0x0c8a44, 0.10);
    M.greenDk  = std(PALETTE.greenDk,   0.55, 0.45);
    M.glow     = std(PALETTE.glow,      0.30, 0.30, PALETTE.glow, 1.05);
    M.gold     = std(PALETTE.gold,      0.85, 0.32, PALETTE.gold, 0.10);
    M.steel    = std(PALETTE.steel,     0.95, 0.30);
    M.pink     = std(PALETTE.pink,      0.28, 0.32, PALETTE.pink, 1.0);
    M.pinkCore = std(0xff8fd0,          0.12, 0.28, 0xff8fd0, 1.15);
    M.line     = new T.LineBasicMaterial({ color: PALETTE.line, transparent: true, opacity: 0.7 });
    M.trimGrn  = new T.LineBasicMaterial({ color: PALETTE.glow, transparent: true, opacity: 0.5 });
  }

  /* ---------- primitive helpers ---------- */
  function grp(x, y, z) { const g = new T.Group(); g.position.set(x || 0, y || 0, z || 0); return g; }
  function place(o, x, y, z, rx, ry, rz) {
    o.position.set(x || 0, y || 0, z || 0);
    o.rotation.set(rx || 0, ry || 0, rz || 0);
    return o;
  }
  function cyl(rt, rb, h, mat, seg) { return new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 14), mat); }
  function sphere(r, mat, s) { return new T.Mesh(new T.SphereGeometry(r, s || 18, s || 14), mat); }
  function cone(r, h, mat, seg) { return new T.Mesh(new T.ConeGeometry(r, h, seg || 8), mat); }

  /* armour piece = box + dark panel-line edges (optional green trim). Returns a Group. */
  function armor(w, h, d, mat, trim) {
    const g = new T.Group();
    const geo = new T.BoxGeometry(w, h, d);
    const mesh = new T.Mesh(geo, mat);
    g.add(mesh);
    g.add(new T.LineSegments(new T.EdgesGeometry(geo, 25), trim ? M.trimGrn : M.line));
    g.userData.mesh = mesh;
    return g;
  }
  /* beveled plate: main plate + thinner raised cap = fake chamfer */
  function panel(w, h, d, mat, capMat) {
    const g = armor(w, h, d, mat);
    const cap = armor(w * 0.8, h * 0.3, d * 0.8, capMat || mat);
    place(cap, 0, h * 0.5, 0);
    g.add(cap);
    return g;
  }
  /* faceted armour dome (spider carapace) from a low-poly sphere + facet lines */
  function dome(r, mat, detail) {
    const g = new T.Group();
    const geo = new T.IcosahedronGeometry(r, detail == null ? 1 : detail);
    g.add(new T.Mesh(geo, mat));
    g.add(new T.LineSegments(new T.EdgesGeometry(geo, 18), M.line));
    return g;
  }
  /* emissive lozenge (vent/sensor) with a faint pink/green additive halo */
  function lamp(w, h, mat, haloColor, haloOp) {
    const g = new T.Group();
    g.add(new T.Mesh(new T.BoxGeometry(w, h, 0.05), mat));
    const halo = new T.Mesh(new T.PlaneGeometry(w * 1.9, h * 1.9),
      new T.MeshBasicMaterial({ color: haloColor || PALETTE.glow, transparent: true, opacity: haloOp || 0.16, blending: T.AdditiveBlending, depthWrite: false }));
    place(halo, 0, 0, -0.02);
    g.add(halo);
    return g;
  }
  function ductVents(count, w, h, mat) {   // a row of angled glowing slats
    const g = new T.Group();
    for (let i = 0; i < count; i++) {
      const s = armor(w, h * 0.7, 0.04, mat);
      place(s, 0, (i - (count - 1) / 2) * h, 0, -0.35, 0, 0);
      g.add(s);
    }
    return g;
  }
  function thruster(r, h) {
    const g = new T.Group();
    g.add(cyl(r, r * 0.55, h, M.frame, 16));
    const inner = cyl(r * 0.7, r * 0.4, h * 0.5, M.glow, 16);
    place(inner, 0, h * 0.18, 0);
    g.add(inner);
    const ring = new T.Mesh(new T.TorusGeometry(r, r * 0.14, 8, 18), M.gold);
    place(ring, 0, -h * 0.5, 0, Math.PI / 2, 0, 0);
    g.add(ring);
    return g;
  }

  /* =================================================================
     HEAD — clean V-fin, green twin-eye visor, chin vent, side intakes.
     ================================================================= */
  function buildHead() {
    const head = grp(0, 0, 0);

    const skull = armor(0.5, 0.44, 0.48, M.frame);
    head.add(skull);
    // helmet crown (purple) with chamfer cap
    const crown = panel(0.62, 0.34, 0.46, M.purple, M.purpleLt);
    place(crown, 0, 0.14, 0.0);
    head.add(crown);
    // cheek guards
    for (const s of [-1, 1]) {
      const cheek = armor(0.12, 0.3, 0.34, M.purpleDk);
      place(cheek, s * 0.31, -0.02, 0.06);
      head.add(cheek);
    }
    // dark visor band + green twin eyes
    const visor = armor(0.44, 0.16, 0.1, M.frame);
    place(visor, 0, 0.02, 0.24);
    head.add(visor);
    for (const s of [-1, 1]) {
      const eye = lamp(0.13, 0.075, M.glow, PALETTE.glow, 0.28);
      place(eye, s * 0.12, 0.03, 0.305, 0, 0, -s * 0.14);
      head.add(eye);
    }
    // chin vent (gold slats)
    const chin = armor(0.28, 0.13, 0.12, M.frameLt);
    place(chin, 0, -0.16, 0.22);
    head.add(chin);
    for (let i = -1; i <= 1; i++) {
      const slat = armor(0.055, 0.1, 0.02, M.gold);
      place(slat, i * 0.085, -0.16, 0.29);
      head.add(slat);
    }
    // side intakes
    for (const s of [-1, 1]) {
      const ear = panel(0.09, 0.22, 0.24, M.purpleDk);
      place(ear, s * 0.33, 0.0, -0.02);
      head.add(ear);
      const earv = lamp(0.05, 0.14, M.glow);
      place(earv, s * 0.385, 0.0, 0.02, 0, s * 1.3, 0);
      head.add(earv);
    }
    // forehead sensor jewel (green)
    const jewel = new T.Mesh(new T.OctahedronGeometry(0.075), M.glow);
    place(jewel, 0, 0.24, 0.19);
    head.add(jewel);
    // V-FIN — the icon: gold base + two tapered white-gold blades in a clean V
    const finBase = armor(0.18, 0.07, 0.1, M.gold);
    place(finBase, 0, 0.28, 0.12);
    head.add(finBase);
    for (const s of [-1, 1]) {
      const bg = new T.BoxGeometry(0.5, 0.055, 0.1);
      bg.translate(0.25, 0, 0);                 // pivot at inner end
      const blade = new T.Mesh(bg, M.gold);
      const fin = grp(s * 0.04, 0.3, 0.12);
      fin.add(blade);
      fin.add(new T.LineSegments(new T.EdgesGeometry(bg, 20), M.line));
      place(fin, s * 0.04, 0.3, 0.12, 0, 0, s * 0.62 + Math.PI * 0 ); // splay up-out
      fin.rotation.z = s * 0.62;
      head.add(fin);
    }
    return head;
  }

  /* =================================================================
     BODY / THORAX — sloped chest glacis, green faceted carapace (spider
     abdomen), ducted green intakes + reactor, collar, head, backpack.
     ================================================================= */
  function buildBody(rig) {
    const body = grp(0, 0, 0);

    // lower chassis (frame belly)
    const belly = armor(1.5, 0.5, 2.1, M.frame);
    place(belly, 0, -0.62, -0.05);
    body.add(belly);
    // main hull block (purple), slightly tapered by a chamfer cap
    const hull = panel(1.8, 0.85, 2.3, M.purple, M.purpleLt);
    place(hull, 0, -0.1, -0.05);
    body.add(hull);
    // side skirt armour (angled)
    for (const s of [-1, 1]) {
      const skirt = panel(0.34, 0.62, 1.8, M.purpleDk);
      place(skirt, s * 0.95, -0.28, -0.05, 0, 0, s * 0.22);
      body.add(skirt);
    }

    // GREEN faceted carapace (spider abdomen) over the top-rear
    const carapace = dome(1.12, M.carapace, 1);
    carapace.scale.set(1.12, 0.6, 1.3);
    place(carapace, 0, 0.34, -0.5);
    body.add(carapace);
    for (let i = 0; i < 3; i++) {                 // spine ridge
      const seg = armor(0.24, 0.12, 0.22, M.greenDk, true);
      place(seg, 0, 0.78 - i * 0.03, -0.2 - i * 0.4);
      body.add(seg);
    }
    for (const s of [-1, 1]) {                     // dorsal green vents
      const gv = lamp(0.3, 0.12, M.glow, PALETTE.glow, 0.16);
      place(gv, s * 0.5, 0.5, -0.68, -0.7, 0, 0);
      body.add(gv);
    }
    const dorsal = sphere(0.11, M.glow, 16);
    place(dorsal, 0, 0.82, -0.32);
    body.add(dorsal);

    /* ---- GUNDAM TORSO TOWER rising from the front of the chassis ---- */
    const tower = grp(0, 0, 0);
    // core torso block
    const torso = panel(0.98, 1.0, 0.86, M.purple, M.purpleLt);
    place(torso, 0, 0.62, 0.72);
    tower.add(torso);
    // sloped chest glacis
    const glacis = panel(1.02, 0.62, 0.3, M.purpleLt, M.purple);
    place(glacis, 0, 0.62, 1.16, 0.45, 0, 0);
    tower.add(glacis);
    // ducted green intakes flanking the reactor
    for (const s of [-1, 1]) {
      const cowl = armor(0.34, 0.46, 0.16, M.frameLt);
      place(cowl, s * 0.34, 0.66, 1.16, 0.2, 0, 0);
      tower.add(cowl);
      const v = ductVents(3, 0.24, 0.12, M.glow);
      place(v, s * 0.34, 0.66, 1.25, 0.2, 0, 0);
      tower.add(v);
    }
    // reactor core (green gem + gold ring) at solar plexus
    const core = new T.Mesh(new T.IcosahedronGeometry(0.16, 0), M.glow);
    place(core, 0, 0.42, 1.18);
    tower.add(core);
    const ring = new T.Mesh(new T.TorusGeometry(0.22, 0.045, 8, 22), M.gold);
    place(ring, 0, 0.42, 1.14);
    tower.add(ring);
    // waist block joining tower to chassis
    const waist = armor(0.7, 0.4, 0.6, M.frame);
    place(waist, 0, 0.12, 0.78);
    tower.add(waist);
    // collar guards
    for (const s of [-1, 1]) {
      const col = armor(0.26, 0.3, 0.32, M.purpleDk);
      place(col, s * 0.42, 1.12, 0.78, 0, 0, -s * 0.28);
      tower.add(col);
    }
    // neck + head, raised high
    const neck = cyl(0.14, 0.18, 0.26, M.frameLt, 12);
    place(neck, 0, 1.24, 0.74);
    tower.add(neck);
    const headPivot = grp(0, 1.44, 0.76);
    headPivot.add(buildHead());
    tower.add(headPivot);
    rig.head = headPivot;
    body.add(tower);
    rig.tower = tower;

    // BACKPACK: angular block + vernier thrusters + winglet binders + tail sensor
    const pack = panel(1.1, 0.6, 0.5, M.purpleDk);
    place(pack, 0, 0.28, -1.35);
    body.add(pack);
    for (const s of [-1, 1]) {
      const th = thruster(0.19, 0.5);
      place(th, s * 0.32, -0.02, -1.62, Math.PI * 0.5 + 0.55, 0, 0);
      body.add(th);
      const wing = panel(0.14, 0.44, 0.9, M.purple, M.green);
      place(wing, s * 0.78, 0.34, -1.15, 0.12, 0, s * 0.28);
      body.add(wing);
    }
    const mast = grp(0, 0.7, -1.55);
    const stalk = cyl(0.035, 0.055, 0.7, M.frameLt, 8);
    place(stalk, 0, 0.32, 0, -0.5, 0, 0);
    mast.add(stalk);
    const meye = sphere(0.09, M.glow, 16);
    place(meye, 0, 0.62, -0.38);
    mast.add(meye);
    body.add(mast);
    rig.tail = mast;

    return body;
  }

  /* =================================================================
     LEG — radial spider leg (coxa -> femur up/out -> knee -> tibia
     down/out -> clawed foot).  Chunky segmented armour + knee piston.
     ================================================================= */
  function buildLeg(rig, side, slot) {
    const mountZ = [0.9, 0.02, -0.9][slot];
    const mountX = side * 0.9;
    const splay  = [0.64, 0.0, -0.62][slot];
    const hip = grp(mountX, -0.2, mountZ);
    hip.rotation.y = side * (Math.PI * 0.5) + side * splay;

    // coxa housing
    const coxa = armor(0.4, 0.42, 0.46, M.purpleDk);
    place(coxa, 0.18, 0, 0);
    hip.add(coxa);
    const coxaCap = sphere(0.22, M.frame, 14);
    place(coxaCap, 0.36, 0, 0);
    hip.add(coxaCap);

    // FEMUR — pivots up/out
    const femurPiv = grp(0.38, 0, 0);
    femurPiv.rotation.z = 0.9;
    const Lf = 1.2;
    const femur = armor(Lf, 0.36, 0.4, M.purple);
    place(femur, Lf * 0.5, 0, 0);
    femurPiv.add(femur);
    const fRidge = panel(Lf * 0.78, 0.14, 0.44, M.purpleLt);
    place(fRidge, Lf * 0.5, 0.22, 0);
    femurPiv.add(fRidge);
    const fTrim = armor(Lf * 0.72, 0.07, 0.42, M.green, true);
    place(fTrim, Lf * 0.5, 0, 0.22);
    femurPiv.add(fTrim);
    hip.add(femurPiv);

    // KNEE + piston
    const kneePiv = grp(Lf, 0, 0);
    kneePiv.add(sphere(0.24, M.frameLt, 14));
    const piston = cyl(0.05, 0.05, 0.55, M.steel, 10);
    place(piston, -0.22, 0.28, 0, 0, 0, 1.2);
    kneePiv.add(piston);
    kneePiv.rotation.z = -2.1;

    // TIBIA — tapers to a claw
    const Lt = 1.4;
    const tibia = armor(Lt, 0.26, 0.3, M.purpleDk);
    place(tibia, Lt * 0.5, 0, 0);
    kneePiv.add(tibia);
    const tShin = armor(Lt * 0.6, 0.18, 0.34, M.frame);
    place(tShin, Lt * 0.46, -0.02, 0);
    kneePiv.add(tShin);
    const tLamp = lamp(0.14, 0.1, M.glow);
    place(tLamp, Lt * 0.32, 0.08, 0.18);
    kneePiv.add(tLamp);

    // FOOT — three-point claw
    const foot = grp(Lt, 0, 0);
    foot.add(sphere(0.14, M.frameLt, 12));
    for (let c = 0; c < 3; c++) {
      const cl = grp(0.02, 0, 0);
      const claw = cone(0.08, 0.46, M.steel, 8);
      place(claw, 0.2, 0, 0, 0, 0, -Math.PI * 0.5 + 0.32);
      cl.add(claw);
      place(cl, 0.02, 0, (c - 1) * 0.16, 0.95, (c - 1) * 0.9, 0);
      foot.add(cl);
    }
    kneePiv.add(foot);
    femurPiv.add(kneePiv);

    rig.legs.push({ hip, femurPiv, kneePiv, foot, side, slot,
      rest: { femur: femurPiv.rotation.z, knee: kneePiv.rotation.z } });
    return hip;
  }

  /* =================================================================
     ARM — front manipulator gripping the axe (two-handed).
     ================================================================= */
  function buildArm(rig, side) {
    // shoulders mounted on the sides of the raised torso tower
    const shoulder = grp(side * 0.74, 0.82, 0.82);
    shoulder.rotation.y = side * -0.12;

    const pauldron = panel(0.56, 0.54, 0.56, M.purple, M.green);
    place(pauldron, side * 0.2, 0.16, 0);
    shoulder.add(pauldron);
    // green pauldron trim block
    const ptrim = armor(0.5, 0.12, 0.5, M.green, true);
    place(ptrim, side * 0.2, 0.34, 0);
    shoulder.add(ptrim);
    const spike = cone(0.12, 0.34, M.gold, 6);
    place(spike, side * 0.34, 0.46, 0, 0, 0, side * -0.4);
    shoulder.add(spike);

    const upperPiv = grp(side * 0.08, -0.1, 0);
    const upper = armor(0.28, 0.6, 0.3, M.frame);
    place(upper, 0, -0.3, 0);
    upperPiv.add(upper);
    const upTrim = armor(0.3, 0.12, 0.32, M.green, true);
    place(upTrim, 0, -0.2, 0);
    upperPiv.add(upTrim);
    shoulder.add(upperPiv);

    const elbowPiv = grp(0, -0.6, 0);
    elbowPiv.add(sphere(0.16, M.frameLt, 12));
    const forearm = panel(0.32, 0.58, 0.34, M.purpleLt);
    place(forearm, 0, -0.32, 0.02);
    elbowPiv.add(forearm);
    upperPiv.add(elbowPiv);

    const handPiv = grp(0, -0.62, 0.05);
    handPiv.add(armor(0.22, 0.2, 0.26, M.frame));
    for (let f = 0; f < 3; f++) {
      const fing = armor(0.06, 0.22, 0.07, M.frameLt);
      place(fing, (f - 1) * 0.07, -0.16, 0.09, 0.6, 0, 0);
      handPiv.add(fing);
    }
    const thumb = armor(0.06, 0.16, 0.07, M.frameLt);
    place(thumb, side * 0.12, -0.08, 0.06, 0.4, 0, side * -0.7);
    handPiv.add(thumb);
    elbowPiv.add(handPiv);

    const arm = { shoulder, upperPiv, elbowPiv, handPiv, side };
    rig.arms.push(arm);
    if (side > 0) rig.armR = arm; else rig.armL = arm;
    return shoulder;
  }

  /* =================================================================
     AXE — mechanical war-axe, hot-pink crescent energy bit.  Parented to
     the right hand.  Exposes edgeTop/edgeBot empties for the trail.
     ================================================================= */
  function buildAxe(rig) {
    const axe = grp(0, 0, 0);            // origin = grip point in the hand

    const haft = cyl(0.05, 0.055, 2.1, M.frame, 12);
    axe.add(haft);
    const grip = cyl(0.068, 0.068, 0.55, M.purpleDk, 12);
    place(grip, 0, -0.15, 0);
    axe.add(grip);
    const pommel = new T.Mesh(new T.OctahedronGeometry(0.13), M.frameLt);
    place(pommel, 0, -1.0, 0);
    axe.add(pommel);
    const pomGlow = sphere(0.055, M.glow, 12);
    place(pomGlow, 0, -1.0, 0);
    axe.add(pomGlow);

    // head hub near top of haft
    const headY = 0.86;
    const hub = armor(0.26, 0.4, 0.22, M.steel);
    place(hub, 0, headY, 0);
    axe.add(hub);
    const hubGem = sphere(0.08, M.glow, 12);
    place(hubGem, 0, headY, 0.12);
    axe.add(hubGem);

    // steel bit backing (dark, so the pink edge reads AS an edge)
    const backShape = new T.Shape();
    backShape.moveTo(0, -0.34); backShape.lineTo(0.34, -0.4);
    backShape.quadraticCurveTo(0.5, 0, 0.34, 0.4); backShape.lineTo(0, 0.34);
    backShape.lineTo(0, -0.34);
    const backGeo = new T.ExtrudeGeometry(backShape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
    backGeo.translate(0.12, 0, -0.06);
    const bitBack = new T.Mesh(backGeo, M.steel);
    place(bitBack, 0, headY, 0);
    axe.add(bitBack);
    axe.add(place(new T.LineSegments(new T.EdgesGeometry(backGeo, 22), M.line), 0, headY, 0));

    // PINK ENERGY crescent — a thin flared blade that reads as a hot edge
    const edgeShape = new T.Shape();
    edgeShape.moveTo(0.28, -0.42);
    edgeShape.quadraticCurveTo(0.86, -0.2, 0.9, 0.0);     // outer cutting curve
    edgeShape.quadraticCurveTo(0.86, 0.2, 0.28, 0.42);
    edgeShape.quadraticCurveTo(0.5, 0.0, 0.28, -0.42);    // inner curve back to start
    const edgeGeo = new T.ExtrudeGeometry(edgeShape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.02, bevelSegments: 1 });
    edgeGeo.translate(0.06, 0, -0.025);
    const energy = new T.Mesh(edgeGeo, M.pink);
    place(energy, 0, headY, 0);
    axe.add(energy);
    // thin hot core line along the very edge
    const coreShape = new T.Shape();
    coreShape.moveTo(0.5, -0.34);
    coreShape.quadraticCurveTo(0.9, -0.16, 0.93, 0.0);
    coreShape.quadraticCurveTo(0.9, 0.16, 0.5, 0.34);
    coreShape.quadraticCurveTo(0.72, 0.0, 0.5, -0.34);
    const coreGeo = new T.ExtrudeGeometry(coreShape, { depth: 0.055, bevelEnabled: false });
    coreGeo.translate(0.05, 0, -0.028);
    const energyCore = new T.Mesh(coreGeo, M.pinkCore);
    place(energyCore, 0, headY, 0);
    axe.add(energyCore);
    // soft additive halo (kept subtle so it stays pink, not white)
    const glowPl = new T.Mesh(new T.PlaneGeometry(1.5, 1.5),
      new T.MeshBasicMaterial({ color: PALETTE.pink, transparent: true, opacity: 0.14, blending: T.AdditiveBlending, depthWrite: false }));
    place(glowPl, 0.5, headY, -0.09);
    axe.add(glowPl);

    // back spike
    const spike = cone(0.09, 0.5, M.steel, 6);
    place(spike, -0.28, headY, 0, 0, 0, Math.PI * 0.5);
    axe.add(spike);

    // trail-sample empties at the two horns of the cutting edge (world-tracked)
    rig.axeEdgeTop = place(grp(), 0.86, headY + 0.42, 0);  axe.add(rig.axeEdgeTop);
    rig.axeEdgeBot = place(grp(), 0.86, headY - 0.42, 0);  axe.add(rig.axeEdgeBot);
    rig.axe = axe;

    // seat the grip in the right hand, blade pointing outward
    axe.position.set(0, -0.18, 0.16);
    axe.rotation.set(-0.15, 0, 0.1);
    return axe;
  }

  /* =================================================================
     BUILD
     ================================================================= */
  function build(THREE) {
    T = THREE;
    mkMats();
    const rig = { legs: [], arms: [] };
    const root = grp(0, 0, 0);

    const body = buildBody(rig);
    root.add(body);
    rig.body = body;

    for (const side of [-1, 1])
      for (const slot of [0, 1, 2])
        root.add(buildLeg(rig, side, slot));

    root.add(buildArm(rig, -1));
    root.add(buildArm(rig, 1));

    rig.armR.handPiv.add(buildAxe(rig));

    rig.root = root;
    root.position.y = 2.4;      // feet rest near y=0 (tuned by render)
    return rig;
  }

  /* =================================================================
     POSE / ANIMATE   opts = { mode:'idle'|'attack', phase:0..1 }
     ================================================================= */
  const easeOut = k => 1 - Math.pow(1 - k, 3);
  const easeIn = k => k * k * k;
  const clamp01 = k => Math.max(0, Math.min(1, k));

  // hero "ready" guard: axe raised up-right, two-handed
  function setReadyArms(rig) {
    const R = rig.armR, L = rig.armL;
    if (R) { R.shoulder.rotation.set(-1.15, 0, -0.15); R.upperPiv.rotation.set(-0.2, 0, -0.1); R.elbowPiv.rotation.set(-0.95, 0, 0); }
    if (L) { L.shoulder.rotation.set(-0.85, 0.3, 0.2); L.upperPiv.rotation.set(-0.35, 0, 0.25); L.elbowPiv.rotation.set(-1.25, 0, 0); }
  }

  function pose(rig, t, opts) {
    opts = opts || {};
    const mode = opts.mode || 'idle';

    rig.root.position.y = 2.4 + Math.sin(t * 1.6) * 0.03;
    if (rig.head) { rig.head.rotation.x = Math.sin(t * 0.9) * 0.03; rig.head.rotation.y = Math.sin(t * 0.6) * 0.05; }
    if (rig.tail) rig.tail.rotation.x = Math.sin(t * 1.1) * 0.06;
    rig.body.rotation.x = 0;

    for (const lg of rig.legs) {
      const ph = t * 1.4 + lg.slot * 0.7 + (lg.side > 0 ? Math.PI : 0);
      lg.femurPiv.rotation.z = lg.rest.femur + Math.sin(ph) * 0.04;
      lg.kneePiv.rotation.z = lg.rest.knee + Math.cos(ph) * 0.04;
    }

    setReadyArms(rig);
    if (mode === 'idle') return;

    /* ---- attack: two-handed overhead diagonal chop ---- */
    const p = clamp01(opts.phase != null ? opts.phase : (t % 1.6) / 1.6);
    const R = rig.armR, L = rig.armL;
    let sh, el, torso, legCoil;
    if (p < 0.35) {
      const k = easeOut(p / 0.35);
      sh = -1.15 - k * 1.5; el = -0.95 - k * 0.7; torso = -k * 0.22; legCoil = k;
    } else if (p < 0.55) {
      const k = easeIn((p - 0.35) / 0.20);
      sh = -2.65 + k * 3.7; el = -1.65 + k * 1.5; torso = -0.22 + k * 0.55; legCoil = 1 - k * 0.6;
    } else if (p < 0.66) {
      sh = 1.05; el = -0.15; torso = 0.33; legCoil = 0.4;
    } else {
      const k = easeOut((p - 0.66) / 0.34);
      sh = 1.05 - k * 2.2; el = -0.15 - k * 0.8; torso = 0.33 - k * 0.33; legCoil = 0.4 * (1 - k);
    }
    if (R) { R.shoulder.rotation.set(sh, 0, -0.12); R.elbowPiv.rotation.set(el, 0, 0); }
    if (L) { L.shoulder.rotation.set(sh + 0.15, 0.3, 0.2); L.elbowPiv.rotation.set(el - 0.2, 0, 0); }
    rig.body.rotation.x = torso;
    if (rig.head) rig.head.rotation.x = -torso * 0.4;
    for (const lg of rig.legs) {
      if (lg.slot === 0) { lg.femurPiv.rotation.z = lg.rest.femur - legCoil * 0.25; lg.kneePiv.rotation.z = lg.rest.knee + legCoil * 0.2; }
      if (lg.slot === 2) { lg.femurPiv.rotation.z = lg.rest.femur + legCoil * 0.15; }
    }
  }

  /* =================================================================
     VIEWS — camera setups for the critique montage.
     ================================================================= */
  const VIEWS = [
    { name: '3/4 HERO',   pos: [7.6, 5.6, 9.2],  target: [0, 2.7, 0.2], mode: 'idle',   phase: 0 },
    { name: 'FRONT',      pos: [0, 4.1, 11.2],   target: [0, 2.8, 0],   mode: 'idle',   phase: 0 },
    { name: 'SIDE',       pos: [11.6, 4.1, 0.3], target: [0, 2.5, 0],   mode: 'idle',   phase: 0 },
    { name: 'TOP (legs)', pos: [0.1, 14.5, 0.4], target: [0, 1.6, 0],   mode: 'idle',   phase: 0 },
    { name: 'ATK windup', pos: [8.2, 5.8, 8.6],  target: [0.4, 3.7, 0.4], mode: 'attack', phase: 0.30 },
    { name: 'ATK strike', pos: [8.2, 4.7, 8.6],  target: [0.8, 2.9, 0.8], mode: 'attack', phase: 0.48 },
  ];

  return { build, pose, VIEWS, PALETTE };
})();

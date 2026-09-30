// Procedural articulated character models: Arjun (human) + 10 original aliens.
import * as THREE from 'three';
import * as T from './textures.js';

const V3 = THREE.Vector3;
const std = (color, rough = 0.6, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

function mesh(geo, mat, parent, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  parent.add(m);
  return m;
}
const G = {
  sph: new THREE.SphereGeometry(0.5, 20, 14),
  sphLow: new THREE.IcosahedronGeometry(0.5, 1),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(0.5, 1, 12),
  cone4: new THREE.ConeGeometry(0.5, 1, 4),
  oct: new THREE.OctahedronGeometry(0.5, 0),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
  torus: new THREE.TorusGeometry(0.5, 0.12, 10, 24),
  capsule: new THREE.CapsuleGeometry(0.5, 1, 6, 14),
  capsuleFacet: new THREE.CapsuleGeometry(0.5, 1, 1, 6),
};

// limb hanging along -Y from its pivot
function limb(parent, len, r, mat, geoKind = 'capsule') {
  let m;
  if (geoKind === 'rock') {
    m = mesh(G.sphLow, mat, parent, 0, -len / 2, 0, r * 2.2, len * 1.05, r * 2.2);
  } else {
    const geo = geoKind === 'facet' ? G.capsuleFacet : G.capsule;
    // capsule of radius .5 & length 1 -> total height 2
    m = mesh(geo, mat, parent, 0, -len / 2, 0, r * 2, len / 2, r * 2);
  }
  return m;
}

export function buildHumanoid(o) {
  const c = {
    legU: 0.44, legL: 0.44, legR: 0.075, footH: 0.07, torsoH: 0.56, torsoW: 0.36, torsoD: 0.22, hipW: 0.1,
    shoulderW: 0.21, armU: 0.29, armL: 0.27, armR: 0.052, headR: 0.12, neck: 0.07, arms: 2, legs: true,
    geo: 'capsule', ...o,
  };
  const M = c.mats;
  const root = new THREE.Group();
  const hips = new THREE.Group();
  const legLen = c.legs ? c.legU + c.legL + c.footH : (c.floatH ?? 0.9);
  hips.position.y = legLen;
  root.add(hips);
  const rig = { root, hips, legs: [], arms: [], c, baseHipY: legLen };

  // pelvis
  mesh(c.geo === 'rock' ? G.sphLow : G.sph, M.bottom, hips, 0, 0.02, 0, c.torsoW * 0.95, 0.24, c.torsoD * 1.05);
  if (c.legs) {
    for (const s of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(s * c.hipW, 0, 0); hips.add(hip);
      limb(hip, c.legU, c.legR * 1.15, M.bottom, c.geo);
      const knee = new THREE.Group(); knee.position.y = -c.legU; hip.add(knee);
      limb(knee, c.legL, c.legR, M.leg ?? M.bottom, c.geo);
      const foot = new THREE.Group(); foot.position.y = -c.legL; knee.add(foot);
      mesh(c.geo === 'rock' ? G.sphLow : G.box, M.shoe, foot, 0, -c.footH / 2, c.legR * 0.8, c.legR * 2.3, c.footH * 1.2, c.legR * 4);
      rig.legs.push({ hip, knee, foot, side: s });
    }
  }
  const spine = new THREE.Group(); spine.position.y = 0.06; hips.add(spine);
  rig.spine = spine;
  const chestGeo = c.geo === 'rock' ? G.sphLow : c.geo === 'facet' ? G.capsuleFacet : G.capsule;
  rig.chest = mesh(chestGeo, M.top, spine, 0, c.torsoH / 2, 0, c.torsoW, c.torsoH / 2 * (c.geo === 'rock' ? 2 : 1), c.torsoD);
  if (c.geo === 'rock') rig.chest.scale.set(c.torsoW, c.torsoH, c.torsoD);

  const armRows = c.arms === 4 ? [c.torsoH * 0.88, c.torsoH * 0.55] : [c.torsoH * 0.88];
  armRows.forEach((y, row) => {
    for (const s of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(s * c.shoulderW, y, 0); spine.add(sh);
      mesh(c.geo === 'rock' ? G.sphLow : G.sph, M.top, sh, 0, 0, 0, c.armR * 3, c.armR * 3, c.armR * 3);
      limb(sh, c.armU, c.armR * 1.1, M.arm ?? M.top, c.geo);
      const el = new THREE.Group(); el.position.y = -c.armU; sh.add(el);
      limb(el, c.armL, c.armR, M.skin, c.geo);
      const hand = new THREE.Group(); hand.position.y = -c.armL; el.add(hand);
      mesh(c.geo === 'rock' ? G.sphLow : G.sph, M.hand ?? M.skin, hand, 0, -0.03, 0, c.armR * 2.6, c.armR * 2.8, c.armR * 2.2);
      rig.arms.push({ sh, el, hand, side: s, row });
    }
  });
  const neck = new THREE.Group(); neck.position.y = c.torsoH; spine.add(neck);
  mesh(G.cyl, M.skin, neck, 0, c.neck / 2, 0, c.headR * 0.8, c.neck + 0.04, c.headR * 0.8);
  const head = new THREE.Group(); head.position.y = c.neck + c.headR * 0.9; neck.add(head);
  rig.head = head; rig.neck = neck;
  rig.headMesh = mesh(c.geo === 'rock' ? G.sphLow : G.sph, M.head ?? M.skin, head, 0, 0, 0, c.headR * 2, c.headR * 2.15, c.headR * 2.05);
  rig.height = legLen + 0.06 + c.torsoH + c.neck + c.headR * 2;
  return rig;
}

function eyes(head, r, mat, spread = 0.38, y = 0.1, size = 0.22, z = 0.85) {
  for (const s of [-1, 1]) mesh(G.sph, mat, head, s * r * spread, r * y, r * z, r * size, r * size * 1.1, r * size * 0.6);
}

// ---------------------------------------------------------------- forms
function human() {
  const skin = std('#b87a52', 0.65);
  const mats = { skin, top: std('#27468c', 0.8), bottom: std('#2f3b55', 0.9), shoe: std('#d8d8d8', 0.7), arm: std('#27468c', 0.8) };
  const rig = buildHumanoid({ mats });
  const h = rig.head, r = rig.c.headR;
  const hair = std('#15100c', 0.8);
  mesh(G.sph, hair, h, 0, r * 0.35, -r * 0.1, r * 2.1, r * 1.5, r * 2.15);
  for (let i = 0; i < 7; i++) mesh(G.cone, hair, h, (i - 3) * r * 0.28, r * 0.95, r * 0.35 - Math.abs(i - 3) * 0.01, r * 0.35, r * 0.7, r * 0.35, 0.9, 0, (i - 3) * 0.12);
  eyes(h, r, std('#1a1a1a', 0.3));
  // white tee stripe on jacket front
  mesh(G.box, std('#eeeeee', 0.8), rig.spine, 0, rig.c.torsoH * 0.5, rig.c.torsoD * 0.47, 0.12, rig.c.torsoH * 0.95, 0.02);
  // the Kada (wrist device)
  const left = rig.arms.find((a) => a.side === 1);
  const kadaMat = std('#1e1e1e', 0.3, 0.8);
  const glow = std('#39ff6a', 0.2, 0, { emissive: '#39ff6a', emissiveIntensity: 2 });
  mesh(G.cyl, kadaMat, left.el, 0, -rig.c.armL * 0.72, 0, 0.12, 0.09, 0.12);
  rig.kadaGlow = mesh(G.cyl, glow, left.el, 0, -rig.c.armL * 0.72, 0.058, 0.07, 0.02, 0.07, Math.PI / 2);
  return { rig, scale: 1 };
}

function agni() {
  const crack = T.crackEmissiveTexture();
  const magma = std('#2a1a14', 0.9, 0, { emissive: '#ff5500', emissiveMap: crack, emissiveIntensity: 2.2 });
  const mats = { skin: magma, top: magma, bottom: magma, shoe: std('#1a100c', 0.9), arm: magma };
  const rig = buildHumanoid({ mats, torsoW: 0.42, torsoD: 0.26, armR: 0.065, legR: 0.085, shoulderW: 0.25 });
  const r = rig.c.headR;
  const flameMat = [
    new THREE.MeshBasicMaterial({ color: '#ffcc33', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: '#ff6a00', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
  ];
  const flames = [];
  for (let i = 0; i < 5; i++) {
    const f = mesh(G.cone, flameMat[i % 2], rig.head, (Math.random() - 0.5) * r, r * 1.1, (Math.random() - 0.5) * r * 0.8, r * 1.6, r * 3, r * 1.6);
    f.castShadow = false; flames.push(f);
  }
  for (const a of rig.arms) {
    const f = mesh(G.cone, flameMat[1], a.sh, 0, 0.1, 0, 0.1, 0.25, 0.1); f.castShadow = false; flames.push(f);
  }
  eyes(rig.head, r, std('#fff', 0.2, 0, { emissive: '#ffee88', emissiveIntensity: 3 }), 0.4, 0.05, 0.28);
  return {
    rig, scale: 1.1, light: { color: '#ff7a1a', intensity: 6 },
    update(t) {
      flames.forEach((f, i) => { const k = 1 + Math.sin(t * 18 + i * 1.7) * 0.18; f.scale.y = (i < 5 ? r * 3 : 0.25) * k; f.rotation.z = Math.sin(t * 9 + i) * 0.15; });
      magma.emissiveIntensity = 2 + Math.sin(t * 6) * 0.4;
    },
  };
}

function vajra() {
  const skin = std('#b3342b', 0.7);
  const mats = { skin, top: skin, bottom: std('#1b1b1b', 0.8), shoe: std('#1b1b1b', 0.8), arm: skin };
  const rig = buildHumanoid({ mats, arms: 4, torsoW: 0.62, torsoD: 0.36, torsoH: 0.62, shoulderW: 0.34, armR: 0.085, armU: 0.33, armL: 0.32, legR: 0.1, headR: 0.12, hipW: 0.14 });
  const r = rig.c.headR;
  const eyeMat = std('#ffd400', 0.3, 0, { emissive: '#ffb000', emissiveIntensity: 2 });
  eyes(rig.head, r, eyeMat, 0.4, 0.25, 0.2);
  eyes(rig.head, r, eyeMat, 0.4, -0.2, 0.18);
  mesh(G.torus, std('#d4a017', 0.3, 0.9), rig.hips, 0, 0.06, 0, rig.c.torsoW * 1.25, rig.c.torsoD * 2.0, 0.5, Math.PI / 2);
  mesh(G.box, std('#1b1b1b', 0.6), rig.spine, 0, rig.c.torsoH * 0.55, 0, rig.c.torsoW * 0.9, 0.14, rig.c.torsoD * 1.05);
  return { rig, scale: 1.55 };
}

function vega() {
  const suit = std('#1c2a44', 0.35, 0.3, { emissive: '#18c8ff', emissiveMap: T.stripeEmissiveTexture('#fff'), emissiveIntensity: 1.2 });
  const black = std('#0c0f14', 0.3, 0.4);
  const mats = { skin: black, top: suit, bottom: suit, shoe: std('#101418', 0.3, 0.6), arm: suit };
  const rig = buildHumanoid({ mats, legU: 0.5, legL: 0.5, legR: 0.065, torsoW: 0.3, torsoH: 0.5, armR: 0.045, headR: 0.13, head: black });
  const r = rig.c.headR;
  rig.headMesh.scale.set(r * 1.9, r * 2, r * 2.8);
  rig.headMesh.position.z = r * 0.3;
  mesh(G.sph, std('#050608', 0.05, 0.9, { emissive: '#1ad0ff', emissiveIntensity: 0.6 }), rig.head, 0, r * 0.1, r * 0.9, r * 1.6, r * 0.6, r * 1.4);
  // tail
  const tail = new THREE.Group(); tail.position.set(0, 0, -0.1); rig.hips.add(tail);
  const segs = [];
  let parent = tail;
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Group(); s.position.set(0, i ? -0.02 : 0, i ? -0.15 : 0); parent.add(s);
    mesh(G.sph, i % 2 ? suit : black, s, 0, 0, -0.07, 0.12 - i * 0.012, 0.12 - i * 0.012, 0.2);
    segs.push(s); parent = s;
  }
  // wheel-feet
  for (const l of rig.legs) mesh(G.torus, std('#18c8ff', 0.2, 0.5, { emissive: '#18c8ff', emissiveIntensity: 1.5 }), l.foot, 0, -0.03, 0.05, 0.22, 0.22, 0.6, 0, Math.PI / 2);
  return {
    rig, scale: 0.95, light: { color: '#18c8ff', intensity: 1.5 },
    update(t, dt, st) { segs.forEach((s, i) => { s.rotation.x = 0.25 + (st.speedN > 1 ? -0.2 : Math.sin(t * 3 + i) * 0.1); s.rotation.y = Math.sin(t * 4 - i * 0.6) * 0.18; }); },
  };
}

function hima() {
  const ice = std('#a9ecff', 0.08, 0.1, { transparent: true, opacity: 0.82, emissive: '#2a8cc0', emissiveIntensity: 0.5, flatShading: true });
  const deep = std('#3d7fb8', 0.15, 0.2, { flatShading: true, emissive: '#10304a' });
  const mats = { skin: ice, top: ice, bottom: deep, shoe: deep, arm: ice };
  const rig = buildHumanoid({ mats, geo: 'facet', torsoW: 0.44, torsoD: 0.28, armR: 0.06, legR: 0.085, headR: 0.13 });
  const r = rig.c.headR;
  rig.headMesh.geometry = G.oct; rig.headMesh.scale.set(r * 2.2, r * 2.8, r * 2.2);
  mesh(G.box, std('#0a1a2a', 0.3), rig.head, 0, 0, r * 0.75, r * 1.4, r * 0.8, r * 0.3);
  eyes(rig.head, r, std('#fff', 0.1, 0, { emissive: '#bff4ff', emissiveIntensity: 3 }), 0.35, 0.0, 0.2, 0.95);
  const shardMat = std('#d8f7ff', 0.05, 0.1, { transparent: true, opacity: 0.85, emissive: '#5fd0ff', emissiveIntensity: 0.8, flatShading: true });
  const shards = [[0, 0.5, -0.18, -0.6, 0.5], [0.15, 0.45, -0.16, -0.5, 0.4], [-0.15, 0.45, -0.16, -0.5, 0.4], [0.1, 0.25, -0.15, -0.8, 0.3], [-0.1, 0.25, -0.15, -0.8, 0.3]];
  for (const [x, y, z, rx, h] of shards) mesh(G.cone4, shardMat, rig.spine, x, y, z, 0.12, h, 0.12, rx, 0, x * 3);
  for (const a of rig.arms) mesh(G.cone4, shardMat, a.sh, a.side * 0.05, 0.12, 0, 0.1, 0.3, 0.1, 0, 0, -a.side * 0.4);
  mesh(G.cone4, shardMat, rig.head, 0, r * 1.6, -r * 0.2, r * 0.8, r * 1.8, r * 0.8, -0.3);
  return { rig, scale: 1.15, light: { color: '#7fdcff', intensity: 1.5 } };
}

function vidyut() {
  const dark = std('#1d1d22', 0.4, 0.5, { emissive: '#ffd400', emissiveMap: T.stripeEmissiveTexture('#fff'), emissiveIntensity: 1.5 });
  const yellow = std('#ffd400', 0.4, 0.2);
  const mats = { skin: yellow, top: dark, bottom: dark, shoe: std('#111', 0.5), arm: dark, head: std('#222228', 0.4, 0.6) };
  const rig = buildHumanoid({ mats, torsoW: 0.36, armR: 0.05, headR: 0.13 });
  const r = rig.c.headR;
  const core = mesh(G.sph, std('#fff7b0', 0.2, 0, { emissive: '#ffe24a', emissiveIntensity: 4 }), rig.spine, 0, rig.c.torsoH * 0.62, rig.c.torsoD * 0.45, 0.16, 0.16, 0.08);
  const tipMat = std('#fff', 0.2, 0, { emissive: '#fff38a', emissiveIntensity: 5 });
  for (const s of [-1, 1]) {
    mesh(G.cone, dark, rig.head, s * r * 0.55, r * 1.3, 0, r * 0.3, r * 1.6, r * 0.3, 0, 0, -s * 0.35);
    mesh(G.sph, tipMat, rig.head, s * r * 0.85, r * 2.05, 0, r * 0.35, r * 0.35, r * 0.35);
  }
  mesh(G.box, std('#050505', 0.1, 0.8, { emissive: '#ffd400', emissiveIntensity: 0.8 }), rig.head, 0, r * 0.1, r * 0.8, r * 1.5, r * 0.45, r * 0.4);
  return {
    rig, scale: 1.0, light: { color: '#ffe24a', intensity: 3 }, sparky: true,
    update(t) { core.scale.setScalar(0.16 * (1 + Math.sin(t * 25) * 0.15)); core.scale.z = 0.08; },
  };
}

function garuda() {
  const feather = std('#6b4a2b', 0.85), cream = std('#e8dcc0', 0.85), gold = std('#e0a526', 0.4, 0.3);
  const mats = { skin: feather, top: feather, bottom: std('#4a321c', 0.85), shoe: gold, arm: feather, hand: gold, leg: gold };
  const rig = buildHumanoid({ mats, torsoW: 0.4, torsoD: 0.3, headR: 0.13, legR: 0.06 });
  const r = rig.c.headR;
  mesh(G.sph, cream, rig.spine, 0, rig.c.torsoH * 0.55, rig.c.torsoD * 0.3, rig.c.torsoW * 0.8, rig.c.torsoH * 0.7, rig.c.torsoD * 0.6);
  rig.headMesh.material = cream;
  mesh(G.sph, feather, rig.head, 0, r * 0.3, -r * 0.3, r * 2.1, r * 1.8, r * 2.2);
  mesh(G.cone, gold, rig.head, 0, -r * 0.1, r * 1.1, r * 0.6, r * 1.3, r * 0.6, Math.PI / 2 + 0.3);
  eyes(rig.head, r, std('#111', 0.2, 0, { emissive: '#ffb000', emissiveIntensity: 0.6 }), 0.5, 0.25, 0.22);
  for (let i = 0; i < 3; i++) mesh(G.cone, feather, rig.head, 0, r * 0.8 - i * r * 0.2, -r * (1 + i * 0.3), r * 0.4, r * 1.4, r * 0.3, -1.9);
  const wings = [];
  for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(s * 0.12, rig.c.torsoH * 0.85, -rig.c.torsoD * 0.5); rig.spine.add(w);
    for (let i = 0; i < 6; i++) {
      const len = 0.9 - i * 0.08;
      mesh(G.box, i % 2 ? feather : std('#8a6238', 0.85), w, s * (0.18 + i * 0.2), -0.1 - i * 0.07, -0.02 * i, 0.22, len, 0.03, 0, 0, s * (0.15 + i * 0.12));
    }
    wings.push({ w, s });
  }
  return {
    rig, scale: 1.2,
    update(t, dt, st) {
      for (const { w, s } of wings) {
        const target = st.fly ? Math.sin(t * 9) * 0.6 : st.air ? 0.2 : -0.9;
        w.rotation.z += (s * target - w.rotation.z) * Math.min(1, dt * 10);
        w.rotation.y = st.fly || st.air ? 0 : s * 0.8;
        w.rotation.x = st.fly || st.air ? 0.2 : 0.4;
        const k = st.fly || st.air ? 1.4 : 0.7;
        w.scale.setScalar(w.scale.x + (k - w.scale.x) * Math.min(1, dt * 8));
      }
    },
  };
}

function pashan() {
  const rock = std('#ffffff', 0.95, 0, { map: T.rockTexture('#8a8276'), flatShading: true });
  const mats = { skin: rock, top: rock, bottom: rock, shoe: rock, arm: rock };
  const rig = buildHumanoid({ mats, geo: 'rock', torsoW: 0.7, torsoD: 0.5, torsoH: 0.6, shoulderW: 0.4, armR: 0.11, armU: 0.34, armL: 0.36, legR: 0.12, legU: 0.36, legL: 0.36, headR: 0.13, hipW: 0.16 });
  const r = rig.c.headR;
  rig.head.position.z = 0.1; rig.head.position.y -= 0.05;
  const gem = std('#6dff6d', 0.2, 0, { emissive: '#3aff3a', emissiveIntensity: 2.5 });
  eyes(rig.head, r, gem, 0.4, 0.1, 0.3);
  const moss = std('#4f7a2e', 1, 0, { flatShading: true });
  for (let i = 0; i < 6; i++) mesh(G.sphLow, moss, rig.spine, (Math.random() - 0.5) * 0.5, 0.3 + Math.random() * 0.3, -0.18 + Math.random() * 0.1, 0.15, 0.08, 0.15);
  for (const a of rig.arms) mesh(G.sphLow, rock, a.sh, 0, 0.05, 0, 0.35, 0.3, 0.35);
  return { rig, scale: 1.65 };
}

function chhaya() {
  const ghost = std('#3a1d5c', 0.3, 0, { transparent: true, opacity: 0.62, emissive: '#6a2fb0', emissiveIntensity: 0.9, depthWrite: false });
  const mats = { skin: ghost, top: ghost, bottom: ghost, shoe: ghost, arm: ghost };
  const rig = buildHumanoid({ mats, legs: false, floatH: 0.7, torsoW: 0.38, armR: 0.04, armU: 0.34, armL: 0.34, headR: 0.15 });
  const r = rig.c.headR;
  const tail = new THREE.Group(); rig.hips.add(tail);
  const tailM = mesh(G.cone, ghost, tail, 0, -0.35, 0, 0.42, 0.8, 0.3, Math.PI);
  tailM.castShadow = false;
  const eye = mesh(G.sph, std('#fff', 0.1, 0, { emissive: '#e0c8ff', emissiveIntensity: 4 }), rig.head, 0, r * 0.05, r * 0.85, r * 0.9, r * 0.9, r * 0.4);
  mesh(G.sph, std('#110022', 0.2), rig.head, 0, r * 0.05, r * 1.0, r * 0.35, r * 0.35, r * 0.2);
  for (const a of rig.arms) for (let i = 0; i < 3; i++) mesh(G.cone, ghost, a.hand, (i - 1) * 0.03, -0.08, 0.02, 0.025, 0.14, 0.025, Math.PI);
  rig.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return {
    rig, scale: 1.2, light: { color: '#a070ff', intensity: 1.5 }, float: true,
    update(t) { tail.rotation.z = Math.sin(t * 3) * 0.15; tail.rotation.x = Math.sin(t * 2) * 0.1; eye.scale.y = r * 0.9 * (Math.sin(t * 0.7) > 0.97 ? 0.1 : 1); },
  };
}

function tarang() {
  const white = std('#e8f4f2', 0.35, 0.1), teal = std('#1aa39a', 0.4, 0.2, { emissive: '#0a4f4a' });
  const mats = { skin: white, top: white, bottom: teal, shoe: teal, arm: white, head: white };
  const rig = buildHumanoid({ mats, torsoW: 0.34, headR: 0.16, legR: 0.07, armR: 0.05 });
  const r = rig.c.headR;
  const speaker = new THREE.Group(); speaker.position.set(0, rig.c.torsoH * 0.6, rig.c.torsoD * 0.45); rig.spine.add(speaker);
  mesh(G.cyl, std('#111', 0.5), speaker, 0, 0, 0, 0.22, 0.04, 0.22, Math.PI / 2);
  const cone = mesh(G.cone, std('#333', 0.4, 0.3), speaker, 0, 0, 0.02, 0.18, 0.06, 0.18, -Math.PI / 2);
  mesh(G.torus, teal, speaker, 0, 0, 0.02, 0.26, 0.26, 0.3);
  mesh(G.box, std('#0a2a28', 0.1, 0.6, { emissive: '#35ffe0', emissiveIntensity: 1.5 }), rig.head, 0, r * 0.15, r * 0.82, r * 1.5, r * 0.4, r * 0.3);
  for (const s of [-1, 1]) mesh(G.cyl, teal, rig.head, s * r * 0.95, 0, 0, r * 0.7, r * 0.3, r * 0.7, 0, 0, Math.PI / 2);
  return { rig, scale: 0.85, update(t) { cone.scale.y = 0.06 * (1 + Math.sin(t * 30) * 0.3); } };
}

function anu() {
  const skin = std('#8fa08a', 0.55), suit = std('#2b2f3a', 0.5);
  const mats = { skin, top: suit, bottom: suit, shoe: std('#111', 0.5), arm: skin, head: skin };
  const rig = buildHumanoid({ mats, legU: 0.3, legL: 0.3, torsoH: 0.4, torsoW: 0.28, headR: 0.26, neck: 0.03, armU: 0.22, armL: 0.2, armR: 0.04, legR: 0.055, shoulderW: 0.17 });
  const r = rig.c.headR;
  rig.headMesh.scale.set(r * 2.1, r * 1.9, r * 2);
  const eye = std('#050505', 0.05, 0.3);
  for (const s of [-1, 1]) mesh(G.sph, eye, rig.head, s * r * 0.38, 0, r * 0.78, r * 0.42, r * 0.55, r * 0.3, 0, 0, s * 0.45);
  mesh(G.cyl, std('#39ff6a', 0.2, 0, { emissive: '#39ff6a', emissiveIntensity: 2 }), rig.spine, 0, rig.c.torsoH * 0.6, rig.c.torsoD * 0.48, 0.12, 0.03, 0.12, Math.PI / 2);
  return { rig, scale: 0.55 };
}

export const BUILDERS = { human, agni, vajra, vega, hima, vidyut, garuda, pashan, chhaya, tarang, anu };

// ---------------------------------------------------------------- animation
const lerp = (a, b, k) => a + (b - a) * k;

export function animateRig(rig, st, dt) {
  const k = 1 - Math.exp(-dt * 14);
  const amp = Math.min(1.1, st.speedN) * (st.air ? 0 : 1);
  const sw = Math.sin(st.phase), cw = Math.cos(st.phase);
  const run = st.speedN > 1.2 ? 1 : 0;
  const lean = st.fly ? 1.25 : st.dash ? 0.9 : run * 0.25 + amp * 0.06;
  rig.hips.rotation.x = lerp(rig.hips.rotation.x, lean, k);
  rig.spine.rotation.y = lerp(rig.spine.rotation.y, sw * amp * 0.12, k);
  const bob = rig.c.legs ? Math.abs(cw) * 0.05 * amp : Math.sin(st.t * 2) * 0.06;
  rig.hips.position.y = rig.baseHipY + bob - (st.land ?? 0) * 0.15;

  for (const l of rig.legs) {
    let hipT, kneeT;
    if (st.fly) { hipT = 0.3; kneeT = 0.6; }
    else if (st.air) { hipT = l.side < 0 ? -0.7 : 0.25; kneeT = l.side < 0 ? 1.1 : 0.5; }
    else {
      const s = l.side < 0 ? 1 : -1;
      hipT = -sw * s * amp * (0.7 + run * 0.35);
      kneeT = amp * (1.1 + run * 0.6) * Math.max(0, s * cw) + 0.05;
    }
    l.hip.rotation.x = lerp(l.hip.rotation.x, hipT, k);
    l.knee.rotation.x = lerp(l.knee.rotation.x, kneeT, k);
    l.foot.rotation.x = lerp(l.foot.rotation.x, st.air ? 0.3 : -kneeT * 0.3, k);
  }
  for (const a of rig.arms) {
    const s = a.side < 0 ? -1 : 1;
    let shX = sw * s * amp * (0.6 + run * 0.4) * (a.row ? 0.6 : 1);
    let shZ = s * (0.1 + (a.row ? 0.25 : 0));
    let elX = -0.25 - amp * 0.35 - run * 0.6;
    if (st.air && !st.fly) { shX = -0.5; shZ = s * 0.8; elX = -0.4; }
    if (st.fly) { shX = 0.6; shZ = s * 0.3; elX = -0.1; }
    if (!st.air && amp < 0.05) shX += Math.sin(st.t * 1.6) * 0.03;
    // power pose
    if (st.attack > 0) {
      const p = Math.sin(Math.min(1, st.attack) * Math.PI * 0.5);
      if (st.pose === 'slam') { shX = lerp(shX, -2.8, p); shZ = s * 0.3; elX = lerp(elX, -0.3, p); }
      else if (st.pose === 'both' || a.side < 0 || a.row) { shX = lerp(shX, -1.55, p); shZ = lerp(shZ, 0, p); elX = lerp(elX, -0.05, p); }
    }
    if (st.hold && a.row === 0) { shX = -1.3; shZ = s * 0.25; elX = -0.5; }
    a.sh.rotation.x = lerp(a.sh.rotation.x, shX, k);
    a.sh.rotation.z = lerp(a.sh.rotation.z, shZ, k);
    a.el.rotation.x = lerp(a.el.rotation.x, elX, k);
  }
  const breathe = 1 + Math.sin(st.t * 2.2) * 0.015;
  rig.spine.scale.set(breathe, 1, breathe);
  rig.head.rotation.x = lerp(rig.head.rotation.x, -lean * 0.5 + (st.aimPitch ?? 0) * 0.3, k);
}

export function buildAll() {
  const out = {};
  for (const [id, fn] of Object.entries(BUILDERS)) {
    const f = fn();
    f.rig.root.scale.setScalar(f.scale);
    f.rig.root.traverse((o) => { if (o.isMesh && o.castShadow === undefined) o.castShadow = true; });
    out[id] = f;
  }
  return out;
}

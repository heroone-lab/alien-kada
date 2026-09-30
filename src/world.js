// Procedural Indian street "Gali No. 10": buildings, shops, poles & tangled wires,
// parked autos/cars, carts, cows, and simple physics for props.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from './textures.js';

const { rand, pick } = T;
export const STREET = { roadHalf: 5, walkEdge: 8.5, zMin: -100, zMax: 100 };

const V3 = THREE.Vector3;
const tmpM = new THREE.Matrix4();
const dummy = new THREE.Object3D();

export function std(color, rough = 0.85, metal = 0, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
}

// Collects geometries by material and merges them -> very few draw calls
export class Batcher {
  constructor() { this.map = new Map(); }
  add(geo, mat, matrix) {
    let list = this.map.get(mat);
    if (!list) { list = []; this.map.set(mat, list); }
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(matrix);
    list.push(g);
  }
  build(parent, cast = true, receive = true) {
    const meshes = [];
    for (const [mat, list] of this.map) {
      if (!list.length) continue;
      const geo = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = cast; m.receiveShadow = receive;
      parent.add(m); meshes.push(m);
    }
    this.map.clear();
    return meshes;
  }
}

function mtx(parent, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, rz); dummy.scale.set(sx, sy, sz);
  dummy.updateMatrix();
  return parent ? tmpM.multiplyMatrices(parent, dummy.matrix).clone() : dummy.matrix.clone();
}

// Merge all meshes of a group by material into one group (used for props)
function collapse(group, yOffset = 0) {
  group.updateMatrixWorld(true);
  const b = new Batcher();
  const off = new THREE.Matrix4().makeTranslation(0, yOffset, 0);
  group.traverse((o) => { if (o.isMesh) b.add(o.geometry, o.material, off.clone().multiply(o.matrixWorld)); });
  const out = new THREE.Group();
  b.build(out);
  return out;
}

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
  cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  sph: new THREE.SphereGeometry(0.5, 12, 8),
  ico: new THREE.IcosahedronGeometry(0.5, 1),
  plane: new THREE.PlaneGeometry(1, 1),
  wheel: new THREE.CylinderGeometry(0.5, 0.5, 1, 16).rotateZ(Math.PI / 2),
};

const SHOPS = [
  ['चाय वाला', 'CHAI POINT'], ['किराना स्टोर', 'KIRANA STORE'], ['मोबाइल रिपेयर', 'MOBILE REPAIR'],
  ['शर्मा स्वीट्स', 'SHARMA SWEETS'], ['दवाई घर', 'MEDICAL STORE'], ['पान भंडार', 'PAAN BHANDAR'],
  ['गुप्ता टेलर्स', 'GUPTA TAILORS'], ['साइबर कैफे', 'CYBER CAFE'], ['हेयर सैलून', 'HAIR SALOON'],
  ['पंजाबी ढाबा', 'PUNJABI DHABA'], ['फोटो स्टूडियो', 'PHOTO STUDIO'], ['जनरल स्टोर', 'GENERAL STORE'],
  ['बर्तन भंडार', 'BARTAN BHANDAR'], ['इलेक्ट्रिकल्स', 'ELECTRICALS'], ['समोसा कॉर्नर', 'SAMOSA CORNER'],
  ['वर्मा ज्वैलर्स', 'VERMA JEWELLERS'], ['दूध डेयरी', 'MILK DAIRY'], ['कपड़ा हाउस', 'KAPDA HOUSE'],
];
const SIGN_COLORS = [['#c8102e', '#fff'], ['#ffd200', '#c8102e'], ['#0b5ed7', '#fff'], ['#1a7f37', '#fff'], ['#ff7a00', '#fff'], ['#fff', '#c8102e'], ['#6f2da8', '#ffe14a'], ['#111', '#ffd200']];

export class World {
  constructor(scene, quality) {
    this.scene = scene;
    this.quality = quality;
    this.colliders = [];     // {minX,maxX,minZ,maxZ,top}
    this.occluders = [];     // meshes for camera collision / aim raycasts
    this.props = [];         // dynamic physics props
    this.cows = [];
    this.root = new THREE.Group();
    scene.add(this.root);
    this.batch = new Batcher();
    this.mats = {
      concrete: std('#cfc8ba', 0.9), darkConcrete: std('#8d877c', 0.95), metal: std('#5d6166', 0.5, 0.7),
      darkMetal: std('#2a2c2f', 0.6, 0.6), black: std('#141414', 0.7), white: std('#e9e9e4', 0.6),
      tank: std('#1b1b1b', 0.5), wire: std('#0c0c0c', 0.6), wood: std('#7a5230', 0.9), pole: std('#9a978f', 0.9),
      leaf: [std('#3f6b2a', 0.9, 0, { flatShading: true }), std('#4f7d31', 0.9, 0, { flatShading: true }), std('#2f5a24', 0.9, 0, { flatShading: true })],
      trunk: std('#5a4632', 0.95), lampGlow: std('#fff6d0', 0.4, 0, { emissive: '#ffe9a8', emissiveIntensity: 0.6 }),
      shutter: std('#9aa0a6', 0.55, 0.5, { map: T.shutterTexture() }),
      openShop: [0, 1, 2].map(() => { const t = T.openShopTexture(); return std('#ffffff', 0.9, 0, { map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.12 }); }),
      tarp: [std('#1f5fbf', 0.8, 0, { side: THREE.DoubleSide }), std('#e6711f', 0.8, 0, { side: THREE.DoubleSide }), std('#2f8f3f', 0.8, 0, { side: THREE.DoubleSide })],
      cloth: ['#d0213a', '#f2b705', '#1e88e5', '#8e24aa', '#43a047', '#ff7043', '#ffffff'].map((c) => std(c, 0.9, 0, { side: THREE.DoubleSide })),
      marigold: [std('#ff8c00', 0.7), std('#ffc300', 0.7)],
    };
    this.facadeTex = T.PALETTE.map((c) => T.facadeTexture(c));
    this.plasterMats = T.PALETTE.map((c) => std('#ffffff', 0.95, 0, { map: T.plasterTexture(T.shade(c, -0.08), true) }));

    this.buildGround();
    this.buildBuildings();
    this.buildEnds();
    this.buildPoles();
    this.buildTrees();
    this.buildBanners();
    this.batch.build(this.root);
    this.buildProps();
    this.buildCows();
  }

  addCollider(minX, maxX, minZ, maxZ, top) {
    this.colliders.push({ minX: Math.min(minX, maxX), maxX: Math.max(minX, maxX), minZ: Math.min(minZ, maxZ), maxZ: Math.max(minZ, maxZ), top });
  }

  buildGround() {
    const len = STREET.zMax - STREET.zMin + 20;
    const roadTex = T.roadTexture(); roadTex.repeat.set(1, len / 10);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(10, len), std('#ffffff', 0.93, 0, { map: roadTex }));
    road.rotation.x = -Math.PI / 2; road.receiveShadow = true;
    this.root.add(road);
    this.groundMesh = road;

    // big dusty ground below everything
    const dirt = new THREE.Mesh(new THREE.PlaneGeometry(200, 400), std('#8a7a62', 1));
    dirt.rotation.x = -Math.PI / 2; dirt.position.y = -0.02; dirt.receiveShadow = true;
    this.root.add(dirt);

    const paver = T.paverTexture(); paver.repeat.set(3.5, len);
    const fpMat = std('#ffffff', 0.9, 0, { map: paver });
    const curbTex = T.curbTexture(); curbTex.repeat.set(len, 1);
    const curbMat = std('#ffffff', 0.8, 0, { map: curbTex });
    for (const s of [-1, 1]) {
      const fp = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.2, len), fpMat);
      fp.position.set(s * 6.75, 0.1, 0); fp.receiveShadow = true;
      this.root.add(fp);
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.26, len), curbMat);
      curb.position.set(s * 5.05, 0.13, 0); curb.receiveShadow = true; curb.castShadow = true;
      this.root.add(curb);
      this.addCollider(s * 4.95, s * 8.5, STREET.zMin - 10, STREET.zMax + 10, 0.22);
    }
    // manholes
    for (let i = 0; i < 5; i++) {
      this.batch.add(G.cyl, this.mats.darkMetal, mtx(null, rand(-3, 3), 0.01, rand(-90, 90), 0, 0, 0, 0.9, 0.02, 0.9));
    }
  }

  buildBuildings() {
    let signIdx = 0;
    for (const s of [-1, 1]) {
      let z = STREET.zMin - 2;
      while (z < STREET.zMax + 2) {
        const w = Math.min(rand(6, 11), STREET.zMax + 4 - z);
        if (w < 3) break;
        const d = rand(9, 12);
        const floors = pick([1, 2, 2, 3, 3, 3, 4]);
        this.building(s, z + w / 2, w, d, floors, signIdx);
        signIdx += w > 8 ? 2 : 1;
        z += w;
      }
    }
  }

  building(s, zc, w, d, floors, signIdx) {
    const gh = 3.4, fh = 3;
    const H = gh + floors * fh;
    const ci = (Math.random() * T.PALETTE.length) | 0;
    const group = new THREE.Group();
    group.position.set(s * (STREET.walkEdge + d / 2), 0, zc);
    group.rotation.y = -s * Math.PI / 2;
    group.updateMatrix();
    const P = group.matrix;
    const B = this.batch, M = this.mats;
    const fz = d / 2; // front face local z

    // ground floor block
    const gf = new THREE.Mesh(G.box, this.plasterMats[(ci + 3) % this.plasterMats.length]);
    gf.scale.set(w, gh, d); gf.position.y = gh / 2;
    gf.castShadow = gf.receiveShadow = true;
    group.add(gf);

    // upper floors with window bays
    if (floors > 0) {
      const t = this.facadeTex[ci].clone();
      t.repeat.set(Math.max(1, Math.round(w / 3)), floors);
      t.needsUpdate = true;
      const up = new THREE.Mesh(G.box, std('#ffffff', 0.92, 0, { map: t }));
      up.scale.set(w, floors * fh, d); up.position.y = gh + floors * fh / 2;
      up.castShadow = up.receiveShadow = true;
      group.add(up);
      this.occluders.push(up);
    }
    this.occluders.push(gf);

    // shops on ground floor
    const n = w > 8 ? 2 : 1;
    const sw = w / n;
    for (let i = 0; i < n; i++) {
      const cx = -w / 2 + sw * (i + 0.5);
      const open = Math.random() < 0.55;
      B.add(G.plane, open ? pick(M.openShop) : M.shutter, mtx(P, cx, 1.35, fz + 0.02, 0, 0, 0, sw - 0.5, 2.7, 1));
      // side pillars
      B.add(G.box, M.concrete, mtx(P, cx - sw / 2 + 0.12, 1.4, fz + 0.06, 0, 0, 0, 0.24, 2.8, 0.12));
      // sign board
      const [hi, en] = SHOPS[(signIdx + i) % SHOPS.length];
      const [bg, fg] = SIGN_COLORS[(signIdx + i) % SIGN_COLORS.length];
      const signMat = std('#ffffff', 0.6, 0, { map: T.signTexture(hi, en, bg, fg), emissive: '#ffffff', emissiveIntensity: 0.08 });
      signMat.emissiveMap = signMat.map;
      const sign = new THREE.Mesh(G.plane, signMat);
      sign.scale.set(sw - 0.4, (sw - 0.4) / 4.6, 1);
      sign.position.set(cx, 3.05, fz + 0.2);
      group.add(sign);
      B.add(G.box, M.darkMetal, mtx(P, cx, 3.05, fz + 0.12, 0, 0, 0, sw - 0.3, (sw - 0.4) / 4.6 + 0.1, 0.12));
      // blue tarp awning
      if (Math.random() < 0.45) {
        B.add(G.plane, pick(M.tarp), mtx(P, cx, 2.55, fz + 0.9, -Math.PI / 2 + 0.35, 0, 0, sw - 0.6, 1.9, 1));
        for (const sx of [-1, 1]) B.add(G.cyl6, M.metal, mtx(P, cx + sx * (sw / 2 - 0.4), 1.2, fz + 1.75, 0, 0, 0, 0.04, 2.4, 0.04));
      }
      // marigold garland
      if (Math.random() < 0.35) {
        const y0 = 2.65, span = sw - 0.6;
        for (let k = 0; k <= 16; k++) {
          const t = k / 16, x = cx - span / 2 + span * t;
          const y = y0 - Math.sin(t * Math.PI) * 0.35;
          B.add(G.ico, M.marigold[k % 2], mtx(P, x, y, fz + 0.3, 0, 0, 0, 0.11, 0.11, 0.11));
        }
      }
    }
    // chajja slab above ground floor
    B.add(G.box, M.concrete, mtx(P, 0, gh - 0.05, fz + 0.4, 0, 0, 0, w, 0.14, 0.8));

    // per-floor details
    for (let f = 0; f < floors; f++) {
      const y0 = gh + f * fh;
      B.add(G.box, M.concrete, mtx(P, 0, y0 + fh - 0.2, fz + 0.3, 0, 0, 0, w + 0.05, 0.1, 0.6));
      if (Math.random() < 0.5 && w > 4) {
        const bw = Math.min(w - 1, rand(2.8, 4.5)), bx = rand(-w / 2 + bw / 2 + 0.3, w / 2 - bw / 2 - 0.3);
        B.add(G.box, M.concrete, mtx(P, bx, y0 + 0.05, fz + 0.55, 0, 0, 0, bw, 0.16, 1.1));
        const rail = pick([M.darkMetal, M.metal, M.concrete]);
        B.add(G.box, rail, mtx(P, bx, y0 + 1.05, fz + 1.07, 0, 0, 0, bw, 0.06, 0.06));
        for (let x = -bw / 2; x <= bw / 2 + 0.01; x += 0.25) B.add(G.box, rail, mtx(P, bx + x, y0 + 0.6, fz + 1.07, 0, 0, 0, 0.03, 0.9, 0.03));
        for (const sx of [-1, 1]) B.add(G.box, rail, mtx(P, bx + sx * bw / 2, y0 + 0.6, fz + 0.58, 0, 0, 0, 0.04, 0.9, 1));
        // clothes drying
        if (Math.random() < 0.6) {
          for (let k = 0; k < 3; k++) {
            const x = bx - bw / 2 + 0.4 + k * (bw - 0.8) / 2;
            B.add(G.plane, pick(M.cloth), mtx(P, x, y0 + 0.7, fz + 1.1, 0, rand(-0.1, 0.1), 0, rand(0.5, 0.9), rand(0.5, 0.9), 1));
          }
        }
      }
      if (Math.random() < 0.45) {
        const ax = rand(-w / 2 + 0.6, w / 2 - 0.6);
        B.add(G.box, M.white, mtx(P, ax, y0 + 0.6, fz + 0.2, 0, 0, 0, 0.85, 0.55, 0.35));
        B.add(G.cyl, M.darkMetal, mtx(P, ax + 0.12, y0 + 0.6, fz + 0.38, Math.PI / 2, 0, 0, 0.38, 0.02, 0.38));
      }
    }
    // roof: parapet, water tank, stair room
    B.add(G.box, M.concrete, mtx(P, 0, H + 0.4, fz - 0.1, 0, 0, 0, w, 0.8, 0.2));
    B.add(G.box, M.concrete, mtx(P, 0, H + 0.4, -fz + 0.1, 0, 0, 0, w, 0.8, 0.2));
    B.add(G.box, M.concrete, mtx(P, -w / 2 + 0.1, H + 0.4, 0, 0, 0, 0, 0.2, 0.8, d));
    B.add(G.box, M.concrete, mtx(P, w / 2 - 0.1, H + 0.4, 0, 0, 0, 0, 0.2, 0.8, d));
    const tx = rand(-w / 2 + 1, w / 2 - 1), tz = rand(-fz + 1.5, fz - 2);
    B.add(G.cyl, M.tank, mtx(P, tx, H + 0.9, tz, 0, 0, 0, 1.2, 1.4, 1.2));
    B.add(G.box, M.metal, mtx(P, tx, H + 0.1, tz, 0, 0, 0, 1.3, 0.2, 1.3));
    if (Math.random() < 0.5) B.add(G.box, this.plasterMats[ci], mtx(P, rand(-w / 4, w / 4), H + 1.3, -fz + 2, 0, 0, 0, 2.2, 2.6, 2.4));

    this.root.add(group);
    const x1 = s * STREET.walkEdge, x2 = s * (STREET.walkEdge + d);
    this.addCollider(x1, x2, zc - w / 2, zc + w / 2, H);
  }

  buildEnds() {
    for (const e of [-1, 1]) {
      const z = e > 0 ? STREET.zMax + 6 : STREET.zMin - 6;
      const t = this.facadeTex[e > 0 ? 2 : 6].clone(); t.repeat.set(12, 3); t.needsUpdate = true;
      const m = new THREE.Mesh(G.box, std('#ffffff', 0.92, 0, { map: t }));
      m.scale.set(40, 12.4, 8); m.position.set(0, 6.2, z);
      m.castShadow = m.receiveShadow = true;
      this.root.add(m); this.occluders.push(m);
      this.addCollider(-20, 20, z - 4, z + 4, 12.4);
      // police barricades (yellow/black)
      const bm = std('#ffffff', 0.7, 0, { map: T.curbTexture() });
      bm.map.repeat.set(2, 1);
      for (let x = -4.5; x <= 4.5; x += 2.2) {
        const zz = z - e * 5;
        this.batch.add(G.box, bm, mtx(null, x, 0.8, zz, 0, 0, 0, 2, 0.35, 0.08));
        this.batch.add(G.box, this.mats.darkMetal, mtx(null, x - 0.9, 0.5, zz, 0, 0, 0, 0.06, 1, 0.5));
        this.batch.add(G.box, this.mats.darkMetal, mtx(null, x + 0.9, 0.5, zz, 0, 0, 0, 0.06, 1, 0.5));
      }
    }
  }

  wire(a, b, sag, radius = 0.018) {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const p = new V3().lerpVectors(a, b, t);
      p.y -= sag * 4 * t * (1 - t);
      pts.push(p);
    }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, radius, 3, false);
    this.batch.add(geo, this.mats.wire, new THREE.Matrix4());
    geo.dispose();
  }

  buildPoles() {
    const B = this.batch, M = this.mats;
    this.poles = { '-1': [], '1': [] };
    for (const s of [-1, 1]) {
      for (let z = STREET.zMin + 4 + (s > 0 ? 7 : 0); z < STREET.zMax - 2; z += 15) {
        const x = s * 5.6;
        B.add(G.cyl6, M.pole, mtx(null, x, 4.2, z, 0, 0, 0, 0.22, 8.4, 0.22));
        B.add(G.box, M.darkMetal, mtx(null, x, 7.6, z, 0, 0, 0, 1.4, 0.1, 0.1));
        for (const o of [-0.6, -0.2, 0.2, 0.6]) B.add(G.cyl6, M.white, mtx(null, x + o, 7.72, z, 0, 0, 0, 0.06, 0.14, 0.06));
        // street light arm
        B.add(G.box, M.darkMetal, mtx(null, x - s * 1.1, 7.0, z, 0, 0, -s * 0.15, 2.2, 0.07, 0.07));
        B.add(G.box, M.lampGlow, mtx(null, x - s * 2.15, 6.82, z, 0, 0, 0, 0.55, 0.12, 0.25));
        if (Math.random() < 0.35) B.add(G.box, M.metal, mtx(null, x + s * 0.35, 5.2, z, 0, 0, 0, 0.5, 0.9, 0.5));
        // tangled cable blob
        for (let k = 0; k < 4; k++) {
          const tor = new THREE.TorusGeometry(rand(0.2, 0.4), 0.03, 4, 12);
          B.add(tor, M.wire, mtx(null, x, rand(6.1, 6.9), z, rand(0, 3), rand(0, 3), 0));
          tor.dispose();
        }
        this.poles[s].push(new V3(x, 7.6, z));
        this.colliders.push({ minX: x - 0.15, maxX: x + 0.15, minZ: z - 0.15, maxZ: z + 0.15, top: 8.4 });
      }
    }
    for (const s of [-1, 1]) {
      const P = this.poles[s];
      for (let i = 0; i < P.length - 1; i++) {
        const a = P[i], b = P[i + 1];
        for (const o of [-0.6, -0.2, 0.2, 0.6]) this.wire(new V3(a.x + o, a.y + 0.15, a.z), new V3(b.x + o, b.y + 0.15, b.z), rand(0.5, 1.1));
        for (let k = 0; k < 3; k++) this.wire(new V3(a.x, rand(6.2, 6.8), a.z), new V3(b.x, rand(6.2, 6.8), b.z), rand(1, 2.2), 0.03);
        // service wires to buildings
        for (let k = 0; k < 2; k++) {
          const bz = rand(a.z, b.z);
          this.wire(new V3(a.x, 6.6, a.z), new V3(s * STREET.walkEdge, rand(4.5, 6.5), bz), rand(0.3, 0.8), 0.015);
        }
      }
    }
    // cross-street wires
    const L = this.poles[-1], R = this.poles[1];
    for (let i = 0; i < Math.min(L.length, R.length); i += 1) {
      this.wire(new V3(L[i].x, 7.2, L[i].z), new V3(R[i].x, 7.2, R[i].z), rand(0.8, 1.6), 0.02);
      if (i % 2 === 0) this.wire(new V3(L[i].x, 6.6, L[i].z), new V3(R[i].x, 6.9, R[i].z), rand(1.2, 2.2), 0.025);
    }
  }

  buildTrees() {
    const B = this.batch, M = this.mats;
    const spots = [[-7.3, -62], [7.3, -30], [-7.3, 12], [7.3, 44], [-7.3, 70], [7.3, -80]];
    for (const [x, z] of spots) {
      B.add(G.cyl6, M.trunk, mtx(null, x, 2, z, 0, 0, rand(-0.08, 0.08), 0.45, 4, 0.45));
      B.add(G.cyl6, M.darkConcrete, mtx(null, x, 0.35, z, 0, 0, 0, 1.4, 0.3, 1.4));
      for (let k = 0; k < 6; k++) {
        const r = rand(1.4, 2.4);
        B.add(G.ico, pick(M.leaf), mtx(null, x + rand(-1.4, 1.4) - Math.sign(x) * 0.8, rand(4.2, 6.3), z + rand(-1.6, 1.6), rand(0, 3), rand(0, 3), 0, r * 2, r * 1.6, r * 2));
      }
      this.colliders.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3, top: 4 });
    }
    // small roadside shrine
    B.add(G.box, std('#f4f0e6', 0.8), mtx(null, 7.6, 0.9, -8, 0, 0, 0, 1.2, 1.4, 1.1));
    B.add(G.box, std('#e8612c', 0.7), mtx(null, 7.6, 1.8, -8, 0, 0, 0, 1.4, 0.3, 1.3));
    B.add(G.cyl6, M.wood, mtx(null, 7.9, 2.8, -8.3, 0, 0, 0, 0.04, 2, 0.04));
    B.add(G.plane, std('#ff7a00', 0.8, 0, { side: THREE.DoubleSide }), mtx(null, 7.9, 3.55, -8.05, 0, Math.PI / 2, 0, 0.5, 0.35, 1));
    this.colliders.push({ minX: 7, maxX: 8.3, minZ: -8.6, maxZ: -7.4, top: 1.95 });
  }

  buildBanners() {
    const data = [['दिवाली धमाका सेल', 'MEGA SALE', '#c8102e', -40], ['गली नं. 10 में स्वागत है', 'WELCOME', '#1a4fb0', 55]];
    for (const [hi, en, bg, z] of data) {
      const m = new THREE.Mesh(G.plane, std('#ffffff', 0.8, 0, { map: T.bannerTexture(hi, en, bg), side: THREE.DoubleSide }));
      m.scale.set(9, 1.15, 1); m.position.set(0, 6.4, z);
      m.castShadow = true;
      this.root.add(m);
      this.wire(new V3(-5.6, 7.2, z), new V3(5.6, 7.2, z), 0.2, 0.02);
    }
  }

  // ---------------- dynamic props ----------------
  addProp(group, { radius, halfH, mass, x, z, rotY = 0, y = null, kind = 'prop' }) {
    const obj = collapse(group, -halfH);
    const ground = this.groundAt(x, z, 1);
    obj.position.set(x, (y ?? ground) + halfH, z);
    obj.rotation.y = rotY;
    this.root.add(obj);
    const p = { obj, pos: obj.position, vel: new V3(), ang: new V3(), radius, halfH, mass, kind, sleep: true, scale: 1, base: { radius, halfH, mass }, hitCd: 0, thrown: 0 };
    this.props.push(p);
    return p;
  }

  mk(parent, geo, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  }

  autoRickshaw(x, z, rotY) {
    const g = new THREE.Group(), M = this.mats;
    const green = std('#1f7a3a', 0.45, 0.3), yellow = std('#f2c200', 0.45, 0.2), glass = std('#1a2229', 0.1, 0.5);
    this.mk(g, G.box, green, 0, 0.55, 0, 1.3, 0.55, 2.4);
    this.mk(g, G.box, yellow, 0, 1.45, -0.15, 1.35, 0.12, 2.1);
    this.mk(g, G.box, yellow, 0, 1.0, -0.9, 1.3, 0.9, 0.6);
    this.mk(g, G.box, glass, 0, 1.1, 1.0, 1.1, 0.6, 0.05, -0.25);
    this.mk(g, G.box, green, 0, 0.7, 1.15, 0.9, 0.5, 0.35);
    this.mk(g, G.cyl6, M.black, 0.62, 1.0, 0.95, 0.05, 0.9, 0.05);
    this.mk(g, G.cyl6, M.black, -0.62, 1.0, 0.95, 0.05, 0.9, 0.05);
    this.mk(g, G.sph, std('#fff8d0', 0.2, 0, { emissive: '#ffeeaa', emissiveIntensity: 0.4 }), 0, 0.75, 1.34, 0.18, 0.18, 0.08);
    for (const [wx, wz] of [[0, 1.05], [-0.6, -0.75], [0.6, -0.75]]) this.mk(g, G.wheel, M.black, wx, 0.26, wz, 0.18, 0.52, 0.52);
    return this.addProp(g, { radius: 1.25, halfH: 0.78, mass: 4, x, z, rotY });
  }

  car(x, z, rotY, color) {
    const g = new THREE.Group(), M = this.mats;
    const paint = std(color, 0.25, 0.6), glass = std('#12181e', 0.05, 0.8);
    this.mk(g, G.box, paint, 0, 0.6, 0, 1.65, 0.6, 3.7);
    this.mk(g, G.box, glass, 0, 1.15, -0.25, 1.45, 0.55, 2.0);
    this.mk(g, G.box, paint, 0, 1.44, -0.35, 1.47, 0.06, 1.6);
    this.mk(g, G.box, M.darkMetal, 0, 0.42, 1.86, 1.6, 0.25, 0.08);
    this.mk(g, G.box, M.darkMetal, 0, 0.42, -1.86, 1.6, 0.25, 0.08);
    for (const sx of [-1, 1]) {
      this.mk(g, G.sph, std('#fffbe0', 0.1, 0, { emissive: '#ffffee', emissiveIntensity: 0.3 }), sx * 0.6, 0.72, 1.85, 0.3, 0.16, 0.06);
      this.mk(g, G.sph, std('#c00', 0.3, 0, { emissive: '#600' }), sx * 0.65, 0.75, -1.85, 0.25, 0.14, 0.05);
      for (const wz of [1.2, -1.2]) this.mk(g, G.wheel, M.black, sx * 0.78, 0.32, wz, 0.22, 0.64, 0.64);
    }
    return this.addProp(g, { radius: 1.9, halfH: 0.75, mass: 8, x, z, rotY });
  }

  scooter(x, z, rotY) {
    const g = new THREE.Group(), M = this.mats;
    const paint = std(pick(['#b71c1c', '#1565c0', '#eeeeee', '#212121', '#2e7d32']), 0.3, 0.4);
    this.mk(g, G.box, paint, 0, 0.55, -0.2, 0.45, 0.5, 1.0);
    this.mk(g, G.box, M.black, 0, 0.85, -0.25, 0.4, 0.1, 0.7);
    this.mk(g, G.box, paint, 0, 0.75, 0.5, 0.4, 0.8, 0.15, 0.2);
    this.mk(g, G.box, M.darkMetal, 0, 1.15, 0.55, 0.7, 0.05, 0.05);
    for (const wz of [0.6, -0.55]) this.mk(g, G.wheel, M.black, 0, 0.22, wz, 0.12, 0.44, 0.44);
    return this.addProp(g, { radius: 0.7, halfH: 0.6, mass: 1.2, x, z, rotY });
  }

  cart(x, z, rotY) {
    const g = new THREE.Group(), M = this.mats;
    this.mk(g, G.box, M.wood, 0, 0.8, 0, 1.2, 0.1, 2.0);
    this.mk(g, G.box, M.wood, 0.6, 0.9, 0, 0.05, 0.2, 2.0);
    this.mk(g, G.box, M.wood, -0.6, 0.9, 0, 0.05, 0.2, 2.0);
    for (const sx of [-1, 1]) this.mk(g, G.wheel, M.darkMetal, sx * 0.62, 0.4, 0, 0.06, 0.8, 0.8);
    this.mk(g, G.cyl6, M.wood, 0, 0.6, 1.2, 0.05, 0.9, 0.05, 1.2);
    const fruit = [std('#e53935', 0.5), std('#fdd835', 0.5), std('#fb8c00', 0.5), std('#7cb342', 0.5)];
    for (let i = 0; i < 26; i++) this.mk(g, G.sph, pick(fruit), rand(-0.45, 0.45), 0.95 + rand(0, 0.2), rand(-0.85, 0.85), 0.2, 0.2, 0.2);
    return this.addProp(g, { radius: 1.1, halfH: 0.6, mass: 2, x, z, rotY });
  }

  chaiStall(x, z, rotY) {
    const g = new THREE.Group(), M = this.mats;
    this.mk(g, G.box, std('#2e6fb5', 0.7), 0, 0.5, 0, 1.6, 1.0, 0.8);
    this.mk(g, G.box, M.metal, 0, 1.02, 0, 1.7, 0.05, 0.9);
    this.mk(g, G.cyl, std('#b0b4b8', 0.3, 0.9), -0.4, 1.2, 0, 0.3, 0.3, 0.3);
    this.mk(g, G.cyl, M.black, -0.4, 1.06, 0, 0.35, 0.05, 0.35);
    for (let i = 0; i < 6; i++) this.mk(g, G.cyl, std('#f5f0e0', 0.3), 0.2 + i * 0.1, 1.1, 0.15, 0.07, 0.1, 0.07);
    return this.addProp(g, { radius: 0.9, halfH: 0.65, mass: 2.5, x, z, rotY });
  }

  simple(kind, x, z) {
    const g = new THREE.Group(), M = this.mats;
    if (kind === 'bin') {
      this.mk(g, G.cyl, std('#2e7d32', 0.6), 0, 0.45, 0, 0.6, 0.9, 0.6);
      this.mk(g, G.cyl, std('#1b5e20', 0.6), 0, 0.93, 0, 0.64, 0.06, 0.64);
      return this.addProp(g, { radius: 0.35, halfH: 0.48, mass: 0.5, x, z });
    }
    if (kind === 'crate') {
      this.mk(g, G.box, std('#9c7a4a', 0.9), 0, 0.35, 0, 0.7, 0.7, 0.7);
      this.mk(g, G.box, M.wood, 0, 0.35, 0, 0.72, 0.1, 0.72);
      return this.addProp(g, { radius: 0.42, halfH: 0.35, mass: 0.4, x, z, rotY: rand(0, 3) });
    }
    if (kind === 'lpg') {
      this.mk(g, G.cyl, std('#c62828', 0.4, 0.3), 0, 0.4, 0, 0.36, 0.7, 0.36);
      this.mk(g, G.sph, std('#c62828', 0.4, 0.3), 0, 0.75, 0, 0.36, 0.2, 0.36);
      this.mk(g, G.cyl6, M.darkMetal, 0, 0.9, 0, 0.12, 0.12, 0.12);
      return this.addProp(g, { radius: 0.2, halfH: 0.48, mass: 0.4, x, z, kind: 'lpg' });
    }
    if (kind === 'chair') {
      const red = std('#d32f2f', 0.5);
      this.mk(g, G.box, red, 0, 0.45, 0, 0.5, 0.05, 0.5);
      this.mk(g, G.box, red, 0, 0.75, -0.24, 0.5, 0.55, 0.05, -0.1);
      for (const [lx, lz] of [[0.22, 0.22], [-0.22, 0.22], [0.22, -0.22], [-0.22, -0.22]]) this.mk(g, G.cyl6, red, lx, 0.22, lz, 0.04, 0.45, 0.04);
      return this.addProp(g, { radius: 0.3, halfH: 0.52, mass: 0.2, x, z, rotY: rand(0, 6) });
    }
  }

  buildProps() {
    this.autoRickshaw(-3.8, 60, 0.05); this.autoRickshaw(3.9, 20, Math.PI + 0.1); this.autoRickshaw(-3.6, -35, -0.1); this.autoRickshaw(3.7, -70, Math.PI);
    this.car(3.7, 72, Math.PI, '#e8e8e8'); this.car(-3.7, 30, 0, '#b71c1c'); this.car(3.7, -12, Math.PI, '#9aa3ab'); this.car(-3.7, -85, 0, '#1a3a8a');
    for (const [x, z] of [[-6.5, 76], [6.6, 36], [-6.4, 2], [6.5, -48], [-6.4, -72]]) this.scooter(x, z, Math.PI / 2 * Math.sign(-x));
    this.cart(6.4, 64, 0); this.cart(-6.5, -18, 0.2); this.cart(6.4, -60, -0.1);
    this.chaiStall(-7.2, 48, Math.PI / 2); this.chaiStall(7.2, -2, -Math.PI / 2);
    for (let i = 0; i < 6; i++) this.simple('chair', -6.2 + rand(-0.4, 0.4), 45 + rand(-2, 2));
    for (let i = 0; i < 4; i++) this.simple('chair', 6.2 + rand(-0.4, 0.4), -4 + rand(-2, 2));
    for (let z = -90; z < 95; z += 22) this.simple('bin', pick([-5.6, 5.6]), z + rand(-3, 3));
    for (let i = 0; i < 10; i++) this.simple('crate', pick([-1, 1]) * rand(6.5, 7.8), rand(-90, 90));
    for (let i = 0; i < 5; i++) this.simple('lpg', pick([-1, 1]) * rand(7.2, 8.1), rand(-90, 90));
  }

  // ---------------- cows ----------------
  buildCows() {
    const white = std('#e9e4da', 0.9), spot = std('#6b5a4a', 0.9), horn = std('#d8cbb0', 0.6), hoof = std('#2a2420', 0.8), pink = std('#d9a3a0', 0.8);
    for (const [x, z] of [[1.5, 40], [-2, -25], [2.5, -60]]) {
      const cow = new THREE.Group();
      const body = new THREE.Group(); cow.add(body);
      this.mk(body, G.sph, white, 0, 1.15, 0, 0.8, 0.8, 1.8);
      this.mk(body, G.sph, spot, 0.28, 1.25, 0.2, 0.4, 0.5, 0.7);
      this.mk(body, G.box, white, 0, 1.25, 0.55, 0.3, 0.35, 0.3); // hump
      const head = new THREE.Group(); head.position.set(0, 1.35, 0.95); body.add(head);
      this.mk(head, G.box, white, 0, 0, 0.25, 0.35, 0.38, 0.55);
      this.mk(head, G.box, pink, 0, -0.08, 0.53, 0.3, 0.2, 0.08);
      for (const sx of [-1, 1]) {
        this.mk(head, G.cyl6, horn, sx * 0.14, 0.26, 0.12, 0.05, 0.3, 0.05, 0, 0, -sx * 0.5);
        this.mk(head, G.box, white, sx * 0.24, 0.08, 0.1, 0.2, 0.06, 0.1);
        this.mk(head, G.sph, hoof, sx * 0.14, 0.06, 0.4, 0.05, 0.05, 0.05);
      }
      const legs = [];
      for (const [lx, lz] of [[0.22, 0.6], [-0.22, 0.6], [0.22, -0.6], [-0.22, -0.6]]) {
        const pv = new THREE.Group(); pv.position.set(lx, 0.95, lz); body.add(pv);
        this.mk(pv, G.cyl6, white, 0, -0.45, 0, 0.13, 0.9, 0.13);
        this.mk(pv, G.cyl6, hoof, 0, -0.9, 0, 0.14, 0.1, 0.14);
        legs.push(pv);
      }
      const tail = this.mk(body, G.cyl6, white, 0, 1.0, -0.95, 0.04, 0.8, 0.04, 0.3);
      cow.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      cow.position.set(x, 0, z);
      this.root.add(cow);
      this.cows.push({ obj: cow, pos: cow.position, legs, head, tail, heading: rand(0, 6), state: 'walk', t: rand(2, 6), phase: 0, flee: 0, fleeDir: new V3() });
    }
  }

  // ---------------- queries ----------------
  groundAt(x, z, feetY, step = 0.45) {
    let h = 0;
    for (const c of this.colliders) {
      if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ && c.top <= feetY + step && c.top > h) h = c.top;
    }
    return h;
  }

  // circle vs AABB push-out. returns normal (V3) of last hit or null
  pushOut(pos, r, feetY, step = 0.45, height = 1.8) {
    let hit = null;
    for (const c of this.colliders) {
      if (c.top <= feetY + step) continue;
      if (feetY + height < 0 && c.top > 0) continue;
      const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      let dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-9) {
        const d = Math.sqrt(d2), k = (r - d) / d;
        pos.x += dx * k; pos.z += dz * k;
        hit = new V3(dx / d, 0, dz / d);
      } else {
        const pen = [pos.x - c.minX, c.maxX - pos.x, pos.z - c.minZ, c.maxZ - pos.z];
        const i = pen.indexOf(Math.min(...pen));
        if (i === 0) { pos.x = c.minX - r; hit = new V3(-1, 0, 0); }
        else if (i === 1) { pos.x = c.maxX + r; hit = new V3(1, 0, 0); }
        else if (i === 2) { pos.z = c.minZ - r; hit = new V3(0, 0, -1); }
        else { pos.z = c.maxZ + r; hit = new V3(0, 0, 1); }
      }
    }
    return hit;
  }

  insideSolid(p) {
    for (const c of this.colliders) if (p.x > c.minX && p.x < c.maxX && p.z > c.minZ && p.z < c.maxZ && p.y < c.top && c.top > 0.5) return true;
    return p.y < 0;
  }

  wake(p) { p.sleep = false; }

  // ---------------- simulation ----------------
  update(dt, game) {
    const g = 25;
    const props = this.props;
    for (const p of props) {
      if (p.held) continue;
      if (p.hitCd > 0) p.hitCd -= dt;
      if (p.thrown > 0) p.thrown -= dt;
      if (p.sleep) continue;
      const v = p.vel;
      v.y -= g * dt;
      p.pos.addScaledVector(v, dt);
      const feet = p.pos.y - p.halfH;
      const n = this.pushOut(p.pos, p.radius * 0.8, feet, 0.3, p.halfH * 2);
      if (n) {
        const vn = v.dot(n);
        if (vn < 0) v.addScaledVector(n, -1.4 * vn);
        if (Math.abs(vn) > 8) game.fx.dust(p.pos, 8);
      }
      const gy = this.groundAt(p.pos.x, p.pos.z, feet + 0.3);
      let onGround = false;
      if (p.pos.y - p.halfH <= gy) {
        p.pos.y = gy + p.halfH;
        if (v.y < -6) { v.y *= -0.28; game.fx.dust(p.pos.clone().setY(gy + 0.1), 6); if (p.mass > 1.5) game.audio.thud(Math.min(1, -v.y / 10)); }
        else v.y = 0;
        onGround = true;
        const f = Math.exp(-6 * dt);
        v.x *= f; v.z *= f;
      }
      const o = p.obj.rotation;
      o.x += p.ang.x * dt; o.y += p.ang.y * dt; o.z += p.ang.z * dt;
      if (onGround) {
        p.ang.multiplyScalar(Math.exp(-5 * dt));
        const tx = Math.round(o.x / Math.PI) * Math.PI, tz = Math.round(o.z / Math.PI) * Math.PI;
        o.x += (tx - o.x) * Math.min(1, dt * 6); o.z += (tz - o.z) * Math.min(1, dt * 6);
        if (v.lengthSq() < 0.02 && p.ang.lengthSq() < 0.02 && Math.abs(tx - o.x) < 0.01 && Math.abs(tz - o.z) < 0.01) { v.set(0, 0, 0); p.sleep = true; }
      }
      // fast props damage drones
      const sp = v.length();
      if (sp > 9 && p.hitCd <= 0) {
        for (const d of game.drones.list) {
          if (!d.alive) continue;
          if (d.pos.distanceTo(p.pos) < p.radius + 0.9) {
            game.drones.damage(d, sp * 1.6 * Math.sqrt(p.mass), v.clone().multiplyScalar(0.4));
            p.hitCd = 0.3;
          }
        }
      }
      if (p.kind === 'lpg' && sp > 16 && !p.boom) { p.boom = true; game.combat.explode(p.pos.clone(), { radius: 6, force: 18, damage: 40, fire: true }); p.vel.y += 12; }
    }
    // prop vs prop
    for (let i = 0; i < props.length; i++) {
      const a = props[i];
      for (let j = i + 1; j < props.length; j++) {
        const b = props[j];
        if (a.sleep && b.sleep) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const rr = (a.radius + b.radius) * 0.8;
        const d2 = dx * dx + dz * dz;
        if (d2 > rr * rr || Math.abs(a.pos.y - b.pos.y) > a.halfH + b.halfH) continue;
        const d = Math.sqrt(d2) || 0.001, nx = dx / d, nz = dz / d, pen = rr - d;
        const wa = b.mass / (a.mass + b.mass), wb = 1 - wa;
        if (!a.held) { a.pos.x -= nx * pen * wa; a.pos.z -= nz * pen * wa; }
        if (!b.held) { b.pos.x += nx * pen * wb; b.pos.z += nz * pen * wb; }
        const rv = (b.vel.x - a.vel.x) * nx + (b.vel.z - a.vel.z) * nz;
        if (rv < 0) {
          const j2 = -1.3 * rv / (1 / a.mass + 1 / b.mass);
          a.vel.x -= nx * j2 / a.mass; a.vel.z -= nz * j2 / a.mass;
          b.vel.x += nx * j2 / b.mass; b.vel.z += nz * j2 / b.mass;
          a.sleep = b.sleep = false;
        }
      }
    }
    this.updateCows(dt, game);
  }

  updateCows(dt, game) {
    for (const c of this.cows) {
      c.t -= dt;
      let speed = 0;
      if (c.flee > 0) {
        c.flee -= dt; speed = 3.2;
        c.heading = lerpAngle(c.heading, Math.atan2(c.fleeDir.x, c.fleeDir.z), dt * 4);
      } else if (c.state === 'walk') {
        speed = 0.7;
        if (c.t <= 0) { c.state = 'idle'; c.t = rand(3, 8); }
      } else if (c.t <= 0) {
        c.state = 'walk'; c.t = rand(3, 7); c.heading += rand(-1.2, 1.2);
        if (Math.random() < 0.15) game.audio.moo(c.pos, game.player.pos);
      }
      // stay on road
      if (Math.abs(c.pos.x) > 3.8) c.heading = lerpAngle(c.heading, Math.atan2(-Math.sign(c.pos.x), 0), dt * 2);
      if (c.pos.z > STREET.zMax - 8) c.heading = lerpAngle(c.heading, Math.PI, dt * 2);
      if (c.pos.z < STREET.zMin + 8) c.heading = lerpAngle(c.heading, 0, dt * 2);
      c.pos.x += Math.sin(c.heading) * speed * dt;
      c.pos.z += Math.cos(c.heading) * speed * dt;
      c.pos.x = Math.max(-4.2, Math.min(4.2, c.pos.x));
      c.obj.rotation.y = c.heading;
      c.phase += speed * dt * 4;
      const a = Math.sin(c.phase) * 0.4 * Math.min(1, speed);
      c.legs[0].rotation.x = a; c.legs[3].rotation.x = a; c.legs[1].rotation.x = -a; c.legs[2].rotation.x = -a;
      c.head.rotation.x = c.state === 'idle' && c.flee <= 0 ? 0.5 + Math.sin(performance.now() * 0.001) * 0.1 : 0;
      c.tail.rotation.z = Math.sin(performance.now() * 0.003 + c.phase) * 0.3;
    }
  }

  scareCows(pos, radius) {
    for (const c of this.cows) {
      const d = c.pos.distanceTo(pos);
      if (d < radius) { c.flee = 3; c.fleeDir.subVectors(c.pos, pos).setY(0).normalize(); }
    }
  }
}

export function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, t);
}

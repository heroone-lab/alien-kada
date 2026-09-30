// GPU point-sprite particles + rings, bolts, beams and a fixed pool of point lights.
import * as THREE from 'three';

const V3 = THREE.Vector3;
const rand = (a, b) => a + Math.random() * (b - a);

const VERT = /* glsl */`
attribute float size; attribute float alpha; attribute vec3 pcolor;
varying vec3 vC; varying float vA;
uniform float uScale;
void main(){
  vC = pcolor; vA = alpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */`
varying vec3 vC; varying float vA;
uniform float uSoft;
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  float a = mix(1.0, smoothstep(0.5, 0.0, r), uSoft) * vA;
  gl_FragColor = vec4(vC, a);
  #include <colorspace_fragment>
}`;

class ParticlePool {
  constructor(scene, max, additive) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.i = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uScale: { value: 400 }, uSoft: { value: additive ? 1 : 0.6 } },
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 3 : 2;
    scene.add(this.points);
    this.geo = g;
  }
  spawn(p, v, color, life, s0, s1, grav, drag, a0) {
    const i = this.i; this.i = (this.i + 1) % this.max;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    this.col[i * 3] = color.r; this.col[i * 3 + 1] = color.g; this.col[i * 3 + 2] = color.b;
    this.life[i] = life; this.maxLife[i] = life; this.s0[i] = s0; this.s1[i] = s1;
    this.grav[i] = grav; this.drag[i] = drag; this.a0[i] = a0;
  }
  update(dt) {
    const { pos, vel, life, maxLife, size, alpha } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) { if (alpha[i] !== 0) { alpha[i] = 0; size[i] = 0; } continue; }
      life[i] -= dt;
      const k = 1 - Math.max(0, life[i]) / maxLife[i];
      const dr = Math.exp(-this.drag[i] * dt);
      vel[i * 3] *= dr; vel[i * 3 + 1] = vel[i * 3 + 1] * dr - this.grav[i] * dt; vel[i * 3 + 2] *= dr;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < 0.02) { pos[i * 3 + 1] = 0.02; vel[i * 3 + 1] *= -0.3; }
      size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * k;
      alpha[i] = this.a0[i] * (k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9);
    }
    const a = this.geo.attributes;
    a.position.needsUpdate = a.pcolor.needsUpdate = a.size.needsUpdate = a.alpha.needsUpdate = true;
  }
}

export class Effects {
  constructor(scene, quality) {
    this.scene = scene;
    const mul = quality === 'low' ? 0.5 : 1;
    this.mul = mul;
    this.add = new ParticlePool(scene, Math.floor(3500 * mul), true);
    this.norm = new ParticlePool(scene, Math.floor(2500 * mul), false);
    this.items = [];
    this.lights = [];
    for (let i = 0; i < 3; i++) {
      const l = new THREE.PointLight('#ffffff', 0, 18, 1.6);
      l.userData = { t: 0, dur: 0, peak: 0, follow: null };
      scene.add(l);
      this.lights.push(l);
    }
    this.unitCyl = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2);
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 48);
    this.torusGeo = new THREE.TorusGeometry(1, 0.08, 8, 40);
    this._c = new THREE.Color();
  }

  setScale(px) { this.add.mat.uniforms.uScale.value = px; this.norm.mat.uniforms.uScale.value = px; }

  emit(o) {
    const count = Math.max(1, Math.round((o.count ?? 10) * this.mul));
    const pool = o.additive === false ? this.norm : this.add;
    const colors = Array.isArray(o.color) ? o.color : [o.color ?? '#ffffff'];
    const v = new V3(), p = new V3();
    for (let i = 0; i < count; i++) {
      p.copy(o.pos);
      if (o.area) p.add(new V3(rand(-o.area, o.area), rand(-o.area, o.area) * (o.flat ? 0.1 : 1), rand(-o.area, o.area)));
      v.set(rand(-1, 1), rand(-1, 1), rand(-1, 1));
      if (o.up) v.y = Math.abs(v.y) * o.up;
      v.multiplyScalar(o.spread ?? 3);
      if (o.vel) v.add(o.vel);
      this._c.set(colors[(Math.random() * colors.length) | 0]);
      const life = rand(...(o.life ?? [0.4, 0.9]));
      const s = o.size ?? [0.3, 0.6];
      const s0 = rand(s[0], s[1]);
      pool.spawn(p, v, this._c, life, s0, s0 * (o.grow ?? 0.2), o.gravity ?? 0, o.drag ?? 1.5, o.alpha ?? 1);
    }
  }

  // presets
  fire(pos, count = 30, power = 1) {
    this.emit({ pos, count, color: ['#ffdd66', '#ff8a1a', '#ff4a00', '#ffb040'], spread: 5 * power, life: [0.3, 0.7], size: [0.6 * power, 1.3 * power], grow: 0.1, gravity: -3, drag: 3 });
    this.emit({ pos, count: count * 0.6, additive: false, color: ['#3a332e', '#2a2522', '#4a4038'], spread: 3 * power, life: [0.8, 1.8], size: [0.8 * power, 1.4 * power], grow: 2.5, gravity: -2, drag: 2, alpha: 0.55, up: 1 });
  }
  dust(pos, count = 20, power = 1) {
    this.emit({ pos, count, additive: false, color: ['#b5a58a', '#9c8c72', '#c9baa0'], spread: 4 * power, life: [0.6, 1.4], size: [0.6 * power, 1.2 * power], grow: 2.2, gravity: 1, drag: 3, alpha: 0.5, up: 0.6 });
  }
  sparks(pos, color = '#fff2a0', count = 20, speed = 8) {
    this.emit({ pos, count, color: [color, '#ffffff'], spread: speed, life: [0.2, 0.5], size: [0.12, 0.25], grow: 0.1, gravity: 12, drag: 1 });
  }
  debris(pos, color = '#6b6258', count = 20, speed = 10) {
    this.emit({ pos, count, additive: false, color: [color, '#4a443c', '#8a8070'], spread: speed, life: [0.6, 1.2], size: [0.18, 0.35], grow: 1, gravity: 22, drag: 0.5, up: 1.4 });
  }
  glow(pos, color, count = 4, size = 1.2, life = 0.25) {
    this.emit({ pos, count, color, spread: 0.3, life: [life * 0.6, life], size: [size * 0.7, size], grow: 0.3, drag: 1 });
  }

  light(pos, color, intensity = 30, dur = 0.3, follow = null) {
    let best = this.lights[0];
    for (const l of this.lights) if (l.userData.t / Math.max(l.userData.dur, 0.001) >= best.userData.t / Math.max(best.userData.dur, 0.001)) best = l;
    best.position.copy(pos); best.color.set(color);
    best.userData = { t: 0, dur, peak: intensity, follow };
    best.intensity = intensity;
    return best;
  }

  ring(pos, color, maxR = 8, dur = 0.5, normal = new V3(0, 1, 0), opacity = 0.9) {
    const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(pos);
    m.lookAt(pos.clone().add(normal));
    this.scene.add(m);
    this.items.push({ m, t: 0, dur, type: 'ring', maxR, opacity });
  }

  torus(pos, dir, color, maxR, dur, speed) {
    const m = new THREE.Mesh(this.torusGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.position.copy(pos); m.lookAt(pos.clone().add(dir));
    this.scene.add(m);
    this.items.push({ m, t: 0, dur, type: 'torus', maxR, dir: dir.clone(), speed, opacity: 0.8 });
  }

  // jagged lightning between two points
  bolt(a, b, color = '#bfe3ff', dur = 0.18, width = 0.06) {
    const grp = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
    this.scene.add(grp);
    const it = { m: grp, t: 0, dur, type: 'bolt', a: a.clone(), b: b.clone(), mat, width, opacity: 1, rebuild: 0 };
    this.buildBolt(it);
    this.items.push(it);
  }
  buildBolt(it) {
    const grp = it.m;
    while (grp.children.length) grp.remove(grp.children[0]);
    const n = Math.max(4, Math.round(it.a.distanceTo(it.b) / 1.2));
    const pts = [];
    const len = it.a.distanceTo(it.b);
    for (let i = 0; i <= n; i++) {
      const p = new V3().lerpVectors(it.a, it.b, i / n);
      if (i > 0 && i < n) p.add(new V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(Math.min(1.2, len * 0.06)));
      pts.push(p);
    }
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(this.unitCyl, it.mat);
      s.position.copy(pts[i]);
      s.lookAt(pts[i + 1]);
      s.scale.set(it.width, it.width, pts[i].distanceTo(pts[i + 1]));
      grp.add(s);
    }
  }

  beam(a, b, color, dur = 0.2, width = 0.12) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const m = new THREE.Mesh(this.unitCyl, mat);
    m.position.copy(a); m.lookAt(b); m.scale.set(width, width, a.distanceTo(b));
    this.scene.add(m);
    this.items.push({ m, t: 0, dur, type: 'beam', opacity: 0.9, width });
  }

  addCustom(obj, dur, update) {
    this.scene.add(obj);
    this.items.push({ m: obj, t: 0, dur, type: 'custom', update });
  }

  update(dt) {
    this.add.update(dt); this.norm.update(dt);
    for (const l of this.lights) {
      const u = l.userData;
      if (u.dur <= 0) continue;
      u.t += dt;
      if (u.follow) l.position.copy(u.follow.position ?? u.follow);
      l.intensity = u.t >= u.dur ? 0 : u.peak * (1 - u.t / u.dur);
      if (u.t >= u.dur) { u.dur = 0; u.follow = null; }
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      const k = Math.min(1, it.t / it.dur);
      if (it.type === 'ring') {
        const s = 0.2 + it.maxR * (1 - Math.pow(1 - k, 3));
        it.m.scale.set(s, s, s);
        it.m.material.opacity = it.opacity * (1 - k);
      } else if (it.type === 'torus') {
        it.m.position.addScaledVector(it.dir, it.speed * dt);
        const s = 0.3 + it.maxR * k;
        it.m.scale.set(s, s, s);
        it.m.material.opacity = it.opacity * (1 - k);
      } else if (it.type === 'bolt') {
        it.rebuild -= dt;
        if (it.rebuild <= 0) { this.buildBolt(it); it.rebuild = 0.05; }
        it.mat.opacity = 1 - k * 0.7;
      } else if (it.type === 'beam') {
        it.m.material.opacity = it.opacity * (1 - k);
        const w = it.width * (1 - k * 0.8);
        it.m.scale.x = it.m.scale.y = w;
      } else if (it.type === 'custom') {
        if (it.update(dt, k, it) === false) it.t = it.dur;
      }
      if (it.t >= it.dur) {
        this.scene.remove(it.m);
        if (it.m.material && it.type !== 'custom') it.m.material.dispose();
        if (it.mat) it.mat.dispose();
        this.items.splice(i, 1);
      }
    }
  }
}

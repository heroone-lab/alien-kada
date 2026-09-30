// Alien powers, projectiles, explosions, telekinesis and tornadoes
import * as THREE from 'three';
import * as T from './textures.js';

const V3 = THREE.Vector3;
const rand = (a, b) => a + Math.random() * (b - a);
const UP = new V3(0, 1, 0);

export class Combat {
  constructor(game) {
    this.game = game;
    this.projectiles = [];
    this.tornados = [];
    this.ray = new THREE.Raycaster();
    this.geo = {
      fire: new THREE.SphereGeometry(0.32, 16, 12),
      shard: new THREE.OctahedronGeometry(0.2, 0).scale(0.6, 0.6, 3),
      rock: new THREE.IcosahedronGeometry(0.8, 1),
    };
    this.mat = {
      fire: new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 2.2, 0.4) }),
      shard: new THREE.MeshStandardMaterial({ color: '#d8f7ff', emissive: '#6fd8ff', emissiveIntensity: 2, roughness: 0.1, flatShading: true }),
      rock: new THREE.MeshStandardMaterial({ color: '#ffffff', map: T.rockTexture('#857b6e'), roughness: 1, flatShading: true }),
    };
    this.swirl = T.swirlTexture();
  }

  // ------------------------------------------------------------ aiming
  aim(maxD = 80) {
    const cam = this.game.camera;
    const origin = cam.position.clone();
    const dir = new V3(); cam.getWorldDirection(dir);
    // aim assist on drones
    let best = null, bestA = 0.14;
    for (const d of this.game.drones.list) {
      if (!d.alive) continue;
      const to = d.pos.clone().sub(origin);
      const dist = to.length();
      if (dist > maxD) continue;
      const a = to.normalize().angleTo(dir);
      if (a < bestA) { bestA = a; best = d; }
    }
    if (best) return { point: best.pos.clone(), drone: best, dir };
    this.ray.set(origin, dir); this.ray.far = maxD;
    const hits = this.ray.intersectObjects([...this.game.world.occluders, this.game.world.groundMesh], false);
    const point = hits.length ? hits[0].point : origin.clone().addScaledVector(dir, maxD);
    return { point, drone: null, dir };
  }

  // ------------------------------------------------------------ power entry
  use(pressedPower, heldPower) {
    const G = this.game, P = G.player, f = P.form;
    if (!f.power || P.transforming || P.dead) return;
    if (!pressedPower) return;
    if (P.cooldown > 0 && f.power !== 'telekinesis') return;
    P.cooldown = f.cd;
    P.attackT = 1;
    P.aimFaceT = 0.6;
    P.pose = f.power === 'slam' ? 'slam' : f.power === 'sonic' || f.power === 'tornado' || f.power === 'boulder' ? 'both' : 'one';
    this[f.power === 'slam' ? 'slamPower' : f.power]();
  }

  // AGNI
  fireball() {
    const G = this.game, P = G.player;
    const from = P.handPos().addScaledVector(G.cam.forward, 0.4);
    const { point } = this.aim();
    const vel = point.sub(from).setLength(42);
    const mesh = new THREE.Mesh(this.geo.fire, this.mat.fire);
    mesh.position.copy(from);
    G.scene.add(mesh);
    const light = G.fx.light(from, '#ff7a1a', 25, 2.5, mesh);
    this.projectiles.push({
      mesh, vel, gravity: 0, life: 2.5, radius: 0.35,
      trail: (p) => G.fx.emit({ pos: p, count: 3, color: ['#ffdd66', '#ff8a1a', '#ff4a00'], spread: 0.8, life: [0.15, 0.35], size: [0.5, 0.9], drag: 2 }),
      onHit: (p) => { light.userData.dur = 0.001; this.explode(p, { radius: 5, force: 15, damage: 34, fire: true }); },
    });
    G.audio.fire();
  }

  // VAJRA
  slamPower() {
    const G = this.game, P = G.player;
    if (!P.onGround) { P.pound = true; P.vel.y = -38; P.vel.x *= 0.3; P.vel.z *= 0.3; G.audio.whoosh(); return; }
    const front = P.pos.clone().add(new V3(Math.sin(P.facing), 0, Math.cos(P.facing)).multiplyScalar(1.2));
    setTimeout(() => this.slamAt(front), 120);
  }
  slamAt(pos, power = 1) {
    const G = this.game;
    const p = pos.clone(); p.y += 0.15;
    G.fx.ring(p, '#fff0d0', 12 * power, 0.55);
    G.fx.ring(p, '#ffb070', 7 * power, 0.4);
    G.fx.dust(p, 70, 2 * power);
    G.fx.debris(p, '#5a5046', 30, 12);
    G.fx.light(p.clone().setY(1), '#ffd8a0', 40, 0.3);
    G.cam.shake(0.9 * power);
    G.audio.slam();
    this.explode(p, { radius: 12 * power, force: 20 * power, lift: 12, damage: 45 * power, quiet: true });
  }
  // called from player landing after ground-pound
  slam(pos, power) { this.slamAt(pos, power); }

  // VEGA
  dash() {
    const G = this.game, P = G.player;
    const f = G.cam.forward;
    P.dashDir.copy(f);
    P.dash = 0.32;
    P.vel.y = Math.max(P.vel.y, 2);
    G.audio.whoosh();
    G.fx.ring(P.pos.clone().setY(P.pos.y + 1), '#18c8ff', 2.5, 0.3, f);
  }

  // HIMA
  ice() {
    const G = this.game, P = G.player;
    const from = P.handPos();
    const { point } = this.aim();
    const base = point.sub(from).normalize();
    for (const off of [-0.06, 0, 0.06]) {
      const dir = base.clone().applyAxisAngle(UP, off);
      const vel = dir.multiplyScalar(50);
      const mesh = new THREE.Mesh(this.geo.shard, this.mat.shard);
      mesh.position.copy(from);
      mesh.lookAt(from.clone().add(vel));
      G.scene.add(mesh);
      this.projectiles.push({
        mesh, vel, gravity: 2, life: 2, radius: 0.25,
        trail: (p) => G.fx.emit({ pos: p, count: 1, color: ['#bff4ff', '#ffffff'], spread: 0.3, life: [0.2, 0.4], size: [0.2, 0.35] }),
        onHit: (p, drone) => {
          G.fx.emit({ pos: p, count: 26, color: ['#bff4ff', '#7fdcff', '#ffffff'], spread: 6, life: [0.3, 0.7], size: [0.15, 0.35], gravity: 8 });
          G.audio.shatter();
          this.explode(p, { radius: 2.5, force: 6, damage: 18, quiet: true, freeze: 3.5 });
          if (drone) { drone.frozen = 3.5; drone.body.emissive.set('#1a6d9a'); }
        },
      });
    }
    G.audio.ice();
  }

  // VIDYUT
  lightning() {
    const G = this.game, P = G.player;
    const from = P.handPos();
    const { point, drone } = this.aim(40);
    const chain = [];
    let cur = drone ?? G.drones.nearest(point, 10);
    const used = new Set();
    let last = from;
    for (let i = 0; i < 4 && cur; i++) {
      used.add(cur); chain.push(cur);
      cur = G.drones.nearest(cur.pos, 14, (d) => !used.has(d));
    }
    if (chain.length) {
      for (const d of chain) {
        G.fx.bolt(last, d.pos, '#fff7b0', 0.22, 0.07);
        G.fx.bolt(last, d.pos, '#ffe24a', 0.18, 0.03);
        G.fx.sparks(d.pos, '#fff38a', 20, 9);
        G.drones.damage(d, 30, new V3(0, 2, 0));
        last = d.pos.clone();
      }
      G.fx.light(chain[0].pos, '#ffe86a', 50, 0.25);
    } else {
      // hit props / ground at aim point
      G.fx.bolt(from, point, '#fff7b0', 0.22, 0.07);
      G.fx.bolt(from, point, '#ffe24a', 0.18, 0.03);
      G.fx.sparks(point, '#fff38a', 30, 10);
      G.fx.light(point, '#ffe86a', 50, 0.25);
      this.explode(point, { radius: 3.5, force: 9, damage: 25, lift: 8, quiet: true });
    }
    G.audio.zap();
    G.cam.shake(0.1);
  }

  // GARUDA
  tornado() {
    const G = this.game, P = G.player;
    const { point } = this.aim(40);
    const pos = point.clone(); pos.y = 0;
    const dist = pos.distanceTo(P.pos.clone().setY(0));
    if (dist < 6 || dist > 32) pos.copy(P.pos).setY(0).addScaledVector(G.cam.forward, Math.max(6, Math.min(32, dist)));
    const grp = new THREE.Group();
    const layers = [];
    for (let i = 0; i < 5; i++) {
      const tx = this.swirl.clone(); tx.needsUpdate = true;
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8 + i * 0.9, 0.4 + i * 0.8, 3, 20, 1, true),
        new THREE.MeshBasicMaterial({ map: tx, color: '#d8d0c0', transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
      );
      m.position.y = 1.5 + i * 2.6;
      grp.add(m); layers.push(m);
    }
    grp.position.copy(pos);
    grp.scale.setScalar(0.1);
    const tor = { grp, pos: grp.position, life: 6, t: 0, dir: G.cam.forward.clone(), layers };
    this.tornados.push(tor);
    G.scene.add(grp);
    G.audio.wind(6);
    G.fx.emit({ pos: P.handPos(), count: 30, additive: false, color: ['#8a6238', '#e8dcc0'], spread: 6, size: [0.1, 0.25], gravity: 3, life: [0.5, 1] });
  }

  // PASHAN
  boulder() {
    const G = this.game, P = G.player;
    const from = P.pos.clone(); from.y += P.height + 0.6;
    const { point } = this.aim(60);
    const d = point.clone().sub(from);
    const flat = Math.hypot(d.x, d.z);
    const speed = 32;
    const t = Math.max(0.2, flat / speed);
    const vel = new V3(d.x / t, (d.y + 0.5 * 20 * t * t) / t, d.z / t);
    if (vel.length() > 45) vel.setLength(45);
    const mesh = new THREE.Mesh(this.geo.rock, this.mat.rock);
    mesh.castShadow = true;
    mesh.position.copy(from);
    G.scene.add(mesh);
    G.fx.debris(from, '#857b6e', 10, 4);
    this.projectiles.push({
      mesh, vel, gravity: 20, life: 4, radius: 0.8, spin: new V3(rand(-8, 8), rand(-8, 8), rand(-8, 8)),
      trail: (p) => Math.random() < 0.3 && G.fx.emit({ pos: p, count: 1, additive: false, color: '#9c8c72', spread: 0.5, size: [0.4, 0.7], grow: 2, alpha: 0.4, life: [0.5, 1] }),
      onHit: (p) => {
        G.fx.debris(p, '#857b6e', 40, 14); G.fx.dust(p, 50, 1.8);
        G.fx.ring(p.clone().setY(Math.max(0.2, p.y)), '#e0d0b0', 8, 0.45);
        G.cam.shake(0.7); G.audio.explosion(1.2); G.audio.rock();
        this.explode(p, { radius: 7.5, force: 22, damage: 55, lift: 10, quiet: true });
      },
    });
    G.audio.whoosh();
  }

  // CHHAYA - telekinesis grab / throw
  telekinesis() {
    const G = this.game, P = G.player;
    if (P.held) {
      const p = P.held;
      const { point } = this.aim(80);
      const v = point.sub(p.pos).setLength(Math.max(18, 40 / Math.pow(p.mass, 0.25)));
      p.vel.copy(v);
      p.ang.set(rand(-5, 5), rand(-5, 5), rand(-5, 5));
      p.held = false; p.sleep = false; p.thrown = 2;
      P.held = null;
      G.audio.whoosh();
      G.fx.emit({ pos: p.pos, count: 30, color: ['#a070ff', '#e0c8ff'], spread: 5, size: [0.2, 0.4] });
      return;
    }
    const cam = G.camera;
    const dir = new V3(); cam.getWorldDirection(dir);
    let best = null, bestScore = Infinity;
    for (const p of G.world.props) {
      const to = p.pos.clone().sub(cam.position);
      const dist = to.length();
      if (dist > 30) continue;
      const ang = to.normalize().angleTo(dir);
      if (ang > 0.35) continue;
      const score = ang * 30 + dist * 0.3;
      if (score < bestScore) { bestScore = score; best = p; }
    }
    if (!best) {
      // push drones instead
      const d = G.drones.nearest(P.pos, 25);
      if (d) { G.drones.damage(d, 10, dir.clone().multiplyScalar(18)); G.fx.beam(P.handPos(), d.pos, '#a070ff', 0.3, 0.15); }
      else G.ui.toast('Koi cheez nishane pe nahi – crosshair se target karo');
      return;
    }
    best.held = true; best.sleep = false;
    P.held = best;
    G.audio.grab();
    G.fx.beam(P.handPos(), best.pos, '#a070ff', 0.3, 0.2);
  }

  // TARANG
  sonic() {
    const G = this.game, P = G.player;
    const from = P.pos.clone(); from.y += P.height * 0.62;
    const { point } = this.aim(40);
    const dir = point.sub(from).normalize();
    for (let i = 0; i < 4; i++) setTimeout(() => G.fx.torus(from.clone().addScaledVector(dir, 0.6 + i * 0.4), dir, '#35ffe0', 2.5 + i, 0.55, 30), i * 60);
    G.audio.sonic();
    G.cam.shake(0.15);
    const R = 22, cone = 0.55;
    for (const p of G.world.props) {
      const to = p.pos.clone().sub(from); const d = to.length();
      if (d > R || to.normalize().angleTo(dir) > cone) continue;
      const k = 1 - d / R;
      p.vel.addScaledVector(dir, (8 + 22 * k) / Math.sqrt(p.mass)).add(new V3(0, 4 * k / Math.sqrt(p.mass), 0));
      p.ang.set(rand(-4, 4), rand(-4, 4), rand(-4, 4)); p.sleep = false;
    }
    for (const dr of G.drones.list) {
      const to = dr.pos.clone().sub(from); const d = to.length();
      if (d > R || to.normalize().angleTo(dir) > cone) continue;
      G.drones.damage(dr, 26 * (1 - d / R) + 10, dir.clone().multiplyScalar(14));
    }
    G.world.scareCows(from, 14);
  }

  // ANU - shrink ray
  shrink() {
    const G = this.game, P = G.player;
    const from = P.handPos();
    const cam = G.camera;
    const dir = new V3(); cam.getWorldDirection(dir);
    const { point, drone } = this.aim(50);
    let target = drone, tDist = drone ? drone.pos.distanceTo(cam.position) : Infinity;
    // ray-sphere for props
    for (const p of G.world.props) {
      const oc = p.pos.clone().sub(cam.position);
      const t = oc.dot(dir);
      if (t < 0 || t > 50) continue;
      const d2 = oc.lengthSq() - t * t;
      const rr = Math.max(p.radius, p.halfH) * 1.2;
      if (d2 < rr * rr && t < tDist) { tDist = t; target = p; }
    }
    const end = target ? target.pos.clone() : point;
    G.fx.beam(from, end, '#9dff6a', 0.25, 0.08);
    G.fx.beam(from, end, '#ffffff', 0.15, 0.03);
    G.fx.emit({ pos: end, count: 25, color: ['#9dff6a', '#ffffff'], spread: 4, size: [0.1, 0.3], life: [0.3, 0.7] });
    if (!target) { G.audio.shrink(false); return; }
    if (target.hp !== undefined) {
      if (!target.shrunk) {
        target.shrunk = true; target.scale = 0.45; target.obj.scale.setScalar(0.45);
        G.drones.damage(target, 25);
      } else G.drones.damage(target, 15);
      G.audio.shrink(false);
      return;
    }
    const p = target;
    const toSmall = p.scale === 1;
    const s = toSmall ? 0.35 : 1;
    const oldHalf = p.halfH;
    p.scale = s;
    p.radius = p.base.radius * s; p.halfH = p.base.halfH * s; p.mass = p.base.mass * (toSmall ? 0.06 : 1);
    p.obj.scale.setScalar(s);
    p.pos.y += p.halfH - oldHalf;
    G.fx.emit({ pos: p.pos, area: p.radius, count: 30, color: ['#9dff6a', '#ffffff'], spread: 2, size: [0.1, 0.25] });
    p.vel.y += 3; p.sleep = false;
    G.audio.shrink(!toSmall);
  }

  // ------------------------------------------------------------ explosions
  explode(pos, o) {
    const G = this.game;
    const { radius, force, damage = 0, fire = false, quiet = false, freeze = 0 } = o;
    const lift = o.lift ?? force * 0.5;
    if (fire) {
      G.fx.fire(pos, 45, 1.3);
      G.fx.sparks(pos, '#ffcc66', 20, 10);
      G.fx.light(pos, '#ff8a2a', 60, 0.45);
      G.fx.ring(pos.clone().setY(Math.max(0.15, pos.y)), '#ffa040', radius, 0.35);
      G.cam.shake(0.35);
      G.audio.explosion(1);
    }
    for (const p of G.world.props) {
      if (p.held) continue;
      const to = p.pos.clone().sub(pos); const d = to.length();
      if (d > radius) continue;
      const k = 1 - d / radius;
      if (d < 0.01) to.set(0, 1, 0); else to.divideScalar(d);
      const inv = 1 / Math.sqrt(p.mass);
      p.vel.addScaledVector(to, force * k * inv);
      p.vel.y += lift * k * inv;
      p.ang.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(force * k * 0.35 * inv);
      p.sleep = false;
    }
    if (damage > 0 || freeze) {
      for (const d of G.drones.list) {
        const dist = d.pos.distanceTo(pos);
        if (dist > radius + 0.6) continue;
        const k = Math.max(0.35, 1 - dist / radius);
        const push = d.pos.clone().sub(pos).normalize().multiplyScalar(force * 0.5 * k);
        if (freeze) { d.frozen = freeze; d.body.emissive.set('#1a6d9a'); }
        G.drones.damage(d, damage * k, push);
      }
    }
    if (!quiet || force > 10) G.world.scareCows(pos, radius * 2);
  }

  // ------------------------------------------------------------ update
  update(dt) {
    const G = this.game, P = G.player;
    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      pr.vel.y -= pr.gravity * dt;
      const m = pr.mesh;
      const steps = 2;
      let hit = false, hitDrone = null;
      for (let s = 0; s < steps && !hit; s++) {
        m.position.addScaledVector(pr.vel, dt / steps);
        const p = m.position;
        if (pr.life <= 0 || G.world.insideSolid(p) || p.y < G.world.groundAt(p.x, p.z, p.y) + pr.radius * 0.5) hit = true;
        for (const d of G.drones.list) if (d.alive && d.pos.distanceTo(p) < d.radius * d.scale + pr.radius) { hit = true; hitDrone = d; break; }
        if (!hit) for (const pp of G.world.props) {
          if (pp.held) continue;
          const dx = pp.pos.x - p.x, dz = pp.pos.z - p.z, dy = pp.pos.y - p.y;
          if (dx * dx + dz * dz < (pp.radius * 0.8 + pr.radius) ** 2 && Math.abs(dy) < pp.halfH + pr.radius) { hit = true; break; }
        }
      }
      if (pr.spin) { m.rotation.x += pr.spin.x * dt; m.rotation.y += pr.spin.y * dt; m.rotation.z += pr.spin.z * dt; }
      else if (pr.gravity) m.lookAt(m.position.clone().add(pr.vel));
      pr.trail?.(m.position);
      if (hit) {
        pr.onHit(m.position.clone(), hitDrone);
        G.scene.remove(m);
        this.projectiles.splice(i, 1);
      }
    }
    // telekinesis hold
    if (P.held) {
      const p = P.held;
      const tgt = P.pos.clone().addScaledVector(G.cam.forward, 2.5 + p.radius).add(new V3(0, P.height + 0.6 + p.halfH, 0));
      p.pos.lerp(tgt, 1 - Math.exp(-dt * 8));
      p.vel.set(0, 0, 0);
      p.obj.rotation.y += dt * 1.2;
      p.obj.rotation.x += (Math.sin(G.time * 2) * 0.2 - p.obj.rotation.x) * dt * 3;
      if (Math.random() < 0.7) G.fx.emit({ pos: p.pos, area: p.radius, count: 2, color: ['#a070ff', '#e0c8ff'], spread: 0.6, size: [0.2, 0.4], life: [0.3, 0.6] });
      if (P.formId !== 'chhaya') P.releaseHeld();
    }
    // tornados
    for (let i = this.tornados.length - 1; i >= 0; i--) {
      const t = this.tornados[i];
      t.t += dt; t.life -= dt;
      const grow = Math.min(1, t.t * 1.5) * Math.min(1, t.life * 1.2);
      t.grp.scale.setScalar(Math.max(0.05, grow));
      t.pos.addScaledVector(t.dir, dt * 2.5);
      t.pos.x = Math.max(-6, Math.min(6, t.pos.x));
      t.layers.forEach((l, j) => { l.rotation.y += dt * (6 + j); l.material.map.offset.x += dt * (0.8 + j * 0.2); l.position.x = Math.sin(G.time * 3 + j) * 0.3 * j; });
      if (Math.random() < 0.8) G.fx.emit({ pos: t.pos.clone().setY(0.4), area: 2, flat: true, count: 3, additive: false, color: ['#b5a58a', '#9c8c72'], spread: 3, up: 2, size: [0.8, 1.4], grow: 1.5, alpha: 0.45, life: [0.6, 1.2] });
      const R = 10 * grow;
      for (const p of G.world.props) {
        if (p.held) continue;
        const dx = p.pos.x - t.pos.x, dz = p.pos.z - t.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > R) continue;
        const k = 1 - d / R;
        const inv = 1 / Math.pow(p.mass, 0.35);
        const nx = dx / (d || 1), nz = dz / (d || 1);
        p.vel.x += (-nx * 10 + -nz * 22) * k * dt * inv * 3;
        p.vel.z += (-nz * 10 + nx * 22) * k * dt * inv * 3;
        const targetY = 3 + (1 - k) * 8;
        p.vel.y += ((p.pos.y < targetY ? 34 : 18) * k * inv) * dt;
        p.vel.multiplyScalar(Math.exp(-dt * 0.8));
        p.ang.y = 4; p.ang.x += dt * 2;
        p.sleep = false;
      }
      for (const d of G.drones.list) {
        const dx = d.pos.x - t.pos.x, dz = d.pos.z - t.pos.z, dist = Math.hypot(dx, dz);
        if (dist > R) continue;
        d.vel.x += (-dz * 3 - dx) * dt * 2; d.vel.z += (dx * 3 - dz) * dt * 2;
        G.drones.damage(d, 20 * dt);
      }
      G.world.scareCows(t.pos, 12);
      if (t.life <= 0) {
        G.scene.remove(t.grp);
        t.layers.forEach((l) => { l.geometry.dispose(); l.material.map.dispose(); l.material.dispose(); });
        this.tornados.splice(i, 1);
      }
    }
  }
}

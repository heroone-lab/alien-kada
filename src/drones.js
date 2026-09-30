// Hostile hover-drones that attack Arjun in the gali
import * as THREE from 'three';
import { STREET } from './world.js';

const V3 = THREE.Vector3;
const rand = (a, b) => a + Math.random() * (b - a);

export class Drones {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.bolts = [];
    this.kills = 0;
    this.maxAlive = 5;
    this.spawnT = 2;
    this.bodyGeo = new THREE.SphereGeometry(0.45, 20, 14);
    this.ringGeo = new THREE.TorusGeometry(0.62, 0.06, 8, 32);
    this.eyeGeo = new THREE.SphereGeometry(0.14, 12, 8);
    this.armGeo = new THREE.BoxGeometry(1.5, 0.06, 0.12);
    this.rotorGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.02, 12);
    this.boltGeo = new THREE.CapsuleGeometry(0.08, 0.6, 4, 8).rotateX(Math.PI / 2);
    this.boltMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.5, 0.4) });
    for (let i = 0; i < 3; i++) this.spawn(new V3(rand(-3, 3), 5, rand(-80, -40)));
  }

  spawn(pos) {
    const body = new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.3, metalness: 0.85, emissive: '#000' });
    const eyeMat = new THREE.MeshStandardMaterial({ color: '#ff2020', emissive: '#ff2020', emissiveIntensity: 3 });
    const accent = new THREE.MeshStandardMaterial({ color: '#ff5a1f', roughness: 0.4, metalness: 0.5, emissive: '#661400' });
    const g = new THREE.Group();
    const b = new THREE.Mesh(this.bodyGeo, body); b.castShadow = true; g.add(b);
    const eye = new THREE.Mesh(this.eyeGeo, eyeMat); eye.position.z = 0.38; g.add(eye);
    const ring = new THREE.Mesh(this.ringGeo, accent); ring.rotation.x = Math.PI / 2; g.add(ring);
    const arms = new THREE.Group(); g.add(arms);
    for (const r of [0, Math.PI / 2]) { const a = new THREE.Mesh(this.armGeo, body); a.rotation.y = r; a.position.y = 0.2; arms.add(a); }
    const rotors = [];
    for (const [x, z] of [[0.75, 0], [-0.75, 0], [0, 0.75], [0, -0.75]]) { const r = new THREE.Mesh(this.rotorGeo, accent); r.position.set(x, 0.26, z); arms.add(r); rotors.push(r); }
    g.position.copy(pos);
    this.game.scene.add(g);
    const d = { obj: g, pos: g.position, vel: new V3(), hp: 60, maxHp: 60, alive: true, fireT: rand(1.5, 3), orbit: rand(0, 6.28), frozen: 0, shrunk: false, flash: 0, body, eyeMat, ring, arms, radius: 0.7, scale: 1 };
    this.list.push(d);
    return d;
  }

  damage(d, amount, push) {
    if (!d.alive) return;
    d.hp -= amount;
    d.flash = 0.12;
    if (push) d.vel.add(push);
    if (d.hp <= 0) this.kill(d);
  }

  kill(d) {
    const G = this.game;
    d.alive = false;
    G.fx.fire(d.pos, 40, 1.2); G.fx.sparks(d.pos, '#ffcc66', 30, 12); G.fx.debris(d.pos, '#2b2f36', 16, 10);
    G.fx.light(d.pos, '#ff8a2a', 60, 0.4);
    G.fx.ring(d.pos, '#ffaa55', 5, 0.4, new V3(0, 1, 0));
    G.audio.explosion(0.8);
    G.cam.shake(0.3);
    G.scene.remove(d.obj);
    this.kills++;
    G.ui.setScore(this.kills);
    if (this.kills % 5 === 0) G.ui.toast(`Shabash! ${this.kills} drones tode!`);
    if (this.kills % 10 === 0) this.maxAlive = Math.min(9, this.maxAlive + 1);
  }

  nearest(pos, maxD = 1e9, filter) {
    let best = null, bd = maxD;
    for (const d of this.list) {
      if (!d.alive || (filter && !filter(d))) continue;
      const dd = d.pos.distanceTo(pos);
      if (dd < bd) { bd = dd; best = d; }
    }
    return best;
  }

  update(dt) {
    const G = this.game, P = G.player;
    this.list = this.list.filter((d) => d.alive);
    this.spawnT -= dt;
    if (this.list.length < this.maxAlive && this.spawnT <= 0) {
      const end = Math.random() < 0.5 ? STREET.zMin + 10 : STREET.zMax - 10;
      const z = Math.abs(end - P.pos.z) < 30 ? -end * 0.9 : end;
      this.spawn(new V3(rand(-4, 4), rand(8, 12), z));
      this.spawnT = rand(4, 8);
    }
    const t = G.time;
    const target = P.pos.clone(); target.y += P.height * 0.6;
    const hidden = P.dead || P.transforming;
    for (const d of this.list) {
      if (d.flash > 0) { d.flash -= dt; d.body.emissive.set(d.flash > 0 ? '#ffffff' : d.frozen > 0 ? '#1a6d9a' : '#000'); }
      if (d.frozen > 0) {
        d.frozen -= dt;
        if (d.frozen <= 0) { d.body.emissive.set('#000'); G.fx.emit({ pos: d.pos, count: 12, color: '#bff4ff', spread: 3, size: [0.2, 0.3] }); }
        d.vel.y -= 12 * dt;
      } else {
        const dist = d.pos.distanceTo(P.pos);
        const engaged = dist < 45 && !P.dead;
        d.orbit += dt * 0.35;
        const r = 9 + Math.sin(d.orbit * 1.7) * 2;
        const goal = engaged
          ? new V3(P.pos.x + Math.sin(d.orbit) * r, P.pos.y + 4.5 + Math.sin(t * 1.3 + d.orbit) * 1, P.pos.z + Math.cos(d.orbit) * r)
          : new V3(Math.sin(t * 0.3 + d.orbit) * 3, 6 + Math.sin(t + d.orbit), d.pos.z + Math.sin(t * 0.2 + d.orbit) * 0.5);
        goal.x = Math.max(-6.5, Math.min(6.5, goal.x));
        goal.y = Math.max(2.5, Math.min(14, goal.y));
        const acc = goal.sub(d.pos).multiplyScalar(1.6);
        const lim = 10 * (d.shrunk ? 0.7 : 1);
        if (acc.length() > lim) acc.setLength(lim);
        d.vel.addScaledVector(acc, dt);
        d.vel.multiplyScalar(Math.exp(-1.5 * dt));
        // face player
        if (engaged) {
          const yaw = Math.atan2(P.pos.x - d.pos.x, P.pos.z - d.pos.z);
          d.obj.rotation.y = yaw;
          d.fireT -= dt;
          if (d.fireT <= 0 && !hidden) {
            d.fireT = rand(1.8, 3.2);
            this.shoot(d, target);
          }
        }
      }
      d.pos.addScaledVector(d.vel, dt);
      if (d.pos.y < 0.6 * d.scale) { d.pos.y = 0.6 * d.scale; if (d.vel.y < -8) this.damage(d, 15); d.vel.y = Math.abs(d.vel.y) * 0.3; }
      G.world.pushOut(d.pos, 0.7 * d.scale, d.pos.y - 0.5, 0, 1);
      d.pos.z = Math.max(STREET.zMin + 2, Math.min(STREET.zMax - 2, d.pos.z));
      d.obj.rotation.z = Math.max(-0.5, Math.min(0.5, -d.vel.x * 0.05));
      d.obj.rotation.x = Math.max(-0.5, Math.min(0.5, d.vel.z * 0.05));
      d.arms.rotation.y += dt * (d.frozen > 0 ? 0 : 25);
      d.eyeMat.emissiveIntensity = d.fireT < 0.4 ? 8 : 3;
    }
    // enemy bolts
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      const p = b.mesh.position;
      let hit = b.life <= 0 || G.world.insideSolid(p);
      const pc = P.pos.clone(); pc.y += P.height * 0.5;
      if (!hit && !P.dead && p.distanceTo(pc) < P.form.radius + P.height * 0.35) {
        hit = true;
        P.damage(9, b.vel);
      }
      if (hit) {
        G.fx.sparks(p, '#ff5050', 10, 5);
        G.scene.remove(b.mesh);
        this.bolts.splice(i, 1);
      }
    }
  }

  shoot(d, target) {
    const G = this.game;
    const from = d.pos.clone().add(new V3(0, 0, 0.5).applyEuler(d.obj.rotation));
    const aim = target.clone().add(new V3(rand(-0.6, 0.6), rand(-0.4, 0.4), rand(-0.6, 0.6)));
    const vel = aim.sub(from).setLength(22);
    const m = new THREE.Mesh(this.boltGeo, this.boltMat);
    m.position.copy(from); m.lookAt(from.clone().add(vel));
    G.scene.add(m);
    this.bolts.push({ mesh: m, vel, life: 3 });
    G.fx.glow(from, '#ff3030', 3, 0.8);
    G.audio.laser();
  }
}

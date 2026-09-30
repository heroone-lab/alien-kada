// Arjun + alien forms: movement, collisions, transformation sequence, health, Kada timer
import * as THREE from 'three';
import { FORMS, ALIEN_TIME } from './forms.js';
import { buildAll, animateRig } from './characters.js';
import { lerpAngle } from './world.js';

const V3 = THREE.Vector3;

export class Player {
  constructor(game) {
    this.game = game;
    this.pos = new V3(0, 0.22, 88);
    this.vel = new V3();
    this.facing = Math.PI;
    this.onGround = true;
    this.formId = 'human';
    this.models = buildAll();
    for (const [id, m] of Object.entries(this.models)) {
      m.rig.root.visible = id === 'human';
      m.rig.root.position.copy(this.pos);
      m.rig.root.rotation.y = this.facing;
      game.scene.add(m.rig.root);
    }
    this.hp = 100;
    this.alienTime = 0;
    this.recharge = 0;
    this.transforming = null;
    this.cooldown = 0;
    this.attackT = 0;
    this.pose = null;
    this.phase = 0;
    this.dash = 0;
    this.dashDir = new V3();
    this.flying = false;
    this.pound = false;
    this.usedDouble = false;
    this.lastHurt = 99;
    this.dead = false;
    this.aimFaceT = 0;
    this.landT = 0;
    this.beepT = 0;
    this.time = 0;

    // player glow light (alien aura)
    this.aura = new THREE.PointLight('#ffffff', 0, 8, 1.8);
    game.scene.add(this.aura);

    // transformation rings
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 1.6, 0.45), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.tRings = [0, 1, 2].map(() => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.04, 8, 48), ringMat);
      m.visible = false; game.scene.add(m);
      return m;
    });
  }

  get form() { return FORMS[this.formId]; }
  get model() { return this.models[this.formId]; }
  get height() { return this.model.rig.height * this.model.scale; }
  get visualScale() { return this.model.scale; }
  get isAlien() { return this.formId !== 'human'; }

  handPos() {
    const rig = this.model.rig;
    const arm = rig.arms.find((a) => a.side < 0) ?? rig.arms[0];
    const p = new V3();
    arm.hand.getWorldPosition(p);
    return p;
  }

  // ------------------------------------------------------------ transform
  startTransform(id) {
    const G = this.game;
    if (this.transforming || this.dead || id === this.formId) return false;
    if (id !== 'human' && this.recharge > 0) {
      G.ui.toast(`Kada recharge ho raha hai... ${Math.ceil(this.recharge)}s`);
      G.audio.denied();
      return false;
    }
    this.transforming = { to: id, t: 0, swapped: false, from: this.formId };
    this.releaseHeld();
    if (id === 'human') G.audio.revert(); else G.audio.transform();
    G.ui.flash(id === 'human' ? 0.5 : 1);
    G.fx.light(this.pos.clone().setY(this.pos.y + 1), '#39ff6a', 80, 1.1, this.pos);
    return true;
  }

  revert(timeout = false) {
    if (!this.isAlien) return;
    if (this.startTransform('human')) {
      this.recharge = this.rechargeMax = timeout ? 12 : 4;
      if (timeout) this.game.ui.toast('Kada ka time khatam!');
    }
  }

  updateTransform(dt) {
    const T = this.transforming, G = this.game;
    T.t += dt;
    const center = this.pos.clone(); center.y += 1;
    const cur = this.models[this.formId];
    if (!T.swapped) {
      const k = Math.min(1, T.t / 0.45);
      cur.rig.root.scale.setScalar(cur.scale * (1 - 0.85 * k * k));
      cur.rig.root.rotation.y += dt * 25 * k;
      G.fx.emit({ pos: center, count: 6, color: ['#39ff6a', '#b6ff9c', '#ffffff'], spread: 2.5, area: 0.6, life: [0.3, 0.6], size: [0.15, 0.35], drag: 2 });
      if (T.t >= 0.45) {
        T.swapped = true;
        cur.rig.root.visible = false;
        cur.rig.root.scale.setScalar(cur.scale);
        this.formId = T.to;
        const nm = this.models[this.formId];
        nm.rig.root.visible = true;
        nm.rig.root.scale.setScalar(0.05);
        G.fx.emit({ pos: center, count: 90, color: ['#39ff6a', '#b6ff9c', '#ffffff'], spread: 9, life: [0.4, 0.9], size: [0.2, 0.5], drag: 3 });
        G.fx.ring(this.pos.clone().setY(this.pos.y + 0.1), '#39ff6a', 7, 0.6);
        G.cam.shake(0.25);
        G.ui.setForm(this.form, this.formId);
        // clear space for big aliens
        G.combat.explode(this.pos.clone().setY(this.pos.y + 0.5), { radius: 2 + this.form.radius * 2, force: 6, damage: 0, lift: 3, quiet: true });
      }
    } else {
      const nm = this.model;
      const k = Math.min(1, (T.t - 0.45) / 0.55);
      const back = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
      nm.rig.root.scale.setScalar(nm.scale * Math.max(0.05, back));
      nm.rig.root.rotation.y += dt * 18 * (1 - k);
      if (k >= 1) {
        nm.rig.root.scale.setScalar(nm.scale);
        this.transforming = null;
        if (this.isAlien) { this.alienTime = ALIEN_TIME; this.hp = Math.max(this.hp, 100); }
        this.usedDouble = false;
      }
    }
    // spinning DNA rings
    this.tRings.forEach((r, i) => {
      r.visible = true;
      const a = T.t * 8 + i * 2.1;
      r.position.set(this.pos.x, this.pos.y + 0.3 + ((T.t * 2.2 + i * 0.33) % 1) * 2.4 * Math.max(1, this.visualScale), this.pos.z);
      r.rotation.set(Math.PI / 2 + Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3);
      r.scale.setScalar(Math.max(1, this.visualScale) * (1.1 + Math.sin(T.t * 10 + i) * 0.15));
    });
    if (!this.transforming) this.tRings.forEach((r) => (r.visible = false));
  }

  // ------------------------------------------------------------ health
  damage(amount, push) {
    if (this.dead || this.transforming) return;
    const G = this.game;
    this.hp -= amount * this.form.armor;
    this.lastHurt = 0;
    G.ui.hurt();
    G.audio.hurt();
    if (push && this.form.mass < 3) this.vel.addScaledVector(push.clone().setY(0).normalize(), 3);
    if (this.hp <= 0) {
      if (this.isAlien) {
        this.hp = 35;
        this.revert(true);
        G.ui.toast('Alien form toot gaya! Wapas Arjun');
      } else {
        this.dead = true;
        this.hp = 0;
        G.ui.toast('Arjun behosh ho gaya... 3s me wapas');
        setTimeout(() => this.respawn(), 3000);
      }
    }
  }
  respawn() {
    this.dead = false; this.hp = 100;
    this.pos.set(0, 0.22, 88); this.vel.set(0, 0, 0);
    this.model.rig.root.rotation.set(0, Math.PI, 0);
    this.facing = Math.PI;
  }

  releaseHeld() { if (this.held) { this.held.held = false; this.held.sleep = false; this.held = null; } }

  // ------------------------------------------------------------ update
  update(dt, input, pressed) {
    const G = this.game, W = G.world;
    this.time += dt;
    this.lastHurt += dt;
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.recharge > 0) this.recharge = Math.max(0, this.recharge - dt);
    if (this.lastHurt > 4 && this.hp < 100 && !this.dead) this.hp = Math.min(100, this.hp + dt * 4);

    if (this.isAlien && !this.transforming) {
      this.alienTime -= dt;
      if (this.alienTime < 10) {
        this.beepT -= dt;
        if (this.beepT <= 0) { G.audio.beep(); this.beepT = this.alienTime < 4 ? 0.4 : 1; }
      }
      if (this.alienTime <= 0) this.revert(true);
    }
    if (this.transforming) this.updateTransform(dt);

    const f = this.form;
    const mv = this.dead || this.transforming ? { x: 0, y: 0, mag: 0 } : input.move;
    const yaw = G.cam.yaw;
    const fwd = new V3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new V3(Math.cos(yaw), 0, -Math.sin(yaw));
    const dir = fwd.clone().multiplyScalar(mv.y).addScaledVector(right, mv.x);
    const sprint = input.sprint && mv.mag > 0.2;
    const maxSp = (sprint ? f.sprint : f.speed) * Math.min(1, mv.mag * 1.2);
    const tv = dir.lengthSq() > 0 ? dir.normalize().multiplyScalar(maxSp) : new V3();
    const airborne = !this.onGround;
    const accel = (!airborne || this.flying || f.float) ? (f.mass > 5 ? 9 : 14) : 4;
    const ka = 1 - Math.exp(-accel * dt);
    this.vel.x += (tv.x - this.vel.x) * ka;
    this.vel.z += (tv.z - this.vel.z) * ka;

    // jump / flight / float
    if (!this.dead && !this.transforming && pressed.has('jump')) {
      if (this.onGround && !f.float) {
        this.vel.y = f.jump; this.onGround = false; G.audio.jump();
        if (f.mass > 5) { G.fx.dust(this.pos, 12, 1.5); }
      } else if (f.fly && !this.flying) {
        this.flying = true; this.vel.y = Math.max(this.vel.y, 6);
        G.fx.emit({ pos: this.pos.clone().setY(this.pos.y + 1), count: 20, additive: false, color: ['#8a6238', '#e8dcc0'], spread: 4, size: [0.1, 0.2], gravity: 3, life: [0.5, 1] });
      } else if (f.doubleJump && !this.usedDouble && airborne) {
        this.usedDouble = true; this.vel.y = f.jump * 0.85;
        G.fx.emit({ pos: this.pos, count: 16, color: '#9dff6a', spread: 3, size: [0.1, 0.2] });
      }
    }
    if (this.flying) {
      const up = input.jumpHeld ? 9 : -2.2;
      this.vel.y += (up - this.vel.y) * (1 - Math.exp(-3 * dt));
    } else if (f.float) {
      const up = input.jumpHeld ? 5 : -3;
      this.vel.y += (up - this.vel.y) * (1 - Math.exp(-3 * dt));
    } else {
      this.vel.y -= f.gravity * dt;
    }
    if (this.dash > 0) {
      this.dash -= dt;
      this.vel.x = this.dashDir.x * 48; this.vel.z = this.dashDir.z * 48;
      this.vel.y = Math.max(this.vel.y, 0);
      G.fx.emit({ pos: this.pos.clone().setY(this.pos.y + 0.9), count: 8, color: ['#18c8ff', '#bff4ff'], spread: 0.6, area: 0.4, life: [0.2, 0.45], size: [0.3, 0.6], drag: 4 });
      G.cam.fovKick = 14;
    } else G.cam.fovKick = sprint && f.sprint > 15 ? 10 : 0;

    // integrate
    const prevY = this.pos.y;
    this.pos.addScaledVector(this.vel, dt);
    if (this.pos.y > 45) { this.pos.y = 45; this.vel.y = Math.min(0, this.vel.y); }
    const r = f.radius;
    const hit = W.pushOut(this.pos, r, this.pos.y, 0.45, this.height);
    if (hit && this.dash > 0) {
      this.dash = 0; G.cam.shake(0.4); G.fx.dust(this.pos.clone().setY(this.pos.y + 1), 20); G.audio.thud(1);
    }
    const hover = f.float ? 0.35 + Math.sin(this.time * 2.2) * 0.08 : 0;
    const ground = W.groundAt(this.pos.x, this.pos.z, Math.max(this.pos.y, prevY));
    if (this.pos.y <= ground + hover) {
      const impact = -this.vel.y;
      if (airborne && impact > 12) this.land(impact);
      this.pos.y = ground + hover;
      if (this.vel.y < 0) this.vel.y = 0;
      this.onGround = true;
      this.flying = false;
      this.usedDouble = false;
    } else {
      this.onGround = this.pos.y - (ground + hover) < 0.08 && this.vel.y <= 0.01;
    }

    // props & cows collision
    if (!this.dead) this.collideProps(dt);

    // facing
    const hs = Math.hypot(this.vel.x, this.vel.z);
    this.aimFaceT -= dt;
    let targetFacing = this.facing;
    if (this.aimFaceT > 0 || this.held) targetFacing = Math.atan2(fwd.x, fwd.z);
    else if (hs > 0.4 && mv.mag > 0.05) targetFacing = Math.atan2(this.vel.x, this.vel.z);
    else if (this.dash > 0) targetFacing = Math.atan2(this.dashDir.x, this.dashDir.z);
    this.facing = lerpAngle(this.facing, targetFacing, dt * 12);

    // animation
    const m = this.model;
    const rig = m.rig;
    rig.root.position.copy(this.pos);
    if (!this.transforming) rig.root.rotation.set(0, this.facing, 0);
    if (this.dead) { rig.root.rotation.x = -Math.PI / 2; rig.root.position.y += 0.15; }
    const stride = 0.55 * Math.max(0.6, m.scale);
    this.phase += (hs * dt) / stride;
    if (this.attackT > 0) this.attackT -= dt * 3;
    if (this.landT > 0) this.landT -= dt * 4;
    const st = {
      phase: this.phase, speedN: hs / f.speed, air: !this.onGround && !f.float, fly: this.flying, dash: this.dash > 0,
      attack: this.attackT, pose: this.pose, t: this.time, land: Math.max(0, this.landT), hold: !!this.held, aimPitch: -G.cam.pitch,
    };
    animateRig(rig, st, dt);
    m.update?.(this.time, dt, st);

    // aura light + idle particles
    const L = m.light;
    this.aura.position.set(this.pos.x, this.pos.y + this.height * 0.6, this.pos.z);
    this.aura.color.set(L?.color ?? '#ffffff');
    this.aura.intensity += ((L && !this.transforming ? L.intensity : 0) - this.aura.intensity) * Math.min(1, dt * 5);
    if (this.formId === 'agni' && Math.random() < 0.6) {
      const hp = this.handPos();
      G.fx.emit({ pos: hp, count: 1, color: ['#ffb040', '#ff6a00'], spread: 0.5, life: [0.2, 0.4], size: [0.15, 0.3], gravity: -3 });
      G.fx.emit({ pos: this.pos.clone().setY(this.pos.y + this.height * 0.95), count: 1, color: ['#ffdd66', '#ff6a00'], spread: 0.6, life: [0.2, 0.5], size: [0.2, 0.4], gravity: -4 });
    }
    if (m.sparky && Math.random() < 0.3) {
      const p = this.pos.clone().add(new V3((Math.random() - 0.5) * 0.8, Math.random() * this.height, (Math.random() - 0.5) * 0.8));
      G.fx.sparks(p, '#fff38a', 2, 3);
    }
    if (this.formId === 'chhaya' && Math.random() < 0.4) G.fx.emit({ pos: this.pos.clone().setY(this.pos.y + 0.3), count: 1, additive: false, color: ['#2a1540', '#4a2a70'], spread: 0.4, life: [0.6, 1.2], size: [0.4, 0.7], grow: 2, alpha: 0.4, gravity: -0.5 });
    if (this.isAlien && this.alienTime < 10 && !this.transforming) {
      G.ui.kadaBlink(Math.sin(this.time * (this.alienTime < 4 ? 20 : 8)) > 0);
    }
    // kada glow on human
    const kg = this.models.human.rig.kadaGlow;
    kg.material.emissive.set(this.recharge > 0 ? '#ff2a2a' : '#39ff6a');
    kg.material.emissiveIntensity = 1.5 + Math.sin(this.time * 4) * 0.8;
  }

  land(impact) {
    const G = this.game, f = this.form;
    this.landT = Math.min(1, impact / 25);
    if (this.pound) {
      this.pound = false;
      G.combat.slam(this.pos.clone(), 1.5);
      return;
    }
    if (f.mass > 5) {
      G.cam.shake(Math.min(0.8, impact / 30));
      G.fx.dust(this.pos, 30, 1.6);
      G.fx.ring(this.pos.clone().setY(this.pos.y + 0.1), '#d8c8a8', 4, 0.4);
      G.combat.explode(this.pos.clone(), { radius: 4, force: impact * 0.4, damage: 0, lift: 4, quiet: true });
      G.audio.thud(1);
    } else if (impact > 18) {
      G.fx.dust(this.pos, 10);
    }
  }

  collideProps(dt) {
    const G = this.game, f = this.form;
    const r = f.radius;
    const h = this.height;
    const dashing = this.dash > 0;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    for (const p of G.world.props) {
      if (p.held) continue;
      if (f.phase) continue;
      const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
      const rr = r + p.radius * 0.8;
      const d2 = dx * dx + dz * dz;
      if (d2 > rr * rr) continue;
      if (p.pos.y - p.halfH > this.pos.y + h || p.pos.y + p.halfH < this.pos.y + 0.3) continue;
      const d = Math.sqrt(d2) || 0.01, nx = dx / d, nz = dz / d, pen = rr - d;
      const wp = f.mass / (f.mass + p.mass);
      p.pos.x += nx * pen * wp; p.pos.z += nz * pen * wp;
      this.pos.x -= nx * pen * (1 - wp); this.pos.z -= nz * pen * (1 - wp);
      if (dashing || (f.mass > 5 && hs > 3)) {
        const force = dashing ? 26 : hs * 1.2;
        p.vel.x += (nx * force + this.vel.x * 0.4) / Math.sqrt(p.mass);
        p.vel.z += (nz * force + this.vel.z * 0.4) / Math.sqrt(p.mass);
        p.vel.y += (dashing ? 9 : 3) / Math.sqrt(p.mass);
        p.ang.set(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3);
        p.sleep = false;
        if (dashing) { G.cam.shake(0.25); G.audio.thud(0.8); G.fx.sparks(p.pos, '#bff4ff', 12, 8); }
      } else if (hs > 0.5) {
        p.vel.x += nx * hs * 0.5 * wp; p.vel.z += nz * hs * 0.5 * wp; p.sleep = false;
      }
    }
    if (dashing) {
      for (const d of G.drones.list) if (d.alive && d.pos.distanceTo(this.pos.clone().setY(this.pos.y + 1)) < 1.8) G.drones.damage(d, 45, this.dashDir.clone().multiplyScalar(15));
    }
    for (const c of G.world.cows) {
      const dx = this.pos.x - c.pos.x, dz = this.pos.z - c.pos.z;
      const d = Math.hypot(dx, dz), rr = r + 0.9;
      if (d < rr && this.pos.y < 1.8 && !f.phase) {
        this.pos.x += (dx / (d || 1)) * (rr - d); this.pos.z += (dz / (d || 1)) * (rr - d);
        if (dashing) { this.dash = 0; G.audio.moo(c.pos, this.pos); }
      }
    }
  }
}

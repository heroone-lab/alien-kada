// HUD, Kada button, alien selection wheel (with 3D-rendered portraits), toasts & flashes
import * as THREE from 'three';
import { FORMS, ALIEN_ORDER, ALIEN_TIME } from './forms.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(game) {
    this.game = game;
    this.el = {
      hud: $('hud'), formName: $('formName'), powerName: $('powerName'), hp: $('hpFill'), alienWrap: $('alienBarWrap'),
      alien: $('alienFill'), score: $('score'), cross: $('crosshair'), toast: $('toast'), wheel: $('wheel'),
      wheelInner: $('wheelInner'), wheelTitle: $('wheelTitle'), wheelDesc: $('wheelDesc'), flash: $('flash'), hurt: $('hurt'),
      kada: $('kadaBtn'), ring: $('kadaRing'),
    };
    this.wheelOpen = false;
    this.toastT = 0;
    this.flashV = 0;
    this.sel = -1;
    if (game.input.isTouch) document.body.classList.add('touch');
  }

  // Render each character into a portrait image for the wheel
  makePortraits(renderer) {
    const size = 160;
    const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ddffdd', '#223322', 1.5));
    const key = new THREE.DirectionalLight('#ffffff', 3); key.position.set(2, 3, 4); scene.add(key);
    const rim = new THREE.DirectionalLight('#39ff6a', 4); rim.position.set(-3, 2, -3); scene.add(rim);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    const buf = new Uint8Array(size * size * 4);
    const cvs = document.createElement('canvas'); cvs.width = cvs.height = size;
    const ctx = cvs.getContext('2d');
    const out = {};
    const models = this.game.player.models;
    const prevTarget = renderer.getRenderTarget();
    const prevClear = renderer.getClearColor(new THREE.Color()); const prevAlpha = renderer.getClearAlpha();
    renderer.setClearColor('#000000', 0);
    for (const id of ALIEN_ORDER) {
      const m = models[id];
      const root = m.rig.root;
      const parent = root.parent, vis = root.visible;
      const pos = root.position.clone(), rot = root.rotation.clone();
      scene.add(root); root.visible = true; root.position.set(0, 0, 0); root.rotation.set(0, 0.45, 0);
      const h = m.rig.height * m.scale;
      cam.position.set(0, h * 0.62, h * 2.3 + 0.8);
      cam.lookAt(0, h * 0.55, 0);
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
      const img = ctx.createImageData(size, size);
      for (let y = 0; y < size; y++) img.data.set(buf.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
      ctx.clearRect(0, 0, size, size);
      ctx.putImageData(img, 0, 0);
      out[id] = cvs.toDataURL();
      parent.add(root); root.visible = vis; root.position.copy(pos); root.rotation.copy(rot);
    }
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevClear, prevAlpha);
    rt.dispose();
    this.buildWheel(out);
  }

  buildWheel(portraits) {
    const inner = this.el.wheelInner;
    inner.innerHTML = '';
    ALIEN_ORDER.forEach((id, i) => {
      const f = FORMS[id];
      const a = (i / ALIEN_ORDER.length) * Math.PI * 2 - Math.PI / 2;
      const b = document.createElement('button');
      b.className = 'alienBtn';
      b.style.left = `${50 + Math.cos(a) * 38}%`;
      b.style.top = `${50 + Math.sin(a) * 38}%`;
      b.style.backgroundImage = `radial-gradient(circle, ${f.color}33, #071207 70%), none`;
      if (portraits?.[id]) b.style.backgroundImage = `url(${portraits[id]}), radial-gradient(circle, ${f.color}55, #071207 70%)`;
      b.innerHTML = `<span class="num">${(i + 1) % 10}</span>${f.name}`;
      const show = () => { this.el.wheelTitle.textContent = f.name; this.el.wheelTitle.style.color = f.color; this.el.wheelDesc.textContent = `${f.title} · ${f.powerName}`; };
      b.addEventListener('pointerenter', show);
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); show(); this.pick(id); });
      inner.appendChild(b);
    });
    this.el.wheel.addEventListener('pointerdown', (e) => { if (e.target === this.el.wheel || e.target === inner) this.closeWheel(); });
  }

  openWheel() {
    const P = this.game.player;
    if (P.transforming || P.dead) return;
    if (P.recharge > 0) { this.toast(`Kada recharge ho raha hai... ${Math.ceil(P.recharge)}s`); this.game.audio.denied(); return; }
    this.wheelOpen = true;
    this.el.wheel.classList.remove('hidden');
    this.el.wheelTitle.textContent = 'Alien chuno'; this.el.wheelTitle.style.color = '';
    this.el.wheelDesc.textContent = this.game.input.isTouch ? 'Kisi alien pe tap karo' : 'Click karo ya 1-0 dabao · Q/Esc band';
    if (document.pointerLockElement) document.exitPointerLock();
    this.game.audio.open();
  }
  closeWheel() {
    this.wheelOpen = false;
    this.el.wheel.classList.add('hidden');
    if (!this.game.input.isTouch) this.game.canvas.requestPointerLock?.();
  }
  pick(id) {
    this.closeWheel();
    this.game.player.startTransform(id);
  }

  setForm(f, id) {
    this.el.formName.textContent = f.name;
    this.el.formName.style.color = f.color;
    this.el.powerName.textContent = id === 'human' ? FORMS.human.powerName : `${f.title} · ${f.powerName}`;
    this.el.cross.classList.toggle('on', id !== 'human');
    this.el.alienWrap.classList.toggle('hidden', id === 'human');
    document.getElementById('formBadge').style.borderLeftColor = f.color;
  }
  setScore(n) { this.el.score.textContent = `Drones tode: ${n}`; }

  toast(msg, dur = 2.2) {
    this.el.toast.textContent = msg;
    this.el.toast.classList.add('on');
    this.toastT = dur;
  }
  flash(v = 1) { this.flashV = v; }
  hurt() { this.el.hurt.style.opacity = 1; clearTimeout(this._h); this._h = setTimeout(() => (this.el.hurt.style.opacity = 0), 180); }
  kadaBlink(on) { this.el.kada.style.opacity = on ? 1 : 0.55; }

  update(dt) {
    const P = this.game.player;
    this.el.hp.style.width = `${Math.max(0, P.hp)}%`;
    if (P.isAlien) this.el.alien.style.width = `${Math.max(0, (P.alienTime / ALIEN_TIME) * 100)}%`;
    const C = 276.5;
    let frac = 1;
    if (P.recharge > 0) frac = 1 - P.recharge / (P.rechargeMax || 12);
    else if (P.isAlien) frac = P.alienTime / ALIEN_TIME;
    this.el.ring.style.strokeDashoffset = `${C * (1 - Math.max(0, Math.min(1, frac)))}`;
    this.el.kada.classList.toggle('recharge', P.recharge > 0);
    this.el.kada.classList.toggle('alien', P.isAlien);
    if (!P.isAlien || P.alienTime >= 10) this.el.kada.style.opacity = 1;
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.el.toast.classList.remove('on'); }
    if (this.flashV > 0) { this.flashV = Math.max(0, this.flashV - dt * 1.8); this.el.flash.style.opacity = this.flashV; }
  }
}

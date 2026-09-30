// Alien Kada: Gali No. 10 — bootstrap, renderer, lighting, game loop
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { World } from './world.js';
import { Effects } from './effects.js';
import { Player } from './player.js';
import { Combat } from './combat.js';
import { Drones } from './drones.js';
import { CameraRig } from './camera.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Sfx } from './audio.js';
import { ALIEN_ORDER, FORMS } from './forms.js';
import '@fontsource/noto-sans-devanagari/devanagari-700.css';

const canvas = document.getElementById('game');
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
let quality = localStorage.getItem('ak_quality') || (isTouch ? 'low' : 'high');

const game = { canvas, time: 0, timeScale: 1, running: false };
window.__game = game;

function setup() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality === 'high' ? 2 : 1.25));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = quality === 'high' ? THREE.PCFShadowMap : THREE.BasicShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  game.renderer = renderer;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#c9c0ae', 0.006);
  game.scene = scene;

  const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 1500);
  game.camera = camera;

  // Sky + sun
  const sky = new Sky();
  sky.scale.setScalar(1000);
  const u = sky.material.uniforms;
  u.turbidity.value = 8; u.rayleigh.value = 1.6; u.mieCoefficient.value = 0.006; u.mieDirectionalG.value = 0.85;
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(52), THREE.MathUtils.degToRad(-35));
  u.sunPosition.value.copy(sunDir);
  scene.add(sky);

  // environment lighting from the sky
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const sky2 = new Sky(); sky2.scale.setScalar(1000);
  Object.keys(u).forEach((k) => { if (sky2.material.uniforms[k]) sky2.material.uniforms[k].value = u[k].value; });
  envScene.add(sky2);
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  scene.environmentIntensity = 0.12;

  const hemi = new THREE.HemisphereLight('#cfe0ff', '#8a7358', 0.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0d8', 2.6);
  sun.castShadow = true;
  const sm = quality === 'high' ? 2048 : 1024;
  sun.shadow.mapSize.set(sm, sm);
  const S = quality === 'high' ? 45 : 32;
  Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 200 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(sun); scene.add(sun.target);
  game.sun = sun; game.sunDir = sunDir;

  // post
  if (quality === 'high') {
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.35, 0.45, 1.0));
    composer.addPass(new OutputPass());
    game.composer = composer;
  }

  game.audio = new Sfx();
  game.input = new Input(canvas);
  game.fx = new Effects(scene, quality);
  game.world = new World(scene, quality);
  game.cam = new CameraRig(camera, game.world);
  game.combat = new Combat(game);
  game.player = new Player(game);
  game.ui = new UI(game);
  game.drones = new Drones(game);
  game.ui.makePortraits(renderer);
  game.ui.setForm(FORMS.human, 'human');

  // pre-compile shaders to avoid hitches on first transform
  for (const m of Object.values(game.player.models)) m.rig.root.visible = true;
  renderer.compile(scene, camera);
  for (const [id, m] of Object.entries(game.player.models)) m.rig.root.visible = id === 'human';

  onResize();
  addEventListener('resize', onResize);
}

function onResize() {
  const { renderer, camera, composer, fx } = game;
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  composer?.setSize(innerWidth, innerHeight);
  fx.setScale(innerHeight * renderer.getPixelRatio() * 0.6);
}

const clock = new THREE.Timer();
function loop() {
  requestAnimationFrame(loop);
  clock.update();
  const raw = Math.min(clock.getDelta(), 0.05);
  const { input, player, ui, cam } = game;
  game.timeScale += ((ui.wheelOpen ? 0.12 : 1) - game.timeScale) * Math.min(1, raw * 10);
  const dt = raw * game.timeScale;
  game.time += dt;

  if (game.running) {
    const pressed = input.consumePressed();
    const look = input.consumeLook();
    if (!ui.wheelOpen) cam.addLook(look.dx, look.dy, input.sens);

    if (pressed.has('omni')) { ui.wheelOpen ? ui.closeWheel() : ui.openWheel(); }
    if (pressed.has('escape') && ui.wheelOpen) ui.closeWheel();
    for (let i = 0; i < 10; i++) if (pressed.has('form' + i)) { if (ui.wheelOpen) ui.closeWheel(); player.startTransform(ALIEN_ORDER[i]); }
    if (pressed.has('revert')) player.revert(false);

    player.update(dt, input, ui.wheelOpen ? new Set() : pressed);
    if (!ui.wheelOpen) game.combat.use(pressed.has('power'), input.powerHeld);
    game.combat.update(dt);
    game.world.update(dt, game);
    game.drones.update(dt);
    game.audio.ambient(dt);
  }
  game.fx.update(dt);
  cam.update(raw, player);
  ui.update(raw);

  // keep shadow camera around the player
  const p = player.pos;
  game.sun.position.set(p.x + game.sunDir.x * 80, p.y + game.sunDir.y * 80, p.z + game.sunDir.z * 80);
  game.sun.target.position.copy(p);

  if (game.composer) game.composer.render(); else game.renderer.render(game.scene, game.camera);
}

// ---------------------------------------------------------------- UI wiring
const playBtn = document.getElementById('playBtn');
const qBtn = document.getElementById('btnQuality');
qBtn.textContent = quality === 'high' ? 'HD' : 'LITE';
qBtn.addEventListener('click', () => {
  localStorage.setItem('ak_quality', quality === 'high' ? 'low' : 'high');
  location.reload();
});
document.getElementById('btnFull').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {});
});
document.getElementById('btnHelp').addEventListener('click', () => {
  game.running = false;
  document.getElementById('start').classList.remove('hidden');
  playBtn.textContent = 'WAPAS KHELO';
  if (document.pointerLockElement) document.exitPointerLock();
});

playBtn.addEventListener('click', async () => {
  game.audio.init();
  document.getElementById('start').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  game.input.enabled = true;
  game.running = true;
  if (isTouch) {
    try { await document.documentElement.requestFullscreen?.(); await screen.orientation?.lock?.('landscape'); } catch { /* optional */ }
  } else canvas.requestPointerLock?.();
  if (!game.started) { game.started = true; setTimeout(() => game.ui.toast('Gali No. 10 me swagat hai! Kada dabao!'), 400); }
});

const fontReady = Promise.race([document.fonts.load('bold 52px "Noto Sans Devanagari"', 'गली'), new Promise((r) => setTimeout(r, 3000))]);
fontReady.then(() => setTimeout(() => {
  try {
    setup();
    playBtn.disabled = false;
    playBtn.textContent = 'KHELO ▶';
    loop();
  } catch (e) {
    console.error(e);
    playBtn.textContent = 'Error: ' + e.message;
  }
}, 30));

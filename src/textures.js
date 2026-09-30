// Procedural canvas textures: asphalt, pavers, plaster facades, shop signs, shutters...
import * as THREE from 'three';

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c, g: c.getContext('2d', { willReadFrequently: true }) };
}

export function tex(c, rx = 1, ry = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  return t;
}

export function noise(g, w, h, amt) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amt;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
}

export function grime(g, w, h, n, rgb = '40,30,20', aMin = 0.05, aMax = 0.18) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = rand(w * 0.05, w * 0.3);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${rand(aMin, aMax)})`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
}

function cracks(g, w, h, n, color = 'rgba(15,15,15,0.55)') {
  g.strokeStyle = color;
  for (let i = 0; i < n; i++) {
    let x = Math.random() * w, y = Math.random() * h;
    g.lineWidth = rand(0.6, 1.6);
    g.beginPath(); g.moveTo(x, y);
    const steps = 6 + (Math.random() * 10) | 0;
    let a = Math.random() * Math.PI * 2;
    for (let s = 0; s < steps; s++) {
      a += rand(-0.8, 0.8);
      x += Math.cos(a) * rand(4, 14); y += Math.sin(a) * rand(4, 14);
      g.lineTo(x, y);
    }
    g.stroke();
  }
}

export function roadTexture() {
  const S = 512;
  const { c, g } = canvas(S, S);
  g.fillStyle = '#4a4a4d'; g.fillRect(0, 0, S, S);
  noise(g, S, S, 46);
  for (let i = 0; i < 5000; i++) {
    const v = (Math.random() * 120 + 40) | 0;
    g.fillStyle = `rgba(${v},${v},${v},${rand(0.2, 0.6)})`;
    g.fillRect(Math.random() * S, Math.random() * S, 1.5, 1.5);
  }
  grime(g, S, S, 30, '18,18,18', 0.08, 0.25);
  // repaired patches
  for (let i = 0; i < 4; i++) {
    g.save(); g.translate(Math.random() * S, Math.random() * S); g.rotate(rand(-0.3, 0.3));
    g.fillStyle = 'rgba(28,28,30,0.55)'; g.fillRect(-rand(20, 60), -rand(20, 60), rand(40, 120), rand(40, 120));
    g.restore();
  }
  // oil stains
  grime(g, S, S, 8, '5,5,8', 0.15, 0.35);
  cracks(g, S, S, 14);
  // center dashed line (worn)
  g.fillStyle = 'rgba(235,235,225,0.8)';
  g.fillRect(250, 30, 10, 190); g.fillRect(250, 286, 10, 190);
  // edge lines (yellow)
  g.fillStyle = 'rgba(220,180,40,0.55)';
  g.fillRect(22, 0, 8, S); g.fillRect(S - 30, 0, 8, S);
  // wear on markings
  for (let i = 0; i < 1500; i++) {
    g.fillStyle = `rgba(70,70,72,${rand(0.3, 0.9)})`;
    const x = pick([250, 22, S - 30]) + rand(-2, 10);
    g.fillRect(x, Math.random() * S, rand(1, 4), rand(1, 4));
  }
  // dust near edges
  const gr = g.createLinearGradient(0, 0, S, 0);
  gr.addColorStop(0, 'rgba(150,125,90,0.45)'); gr.addColorStop(0.1, 'rgba(150,125,90,0)');
  gr.addColorStop(0.9, 'rgba(150,125,90,0)'); gr.addColorStop(1, 'rgba(150,125,90,0.45)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return tex(c);
}

export function paverTexture() {
  const S = 256;
  const { c, g } = canvas(S, S);
  g.fillStyle = '#3b3632'; g.fillRect(0, 0, S, S);
  const n = 4, ts = S / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const red = (x + y) % 3 === 0;
      const base = red ? [150, 78, 62] : [150, 145, 138];
      const v = rand(-18, 18);
      g.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`;
      const off = y % 2 ? ts / 2 : 0;
      g.fillRect(((x * ts + off) % S) + 2, y * ts + 2, ts - 4, ts - 4);
      if (off) g.fillRect(-ts / 2 + 2, y * ts + 2, ts - 4, ts - 4);
    }
  }
  noise(g, S, S, 36);
  grime(g, S, S, 14, '40,32,24', 0.1, 0.3);
  cracks(g, S, S, 4);
  return tex(c);
}

export function curbTexture() {
  const { c, g } = canvas(128, 32);
  g.fillStyle = '#111'; g.fillRect(0, 0, 64, 32);
  g.fillStyle = '#e8c330'; g.fillRect(64, 0, 64, 32);
  noise(g, 128, 32, 40);
  grime(g, 128, 32, 8, '30,25,15', 0.2, 0.4);
  return tex(c);
}

export const PALETTE = ['#e8a0a8', '#f2c14e', '#7cc6c0', '#e9874a', '#b6d36b', '#d8d0c0', '#9fb4e0', '#c98fd0', '#f4e3b5', '#e07a6a', '#8fd1a0', '#f0b0d0'];

// One window "bay" (approx 3m x 3m) of a plastered Indian building facade
export function facadeTexture(color) {
  const S = 256;
  const { c, g } = canvas(S, S);
  g.fillStyle = color; g.fillRect(0, 0, S, S);
  noise(g, S, S, 26);
  grime(g, S, S, 8, '60,45,30', 0.05, 0.16);
  // shadow under the chajja (sunshade)
  let gr = g.createLinearGradient(0, 0, 0, 40);
  gr.addColorStop(0, 'rgba(0,0,0,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, 40);
  // window frame
  const frame = pick(['#efeae0', '#6b4a2e', '#3e5a3a', '#d9d4c8', '#2f4f6f']);
  g.fillStyle = frame; g.fillRect(58, 58, 140, 148);
  // glass
  gr = g.createLinearGradient(66, 66, 190, 198);
  gr.addColorStop(0, '#2a3440'); gr.addColorStop(0.45, '#56697a'); gr.addColorStop(0.55, '#8ea3b3'); gr.addColorStop(1, '#1d242c');
  g.fillStyle = gr; g.fillRect(66, 66, 124, 132);
  // curtains
  if (Math.random() < 0.6) {
    g.fillStyle = pick(['rgba(200,60,60,0.8)', 'rgba(230,180,60,0.8)', 'rgba(60,120,190,0.8)', 'rgba(240,240,230,0.85)', 'rgba(120,60,140,0.8)']);
    g.fillRect(66, 66, rand(30, 60), 132);
    if (Math.random() < 0.5) g.fillRect(190 - rand(25, 50), 66, 60, 132);
  }
  // mullion + transom
  g.fillStyle = frame; g.fillRect(125, 66, 6, 132); g.fillRect(66, 110, 124, 5);
  // safety grill
  g.fillStyle = pick(['#2b2b2b', '#1f4a2f', '#5a3a1a', '#3a3a5a']);
  for (let x = 72; x < 190; x += 13) g.fillRect(x, 62, 2.5, 140);
  g.fillRect(62, 150, 132, 3); g.fillRect(62, 90, 132, 3);
  // sill
  g.fillStyle = 'rgba(230,225,215,0.9)'; g.fillRect(52, 206, 152, 8);
  // rain streaks below sill
  for (let i = 0; i < 12; i++) {
    const x = rand(56, 200), len = rand(20, 44);
    gr = g.createLinearGradient(0, 214, 0, 214 + len);
    gr.addColorStop(0, 'rgba(40,35,30,0.35)'); gr.addColorStop(1, 'rgba(40,35,30,0)');
    g.fillStyle = gr; g.fillRect(x, 214, rand(2, 6), len);
  }
  // floor band
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, S - 6, S, 6);
  return tex(c);
}

export function plasterTexture(color, posters = false) {
  const S = 256;
  const { c, g } = canvas(S, S);
  g.fillStyle = color; g.fillRect(0, 0, S, S);
  noise(g, S, S, 30);
  grime(g, S, S, 16, '50,40,30', 0.08, 0.22);
  if (posters) {
    for (let i = 0; i < 4; i++) {
      g.save(); g.translate(rand(20, 230), rand(60, 200)); g.rotate(rand(-0.1, 0.1));
      g.fillStyle = pick(['#f5e04a', '#e94a4a', '#fff', '#4ab0e9', '#f59a2a']);
      g.fillRect(-18, -24, 36, 48);
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(-14, -18, 28, 6); g.fillRect(-14, -6, 22, 3); g.fillRect(-14, 0, 26, 3);
      g.restore();
    }
  }
  // damp bottom
  const gr = g.createLinearGradient(0, S * 0.7, 0, S);
  gr.addColorStop(0, 'rgba(40,35,25,0)'); gr.addColorStop(1, 'rgba(40,35,25,0.45)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return tex(c);
}

export function shutterTexture() {
  const S = 256;
  const { c, g } = canvas(S, S);
  g.fillStyle = '#8b8f93'; g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 8) {
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, y, S, 2);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, y + 6, S, 2);
  }
  noise(g, S, S, 30);
  grime(g, S, S, 14, '110,60,25', 0.1, 0.3);
  // graffiti / painted text
  g.fillStyle = pick(['rgba(200,30,30,0.7)', 'rgba(20,60,160,0.7)', 'rgba(20,20,20,0.6)']);
  g.font = 'bold 34px sans-serif';
  g.fillText(pick(['NO PARKING', 'यहाँ पोस्टर न लगाएँ', '9876XXXXXX', 'CLOSED']), 16, 140);
  g.fillStyle = '#333'; g.fillRect(110, 236, 36, 10);
  return tex(c);
}

export function openShopTexture() {
  const S = 256;
  const { c, g } = canvas(S, S);
  g.fillStyle = '#1e1a16'; g.fillRect(0, 0, S, S);
  const gr = g.createRadialGradient(128, 60, 10, 128, 60, 200);
  gr.addColorStop(0, 'rgba(255,240,200,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  for (let y = 30; y < 200; y += 42) {
    g.fillStyle = '#5a4630'; g.fillRect(8, y + 30, S - 16, 5);
    for (let x = 12; x < S - 16; x += rand(8, 18)) {
      g.fillStyle = `hsl(${rand(0, 360)},${rand(40, 90)}%,${rand(35, 65)}%)`;
      const h = rand(10, 28);
      g.fillRect(x, y + 30 - h, rand(6, 14), h);
    }
  }
  // counter
  g.fillStyle = '#6b4f33'; g.fillRect(0, 205, S, 51);
  g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(0, 205, S, 4);
  noise(g, S, S, 20);
  return tex(c);
}

export function signTexture(hi, en, bg, fg) {
  const W = 512, H = 128;
  const { c, g } = canvas(W, H);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, bg); gr.addColorStop(1, shade(bg, -0.25));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(8, 8, W - 16, H - 16);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 52px "Noto Sans Devanagari", "Mangal", sans-serif';
  g.fillText(hi, W / 2, 50);
  g.font = 'bold 24px sans-serif';
  g.fillText(en, W / 2, 100);
  grime(g, W, H, 10, '30,25,20', 0.05, 0.2);
  noise(g, W, H, 16);
  return tex(c);
}

export function bannerTexture(hi, en, bg) {
  const W = 1024, H = 128;
  const { c, g } = canvas(W, H);
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = '#ffe14a';
  for (let x = 0; x < W; x += 40) { g.beginPath(); g.arc(x + 20, 6, 10, 0, Math.PI); g.fill(); g.beginPath(); g.arc(x + 20, H - 6, 10, Math.PI, 0); g.fill(); }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#fff'; g.font = 'bold 56px "Noto Sans Devanagari", sans-serif';
  g.fillText(hi, W * 0.36, H / 2);
  g.font = 'bold 34px sans-serif'; g.fillStyle = '#ffe14a';
  g.fillText(en, W * 0.8, H / 2);
  noise(g, W, H, 14);
  return tex(c);
}

export function crackEmissiveTexture() {
  const S = 256;
  const { c, g } = canvas(S, S);
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  g.shadowColor = '#ff8a00'; g.shadowBlur = 8;
  for (let i = 0; i < 26; i++) {
    let x = Math.random() * S, y = Math.random() * S, a = Math.random() * 6.28;
    g.strokeStyle = pick(['#ff5a00', '#ffb000', '#ff7a00']);
    g.lineWidth = rand(1.5, 4);
    g.beginPath(); g.moveTo(x, y);
    for (let s = 0; s < 8; s++) { a += rand(-0.9, 0.9); x += Math.cos(a) * 14; y += Math.sin(a) * 14; g.lineTo(x, y); }
    g.stroke();
  }
  return tex(c);
}

export function stripeEmissiveTexture(color) {
  const { c, g } = canvas(64, 256);
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 256);
  g.fillStyle = color;
  g.fillRect(28, 0, 8, 256);
  for (let y = 20; y < 256; y += 64) g.fillRect(0, y, 64, 5);
  return tex(c);
}

export function rockTexture(base = '#7a7268') {
  const S = 256;
  const { c, g } = canvas(S, S);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  noise(g, S, S, 60);
  grime(g, S, S, 30, '30,28,24', 0.1, 0.3);
  grime(g, S, S, 10, '60,110,40', 0.15, 0.35); // moss
  cracks(g, S, S, 20, 'rgba(20,18,15,0.7)');
  return tex(c);
}

export function swirlTexture() {
  const { c, g } = canvas(128, 256);
  g.clearRect(0, 0, 128, 256);
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(230,225,210,${rand(0.1, 0.5)})`;
    g.lineWidth = rand(2, 8);
    const y = rand(0, 256);
    g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(40, y - 30, 80, y + 30, 128, y - 10); g.stroke();
  }
  return tex(c);
}

export function shade(hex, amt) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amt);
  return '#' + c.getHexString();
}

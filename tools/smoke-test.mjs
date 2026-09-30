// Headless smoke test: serves dist/, plays the game, cycles all aliens & powers, takes screenshots.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const gRoot = execSync('npm root -g').toString().trim();
const { chromium } = require(path.join(gRoot, '@playwright/mcp/node_modules/playwright'));

const dist = path.resolve('dist');
const outDir = process.env.SHOTS || '/projects/sandbox/.kiro/artifacts/screenshots';
fs.mkdirSync(outDir, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const f = path.join(dist, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
}).listen(4199);

const browser = await chromium.launch({
  executablePath: '/opt/playwright/chromium-1232/chrome-linux64/chrome',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const mobile = process.env.MOBILE === '1';
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, hasTouch: mobile, isMobile: mobile });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
if (process.env.QUALITY) await page.addInitScript((q) => localStorage.setItem('ak_quality', q), process.env.QUALITY);

await page.goto('http://127.0.0.1:4199/');
await page.waitForFunction(() => !document.getElementById('playBtn').disabled, null, { timeout: 120000 });
const shot = async (n) => page.screenshot({ path: `${outDir}/${n}.png` });
await shot('00-start');
await page.click('#playBtn');
await page.waitForTimeout(1500);

const step = (ms) => page.evaluate((ms) => new Promise((r) => setTimeout(r, ms)), ms);
// walk forward a bit
await page.keyboard.down('KeyW'); await step(1500); await page.keyboard.up('KeyW');
await shot('01-human-walk');
const forms = ['agni', 'vajra', 'vega', 'hima', 'vidyut', 'garuda', 'pashan', 'chhaya', 'tarang', 'anu'];
for (let i = 0; i < forms.length; i++) {
  await page.evaluate(() => { const P = window.__game.player; P.recharge = 0; });
  await page.keyboard.press(`Digit${(i + 1) % 10}`);
  await step(200);
  if (i === 0) await shot('02-transforming');
  await page.waitForFunction((id) => window.__game.player.formId === id && !window.__game.player.transforming, forms[i], { timeout: 60000 }).catch(() => {});
  const f = await page.evaluate(() => window.__game.player.formId);
  if (f !== forms[i]) errors.push(`expected form ${forms[i]} got ${f}`);
  // face a drone / props and use power a few times
  await page.evaluate(() => { const g = window.__game; g.cam.pitch = 0.05; });
  await page.keyboard.down('KeyW'); await step(500); await page.keyboard.up('KeyW');
  for (let k = 0; k < 2; k++) { await page.keyboard.press('KeyF'); await step(350); }
  await shot(`${String(i + 3).padStart(2, '0')}-${forms[i]}`);
}
// wheel UI
await page.evaluate(() => { window.__game.player.recharge = 0; });
await page.keyboard.press('KeyR');
await page.waitForFunction(() => window.__game.player.formId === 'human' && !window.__game.player.transforming, null, { timeout: 60000 }).catch(() => {});
await page.evaluate(() => { window.__game.player.recharge = 0; });
await page.keyboard.press('KeyQ'); await step(400);
await shot('13-wheel');
await page.keyboard.press('KeyQ');
const fps = await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); }));
console.log('FPS(swiftshader)', fps);
const stats = await page.evaluate(() => {
  const g = window.__game, r = g.renderer.info.render;
  return { calls: r.calls, tris: r.triangles, props: g.world.props.length, drones: g.drones.list.length, kills: g.drones.kills, hp: g.player.hp, pos: g.player.pos.toArray().map((v) => +v.toFixed(2)) };
});
console.log('STATS', JSON.stringify(stats));
console.log('ERRORS', errors.length ? '\n' + [...new Set(errors)].slice(0, 30).join('\n') : 'none');
await browser.close();
server.close();

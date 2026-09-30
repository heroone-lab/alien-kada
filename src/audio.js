// Tiny WebAudio synth - no audio files needed
export class Sfx {
  constructor() { this.ctx = null; }
  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.55;
    const comp = this.ctx.createDynamicsCompressor();
    this.master.connect(comp); comp.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.nextHonk = 4;
  }
  get ok() { return !!this.ctx && this.ctx.state === 'running'; }

  tone(f0, f1, dur, type = 'sine', vol = 0.3, delay = 0) {
    if (!this.ok) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur, vol = 0.3, freq = 1000, type = 'lowpass', f1 = null, delay = 0, q = 1) {
    if (!this.ok) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  transform() { this.tone(180, 1400, 0.7, 'sawtooth', 0.12); this.tone(360, 2200, 0.7, 'square', 0.05); this.noise(0.9, 0.25, 400, 'bandpass', 6000, 0, 2); this.tone(1320, 1320, 0.6, 'sine', 0.15, 0.55); this.tone(1980, 1980, 0.5, 'sine', 0.1, 0.6); }
  revert() { this.tone(1400, 200, 0.6, 'sawtooth', 0.1); this.noise(0.6, 0.2, 5000, 'bandpass', 300, 0, 2); }
  open() { this.tone(600, 900, 0.12, 'square', 0.08); }
  denied() { this.tone(300, 200, 0.15, 'square', 0.1); this.tone(300, 200, 0.15, 'square', 0.1, 0.2); }
  beep() { this.tone(880, 880, 0.12, 'sine', 0.15); }
  fire() { this.noise(0.35, 0.4, 900, 'lowpass', 200); this.tone(220, 80, 0.3, 'sawtooth', 0.08); }
  explosion(big = 1) { this.noise(0.9 * big, 0.7, 700, 'lowpass', 60); this.tone(90, 30, 0.8 * big, 'sine', 0.6); }
  slam() { this.tone(70, 25, 0.8, 'sine', 0.9); this.noise(0.7, 0.6, 500, 'lowpass', 50); }
  zap() { for (let i = 0; i < 3; i++) this.tone(2000 + Math.random() * 1500, 300, 0.12, 'square', 0.06, i * 0.04); this.noise(0.25, 0.3, 3000, 'highpass'); }
  whoosh() { this.noise(0.45, 0.35, 300, 'bandpass', 3000, 0, 1.5); }
  ice() { this.tone(2400, 1800, 0.25, 'triangle', 0.12); this.noise(0.2, 0.2, 6000, 'highpass'); }
  shatter() { this.noise(0.4, 0.35, 5000, 'highpass'); this.tone(3000, 1500, 0.2, 'triangle', 0.08); }
  sonic() { this.tone(200, 1800, 0.35, 'square', 0.12); this.tone(400, 3000, 0.35, 'sawtooth', 0.06); }
  shrink(up) { up ? this.tone(300, 1500, 0.35, 'sine', 0.2) : this.tone(1500, 300, 0.35, 'sine', 0.2); }
  wind(dur) { this.noise(dur, 0.35, 200, 'bandpass', 900, 0, 0.8); }
  rock() { this.noise(0.25, 0.3, 400, 'lowpass', 100); }
  grab() { this.tone(200, 600, 0.3, 'sine', 0.15); }
  laser() { this.tone(1200, 300, 0.18, 'square', 0.05); }
  hurt() { this.tone(260, 90, 0.25, 'square', 0.12); }
  jump() { this.tone(300, 500, 0.1, 'sine', 0.05); }
  thud(v = 0.5) { this.tone(110, 50, 0.25, 'sine', 0.25 * v); this.noise(0.15, 0.2 * v, 400, 'lowpass'); }
  honk() { const f = 380 + Math.random() * 200; this.tone(f, f, 0.18, 'square', 0.04); this.tone(f * 1.26, f * 1.26, 0.18, 'square', 0.03); if (Math.random() < 0.6) { this.tone(f, f, 0.14, 'square', 0.04, 0.25); } }
  moo(p, listener) {
    const d = p.distanceTo(listener); if (d > 40) return;
    const v = 0.25 * (1 - d / 40);
    this.tone(140, 95, 1.1, 'sawtooth', v * 0.5);
  }
  ambient(dt) {
    if (!this.ok) return;
    this.nextHonk -= dt;
    if (this.nextHonk <= 0) { this.honk(); this.nextHonk = 5 + Math.random() * 10; }
  }
}

// Keyboard + mouse (pointer lock) + multi-touch joystick / buttons / swipe-look
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.look = { dx: 0, dy: 0 };
    this.joy = { x: 0, y: 0, id: null, cx: 0, cy: 0 };
    this.lookTouch = null;
    this.pressed = new Set();
    this.jumpHeldTouch = false;
    this.enabled = false;
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.sens = this.isTouch ? 0.0055 : 0.0024;

    addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.code === 'Tab') e.preventDefault();
      if (!this.keys.has(e.code)) {
        if (e.code === 'KeyF') this.pressed.add('power');
        if (e.code === 'KeyQ' || e.code === 'Tab') this.pressed.add('omni');
        if (e.code === 'KeyR') this.pressed.add('revert');
        if (e.code === 'Space') this.pressed.add('jump');
        if (e.code === 'Escape') this.pressed.add('escape');
        const m = e.code.match(/^Digit(\d)$/);
        if (m) this.pressed.add('form' + ((+m[1] + 9) % 10));
      }
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled || this.isTouch) return;
      if (document.pointerLockElement !== canvas) { canvas.requestPointerLock?.(); return; }
      if (e.button === 0) this.pressed.add('power');
    });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) { this.look.dx += e.movementX; this.look.dy += e.movementY; }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // touch look: any touch on canvas (right side mainly)
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || !this.enabled) return;
      if (this.lookTouch === null) { this.lookTouch = { id: e.pointerId, x: e.clientX, y: e.clientY }; }
    });
    addEventListener('pointermove', (e) => {
      if (this.lookTouch && e.pointerId === this.lookTouch.id) {
        this.look.dx += (e.clientX - this.lookTouch.x) * 1.6;
        this.look.dy += (e.clientY - this.lookTouch.y) * 1.6;
        this.lookTouch.x = e.clientX; this.lookTouch.y = e.clientY;
      }
      if (this.joy.id === e.pointerId) this.updateJoy(e);
    });
    const end = (e) => {
      if (this.lookTouch && e.pointerId === this.lookTouch.id) this.lookTouch = null;
      if (this.joy.id === e.pointerId) { this.joy.id = null; this.joy.x = this.joy.y = 0; this.knob.style.transform = ''; }
    };
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);

    // joystick
    this.joyZone = document.getElementById('joyZone');
    this.joyBase = document.getElementById('joyBase');
    this.knob = document.getElementById('joyKnob');
    this.joyZone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const r = this.joyBase.getBoundingClientRect();
      this.joy.id = e.pointerId; this.joy.cx = r.left + r.width / 2; this.joy.cy = r.top + r.height / 2;
      this.updateJoy(e);
    });

    // buttons
    document.querySelectorAll('[data-act]').forEach((b) => {
      const act = b.dataset.act;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        this.pressed.add(act);
        if (act === 'jump') this.jumpHeldTouch = true;
        if (act === 'power') this.powerHeldTouch = true;
        b.classList.add('active');
      });
      const up = () => { if (act === 'jump') this.jumpHeldTouch = false; if (act === 'power') this.powerHeldTouch = false; b.classList.remove('active'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
    });
  }

  updateJoy(e) {
    const R = 55;
    let dx = e.clientX - this.joy.cx, dy = e.clientY - this.joy.cy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    this.joy.x = dx / R; this.joy.y = -dy / R;
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  get move() {
    let x = this.joy.x, y = this.joy.y;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y, mag: Math.min(1, m) };
  }
  get sprint() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || Math.hypot(this.joy.x, this.joy.y) > 0.92; }
  get jumpHeld() { return this.keys.has('Space') || this.jumpHeldTouch; }
  get powerHeld() { return this.powerHeldTouch || false; }

  consumeLook() { const l = { dx: this.look.dx, dy: this.look.dy }; this.look.dx = this.look.dy = 0; return l; }
  consumePressed() { const p = this.pressed; this.pressed = new Set(); return p; }
}

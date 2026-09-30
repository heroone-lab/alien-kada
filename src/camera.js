// GTA-style over-the-shoulder third person camera with collision + shake
import * as THREE from 'three';

const V3 = THREE.Vector3;

export class CameraRig {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.yaw = 0;
    this.pitch = 0.18;
    this.dist = 4;
    this.height = 1.55;
    this.target = new V3();
    this.shakeAmt = 0;
    this.ray = new THREE.Raycaster();
    this.fovBase = 68;
    this.fovKick = 0;
    this.first = true;
  }
  addLook(dx, dy, sens) {
    this.yaw -= dx * sens;
    this.pitch += dy * sens;
    this.pitch = Math.max(-0.55, Math.min(1.25, this.pitch));
  }
  shake(a) { this.shakeAmt = Math.min(1.5, this.shakeAmt + a); }

  get forward() { return new V3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  update(dt, player) {
    const f = player.form;
    const scale = player.visualScale;
    const [dist, h] = f.cam;
    const k = 1 - Math.exp(-dt * 4);
    this.dist += (dist * (player.transforming ? 0.8 : 1) - this.dist) * k;
    this.height += (h - this.height) * k;
    const want = player.pos.clone(); want.y += this.height;
    if (this.first) { this.target.copy(want); this.first = false; }
    this.target.lerp(want, 1 - Math.exp(-dt * 18));

    const cp = Math.cos(this.pitch);
    const dir = new V3(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    const right = new V3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const pivot = this.target.clone().addScaledVector(right, 0.55 * Math.max(0.5, Math.min(1.6, this.dist / 4.5)));

    // collision
    let d = this.dist;
    this.ray.set(pivot, dir); this.ray.far = d + 0.3;
    const hits = this.ray.intersectObjects(this.world.occluders, false);
    if (hits.length) d = Math.max(0.6, hits[0].distance - 0.3);
    const pos = pivot.clone().addScaledVector(dir, d);
    if (pos.y < 0.3) pos.y = 0.3;

    if (this.shakeAmt > 0) {
      const s = this.shakeAmt * 0.25;
      pos.x += (Math.random() - 0.5) * s; pos.y += (Math.random() - 0.5) * s; pos.z += (Math.random() - 0.5) * s;
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.5);
    }
    this.camera.position.copy(pos);
    this.camera.lookAt(pivot.clone().addScaledVector(dir, -2));
    const fovT = this.fovBase + this.fovKick;
    if (Math.abs(this.camera.fov - fovT) > 0.05) { this.camera.fov += (fovT - this.camera.fov) * (1 - Math.exp(-dt * 6)); this.camera.updateProjectionMatrix(); }
  }
}

import * as THREE from 'three';
import { buildCharacter } from './character-model.js';
import { HEAD_Y, NECK_Y, CHARACTER_HEIGHT, EYE_TEXTURE_URL, makeFaceMaps } from './character-assets.js';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = THREE.MathUtils.clamp;
const damp = (cur, target, rate, dt) => THREE.MathUtils.lerp(cur, target, 1 - Math.exp(-rate * dt));

export class Catgirl {
  constructor(scene) {
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.head = new THREE.Group();
    this.root.add(this.body);
    this.body.add(this.head);
    this.hit = [];
    this.height = CHARACTER_HEIGHT;
    Object.assign(this, {
      y: 6, vy: 0, s: 0, sv: 0, jumpTimer: 0, jumpPower: 1,
      spin: 0, spinTarget: 0, viewYaw: 0, viewTarget: 0,
      headYaw: 0, headPitch: 0, headRoll: 0,
      blinkT: 0, nextBlink: 2.5, expr: null, exprT: 0,
      pet: 0, puff: 0, flick: 0, wagPhase: 0,
      lonely: 0, sad: 0, sleepy: 0, waveT: 0, cheerT: 0,
      earKick: [0, 0], earKickV: [0, 0], nextTwitch: 3,
      armZ: [0.16, -0.16], armX: [-0.13, -0.13],
    });
    buildCharacter(this);
    this.faceArtReady = this.loadFaceArt();
    this.tailCurve = new THREE.CatmullRomCurve3(Array.from({ length: 6 }, () => new THREE.Vector3()));
    this.tailPoint = new THREE.Vector3();
    this.tailTangent = new THREE.Vector3();
    this.tailAcross = new THREE.Vector3();
    this.tailNormal = new THREE.Vector3();
    this.tailAxis = new THREE.Vector3(0, 0, 1);
    this.updateTail(0);
    scene.add(this.root);
  }

  async loadFaceArt() {
    if (typeof Image === 'undefined') return false;
    try {
      const artwork = new Image();
      artwork.src = EYE_TEXTURE_URL;
      await artwork.decode();
      const previous = this.faceMaps;
      this.faceMaps = makeFaceMaps(artwork);
      this.faceMaterial.map = this.faceMaps[this.currentFace] || this.faceMaps.open;
      this.faceMaterial.emissiveMap = this.faceMaterial.map;
      Object.values(previous).forEach((texture) => texture.dispose());
      this.faceArtLoaded = true;
      return true;
    } catch {
      // A failed decal download must never prevent the character or her reactions loading.
      return false;
    }
  }

  setView(angle) { this.viewTarget = angle; }
  setExpr(expression, duration) { this.expr = expression; this.exprT = duration; }
  poke(power = 1, spin = Math.random() < 0.15) {
    if (this.y > 0.05 || this.jumpTimer > 0) {
      if (this.y < 1) this.vy = Math.max(this.vy, 3.5);
      this.sv += 1.8;
    } else {
      this.sv -= 3;
      this.jumpTimer = 0.085;
      this.jumpPower = power;
    }
    if (spin) this.spinTarget += Math.PI * 2 * (Math.random() < 0.5 ? 1 : -1);
  }
  react(zone, side = 1) {
    if (zone === 'head') {
      this.setExpr('bonk', 0.7); this.sv -= 2.4;
      this.earKickV[0] += 16; this.earKickV[1] += 16;
    } else if (zone === 'chin') {
      this.setExpr('content', 1.3); this.pet = Math.min(1, this.pet + 0.5);
    } else if (zone === 'ear') {
      this.earKickV[side > 0 ? 1 : 0] += 28; this.setExpr('surprise', 0.6);
    } else if (zone === 'tail') {
      this.puff = 1; this.flick = 1; this.setExpr('surprise', 0.7);
    } else if (zone === 'bell') {
      this.setExpr('happy', 0.9); this.poke(0.45, false);
    } else {
      this.setExpr('happy', 0.9); this.poke(0.8);
    }
  }
  petTick() { this.pet = Math.min(1, this.pet + 0.28); }
  celebrate() { this.cheerT = 1.6; this.setExpr('happy', 1.6); this.poke(1.1, true); }
  wave() { this.waveT = 1.6; this.setExpr('happy', 1.2); }
  setLonely(stage) { this.lonely = stage; }
  get sleeping() { return this.lonely >= 5; }
  get petting() { return this.pet > 0.2; }
  headTop(out = new THREE.Vector3()) { return this.head.localToWorld(out.set(0, CHARACTER_HEIGHT - NECK_Y, 0)); }
  headCenter(out = new THREE.Vector3()) { return this.head.localToWorld(out.set(0, HEAD_Y - NECK_Y, 0)); }
  isChin(point) {
    const local = this.headMesh.worldToLocal(point.clone());
    return local.y < -0.3 && local.z > 0.12 && Math.abs(local.x) < 0.22;
  }

  updateTail(dt) {
    this.wagPhase += (this.sleeping ? 0.8 : this.expr === 'happy' ? 3.6 : 1.65) * dt + this.flick * dt * 6;
    const wag = Math.sin(this.wagPhase) * (this.sleeping ? 0.025 : 0.11 + this.flick * 0.13);
    const droop = Math.max(this.sad * 0.55, this.sleepy * 0.8);
    const pts = this.tailCurve.points;
    pts[0].set(0, 2.94, -0.3);
    pts[1].set(0.57, 2.8, -0.8);
    pts[2].set(1.04 + wag * 0.3, 3.1 - droop * 0.35, -1.1);
    pts[3].set(1.29 + wag, 3.68 - droop * 0.6, -1.18);
    pts[4].set(1.15 + wag * 1.2, 4.04 - droop, -1.04);
    pts[5].set(0.93 + wag, 3.96 - droop, -0.86);
    const attr = this.tailGeometry.attributes.position;
    for (let i = 0; i <= this.tailSegments; i++) {
      const t = i / this.tailSegments;
      this.tailCurve.getPoint(t, this.tailPoint);
      this.tailCurve.getTangent(t, this.tailTangent);
      this.tailAcross.crossVectors(this.tailTangent, this.tailAxis).normalize();
      this.tailNormal.crossVectors(this.tailAcross, this.tailTangent).normalize();
      const end = Math.sqrt(Math.max(0.0001, 1 - Math.max(0, (t - 0.87) / 0.13) ** 2));
      const radius = (0.107 + Math.sin(t * Math.PI * 0.85) * 0.035) * end * (1 + this.puff * 0.25);
      for (let j = 0; j <= this.tailRadial; j++) {
        const a = j / this.tailRadial * Math.PI * 2;
        const x = Math.cos(a) * radius, y = Math.sin(a) * radius;
        const index = i * (this.tailRadial + 1) + j;
        attr.setXYZ(index,
          this.tailPoint.x + this.tailAcross.x * x + this.tailNormal.x * y,
          this.tailPoint.y + this.tailAcross.y * x + this.tailNormal.y * y,
          this.tailPoint.z + this.tailAcross.z * x + this.tailNormal.z * y);
      }
    }
    attr.needsUpdate = true;
    this.tailGeometry.computeVertexNormals();
    // Raycasting uses these too; a stale sphere makes an animated tail untouchable.
    this.tailGeometry.computeBoundingSphere();
    this.tailCurve.getPoint(0.69, this.tailBow.position);
    this.tailBow.position.z += 0.14;
    this.tailBow.rotation.z = wag * 0.4;
  }

  update(dt, t, look) {
    this.exprT -= dt;
    if (this.exprT <= 0) this.expr = null;
    this.waveT -= dt; this.cheerT -= dt;
    this.pet = Math.max(0, this.pet - dt * 0.55);
    this.puff = damp(this.puff, 0, 2.5, dt); this.flick = damp(this.flick, 0, 3, dt);
    this.sad = damp(this.sad, this.lonely >= 3 && !this.sleeping ? (this.lonely - 2) / 2 : 0, 2, dt);
    this.sleepy = damp(this.sleepy, this.sleeping ? 1 : 0, 2, dt);
    if (this.jumpTimer > 0) {
      this.jumpTimer -= dt;
      if (this.jumpTimer <= 0) { this.vy = 5.6 * this.jumpPower; this.sv += 4; }
    }
    this.vy -= 24 * dt; this.y += this.vy * dt;
    let landed = 0;
    if (this.y < 0) {
      if (this.vy < -2) { this.sv -= Math.min(6, -this.vy * 0.5); landed = -this.vy; }
      this.y = 0; this.vy = 0;
    }
    this.sv += (-240 * this.s - 14 * this.sv) * dt;
    this.s = clamp(this.s + this.sv * dt, -0.24, 0.28);
    const breathe = Math.sin(t * (this.sleeping ? 1.3 : 2.1)) * 0.002;
    this.body.scale.set(1 - this.s * 0.12, 1 + this.s * 0.24 + breathe, 1 - this.s * 0.12);
    this.root.position.y = this.y;
    this.viewYaw = damp(this.viewYaw, this.viewTarget, 5, dt);
    this.spin = damp(this.spin, this.spinTarget, 5, dt);
    const facingFront = Math.max(0, Math.cos(this.viewYaw));
    let yaw = clamp(Math.atan2(look.x, look.z), -0.3, 0.3) * facingFront;
    let pitch = clamp(Math.atan2(HEAD_Y + this.y - look.y, look.z) * 0.35, -0.15, 0.18);
    let roll = Math.sin(t * 0.7) * 0.018;
    if (this.petting) { roll = 0.075; pitch = 0.04; }
    if (this.sleeping) { yaw = 0.06; pitch = 0.15; roll = 0.1; }
    this.headYaw = damp(this.headYaw, yaw, 5, dt);
    this.headPitch = damp(this.headPitch, pitch + this.sad * 0.08, 5, dt);
    this.headRoll = damp(this.headRoll, roll, 4, dt);
    this.head.rotation.set(this.headPitch, this.headYaw, this.headRoll);
    this.root.rotation.set(0, this.viewYaw + this.spin + this.headYaw * 0.13, Math.sin(t * 0.8) * 0.007);
    // Small secondary movement around the crown, keeping the sculpted fringe intact.
    this.ahogeG.rotation.z = Math.sin(t * 2.1) * 0.005 + this.s * 0.02;
    this.nextTwitch -= dt;
    if (this.nextTwitch <= 0 && !this.sleeping) {
      this.earKickV[Math.random() < 0.5 ? 0 : 1] += rand(8, 12); this.nextTwitch = rand(3, 6);
    }
    this.ears.forEach((ear, i) => {
      const side = i ? 1 : -1;
      this.earKickV[i] += (-250 * this.earKick[i] - 12 * this.earKickV[i]) * dt;
      this.earKick[i] += this.earKickV[i] * dt;
      ear.rotation.z = side * (this.sad * 0.2 + this.sleepy * 0.15 + this.pet * 0.1);
      ear.rotation.x = -this.earKick[i] * 0.3;
    });
    this.updateTail(dt);
    this.arms.forEach((arm, i) => {
      const side = i ? 1 : -1;
      let z = -side * 0.16, x = -0.13;
      if (this.vy > 0.5 || this.cheerT > 0) z = side * 0.65;
      if (this.petting) { x = -0.25; z = -side * 0.21; }
      if (this.waveT > 0 && side === 1) { z = 2.3 + Math.sin(t * 10) * 0.15; x = -0.12; }
      this.armZ[i] = damp(this.armZ[i], z, 7, dt); this.armX[i] = damp(this.armX[i], x, 7, dt);
      arm.rotation.set(this.armX[i], 0, this.armZ[i]);
    });
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) { this.blinkT = 0.13; this.nextBlink = rand(2.5, 5.5); }
    this.blinkT = Math.max(0, this.blinkT - dt);
    const face = this.expr || (this.sleeping ? 'sleep' : this.petting ? 'content' : this.blinkT > 0 ? 'blink' : this.sad > 0.4 ? 'sad' : 'open');
    if (face !== this.currentFace) {
      this.faceMaterial.map = this.faceMaps[face] || this.faceMaps.open;
      this.faceMaterial.emissiveMap = this.faceMaterial.map;
      this.currentFace = face;
    }
    return { landed };
  }
}

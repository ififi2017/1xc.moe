import * as THREE from 'three';
import { sphereGeo, sphereHiGeo } from './shapes.js';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const HEAD_Y = 1.78; // head centre, in body space
const NECK_Y = 1.02; // head pivot
const TAIL_N = 34;

const soft = (color, o = {}) => new THREE.MeshPhysicalMaterial({
  color,
  roughness: 0.45,
  clearcoat: 0.35,
  clearcoatRoughness: 0.3,
  sheen: 0.6,
  sheenRoughness: 0.5,
  sheenColor: new THREE.Color('#ffffff'),
  ...o,
});

// palette from 1xc's character sheet: white→lilac hair, amber eyes, cream knit, lavender ribbons
const HAIR_TOP = new THREE.Color('#fdf8fc');
const HAIR_END = new THREE.Color('#c3a2ee');

const M = {
  skin: soft('#fff0e8', { roughness: 0.62, clearcoat: 0.08, sheen: 0.9, sheenColor: new THREE.Color('#ffd3da') }),
  hair: soft('#ffffff', { roughness: 0.34, clearcoat: 0.8, clearcoatRoughness: 0.14, vertexColors: true, sheenColor: new THREE.Color('#f1e6ff') }),
  fluff: soft('#fbf6fa', { roughness: 0.7, clearcoat: 0.1, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color('#d9c4ff') }),
  earInner: soft('#ffbfd2', { roughness: 0.65, clearcoat: 0 }),
  knit: soft('#f4e9dc', { roughness: 0.85, clearcoat: 0, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color('#e9d5bd') }),
  knitDeep: soft('#e6d5c1', { roughness: 0.9, clearcoat: 0 }),
  lilac: soft('#d9c3f5', { roughness: 0.55 }),
  lace: soft('#f4ecff', { roughness: 0.6 }),
  ribbon: soft('#c9a6ee', { roughness: 0.4, clearcoat: 0.6 }),
  choker: new THREE.MeshPhysicalMaterial({ color: '#2a2130', roughness: 0.35, clearcoat: 0.8 }),
  bell: new THREE.MeshPhysicalMaterial({ color: '#f2c45a', metalness: 0.85, roughness: 0.22, clearcoat: 1 }),
  ink: new THREE.MeshPhysicalMaterial({ color: '#3a2737', roughness: 0.2, clearcoat: 1 }),
  pupil: new THREE.MeshPhysicalMaterial({ color: '#5a2e1c', roughness: 0.2, clearcoat: 1 }),
  iris: new THREE.MeshPhysicalMaterial({ color: '#f0a83a', roughness: 0.2, clearcoat: 1, emissive: '#ff9a3c', emissiveIntensity: 0.2 }),
  white: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
  blush: new THREE.MeshBasicMaterial({ color: '#ff7aa5', transparent: true, opacity: 0.42, depthWrite: false }),
  paw: soft('#ffa3c2', { roughness: 0.6, clearcoat: 0 }),
  tongue: soft('#ff8fa6'),
};
M.hairCap = M.hair.clone();
M.hairCap.side = THREE.DoubleSide;

// bake the white→lilac gradient into a hair mesh's vertex colours (by body-space height)
const tmpV = new THREE.Vector3();
const tmpC = new THREE.Color();
function paintHair(mesh, yEnd = 1.12, yTop = 1.9) {
  mesh.geometry = mesh.geometry.clone();
  const pos = mesh.geometry.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    tmpV.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    tmpC.copy(HAIR_END).lerp(HAIR_TOP, smooth(yEnd, yTop, tmpV.y));
    col[i * 3] = tmpC.r; col[i * 3 + 1] = tmpC.g; col[i * 3 + 2] = tmpC.b;
  }
  mesh.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

/**
 * 猫猫 — a chibi catgirl built entirely from primitives.
 * Everything lives in "body space": feet at y=0, ~2.85 tall including ears.
 */
export class Catgirl {
  constructor(scene) {
    this.root = new THREE.Group();  // position / jump / spin
    this.body = new THREE.Group();  // squash & stretch, pivot at the feet
    this.head = new THREE.Group();  // pivot at the neck
    this.root.add(this.body);
    this.body.add(this.head);
    this.hit = [];
    this.build();
    scene.add(this.root);

    Object.assign(this, {
      y: 6, vy: 0, s: 0, sv: 0, jumpTimer: 0, jumpPower: 1,
      spin: 0, spinTarget: 0, yaw: 0,
      headYaw: 0, headPitch: 0, headRoll: 0,
      ahoge: 0, ahogeV: 0,
      blinkT: 0, nextBlink: 2.5,
      expr: null, exprT: 0,
      pet: 0, puff: 0, flick: 0, wagPhase: 0,
      lonely: 0, sad: 0, sleepy: 0,
      waveT: 0, cheerT: 0,
      earKick: [0, 0], earKickV: [0, 0], nextTwitch: 3,
      armZ: [-0.85, 0.85], armX: [-0.2, -0.2],
      landedAt: -1,
    });
  }

  /* ---------------------------------------------------------------- */
  build() {
    const { body, head } = this;
    const add = (parent, geo, mat, zone, p, s, r) => {
      const m = new THREE.Mesh(geo, mat);
      if (p) m.position.set(...p);
      if (s !== undefined) typeof s === 'number' ? m.scale.setScalar(s) : m.scale.set(...s);
      if (r) m.rotation.set(...r);
      m.userData.zone = zone;
      parent.add(m);
      this.hit.push(m);
      return m;
    };

    /* ---- head & hair ---- */
    const headMesh = add(head, sphereHiGeo, M.skin, 'head', [0, HEAD_Y, 0], [0.9, 0.8, 0.84]);
    add(head, sphereHiGeo, M.hair, 'head', [0, 1.7, -0.22], [0.98, 0.92, 0.8]);
    // fluffy bob framing the cheeks, lilac at the ends
    for (const side of [-1, 1]) {
      add(head, sphereHiGeo, M.hair, 'head', [side * 0.74, 1.6, -0.02], [0.25, 0.66, 0.55], [0, 0, side * 0.12]);
      add(head, sphereHiGeo, M.hair, 'head', [side * 0.62, 1.12, -0.28], [0.3, 0.22, 0.3]);
    }
    const capGeo = new THREE.SphereGeometry(1, 64, 28, 0, Math.PI * 2, 0, Math.PI * 0.45);
    add(head, capGeo, M.hairCap, 'head', [0, 1.8, -0.02], [0.95, 0.86, 0.9], [-0.38, 0, 0]);

    // features are stuck onto the face by raycasting from the front
    head.updateMatrixWorld(true);
    const rc = new THREE.Raycaster();
    const origin = new THREE.Vector3();
    const back = new THREE.Vector3(0, 0, -1);
    const place = (obj, x, y, lift = 0, zone = 'head') => {
      rc.set(origin.set(x, y, 5), back);
      const hit = rc.intersectObject(headMesh, false)[0];
      const n = hit.face.normal.clone().transformDirection(headMesh.matrixWorld);
      obj.position.copy(hit.point).addScaledVector(n, lift);
      obj.lookAt(obj.position.clone().add(n));
      obj.traverse((m) => { if (m.isMesh) { m.userData.zone = zone; this.hit.push(m); } });
      head.add(obj);
      return obj;
    };

    // bangs: seven little teardrops fanned across the forehead
    const tear = new THREE.LatheGeometry(
      [[0, -1], [0.14, -0.85], [0.32, -0.55], [0.46, -0.15], [0.5, 0.2], [0.42, 0.5], [0.22, 0.72], [0, 0.8]]
        .map(([x, y]) => new THREE.Vector2(x, y)), 24);
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * 0.19;
      const tuft = new THREE.Mesh(tear, M.hair);
      tuft.scale.set(0.2, 0.27 - Math.abs(i - 3) * 0.012, 0.13);
      place(tuft, x, 2.13 - x * x * 0.55, 0.035);
      tuft.rotateZ(x * 0.75);
      tuft.rotateX(-0.3);
    }

    // side locks with little ribbons
    for (const side of [-1, 1]) {
      add(head, new THREE.CapsuleGeometry(0.12, 0.62, 8, 20), M.hair, 'head', [side * 0.8, 1.36, 0.12], undefined, [0, 0, side * 0.14]);
    }

    // 呆毛
    this.ahogeG = new THREE.Group();
    this.ahogeG.position.set(0.02, 2.58, 0.06);
    const ahogeCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.04, 0.2, 0.02),
      new THREE.Vector3(0.24, 0.34, 0), new THREE.Vector3(0.12, 0.44, -0.02));
    add(this.ahogeG, new THREE.TubeGeometry(ahogeCurve, 24, 0.032, 8), M.hair, 'head');
    add(this.ahogeG, sphereGeo, M.hair, 'head', [0.12, 0.44, -0.02], 0.032);
    head.add(this.ahogeG);

    // cat ears (pivot at the base so they can twitch)
    const earOuter = new THREE.ConeGeometry(0.27, 0.52, 32).translate(0, 0.26, 0);
    const earIn = new THREE.ConeGeometry(0.16, 0.34, 32).translate(0, 0.17, 0);
    this.ears = [-1, 1].map((side) => {
      const g = new THREE.Group();
      g.position.set(side * 0.5, 2.36, -0.08);
      const o = add(g, earOuter, M.fluff, 'ear', [0, 0, 0], [1, 1, 0.55]);
      const n = add(g, earIn, M.earInner, 'ear', [0, 0.04, 0.075], [1, 1, 0.35]);
      // invisible, chubbier hit area so the ears are easy to tap
      const proxy = add(g, sphereGeo, M.hair, 'ear', [0, 0.24, 0], [0.26, 0.34, 0.2]);
      proxy.visible = false;
      o.userData.side = n.userData.side = proxy.userData.side = side;
      head.add(g);
      return g;
    });

    /* ---- face ---- */
    const arcGeo = new THREE.TorusGeometry(0.085, 0.022, 8, 24, Math.PI);
    const dashGeo = new THREE.CapsuleGeometry(0.019, 0.075, 4, 8);
    this.eyes = [-1, 1].map((side) => {
      const eye = new THREE.Group();
      const open = new THREE.Group();
      const ball = new THREE.Mesh(sphereGeo, M.ink); ball.scale.set(0.125, 0.165, 0.05);
      const iris = new THREE.Mesh(sphereGeo, M.iris); iris.scale.set(0.096, 0.126, 0.04); iris.position.set(0, -0.022, 0.024);
      const pupil = new THREE.Mesh(sphereGeo, M.pupil); pupil.scale.set(0.05, 0.066, 0.02); pupil.position.set(0, -0.006, 0.05);
      const lash = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.02, 8, 24, Math.PI * 0.86), M.ink); lash.rotation.z = Math.PI * 0.07; lash.scale.set(1.04, 1.12, 1); lash.position.set(0, 0.012, 0.04);
      const hl1 = new THREE.Mesh(sphereGeo, M.white); hl1.scale.set(0.042, 0.042, 0.02); hl1.position.set(0.035, 0.06, 0.07);
      const hl2 = new THREE.Mesh(sphereGeo, M.white); hl2.scale.set(0.02, 0.02, 0.012); hl2.position.set(-0.04, -0.065, 0.066);
      open.add(ball, iris, pupil, lash, hl1, hl2);
      const happy = new THREE.Mesh(arcGeo, M.ink); happy.position.y = -0.03;             // ^ ^
      const content = new THREE.Mesh(arcGeo, M.ink); content.rotation.z = Math.PI; content.position.y = 0.02; // ‿ ‿
      const bonk = new THREE.Group();                                                     // > <
      for (const k of [-1, 1]) {
        const d = new THREE.Mesh(dashGeo, M.ink);
        d.rotation.z = Math.PI / 2 - k * 0.5; // two dashes meeting on the right: ">"
        d.position.set(0, k * 0.027, 0);
        bonk.add(d);
      }
      bonk.scale.x = side > 0 ? -1 : 1;     // mirror the right eye into "<"
      eye.add(open, happy, content, bonk);
      place(eye, side * 0.3, 1.66);
      return { open, happy, content, bonk };
    });

    for (const side of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.CircleGeometry(0.09, 28), M.blush);
      b.scale.x = 1.4;
      place(b, side * 0.52, 1.5, 0.012);
    }

    const mw = new THREE.Group(); // ω
    const smallArc = new THREE.TorusGeometry(0.038, 0.012, 8, 16, Math.PI);
    for (const side of [-1, 1]) {
      const a = new THREE.Mesh(smallArc, M.ink);
      a.rotation.z = Math.PI;
      a.position.x = side * 0.038;
      mw.add(a);
    }
    place(mw, 0, 1.48, 0.004);
    const fang = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.045, 10), M.white);
    place(fang, 0.06, 1.452, 0.006);
    fang.rotateZ(Math.PI);
    const mo = new THREE.Group(); // open mouth
    const hole = new THREE.Mesh(sphereGeo, M.ink); hole.scale.set(0.055, 0.062, 0.02);
    const tongue = new THREE.Mesh(sphereGeo, M.tongue); tongue.scale.set(0.038, 0.026, 0.014); tongue.position.set(0, -0.026, 0.012);
    mo.add(hole, tongue);
    place(mo, 0, 1.455);
    const frown = new THREE.Mesh(smallArc, M.ink);
    place(frown, 0, 1.45, 0.004);
    this.mouth = { w: mw, fang, open: mo, frown };

    head.updateMatrixWorld(true);
    head.traverse((m) => { if (m.isMesh && (m.material === M.hair || m.material === M.hairCap)) paintHair(m); });

    // 肉垫发卡 on her left side of the bangs
    const hairTargets = head.children.filter((m) => m.isMesh && (m.material === M.hair || m.material === M.hairCap));
    const clip = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.025, 28).rotateX(Math.PI / 2), M.white);
    const pad = new THREE.Mesh(sphereGeo, M.paw); pad.scale.set(0.032, 0.026, 0.012); pad.position.set(0, -0.016, 0.014);
    clip.add(disc, pad);
    for (const [x, y] of [[-0.03, 0.02], [0, 0.034], [0.03, 0.02]]) {
      const toe = new THREE.Mesh(sphereGeo, M.paw); toe.scale.set(0.013, 0.015, 0.01); toe.position.set(x, y, 0.014);
      clip.add(toe);
    }
    rc.set(origin.set(0.44, 2.0, 5), back);
    const clipHit = rc.intersectObjects(hairTargets, false)[0];
    if (clipHit) {
      const n = clipHit.face.normal.clone().transformDirection(clipHit.object.matrixWorld);
      clip.position.copy(clipHit.point).addScaledVector(n, 0.02);
      clip.lookAt(clip.position.clone().add(n));
      clip.rotateZ(-0.3);
      clip.traverse((m) => { if (m.isMesh) { m.userData.zone = 'head'; this.hit.push(m); } });
      head.add(clip);
    }

    // re-pivot the head at the neck
    head.position.y = NECK_Y;
    for (const c of head.children) c.position.y -= NECK_Y;
    this.headMesh = headMesh;

    /* ---- body ---- */
    const lathe = (pts) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 48);
    // lilac camisole frill peeking out under the sweater
    add(body, lathe([[0.001, 0.27], [0.47, 0.27], [0.53, 0.3], [0.51, 0.4], [0.001, 0.42]]), M.lilac, 'body');
    add(body, new THREE.TorusGeometry(0.5, 0.04, 10, 56), M.lace, 'body', [0, 0.28, 0], undefined, [Math.PI / 2, 0, 0]);
    // oversized cream knit
    add(body, lathe([[0.001, 0.38], [0.52, 0.38], [0.58, 0.43], [0.57, 0.55], [0.5, 0.72], [0.4, 0.88], [0.3, 0.98], [0.2, 1.04], [0.001, 1.06]]), M.knit, 'body');
    add(body, new THREE.TorusGeometry(0.555, 0.06, 12, 56), M.knitDeep, 'body', [0, 0.41, 0], undefined, [Math.PI / 2, 0, 0]);
    // cable-knit ridges down the front
    for (const x of [-0.16, 0.16]) {
      add(body, new THREE.CapsuleGeometry(0.03, 0.42, 4, 10), M.knitDeep, 'body', [x, 0.66, 0.47 - Math.abs(x) * 0.15], undefined, [-0.42, 0, 0]);
    }
    // black choker
    add(body, new THREE.TorusGeometry(0.19, 0.045, 12, 36), M.choker, 'body', [0, 1.0, 0], undefined, [Math.PI / 2, 0, 0]);

    // 铃铛
    add(body, sphereGeo, M.bell, 'bell', [0, 0.9, 0.24], 0.085);
    add(body, new THREE.TorusGeometry(0.025, 0.01, 6, 16), M.bell, 'bell', [0, 0.99, 0.22]);
    add(body, new THREE.BoxGeometry(0.1, 0.014, 0.03), M.ink, 'bell', [0, 0.88, 0.315]);
    add(body, sphereGeo, M.ink, 'bell', [0, 0.855, 0.315], 0.016);

    // white leg warmers with lilac bows, and cat-face slippers
    for (const side of [-1, 1]) {
      add(body, new THREE.CapsuleGeometry(0.1, 0.18, 6, 16), M.knit, 'body', [side * 0.16, 0.2, 0]);
      for (const k of [-1, 1]) add(body, sphereGeo, M.ribbon, 'body', [side * 0.16 + k * 0.035, 0.27, 0.1], [0.03, 0.022, 0.015], [0, 0, k * 0.4]);
      add(body, sphereGeo, M.fluff, 'body', [side * 0.16, 0.07, 0.05], [0.13, 0.09, 0.18]);
      for (const k of [-1, 1]) {
        add(body, new THREE.ConeGeometry(0.03, 0.06, 12), M.fluff, 'body', [side * 0.16 + k * 0.06, 0.15, 0.1], undefined, [0, 0, -k * 0.3]);
        add(body, sphereGeo, M.ink, 'body', [side * 0.16 + k * 0.04, 0.1, 0.215], 0.014);
      }
    }

    // oversized sleeves with pink paw prints, little hands peeking out
    this.arms = [-1, 1].map((side) => {
      const g = new THREE.Group();
      g.position.set(side * 0.3, 0.95, 0.04);
      add(g, new THREE.CapsuleGeometry(0.115, 0.22, 6, 16), M.knit, 'body', [0, -0.17, 0]);
      add(g, new THREE.TorusGeometry(0.1, 0.035, 10, 24), M.knitDeep, 'body', [0, -0.3, 0], undefined, [Math.PI / 2, 0, 0]);
      add(g, sphereGeo, M.skin, 'body', [0, -0.36, 0.01], 0.075);
      const print = new THREE.Group();
      const pad = new THREE.Mesh(sphereGeo, M.paw); pad.scale.set(0.032, 0.026, 0.01); pad.position.y = -0.012;
      print.add(pad);
      for (const [x, y] of [[-0.03, 0.022], [0, 0.034], [0.03, 0.022]]) {
        const toe = new THREE.Mesh(sphereGeo, M.paw); toe.scale.set(0.012, 0.014, 0.008); toe.position.set(x, y, 0);
        print.add(toe);
      }
      print.position.set(side * 0.05, -0.17, 0.104);
      print.rotation.y = side * 0.45;
      g.add(print);
      body.add(g);
      return g;
    });

    // tail: a chain of overlapping spheres, re-posed every frame
    this.tail = [];
    for (let i = 0; i < TAIL_N; i++) {
      this.tail.push(add(body, sphereGeo, M.fluff, 'tail'));
    }
    this.tailBow = new THREE.Group();
    for (const k of [-1, 1]) {
      const loop = add(this.tailBow, sphereGeo, M.ribbon, 'tail', [k * 0.075, 0.01, 0], [0.07, 0.045, 0.03], [0, 0, k * 0.35]);
      const tailEnd = add(this.tailBow, sphereGeo, M.ribbon, 'tail', [k * 0.035, -0.07, 0], [0.02, 0.05, 0.015], [0, 0, k * 0.4]);
      loop.renderOrder = tailEnd.renderOrder = 1;
    }
    add(this.tailBow, sphereGeo, M.ribbon, 'tail', [0, 0, 0], 0.03);
    add(this.tailBow, sphereGeo, M.bell, 'tail', [0, -0.1, 0.02], 0.04);
    body.add(this.tailBow);
    this.tailHit = [];
    for (let i = 4; i < TAIL_N; i += 5) {
      const m = add(body, sphereGeo, M.fluff, 'tail', undefined, 0.17);
      m.visible = false;
      m.userData.follow = i;
      this.tailHit.push(m);
    }
  }

  /* ---------------------------------------------------------------- */
  /* reactions                                                         */
  /* ---------------------------------------------------------------- */
  setExpr(e, dur) { this.expr = e; this.exprT = dur; }

  poke(power = 1, spin = Math.random() < 0.22) {
    if (this.y > 0.05 || this.jumpTimer > 0) {
      if (this.y < 1) this.vy = Math.max(this.vy, 4.5);
      this.sv += 3;
    } else {
      this.sv -= 6.5;
      this.jumpTimer = 0.085;
      this.jumpPower = power;
    }
    if (spin) this.spinTarget += Math.PI * 2 * (Math.random() < 0.5 ? 1 : -1);
  }

  react(zone, side = 1) {
    switch (zone) {
      case 'head':
        this.setExpr('bonk', 0.75);
        this.sv -= 5;
        this.earKickV[0] += 22;
        this.earKickV[1] += 22;
        break;
      case 'chin':
        this.setExpr('content', 1.3);
        this.pet = Math.min(1, this.pet + 0.5);
        break;
      case 'ear':
        this.earKickV[side > 0 ? 1 : 0] += 38;
        this.setExpr('surprise', 0.55);
        break;
      case 'tail':
        this.puff = 1;
        this.flick = 1;
        this.setExpr('surprise', 0.6);
        this.sv -= 3;
        break;
      case 'bell':
        this.setExpr('happy', 0.9);
        this.poke(0.55, false);
        break;
      default:
        this.setExpr('happy', 0.9);
        this.poke(1);
    }
  }

  petTick() { this.pet = Math.min(1, this.pet + 0.28); }
  celebrate() { this.cheerT = 1.6; this.setExpr('happy', 1.6); this.poke(1.25, true); }
  wave() { this.waveT = 1.6; this.setExpr('happy', 1.2); }
  setLonely(stage) { this.lonely = stage; }
  get sleeping() { return this.lonely >= 5; }
  get petting() { return this.pet > 0.2; }

  headTop(out = new THREE.Vector3()) { return this.head.localToWorld(out.set(0.1, 2.72 - NECK_Y, 0)); }
  headCenter(out = new THREE.Vector3()) { return this.head.localToWorld(out.set(0, HEAD_Y - NECK_Y, 0)); }

  /* ---------------------------------------------------------------- */
  update(dt, t, look) {
    const sleeping = this.sleeping;
    this.exprT -= dt;
    if (this.exprT <= 0) this.expr = null;
    this.waveT -= dt;
    this.cheerT -= dt;
    this.pet = Math.max(0, this.pet - dt * 0.55);
    this.puff = damp(this.puff, 0, 2.5, dt);
    this.flick = damp(this.flick, 0, 3, dt);
    this.sad = damp(this.sad, this.lonely >= 3 && !sleeping ? (this.lonely - 2) / 2 : 0, 2, dt);
    this.sleepy = damp(this.sleepy, sleeping ? 1 : 0, 2, dt);

    /* jump & squash */
    if (this.jumpTimer > 0) {
      this.jumpTimer -= dt;
      if (this.jumpTimer <= 0) { this.vy = 6.6 * this.jumpPower; this.sv += 8; }
    }
    this.vy -= 24 * dt;
    this.y += this.vy * dt;
    let landed = 0;
    if (this.y < 0) {
      if (this.vy < -2) { this.sv -= Math.min(10, -this.vy * 0.8); landed = -this.vy; }
      this.y = 0;
      this.vy = 0;
    }
    this.sv += (-240 * this.s - 11 * this.sv) * dt;
    this.s = clamp(this.s + this.sv * dt, -0.4, 0.5);

    const breathe = Math.sin(t * (sleeping ? 1.3 : 2.2)) * (sleeping ? 0.024 : 0.013);
    const sy = 1 + this.s + breathe;
    const sxz = 1 - this.s * 0.42 - breathe * 0.5;
    this.body.scale.set(sxz, sy, sxz);
    this.root.position.y = this.y;

    /* where to look */
    const hy = this.y + 1.7;
    let yawT = clamp(Math.atan2(look.x, look.z), -0.6, 0.6);
    let pitchT = clamp(Math.atan2(hy - look.y, look.z) * 0.5, -0.25, 0.3);
    let rollT = Math.sin(t * 0.9) * 0.04;
    if (this.petting) { rollT = Math.sin(t * 2.2) * 0.1 + 0.1; pitchT = 0.1; }
    pitchT = pitchT * (1 - this.sad) + 0.24 * this.sad;
    if (sleeping) { yawT = 0.12; pitchT = 0.3; rollT = 0.22 + Math.sin(t * 1.3) * 0.03; }
    const prevYaw = this.headYaw;
    this.headYaw = damp(this.headYaw, yawT, 5, dt);
    this.headPitch = damp(this.headPitch, pitchT, 5, dt);
    this.headRoll = damp(this.headRoll, rollT, 4, dt);
    this.head.rotation.set(this.headPitch, this.headYaw * 0.7, this.headRoll);
    this.yaw = damp(this.yaw, this.headYaw * 0.4, 3, dt);
    this.spin = damp(this.spin, this.spinTarget, 6, dt);
    this.root.rotation.set(0, this.yaw + this.spin, Math.sin(t * 1.1) * 0.025 - this.vy * 0.003);

    /* 呆毛 boing */
    const yawVel = (this.headYaw - prevYaw) / Math.max(dt, 1e-4);
    this.ahogeV += (-90 * this.ahoge - 4 * this.ahogeV - yawVel * 5 - this.sv * 0.9 + landed * 2) * dt;
    this.ahoge += this.ahogeV * dt;
    this.ahogeG.rotation.z = clamp(this.ahoge, -0.9, 0.9) + Math.sin(t * 2) * 0.05 - this.sleepy * 0.5;

    /* ears */
    this.nextTwitch -= dt;
    if (this.nextTwitch <= 0 && !sleeping) {
      this.earKickV[Math.random() < 0.5 ? 0 : 1] += rand(12, 18);
      this.nextTwitch = rand(2.5, 6);
    }
    const flatten = Math.max(this.petting ? 0.6 : 0, this.sad * 0.9, this.sleepy * 0.7, this.expr === 'bonk' ? 0.9 : 0);
    this.ears.forEach((e, i) => {
      const side = i ? 1 : -1;
      this.earKickV[i] += (-300 * this.earKick[i] - 12 * this.earKickV[i]) * dt;
      this.earKick[i] += this.earKickV[i] * dt;
      e.rotation.z = -side * (0.42 + flatten * 0.5);
      e.rotation.x = -0.1 - flatten * 0.35 - this.earKick[i] * 0.45;
    });

    /* tail */
    const happy = this.expr === 'happy' || this.cheerT > 0;
    const wagAmp = sleeping ? 0.03 : happy ? 0.34 : this.petting ? 0.12 : 0.17 * (1 - this.sad) + 0.04;
    const wagFreq = sleeping ? 1 : happy ? 9 : this.petting ? 2.4 : 3.2;
    this.wagPhase += (wagFreq + this.flick * 14) * dt;
    const droop = Math.max(this.sad * 0.8, this.sleepy);
    const puff = 1 + this.puff * 0.65;
    for (let i = 0; i < TAIL_N; i++) {
      const s = i / (TAIL_N - 1);
      const curl = smooth(0.7, 1, s);
      const rise = (0.35 * s + 0.8 * s * s * s) * (1 - droop * 0.7);
      const x = 1.22 * Math.sin(s * 1.4) + Math.sin(this.wagPhase - s * 2.4) * (wagAmp + this.flick * 0.3) * s * 1.2 - curl * 0.3;
      const y = 0.5 + rise - droop * 0.15 * s + curl * 0.14;
      const z = -0.3 - 0.16 * Math.sin(s * Math.PI * 0.85);
      this.tail[i].position.set(x, y, z);
      this.tail[i].scale.setScalar(0.085 * (1 - 0.25 * s) * puff);
    }
    for (const m of this.tailHit) m.position.copy(this.tail[m.userData.follow].position);
    // bow sits ~3/4 of the way up, facing the viewer
    const bi = Math.round(TAIL_N * 0.72);
    this.tailBow.position.copy(this.tail[bi].position);
    this.tailBow.position.z += 0.06;
    this.tailBow.scale.setScalar(puff * 0.9 + 0.1);

    /* arms */
    this.arms.forEach((a, i) => {
      const side = i ? 1 : -1;
      let zT = side * (0.85 + Math.sin(t * 1.6 + i) * 0.05);
      let xT = -0.22;
      if (this.vy > 0.5 || this.cheerT > 0) zT = side * 2.3;
      else if (this.petting || this.expr === 'content') { xT = -1.15; zT = -side * 0.12; }
      else if (this.sad > 0.3 || sleeping) { zT = side * 0.45; xT = 0; }
      if (this.waveT > 0 && side === 1) { zT = 2.3 + Math.sin(t * 14) * 0.35; xT = -0.2; }
      this.armZ[i] = damp(this.armZ[i], zT, 10, dt);
      this.armX[i] = damp(this.armX[i], xT, 10, dt);
      a.rotation.set(this.armX[i], 0, this.armZ[i]);
    });

    /* face */
    this.nextBlink -= dt;
    if (this.nextBlink <= 0) { this.blinkT = 0.16; this.nextBlink = rand(2, 5.5); }
    let blink = 0;
    if (this.blinkT > 0) { this.blinkT -= dt; blink = Math.sin((1 - Math.max(this.blinkT, 0) / 0.16) * Math.PI); }

    let eyes = 'open';
    let mouth = 'w';
    const ex = this.expr;
    if (ex === 'happy') { eyes = 'happy'; mouth = 'open'; }
    else if (ex === 'bonk') { eyes = 'bonk'; mouth = 'open'; }
    else if (ex === 'surprise') { mouth = 'open'; }
    else if (ex === 'content' || this.petting || sleeping) { eyes = 'content'; }
    else if (this.sad > 0.4) { mouth = 'frown'; }
    if (this.y > 0.15 && !ex) mouth = 'open';

    const lookX = clamp(yawT - this.headYaw, -1, 1) * 0.025;
    for (const e of this.eyes) {
      e.open.visible = eyes === 'open';
      e.happy.visible = eyes === 'happy';
      e.content.visible = eyes === 'content';
      e.bonk.visible = eyes === 'bonk';
      const wide = ex === 'surprise' ? 1.12 : 1;
      e.open.scale.set(wide, (1 - 0.92 * blink) * (1 - this.sad * 0.22) * wide, 1);
      e.open.position.x = damp(e.open.position.x, lookX, 10, dt);
      e.open.position.y = damp(e.open.position.y, -this.sad * 0.02, 4, dt);
    }
    this.mouth.w.visible = this.mouth.fang.visible = mouth === 'w';
    this.mouth.open.visible = mouth === 'open';
    this.mouth.frown.visible = mouth === 'frown';

    return { landed };
  }
}

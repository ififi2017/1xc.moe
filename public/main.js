import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const $ = (s) => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const easeOutBack = (x) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ */
/* renderer / scene                                                    */
/* ------------------------------------------------------------------ */
const canvas = $('#stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
const camBase = new THREE.Vector3(0, 1.9, 12);
const camLook = new THREE.Vector3(0, 0.75, 0);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.6;

const keyLight = new THREE.DirectionalLight(0xfff2f4, 1.6);
keyLight.position.set(3, 6, 5);
const rimLight = new THREE.DirectionalLight(0xd8c8ff, 1.0);
rimLight.position.set(-5, 3, -4);
scene.add(keyLight, rimLight, new THREE.HemisphereLight(0xfff4fa, 0xe4d9ff, 0.55));

/* ------------------------------------------------------------------ */
/* materials & shared geometry                                         */
/* ------------------------------------------------------------------ */
const jelly = (color) => new THREE.MeshPhysicalMaterial({
  color,
  roughness: 0.4,
  clearcoat: 0.7,
  clearcoatRoughness: 0.2,
  sheen: 0.9,
  sheenRoughness: 0.45,
  sheenColor: new THREE.Color('#ffffff'),
});
const inkMat = new THREE.MeshPhysicalMaterial({ color: '#3a2737', roughness: 0.18, clearcoat: 1 });
const shineMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const blushMat = new THREE.MeshBasicMaterial({ color: '#ff7aa5', transparent: true, opacity: 0.5, depthWrite: false });

const sphereGeo = new THREE.SphereGeometry(1, 24, 16);
const eyeArcGeo = new THREE.TorusGeometry(0.058, 0.018, 8, 20, Math.PI);
const mouthArcGeo = new THREE.TorusGeometry(0.03, 0.012, 8, 16, Math.PI);
const blushGeo = new THREE.CircleGeometry(0.075, 24);

const heartGeo = (() => {
  const s = new THREE.Shape();
  s.moveTo(5, 5);
  s.bezierCurveTo(5, 5, 4, 0, 0, 0);
  s.bezierCurveTo(-6, 0, -6, 7, -6, 7);
  s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  s.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
  s.bezierCurveTo(16, 7, 16, 0, 10, 0);
  s.bezierCurveTo(7, 0, 5, 5, 5, 5);
  const g = new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: true, bevelThickness: 2.4, bevelSize: 2, bevelSegments: 5, curveSegments: 20 });
  g.center();
  g.rotateZ(Math.PI);
  g.scale(0.011, 0.011, 0.011);
  return g;
})();

const starGeo = (() => {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.5 : 1;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.16, bevelSegments: 4 });
  g.center();
  g.scale(0.12, 0.12, 0.12);
  return g;
})();

const shadowTex = (() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(150,80,140,0.42)');
  gr.addColorStop(0.45, 'rgba(150,80,140,0.2)');
  gr.addColorStop(1, 'rgba(150,80,140,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

/* ------------------------------------------------------------------ */
/* the three friends                                                   */
/* ------------------------------------------------------------------ */
const DEFS = [
  {
    key: '1', name: '一一', color: '#ff9fc2', css: 'var(--one)', freq: 587, x: -2.0,
    face: { x: 0, y: 1.36 }, top: 2.32, shadow: [1.5, 0.9],
    lines: ['我是第一名！', '一一在此～', '嘿咻！', '(๑•̀ㅂ•́)و✧', '再戳一下嘛'],
    build(mat) {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.43, 1.45, 12, 32), mat);
      body.position.y = 0.43 + 0.725;
      const flag = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.5, 10, 24), mat);
      flag.position.set(-0.25, 1.86, 0);
      flag.rotation.z = -1.04;
      return [body, flag];
    },
  },
  {
    key: 'x', name: '叉叉', color: '#7fdfb6', css: 'var(--x)', freq: 698, x: -0.12,
    face: { x: 0, y: 0.93 }, top: 1.76, shadow: [1.9, 0.95],
    lines: ['叉叉报到 ✕', '不许戳…好吧再戳一下', '(ﾉ>ω<)ﾉ', '交叉！变身！', '呀～'],
    build(mat) {
      const g = new THREE.CapsuleGeometry(0.39, 1.25, 12, 32);
      const a = new THREE.Mesh(g, mat);
      const b = new THREE.Mesh(g, mat);
      a.position.y = b.position.y = 0.88;
      a.rotation.z = 0.68;
      b.rotation.z = -0.68;
      return [a, b];
    },
  },
  {
    key: 'c', name: '西西', color: '#b19dff', css: 'var(--c)', freq: 784, x: 1.85,
    face: { x: -0.52, y: 1.0 }, top: 1.9, shadow: [2.1, 1.05],
    lines: ['c 是 cute 的 c！', '啊呜～', '(=^･ω･^=)', '想吃小饼干', '西西转圈圈'],
    build(mat) {
      const R = 0.55, r = 0.4, cy = R + r;
      const gap = Math.PI * 0.55;
      const torus = new THREE.Mesh(new THREE.TorusGeometry(R, r, 28, 72, Math.PI * 2 - gap), mat);
      torus.position.y = cy;
      torus.rotation.z = gap / 2;
      const capGeo = new THREE.SphereGeometry(r, 32, 20);
      const caps = [gap / 2, -gap / 2].map((a) => {
        const m = new THREE.Mesh(capGeo, mat);
        m.position.set(Math.cos(a) * R, cy + Math.sin(a) * R, 0);
        return m;
      });
      return [torus, ...caps];
    },
  },
];

const bubbleLayer = $('#bubbles');
const petLines = ['嘿嘿～', '好舒服～', '再摸摸～', '(*´ω`*)', '呼噜噜…', '痒痒的！'];

function makeChar(def, index) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const meshes = def.build(jelly(def.color));
  for (const m of meshes) {
    m.userData.charIndex = index;
    body.add(m);
  }
  body.updateMatrixWorld(true);

  // stick face features onto the surface by raycasting from the front
  const rc = new THREE.Raycaster();
  const origin = new THREE.Vector3();
  const back = new THREE.Vector3(0, 0, -1);
  const place = (obj, x, y, lift = 0) => {
    rc.set(origin.set(x, y, 5), back);
    const hit = rc.intersectObjects(meshes, false)[0];
    if (hit) {
      const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      obj.position.copy(hit.point).addScaledVector(n, lift);
      obj.lookAt(obj.position.clone().add(n));
    } else {
      obj.position.set(x, y, 0.4);
    }
    body.add(obj);
  };

  const { x: fx, y: fy } = def.face;
  const eyes = [], happy = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    const inner = new THREE.Group();
    const ball = new THREE.Mesh(sphereGeo, inkMat);
    ball.scale.set(0.068, 0.092, 0.045);
    const s1 = new THREE.Mesh(sphereGeo, shineMat);
    s1.scale.setScalar(0.023);
    s1.position.set(0.02, 0.03, 0.036);
    const s2 = new THREE.Mesh(sphereGeo, shineMat);
    s2.scale.setScalar(0.011);
    s2.position.set(-0.022, -0.034, 0.037);
    inner.add(ball, s1, s2);
    const h = new THREE.Mesh(eyeArcGeo, inkMat);
    h.position.y = -0.02;
    h.visible = false;
    eye.add(inner, h);
    place(eye, fx + side * 0.14, fy);
    eyes.push(inner);
    happy.push(h);

    const blush = new THREE.Mesh(blushGeo, blushMat);
    blush.scale.x = 1.35;
    place(blush, fx + side * 0.27, fy - 0.11, 0.012);
  }

  const mouthW = new THREE.Group();
  for (const side of [-1, 1]) {
    const a = new THREE.Mesh(mouthArcGeo, inkMat);
    a.rotation.z = Math.PI;
    a.position.x = side * 0.03;
    mouthW.add(a);
  }
  place(mouthW, fx, fy - 0.1, 0.004);
  const mouthO = new THREE.Mesh(sphereGeo, inkMat);
  mouthO.scale.set(0.036, 0.046, 0.02);
  mouthO.visible = false;
  place(mouthO, fx, fy - 0.12);

  const shadow = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false }));
  shadow.position.set(def.x, 0.002, 0);
  shadow.renderOrder = -1;
  scene.add(shadow);

  group.position.x = def.x;
  scene.add(group);

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.style.setProperty('--col', def.css);
  bubble.innerHTML = '<span></span>';
  bubbleLayer.appendChild(bubble);

  return {
    def, index, group, body, meshes, eyes, happy, mouthW, mouthO, shadow,
    bubble, bubbleText: bubble.firstChild,
    y: 4.5 + index * 1.3, vy: 0, // intro drop
    s: 0, sv: 0,
    jumpTimer: 0, jumpPower: 1,
    spin: 0, spinTarget: 0,
    yaw: 0, pitch: 0,
    happyT: 0, sayT: 0, pet: 0, petCooldown: 0,
    blinkT: 0, nextBlink: rand(1, 4),
    nextHop: rand(5, 10), phase: Math.random() * 10,
  };
}

const chars = DEFS.map(makeChar);
const pickMeshes = chars.flatMap((c) => c.meshes);

/* ------------------------------------------------------------------ */
/* floating background bits                                            */
/* ------------------------------------------------------------------ */
const floatMats = ['#ffd3e2', '#cff3e2', '#e2d8ff', '#fff0bd', '#ffe2ee'].map((c) =>
  new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.5, sheen: 1, sheenColor: new THREE.Color('#fff') })
);
const floaters = [];
for (let k = 0; k < (reduceMotion ? 10 : 30); k++) {
  const kind = k % 3;
  const m = new THREE.Mesh(kind === 0 ? sphereGeo : kind === 1 ? heartGeo : starGeo, floatMats[k % floatMats.length]);
  m.scale.setScalar(kind === 0 ? rand(0.07, 0.16) : rand(0.8, 1.8));
  m.position.set(rand(-9, 9), rand(-2.5, 7), rand(-9, -2.5));
  m.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
  floaters.push({ m, vy: rand(0.1, 0.3), rs: rand(-0.8, 0.8), ph: rand(0, 6.28) });
  scene.add(m);
}

/* ------------------------------------------------------------------ */
/* particles                                                           */
/* ------------------------------------------------------------------ */
const pMat = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 });
const particleMats = {
  heart: ['#ff7aa2', '#ff9dbd', '#ff5e8c', '#ffb3cb'].map(pMat),
  star: ['#ffd36e', '#ffe7a0', '#c4b2ff', '#8fe3c0'].map(pMat),
};
const particles = [];

function spawn(kind, pos, vel, { life = 1.3, size = 1, gravity = 5 } = {}) {
  if (particles.length > 260) return;
  const m = new THREE.Mesh(kind === 'heart' ? heartGeo : starGeo, pick(particleMats[kind]));
  m.position.copy(pos);
  m.rotation.z = rand(-0.4, 0.4);
  m.scale.setScalar(0.001);
  scene.add(m);
  particles.push({ m, vel, life, size, gravity, age: 0, spin: new THREE.Vector3(rand(-1, 1), rand(-5, 5), rand(-2, 2)) });
}

function headPos(c, out = new THREE.Vector3()) {
  return out.set(c.group.position.x + c.def.face.x * 0.5, c.group.position.y + c.def.top * c.body.scale.y, 0.2);
}

function burst(c, n = 7) {
  const p = headPos(c);
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const sp = rand(1, 2.6);
    spawn(Math.random() < 0.55 ? 'heart' : 'star', p,
      new THREE.Vector3(Math.cos(a) * sp, rand(3, 5.5), Math.sin(a) * sp * 0.5 + 0.8),
      { life: rand(1.0, 1.6), size: rand(0.8, 1.4) });
  }
}

function heartRain() {
  for (let i = 0; i < 40; i++) {
    setTimeout(() => {
      spawn('heart', new THREE.Vector3(rand(-5, 5), rand(5, 6.5), rand(-1, 1.5)),
        new THREE.Vector3(rand(-0.3, 0.3), rand(-1.5, -0.6), 0),
        { life: 4.2, size: rand(1.2, 2.2), gravity: 1.1 });
    }, i * 55);
  }
  chars.forEach((c, i) => setTimeout(() => { c.happyT = 1.6; say(c, pick(['好多爱心！', '♡♡♡', '萌～！'])); }, 200 + i * 140));
  addMoe(5);
}

/* ------------------------------------------------------------------ */
/* sound (tiny synth, no files)                                        */
/* ------------------------------------------------------------------ */
let audio = null;
let muted = store.get('1xc:muted', false);
const soundBtn = $('#sound');
soundBtn.setAttribute('aria-pressed', String(!muted));
soundBtn.addEventListener('click', () => {
  muted = !muted;
  store.set('1xc:muted', muted);
  soundBtn.setAttribute('aria-pressed', String(!muted));
  if (!muted) { unlockAudio(); blip(880); }
});

function unlockAudio() {
  // iOS 17+: play through the ring/silent switch like a media player would
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  if (!audio) {
    try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
  }
  if (audio.state !== 'running') {
    audio.resume().catch(() => {});
    // older iOS only opens the output after a buffer is started inside a gesture
    const src = audio.createBufferSource();
    src.buffer = audio.createBuffer(1, 1, 22050);
    src.connect(audio.destination);
    src.start(0);
  }
}
// iOS WebKit doesn't count pointerdown as a user gesture for audio — touchend/click do
for (const type of ['touchend', 'click']) {
  window.addEventListener(type, unlockAudio, { passive: true, capture: true });
}

function tone(type, f0, f1, f2, dur, vol) {
  if (muted || !audio) return;
  const t = audio.currentTime;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.35);
  o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(audio.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}
const blip = (f) => { tone('sine', f, f * 1.9, f * 1.3, 0.26, 0.22); tone('triangle', f * 2, f * 3.6, f * 2.4, 0.16, 0.05); };
const plop = () => tone('sine', 260, 170, 120, 0.12, 0.12);
const purr = (f) => tone('sine', f * 0.75, f * 0.9, f * 0.8, 0.18, 0.08);

/* ------------------------------------------------------------------ */
/* moe meter                                                           */
/* ------------------------------------------------------------------ */
const moeEl = $('#moeCount');
let moe = store.get('1xc:moe', 0);
moeEl.textContent = moe;
let saveTimer = 0;
function addMoe(n) {
  moe += n;
  moeEl.textContent = moe;
  moeEl.classList.remove('pop');
  void moeEl.offsetWidth;
  moeEl.classList.add('pop');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => store.set('1xc:moe', moe), 400);
}

/* ------------------------------------------------------------------ */
/* behaviours                                                          */
/* ------------------------------------------------------------------ */
function say(c, text, dur = 1.5) {
  c.bubbleText.textContent = text ?? pick(c.def.lines);
  c.bubble.classList.remove('show');
  void c.bubble.offsetWidth;
  c.bubble.classList.add('show');
  c.sayT = dur;
}

function poke(c, { power = 1, quiet = false, text = null, spin = Math.random() < 0.28, user = true } = {}) {
  if (c.y > 0.05 || c.jumpTimer > 0) {
    if (c.y < 1.2) c.vy = Math.max(c.vy, 5 * Math.min(power, 1));
    c.sv += 4;
  } else {
    c.sv -= 7 * Math.min(power, 1.2);
    c.jumpTimer = 0.085;
    c.jumpPower = power;
  }
  if (spin) c.spinTarget += Math.PI * 2 * (Math.random() < 0.5 ? 1 : -1);
  if (quiet) return;
  c.happyT = 0.9;
  blip(c.def.freq * rand(0.96, 1.04));
  burst(c);
  if (text || Math.random() < 0.65) say(c, text);
  addMoe(1);
  if (user) feed(c.def.key);
}

function celebrate() {
  chars.forEach((c, i) => setTimeout(() => {
    poke(c, { power: 1.3, spin: true, text: ['1！', 'x！', 'c！'][i], user: false });
    burst(c, 12);
  }, i * 170));
  setTimeout(() => { say(chars[2], '1xc.moe ♡', 2.2); heartRain(); }, 900);
  addMoe(10);
}

let seq = '';
let seqTime = 0;
function feed(k) {
  const now = performance.now();
  if (now - seqTime > 1600) seq = '';
  seqTime = now;
  seq = (seq + k).slice(-6);
  if (seq.endsWith('1xc')) { seq = ''; setTimeout(celebrate, 120); }
  if (seq.endsWith('moe')) { seq = ''; heartRain(); }
}

/* ------------------------------------------------------------------ */
/* input                                                               */
/* ------------------------------------------------------------------ */
const pointer = new THREE.Vector2(0, 0);
const raycaster = new THREE.Raycaster();
const lookPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -2.4);
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.3);
const lookTarget = new THREE.Vector3(0, 1.5, 6);
const tmpV = new THREE.Vector3();
let lastMove = -1e9;
let hovered = null;

function setPointer(e) {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / innerHeight) * 2 + 1;
}
function charUnderPointer() {
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(pickMeshes, false)[0];
  return hit ? chars[hit.object.userData.charIndex] : null;
}

window.addEventListener('pointermove', (e) => {
  const px = pointer.x, py = pointer.y;
  setPointer(e);
  lastMove = performance.now();
  hovered = charUnderPointer();
  canvas.style.cursor = hovered ? 'pointer' : 'default';
  if (hovered && (e.pointerType === 'mouse' || e.buttons)) {
    hovered.pet += Math.hypot(pointer.x - px, pointer.y - py);
    if (hovered.pet > 0.32) {
      const c = hovered;
      c.pet = 0;
      c.happyT = 1.0;
      c.sv -= 1.6;
      spawn('heart', headPos(c), new THREE.Vector3(rand(-0.6, 0.6), rand(1.6, 2.4), 0.6), { life: 1.1, size: 1.0, gravity: 1 });
      purr(c.def.freq);
      addMoe(1);
      if (c.petCooldown <= 0) { say(c, pick(petLines)); c.petCooldown = 2.6; }
    }
  }
}, { passive: true });

canvas.addEventListener('pointerdown', (e) => {
  setPointer(e);
  lastMove = performance.now();
  unlockAudio();
  const c = charUnderPointer();
  if (c) return poke(c);
  // tap on empty space → a little sparkle where you tapped
  raycaster.setFromCamera(pointer, camera);
  if (raycaster.ray.intersectPlane(groundPlane, tmpV)) {
    for (let i = 0; i < 4; i++) {
      spawn('star', tmpV, new THREE.Vector3(rand(-1.2, 1.2), rand(1, 2.5), rand(0, 0.6)), { life: 0.9, size: rand(0.6, 1), gravity: 3 });
    }
    tone('sine', 1200, 1800, 1500, 0.12, 0.05);
  }
});

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  const k = e.key.toLowerCase();
  unlockAudio();
  const c = chars.find((ch) => ch.def.key === k);
  if (c) poke(c);
  else if ('moe'.includes(k)) feed(k);
});

document.querySelectorAll('.logo span').forEach((el) => {
  el.addEventListener('pointerdown', () => {
    unlockAudio();
    el.classList.remove('boing');
    void el.offsetWidth;
    el.classList.add('boing');
    const c = chars.find((ch) => ch.def.key === el.dataset.poke);
    if (c) poke(c);
    else feed(el.textContent === '.' ? '' : el.textContent);
  });
});

/* ------------------------------------------------------------------ */
/* layout                                                              */
/* ------------------------------------------------------------------ */
const heroEl = $('.hero');
function resize() {
  const w = innerWidth, h = innerHeight;
  if (!w || !h) return; // hidden tab / zero-size frame: keep the last good camera
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // fit the friends into the space between the top bar and the title
  const top = 72;
  const bottom = Math.max(top + 140, heroEl.getBoundingClientRect().top - 8);
  const avail = bottom - top;
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const halfW = camera.aspect < 0.7 ? 3.0 : 3.25;
  const fitH = 3.0; // world units: ground shadows → just above the tallest head
  const dist = Math.max((fitH * h) / (2 * t * avail), halfW / (t * camera.aspect), 9);
  camBase.set(0, 1.9 + dist * 0.02, dist);
  camLook.y = 1.2;
  // shift the projection so the scene's centre lands in the middle of that space
  camera.setViewOffset(w, h, 0, h / 2 - (top + bottom) / 2, w, h);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
document.fonts?.ready.then(resize);

/* ------------------------------------------------------------------ */
/* loop                                                                */
/* ------------------------------------------------------------------ */
const clock = new THREE.Clock();
let time = 0;
const proj = new THREE.Vector3();

function updateChar(c, dt, idle) {
  // timers
  if (c.jumpTimer > 0) {
    c.jumpTimer -= dt;
    if (c.jumpTimer <= 0) { c.vy = 7.2 * c.jumpPower; c.sv += 9; }
  }
  c.happyT -= dt;
  c.petCooldown -= dt;
  if (c.sayT > 0) { c.sayT -= dt; if (c.sayT <= 0) c.bubble.classList.remove('show'); }

  // idle hops
  if (idle && !reduceMotion) {
    c.nextHop -= dt;
    if (c.nextHop <= 0) { c.nextHop = rand(4, 9); poke(c, { power: rand(0.45, 0.7), quiet: true, spin: Math.random() < 0.15 }); }
  }

  // gravity & landing
  c.vy -= 26 * dt;
  c.y += c.vy * dt;
  if (c.y < 0) {
    if (c.vy < -2) {
      c.sv -= Math.min(11, -c.vy * 0.85);
      if (c.vy < -4) plop();
    }
    c.y = 0;
    c.vy = 0;
  }

  // squash & stretch spring
  c.sv += (-260 * c.s - 11 * c.sv) * dt;
  c.s = clamp(c.s + c.sv * dt, -0.45, 0.6);

  const breathe = Math.sin(time * (hovered === c ? 5 : 2.2) + c.phase) * (hovered === c ? 0.035 : 0.016);
  const sy = 1 + c.s + breathe;
  const sxz = 1 - c.s * 0.45 - breathe * 0.5;
  c.body.scale.set(sxz, sy, sxz);
  c.group.position.y = c.y;

  // look at the pointer (or wander when idle)
  const hx = c.group.position.x + c.def.face.x;
  const hy = c.y + c.def.face.y;
  const yawT = clamp(Math.atan2(lookTarget.x - hx, lookTarget.z), -0.65, 0.65);
  const pitchT = clamp(Math.atan2(hy - lookTarget.y, lookTarget.z) * 0.45, -0.22, 0.28);
  c.yaw = damp(c.yaw, yawT, 6, dt);
  c.pitch = damp(c.pitch, pitchT, 6, dt);
  c.spin = damp(c.spin, c.spinTarget, 7, dt);
  c.group.rotation.set(c.pitch, c.yaw + c.spin, Math.sin(time * 1.3 + c.phase) * 0.035 - c.vy * 0.004);

  // face
  c.nextBlink -= dt;
  if (c.nextBlink <= 0) { c.blinkT = 0.16; c.nextBlink = rand(2, 5.5); }
  let blink = 0;
  if (c.blinkT > 0) { c.blinkT -= dt; blink = Math.sin((1 - Math.max(c.blinkT, 0) / 0.16) * Math.PI); }
  const isHappy = c.happyT > 0;
  for (let i = 0; i < 2; i++) {
    c.eyes[i].visible = !isHappy;
    c.happy[i].visible = isHappy;
    c.eyes[i].scale.y = 1 - 0.9 * blink;
    c.eyes[i].position.x = damp(c.eyes[i].position.x, clamp(yawT - c.yaw, -1, 1) * 0.02, 10, dt);
  }
  const open = c.y > 0.08 || c.sayT > 0.9;
  c.mouthO.visible = open;
  c.mouthW.visible = !open;

  // blob shadow
  const k = 1 / (1 + c.y * 0.45);
  c.shadow.scale.set(c.def.shadow[0] * k * sxz, 1, c.def.shadow[1] * k * sxz);
  c.shadow.material.opacity = 0.35 + 0.65 * k;

  // speech bubble follows the head
  if (c.sayT > 0) {
    headPos(c, proj);
    proj.y += 0.15;
    proj.project(camera);
    const x = (proj.x * 0.5 + 0.5) * innerWidth;
    const y = (-proj.y * 0.5 + 0.5) * innerHeight;
    c.bubble.style.transform = `translate(${x.toFixed(1)}px, ${(y - 18).toFixed(1)}px)`;
  }
}

const camPos = camBase.clone();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  time += dt;
  const idle = performance.now() - lastMove > 3500;

  // where everyone looks
  if (idle) {
    tmpV.set(Math.sin(time * 0.45) * 2.2, 1.5 + Math.sin(time * 0.7) * 0.5, 6);
  } else {
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(lookPlane, tmpV)) tmpV.set(0, 1.5, 6);
  }
  lookTarget.lerp(tmpV, 1 - Math.exp(-8 * dt));

  for (const c of chars) updateChar(c, dt, idle);

  // floaters
  for (const f of floaters) {
    f.m.position.y += f.vy * dt;
    f.m.position.x += Math.sin(time * 0.6 + f.ph) * 0.12 * dt;
    f.m.rotation.y += f.rs * dt;
    f.m.rotation.x += f.rs * 0.5 * dt;
    if (f.m.position.y > 7.5) { f.m.position.y = -3; f.m.position.x = rand(-9, 9); }
  }

  // particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    const k = p.age / p.life;
    if (k >= 1) { scene.remove(p.m); particles.splice(i, 1); continue; }
    p.vel.y -= p.gravity * dt;
    p.vel.multiplyScalar(1 - 1.4 * dt);
    p.m.position.addScaledVector(p.vel, dt);
    p.m.rotation.x += p.spin.x * dt;
    p.m.rotation.y += p.spin.y * dt;
    p.m.rotation.z += p.spin.z * dt;
    const grow = easeOutBack(Math.min(1, p.age / 0.2));
    const fade = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
    p.m.scale.setScalar(Math.max(0.001, p.size * grow * fade));
  }

  // gentle parallax
  if (!Number.isFinite(camPos.x + camPos.y)) camPos.copy(camBase);
  camPos.x = damp(camPos.x, camBase.x + pointer.x * 0.45, 3, dt);
  camPos.y = damp(camPos.y, camBase.y + pointer.y * 0.3, 3, dt);
  camPos.z = camBase.z;
  camera.position.copy(camPos);
  camera.lookAt(camLook);

  renderer.render(scene, camera);
});

requestAnimationFrame(() => document.body.classList.add('ready'));

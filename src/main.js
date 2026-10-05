import './style.css';
import * as THREE from 'three';
import { createStage } from './stage.js';
import { Catgirl } from './catgirl.js';
import { DIALECTS, LINES } from './lines.js';
import * as sfx from './audio.js';

const $ = (s) => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const hero = $('.hero');
const canvas = $('#stage');
const stage = createStage(canvas, { reduceMotion });
const { renderer, scene, camera } = stage;
const cat = new Catgirl(scene);

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => {
    cat.setView(Number(button.dataset.view));
    activity();
    document.querySelectorAll('[data-view]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
  });
});

/* ------------------------------------------------------------------ */
/* dialect & speech                                                    */
/* ------------------------------------------------------------------ */
let dialect = store.get('1xc:dialect', 'henan');
if (!LINES[dialect]) dialect = 'henan';
const line = (key) => {
  const v = LINES[dialect][key] ?? LINES.henan[key];
  return Array.isArray(v) ? pick(v) : v;
};

const bubble = $('#bubble');
const bubbleText = bubble.firstElementChild;
let sayT = 0;
function say(text, dur = 1.9, force = false) {
  if (!force && performance.now() - wokeAt < 1200) return;
  bubbleText.textContent = text;
  bubble.classList.remove('show');
  void bubble.offsetWidth;
  bubble.classList.add('show');
  sayT = dur;
}

const dialectBtn = $('#dialectBtn');
const dialectMenu = $('#dialectMenu');
function renderDialect() {
  $('#dialectShort').textContent = DIALECTS.find((d) => d.id === dialect).short;
  dialectMenu.innerHTML = DIALECTS.map((d) =>
    `<li><button type="button" role="option" data-id="${d.id}" aria-selected="${d.id === dialect}"><b>${d.short}</b>${d.label}</button></li>`).join('');
}
function toggleMenu(open = dialectMenu.hidden) {
  dialectMenu.hidden = !open;
  dialectBtn.setAttribute('aria-expanded', String(open));
}
dialectBtn.addEventListener('click', () => toggleMenu());
dialectMenu.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-id]');
  if (!b) return;
  dialect = b.dataset.id;
  store.set('1xc:dialect', dialect);
  renderDialect();
  toggleMenu(false);
  activity();
  cat.wave();
  say(line('switch'), 1.9, true);
  sfx.meow(rand(0.95, 1.1));
});
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.dialect')) toggleMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleMenu(false); });
renderDialect();

/* ------------------------------------------------------------------ */
/* sound & moe meter                                                   */
/* ------------------------------------------------------------------ */
const soundBtn = $('#sound');
sfx.setMuted(store.get('1xc:muted', false));
soundBtn.setAttribute('aria-pressed', String(!sfx.isMuted()));
soundBtn.addEventListener('click', () => {
  sfx.setMuted(!sfx.isMuted());
  store.set('1xc:muted', sfx.isMuted());
  soundBtn.setAttribute('aria-pressed', String(!sfx.isMuted()));
  sfx.ding();
});

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
/* 寂寞小猫: the longer you're away, the lonelier she gets              */
/* ------------------------------------------------------------------ */
const LONELY_AT = [20, 40, 60, 80, 100]; // seconds of quiet before each stage
let quiet = 0;
let lonely = 0;
let introDone = false;
let wokeAt = -1e9;

function activity() {
  quiet = 0;
  if (lonely === 0) return;
  lonely = 0;
  wokeAt = performance.now();
  cat.setLonely(0);
  cat.setExpr('happy', 1.2);
  cat.poke(0.7, false);
  say(line('back'), 2.4, true);
  sfx.meow(1.1);
}

function tickLonely(dt) {
  if (!introDone || document.hidden || !heroVisible || lonely >= 5) return;
  quiet += dt;
  if (quiet < LONELY_AT[lonely]) return;
  lonely++;
  cat.setLonely(lonely);
  say((LINES[dialect].lonely ?? LINES.henan.lonely)[lonely - 1], 3.4);
  if (lonely === 1) { cat.wave(); cat.poke(0.5, false); }
  if (lonely < 5) sfx.meow(lonely >= 3 ? 0.82 : 1);
}

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = performance.now(); return; }
  if (introDone && performance.now() - hiddenAt > 15000 && lonely === 0) {
    lonely = 1; // pretend she missed you, so activity() greets you back
    activity();
  }
});

/* ------------------------------------------------------------------ */
/* reactions                                                           */
/* ------------------------------------------------------------------ */
const tmp = new THREE.Vector3();
let petCooldown = 0;

function react(zone, side) {
  activity();
  cat.react(zone, side);
  const top = cat.headTop(tmp);
  switch (zone) {
    case 'head': say(line('head')); sfx.blip(520); break;
    case 'chin': say(line('chin')); break;
    case 'ear': say(line('ear')); sfx.blip(880); break;
    case 'tail': say(line('tail')); sfx.blip(440); break;
    case 'bell': say(line('bell')); sfx.ding(); stage.burst(top, 5); break;
    default:
      if (Math.random() < 0.35) sfx.meow(rand(0.95, 1.15)); else sfx.blip(rand(620, 700));
      if (Math.random() < 0.75) say(line('poke'));
      stage.burst(top, 7);
  }
  addMoe(1);
}

function petTick(zone) {
  activity();
  cat.petTick();
  stage.spawn('heart', cat.headTop(tmp), new THREE.Vector3(rand(-0.6, 0.6), rand(1.5, 2.3), 0.6), { life: 1.1, size: 1, gravity: 1 });
  addMoe(1);
  if (petCooldown <= 0) {
    say(line(zone === 'chin' ? 'chin' : 'pet'));
    petCooldown = 3;
  }
}

function celebrate() {
  activity();
  cat.celebrate();
  say(line('celebrate'), 2.4);
  sfx.meow(1.15);
  setTimeout(() => sfx.ding(), 250);
  stage.burst(cat.headTop(tmp), 16);
  setTimeout(heartRain, 500);
  addMoe(10);
}

function heartRain() {
  for (let i = 0; i < 40; i++) {
    setTimeout(() => {
      stage.spawn('heart', new THREE.Vector3(rand(-4, 4), rand(4.5, 6), rand(-1, 1.5)),
        new THREE.Vector3(rand(-0.3, 0.3), rand(-1.5, -0.6), 0), { life: 4, size: rand(1.2, 2.2), gravity: 1.1 });
    }, i * 55);
  }
  cat.setExpr('happy', 1.6);
  setTimeout(() => say(line('rain')), 400);
  addMoe(5);
}

let seq = '';
let seqTime = 0;
function feed(k) {
  const now = performance.now();
  if (now - seqTime > 1600) seq = '';
  seqTime = now;
  seq = (seq + k).slice(-6);
  if (seq.endsWith('1xc')) { seq = ''; setTimeout(celebrate, 100); }
  else if (seq.endsWith('moe')) { seq = ''; activity(); heartRain(); }
  else if (/(nya|miao|meow)$/.test(seq)) { seq = ''; activity(); cat.setExpr('happy', 0.8); say(line('meow')); sfx.meow(rand(1, 1.2)); }
}

/* ------------------------------------------------------------------ */
/* input                                                               */
/* ------------------------------------------------------------------ */
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let lastMove = -1e9;
let hoverZone = null;

function setPointer(e) {
  const r = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}

function zoneAt() {
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(cat.hit, false)[0];
  if (!hit) return null;
  let zone = hit.object.userData.zone;
  if (zone === 'head') {
    if (cat.isChin(hit.point)) zone = 'chin';
  }
  return { zone, side: hit.object.userData.side ?? 1 };
}

let petAccum = 0;
window.addEventListener('pointermove', (e) => {
  activity();
  if (e.target !== canvas) return;
  const px = pointer.x, py = pointer.y;
  setPointer(e);
  lastMove = performance.now();
  const z = zoneAt();
  hoverZone = z?.zone ?? null;
  canvas.style.cursor = hoverZone ? (hoverZone === 'head' || hoverZone === 'chin' ? 'grab' : 'pointer') : 'default';
  if (z && ['head', 'chin', 'ear'].includes(z.zone) && (e.pointerType === 'mouse' || e.buttons)) {
    petAccum += Math.hypot(pointer.x - px, pointer.y - py);
    if (petAccum > 0.22) { petAccum = 0; petTick(z.zone); }
  }
}, { passive: true });

canvas.addEventListener('pointerdown', (e) => {
  setPointer(e);
  lastMove = performance.now();
  const z = zoneAt();
  if (z) return react(z.zone, z.side);
  activity();
  // tap on empty space → a little sparkle where you tapped
  raycaster.setFromCamera(pointer, camera);
  if (raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.3), tmp)) {
    for (let i = 0; i < 4; i++) {
      stage.spawn('star', tmp, new THREE.Vector3(rand(-1.2, 1.2), rand(1, 2.5), rand(0, 0.6)), { life: 0.9, size: rand(0.6, 1), gravity: 3 });
    }
    sfx.sparkle();
  }
});

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
  if (e.target.closest?.('input, textarea, [contenteditable]')) return;
  activity();
  const k = e.key.toLowerCase();
  if (k.length === 1 && /[a-z0-9]/.test(k)) {
    if ('1xc'.includes(k)) { cat.poke(0.8, false); sfx.blip(rand(620, 700)); }
    feed(k);
  }
});
window.addEventListener('scroll', activity, { passive: true });
// any tap anywhere counts as "主人在" (pointermove alone misses touch and keyboard users)
window.addEventListener('pointerdown', activity, { passive: true, capture: true });

document.querySelectorAll('.logo span').forEach((el) => {
  el.addEventListener('pointerdown', () => {
    el.classList.remove('boing');
    void el.offsetWidth;
    el.classList.add('boing');
    if (el.dataset.key) { cat.poke(0.8, false); sfx.blip(rand(620, 700)); feed(el.dataset.key); activity(); }
    else { activity(); heartRain(); }
  });
});

$('#copyBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  try {
    await navigator.clipboard.writeText($('#installPrompt').textContent);
    btn.textContent = '已复制 ✓';
  } catch {
    getSelection().selectAllChildren($('#installPrompt'));
    btn.textContent = '请手动复制';
  }
  sfx.ding();
  setTimeout(() => { btn.textContent = '复制'; }, 1800);
});

/* ------------------------------------------------------------------ */
/* layout: fit 猫猫 into the space above the title                      */
/* ------------------------------------------------------------------ */
const camBase = new THREE.Vector3(0, 3.1, 18);
const camLook = new THREE.Vector3(0, 3.05, 0);
const heroText = $('.hero-text');
let closeup = true; // upper body by default: bigger face, easier to pat on phones
$('#closeup').addEventListener('click', (e) => {
  closeup = !closeup;
  e.currentTarget.setAttribute('aria-pressed', String(closeup));
  e.currentTarget.textContent = closeup ? '全身' : '近看';
  activity();
  resize();
});

function resize() {
  const w = hero.clientWidth, h = hero.clientHeight;
  if (!w || !h) return; // hidden / zero-size frame: keep the last good camera
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const top = 76;
  const bottom = Math.max(top + 180, heroText.offsetTop - 6);
  canvas.style.clipPath = closeup ? `inset(0 0 ${Math.max(0, h - bottom)}px 0)` : '';
  const avail = bottom - top;
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  // dev-only ?face: a tight portrait for comparing against the face reference sheet
  const face = import.meta.env.DEV && new URLSearchParams(location.search).has('face');
  const fitH = face ? 1.55 : closeup ? 3.65 : cat.height + 0.55;
  const halfW = face ? 0.75 : closeup ? 1.4 : 1.85;
  const dist = Math.max((fitH * h) / (2 * t * avail), halfW / (t * camera.aspect), 7);
  camLook.y = face ? 5.08 : closeup ? 4.5 : 3.05;
  camBase.set(0, camLook.y + 0.05 + dist * 0.006, dist);
  camera.setViewOffset(w, h, 0, h / 2 - (top + bottom) / 2, w, h);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
document.fonts?.ready.then(resize);

// checked every frame: an IntersectionObserver can get stuck "not visible" if the
// page first loads in a zero-size frame (background tab, collapsed iframe)
let heroVisible = true;

/* ------------------------------------------------------------------ */
/* loop                                                                */
/* ------------------------------------------------------------------ */
const timer = new THREE.Timer();
timer.connect(document);
let time = 0;
let zzzT = 0;
const lookTarget = new THREE.Vector3(0, 5.03, 6);
const lookPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -2.4);
const proj = new THREE.Vector3();
const camPos = camBase.clone();

renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(timer.getDelta(), 1 / 30);
  const rect = hero.getBoundingClientRect();
  heroVisible = rect.bottom > 0 && rect.top < innerHeight;
  if (!heroVisible) return;
  time += dt;

  // where she looks
  if (performance.now() - lastMove > 3500) {
    tmp.set(Math.sin(time * 0.45) * 1.1, 5.03 + Math.sin(time * 0.7) * 0.2, 6);
  } else {
    raycaster.setFromCamera(pointer, camera);
    if (!raycaster.ray.intersectPlane(lookPlane, tmp)) tmp.set(0, 5.03, 6);
  }
  lookTarget.lerp(tmp, 1 - Math.exp(-8 * dt));

  const { landed } = cat.update(dt, time, lookTarget);
  if (landed > 4) sfx.plop();
  if (!introDone && cat.y === 0 && time > 0.8) {
    introDone = true;
    setTimeout(() => { cat.wave(); say(line('greet'), 2.6); }, 350);
  }

  // purr while being petted
  sfx.setPurr(Math.max(0, cat.pet - 0.15));
  petCooldown -= dt;

  // Zzz…
  if (cat.sleeping) {
    zzzT -= dt;
    if (zzzT <= 0) {
      zzzT = 1.3;
      stage.spawn('z', cat.headTop(proj).add(tmp.set(0.35, 0.05, 0.2)), new THREE.Vector3(0.25, 0.55, 0), { life: 2.6, size: 0.42, gravity: 0 });
    }
  }
  tickLonely(dt);
  stage.update(dt, time);

  // blob shadow follows the jump
  const k = 1 / (1 + cat.y * 0.45);
  stage.shadow.scale.set(1.7 * k, 1, 1.15 * k);
  stage.shadow.material.opacity = 0.35 + 0.65 * k;

  // gentle parallax
  camPos.x = damp(camPos.x, camBase.x + pointer.x * 0.4, 3, dt);
  camPos.y = damp(camPos.y, camBase.y + pointer.y * 0.25, 3, dt);
  camPos.z = camBase.z;
  if (!Number.isFinite(camPos.x + camPos.y)) camPos.copy(camBase);
  camera.position.copy(camPos);
  camera.lookAt(camLook);

  // speech bubble follows her head
  if (sayT > 0) {
    sayT -= dt;
    if (sayT <= 0) bubble.classList.remove('show');
    cat.headTop(proj);
    proj.y += 0.18;
    proj.project(camera);
    const w = hero.clientWidth;
    const half = bubbleText.offsetWidth / 2 + 10;
    const x = Math.min(Math.max((proj.x * 0.5 + 0.5) * w, half), w - half);
    const y = (-proj.y * 0.5 + 0.5) * hero.clientHeight;
    bubble.style.transform = `translate(${x.toFixed(1)}px, ${(y - 14).toFixed(1)}px)`;
  }

  renderer.render(scene, camera);
});

requestAnimationFrame(() => document.body.classList.add('ready'));

// dev-only hooks for poking at her from the console (stripped from production builds)
if (import.meta.env.DEV) {
  window.__1xc = {
    cat,
    stage,
    zoneAtClient(x, y) { setPointer({ clientX: x, clientY: y }); return zoneAt(); },
    react,
    petTick,
    skipQuiet(sec) { quiet += sec; },
    state: () => ({ lonely, quiet: +quiet.toFixed(1), dialect, sayT: +sayT.toFixed(2), text: bubbleText.textContent }),
  };
}

import './style.css';
import { createSpriteStage } from './sprite-stage.js';
import { SpriteCharacter } from './sprite-character.js';
import { DIALECTS, LINES } from './lines.js';
import * as sfx from './audio.js';
import { speechPlan, VOICE_STEPS } from './speech.js';

const $ = (s) => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  || (import.meta.env.DEV && new URLSearchParams(location.search).has('reduced'));

const hero = $('.hero');
const canvas = $('#stage');
const cat = new SpriteCharacter({ reduceMotion });
const stage = createSpriteStage(canvas, cat, { reduceMotion });
let ready = false;
let debugControls;

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
const bubbleSaid = bubble.querySelector('.said');
const bubbleRest = bubble.querySelector('.rest');
const bubbleSr = $('#bubbleSr');

let speech = null;
let sayT = 0;
function say(text, dur = 1.9, force = false) {
  if (!force && performance.now() - wokeAt < 1200) return;
  const plan = speechPlan(text);
  speech = { plan, i: 0, wait: 0.06, said: '', syllable: 0 };
  bubbleSaid.textContent = '';
  bubbleRest.textContent = text;
  bubbleSr.textContent = text;
  bubble.classList.remove('show');
  void bubble.offsetWidth;
  bubble.classList.add('show');
  // keep the bubble up for the whole line plus a moment to read it
  sayT = Math.max(dur, plan.reduce((t, s) => t + s.delay, 0.06) + 1.3);
}

function advanceSpeech(dt) {
  if (!speech) return false;
  speech.wait -= dt;
  let changed = false;
  while (speech.wait <= 0 && speech.i < speech.plan.length) {
    const s = speech.plan[speech.i++];
    speech.said += s.ch;
    changed = true;
    if (s.voiced && !document.hidden) {
      const step = VOICE_STEPS[speech.syllable++ % VOICE_STEPS.length] * (0.97 + Math.random() * 0.06);
      sfx.voice(680 * step * (s.rising ? 1.25 : 1));
    }
    speech.wait += s.delay;
  }
  if (changed) {
    bubbleSaid.textContent = speech.said;
    bubbleRest.textContent = speech.plan.slice(speech.i).map((s) => s.ch).join('');
  }
  if (speech.i >= speech.plan.length) speech = null;
  return true;
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
  cat.wave();
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
  if (lonely === 1) cat.poke(0.5);
  if (lonely < 5) sfx.meow(lonely >= 3 ? 0.82 : 1);
}

let hiddenAt = 0;

// While the tab is in the background, its title becomes 寂寞小猫: a new line every
// 20 s, ending with her asleep. The stage is worked out from how long you've been
// away, so throttled background timers can only delay an update, never skip one.
const BASE_TITLE = document.title;
const TITLE_STEP = 20;
let titleTimer = 0;
function awayTitle() {
  const lines = LINES[dialect].lonely ?? LINES.henan.lonely;
  const away = (performance.now() - hiddenAt) / 1000;
  const stage = Math.min(lines.length - 1, Math.max(lonely - 1, Math.floor(away / TITLE_STEP)));
  document.title = `${stage === lines.length - 1 ? '💤' : '🐾'} ${lines[stage]}`;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = performance.now();
    awayTitle();
    clearInterval(titleTimer);
    titleTimer = setInterval(awayTitle, 1000);
    return;
  }
  clearInterval(titleTimer);
  document.title = BASE_TITLE;
  if (introDone && performance.now() - hiddenAt > 15000 && lonely === 0) {
    lonely = 1; // pretend she missed you, so activity() greets you back
    activity();
  }
});

/* ------------------------------------------------------------------ */
/* reactions                                                           */
/* ------------------------------------------------------------------ */
let petCooldown = 0;
let heartCooldown = 0;

function react(zone, side) {
  activity();
  cat.react(zone, side);
  const top = stage.headTop();
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
  // continuous stroking fires many ticks a second; keep hearts and moe at a gentle pace
  if (heartCooldown <= 0) {
    stage.spawn('heart', stage.headTop(), { x: rand(-35, 35), y: rand(-100, -65) }, { life: 1.1, size: 18, gravity: 20 });
    addMoe(1);
    heartCooldown = 0.35;
  }
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
  stage.burst(stage.headTop(), 16);
  setTimeout(heartRain, 500);
  addMoe(10);
}

function heartRain() {
  for (let i = 0; i < 40; i++) {
    setTimeout(() => {
      stage.spawn('heart', { x: rand(0, stage.width), y: rand(50, 120) },
        { x: rand(-15, 15), y: rand(25, 60) }, { life: 4, size: rand(14, 26), gravity: 15 });
    }, i * 55);
  }
  cat.celebrate();
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
  else if (/(nya|miao|meow)$/.test(seq)) { seq = ''; activity(); cat.wink(); say(line('meow')); sfx.meow(rand(1, 1.2)); }
}

/* ------------------------------------------------------------------ */
/* input                                                               */
/* ------------------------------------------------------------------ */
const pointer = { x: 0, y: 0 };
let pointerSeen = false;
let petAccum = 0;

function setPointer(e) {
  const r = canvas.getBoundingClientRect();
  pointer.x = e.clientX - r.left;
  pointer.y = e.clientY - r.top;
}

function zoneAt() { return stage.zoneAt(pointer); }

window.addEventListener('pointermove', (e) => {
  activity();
  if (e.target !== canvas || !ready) { pointerSeen = false; petAccum = 0; return; }
  const previous = { ...pointer };
  setPointer(e);
  const z = zoneAt();
  canvas.style.cursor = z ? (['head', 'chin'].includes(z.zone) ? 'grab' : 'pointer') : 'default';
  if (pointerSeen && z && ['head', 'chin', 'ear'].includes(z.zone) && (e.pointerType === 'mouse' || e.buttons)) {
    petAccum += Math.hypot(pointer.x - previous.x, pointer.y - previous.y);
    if (petAccum > 42) { petAccum = 0; petTick(z.zone); }
  } else petAccum = 0;
  pointerSeen = true;
}, { passive: true });
canvas.addEventListener('pointerleave', () => { pointerSeen = false; petAccum = 0; });

canvas.addEventListener('pointerdown', (e) => {
  if (!ready) return;
  setPointer(e);
  const z = zoneAt();
  if (z) return react(z.zone, z.side);
  activity();
  for (let i = 0; i < 4; i++) {
    stage.spawn('star', pointer, { x: rand(-60, 60), y: rand(-100, -40) }, { life: 0.9, size: rand(12, 20), gravity: 50 });
  }
  sfx.sparkle();
});

// The same interactions are reachable with touch and keyboard, without having
// to locate a small bell or chin in the artwork.
document.querySelectorAll('[data-pet]').forEach((button) => {
  button.addEventListener('click', () => {
    if (!ready) return;
    const zone = button.dataset.pet;
    if (zone === 'bell') react(zone); else petTick(zone);
  });
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
/* sprite layout and animation                                         */
/* ------------------------------------------------------------------ */
const heroText = $('.hero-text');
function resize() {
  const w = hero.clientWidth, h = hero.clientHeight;
  if (!w || !h) return;
  const top = 88;
  const wide = w >= 900;
  const bottom = wide ? h - 22 : Math.max(top + 160, heroText.offsetTop - 12);
  stage.resize(w, h, top, bottom, wide ? w * 0.44 : 0, wide ? w * 0.53 : w);
}
addEventListener('resize', resize);
new ResizeObserver(resize).observe(heroText);
resize();
document.fonts?.ready.then(resize);

let heroVisible = true;
let lastTime = performance.now();
let time = 0;
let zzzT = 0;
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(Math.max(0, (now - lastTime) / 1000), 1 / 30);
  lastTime = now;
  const rect = hero.getBoundingClientRect();
  heroVisible = rect.bottom > 0 && rect.top < innerHeight;
  if (!heroVisible || document.hidden || !ready) { sfx.setPurr(0); return; }
  time += dt;
  if (!introDone && time > 0.8) {
    introDone = true;
    cat.wave();
    say(line('greet'), 2.6);
  }
  if (!debugControls?.holding) tickLonely(dt);
  // the mouth moves while the words are still coming out, not for the whole bubble
  const speaking = advanceSpeech(dt);
  cat.update(dt, speaking || debugControls?.talking);
  sfx.setPurr(Math.max(0, cat.pet - 0.15));
  petCooldown -= dt;
  heartCooldown -= dt;
  if (cat.sleeping) {
    zzzT -= dt;
    if (zzzT <= 0) {
      zzzT = 1.3;
      const top = stage.headTop();
      stage.spawn('z', { x: top.x + 45, y: top.y + 20 }, { x: 12, y: -26 }, { life: 2.6, size: 18, gravity: 0 });
    }
  } else zzzT = 0;
  stage.draw(dt);

  if (sayT > 0) {
    sayT -= dt;
    if (sayT <= 0) bubble.classList.remove('show');
    const top = stage.headTop();
    const half = bubbleText.offsetWidth / 2 + 10;
    const x = Math.min(Math.max(top.x, half), hero.clientWidth - half);
    const y = Math.max(bubbleText.offsetHeight + 18, top.y - 6);
    bubble.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }
}
requestAnimationFrame(animate);

async function loadCharacter() {
  const error = $('#spriteError');
  error.hidden = true;
  document.body.classList.remove('load-error');
  try {
    await stage.init();
    ready = true;
    document.body.classList.add('ready');
    stage.preload();
    document.querySelectorAll('[data-pet]').forEach((button) => { button.disabled = false; });
  } catch (cause) {
    console.error('立绘加载失败', cause);
    document.body.classList.add('load-error');
    error.hidden = false;
  }
}
$('#retrySprite').addEventListener('click', loadCharacter);
void loadCharacter();

if (import.meta.env.DEV) {
  window.__1xc = {
    cat, stage,
    zoneAtClient(x, y) { setPointer({ clientX: x, clientY: y }); return zoneAt(); },
    react, petTick,
    skipQuiet(sec) { quiet += sec; },
    state: () => ({ ready, sprite: cat.frame, loaded: stage.loaded, lonely, quiet: +quiet.toFixed(1), dialect, sayT: +sayT.toFixed(2), text: bubbleSr.textContent }),
  };
  if (new URLSearchParams(location.search).has('sprite-test')) {
    const panel=document.createElement('details');
    panel.style.cssText='position:fixed;bottom:8px;left:8px;right:8px;z-index:9999;padding:10px;background:#fff5f9ed;border:1px solid #e3cbdc;border-radius:12px;color:#604758;font:12px system-ui';
    panel.open=true;
    const title=document.createElement('summary'); title.textContent='姿势验收（仅开发环境）';
    const controls=document.createElement('div'); controls.style.cssText='display:flex;gap:7px;flex-wrap:wrap;padding-top:8px';
    panel.append(title,controls); document.body.append(panel);
    import('./sprite-debug.js').then(({attachSpriteControls}) => {
      debugControls=attachSpriteControls(controls,cat,stage,{wake:() => {activity();cat.setLonely(0);},heartRain});
    });
    canvas.addEventListener('pointermove',() => { canvas.dataset.hit=zoneAt()?.zone??'transparent'; });
    canvas.addEventListener('pointerdown',() => { canvas.dataset.hit=zoneAt()?.zone??'transparent'; });
  }
}

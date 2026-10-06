import './style.css';
import './fonts.css';
import { createSpriteStage } from './sprite-stage.js';
import { SpriteCharacter } from './sprite-character.js';
import { DIALECTS, LINES } from './lines.js';
import { LOCALES, MESSAGES, localeByCode, preferredLocale } from './i18n/index.js';
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
/* language, dialect & speech                                          */
/* ------------------------------------------------------------------ */
// the page is pre-rendered per language; <html lang> says which one this is
const locale = localeByCode(document.documentElement.lang);
const ui = MESSAGES[locale.code].ui;
const hasDialects = locale.code === 'zh-CN';
let dialect = store.get('1xc:dialect', 'henan');
if (!LINES[dialect]) dialect = 'henan';
const lines = () => (hasDialects ? LINES[dialect] : MESSAGES[locale.code].lines);
const line = (key) => {
  const v = lines()[key] ?? LINES.henan[key];
  return Array.isArray(v) ? pick(v) : v;
};

const bubble = $('#bubble');
const bubbleText = bubble.firstElementChild;
const bubbleSaid = bubble.querySelector('.said');
const bubbleRest = bubble.querySelector('.rest');
const bubbleSr = $('#bubbleSr');

let speech = null;
let sayT = 0;
let sulkUntil = 0; // while she's telling you off, other chatter waits
function say(text, dur = 1.9, force = false) {
  if (!force && (performance.now() - wokeAt < 1200 || performance.now() < sulkUntil)) return;
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

// one menu: languages (links to the pre-rendered pages) and, on the
// Simplified Chinese page, the dialects underneath
const langBtn = $('#langBtn');
const langMenu = $('#langMenu');
function renderMenu() {
  $('#langShort').textContent = hasDialects ? DIALECTS.find((d) => d.id === dialect).short : locale.short;
  const langs = LOCALES.map((l) =>
    `<li><a href="${l.path}" lang="${l.code}" data-lang="${l.code}"${l.code === locale.code ? ' aria-current="page"' : ''}><b>${l.short}</b>${l.label}</a></li>`).join('');
  const dialects = hasDialects ? `<p class="menu-heading">${ui.dialectsHeading}</p><ul>${DIALECTS.map((d) =>
    `<li><button type="button" data-id="${d.id}" aria-pressed="${d.id === dialect}"><b>${d.short}</b>${d.label}</button></li>`).join('')}</ul>` : '';
  langMenu.innerHTML = `<p class="menu-heading">${ui.languagesHeading}</p><ul>${langs}</ul>${dialects}`;
}
function toggleMenu(open = langMenu.hidden) {
  langMenu.hidden = !open;
  langBtn.setAttribute('aria-expanded', String(open));
}
langBtn.addEventListener('click', () => toggleMenu());
langMenu.addEventListener('click', (e) => {
  const link = e.target.closest('a[data-lang]');
  if (link) { store.set('1xc:lang', link.dataset.lang); return; }
  const b = e.target.closest('button[data-id]');
  if (!b) return;
  dialect = b.dataset.id;
  store.set('1xc:dialect', dialect);
  renderMenu();
  toggleMenu(false);
  activity();
  cat.wave();
  say(line('switch'), 1.9, true);
  sfx.meow(rand(0.95, 1.1));
});
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.lang')) toggleMenu(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleMenu(false); });
renderMenu();

// If the browser prefers another language we have, offer it (never redirect:
// search engines and shared links should land on the page they asked for).
(() => {
  if (store.get('1xc:lang', null)) return;
  const want = preferredLocale(navigator.languages ?? [navigator.language]);
  if (!want || want === locale.code) return;
  const target = localeByCode(want);
  const hint = document.createElement('div');
  hint.className = 'lang-hint';
  hint.innerHTML = `<a href="${target.path}" lang="${target.code}">${MESSAGES[want].ui.langHint} →</a><button type="button" aria-label="×">×</button>`;
  hint.querySelector('a').addEventListener('click', () => store.set('1xc:lang', want));
  hint.querySelector('button').addEventListener('click', () => { store.set('1xc:lang', locale.code); hint.remove(); });
  $('.top').after(hint);
})();

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
  say((lines().lonely ?? LINES.henan.lonely)[lonely - 1], 3.4);
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
  const lonelyLines = lines().lonely ?? LINES.henan.lonely;
  const away = (performance.now() - hiddenAt) / 1000;
  const stage = Math.min(lonelyLines.length - 1, Math.max(lonely - 1, Math.floor(away / TITLE_STEP)));
  document.title = `${stage === lonelyLines.length - 1 ? '💤' : '🐾'} ${lonelyLines[stage]}`;
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
  if (performance.now() < sulkUntil) return;
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

// One easter-egg show at a time: 1xc already ends in a heart rain, so a rain
// (or another 1xc) asked for while a show is running is ignored instead of
// restarting the pose and talking over the line.
let showUntil = 0;
function startShow(seconds) {
  const now = performance.now();
  if (now < showUntil || now < sulkUntil) return false;
  showUntil = now + seconds * 1000;
  return true;
}

function celebrate() {
  activity();
  if (!startShow(3.4)) return;
  cat.celebrate();
  say(line('celebrate'), 2.4);
  sfx.meow(1.15);
  setTimeout(() => sfx.ding(), 250);
  stage.burst(stage.headTop(), 16);
  setTimeout(rainHearts, 500);
  addMoe(10);
}

function rainHearts() {
  for (let i = 0; i < 40; i++) {
    setTimeout(() => {
      stage.spawn('heart', { x: rand(0, stage.width), y: rand(50, 120) },
        { x: rand(-15, 15), y: rand(25, 60) }, { life: 4, size: rand(14, 26), gravity: 15 });
    }, i * 55);
  }
}

function heartRain() {
  activity();
  if (!startShow(2.6)) return;
  rainHearts();
  cat.celebrate();
  setTimeout(() => say(line('rain')), 400);
  addMoe(5);
}

/* ------------------------------------------------------------------ */
/* 狂点: three warnings, then 原神，启动                                 */
/* ------------------------------------------------------------------ */
const SPAM_TAPS = 10;        // this many taps…
const SPAM_WINDOW = 2500;    // …within this many ms is one offence
const GENSHIN = 'https://github.com/gamemcu/www-genshin';
let taps = [];
let strikes = 0;

// Call on every tap; true means she's too cross to react to it.
function spamGuard() {
  if (strikes > 3) return true;
  const now = performance.now();
  taps = taps.filter((t) => now - t < SPAM_WINDOW);
  taps.push(now);
  if (taps.length >= SPAM_TAPS) {
    taps = [];
    strike();
    return true;
  }
  return now < sulkUntil;
}

function strike() {
  strikes++;
  if (strikes > 3) return genshinStart();
  sulkUntil = performance.now() + 2800;
  cat.setExpr('pout', 2.8);
  cat.playMotion('shake');
  cat.poke(1);
  say((lines().warn ?? LINES.henan.warn)[strikes - 1], 2.8, true);
  sfx.meow(0.9 - strikes * 0.05);
}

function genshinStart() {
  sulkUntil = Infinity;
  say(line('bye'), 3, true);
  sfx.meow(0.75);
  const white = document.createElement('div');
  white.className = 'whiteout';
  document.body.append(white);
  setTimeout(() => white.classList.add('on'), 900);
  setTimeout(() => location.assign(GENSHIN), 1900);
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

// The canvas lets vertical swipes scroll the page (touch-action: pan-y), but a
// swipe that starts on her head, chin or ears is a pat and mustn't scroll.
let petTouch = false;
canvas.addEventListener('touchstart', (e) => {
  petTouch = false;
  if (!ready || e.touches.length !== 1) return;
  setPointer(e.touches[0]);
  const z = zoneAt();
  if (z && ['head', 'chin', 'ear'].includes(z.zone)) { petTouch = true; e.preventDefault(); }
}, { passive: false });
canvas.addEventListener('touchmove', (e) => { if (petTouch && e.cancelable) e.preventDefault(); }, { passive: false });

canvas.addEventListener('pointerdown', (e) => {
  if (!ready || spamGuard()) return;
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
    if (!ready || spamGuard()) return;
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
    if (spamGuard()) return;
    if (el.dataset.key) { cat.poke(0.8, false); sfx.blip(rand(620, 700)); feed(el.dataset.key); activity(); }
    else heartRain();
  });
});

$('#copyBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  try {
    await navigator.clipboard.writeText($('#installPrompt').textContent);
    btn.textContent = ui.copied;
  } catch {
    getSelection().selectAllChildren($('#installPrompt'));
    btn.textContent = ui.copyManual;
  }
  sfx.ding();
  setTimeout(() => { btn.textContent = ui.copy; }, 1800);
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
    console.error(ui.spriteFail, cause);
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
    strikes: () => strikes,
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

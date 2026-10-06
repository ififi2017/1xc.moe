import './genshin.css';

// The page 猫猫 throws you out to after the fourth 狂点 offence: a short,
// home-made "原神，启动！" door scene, then on to the official site for the
// visitor's language. The previous page passes its language as ?lang=.
const TEXT = {
  'zh-CN': { title: '原神，启动！', sub: '正在前往提瓦特…', skip: '点击任意处继续', note: '非官方恶搞页面，与米哈游无关', url: 'https://ys.mihoyo.com/' },
  'zh-TW': { title: '原神，啟動！', sub: '正在前往提瓦特…', skip: '點擊任意處繼續', note: '非官方惡搞頁面，與米哈遊無關', url: 'https://genshin.hoyoverse.com/zh-tw/' },
  'zh-HK': { title: '原神，啟動！', sub: '前往提瓦特中…', skip: '撳任何位置繼續', note: '非官方惡搞頁面，與米哈遊無關', url: 'https://genshin.hoyoverse.com/zh-tw/' },
  ja: { title: '原神、起動！', sub: 'テイワットへ向かっています…', skip: 'タップで続ける', note: '非公式のパロディページです（HoYoverse とは無関係）', url: 'https://genshin.hoyoverse.com/ja/' },
  en: { title: 'Genshin Impact, start!', sub: 'Heading to Teyvat…', skip: 'Tap anywhere to continue', note: 'Unofficial parody, not affiliated with HoYoverse', url: 'https://genshin.hoyoverse.com/en/' },
  ko: { title: '원신, 시작!', sub: '티바트로 가는 중…', skip: '아무 곳이나 눌러 계속', note: '비공식 패러디 페이지이며 HoYoverse와 무관합니다', url: 'https://genshin.hoyoverse.com/ko/' },
};

const code = new URLSearchParams(location.search).get('lang');
const lang = TEXT[code] ? code : 'zh-CN';
const t = TEXT[lang];
document.documentElement.lang = lang;
document.title = `${t.title} · 1xc.moe`;
for (const key of ['title', 'sub', 'skip', 'note']) document.getElementById(key).textContent = t[key];
document.querySelector('noscript')?.remove();

// Full-width ，！… draw their ink in one corner of a full-width box. The empty
// part makes the gaps uneven and pulls the line off-centre (and fonts disagree
// on where the ink sits), so measure each glyph and trim that blank space away,
// then shift the line until its ink, not its box, is centred.
const PUNCT = /[，。！？、：；…「」]/;
function balance(el) {
  const cs = getComputedStyle(el);
  const g = document.createElement('canvas').getContext('2d');
  g.font = `${cs.fontWeight} 100px ${cs.fontFamily}`;
  const air = 0.16; // em kept on each side of a trimmed mark
  const chars = [...el.textContent];
  el.textContent = '';
  let first = 0, last = 0;
  chars.forEach((ch, i) => {
    const m = g.measureText(ch);
    let left = -m.actualBoundingBoxLeft / 100;
    let right = (m.width - m.actualBoundingBoxRight) / 100;
    if (PUNCT.test(ch)) {
      const span = document.createElement('span');
      span.textContent = ch;
      if (left > air) { span.style.marginLeft = `${(air - left).toFixed(3)}em`; left = air; }
      if (right > air) { span.style.marginRight = `${(air - right).toFixed(3)}em`; right = air; }
      el.append(span);
    } else el.append(ch);
    if (i === 0) first = left;
    if (i === chars.length - 1) last = right;
  });
  el.style.translate = `${((last - first) / 2).toFixed(3)}em 0`;
}
balance(document.getElementById('title'));
balance(document.getElementById('sub'));

// dev only: ?hold freezes the scene before the door opens
const hold = import.meta.env.DEV && new URLSearchParams(location.search).has('hold');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LEAVE_AT = reduceMotion ? 3200 : 6400;

// replace(): the browser's back button skips this interlude and returns to 1xc.moe
let left = false;
function leave() {
  if (left || hold) return;
  left = true;
  location.replace(t.url);
}

requestAnimationFrame(() => document.body.classList.add('go'));
if (!hold) setTimeout(() => document.body.classList.add('open'), LEAVE_AT - 1500);
setTimeout(leave, LEAVE_AT);
window.addEventListener('pointerup', () => { document.body.classList.add('open'); setTimeout(leave, 350); });
window.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') leave(); });

// A synthesised "duang" as the door opens. Browsers only allow it if the visit
// still counts as user-initiated; otherwise the scene simply plays silently.
let ctx;
try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
function chime(when) {
  if (!ctx || ctx.state !== 'running') return;
  const t0 = ctx.currentTime + when;
  const notes = [[110, 0.25, 'sine'], [220, 0.12, 'sine'], [659, 0.05, 'triangle'], [988, 0.035, 'sine'], [1319, 0.025, 'sine']];
  for (const [f, vol, type] of notes) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f * 0.98, t0);
    o.frequency.exponentialRampToValueAtTime(f, t0 + 0.4);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + 2.3);
  }
}
if (ctx) {
  ctx.resume().catch(() => {}).finally(() => {
    chime(reduceMotion ? 0.3 : 1.6);
    chime((LEAVE_AT - 1500) / 1000);
  });
}

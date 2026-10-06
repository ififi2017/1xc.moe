import './genshin.css';

// The page 猫猫 throws you out to after the fourth 狂点 offence: a short,
// home-made "原神，启动！" door scene, then on to the official site for the
// visitor's language. The previous page passes its language as ?lang=.
const TEXT = {
  'zh-CN': { title: '原神，启动！', sub: '正在前往提瓦特…', skip: '点击任意处继续', credit: '致敬', note: '非官方恶搞页面，与米哈游无关', url: 'https://ys.mihoyo.com/' },
  'zh-TW': { title: '原神，啟動！', sub: '正在前往提瓦特…', skip: '點擊任意處繼續', credit: '致敬', note: '非官方惡搞頁面，與米哈遊無關', url: 'https://genshin.hoyoverse.com/zh-tw/' },
  'zh-HK': { title: '原神，啟動！', sub: '前往提瓦特中…', skip: '撳任何位置繼續', credit: '致敬', note: '非官方惡搞頁面，與米哈遊無關', url: 'https://genshin.hoyoverse.com/zh-tw/' },
  ja: { title: '原神、起動！', sub: 'テイワットへ向かっています…', skip: 'タップで続ける', credit: 'オマージュ：', note: '非公式のパロディページです（HoYoverse とは無関係）', url: 'https://genshin.hoyoverse.com/ja/' },
  en: { title: 'Genshin Impact, start!', sub: 'Heading to Teyvat…', skip: 'Tap anywhere to continue', credit: 'Tribute to', note: 'Unofficial parody, not affiliated with HoYoverse', url: 'https://genshin.hoyoverse.com/en/' },
  ko: { title: '원신, 시작!', sub: '티바트로 가는 중…', skip: '아무 곳이나 눌러 계속', credit: '오마주:', note: '비공식 패러디 페이지이며 HoYoverse와 무관합니다', url: 'https://genshin.hoyoverse.com/ko/' },
};

const code = new URLSearchParams(location.search).get('lang');
const lang = TEXT[code] ? code : 'zh-CN';
const t = TEXT[lang];
document.documentElement.lang = lang;
document.title = `${t.title} · 1xc.moe`;
for (const key of ['title', 'sub', 'skip', 'credit', 'note']) document.getElementById(key).textContent = t[key];
document.querySelector('noscript')?.remove();

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

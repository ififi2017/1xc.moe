// Tiny synth — every sound is generated, no audio files.
let ctx = null;
let muted = false;

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  if (!m) unlock();
  if (purr.bus && ctx) purr.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
}

export function unlock() {
  // iOS 17+: play through the ring/silent switch like a media player would
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    setupPurr();
  }
  if (ctx.state !== 'running') {
    ctx.resume().catch(() => {});
    // older iOS only opens the output after a buffer is started inside a gesture
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, 22050);
    src.connect(ctx.destination);
    src.start(0);
  }
}
// iOS WebKit doesn't count pointerdown as a user gesture for audio — touchend/click do
for (const type of ['touchend', 'click', 'keydown']) {
  window.addEventListener(type, unlock, { passive: true, capture: true });
}

// With a 'playback' session, iOS keeps a running context alive in the background
// and shows it in the Dynamic Island / on the lock screen. Close the context as
// soon as the page is hidden; a new one is made on return (it starts right away
// where the browser allows it, otherwise on the next tap).
function release() {
  if (!ctx) return;
  const old = ctx;
  ctx = null;
  Object.assign(purr, { bus: null, next: 0, exhale: true, queued: [] });
  old.close().catch(() => {});
  try { if (navigator.audioSession) navigator.audioSession.type = 'auto'; } catch {}
}
document.addEventListener('visibilitychange', () => { if (document.hidden) release(); else unlock(); });
window.addEventListener('pagehide', release);

const ready = () => ctx && !muted;

function env(g, t, peak, attack, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

function tone(type, f0, f1, f2, dur, vol, when = 0) {
  if (!ready()) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.35);
  o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  env(g, t, vol, 0.012, dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const blip = (f = 660) => { tone('sine', f, f * 1.9, f * 1.3, 0.24, 0.2); tone('triangle', f * 2, f * 3.6, f * 2.4, 0.14, 0.04); };
// one syllable of 猫猫's "voice": a clipped version of the bubble blip
export const voice = (f = 680) => { tone('sine', f, f * 1.45, f * 1.15, 0.075, 0.085); tone('triangle', f * 2, f * 2.8, f * 2.2, 0.05, 0.015); };
export const plop = () => tone('sine', 260, 170, 120, 0.12, 0.11);
export const sparkle = () => tone('sine', 1300, 1900, 1600, 0.12, 0.05);

// a little synthetic "nya~": sawtooth through a sweeping band-pass
export function meow(pitch = 1) {
  if (!ready()) return;
  const t = ctx.currentTime;
  const dur = 0.42;
  const o = ctx.createOscillator();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(560 * pitch, t);
  o.frequency.exponentialRampToValueAtTime(860 * pitch, t + 0.11);
  o.frequency.exponentialRampToValueAtTime(520 * pitch, t + dur);
  f.type = 'bandpass';
  f.Q.value = 5;
  f.frequency.setValueAtTime(900, t);
  f.frequency.exponentialRampToValueAtTime(1700, t + 0.12);
  f.frequency.exponentialRampToValueAtTime(800, t + dur);
  env(g, t, 0.3, 0.035, dur);
  o.connect(f).connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// 叮铃 — bell partials, struck twice
export function ding() {
  if (!ready()) return;
  for (const [when, vol] of [[0, 0.16], [0.13, 0.1]]) {
    for (const [freq, k] of [[1760, 1], [2640, 0.5], [3960, 0.25]]) {
      const t = ctx.currentTime + when;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      env(g, t, vol * k, 0.004, 0.7);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.75);
    }
  }
}

// 呼噜 — a low, voiced "咕噜噜" rather than chopped noise (chopped noise reads
// as a helicopter). Each breath is a hum on a fixed 25 Hz fundamental with its
// harmonics shaped around 80–160 Hz and only a slow, slight pitch drift; the
// out-breath is longer and louder, the in-breath shorter and softer, with a
// pause in between. Exactly one breath plays at a time and the tempo never
// changes: petting harder or longer only raises the volume, up to a cap.
const PURR_F0 = 25;
const purr = { bus: null, out: [], in: [], next: 0, exhale: true, queued: [] };

function renderBreath(seconds, loud) {
  const sr = ctx.sampleRate;
  const n = Math.floor(seconds * sr);
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  const phases = Array.from({ length: 14 }, () => Math.random() * Math.PI * 2);
  const drift = Math.random() * Math.PI * 2;
  let ph = 0, peak = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    ph += (2 * Math.PI * PURR_F0 * (1 + 0.02 * Math.sin(2 * Math.PI * 0.7 * t + drift))) / sr;
    let v = 0;
    for (let k = 1; k <= 14; k++) {
      const f = k * PURR_F0;
      const g = Math.exp(-(((f - 110) / 90) ** 2)) + 0.25 * Math.exp(-(((f - 30) / 15) ** 2));
      v += (g / Math.sqrt(k)) * Math.sin(k * ph + phases[k - 1]);
    }
    // breath envelope: ease in, hold, ease out — no clicks between breaths
    const x = i / n;
    v *= Math.sin((Math.PI * Math.min(1, x / 0.25)) / 2) ** 2 * Math.cos((Math.PI * Math.max(0, (x - 0.6) / 0.4)) / 2) ** 2;
    d[i] = v;
    peak = Math.max(peak, Math.abs(v));
  }
  const norm = (0.5 * loud) / (peak || 1);
  for (let i = 0; i < n; i++) d[i] *= norm;
  return buf;
}

function setupPurr() {
  purr.bus = ctx.createGain();
  purr.bus.gain.value = 0;
  purr.bus.connect(ctx.destination);
  if (purr.out.length) return; // buffers outlive the context they were made for
  for (let k = 0; k < 3; k++) {
    purr.out.push(renderBreath(1.2 + k * 0.12, 1));
    purr.in.push(renderBreath(0.75 + k * 0.08, 0.55));
  }
}

function stopQueuedPurr(now) {
  // cancel breaths that haven't started yet; the one already playing fades with the bus
  purr.queued = purr.queued.filter(({ src, start }) => {
    if (start > now) { try { src.stop(); } catch {} return false; }
    return start + src.buffer.duration > now;
  });
  const playing = purr.queued[purr.queued.length - 1];
  purr.next = playing ? playing.start + playing.src.buffer.duration : 0;
  purr.exhale = true;
}

export function setPurr(level) {
  if (!ctx || !purr.bus) return;
  const now = ctx.currentTime;
  const target = muted ? 0 : Math.min(1, Math.max(0, level));
  purr.bus.gain.setTargetAtTime(target * 0.6, now, 0.3);
  if (target < 0.04) { if (purr.queued.length) stopQueuedPurr(now); return; }
  if (purr.next < now) purr.next = now + 0.03;
  // keep at most one breath queued ahead of the one playing: never overlapping, never faster
  while (purr.next - now < 0.3) {
    const list = purr.exhale ? purr.out : purr.in;
    const src = ctx.createBufferSource();
    src.buffer = list[(Math.random() * list.length) | 0];
    src.connect(purr.bus);
    src.start(purr.next);
    purr.queued.push({ src, start: purr.next });
    src.onended = () => { purr.queued = purr.queued.filter((q) => q.src !== src); };
    purr.next += src.buffer.duration + (purr.exhale ? 0.12 : 0.22);
    purr.exhale = !purr.exhale;
  }
}

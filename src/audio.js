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

// 呼噜 — a real purr isn't a steady drone (that's what made it sound like a
// helicopter). It comes in breaths: a louder, lower out-breath and a softer,
// slightly faster in-breath, each a train of ~25 Hz soft pulses with a short
// pause between breaths. A few breaths are pre-rendered with random jitter and
// scheduled back to back while she's being petted.
const purr = { bus: null, out: [], in: [], next: 0, exhale: true };

function renderBreath({ seconds, rate, cutoff, loud }) {
  const sr = ctx.sampleRate;
  const n = Math.floor(seconds * sr);
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  const a1 = 1 - Math.exp((-2 * Math.PI * cutoff) / sr);  // two one-pole low-passes
  const aHp = 1 - Math.exp((-2 * Math.PI * 90) / sr);     // and a gentle high-pass
  let lp1 = 0, lp2 = 0, hp = 0;
  let pulseT = 1, period = sr / rate, amp = 1;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    if (pulseT >= period) {
      // each pulse lands a little early or late and a little louder or softer
      pulseT = 0;
      period = (sr / rate) * (0.9 + Math.random() * 0.2);
      amp = 0.7 + Math.random() * 0.3;
    }
    const tp = pulseT / sr;
    const pulse = amp * Math.min(1, tp / 0.004) * Math.exp(-tp / 0.011);
    pulseT++;
    lp1 += a1 * (Math.random() * 2 - 1 - lp1);
    lp2 += a1 * (lp1 - lp2);
    hp += aHp * (lp2 - hp);
    // breath envelope: swell in, sustain, taper out
    const x = i / n;
    const breath = Math.sin(Math.PI * Math.min(1, x / 0.18) / 2) * Math.cos(Math.PI * Math.max(0, (x - 0.7) / 0.3) / 2);
    const v = (lp2 - hp) * pulse * breath;
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
  for (let k = 0; k < 3; k++) {
    purr.out.push(renderBreath({ seconds: 1.0 + Math.random() * 0.35, rate: 23 + Math.random() * 3, cutoff: 380, loud: 1 }));
    purr.in.push(renderBreath({ seconds: 0.6 + Math.random() * 0.2, rate: 27 + Math.random() * 3, cutoff: 520, loud: 0.5 }));
  }
}

export function setPurr(level) {
  if (!ctx || !purr.bus) return;
  const now = ctx.currentTime;
  const target = muted ? 0 : Math.min(1, Math.max(0, level));
  // slow smoothing so frame-to-frame changes in pet level never sound like a wobble
  purr.bus.gain.setTargetAtTime(target * 0.6, now, 0.3);
  if (target < 0.04) { purr.exhale = true; return; } // let the current breath fade out
  if (purr.next < now) purr.next = now + 0.03;        // (re)start on an out-breath
  while (purr.next - now < 0.3) {
    const list = purr.exhale ? purr.out : purr.in;
    const src = ctx.createBufferSource();
    src.buffer = list[(Math.random() * list.length) | 0];
    src.playbackRate.value = 0.96 + Math.random() * 0.08;
    src.connect(purr.bus);
    src.start(purr.next);
    purr.next += src.buffer.duration / src.playbackRate.value + (purr.exhale ? 0.08 : 0.16) + Math.random() * 0.08;
    purr.exhale = !purr.exhale;
  }
}

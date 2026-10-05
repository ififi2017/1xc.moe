// Tiny synth — every sound is generated, no audio files.
let ctx = null;
let muted = false;
let purrGain = null;

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  if (!m) unlock();
  if (purrGain && ctx) purrGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
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

// 呼噜 — low-passed noise, amplitude-modulated at ~24 Hz, faded in while petting
function setupPurr() {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; data[i] = last * 3.5; }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 320;
  const mod = ctx.createGain();
  mod.gain.value = 0.5;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 24;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.5;
  lfo.connect(lfoDepth).connect(mod.gain);
  purrGain = ctx.createGain();
  purrGain.gain.value = 0;
  noise.connect(lp).connect(mod).connect(purrGain).connect(ctx.destination);
  noise.start();
  lfo.start();
}

export function setPurr(level) {
  if (!ctx || !purrGain) return;
  purrGain.gain.setTargetAtTime(muted ? 0 : level * 0.9, ctx.currentTime, 0.12);
}

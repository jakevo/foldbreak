// Sound for the hinge resisting and the panel giving way (port of FX.swift).
//
// unfold.wav is a pre-mixed sequence: a stiff hinge creak that builds up, then the glass
// break landing on its loudest crack at BREAK_OFFSET. One file keeps them in sync.

export const BREAK_OFFSET = 0.774;

let ctx = null;
let unfoldBuffer = null;
let loading = null;
const synth = { big: null, small: null };

/** Must run inside a user gesture (the Start prank tap): iOS only allows audio after one. */
export function unlockAudio() {
  // Play through the silent switch, like the app's .playback session (Safari 17+).
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  // A silent blip completes the unlock on older iOS versions.
  const b = ctx.createBuffer(1, 1, ctx.sampleRate);
  const s = ctx.createBufferSource();
  s.buffer = b; s.connect(ctx.destination); s.start(0);
  if (!synth.big) { synth.big = render(true); synth.small = render(false); }
  loadUnfold();
}

function loadUnfold() {
  if (unfoldBuffer || loading || !ctx) return loading;
  loading = fetch('unfold.wav')
    .then(r => r.arrayBuffer())
    .then(data => new Promise((ok, fail) => ctx.decodeAudioData(data, ok, fail)))
    .then(buf => { unfoldBuffer = buf; })
    .catch(() => { loading = null; });
  return loading;
}

export const hasUnfoldRecording = () => !!unfoldBuffer;

/** Try to bring the audio back after the page was hidden or interrupted. */
export function wakeAudio() {
  if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
}

/** Starts the creak `delay` seconds from now; the break lands BREAK_OFFSET later. */
export function playUnfold(delay) {
  if (!ctx || !unfoldBuffer) return;
  wakeAudio();
  const s = ctx.createBufferSource();
  s.buffer = unfoldBuffer;
  s.connect(ctx.destination);
  s.start(ctx.currentTime + Math.max(0, delay));
}

/** Synthesised snap: finger presses, or the break in "Snap" mode. */
export function playSnap(big, delay = 0) {
  if (!ctx) return;
  wakeAudio();
  const buf = big ? synth.big : synth.small;
  if (!buf) return;
  const s = ctx.createBufferSource();
  s.buffer = buf;
  s.connect(ctx.destination);
  s.start(ctx.currentTime + Math.max(0, delay));
  // Android phones can buzz along; iPhone Safari ignores this.
  try { navigator.vibrate && navigator.vibrate(big ? [40, 20, 15] : 12); } catch {}
}

const rand = (a, b) => a + Math.random() * (b - a);

// Thin glass/polymer layer snapping under bending stress: a broadband fracture click,
// smaller follow-on cracks, a short high resonance and a faint knock through the chassis.
function render(big) {
  const sr = ctx.sampleRate;
  const n = Math.floor((big ? 0.45 : 0.25) * sr);
  const raw = new Float32Array(n);
  const events = [[0.004, 1.0, 0.0022]];
  const extra = big ? 5 + Math.floor(Math.random() * 4) : 1 + Math.floor(Math.random() * 3);
  for (let k = 0; k < extra; k++) {
    const u = Math.random();
    events.push([0.006 + (big ? 0.075 : 0.035) * u * u, rand(0.12, 0.55) * (1 - u * 0.6), rand(0.0004, 0.0016)]);
  }
  for (const [t0, amp, len] of events) {
    const start = Math.floor(t0 * sr), count = Math.floor((len + 0.004) * sr);
    for (let i = 0; i < count && start + i < n; i++) {
      const t = i / sr;
      const env = t < len ? 1 : Math.exp(-(t - len) * 1400);
      raw[start + i] += rand(-1, 1) * amp * env;
    }
  }
  let p1 = 0, p2 = 0, h1 = 0, h2 = 0;
  for (let i = 0; i < n; i++) {
    h1 = 0.96 * (h1 + raw[i] - p1); p1 = raw[i];
    h2 = 0.9 * (h2 + h1 - p2); p2 = h1;
    raw[i] = h2;
  }
  const modes = big
    ? [[2870, 0.16, 70], [4410, 0.12, 95], [6930, 0.07, 130], [9800, 0.04, 180]]
    : [[3300, 0.1, 110], [5600, 0.06, 150]];
  const st = Math.floor(0.004 * sr), tau = Math.PI * 2;
  for (let i = st; i < n; i++) {
    const t = (i - st) / sr;
    let s = 0;
    for (const [f, a, d] of modes) s += Math.sin(tau * f * t) * a * Math.exp(-t * d);
    if (big) s += Math.sin(tau * 190 * t) * 0.22 * Math.exp(-t * 55) + Math.sin(tau * 410 * t) * 0.08 * Math.exp(-t * 80);
    raw[i] += s;
  }
  let peak = 0.0001;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(raw[i]));
  const gain = (big ? 0.95 : 0.6) / peak;
  const buf = ctx.createBuffer(1, n, sr);
  const out = buf.getChannelData(0);
  for (let i = 0; i < n; i++) out[i] = raw[i] * gain;
  return buf;
}

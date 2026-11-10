// Synthesizes the PV sound track (no samples, no external audio): node sfx.mjs
// Writes out/sfx.wav (48 kHz stereo 16-bit), timed to the cut list below.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const here = import.meta.dirname;
const SR = 48000;

// Cut lengths in seconds, in edit order (must match out/list-*.txt). `short` is the SNS cut.
// Events for cuts that are not in the edit fall outside the buffer and are skipped.
const PROFILE = process.argv[2] === 'short' ? 'short' : 'full';
const CUTS =
  PROFILE === 'short'
    ? [
        ['c01_hook', 3],
        ['c02_title', 3],
        ['c05_short', 7.6],
        ['c07_follow', 7.5],
        ['c10_end', 4.5],
      ]
    : [
        ['c01_hook', 3],
        ['c02_title', 3],
        ['c03_new', 7],
        ['c04_skill', 8],
        ['c05_rec', 12.5],
        ['c06_cursor', 11],
        ['c07_follow', 9],
        ['c08_docs', 9],
        ['c09a_export', 2],
        ['c09b_html', 7],
        ['c10_end', 6],
      ];
const START = {};
const LEN = Object.fromEntries(CUTS);
let total = 0;
for (const [name, d] of CUTS) {
  START[name] = total;
  total += d;
}
const at = (cut, t) => (cut in START ? START[cut] + t : -1e9);

const N = Math.ceil((total + 0.5) * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);
const db = (d) => 10 ** (d / 20);

// Deterministic noise, so every render is identical.
let seed = 1234567;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 2 ** 32) * 2 - 1;
};

function add(t0, dur, fn, gain = 1, pan = 0) {
  if (!(t0 > -1) || !(dur > 0)) return;
  const i0 = Math.max(0, Math.round(t0 * SR));
  const n = Math.round(dur * SR);
  const gl = gain * Math.sqrt((1 - pan) / 2) * Math.SQRT2;
  const gr = gain * Math.sqrt((1 + pan) / 2) * Math.SQRT2;
  for (let i = 0; i < n && i0 + i < N; i++) {
    const v = fn(i / SR, i);
    L[i0 + i] += v * gl;
    R[i0 + i] += v * gr;
  }
}

// ---- instruments ----
/** A soft UI click: a short noise tick over a quickly decaying high sine. */
function click(t, gain = db(-16)) {
  add(
    t,
    0.06,
    (s) =>
      rand() * Math.exp(-s * 900) * 0.6 + Math.sin(2 * Math.PI * 3200 * s) * Math.exp(-s * 120),
    gain,
    0.15,
  );
}
/** A light tick for the blinking numbers in the hook. */
function tick(t, f, gain = db(-28), pan = 0) {
  add(t, 0.08, (s) => Math.sin(2 * Math.PI * f * s) * Math.exp(-s * 60), gain, pan);
}
/** Filtered-noise swoosh; the cutoff glides from f0 to f1. */
function whoosh(t, dur, f0, f1, gain = db(-22)) {
  let y = 0;
  add(
    t,
    dur,
    (s) => {
      const k = s / dur;
      const fc = f0 * (f1 / f0) ** k;
      const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
      y += a * (rand() - y);
      return y * Math.sin(Math.PI * k) ** 1.5 * 3;
    },
    gain,
  );
}
/** A bell-like chord: partials with slow exponential decay. */
function chime(t, freqs, dur = 2.4, gain = db(-18)) {
  add(
    t,
    dur,
    (s) => {
      let v = 0;
      for (const f of freqs)
        v +=
          Math.sin(2 * Math.PI * f * s) * Math.exp(-s * 2.2) +
          0.25 * Math.sin(2 * Math.PI * f * 2.01 * s) * Math.exp(-s * 5);
      return (v / freqs.length) * Math.min(1, s * 200);
    },
    gain,
  );
}
/** A rising sweep into the title. */
function riser(t, dur, gain = db(-24)) {
  let ph = 0;
  add(
    t,
    dur,
    (s) => {
      const k = s / dur;
      ph += (2 * Math.PI * (180 * (900 / 180) ** k)) / SR;
      return (Math.sin(ph) * 0.6 + rand() * 0.15 * k) * k * k;
    },
    gain,
  );
}
/** The fast-forward: a buzzy, wavering whir. */
function whir(t, dur, gain = db(-31)) {
  let ph = 0;
  add(
    t,
    dur,
    (s) => {
      const f = 140 + 30 * Math.sin(2 * Math.PI * 7 * s);
      ph += (2 * Math.PI * f) / SR;
      const saw = ((ph / (2 * Math.PI)) % 1) * 2 - 1;
      const env = Math.min(1, s / 0.15) * Math.min(1, (dur - s) / 0.25);
      return (saw * 0.5 + rand() * 0.2) * env;
    },
    gain,
  );
}
/** A quiet pad bed: a chord of detuned sines with a slow swell. */
function pad(t, dur, freqs, gain = db(-31), fadeIn = 1.5, fadeOut = 1.5) {
  add(
    t,
    dur,
    (s) => {
      let v = 0;
      for (const f of freqs)
        v += Math.sin(2 * Math.PI * f * s) + Math.sin(2 * Math.PI * f * 1.003 * s + 1);
      const env =
        Math.min(1, s / fadeIn) *
        Math.min(1, (dur - s) / fadeOut) *
        (0.85 + 0.15 * Math.sin(2 * Math.PI * 0.2 * s));
      return (v / (freqs.length * 2)) * env;
    },
    gain,
  );
}

// ---- score ----
// Hook: the numbers blink every 0.22 s until 2.7 s (stage.html renderHook).
const BLINK_PITCH = [1760, 1568, 1976, 1661, 1865, 1480, 2093];
for (let i = 0; i * 0.22 < 2.7; i++)
  tick(at('c01_hook', i * 0.22), BLINK_PITCH[i % 7], db(-30), ((i % 3) - 1) * 0.4);
// Title: a sweep up into the cut, then a chime as the packet settles (~2.3 s into the title).
riser(at('c01_hook', 2.2), 0.8);
whoosh(at('c02_title', 0), 0.9, 300, 4000, db(-24));
chime(at('c02_title', 2.3), [440, 554.37, 659.25, 880], 2.6, db(-17));

// Soft swooshes on cuts between scenes.
for (const name of ['c03_new', 'c05_short', 'c06_cursor', 'c07_follow', 'c08_docs', 'c09b_html'])
  whoosh(at(name, -0.25), 0.5, 600, 2400, db(-30));

// Fast-forward while Claude Code works (cut 5, 5.0-8.5 s).
whir(at('c05_rec', 5.0), 3.5);
chime(at('c05_rec', 8.6), [659.25, 987.77], 1.4, db(-24));
whir(at('c05_short', 2.5), 2.1);
chime(at('c05_short', 4.7), [659.25, 987.77], 1.4, db(-24));

// Clicks of the drawn pointer (cuts.mjs pointerTrack keyframes with click = true).
const CLICKS = {
  c03_new: [0.8, 1.6],
  c04_skill: [3.8],
  c06_cursor: [0.5, 3.3, 5.4, 6.8],
  c07_follow: [0.5, 3.4],
  c08_docs: [0.6, 2.6, 4.6, 6.6],
  c09a_export: [0.9],
  c09b_html: [0.8],
};
for (const [name, times] of Object.entries(CLICKS)) for (const t of times) click(at(name, t));

// Typing and key presses in the rebuilt cuts 3-4 (cuts.mjs timelines).
/** A muted key press. */
function key(t, gain = db(-24)) {
  add(
    t,
    0.05,
    (s) =>
      rand() * Math.exp(-s * 500) * 0.8 +
      Math.sin(2 * Math.PI * 900 * s) * Math.exp(-s * 160) * 0.5,
    gain,
    -0.1,
  );
}
for (let i = 0; i < 'architecture.dav'.length; i++)
  key(at('c03_new', 1.95 + i * 0.07), db(-25 - (i % 3)));
for (const t of [3.3, 4.1]) key(at('c03_new', t), db(-21));
for (let i = 0; i < 'AI エージェント'.length; i++)
  key(at('c04_skill', 1.0 + i * 0.09), db(-25 - (i % 3)));
for (const t of [0.4, 2.3]) key(at('c04_skill', t), db(-21));
chime(at('c04_skill', 4.0), [880, 1318.5], 1.0, db(-27)); // the "installed" notification

// End card: a resolving chime.
chime(at('c10_end', 0.1), [261.63, 329.63, 392, 523.25], 4.5, db(-15));

// Bed: three chords under the demo, the feature tour and the end.
pad(at('c03_new', 0), START.c06_cursor - START.c03_new + 0.8, [110, 164.81, 261.63, 329.63]); // Am(add9)-ish
pad(at('c06_cursor', 0), START.c10_end - START.c06_cursor + 0.8, [87.31, 130.81, 220, 329.63]); // Fmaj7
if (PROFILE === 'short')
  pad(at('c05_short', 0), START.c10_end - START.c05_short + 0.8, [87.31, 130.81, 220, 329.63]);
pad(
  at('c10_end', 0),
  LEN.c10_end,
  [65.41, 130.81, 196, 329.63],
  db(-29),
  0.8,
  Math.min(3, LEN.c10_end / 2),
); // C

// ---- write ----
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const norm = peak > db(-1) ? db(-1) / peak : 1;
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write('WAVE', 8);
buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * norm)) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * norm)) * 32767), 46 + i * 4);
}
const outName = PROFILE === 'short' ? 'sfx-short.wav' : 'sfx.wav';
writeFileSync(resolve(here, 'out', outName), buf);
console.log(
  `${outName}: ${total.toFixed(1)} s, peak ${(20 * Math.log10(peak)).toFixed(1)} dBFS before normalizing`,
);

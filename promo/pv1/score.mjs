// Synthesizes the sound track (no samples, no external audio): node score.mjs <long|short> <ja|en>
// Writes out/score-<profile>-<lang>.wav (48 kHz stereo 16-bit). The music is at 120 BPM; its bars and
// every sound effect are placed from timing.js, the same clock the picture is drawn from.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CHAPTERS, playCut, recAt, recPlan, starts, T } from './timing.js';

const here = import.meta.dirname;
const profile = process.argv[2] === 'short' ? 'short' : 'long';
const lang = process.argv[3] === 'en' ? 'en' : 'ja';
const short = profile === 'short';
const P = T[profile];
const AT = starts(profile);
const SR = 48000;
const TOTAL = AT.total;
const N = Math.ceil((TOTAL + 0.4) * SR);
const db = (d) => 10 ** (d / 20);
const TAU = 2 * Math.PI;

/** Dry mix, and what is sent to the reverb. */
const L = new Float32Array(N);
const R = new Float32Array(N);
const SL = new Float32Array(N);
const SRv = new Float32Array(N);

// Deterministic noise, so every render is identical.
let seed = 20261113;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 2 ** 32) * 2 - 1;
};

/** Adds fn(seconds, sample) for `dur` seconds from `t0`, at `gain`, panned, with a share sent to the reverb. */
function add(t0, dur, fn, gain = 1, pan = 0, send = 0) {
  if (!(t0 >= 0) || !(dur > 0)) return;
  const i0 = Math.round(t0 * SR);
  const n = Math.round(dur * SR);
  const gl = gain * Math.sqrt((1 - pan) / 2) * Math.SQRT2;
  const gr = gain * Math.sqrt((1 + pan) / 2) * Math.SQRT2;
  for (let i = 0; i < n && i0 + i < N; i++) {
    const v = fn(i / SR, i);
    L[i0 + i] += v * gl;
    R[i0 + i] += v * gr;
    if (send > 0) {
      SL[i0 + i] += v * gl * send;
      SRv[i0 + i] += v * gr * send;
    }
  }
}

// ---------- instruments ----------

const kickTimes = [];
function kick(t, gain = db(-8)) {
  kickTimes.push(t);
  let ph = 0;
  add(
    t,
    0.34,
    (s) => {
      const f = 46 + 110 * Math.exp(-s * 34);
      ph += (TAU * f) / SR;
      return Math.sin(ph) * Math.exp(-s * 11) + rand() * 0.25 * Math.exp(-s * 300);
    },
    gain,
  );
}
function hat(t, gain = db(-31), pan = 0.2) {
  let prev = 0;
  add(
    t,
    0.05,
    (s) => {
      const x = rand();
      const hp = x - prev;
      prev = x;
      return hp * Math.exp(-s * 90);
    },
    gain,
    pan,
    0.1,
  );
}
/** A soft clap on beats two and four: three short bursts of band-limited noise. */
function clap(t, gain = db(-24)) {
  let y = 0;
  add(
    t,
    0.18,
    (s) => {
      const env =
        Math.exp(-((s % 0.011) * 260)) * (s < 0.033 ? 1 : 0) +
        Math.exp(-(s - 0.033) * 30) * (s >= 0.033 ? 1 : 0);
      y += 0.35 * (rand() - y);
      return (rand() - y) * env * 0.7;
    },
    gain,
    -0.1,
    0.35,
  );
}
function bass(t, f, dur, gain = db(-13)) {
  add(
    t,
    dur,
    (s) => {
      const env = Math.min(1, s / 0.006) * Math.exp(-s * 5) * Math.min(1, (dur - s) / 0.03);
      return (
        (Math.sin(TAU * f * s) +
          0.45 * Math.sin(TAU * 2 * f * s) +
          0.18 * Math.sin(TAU * 3 * f * s)) *
        env
      );
    },
    gain,
  );
}
/** A plucked note: harmonics that die away the faster the higher they are. */
function pluck(t, f, gain = db(-21), pan = 0, dur = 0.7) {
  add(
    t,
    dur,
    (s) => {
      let v = 0;
      for (let h = 1; h <= 7; h++)
        v += (Math.sin(TAU * f * h * s + h) / h) * Math.exp(-s * (3.5 + h * 3.2));
      return v * Math.min(1, s / 0.003);
    },
    gain,
    pan,
    0.45,
  );
}
function pad(t, dur, freqs, gain = db(-25)) {
  add(
    t,
    dur,
    (s) => {
      let v = 0;
      for (const f of freqs)
        v +=
          Math.sin(TAU * f * s) +
          0.6 * Math.sin(TAU * f * 1.004 * s + 1.3) +
          0.6 * Math.sin(TAU * f * 0.996 * s + 2.1);
      const env = Math.min(1, s / 0.35) * Math.min(1, (dur - s) / 0.5);
      return (v / (freqs.length * 2.2)) * env;
    },
    gain,
    0,
    0.6,
  );
}
function bell(t, f, gain = db(-17), dur = 2.6, pan = 0) {
  add(
    t,
    dur,
    (s) =>
      (Math.sin(TAU * f * s) * Math.exp(-s * 2.4) +
        0.4 * Math.sin(TAU * f * 2.01 * s) * Math.exp(-s * 4.5) +
        0.22 * Math.sin(TAU * f * 3.02 * s) * Math.exp(-s * 7) +
        0.12 * Math.sin(TAU * f * 5.4 * s) * Math.exp(-s * 12)) *
      Math.min(1, s * 400),
    gain,
    pan,
    0.7,
  );
}
/** Filtered-noise swoosh; the cutoff glides from f0 to f1. */
function whoosh(t, dur, f0, f1, gain = db(-24), pan = 0) {
  let y = 0;
  add(
    t,
    dur,
    (s) => {
      const k = s / dur;
      const fc = f0 * (f1 / f0) ** k;
      y += (1 - Math.exp((-TAU * fc) / SR)) * (rand() - y);
      return y * Math.sin(Math.PI * k) ** 1.6 * 3;
    },
    gain,
    pan,
    0.3,
  );
}
/** A swell that rises into a cut. */
function riser(t, dur, gain = db(-25)) {
  let ph = 0;
  let y = 0;
  add(
    t,
    dur,
    (s) => {
      const k = s / dur;
      ph += (TAU * 160 * 5 ** k) / SR;
      y += 0.2 * (rand() - y);
      return (Math.sin(ph) * 0.5 + (rand() - y) * 0.3) * k ** 2.4;
    },
    gain,
    0,
    0.4,
  );
}
/** A low hit with a soft crash on top. */
function impact(t, gain = db(-9)) {
  let ph = 0;
  add(
    t,
    1.6,
    (s) => {
      ph += (TAU * (38 + 70 * Math.exp(-s * 16))) / SR;
      return Math.sin(ph) * Math.exp(-s * 3.2);
    },
    gain,
  );
  let prev = 0;
  add(
    t,
    1.8,
    (s) => {
      const x = rand();
      const hp = x - 0.7 * prev;
      prev = x;
      return hp * Math.exp(-s * 2.6) * Math.min(1, s * 300);
    },
    gain * db(-17),
    0,
    0.5,
  );
}
/** A soft UI click: a noise tick over a quickly decaying high sine. */
function click(t, gain = db(-17)) {
  add(
    t,
    0.06,
    (s) => rand() * Math.exp(-s * 900) * 0.6 + Math.sin(TAU * 3200 * s) * Math.exp(-s * 120),
    gain,
    0.15,
    0.1,
  );
}
function key(t, gain = db(-27)) {
  add(
    t,
    0.05,
    (s) => rand() * Math.exp(-s * 520) * 0.8 + Math.sin(TAU * 900 * s) * Math.exp(-s * 170) * 0.5,
    gain,
    -0.1,
  );
}
function blip(t, f, gain = db(-24), pan = 0) {
  add(
    t,
    0.22,
    (s) => Math.sin(TAU * f * s) * Math.exp(-s * 22) * Math.min(1, s * 600),
    gain,
    pan,
    0.5,
  );
}

// ---------- music ----------
// A minor: Am7, Fmaj7, Cadd9, G, one chord a bar (2 s).
const CHORDS = [
  { bass: 55.0, pad: [220.0, 261.63, 329.63, 392.0], arp: [440.0, 523.25, 659.25, 783.99] },
  { bass: 43.65, pad: [174.61, 220.0, 261.63, 329.63], arp: [349.23, 440.0, 523.25, 659.25] },
  { bass: 65.41, pad: [196.0, 261.63, 293.66, 329.63], arp: [392.0, 523.25, 587.33, 659.25] },
  { bass: 49.0, pad: [196.0, 246.94, 293.66, 392.0], arp: [392.0, 493.88, 587.33, 783.99] },
];
const ARP = [0, 1, 2, 3, 2, 1, 2, 3];
const BASS = [1, 0, 0, 1, 0, 0, 1, 0];

// Where the groove starts (the play button) and stops (the end card).
const GROOVE_FROM = AT.hook + P.hook.click;
const GROOVE_TO = AT.end;
const firstBar = GROOVE_FROM % 2;
/** In the main video the kick and bass drop out under each chapter card and come back with the device. */
const breakdown = (t) =>
  !short && CHAPTERS.some((name) => t >= AT[name] - 1e-6 && t < AT[name] + 2 - 1e-6);

let barIndex = 0;
for (let bar = firstBar; bar < GROOVE_TO - 1e-6; bar += 2, barIndex++) {
  if (bar < GROOVE_FROM - 1e-6) continue;
  const chord = CHORDS[barIndex % 4];
  const quiet = breakdown(bar);
  const inTitle = bar >= AT.title && bar < AT.flow;
  pad(bar, 2.25, chord.pad, db(inTitle ? -23 : -25.5));
  for (let e = 0; e < 8; e++) {
    const t = bar + e * 0.25;
    pluck(t, chord.arp[ARP[e]], db(quiet ? -23 : -21.5) * (e % 2 ? 0.8 : 1), e % 2 ? 0.35 : -0.35);
    // The echo of each note, a dotted eighth later.
    pluck(t + 0.375, chord.arp[ARP[e]], db(-30), e % 2 ? -0.5 : 0.5, 0.5);
    if (quiet) continue;
    if (BASS[e]) bass(t, chord.bass * 2, e === 0 ? 0.6 : 0.34, db(-14));
    if (e % 2 === 0) kick(t);
    else hat(t, db(-30), e % 4 === 1 ? 0.3 : -0.3);
    if (e === 2 || e === 6) clap(t);
  }
  if (quiet) riser(bar + 1.0, 1.0, db(-27));
}

// ---------- scenes ----------
const at = (scene, t) => (t >= 0 || scene === 'x' ? AT[scene] + t : -1);

// Hook: a clock ticking over a still picture; the play button starts everything.
const H = P.hook;
for (let t = 0; t < H.click - 0.3; t += 0.5)
  add(
    at('hook', t),
    0.05,
    (s) => Math.sin(TAU * 2100 * s) * Math.exp(-s * 140),
    db(-27),
    (t * 2) % 2 ? 0.3 : -0.3,
    0.3,
  );
add(
  at('hook', 0),
  H.click + 0.1,
  (s) => Math.sin(TAU * 55 * s) * Math.min(1, s / 0.6) * 0.8,
  db(-24),
);
for (const t of [H.line1, H.line2])
  add(
    at('hook', t),
    0.5,
    (s) => Math.sin(TAU * (70 + 40 * Math.exp(-s * 20)) * s) * Math.exp(-s * 9),
    db(-13),
  );
riser(at('hook', H.click - 0.8), 0.8, db(-21));
blip(at('hook', H.playIn), 880, db(-23));
click(at('hook', H.click), db(-12));
impact(at('hook', H.click), db(-8));
bell(at('hook', H.click), 440, db(-19), 3);
bell(at('hook', H.click), 659.25, db(-22), 3, 0.3);

// Title: a sweep in, then the name rings.
whoosh(at('title', -0.05 + 0.05), 0.8, 300, 5000, db(-23));
impact(at('title', 0), db(-12));
[440, 523.25, 659.25, 880].forEach((f, i) => {
  bell(at('title', P.title.word + i * (short ? 0.09 : 0.125)), f, db(-17), 3, (i - 1.5) * 0.25);
});

// Chapters: a sweep and a hit on the card; a sweep as the device arrives.
for (const name of CHAPTERS) {
  const S = P[name];
  whoosh(at(name, 0), 0.6, 500, 3600, db(-25));
  impact(at(name, 0), db(short ? -15 : -11));
  if (S.cardOut >= 0) whoosh(at(name, S.cardOut - 0.1), 0.7, 900, 2400, db(-28));
}
// Chapter 1: each diagram arrives with a sweep; the first is started with the pointer, and the
// camera moves in on the packet with code.
const F = P.flow;
for (const d of F.d.slice(1)) {
  whoosh(at('flow', d.at - 0.2), 0.5, 700, 3000, db(-27));
  blip(at('flow', d.at), 1318.5, db(-27), 0.2);
  if (d.zoom >= 0) whoosh(at('flow', d.zoom), 1.2, 300, 2400, db(-28));
}
if (!short) click(at('flow', F.d[0].play));
if (F.push >= 0) whoosh(at('flow', F.push), 1.3, 200, 1200, db(-31));

// Chapter 2: the recording of VS Code. Keys in the Command Palette, the request being typed, a tone
// for each step the agent takes, all at the moments the cut of the recording shows them.
const K = P.skills;
const read = (name) => JSON.parse(readFileSync(resolve(here, 'recordings', name), 'utf8'));
const take = read(`take-${lang}.json`);
const plan = recPlan(take.marks, profile);
const M = take.marks;
const when = (src) => at('skills', K.rec + recAt(plan.segments, src));
if (!short) {
  key(when(M.paletteOpen), db(-21));
  for (let s = when(M.paletteType); s < when(M.palettePicks) - 0.4; s += 0.09) key(s, db(-27));
  key(when(M.palettePicks), db(-21));
  key(when(M.palettePick), db(-20));
  blip(when(M.skillInstalled) + 0.1, 880, db(-24));
  blip(when(M.skillInstalled) + 0.19, 1318.5, db(-24), 0.2);
  whoosh(at('skills', K.rec + plan.at.open), 0.9, 500, 2600, db(-28));
}
for (let s = when(M.promptType); s < when(M.promptTyped); s += 0.06)
  key(s, db(-30 - (Math.round(s * 100) % 3)));
[M.skill, M.read, M.write, M.check].forEach((mark, i) => {
  blip(when(mark), [659.25, 783.99, 880, 1318.5][i], db(i === 3 ? -19 : -23), -0.2);
});
whoosh(at('skills', K.res.at - 0.15), 0.7, 500, 3200, db(-25));
if (!short) {
  const playing = read(`play-${lang}.json`);
  click(at('skills', K.res.at + playing.play - playCut(playing.play, profile)[0]));
}
if (K.res.push >= 0) whoosh(at('skills', K.res.push), 1.2, 200, 1200, db(-31));

// Chapter 3: the Export menu, the page, the zoom, the theme switch.
const V = P.svg;
if (V.exp) {
  click(at('svg', V.exp.open));
  click(at('svg', V.exp.pick));
  blip(at('svg', V.exp.pick + 0.1), 1046.5, db(-22), 0.3);
  whoosh(at('svg', V.exp.out), 0.6, 600, 3000, db(-27));
}
[V.hub.a, V.hub.b, V.hub.c].forEach((t, i) => {
  blip(at('svg', t), [783.99, 880, 987.77][i], db(-25), 0.5);
});
whoosh(at('svg', V.hub.zoomIn), 1.0, 300, 2600, db(-27));
whoosh(at('svg', V.hub.zoomOut), 0.8, 2600, 300, db(-29));
click(at('svg', V.hub.light), db(-15));
if (V.hub.dark < V.dur - 0.1) click(at('svg', V.hub.dark), db(-17));

// Chapter 4: the file in a browser; the facts arrive one by one.
const W = P.html;
if (!short) {
  click(at('html', W.play));
  click(at('html', W.tick));
  for (const t of W.zoom) click(at('html', t));
}
W.chips.forEach((t, i) => {
  blip(at('html', t), [659.25, 783.99, 880, 1046.5][i], db(-26), -0.5);
});

// End: the groove stops on a hit and a rising chord that rings out.
whoosh(at('end', 0.01), 0.7, 400, 5000, db(-23));
impact(at('end', 0), db(-8));
pad(at('end', 0), P.end.dur, [130.81, 196.0, 261.63, 329.63, 392.0], db(-21));
bass(at('end', 0), 65.41, 2.5, db(-12));
[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
  bell(at('end', P.end.word + i * 0.125), f, db(-16), 4, (i - 1.5) * 0.25);
});
for (let i = 0; i < 4; i++)
  blip(at('end', P.end.pills + i * 0.09), 1318.5 + i * 110, db(-29), (i - 1.5) * 0.3);

// ---------- mix ----------
// The pad and the plucks duck under each kick, as a compressor keyed by the kick would make them.
const duck = new Float32Array(N).fill(1);
for (const t of kickTimes) {
  const i0 = Math.round(t * SR);
  for (let i = 0; i < 0.22 * SR && i0 + i < N; i++)
    duck[i0 + i] = Math.min(duck[i0 + i], 1 - 0.38 * Math.exp((-i / SR) * 14));
}

/** A small plate: four combs with damped feedback into two allpasses, different lengths left and right. */
function reverb(input, combs, allpasses) {
  const out = new Float32Array(N);
  for (const ms of combs) {
    const len = Math.round((ms / 1000) * SR);
    const buf = new Float32Array(len);
    let lp = 0;
    let p = 0;
    for (let i = 0; i < N; i++) {
      const y = buf[p];
      lp += 0.32 * (y - lp);
      buf[p] = input[i] + lp * 0.8;
      out[i] += y * 0.25;
      p = p + 1 === len ? 0 : p + 1;
    }
  }
  for (const ms of allpasses) {
    const len = Math.round((ms / 1000) * SR);
    const buf = new Float32Array(len);
    let p = 0;
    for (let i = 0; i < N; i++) {
      const b = buf[p];
      const x = out[i];
      buf[p] = x + b * 0.5;
      out[i] = b - x * 0.5;
      p = p + 1 === len ? 0 : p + 1;
    }
  }
  return out;
}
const wetL = reverb(SL, [29.7, 37.1, 41.1, 43.7], [5.0, 1.7]);
const wetR = reverb(SRv, [30.9, 36.3, 42.5, 44.9], [5.3, 1.9]);
const fadeFrom = (TOTAL - 1.0) * SR;
let peak = 0;
for (let i = 0; i < N; i++) {
  const fade = i > fadeFrom ? Math.max(0, 1 - (i - fadeFrom) / (1.2 * SR)) : 1;
  L[i] = Math.tanh((L[i] * (0.55 + 0.45 * duck[i]) + wetL[i] * 0.5) * 1.5) * fade;
  R[i] = Math.tanh((R[i] * (0.55 + 0.45 * duck[i]) + wetR[i] * 0.5) * 1.5) * fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = db(-1) / peak;

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
mkdirSync(resolve(here, 'out'), { recursive: true });
const name = `score-${profile}-${lang}.wav`;
writeFileSync(resolve(here, 'out', name), buf);
console.log(
  `${name}: ${TOTAL.toFixed(1)} s, peak ${(20 * Math.log10(peak)).toFixed(1)} dBFS before normalizing`,
);

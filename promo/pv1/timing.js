// One clock for the stage (browser), the capture and the score (Node): every scene's length and the
// moments inside it, in seconds. The music runs at 120 BPM, so a beat is 0.5 s; every cut is on a beat.
export const FPS = 60;
export const BEAT = 0.5;

export const ORDER = ['hook', 'title', 'flow', 'skills', 'svg', 'html', 'end'];

/** The four chapters shown on the timeline at the bottom of the screen. */
export const CHAPTERS = ['flow', 'skills', 'svg', 'html'];

export const T = {
  // The main video: 94 s. Scenes start on odd seconds, where the bars of the music begin.
  long: {
    hook: { dur: 7, line1: 0.35, line2: 1.3, linesOut: 2.2, playIn: 2.42, click: 3.0, out: 6.5 },
    title: { dur: 4, icon: 0.1, word: 0.45, tag: 0.95, ver: 1.3, out: 3.55 },
    flow: {
      dur: 24,
      card: 0,
      cardOut: 1.45,
      winIn: 1.5,
      // Each diagram: when it is on screen, when playing starts, when its caption shows. The last
      // one is a step whose packet carries code; the camera moves in on it at `zoom`.
      d: [
        { at: 1.5, play: 2.7, cap: 2.2 },
        { at: 7.5, play: 7.2, cap: 7.7 },
        { at: 12.5, play: 12.2, cap: 12.7 },
        { at: 17.5, play: 17.8, cap: 17.7, zoom: 18.7 },
      ],
      push: 4.2,
      out: 23.5,
    },
    skills: {
      dur: 24,
      card: 0,
      cardOut: 1.45,
      // The recording of VS Code starts at `rec` and runs through the phases of REC_PHASES.
      rec: 1.5,
      res: { at: 16.8, push: 18.6, stats: 19.2 },
      out: 23.5,
    },
    svg: {
      dur: 16,
      card: 0,
      cardOut: 1.45,
      exp: { at: 1.5, open: 2.8, item: 3.6, pick: 4.3, out: 5.5 },
      hub: {
        at: 5.8,
        a: 6.6,
        zoomIn: 8.4,
        b: 8.8,
        zoomOut: 10.7,
        light: 12.0,
        c: 12.2,
        dark: 14.6,
      },
      out: 15.5,
    },
    html: {
      dur: 12,
      card: 0,
      cardOut: 1.45,
      win: 1.5,
      play: 2.6,
      chips: [3.0, 3.7, 4.4, 5.1],
      tick: 6.6,
      zoom: [8.4, 8.9],
      out: 11.5,
    },
    end: { dur: 7, icon: 0.2, word: 0.55, tag: 0.95, pills: 1.5, search: 2.3, meta: 2.7, out: 6.4 },
  },
  // The cut for social media: 38 s, the same scenes with less in each. Scenes start on even seconds.
  short: {
    hook: { dur: 4, line1: 0.15, line2: 0.75, linesOut: 1.35, playIn: 1.5, click: 2.0, out: 3.7 },
    title: { dur: 2, icon: 0.0, word: 0.2, tag: 0.45, ver: 0.65, out: 1.75 },
    flow: {
      dur: 10,
      card: -1,
      cardOut: -1,
      winIn: 0,
      d: [
        { at: 0, play: -0.6, cap: 0.3 },
        { at: 2.5, play: 1.9, cap: 2.7 },
        { at: 5.0, play: 4.4, cap: 5.2 },
        { at: 7.5, play: 7.3, cap: 7.7, zoom: 7.9 },
      ],
      push: -1,
      out: 9.7,
    },
    skills: {
      dur: 8,
      card: -1,
      cardOut: -1,
      rec: 0,
      res: { at: 4.1, push: -1, stats: 5.2 },
      out: 7.7,
    },
    svg: {
      dur: 6,
      card: -1,
      cardOut: -1,
      exp: null,
      hub: { at: 0, a: 0.5, zoomIn: 1.9, b: 2.2, zoomOut: 3.6, light: 4.2, c: 4.4, dark: 5.75 },
      out: 5.7,
    },
    html: {
      dur: 4,
      card: -1,
      cardOut: -1,
      win: 0,
      play: -1.5,
      chips: [0.5, 0.9, 1.3, 1.7],
      tick: -1,
      zoom: null,
      out: 3.7,
    },
    end: { dur: 4, icon: 0.1, word: 0.35, tag: 0.65, pills: 1.0, search: 1.5, meta: 1.8, out: 3.6 },
  },
};

/** Where each scene starts in the finished video. */
export function starts(profile) {
  const at = {};
  let t = 0;
  for (const name of ORDER) {
    at[name] = t;
    t += T[profile][name].dur;
  }
  at.total = t;
  return at;
}

// ---------- the recordings of VS Code (take/take.mjs, take/play.mjs) ----------
// A take is cut into phases. Each phase is given a length in the video, and plays at whatever speed
// fits the part of the recording it shows; the speed is written on screen while it is not 1.
export const REC_PHASES = {
  long: [
    ['install', 5.0],
    ['open', 1.0],
    ['type', 3.0],
    ['work', 2.5],
    ['check', 3.5],
  ],
  short: [
    ['type', 1.2],
    ['work', 1.0],
    ['check', 1.8],
  ],
};

/** What each phase shows, in the take's own seconds, from the moments take.mjs noted. */
function phaseBounds(m) {
  const installed = m.skillInstalled + 2.6;
  const typing = m.promptType - 0.3;
  const sent = m.promptSent + 0.6;
  // The agent's work is shown from just before its first step. A take may wait long before that
  // (the English one did, for three minutes); the wait is cut, not sped through.
  const working = Math.max(sent, m.skill - 2);
  const writing = Math.max(working + 1, m.write - 0.5);
  return {
    install: [m.paletteOpen - 0.4, installed],
    open: [installed, typing],
    type: [typing, sent],
    work: [working, writing],
    check: [writing, m.check + 2.5],
  };
}

/**
 * The cut of a take: `segments` are [from, to, speed] in the take's seconds, `at` is when each phase
 * begins, in seconds of the cut, and `length` is how long the cut is.
 */
export function recPlan(marks, profile) {
  const bounds = phaseBounds(marks);
  const segments = [];
  const at = {};
  let t = 0;
  for (const [name, length] of REC_PHASES[profile]) {
    const [a, b] = bounds[name];
    segments.push([a, b, (b - a) / length]);
    at[name] = t;
    t += length;
  }
  return { segments, at, length: t };
}

/** The moment of the cut at which the recording shows its own second `src`. */
export function recAt(segments, src) {
  let out = 0;
  for (const [a, b, s] of segments) {
    if (src <= a) return out;
    if (src < b) return out + (src - a) / s;
    out += (b - a) / s;
  }
  return out;
}

/** The speed the recording plays at, `t` seconds into the cut. */
export function recSpeed(segments, t) {
  let out = 0;
  for (const [a, b, s] of segments) {
    out += (b - a) / s;
    if (t < out) return s;
  }
  return 1;
}

/** A speed as it is written on screen: "×12", "×1.6". */
export const speedLabel = (speed) => `×${speed >= 9.5 ? Math.round(speed) : speed.toFixed(1)}`;

/** The part of the recording of the playback that the video shows: [from, length], in its seconds. */
export function playCut(play, profile) {
  const scene = T[profile].skills;
  const length = scene.dur - scene.res.at;
  return profile === 'short' ? [play + 1.2, length] : [play - 1.3, length];
}

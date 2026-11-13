// Small animation kit for the stage. Nothing here keeps time: a timeline is a list of tweens, and
// render(t) sets every element to what it is at t, so any frame can be drawn on its own.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;

export const E = {
  lin: (x) => x,
  in2: (x) => x * x,
  in3: (x) => x ** 3,
  out2: (x) => 1 - (1 - x) ** 2,
  out3: (x) => 1 - (1 - x) ** 3,
  out4: (x) => 1 - (1 - x) ** 4,
  out5: (x) => 1 - (1 - x) ** 5,
  inOut2: (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2),
  inOut3: (x) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
  inOut4: (x) => (x < 0.5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2),
  outBack: (x) => 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2,
};

/** 0 → 1 over [start, start + dur], eased. */
export const seg = (t, start, dur, ease = E.out3) => ease(clamp((t - start) / dur));

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined) el.append(c);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs))
    if (v !== null && v !== undefined) el.setAttribute(k, v);
  for (const c of children.flat()) if (c !== null && c !== undefined) el.append(c);
  return el;
}

/** Wraps an element's content so it can slide up from behind its own baseline. */
export function mask(el) {
  const inner = h('span', { class: 'mask-in' });
  inner.append(...el.childNodes);
  el.classList.add('mask');
  el.append(inner);
  return inner;
}

const DEFAULTS = {
  opacity: 1,
  x: 0,
  y: 0,
  scale: 1,
  rx: 0,
  ry: 0,
  rz: 0,
  blur: 0,
  sat: 1,
  bright: 1,
};
const TRANSFORM = ['x', 'y', 'scale', 'rx', 'ry', 'rz'];
const FILTER = ['blur', 'sat', 'bright'];
const CLIP = ['clipT', 'clipR', 'clipB', 'clipL'];

export class Timeline {
  #tracks = new Map();
  #hooks = [];

  #track(el) {
    let track = this.#tracks.get(el);
    if (!track) {
      track = { init: {}, tweens: {} };
      this.#tracks.set(el, track);
    }
    return track;
  }

  /** What `el` is before any tween touches it. */
  set(el, props) {
    Object.assign(this.#track(el).init, props);
    return this;
  }

  /** Moves the given properties of `el` to new values over [at, at + dur]. */
  to(el, at, dur, props, ease = E.out3) {
    if (!(at >= 0)) return this;
    const track = this.#track(el);
    for (const [prop, value] of Object.entries(props)) {
      const list = track.tweens[prop] ?? [];
      track.tweens[prop] = list;
      list.push({ at, dur: Math.max(dur, 1e-6), to: value, ease });
      list.sort((a, b) => a.at - b.at);
    }
    return this;
  }

  /** The same tween on each element, each starting `gap` after the one before. */
  stagger(els, at, gap, dur, props, ease = E.out3) {
    els.forEach((el, i) => {
      this.to(el, at + i * gap, dur, props, ease);
    });
    return this;
  }

  /** In, then out again: for things that are on screen for a while. */
  show(el, at, until, { dy = 24, inDur = 0.6, outDur = 0.35, outDy = -12 } = {}) {
    this.set(el, { opacity: 0, y: dy });
    this.to(el, at, inDur, { opacity: 1, y: 0 }, E.out4);
    if (until !== undefined && until >= 0)
      this.to(el, until, outDur, { opacity: 0, y: outDy }, E.in2);
    return this;
  }

  /** Runs `fn(t)` on every frame, after the tweens. */
  each(fn) {
    this.#hooks.push(fn);
    return this;
  }

  value(el, prop, t) {
    const track = this.#tracks.get(el);
    let v = track?.init[prop] ?? DEFAULTS[prop] ?? 0;
    for (const tw of track?.tweens[prop] ?? []) {
      if (t < tw.at) break;
      v = lerp(v, tw.to, tw.ease(clamp((t - tw.at) / tw.dur)));
    }
    return v;
  }

  render(t) {
    for (const [el, track] of this.#tracks) {
      const names = new Set([...Object.keys(track.init), ...Object.keys(track.tweens)]);
      const v = {};
      for (const name of names) v[name] = this.value(el, name, t);
      const style = el.style;
      if ('opacity' in v) {
        style.opacity = v.opacity.toFixed(4);
        style.visibility = v.opacity <= 0.001 ? 'hidden' : 'visible';
      }
      if (TRANSFORM.some((p) => p in v)) {
        const g = (p) => v[p] ?? DEFAULTS[p];
        style.transform =
          `translate3d(${g('x').toFixed(2)}px, ${g('y').toFixed(2)}px, 0) ` +
          `rotateX(${g('rx').toFixed(3)}deg) rotateY(${g('ry').toFixed(3)}deg) rotate(${g('rz').toFixed(3)}deg) ` +
          `scale(${g('scale').toFixed(5)})`;
      }
      if (FILTER.some((p) => p in v)) {
        const g = (p) => v[p] ?? DEFAULTS[p];
        const parts = [];
        if (g('blur') > 0.01) parts.push(`blur(${g('blur').toFixed(2)}px)`);
        if (Math.abs(g('sat') - 1) > 0.001) parts.push(`saturate(${g('sat').toFixed(3)})`);
        if (Math.abs(g('bright') - 1) > 0.001) parts.push(`brightness(${g('bright').toFixed(3)})`);
        style.filter = parts.join(' ') || 'none';
      }
      if (CLIP.some((p) => p in v)) {
        const g = (p) => (v[p] ?? 0).toFixed(3);
        style.clipPath = `inset(${g('clipT')}% ${g('clipR')}% ${g('clipB')}% ${g('clipL')}%)`;
      }
      if ('w' in v) style.width = `${v.w.toFixed(2)}px`;
      if ('h' in v) style.height = `${v.h.toFixed(2)}px`;
      for (const name of names)
        if (name.startsWith('--')) style.setProperty(name, v[name].toFixed(4));
    }
    for (const fn of this.#hooks) fn(t);
  }
}

/** A point `f` (0..1) of the way along an SVG path. */
export function along(path, f) {
  const p = path.getPointAtLength(path.getTotalLength() * clamp(f));
  return [p.x, p.y];
}

/** A rail with right-angled turns through the given points, its corners rounded by `r`. */
export function railPath(points, r = 36) {
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i];
    const [px, py] = points[i - 1];
    const next = points[i + 1];
    if (!next) {
      d += ` L ${x} ${y}`;
      break;
    }
    const inX = Math.sign(x - px);
    const inY = Math.sign(y - py);
    const outX = Math.sign(next[0] - x);
    const outY = Math.sign(next[1] - y);
    d += ` L ${x - inX * r} ${y - inY * r} Q ${x} ${y} ${x + outX * r} ${y + outY * r}`;
  }
  return d;
}

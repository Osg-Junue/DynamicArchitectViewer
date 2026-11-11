import type { Layout, Rect } from '../layout';
import type { DavDocument } from '../model/types';
import {
  HOLD_MS,
  h,
  type Packet,
  PHASE_MS,
  type ResolvedView,
  resolveView,
  type VElement,
  type VNode,
} from '../scene';

/** Time between two recorded positions of a moving packet; the viewer interpolates between. */
export const SAMPLE_MS = 66;
const CAMERA_SPLINE = '0.2 0.8 0.3 1';
const LINEAR_SPLINE = '0 0 1 1';

export type Interval = readonly [start: number, end: number];

export interface PhaseSlot {
  packets: Packet[];
  start: number;
  /** The last phase stays on screen until the step ends, as in the preview. */
  end: number;
  durationMs: number;
}

export interface StepSlot {
  /** The step's place in the diagram, which an export of one step keeps. */
  index: number;
  view: ResolvedView;
  start: number;
  phasesEnd: number;
  end: number;
  phases: PhaseSlot[];
}

/**
 * Plays every step at 1x, as "Play all" does: each phase in turn, then a hold. With `only`, plays
 * that one step, as "Play step" does.
 */
export function schedule(
  doc: DavDocument,
  layout: Layout,
  only?: number,
): { steps: StepSlot[]; total: number } {
  let t = 0;
  const indices = only === undefined ? doc.steps.map((_, i) => i) : [only];
  const steps = indices.map((i): StepSlot => {
    const view = resolveView(doc, layout, i);
    const start = t;
    const phases = view.phases.map((packets, j): PhaseSlot => {
      const durationMs = view.phaseDurations[j] ?? PHASE_MS;
      const slot = { packets, start: t, end: 0, durationMs };
      t += durationMs;
      return slot;
    });
    const phasesEnd = t;
    t += HOLD_MS;
    phases.forEach((phase, j) => {
      phase.end = phases[j + 1]?.start ?? t;
    });
    return { index: i, view, start, phasesEnd, end: t, phases };
  });
  return { steps, total: t };
}

/** The parts of a span that none of the intervals cover. */
export function complement(intervals: readonly Interval[], [from, to]: Interval): Interval[] {
  const out: Interval[] = [];
  let t = from;
  for (const [a, b] of [...intervals].sort((x, y) => x[0] - y[0])) {
    if (a > t) out.push([t, Math.min(a, to)]);
    t = Math.max(t, b);
  }
  if (t < to) out.push([t, to]);
  return out;
}

export function intersect(a: readonly Interval[], b: readonly Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const [a0, a1] of a) {
    for (const [b0, b1] of b) {
      const lo = Math.max(a0, b0);
      const hi = Math.min(a1, b1);
      if (lo < hi) out.push([lo, hi]);
    }
  }
  return out;
}

/** Joins adjacent positive-length intervals from an already-ordered sequence. */
export function mergeIntervals(intervals: Iterable<Interval>): Interval[] {
  const out: Interval[] = [];
  for (const [a, b] of intervals) {
    if (b <= a) continue;
    const prev = out[out.length - 1];
    if (prev && prev[1] === a) out[out.length - 1] = [prev[0], b];
    else out.push([a, b]);
  }
  return out;
}

/** SMIL animations that all last the whole playback and repeat, so that they stay in step. */
export class Clock {
  constructor(readonly total: number) {}

  #keyTime(t: number): string {
    return String(Number(clamp(t / this.total, 0, 1).toFixed(5)));
  }

  #timing(): Record<string, string> {
    return { dur: `${Math.round(this.total)}ms`, repeatCount: 'indefinite' };
  }

  /** Shows an element only during the intervals, and as at the start for viewers without SMIL. */
  showDuring<T extends VElement>(el: T, intervals: readonly Interval[]): T {
    const shownAt = (t: number) => intervals.some(([a, b]) => a <= t && t < b);
    const changes = [...new Set(intervals.flat().filter((t) => t > 0 && t < this.total))].sort(
      (a, b) => a - b,
    );
    const keys: Array<[number, boolean]> = [[0, shownAt(0)]];
    for (const t of changes) {
      const shown = shownAt(t);
      if (shown !== keys[keys.length - 1]?.[1]) keys.push([t, shown]);
    }
    if (!shownAt(0)) el.attrs.display = 'none';
    if (keys.length > 1) {
      el.children.push(
        h('animate', {
          attributeName: 'display',
          values: keys.map(([, shown]) => (shown ? 'inline' : 'none')).join(';'),
          keyTimes: keys.map(([t]) => this.#keyTime(t)).join(';'),
          calcMode: 'discrete',
          ...this.#timing(),
        }),
      );
    }
    return el;
  }

  /**
   * Moves an attribute through values at given times, holding the first and last ones before
   * and after. `null` when it never changes.
   */
  track(
    attributeName: string,
    keys: ReadonlyArray<readonly [number, string]>,
    options: { eased?: boolean; translate?: boolean } = {},
  ): VElement | null {
    const first = keys[0];
    const last = keys[keys.length - 1];
    if (!first || !last || keys.every(([, v]) => v === first[1])) return null;
    const all: Array<readonly [number, string]> = [];
    for (const key of [[0, first[1]] as const, ...keys, [this.total, last[1]] as const]) {
      const prev = all[all.length - 1];
      if (prev && prev[0] === key[0] && prev[1] === key[1]) continue;
      const prev2 = all[all.length - 2];
      if (!options.eased && prev && prev2 && prev2[1] === key[1] && prev[1] === key[1]) {
        all[all.length - 1] = key;
        continue;
      }
      all.push(key);
    }
    const splines = options.eased
      ? {
          calcMode: 'spline',
          keySplines: all
            .slice(1)
            .map(([, v], i) => (v === all[i]?.[1] ? LINEAR_SPLINE : CAMERA_SPLINE))
            .join(';'),
        }
      : {};
    return h(options.translate ? 'animateTransform' : 'animate', {
      attributeName,
      ...(options.translate ? { type: 'translate' } : {}),
      values: all.map(([, v]) => v).join(';'),
      keyTimes: all.map(([t]) => this.#keyTime(t)).join(';'),
      ...splines,
      ...this.#timing(),
    });
  }
}

export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));
const round = (v: number): number => Math.round(v * 10) / 10;
export const num = (v: number): string => String(round(v));
export const viewBoxOf = (r: Rect): string =>
  `${num(r.x)} ${num(r.y)} ${num(r.width)} ${num(r.height)}`;

export function roundRect(r: Rect): Record<'x' | 'y' | 'width' | 'height', string> {
  return { x: num(r.x), y: num(r.y), width: num(r.width), height: num(r.height) };
}

export function pushAll(el: VElement, ...children: Array<VElement | null>): VElement {
  for (const child of children) if (child) el.children.push(child);
  return el;
}

export function withAttrs(el: VElement, attrs: Record<string, string | number>): VElement {
  return { ...el, attrs: { ...el.attrs, ...attrs }, children: [...el.children] };
}

export function isElement(node: VNode | undefined): node is VElement {
  return typeof node === 'object';
}

export function childWithClass(el: VElement, cls: string): VElement | undefined {
  for (const child of el.children) {
    if (!isElement(child)) continue;
    if (
      String(child.attrs.class ?? '')
        .split(' ')
        .includes(cls)
    )
      return child;
    const found = childWithClass(child, cls);
    if (found) return found;
  }
  return undefined;
}

export function layer(scene: VElement, cls: string): VElement | undefined {
  return scene.children.find((c): c is VElement => isElement(c) && c.attrs.class === cls);
}

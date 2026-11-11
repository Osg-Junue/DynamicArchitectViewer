import { parse } from '../dsl';
import { computeLayout, type Layout, type Rect } from '../layout';
import type { DavDocument } from '../model/types';
import { VIEWER_STRINGS, type ViewerLocale } from '../runtime/i18n';
import sceneStyles from '../runtime/scene.css?raw';
import {
  activeLabelFill,
  boundsOf,
  buildDefs,
  buildPacket,
  buildScene,
  calmFrame,
  computePacketCalloutBox,
  estimateTextWidth,
  fitText,
  fitZoom,
  flowColors,
  framePose,
  HOLD_MS,
  h,
  MAX_FIT_ZOOM,
  type Packet,
  PHASE_MS,
  type Pose,
  packetBubblePath,
  packetPosition,
  packetsOnScreen,
  paint,
  placeZoneLabels,
  type ResolvedView,
  resolveView,
  type Size,
  stepFrame,
  type VElement,
  type VNode,
  visibleWorld,
  wholeDiagramFrame,
  ZONE_LABEL,
  type ZoneLabelEntry,
  type ZoneMove,
  zoneColor,
  zoneLabelRoom,
  zoneMoves,
} from '../scene';
import { ICON_SHAPES } from '../scene/icons';
import { wrapText } from '../scene/text';
import { toXml } from './xml';

export interface SvgExportOptions {
  locale?: ViewerLocale;
  /**
   * `true` (default) plays every step in a loop, with the camera following the flow as in the
   * preview. `false`, or a diagram without steps, gives a still picture of the whole diagram.
   */
  animate?: boolean;
  /**
   * Where an animated SVG looks. `'follow'` (default) moves like the preview's camera: closer on
   * each step, and on to the zones a phase moves between. `'whole'` keeps the whole diagram in
   * view, on a canvas of its proportions, and only the flows move.
   */
  camera?: 'follow' | 'whole';
  /**
   * Exports only this step (0-based), keeping its number in the diagram. Animated, it repeats the
   * step's phases, as "Play step" does; still, it frames the whole diagram while showing the
   * step's state and lit flows as the preview does with animation stopped. Every step by default.
   */
  step?: number;
}

/**
 * The animated SVG is meant for places that show images but run no script, such as a README on
 * GitHub or GitLab. Everything moves with SMIL, which works in `<img>`, and the whole file is one
 * loop: every animation lasts the length of the playback and repeats.
 */

const WIDTH = 960;
const CANVAS_HEIGHT = 540;
/** A fixed camera's canvas follows the diagram's proportions, within these heights. */
const WHOLE_CANVAS_HEIGHT = { min: 240, max: 1200 } as const;
const PAD_X = 16;
const TIMELINE_HEIGHT = 20;
const ZONE_STRIP_HEIGHT = 36;
/** Time between two recorded positions of a moving packet; the viewer interpolates between. */
const SAMPLE_MS = 66;
/** The preview's camera eases with a time constant of 160 ms; this is about when it settles. */
const CAMERA_EASE_MS = 800;
const CAMERA_SPLINE = '0.2 0.8 0.3 1';
const LINEAR_SPLINE = '0 0 1 1';
const MINIMAP_MAX = { width: 180, height: 64 } as const;
const MINIMAP_PAD = 40;
const MAX_ZONE_MOVES = 3;

const SVG_STYLES = sceneStyles
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s*([{};,])\s*/g, '$1')
  .replace(/([;{])(--?[\w-]+)\s*:\s*/g, '$1$2:')
  .replace(/;}/g, '}')
  .replace(/:root\b/g, '.dav-svg')
  .trim();

/** Generates an SVG file that needs no script and makes no external request. */
export function exportSvg(source: string | DavDocument, options: SvgExportOptions = {}): string {
  const document = typeof source === 'string' ? parse(source).document : source;
  const layout = computeLayout(document);
  const locale = options.locale ?? 'en';
  const { step } = options;
  if (step !== undefined) {
    if (!Number.isInteger(step) || step < 0 || step >= document.steps.length) {
      throw new RangeError(`No step ${step} in a diagram with ${document.steps.length} steps`);
    }
    return options.animate === false
      ? stepStillSvg(document, layout, step, locale)
      : animatedSvg(document, layout, locale, options.camera ?? 'follow', step);
  }
  return options.animate === false || document.steps.length === 0
    ? stillSvg(document, layout)
    : animatedSvg(document, layout, locale, options.camera ?? 'follow');
}

const num = (v: number): string => String(Math.round(v * 10) / 10);
const viewBoxOf = (r: Rect): string => `${num(r.x)} ${num(r.y)} ${num(r.width)} ${num(r.height)}`;

function svgDocument(
  size: Size,
  viewBox: string,
  title: string,
  description: string | undefined,
  children: VNode[],
): string {
  const root = h(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      class: 'dav-svg',
      width: num(size.width),
      height: num(size.height),
      viewBox,
      role: 'img',
      'aria-label': title,
      'aria-describedby': description ? 'dav-desc' : undefined,
    },
    h('title', {}, title),
    description ? h('desc', { id: 'dav-desc' }, description) : null,
    h('style', {}, SVG_STYLES),
    ...children,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n${toXml(root)}\n`;
}

function stillSvg(doc: DavDocument, layout: Layout): string {
  const view = resolveView(doc, layout, null);
  const { rect } = wholeDiagramFrame(layout, view);
  return svgDocument(rect, viewBoxOf(rect), doc.title || 'DynamicArchitectViewer', undefined, [
    h('rect', { ...roundRect(rect), fill: 'var(--dav-bg)' }),
    buildDefs(),
    buildScene(view, ICON_SHAPES),
  ]);
}

// -----------------------------------------------------------------------------
// Schedule
// -----------------------------------------------------------------------------

type Interval = readonly [start: number, end: number];

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
function complement(intervals: readonly Interval[], [from, to]: Interval): Interval[] {
  const out: Interval[] = [];
  let t = from;
  for (const [a, b] of [...intervals].sort((x, y) => x[0] - y[0])) {
    if (a > t) out.push([t, Math.min(a, to)]);
    t = Math.max(t, b);
  }
  if (t < to) out.push([t, to]);
  return out;
}

/** SMIL animations that all last the whole playback and repeat, so that they stay in step. */
class Clock {
  constructor(readonly total: number) {}

  #keyTime(t: number): string {
    return String(Number(Math.min(1, Math.max(0, t / this.total)).toFixed(5)));
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

function pushAll(el: VElement, ...children: Array<VElement | null>): VElement {
  for (const child of children) if (child) el.children.push(child);
  return el;
}

function withAttrs(el: VElement, attrs: Record<string, string | number>): VElement {
  return { ...el, attrs: { ...el.attrs, ...attrs }, children: [...el.children] };
}

function isElement(node: VNode | undefined): node is VElement {
  return typeof node === 'object';
}

function childWithClass(el: VElement, cls: string): VElement | undefined {
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

// -----------------------------------------------------------------------------
// Camera
// -----------------------------------------------------------------------------

const samePose = (a: Pose, b: Pose) =>
  Math.abs(a.zoom - b.zoom) < 1e-4 &&
  Math.abs(a.panX - b.panX) < 0.5 &&
  Math.abs(a.panY - b.panY) < 0.5;

/** Where the preview's camera heads during "Play all", and when: the same framing rules. */
export function planCamera(
  canvas: Size,
  layout: Layout,
  steps: readonly StepSlot[],
): Array<[number, Pose]> {
  const events: Array<[number, Pose]> = [];
  for (const step of steps) {
    const first = step.phases[0];
    let pose = framePose(
      canvas,
      stepFrame(canvas, layout, step.view, first ? { follow: first.packets } : {}),
    );
    events.push([step.start, pose]);
    for (const phase of step.phases.slice(1)) {
      if (packetsOnScreen(layout, phase.packets, visibleWorld(canvas, pose))) continue;
      const frame = calmFrame(canvas, layout, phase.packets);
      if (!frame) continue;
      pose = framePose(canvas, frame);
      events.push([phase.start, pose]);
    }
  }
  return events;
}

/**
 * The camera's path as eased moves between poses, starting framed on the first step and holding
 * the last pose until the loop restarts.
 */
function cameraKeys(events: Array<[number, Pose]>, total: number): Array<[number, Pose]> {
  const first = events[0]?.[1];
  if (!first) return [];
  const keys: Array<[number, Pose]> = [[0, first]];
  let current = first;
  events.forEach(([t, pose], i) => {
    if (samePose(pose, current)) return;
    const next = events[i + 1]?.[0] ?? total;
    keys.push([t, current], [Math.min(t + CAMERA_EASE_MS, next), pose]);
    current = pose;
  });
  return keys;
}

const cubicCoord = (p1: number, p2: number, s: number): number =>
  3 * (1 - s) * (1 - s) * s * p1 + 3 * (1 - s) * s * s * p2 + s * s * s;

/** Evaluates `CAMERA_SPLINE` ('0.2 0.8 0.3 1') at normalized segment time `u` in [0, 1]. */
function cameraEase(u: number): number {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (cubicCoord(0.2, 0.3, mid) < u) lo = mid;
    else hi = mid;
  }
  return cubicCoord(0.8, 1, (lo + hi) / 2);
}

/** Samples the visible world rect across camera moves, staying sparse while the camera rests. */
function cameraSamples(
  camera: ReadonlyArray<readonly [number, Rect]>,
  fallback: Rect,
  total: number,
): Array<[number, Rect]> {
  const start = camera[0]?.[1] ?? fallback;
  const out: Array<[number, Rect]> = [[0, start]];
  for (let i = 0; i < camera.length - 1; i++) {
    const [t0, a] = camera[i] ?? [0, start];
    const [t1, b] = camera[i + 1] ?? [t0, a];
    if (t1 <= t0) continue;
    if (a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height) {
      out.push([t1, b]);
      continue;
    }
    const count = Math.max(2, Math.ceil((t1 - t0) / SAMPLE_MS));
    for (let j = 1; j <= count; j++) {
      const u = j / count;
      const v = cameraEase(u);
      out.push([
        t0 + (t1 - t0) * u,
        {
          x: a.x + (b.x - a.x) * v,
          y: a.y + (b.y - a.y) * v,
          width: a.width + (b.width - a.width) * v,
          height: a.height + (b.height - a.height) * v,
        },
      ]);
    }
  }
  const last = out[out.length - 1];
  if (last && last[0] < total) out.push([total, last[1]]);
  return out;
}

// -----------------------------------------------------------------------------
// Scene
// -----------------------------------------------------------------------------

function layer(scene: VElement, cls: string): VElement | undefined {
  return scene.children.find((c): c is VElement => isElement(c) && c.attrs.class === cls);
}

/** Adds to a list keyed by a string, keeping first-seen order. */
function addTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  map.set(key, [...(map.get(key) ?? []), value]);
}

/**
 * Does over time what the preview's player does for the running phase: shows its flows, bolds its
 * rail labels, lights its numbered stop and outlines the zones it moves between.
 */
function animateHighlights(scene: VElement, step: StepSlot, clock: Clock): void {
  const { phases, view } = step;
  if (phases.length === 0) return;
  const colors = phases.map((phase) => flowColors(phase.packets));
  const span: Interval = [step.start, step.end];
  const during = (phase: PhaseSlot): Interval => [phase.start, phase.end];

  const flows = layer(scene, 'dav-layer-flows');
  if (flows) {
    flows.children = flows.children.flatMap((flow) => {
      if (!isElement(flow)) return [];
      const byColor = new Map<string, Interval[]>();
      phases.forEach((phase, j) => {
        const color = colors[j]?.get(String(flow.attrs['data-edge']));
        if (color !== undefined) addTo(byColor, color, during(phase));
      });
      return [...byColor].map(([color, intervals]) =>
        clock.showDuring(withAttrs(flow, { stroke: paint(color) }), intervals),
      );
    });
  }

  for (const label of layer(scene, 'dav-layer-labels')?.children ?? []) {
    const text = isElement(label) ? label.children[0] : undefined;
    if (!isElement(label) || !isElement(text) || text.attrs['data-edge'] === undefined) continue;
    const byColor = new Map<string, Interval[]>();
    phases.forEach((phase, j) => {
      const color = colors[j]?.get(String(text.attrs['data-edge']));
      if (color !== undefined) addTo(byColor, color, during(phase));
    });
    label.children = [
      clock.showDuring(withAttrs(text, {}), complement([...byColor.values()].flat(), span)),
      ...[...byColor].map(([color, intervals]) =>
        clock.showDuring(
          withAttrs(text, { fill: activeLabelFill(color), 'font-weight': 700 }),
          intervals,
        ),
      ),
    ];
  }

  const stops = layer(scene, 'dav-layer-stops');
  if (stops) {
    stops.children = stops.children.flatMap((stop) => {
      if (!isElement(stop)) return [];
      const phase = phases[Number(stop.attrs['data-phase'])];
      if (!phase) return [stop];
      const current = withAttrs(stop, { class: 'dav-stop is-current' });
      current.children = current.children.map((child) => {
        if (!isElement(child)) return child;
        if (child.tag === 'circle') {
          return withAttrs(child, { fill: String(stop.attrs['data-active-fill']), r: 14 });
        }
        return withAttrs(child, { fill: String(stop.attrs['data-active-text']) });
      });
      return [
        clock.showDuring(withAttrs(stop, {}), complement([during(phase)], span)),
        clock.showDuring(current, [during(phase)]),
      ];
    });
  }

  const groups = layer(scene, 'dav-layer-groups');
  if (groups) {
    const rects = new Map(view.groups.map((g) => [g.id, g.rect]));
    const outlines = new Map<string, { rect: Rect; color: string; intervals: Interval[] }>();
    for (const phase of phases) {
      for (const place of zoneMoves(view, phase.packets).flat()) {
        const rect = rects.get(place.id);
        if (!rect) continue;
        const color = zoneColor(place.color);
        const key = `${place.id}\n${color}`;
        const outline = outlines.get(key) ?? { rect, color, intervals: [] };
        if (!outline.intervals.some(([a]) => a === phase.start)) {
          outline.intervals.push(during(phase));
        }
        outlines.set(key, outline);
      }
    }
    for (const { rect, color, intervals } of outlines.values()) {
      groups.children.push(
        clock.showDuring(
          h('rect', {
            ...roundRect(rect),
            rx: 14,
            fill: 'none',
            stroke: color,
            'stroke-width': 1.75,
            'vector-effect': 'non-scaling-stroke',
          }),
          intervals,
        ),
      );
    }
  }
}

function packetTimes(durationMs: number): number[] {
  const count = Math.max(2, Math.ceil(durationMs / SAMPLE_MS));
  return Array.from({ length: count + 1 }, (_, i) => (durationMs * i) / count);
}

/** A packet riding its rail during its phase; it waits at the end once it arrives. */
function animatedPacket(packet: Packet, phase: PhaseSlot, clock: Clock): VElement {
  const el = buildPacket(packet, ICON_SHAPES, 0);
  const times = packetTimes(packet.durationMs);
  const points = times.map((ms) => packetPosition(packet, ms / packet.durationMs));
  const dot = childWithClass(el, 'dav-packet-dot');
  if (dot) {
    pushAll(
      dot,
      clock.track(
        'transform',
        times.map((ms, i) => [
          phase.start + ms,
          `${num(points[i]?.x ?? 0)},${num(points[i]?.y ?? 0)}`,
        ]),
        { translate: true },
      ),
    );
  }
  const bubble = childWithClass(el, 'dav-packet-bubble');
  const box = computePacketCalloutBox(packet);
  if (bubble && box) {
    pushAll(
      bubble,
      clock.track(
        'd',
        times.map((ms, i) => [
          phase.start + ms,
          packetBubblePath(box, points[i] ?? { x: 0, y: 0 }),
        ]),
      ),
    );
  }
  return el;
}

// -----------------------------------------------------------------------------
// Chrome around the canvas
// -----------------------------------------------------------------------------

const COLOR = {
  bg: 'var(--dav-bg)',
  fg: 'var(--dav-fg)',
  muted: 'var(--dav-muted)',
  panel: 'var(--dav-panel)',
  border: 'var(--dav-border)',
  borderStrong: 'var(--dav-border-strong)',
  accent: 'var(--dav-accent)',
} as const;

const TITLE_SIZE = 14;
const DESC_SIZE = 13;
const DESC_LINE = 19;
const STEP_NO_SIZE = 11.5;

/** The step's number, title and description; `aside` keeps room on the right for the minimap. */
function header(
  steps: readonly StepSlot[],
  stepCount: number,
  locale: ViewerLocale,
  clock: Clock,
  aside: Size | null,
): { el: VElement; height: number } {
  const strings = VIEWER_STRINGS[locale];
  const right = WIDTH - PAD_X - (aside ? aside.width + PAD_X : 0);
  const room = right - PAD_X;
  const descs = steps.map((step) => wrapText(step.view.description ?? '', DESC_SIZE, room, 2));
  const descLines = Math.max(0, ...descs.map((lines) => lines.length));
  const titleY = 12 + TITLE_SIZE + 2;
  const height = Math.max(
    titleY + descLines * DESC_LINE + 12,
    aside ? Math.ceil(aside.height) + 16 : 0,
  );
  const el = h('g', {}, h('rect', { x: 0, y: 0, width: WIDTH, height, fill: COLOR.bg }));
  steps.forEach((step, i) => {
    const stepNo = strings.stepLabel(step.index + 1, stepCount);
    const titleX = PAD_X + estimateTextWidth(stepNo, STEP_NO_SIZE) + 10;
    el.children.push(
      clock.showDuring(
        h(
          'g',
          {},
          h(
            'text',
            {
              x: PAD_X,
              y: titleY,
              class: 'dav-mono',
              'font-size': STEP_NO_SIZE,
              fill: COLOR.muted,
            },
            stepNo,
          ),
          h(
            'text',
            { x: titleX, y: titleY, 'font-size': TITLE_SIZE, 'font-weight': 700, fill: COLOR.fg },
            fitText(step.view.stepTitle ?? '', TITLE_SIZE, right - titleX),
          ),
          ...(descs[i] ?? []).map((line, k) =>
            h(
              'text',
              { x: PAD_X, y: titleY + (k + 1) * DESC_LINE, 'font-size': DESC_SIZE, fill: COLOR.fg },
              line,
            ),
          ),
        ),
        [[step.start, step.end]],
      ),
    );
  });
  return { el, height };
}

/** The step ruler: one graduation per step, filling up as its phases play. */
function timeline(steps: readonly StepSlot[], top: number, clock: Clock, total: number): VElement {
  const width = WIDTH / steps.length;
  const el = h(
    'g',
    {},
    h('rect', { x: 0, y: top, width: WIDTH, height: TIMELINE_HEIGHT, fill: COLOR.bg }),
    h('path', { d: `M 0 ${top} H ${WIDTH}`, stroke: COLOR.border }),
    h('path', { d: `M 0 ${top + TIMELINE_HEIGHT} H ${WIDTH}`, stroke: COLOR.border }),
  );
  steps.forEach((step, i) => {
    const x = i * width;
    const fillY = top + TIMELINE_HEIGHT - 3;
    if (i > 0) {
      el.children.push(
        h('path', { d: `M ${num(x)} ${top} V ${top + TIMELINE_HEIGHT}`, stroke: COLOR.border }),
      );
    }
    const hasPhases = step.start < step.phasesEnd;
    el.children.push(
      h(
        'text',
        { x: num(x + 5), y: top + 14, class: 'dav-mono', 'font-size': 10.5, fill: COLOR.muted },
        String(i + 1).padStart(2, '0'),
      ),
      clock.showDuring(
        h('rect', { x: num(x), y: fillY, width: num(width), height: 3, fill: COLOR.borderStrong }),
        [[step.end, total]],
      ),
      clock.showDuring(
        pushAll(
          h('rect', {
            x: num(x),
            y: fillY,
            width: hasPhases ? 0 : num(width),
            height: 3,
            fill: COLOR.accent,
          }),
          hasPhases
            ? clock.track('width', [
                [step.start, '0'],
                [step.phasesEnd, num(width)],
              ])
            : null,
        ),
        [[step.start, step.end]],
      ),
    );
  });
  return el;
}

const ZONE_SIZE = 14;
const ZONE_LINE = 72;
const ZONE_PAIR_GAP = 10;
const ZONE_MOVE_GAP = 24;
const ZONE_NAME_MAX = 220;

/**
 * A zone's name after a dot of its color. Names are anchored at the end that touches the line,
 * so that an estimated text width only moves the whole strip, never the gaps.
 */
function zoneName(
  place: ZoneMove[number],
  x: number,
  y: number,
  anchor: 'start' | 'end',
  fill: string,
  suffix?: string,
): VElement {
  return h(
    'text',
    { x: num(x), y, 'text-anchor': anchor, 'font-size': ZONE_SIZE, 'font-weight': 600, fill },
    h('tspan', { fill: zoneColor(place.color) }, '● '),
    fitText(place.label, ZONE_SIZE, ZONE_NAME_MAX),
    suffix ? h('tspan', { fill: COLOR.muted, 'font-weight': 400 }, ` ${suffix}`) : null,
  );
}

/** Names the zones of the running phase, as the strip above the preview's canvas does. */
function zoneStrip(
  steps: readonly StepSlot[],
  top: number,
  locale: ViewerLocale,
  clock: Clock,
): VElement | null {
  const inside = VIEWER_STRINGS[locale].zoneInside;
  const y = top + ZONE_STRIP_HEIGHT / 2 + 5;
  const lineY = top + ZONE_STRIP_HEIGHT / 2 - 1;
  const el = h(
    'g',
    {},
    h('rect', { x: 0, y: top, width: WIDTH, height: ZONE_STRIP_HEIGHT, fill: COLOR.bg }),
  );
  const nameWidth = (place: ZoneMove[number]) =>
    estimateTextWidth(`● ${fitText(place.label, ZONE_SIZE, ZONE_NAME_MAX)}`, ZONE_SIZE);

  for (const step of steps) {
    for (const phase of step.phases) {
      const allMoves = zoneMoves(step.view, phase.packets);
      const moves = allMoves.slice(0, MAX_ZONE_MOVES);
      if (moves.length === 0) continue;
      const widths = moves.map(([from, to]) =>
        from === to
          ? nameWidth(from) + estimateTextWidth(` ${inside}`, ZONE_SIZE)
          : nameWidth(from) + ZONE_PAIR_GAP * 2 + ZONE_LINE + nameWidth(to),
      );
      const total = widths.reduce((sum, w) => sum + w, 0) + ZONE_MOVE_GAP * (moves.length - 1);
      let x = Math.max(PAD_X, (WIDTH - total) / 2);
      const parts: VElement[] = [];
      moves.forEach(([from, to], i) => {
        if (from === to) {
          parts.push(zoneName(from, x, y, 'start', COLOR.fg, inside));
        } else {
          const lineX = x + nameWidth(from) + ZONE_PAIR_GAP;
          parts.push(
            zoneName(from, lineX - ZONE_PAIR_GAP, y, 'end', COLOR.muted),
            h('rect', {
              x: num(lineX),
              y: lineY,
              width: ZONE_LINE,
              height: 2,
              fill: COLOR.borderStrong,
            }),
            pushAll(
              h('rect', {
                x: num(lineX),
                y: lineY,
                width: 0,
                height: 2,
                fill: zoneColor(to.color),
              }),
              clock.track('width', [
                [phase.start, '0'],
                [phase.start + phase.durationMs, String(ZONE_LINE)],
              ]),
            ),
            zoneName(to, lineX + ZONE_LINE + ZONE_PAIR_GAP, y, 'start', COLOR.fg),
          );
        }
        x += (widths[i] ?? 0) + ZONE_MOVE_GAP;
      });
      const more = allMoves.length - MAX_ZONE_MOVES;
      if (more > 0) {
        parts.push(
          h('text', { x: num(x), y, 'font-size': ZONE_SIZE, fill: COLOR.muted }, `+${more}`),
        );
      }
      el.children.push(clock.showDuring(h('g', {}, ...parts), [[phase.start, phase.end]]));
    }
  }
  return el.children.length > 1 ? el : null;
}

interface MinimapFrame {
  zones: DavDocument['groups'];
  bounds: Rect;
  size: Size;
}

/** The top-level zones and the size they get in the minimap; `null` without zones. */
function minimapFrame(doc: DavDocument, layout: Layout): MinimapFrame | null {
  const zones = doc.groups.filter((g) => g.parentId === undefined);
  const rects = zones.flatMap((g) => layout.groups[g.id] ?? []);
  if (rects.length === 0) return null;
  const bounds = boundsOf(rects, MINIMAP_PAD, 0);
  const scale = Math.min(MINIMAP_MAX.width / bounds.width, MINIMAP_MAX.height / bounds.height);
  return { zones, bounds, size: { width: bounds.width * scale, height: bounds.height * scale } };
}

/**
 * The zones each step is about and the part the camera shows. It sits beside the step's text
 * rather than over the canvas, where it would hide part of the diagram.
 */
function minimap(
  { zones, bounds, size }: MinimapFrame,
  layout: Layout,
  steps: readonly StepSlot[],
  at: { x: number; y: number },
  camera: Array<[number, Rect]>,
  clock: Clock,
): VElement {
  const inner = h('svg', {
    x: num(at.x),
    y: num(at.y),
    width: num(size.width),
    height: num(size.height),
    viewBox: viewBoxOf(bounds),
  });
  for (const zone of zones) {
    const r = layout.groups[zone.id];
    if (!r) continue;
    const shown = steps
      .filter((step) => !step.view.groups.find((g) => g.id === zone.id)?.dimmed)
      .map((step): Interval => [step.start, step.end]);
    inner.children.push(
      clock.showDuring(
        h('rect', {
          ...roundRect(r),
          rx: 16,
          fill: zoneColor(zone.color),
          'fill-opacity': 0.55,
        }),
        shown,
      ),
    );
  }
  const first = camera[0]?.[1];
  if (first) {
    const view = h('rect', { ...roundRect(first), class: 'dav-minimap-view' });
    for (const attr of ['x', 'y', 'width', 'height'] as const) {
      pushAll(
        view,
        clock.track(
          attr,
          camera.map(([t, r]) => [t, num(r[attr])]),
          { eased: true },
        ),
      );
    }
    inner.children.push(view);
  }
  return h(
    'g',
    {},
    h('rect', {
      x: num(at.x - 0.5),
      y: num(at.y - 0.5),
      width: num(size.width + 1),
      height: num(size.height + 1),
      rx: 3,
      fill: COLOR.panel,
      stroke: COLOR.border,
    }),
    inner,
  );
}

function roundRect(r: Rect): Record<'x' | 'y' | 'width' | 'height', string> {
  return { x: num(r.x), y: num(r.y), width: num(r.width), height: num(r.height) };
}

function intersect(a: readonly Interval[], b: readonly Interval[]): Interval[] {
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

/**
 * Keeps zone names inside the visible `viewBox` as the camera moves, matching `ZoneLabels.follow`
 * in the preview. Drawn in one layer above the step scenes so station nodes never cover a sliding
 * zone name.
 */
function zoneLabelLayer(
  doc: DavDocument,
  layout: Layout,
  steps: readonly StepSlot[],
  camera: ReadonlyArray<readonly [number, Rect]>,
  startWorld: Rect,
  clock: Clock,
  total: number,
): VElement | null {
  const indices = new Map<string, number>();
  const zones: Array<ZoneLabelEntry & { id: string; text: string }> = [];
  for (const g of doc.groups) {
    const rect = layout.groups[g.id];
    if (!rect) continue;
    const text = fitText(g.label, ZONE_LABEL.size, zoneLabelRoom(rect.width));
    indices.set(g.id, zones.length);
    zones.push({
      id: g.id,
      text,
      rect,
      width: estimateTextWidth(text, ZONE_LABEL.size),
      parentIndex: g.parentId === undefined ? -1 : (indices.get(g.parentId) ?? -1),
    });
  }
  if (zones.length === 0) return null;

  const samples = cameraSamples(camera, startWorld, total);
  const placements = samples.map(([, w]) => placeZoneLabels(zones, w));
  const out = h('g', { class: 'dav-layer-zone-labels' });

  zones.forEach((zone, i) => {
    const coords = samples.map((_, s) => {
      const p = placements[s]?.[i];
      return p && !p.hidden ? { x: p.x, y: p.y } : undefined;
    });

    const visible: Interval[] = [];
    for (let s = 0; s < samples.length - 1; s++) {
      if (!coords[s] || !coords[s + 1]) continue;
      const a = samples[s]?.[0] ?? 0;
      const b = samples[s + 1]?.[0] ?? total;
      if (b <= a) continue;
      const prev = visible[visible.length - 1];
      if (prev && prev[1] === a) visible[visible.length - 1] = [prev[0], b];
      else visible.push([a, b]);
    }
    if (visible.length === 0) return;

    const coordAt = (t: number): { x: number; y: number } => {
      for (let s = 0; s < samples.length - 1; s++) {
        const t0 = samples[s]?.[0] ?? 0;
        const t1 = samples[s + 1]?.[0] ?? total;
        const c0 = coords[s];
        const c1 = coords[s + 1];
        if (!c0 || !c1 || t < t0 || t > t1) continue;
        if (t <= t0) return c0;
        if (t >= t1) return c1;
        const u = (t - t0) / (t1 - t0);
        return { x: c0.x + (c1.x - c0.x) * u, y: c0.y + (c1.y - c0.y) * u };
      }
      return { x: zone.rect.x + ZONE_LABEL.inset, y: zone.rect.y + ZONE_LABEL.baseline };
    };

    const stepIntervals = (dimmed: boolean): Interval[] => {
      const spans: Interval[] = [];
      for (const step of steps) {
        if (Boolean(step.view.groups.find((g) => g.id === zone.id)?.dimmed) !== dimmed) continue;
        const prev = spans[spans.length - 1];
        if (prev && prev[1] === step.start) spans[spans.length - 1] = [prev[0], step.end];
        else spans.push([step.start, step.end]);
      }
      return spans;
    };

    for (const dimmed of [false, true]) {
      const intervals = intersect(visible, stepIntervals(dimmed));
      if (intervals.length === 0) continue;
      const points: Array<[number, { x: number; y: number }]> = [];
      for (const [a, b] of intervals) {
        points.push([a, coordAt(a)]);
        for (let s = 0; s < samples.length; s++) {
          const t = samples[s]?.[0] ?? 0;
          const c = coords[s];
          if (c && t > a && t < b) points.push([t, c]);
        }
        points.push([b, coordAt(b)]);
      }
      const start = points[0]?.[1];
      if (!start) continue;
      const textEl = pushAll(
        h(
          'text',
          {
            x: num(start.x),
            y: num(start.y),
            class: 'dav-group-label',
            'font-size': ZONE_LABEL.size,
            fill: COLOR.fg,
          },
          zone.text,
        ),
        clock.track(
          'x',
          points.map(([t, p]) => [t, num(p.x)]),
        ),
        clock.track(
          'y',
          points.map(([t, p]) => [t, num(p.y)]),
        ),
      );
      out.children.push(
        clock.showDuring(
          h(
            'g',
            { class: dimmed ? 'dav-group dav-dimmed' : 'dav-group', 'data-id': zone.id },
            textEl,
          ),
          intervals,
        ),
      );
    }
  });
  return out.children.length > 0 ? out : null;
}

/** Everything any step draws, including packet callouts that reach past the diagram's edge. */
function wholeAcrossSteps(doc: DavDocument, layout: Layout, steps: readonly StepSlot[]): Rect {
  const rects = (
    steps.length > 0 ? steps.map((s) => s.view) : [resolveView(doc, layout, null)]
  ).map((view) => wholeDiagramFrame(layout, view).rect);
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * A canvas as wide as the header, as tall as the diagram needs at the zoom it gets: no closer
 * than the preview's fit, and within limits for very flat or very tall diagrams.
 */
function wholeCanvas(rect: Rect): Size {
  const zoom = Math.min(MAX_FIT_ZOOM, WIDTH / rect.width);
  const height = Math.round(rect.height * zoom);
  return {
    width: WIDTH,
    height: Math.min(WHOLE_CANVAS_HEIGHT.max, Math.max(WHOLE_CANVAS_HEIGHT.min, height)),
  };
}

/** Centers the whole diagram on the canvas without clamping to the interactive minimum zoom. */
function wholePose(canvas: Size, rect: Rect): Pose {
  const zoom = Math.min(MAX_FIT_ZOOM, fitZoom(canvas, rect));
  return {
    zoom,
    panX: (canvas.width - rect.width * zoom) / 2 - rect.x * zoom,
    panY: (canvas.height - rect.height * zoom) / 2 - rect.y * zoom,
  };
}

const stepDescLine = (index: number, title: string | undefined): string =>
  title ? `${index + 1}. ${title}` : `${index + 1}`;

/**
 * Draws a step as the preview does with animation stopped: every flow of the step lit in its
 * color, with its rail labels emphasized and its numbered stops at rest.
 */
function stillHighlights(scene: VElement, view: ResolvedView): void {
  const colors = flowColors(view.phases.flat());
  const flows = layer(scene, 'dav-layer-flows');
  if (flows) {
    flows.children = flows.children.flatMap((flow) => {
      if (!isElement(flow)) return [];
      const color = colors.get(String(flow.attrs['data-edge']));
      return color === undefined ? [] : [withAttrs(flow, { stroke: paint(color) })];
    });
  }
  for (const label of layer(scene, 'dav-layer-labels')?.children ?? []) {
    const text = isElement(label) ? label.children[0] : undefined;
    if (!isElement(label) || !isElement(text)) continue;
    const color = colors.get(String(text.attrs['data-edge']));
    if (color === undefined) continue;
    label.children = [withAttrs(text, { fill: activeLabelFill(color), 'font-weight': 700 })];
  }
}

/** One step as a still picture of the whole diagram, under the step's number and text. */
function stepStillSvg(doc: DavDocument, layout: Layout, index: number, locale: ViewerLocale) {
  const view = resolveView(doc, layout, index);
  const { rect } = wholeDiagramFrame(layout, view);
  const canvas = wholeCanvas(rect);
  const slot: StepSlot = { index, view, start: 0, phasesEnd: 0, end: 1, phases: [] };
  // A clock whose one moment is the whole file: nothing in it changes, so nothing animates.
  const head = header([slot], doc.steps.length, locale, new Clock(1), null);
  const scene = buildScene(view, ICON_SHAPES);
  stillHighlights(scene, view);
  const world = h(
    'svg',
    {
      x: 0,
      y: head.height + 1,
      width: WIDTH,
      height: canvas.height,
      viewBox: viewBoxOf(visibleWorld(canvas, wholePose(canvas, rect))),
      preserveAspectRatio: 'xMidYMid meet',
    },
    buildDefs(),
    scene,
  );
  const height = head.height + 1 + canvas.height;
  return svgDocument(
    { width: WIDTH, height },
    `0 0 ${WIDTH} ${num(height)}`,
    doc.title || 'DynamicArchitectViewer',
    stepDescLine(index, doc.steps[index]?.title),
    [
      h('rect', { x: 0, y: 0, width: WIDTH, height, fill: COLOR.bg }),
      world,
      head.el,
      h('path', { d: `M 0 ${head.height + 0.5} H ${WIDTH}`, stroke: COLOR.border }),
    ],
  );
}

function animatedSvg(
  doc: DavDocument,
  layout: Layout,
  locale: ViewerLocale,
  cameraMode: 'follow' | 'whole',
  only?: number,
): string {
  const { steps, total } = schedule(doc, layout, only);
  const clock = new Clock(total);
  const wholeRect = wholeAcrossSteps(doc, layout, steps);
  const canvas: Size =
    cameraMode === 'whole' ? wholeCanvas(wholeRect) : { width: WIDTH, height: CANVAS_HEIGHT };

  const events: Array<[number, Pose]> =
    cameraMode === 'whole'
      ? [[0, wholePose(canvas, wholeRect)]]
      : planCamera(canvas, layout, steps);
  const camera = cameraKeys(events, total).map(([t, pose]): [number, Rect] => [
    t,
    visibleWorld(canvas, pose),
  ]);
  const whole = wholeRect;
  const start = events[0]?.[1];
  const startWorld = start ? visibleWorld(canvas, start) : whole;
  // The minimap only helps when the camera ever shows less than the whole diagram.
  const zoomedIn = camera.some(
    ([, r]) =>
      r.x > whole.x + 1 ||
      r.y > whole.y + 1 ||
      r.x + r.width < whole.x + whole.width - 1 ||
      r.y + r.height < whole.y + whole.height - 1,
  );
  const mapFrame = cameraMode === 'follow' && zoomedIn ? minimapFrame(doc, layout) : null;

  const head = header(steps, doc.steps.length, locale, clock, mapFrame?.size ?? null);
  const timelineTop = head.height;
  // One step has nothing to rule; a line separates the header from what follows.
  const zoneTop = timelineTop + (only === undefined ? TIMELINE_HEIGHT : 1);
  const strip = doc.groups.length > 0 ? zoneStrip(steps, zoneTop, locale, clock) : null;
  const canvasTop = zoneTop + (strip ? ZONE_STRIP_HEIGHT : 0);
  const canvasBottom = canvasTop + canvas.height;

  const world = h(
    'svg',
    {
      x: 0,
      y: canvasTop,
      width: WIDTH,
      height: canvas.height,
      viewBox: viewBoxOf(startWorld),
      preserveAspectRatio: 'xMidYMid meet',
    },
    buildDefs(),
  );
  pushAll(
    world,
    clock.track(
      'viewBox',
      camera.map(([t, r]) => [t, viewBoxOf(r)]),
      { eased: true },
    ),
  );
  for (const step of steps) {
    const scene = buildScene(step.view, ICON_SHAPES);
    const labels = layer(scene, 'dav-layer-labels');
    if (labels) {
      labels.children = labels.children.filter(
        (c) => !isElement(c) || !childWithClass(c, 'dav-group-label'),
      );
    }
    animateHighlights(scene, step, clock);
    world.children.push(clock.showDuring(h('g', {}, scene), [[step.start, step.end]]));
  }
  pushAll(world, zoneLabelLayer(doc, layout, steps, camera, startWorld, clock, total));
  const packets = h('g', { class: 'dav-layer-packets' });
  for (const step of steps) {
    for (const phase of step.phases) {
      packets.children.push(
        clock.showDuring(
          h('g', {}, ...phase.packets.map((packet) => animatedPacket(packet, phase, clock))),
          [[phase.start, phase.end]],
        ),
      );
    }
  }
  world.children.push(packets);

  const map =
    mapFrame &&
    minimap(
      mapFrame,
      layout,
      steps,
      {
        x: WIDTH - PAD_X - mapFrame.size.width,
        y: (head.height - mapFrame.size.height) / 2,
      },
      camera,
      clock,
    );

  const titleText = doc.title || 'DynamicArchitectViewer';
  const description = steps
    .map((step) => stepDescLine(step.index, doc.steps[step.index]?.title))
    .join('\n');
  return svgDocument(
    { width: WIDTH, height: canvasBottom },
    `0 0 ${WIDTH} ${num(canvasBottom)}`,
    titleText,
    description,
    [
      h('rect', { x: 0, y: 0, width: WIDTH, height: canvasBottom, fill: COLOR.bg }),
      world,
      head.el,
      only === undefined
        ? timeline(steps, timelineTop, clock, total)
        : h('path', { d: `M 0 ${timelineTop + 0.5} H ${WIDTH}`, stroke: COLOR.border }),
      strip,
      map,
    ].filter((c): c is VElement => c !== null),
  );
}

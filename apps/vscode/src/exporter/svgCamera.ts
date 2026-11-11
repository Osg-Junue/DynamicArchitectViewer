import type { Layout, Rect } from '../layout';
import type { DavDocument } from '../model/types';
import {
  boundsOf,
  calmFrame,
  framePose,
  MAX_FIT_ZOOM,
  type Pose,
  packetsOnScreen,
  resolveView,
  type Size,
  stepFrame,
  visibleWorld,
  wholeDiagramFrame,
} from '../scene';
import { clamp, SAMPLE_MS, type StepSlot } from './svgClock';

export const WIDTH = 960;
export const CANVAS_HEIGHT = 540;
/** A fixed camera's canvas follows the diagram's proportions, within these heights. */
const WHOLE_CANVAS_HEIGHT = { min: 240, max: 1200 } as const;
/** The preview's camera eases with a time constant of 160 ms; this is about when it settles. */
const CAMERA_EASE_MS = 800;

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
export function cameraKeys(events: Array<[number, Pose]>, total: number): Array<[number, Pose]> {
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
export function cameraSamples(
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

/** Everything any step draws, including packet callouts that reach past the diagram's edge. */
export function wholeAcrossSteps(
  doc: DavDocument,
  layout: Layout,
  steps: readonly StepSlot[],
): Rect {
  const views = steps.length > 0 ? steps.map((s) => s.view) : [resolveView(doc, layout, null)];
  return boundsOf(
    views.map((view) => wholeDiagramFrame(layout, view).rect),
    0,
    0,
  );
}

/**
 * A canvas as wide as the header, as tall as the diagram needs at the zoom it gets: no closer
 * than the preview's fit, and within limits for very flat or very tall diagrams.
 */
export function wholeCanvas(rect: Rect): Size {
  const zoom = Math.min(MAX_FIT_ZOOM, WIDTH / rect.width);
  const height = Math.round(rect.height * zoom);
  return {
    width: WIDTH,
    height: clamp(height, WHOLE_CANVAS_HEIGHT.min, WHOLE_CANVAS_HEIGHT.max),
  };
}

/** Centers the whole diagram on the canvas without clamping to the interactive minimum zoom. */
export function wholePose(canvas: Size, rect: Rect): Pose {
  return framePose(canvas, { rect, maxZoom: MAX_FIT_ZOOM }, { clamp: false });
}

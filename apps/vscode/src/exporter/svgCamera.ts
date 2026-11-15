import type { Layout, Rect } from '../layout';
import type { DavDocument } from '../model/types';
import {
  automaticPoses,
  boundsOf,
  clamp,
  framePose,
  MAX_FIT_ZOOM,
  type Pose,
  paceView,
  type ResolvedView,
  resolveView,
  type Size,
  stepFrame,
  wholeDiagramFrame,
} from '../scene';
import type { StepSlot } from './svgClock';

export const WIDTH = 960;
export const CANVAS_HEIGHT = 540;
/** The canvas of a camera that follows the packets. */
const FOLLOW_CANVAS: Size = { width: WIDTH, height: CANVAS_HEIGHT };
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
    const poses = automaticPoses(canvas, layout, step.view);
    events.push([step.start, poses[0] ?? framePose(canvas, stepFrame(canvas, layout, step.view))]);
    step.phases.forEach((phase, i) => {
      const pose = poses[i];
      if (i > 0 && pose && pose !== poses[i - 1]) events.push([phase.start, pose]);
    });
  }
  return events;
}

/**
 * Times every phase by how far its packets move on screen, as the preview does: the camera that
 * follows the flow sets the pace, and a fixed camera that shows the diagram closer slows the
 * packets so that they stay readable, but never speeds them up from further out.
 */
export function paceForCamera(
  doc: DavDocument,
  layout: Layout,
  mode: 'follow' | 'whole',
): (views: readonly ResolvedView[]) => void {
  return (views) => {
    let fixed = 0;
    if (mode === 'whole') {
      const rect = wholeOfViews(doc, layout, views);
      fixed = wholePose(wholeCanvas(rect), rect).zoom;
    }
    for (const view of views) {
      paceView(
        view,
        automaticPoses(FOLLOW_CANVAS, layout, view).map((pose) => Math.max(pose.zoom, fixed)),
      );
    }
  };
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

/** Everything any step draws, including packet callouts that reach past the diagram's edge. */
export function wholeAcrossSteps(
  doc: DavDocument,
  layout: Layout,
  steps: readonly StepSlot[],
): Rect {
  return wholeOfViews(
    doc,
    layout,
    steps.map((s) => s.view),
  );
}

function wholeOfViews(doc: DavDocument, layout: Layout, views: readonly ResolvedView[]): Rect {
  const shown = views.length > 0 ? views : [resolveView(doc, layout, null)];
  return boundsOf(
    shown.map((view) => wholeDiagramFrame(layout, view).rect),
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

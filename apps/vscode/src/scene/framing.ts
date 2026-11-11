import { type Layout, type Rect, rectContains } from '../layout';
import { boundsOf } from './bounds';
import { calloutRect, computePacketCalloutBox } from './callout';
import type { Bezier } from './geometry';
import type { Packet, ResolvedView } from './resolve';

/**
 * Where the camera looks, as pure functions of the canvas size: the preview's camera and the
 * animated SVG export frame the diagram the same way.
 */

export interface Size {
  width: number;
  height: number;
}

/** Diagram coordinates map to the canvas as `canvas = world * zoom + pan`. */
export interface Pose {
  zoom: number;
  panX: number;
  panY: number;
}

/** A rectangle to show, and how far the camera may zoom in on it. */
export interface Frame {
  rect: Rect;
  maxZoom: number;
}

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;
export const MAX_FIT_ZOOM = 1.4;
/** Room kept around what the camera shows while it follows packets from zone to zone. */
const CALM_FRAME_PAD = 120;
/** Below this zoom, text stops being comfortable to read. */
const MIN_ZONE_FRAME_ZOOM = 0.6;
const MAX_CALM_ZOOM = 1.25;
/** How close to the screen's edge a moving packet may get before the camera follows. */
const CALM_EDGE_MARGIN = 40;
/** Margin kept around packet callouts when checking visibility or framing. */
const CALLOUT_EDGE_MARGIN = 16;
const CALLOUT_FRAME_PAD = 24;
/** Room kept around what the camera shows while it follows every phase. */
const FOLLOW_PAD = 56;
const FOLLOW_MIN_SIZE = { width: 200, height: 160 };
const MAX_FOLLOW_ZOOM = 1.65;

export const clampZoom = (zoom: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** The zoom at which a rectangle exactly fits the canvas; unbounded while it has no size. */
export function fitZoom(canvas: Size, b: Rect): number {
  if (canvas.width === 0 || canvas.height === 0) return Number.POSITIVE_INFINITY;
  return Math.min(canvas.width / b.width, canvas.height / b.height);
}

/** The pose that centers a frame, zoomed in no further than its `maxZoom`. */
export function framePose(
  canvas: Size,
  { rect, maxZoom }: Frame,
  options: { clamp?: boolean } = {},
): Pose {
  const raw = Math.min(fitZoom(canvas, rect), maxZoom);
  const zoom = options.clamp === false ? raw : clampZoom(raw);
  return {
    zoom,
    panX: (canvas.width - rect.width * zoom) / 2 - rect.x * zoom,
    panY: (canvas.height - rect.height * zoom) / 2 - rect.y * zoom,
  };
}

/** The part of the diagram a pose shows, in diagram coordinates. */
export function visibleWorld(canvas: Size, pose: Pose): Rect {
  return {
    x: -pose.panX / pose.zoom,
    y: -pose.panY / pose.zoom,
    width: canvas.width / pose.zoom,
    height: canvas.height / pose.zoom,
  };
}

/** The box around a curve's control points. */
function controlBox({ p0, p1, p2, p3 }: Bezier): Rect {
  const xs = [p0.x, p1.x, p2.x, p3.x];
  const ys = [p0.y, p1.y, p2.y, p3.y];
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** The rectangles of the callouts attached to some packets. */
function calloutsOf(packets: readonly Packet[]): Rect[] {
  return packets.flatMap((packet) => computePacketCalloutBox(packet) ?? []).map(calloutRect);
}

/** Everything the diagram draws, including packet callouts that reach past its edge. */
export function wholeDiagramFrame(layout: Layout, view: ResolvedView): Frame {
  const base = boundsOf([...Object.values(layout.nodes), ...Object.values(layout.groups)]);
  const callouts = calloutsOf(view.phases.flat());
  if (callouts.length === 0) {
    return { rect: base, maxZoom: MAX_FIT_ZOOM };
  }
  const extra = boundsOf(callouts, CALLOUT_FRAME_PAD, 0);
  return {
    rect: boundsOf([base, extra], 0, 0),
    maxZoom: MAX_FIT_ZOOM,
  };
}

/** The rectangles of the nodes some packets move between. */
function spotsOf(layout: Layout, packets: readonly Packet[]): Rect[] {
  return packets
    .flatMap((p) => [layout.nodes[p.from], layout.nodes[p.to]])
    .filter((r) => r !== undefined);
}

/** Whether a part of the diagram already shows the nodes and callouts some packets move between. */
export function packetsOnScreen(layout: Layout, packets: readonly Packet[], world: Rect): boolean {
  const spots = spotsOf(layout, packets);
  if (spots.length === 0) return true;
  const callouts = calloutsOf(packets);
  const needed =
    callouts.length > 0
      ? boundsOf(
          [boundsOf(spots, CALM_EDGE_MARGIN, 0), boundsOf(callouts, CALLOUT_EDGE_MARGIN, 0)],
          0,
          0,
        )
      : boundsOf(spots, CALM_EDGE_MARGIN, 0);
  return rectContains(world, needed);
}

/**
 * Frames the whole zones some packets move between, so that the reader keeps their bearings;
 * just the nodes when those zones would be too small to read. `null` without packets.
 */
export function calmFrame(canvas: Size, layout: Layout, packets: readonly Packet[]): Frame | null {
  const spots = spotsOf(layout, packets);
  if (spots.length === 0) return null;
  const zoneRects = packets
    .flatMap((p) => [p.fromZone, p.toZone])
    .flatMap((id) => (id !== undefined && layout.groups[id] ? [layout.groups[id]] : []));
  const zones = boundsOf(zoneRects.length > 0 ? zoneRects : spots, CALM_FRAME_PAD, 0);
  const baseRect =
    fitZoom(canvas, zones) >= MIN_ZONE_FRAME_ZOOM ? zones : boundsOf(spots, CALM_FRAME_PAD, 0);
  const callouts = calloutsOf(packets);
  const rect =
    callouts.length > 0
      ? boundsOf([baseRect, boundsOf(callouts, CALLOUT_FRAME_PAD, 0)], 0, 0)
      : baseRect;
  return { rect, maxZoom: MAX_CALM_ZOOM };
}

/**
 * Frames what a step is about, so text stays legible on wide diagrams. Steps without a focus
 * (and the overview) show the whole diagram. A step too spread out to read at once is followed
 * zone by zone instead, from the `follow` packets, when there are some.
 */
export function stepFrame(
  canvas: Size,
  layout: Layout,
  view: ResolvedView,
  options: { fixed?: boolean; follow?: readonly Packet[] } = {},
): Frame {
  const rects = view.nodes.filter((n) => n.focused).map((n) => n.rect);
  if (rects.length === 0 || options.fixed) return wholeDiagramFrame(layout, view);
  for (const packet of view.phases.flat()) {
    const callout = computePacketCalloutBox(packet);
    if (callout) rects.push(calloutRect(callout));
  }
  const bounds = boundsOf(rects);
  if (options.follow && fitZoom(canvas, bounds) < MIN_ZONE_FRAME_ZOOM) {
    const calm = calmFrame(canvas, layout, options.follow);
    if (calm) return calm;
  }
  return { rect: bounds, maxZoom: MAX_FIT_ZOOM };
}

/** Frames the packets of one phase closely, with their callouts and rails. */
export function followFrame(layout: Layout, packets: readonly Packet[]): Frame {
  const { nodes, groups } = layout;
  if (packets.length === 0) {
    return {
      rect: boundsOf([...Object.values(nodes), ...Object.values(groups)]),
      maxZoom: MAX_CALM_ZOOM,
    };
  }
  const rects = packets.flatMap((packet) => [
    ...[nodes[packet.from], nodes[packet.to]].filter((r) => r !== undefined),
    ...[computePacketCalloutBox(packet)].flatMap((box) => (box ? [calloutRect(box)] : [])),
    controlBox(packet.path),
  ]);
  const b = boundsOf(rects, FOLLOW_PAD, 0);
  return {
    rect: {
      ...b,
      width: Math.max(FOLLOW_MIN_SIZE.width, b.width),
      height: Math.max(FOLLOW_MIN_SIZE.height, b.height),
    },
    maxZoom: MAX_FOLLOW_ZOOM,
  };
}

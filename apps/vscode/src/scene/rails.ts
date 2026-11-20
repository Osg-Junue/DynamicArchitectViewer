import { type Layout, type Rect, rectOverlaps, stationRect } from '../layout';
import { selfLoopNodeIds, synthesizedConnections, unorderedPairKey } from '../model/connections';
import { EDGE_LABEL_FONT_SIZE, EDGE_LABEL_MAX_WIDTH } from '../model/text';
import type { DavDocument, IconName } from '../model/types';
import { ancestorIds, parentMap } from '../model/zones';
import {
  expandRect,
  type Point,
  pointAt,
  type Rail,
  type Route,
  railEnds,
  railLength,
  reverse,
  segmentIntersectsRect,
  selfLoop,
} from './geometry';
import type { ResolvedEdge, ResolvedNode } from './resolve';
import { type RoutedRail, type RouteEdge, routeEdges } from './route';
import {
  BADGE_MAX_WIDTH,
  BADGE_SIZE,
  fitText,
  NODE_LABEL_SIZE,
  NODE_SUB_SIZE,
  textWidth,
  wrapText,
} from './text';
import { ZONE_LABEL, zoneLabelRoom } from './zones';

/** How far above the middle of its curve a loop's label is written, clear of a numbered stop. */
const LOOP_LABEL_LIFT = 20;

const STATION_CLEARANCE = 12;
const LABEL_AREA_WIDTH = 96;

/** The part of a node a rail must not cross: its station and the labels below it. */
export function stationArea(node: ResolvedNode): Rect {
  const station = stationRect(node.rect, node.icon);
  const width = Math.max(station.width + STATION_CLEARANCE * 2, LABEL_AREA_WIDTH);
  const top = station.y - STATION_CLEARANCE;
  return {
    x: station.x + station.width / 2 - width / 2,
    y: top,
    width,
    height: node.rect.y + node.rect.height - top,
  };
}

/** Where an edge's label is written: the start, middle or end of its text, on its baseline. */
export interface EdgeLabelSpot {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
}

/** A loop's label is written above the middle of its curve. */
function loopLabelSpot(station: Rect): EdgeLabelSpot {
  const middle = pointAt(selfLoop(station, 0), 0.5);
  return { x: middle.x, y: middle.y - LOOP_LABEL_LIFT, anchor: 'middle' };
}

/**
 * Room kept round the curve of a loop, which no other rail is drawn through or along: wide
 * enough that rails running side by side past it stay clear of it too.
 */
const LOOP_CLEARANCE = 10;

/**
 * The room each loop's curve takes up beside its station. It leaves the station a little right
 * of the middle of its top and comes back a little above the middle of its right side, so the
 * lines through the middle of the station stay open to the rails that meet it there.
 */
function loopAreas(
  loopNodes: ReadonlySet<string>,
  nodes: readonly ResolvedNode[],
  nodeIndex: ReadonlyMap<string, number>,
): Rect[] {
  const areas: Rect[] = [];
  for (const id of loopNodes) {
    const node = nodes[nodeIndex.get(id) ?? -1];
    if (!node) continue;
    const station = stationRect(node.rect, node.icon);
    const curve = selfLoop(station, 0);
    const points = Array.from({ length: 25 }, (_, i) => pointAt(curve, i / 24));
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    // Never over the lines through the middle of the station, which its own rails arrive on.
    const x = Math.max(Math.min(...xs) - LOOP_CLEARANCE, station.x + station.width / 2 + 1);
    const y = Math.min(...ys) - LOOP_CLEARANCE;
    const bottom = Math.min(Math.max(...ys) + LOOP_CLEARANCE, station.y + station.height / 2 - 1);
    areas.push({ x, y, width: Math.max(...xs) + LOOP_CLEARANCE - x, height: bottom - y });
  }
  return areas;
}

interface StoredRail {
  canonFrom: string;
  canonTo: string;
  route: Route;
  shared: readonly boolean[];
}

/** The routed rails of one arrangement of a diagram, keyed by `unorderedPairKey`. */
interface Routed {
  rails: Map<string, StoredRail>;
  solidWalls: Rect[];
  groupBorders: Array<{ a: Point; b: Point }>;
  loopNodes: Set<string>;
}

/**
 * The rectangle occupied by a node's label and sub-label below its station.
 */
function nodeLabelRect(node: ResolvedNode, area = stationArea(node)): Rect {
  const station = stationRect(node.rect, node.icon);
  const bottom = station.y + station.height;
  // A long name wraps up to 2 lines; measure the widest wrapped line rather than unwrapped length.
  const labelLines = wrapText(node.label, NODE_LABEL_SIZE, node.rect.width, 2, 'bold');
  const labelW = Math.max(0, ...labelLines.map((line) => textWidth(line, NODE_LABEL_SIZE, 'bold')));
  const text = Math.min(
    node.rect.width,
    Math.max(area.width, labelW + 8, node.sub ? textWidth(node.sub, NODE_SUB_SIZE) + 8 : 0),
  );
  return {
    x: station.x + station.width / 2 - text / 2,
    y: bottom,
    width: text,
    height: area.y + area.height - bottom,
  };
}

/**
 * The rectangle occupied by a node's drawn label and sub-label text below its station.
 * Uses measured text width and actual text top (unlike `nodeLabelRect`, which keeps
 * `stationArea`'s minimum width for rail routing clearance).
 */
function nodeTextArea(node: ResolvedNode): Rect {
  const station = stationRect(node.rect, node.icon);
  const labelLines = wrapText(node.label, NODE_LABEL_SIZE, node.rect.width, 2, 'bold');
  const labelW = Math.max(0, ...labelLines.map((line) => textWidth(line, NODE_LABEL_SIZE, 'bold')));
  const subW = node.sub ? textWidth(node.sub, NODE_SUB_SIZE) : 0;
  const width = Math.min(node.rect.width, Math.max(station.width, labelW + 8, subW + 8));
  const wrapped = labelLines.length > 1;
  // Single-line labels render at baseline `rect.y + 94` (top ~`rect.y + 80`); wrapped labels
  // render at `rect.y + 86` (top ~`rect.y + 72`, flush with the station bottom).
  const top = wrapped
    ? station.y + station.height
    : Math.max(station.y + station.height, node.rect.y + 78);
  return {
    x: station.x + station.width / 2 - width / 2,
    y: top,
    width,
    height: Math.max(0, node.rect.y + node.rect.height - top),
  };
}

/**
 * What is drawn of a node: its station, and the block of labels below it. An edge label keeps
 * clear of these; the room `stationArea` adds around a station is free for it.
 */
export function nodeBody(node: ResolvedNode): Rect[] {
  const station = stationRect(node.rect, node.icon);
  return [
    { x: station.x - 4, y: station.y - 4, width: station.width + 8, height: station.height + 8 },
    nodeTextArea(node),
  ];
}

export interface RailEndpoint {
  id: string;
  rect: Rect;
  icon?: IconName;
}

/** Straight from one station or group outline to the other's, for the rare rail no route is found for. */
function direct(from: RailEndpoint, to: RailEndpoint): Route {
  const a = from.icon ? stationRect(from.rect, from.icon) : from.rect;
  const b = to.icon ? stationRect(to.rect, to.icon) : to.rect;
  const start = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  const end = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const clipDist = (box: Rect, isGroup: boolean): number => {
    if (!isGroup) return box.width / 2 + 2;
    const tx =
      Math.abs(dx) > 1e-6 ? box.width / 2 / Math.abs(dx / length) : Number.POSITIVE_INFINITY;
    const ty =
      Math.abs(dy) > 1e-6 ? box.height / 2 / Math.abs(dy / length) : Number.POSITIVE_INFINITY;
    return Math.min(tx, ty) + 2;
  };
  const along = (p: Point, by: number): Point => ({
    x: p.x + (dx / length) * by,
    y: p.y + (dy / length) * by,
  });
  return {
    points: [along(start, clipDist(a, !from.icon)), along(end, -clipDist(b, !to.icon))],
  };
}

/** The room a zone's name takes up, which no rail, label or callout is drawn over. */
export function zoneNameArea(label: string, zone: Rect): Rect {
  const room = zoneLabelRoom(zone.width);
  const lines = wrapText(label, ZONE_LABEL.size, room, 2);
  const lineCount = Math.max(1, lines.length);
  const maxLineW =
    lines.length > 0
      ? Math.max(...lines.map((line) => textWidth(line, ZONE_LABEL.size)))
      : Math.min(textWidth(label, ZONE_LABEL.size), room);
  const width = Math.min(maxLineW, room);
  return {
    x: zone.x + ZONE_LABEL.inset - 4,
    y: zone.y + ZONE_LABEL.baseline - ZONE_LABEL.size - 2,
    width: width + 8,
    height: ZONE_LABEL.size + 10 + (lineCount - 1) * ZONE_LABEL.lineHeight,
  };
}

function zoneNameAreas(doc: DavDocument, layout: Layout): Rect[] {
  return doc.groups.flatMap((g) => {
    const rect = layout.groups[g.id];
    return rect ? [zoneNameArea(g.label, rect)] : [];
  });
}

/** How far above its station a node's badge starts, and how tall it is. */
const BADGE_RISE = 25;
const BADGE_HEIGHT = 20;
/** Kept between a badge and a rail that runs level above it. */
const BADGE_CLEARANCE = 8;

/** The room the badge above a node's station takes up; none without a badge. */
export function badgeArea(node: ResolvedNode): Rect[] {
  if (!node.badge) return [];
  const station = stationRect(node.rect, node.icon);
  const width =
    textWidth(fitText(node.badge, BADGE_SIZE, BADGE_MAX_WIDTH, 'bold'), BADGE_SIZE, 'bold') + 16;
  return [
    {
      x: station.x + station.width / 2 - width / 2,
      y: station.y - BADGE_RISE,
      width,
      height: BADGE_HEIGHT,
    },
  ];
}

/**
 * The room above a node's station that a badge is written in, as wide as the node's area. A step
 * may give any node a badge, and a rail keeps its course from step to step.
 */
function badgeRoom(node: ResolvedNode, area: Rect): Rect {
  const station = stationRect(node.rect, node.icon);
  return {
    x: area.x,
    y: station.y - BADGE_RISE - BADGE_CLEARANCE,
    width: area.width,
    height: BADGE_HEIGHT + BADGE_CLEARANCE,
  };
}

/** The room an edge's label takes up where it is written. */
export function edgeLabelArea(label: string, spot: EdgeLabelSpot): Rect {
  const width = textWidth(
    fitText(label, EDGE_LABEL_FONT_SIZE, EDGE_LABEL_MAX_WIDTH),
    EDGE_LABEL_FONT_SIZE,
  );
  const left =
    spot.anchor === 'middle'
      ? spot.x - width / 2
      : spot.anchor === 'start'
        ? spot.x
        : spot.x - width;
  return {
    x: left - 2,
    y: spot.y - EDGE_LABEL_FONT_SIZE,
    width: width + 4,
    height: EDGE_LABEL_FONT_SIZE * 1.3,
  };
}

/** Gap between a label and the stretch of rail it is written beside. */
const LABEL_GAP = 7;
/**
 * A step numbers its packets at the middle of their rails. A label is not written there; on a
 * rail too short to avoid it, the label goes further above or below, clear of the number.
 */
const STOP_ROOM = 15;
const LABEL_ABOVE_STOP = 20;
const LABEL_BELOW_STOP = 28;
/** Wider than a stop's diameter, because a chord across a tight loop is shorter than its arc. */
const STOP_SPACING = 32;
/** Stops whose rails pass this close at their middles would overlap; they are set out in a row. */
const STOP_REACH = 24;
/** Extra half-stroke clearance around a label box when checking intersections with foreign rails. */
const FOREIGN_RAIL_CLEARANCE = 2;
/** Clearance from a crossing rail or span end when sliding a label beside it. */
const CROSSING_SLIDE_GAP = 6;
/** Penalty when a foreign parallel rail runs between this rail and the label (misattribution). */
const INTERVENING_RAIL_PENALTY = 220;
/** Penalty when a foreign parallel rail on the far side is closer to the label than this rail. */
const CLOSER_FOREIGN_RAIL_PENALTY = 160;
/** Penalty when a foreign parallel rail on the far side is nearly as close as this rail. */
const AMBIGUOUS_FOREIGN_RAIL_PENALTY = 60;
const AMBIGUOUS_RAIL_MARGIN = 4;
/** Shares of a stretch at which its label is tried, the middle first. */
const LABEL_SHARES = [0.5, 0.35, 0.65, 0.2, 0.8, 0.27, 0.73, 0.12, 0.88, 0.42, 0.58];

/** Evenly spaced shares of a rail's length, around its middle. */
function stopShares(path: Rail, count: number): number[] {
  const step = count > 1 ? Math.min(STOP_SPACING / railLength(path), 0.8 / (count - 1)) : 0;
  return Array.from({ length: count }, (_, i) => 0.5 + (i - (count - 1) / 2) * step);
}

/**
 * Computes the rendered centers of numbered phase stops for a multi-phase step.
 * Shared by scene rendering (`build.ts`) and edge-label placement (`resolve.ts`).
 */
export function stopPlacements<T extends { path: Rail }>(
  phases: ReadonlyArray<readonly T[]>,
): Array<{ packet: T; phase: number; at: Point }> {
  if (phases.length < 2) return [];
  // Phases that share a rail, or ride rails that run side by side, would stack their numbers
  // at the middle, in either direction.
  const places: Array<{ at: Point; stops: Array<{ packet: T; phase: number }> }> = [];
  phases.forEach((packets, phase) => {
    for (const packet of packets) {
      const mid = pointAt(packet.path, 0.5);
      let place = places.find((p) => Math.hypot(p.at.x - mid.x, p.at.y - mid.y) < STOP_REACH);
      if (!place) {
        place = { at: mid, stops: [] };
        places.push(place);
      }
      place.stops.push({ packet, phase });
    }
  });
  return places.flatMap(({ stops }) => {
    const [first] = stops;
    if (!first) return [];
    const lead = railEnds(first.packet.path).start;
    const shares = stopShares(first.packet.path, stops.length);
    return stops.flatMap(({ packet, phase }, i) => {
      const share = shares[i];
      if (share === undefined) return [];
      // Each number on its own rail, counted from the end where the first rail starts.
      const { start, end } = railEnds(packet.path);
      const sameWay =
        Math.hypot(start.x - lead.x, start.y - lead.y) <=
        Math.hypot(end.x - lead.x, end.y - lead.y);
      return [{ packet, phase, at: pointAt(packet.path, sameWay ? share : 1 - share) }];
    });
  });
}

/**
 * Finds each label a place beside its own rail: on the longest stretch that no other rail runs
 * beside and that is long enough for it, clear of every node, zone name, other label and rail.
 * Most-constrained (shortest) rails are placed first. A label with no free place takes the one
 * that covers the least.
 */
function placeLabels(
  edges: ReadonlyArray<{ label: string; rail: Route; shared: readonly boolean[] } | undefined>,
  solid: readonly Rect[],
  rails: readonly Route[],
  groupBorders: ReadonlyArray<{ a: Point; b: Point }> = [],
  stopPoints: readonly Point[] = [],
): Array<EdgeLabelSpot | undefined> {
  const strokes = rails.flatMap((rail) =>
    rail.points.slice(0, -1).flatMap((a, i): Array<{ rail: Route; a: Point; b: Point }> => {
      const b = rail.points[i + 1];
      return b ? [{ rail, a, b }] : [];
    }),
  );
  const stopRects: Rect[] = stopPoints.map((p) => ({
    x: p.x - STOP_ROOM,
    y: p.y - STOP_ROOM,
    width: STOP_ROOM * 2,
    height: STOP_ROOM * 2,
  }));
  const totalLen = (rail: Route): number => {
    let len = 0;
    for (let i = 0; i + 1 < rail.points.length; i++) {
      const p = rail.points[i] as Point;
      const q = rail.points[i + 1] as Point;
      len += Math.hypot(q.x - p.x, q.y - p.y);
    }
    return len;
  };
  const order = edges
    .flatMap((edge, i) => (edge ? [{ i, len: totalLen(edge.rail) }] : []))
    .sort((a, b) => a.len - b.len || a.i - b.i)
    .map((entry) => entry.i);

  const taken: Rect[] = [];
  const height = EDGE_LABEL_FONT_SIZE * 1.2;
  const result: Array<EdgeLabelSpot | undefined> = Array(edges.length).fill(undefined);

  for (const edgeIdx of order) {
    const edge = edges[edgeIdx];
    if (!edge) continue;
    const text = fitText(edge.label, EDGE_LABEL_FONT_SIZE, EDGE_LABEL_MAX_WIDTH);
    const width = textWidth(text, EDGE_LABEL_FONT_SIZE);
    const spans = edge.rail.points
      .slice(0, -1)
      .flatMap((p, i) => {
        const q = edge.rail.points[i + 1];
        if (!q) return [];
        const length = Math.hypot(q.x - p.x, q.y - p.y);
        const longEnough = length >= width + 16;
        const isShared = Boolean(edge.shared[i]);
        const fitsUnshared = !isShared && longEnough;
        const fitsShared = isShared && longEnough;
        const fitCost = fitsUnshared ? 0 : fitsShared ? 2 : 4;
        return [{ p, q, length, fitsUnshared, fitsShared, fitCost }];
      })
      .sort(
        (s, t) =>
          Number(t.fitsUnshared) - Number(s.fitsUnshared) ||
          Number(t.fitsShared) - Number(s.fitsShared) ||
          t.length - s.length,
      );

    let best: { spot: EdgeLabelSpot; box: Rect; cost: number } | undefined;
    const consider = (
      spot: EdgeLabelSpot,
      left: number,
      fitCost: number,
      span: { p: Point; q: Point },
      isHorizontal: boolean,
      isVertical: boolean,
    ) => {
      const box = {
        x: left - 2,
        y: spot.y - EDGE_LABEL_FONT_SIZE,
        width: width + 4,
        height: EDGE_LABEL_FONT_SIZE * 1.3,
      };
      const foreignBox = expandRect(box, FOREIGN_RAIL_CLEARANCE);
      const boxRight = box.x + box.width;
      const boxBottom = box.y + box.height;
      const boxMidX = box.x + box.width / 2;
      const boxMidY = box.y + box.height / 2;
      const spanX = span.p.x;
      const spanY = span.p.y;
      const above = boxMidY < spanY;
      const leftSide = boxMidX < spanX;
      const ownGap = isHorizontal
        ? above
          ? Math.max(0, spanY - boxBottom)
          : Math.max(0, box.y - spanY)
        : leftSide
          ? Math.max(0, spanX - boxRight)
          : Math.max(0, box.x - spanX);
      const yLo = Math.min(spanY, boxMidY);
      const yHi = Math.max(spanY, boxMidY);
      const xLo = Math.min(spanX, boxMidX);
      const xHi = Math.max(spanX, boxMidX);

      let cost = fitCost;
      for (const o of solid) if (rectOverlaps(box, o)) cost += 300;
      for (const o of taken) if (rectOverlaps(box, o)) cost += 200;
      for (const st of stopRects) if (rectOverlaps(box, st)) cost += 60;
      for (const s of strokes) {
        const own = s.rail === edge.rail;
        if (segmentIntersectsRect(s.a, s.b, own ? box : foreignBox)) {
          cost += own ? 15 : 120;
        }
        if (own) continue;
        // Prevent a label from jumping over a parallel foreign rail or sitting nearer to one
        // than to its own rail, which causes visual misattribution in parallel corridors.
        if (
          isHorizontal &&
          Math.abs(s.a.y - s.b.y) < 0.5 &&
          Math.max(s.a.x, s.b.x) > box.x &&
          Math.min(s.a.x, s.b.x) < boxRight
        ) {
          const sy = s.a.y;
          if (sy > yLo + 0.5 && sy < yHi - 0.5) {
            cost += INTERVENING_RAIL_PENALTY;
          } else if (above ? sy <= box.y : sy >= boxBottom) {
            const otherGap = above ? box.y - sy : sy - boxBottom;
            if (otherGap < ownGap) cost += CLOSER_FOREIGN_RAIL_PENALTY;
            else if (otherGap <= ownGap + AMBIGUOUS_RAIL_MARGIN) {
              cost += AMBIGUOUS_FOREIGN_RAIL_PENALTY;
            }
          }
        } else if (
          isVertical &&
          Math.abs(s.a.x - s.b.x) < 0.5 &&
          Math.max(s.a.y, s.b.y) > box.y &&
          Math.min(s.a.y, s.b.y) < boxBottom
        ) {
          const sx = s.a.x;
          if (sx > xLo + 0.5 && sx < xHi - 0.5) {
            cost += INTERVENING_RAIL_PENALTY;
          } else if (leftSide ? sx <= box.x : sx >= boxRight) {
            const otherGap = leftSide ? box.x - sx : sx - boxRight;
            if (otherGap < ownGap) cost += CLOSER_FOREIGN_RAIL_PENALTY;
            else if (otherGap <= ownGap + AMBIGUOUS_RAIL_MARGIN) {
              cost += AMBIGUOUS_FOREIGN_RAIL_PENALTY;
            }
          }
        }
      }
      for (const b of groupBorders) {
        if (segmentIntersectsRect(b.a, b.b, box)) cost += 40;
      }
      if (!best || cost < best.cost) best = { spot, box, cost };
    };
    for (const span of spans) {
      const level = span.p.y === span.q.y;
      const isHorizontal = Math.abs(span.p.y - span.q.y) < 0.5;
      const isVertical = !isHorizontal && Math.abs(span.p.x - span.q.x) < 0.5;
      const candidates: Array<{ x: number; y: number; extraCost: number; isMid: boolean }> =
        LABEL_SHARES.map((share) => ({
          x: span.p.x + (span.q.x - span.p.x) * share,
          y: span.p.y + (span.q.y - span.p.y) * share,
          extraCost: 0,
          isMid: share === 0.5,
        }));
      // Add slide candidates right beside crossing foreign rails and span ends so labels on tight
      // spans can clear orthogonal crossings without falling off the span.
      if (isHorizontal) {
        const spanY = span.p.y;
        const xMin = Math.min(span.p.x, span.q.x);
        const xMax = Math.max(span.p.x, span.q.x);
        const halfW = width / 2;
        const seen = new Set<number>();
        const addX = (cx: number) => {
          if (cx < xMin + 4 || cx > xMax - 4) return;
          const key = Math.round(cx * 2);
          if (seen.has(key)) return;
          seen.add(key);
          candidates.push({ x: cx, y: spanY, extraCost: 0.5, isMid: false });
        };
        for (const s of strokes) {
          if (s.rail === edge.rail || Math.abs(s.a.x - s.b.x) >= 0.5) continue;
          const sx = s.a.x;
          if (sx <= xMin || sx >= xMax) continue;
          if (Math.max(s.a.y, s.b.y) < spanY - 36 || Math.min(s.a.y, s.b.y) > spanY + 36) continue;
          addX(sx - CROSSING_SLIDE_GAP - halfW);
          addX(sx + CROSSING_SLIDE_GAP + halfW);
        }
        addX(xMin + halfW + CROSSING_SLIDE_GAP);
        addX(xMax - halfW - CROSSING_SLIDE_GAP);
      } else if (isVertical) {
        const spanX = span.p.x;
        const yMin = Math.min(span.p.y, span.q.y);
        const yMax = Math.max(span.p.y, span.q.y);
        const halfH = height / 2;
        const seen = new Set<number>();
        const addY = (cy: number) => {
          if (cy < yMin + 4 || cy > yMax - 4) return;
          const key = Math.round(cy * 2);
          if (seen.has(key)) return;
          seen.add(key);
          candidates.push({ x: spanX, y: cy, extraCost: 0.5, isMid: false });
        };
        for (const s of strokes) {
          if (s.rail === edge.rail || Math.abs(s.a.y - s.b.y) >= 0.5) continue;
          const sy = s.a.y;
          if (sy <= yMin || sy >= yMax) continue;
          if (
            Math.max(s.a.x, s.b.x) < spanX - width - 24 ||
            Math.min(s.a.x, s.b.x) > spanX + width + 24
          ) {
            continue;
          }
          addY(sy - CROSSING_SLIDE_GAP - halfH);
          addY(sy + CROSSING_SLIDE_GAP + halfH);
        }
        addY(yMin + halfH + CROSSING_SLIDE_GAP);
        addY(yMax - halfH - CROSSING_SLIDE_GAP);
      }

      for (const { x, y, extraCost, isMid } of candidates) {
        for (const gap of [LABEL_GAP, LABEL_GAP + 6, LABEL_GAP + 12]) {
          const fitCost =
            span.fitCost + extraCost + (gap === LABEL_GAP ? 0 : gap === LABEL_GAP + 6 ? 1 : 2);
          if (level) {
            consider(
              { x, y: y - gap, anchor: 'middle' },
              x - width / 2,
              fitCost,
              span,
              isHorizontal,
              isVertical,
            );
            consider(
              { x, y: y + gap + height * 0.8, anchor: 'middle' },
              x - width / 2,
              fitCost,
              span,
              isHorizontal,
              isVertical,
            );
          } else {
            const base = y + height * 0.3;
            consider(
              { x: x + gap, y: base, anchor: 'start' },
              x + gap,
              fitCost,
              span,
              isHorizontal,
              isVertical,
            );
            consider(
              { x: x - gap, y: base, anchor: 'end' },
              x - gap - width,
              fitCost,
              span,
              isHorizontal,
              isVertical,
            );
          }
        }
        if (level && isMid && stopRects.length > 0) {
          const stopCost = Math.max(span.fitCost, 2);
          consider(
            { x, y: y - LABEL_ABOVE_STOP, anchor: 'middle' },
            x - width / 2,
            stopCost,
            span,
            isHorizontal,
            isVertical,
          );
          consider(
            { x, y: y + LABEL_BELOW_STOP, anchor: 'middle' },
            x - width / 2,
            stopCost,
            span,
            isHorizontal,
            isVertical,
          );
        }
        if (best?.cost === 0) break;
      }
      if (best?.cost === 0) break;
    }
    if (!best) continue;
    taken.push(best.box);
    result[edgeIdx] = best.spot;
  }
  return result;
}

/**
 * Routing takes a while on a large diagram, and a diagram is laid out afresh after every edit.
 * The last result is kept for as long as nothing a route depends on has changed.
 */
let lastFound: { key: string; found: Map<string, RoutedRail> } | undefined;

function routesFor(...args: Parameters<typeof routeEdges>): Map<string, RoutedRail> {
  const [nodes, groups, walls, edges] = args;
  const key = JSON.stringify([nodes, groups, walls, edges.map((e) => [e, [...e.home]])]);
  if (lastFound?.key !== key) lastFound = { key, found: routeEdges(...args) };
  return lastFound.found;
}

function routeDiagram(doc: DavDocument, layout: Layout, nodes: readonly ResolvedNode[]): Routed {
  const endpointIndex = new Map(nodes.map((n, i) => [n.id, i]));
  const groups = doc.groups.flatMap((g) => {
    const rect = layout.groups[g.id];
    return rect ? [{ id: g.id, rect }] : [];
  });
  const groupIndex = new Map(groups.map((g, i) => [g.id, i]));
  const groupRectById = new Map(groups.map((g) => [g.id, g.rect]));
  const groupParent = parentMap(doc.groups);
  const nodeParent = parentMap(doc.nodes);
  const connections = synthesizedConnections(doc);

  // Append synthetic border-endpoint RouteNodes for any groups referenced as `static` endpoints.
  const endpointGroups: Array<{ id: string; rect: Rect }> = [];
  for (const conn of connections) {
    for (const id of [conn.from, conn.to]) {
      if (endpointIndex.has(id)) continue;
      const gr = groupRectById.get(id);
      if (!gr) continue;
      endpointIndex.set(id, nodes.length + endpointGroups.length);
      endpointGroups.push({ id, rect: gr });
    }
  }

  const zonesAround = (id: string): number[] => {
    if (groupRectById.has(id)) {
      // A group endpoint stays outside its own interior, inheriting only strict ancestors.
      return ancestorIds(groupParent, groupParent.get(id)).flatMap((g) => groupIndex.get(g) ?? []);
    }
    return ancestorIds(groupParent, nodeParent.get(id)).flatMap((g) => groupIndex.get(g) ?? []);
  };

  const wanted: RouteEdge[] = [];
  const entries = new Map<string, { conn: (typeof connections)[number]; id: string }>();
  connections.forEach((conn, i) => {
    if (conn.from === conn.to) return;
    const a = endpointIndex.get(conn.from);
    const b = endpointIndex.get(conn.to);
    if (a === undefined || b === undefined) return;
    const id = `c${i}`;
    const fromZones = zonesAround(conn.from);
    const toZones = zonesAround(conn.to);
    const toZoneSet = new Set(toZones);
    const lca = fromZones.find((z) => toZoneSet.has(z));
    // When both endpoints lie inside a shared enclosing zone (their LCA), restrict `home` to
    // zones within that LCA so intra-group routes stay inside their shared container instead of
    // detouring out into an outer ancestor or open canvas.
    const home =
      lca === undefined
        ? new Set([...fromZones, ...toZones])
        : new Set([
            ...fromZones.slice(0, fromZones.indexOf(lca) + 1),
            ...toZones.slice(0, toZones.indexOf(lca) + 1),
          ]);
    wanted.push({
      id,
      from: a,
      to: b,
      home,
      contained: lca !== undefined,
      bothWays: conn.direction === 'bidirectional',
    });
    entries.set(unorderedPairKey(conn.from, conn.to), { conn, id });
  });

  const names = zoneNameAreas(doc, layout);
  const areas = nodes.map(stationArea);
  const loopNodes = selfLoopNodeIds(doc);
  const loopRoom = loopAreas(loopNodes, nodes, endpointIndex);
  // Reserve space above self-loops when any step attaches a static label to that loop.
  const loopLabels: Rect[] = [];
  for (const id of loopNodes) {
    const node = nodes[endpointIndex.get(id) ?? -1];
    if (!node) continue;
    let longest: string | undefined;
    for (const step of doc.steps) {
      for (const s of step.statics) {
        if (s.from === id && s.to === id && s.label) {
          if (!longest || s.label.length > longest.length) longest = s.label;
        }
      }
    }
    if (longest) {
      loopLabels.push(edgeLabelArea(longest, loopLabelSpot(stationRect(node.rect, node.icon))));
    }
  }

  const routeNodes = [
    ...nodes.map((n, i) => {
      const area = areas[i] as Rect;
      return {
        station: stationRect(n.rect, n.icon),
        area,
        labelArea: nodeLabelRect(n, area),
        hasLoop: loopNodes.has(n.id),
        badge: badgeRoom(n, area),
      };
    }),
    ...endpointGroups.map((g) => ({
      station: g.rect,
      area: g.rect,
      badge: g.rect,
      groupBorder: g.rect,
    })),
  ];

  const found = routesFor(
    routeNodes,
    groups.map((g) => ({
      rect: g.rect,
      depth: ancestorIds(groupParent, groupParent.get(g.id)).length,
    })),
    // Other rails go round a loop as round a zone's name, instead of through it.
    [...names, ...loopRoom, ...loopLabels],
    wanted,
  );

  const endpointById = new Map<string, RailEndpoint>([
    ...nodes.map((n): [string, RailEndpoint] => [n.id, n]),
    ...endpointGroups.map((g): [string, RailEndpoint] => [g.id, { id: g.id, rect: g.rect }]),
  ]);

  const rails = new Map<string, StoredRail>();
  for (const [key, { conn, id }] of entries) {
    const routed = found.get(id);
    if (routed) {
      rails.set(key, {
        canonFrom: conn.from,
        canonTo: conn.to,
        route: { points: routed.points },
        shared: routed.shared,
      });
    } else {
      const a = endpointById.get(conn.from);
      const b = endpointById.get(conn.to);
      if (a && b) {
        rails.set(key, {
          canonFrom: conn.from,
          canonTo: conn.to,
          route: direct(a, b),
          shared: [],
        });
      }
    }
  }
  const groupBorders = groups.flatMap(({ rect: r }) => {
    const tl = { x: r.x, y: r.y };
    const tr = { x: r.x + r.width, y: r.y };
    const br = { x: r.x + r.width, y: r.y + r.height };
    const bl = { x: r.x, y: r.y + r.height };
    return [
      { a: tl, b: tr },
      { a: tr, b: br },
      { a: br, b: bl },
      { a: bl, b: tl },
    ];
  });
  return {
    rails,
    solidWalls: [...nodes.flatMap(nodeBody), ...names, ...loopLabels, ...loopRoom],
    groupBorders,
    loopNodes,
  };
}

let lastRouted: { key: string; routed: Routed } | undefined;

function routedFor(doc: DavDocument, layout: Layout, nodes: readonly ResolvedNode[]): Routed {
  const key = JSON.stringify([
    nodes.map((n) => [
      n.id,
      n.icon,
      n.label,
      n.sub ?? '',
      n.rect.x,
      n.rect.y,
      n.rect.width,
      n.rect.height,
    ]),
    doc.nodes.map((n) => n.parentId ?? null),
    doc.groups.map((g) => [g.id, g.parentId ?? null, g.label, layout.groups[g.id] ?? null]),
    synthesizedConnections(doc).map((c) => [c.from, c.to, c.direction]),
    doc.steps.map((s) => s.statics.map((st) => [st.from, st.to, st.label ?? null])),
  ]);
  if (lastRouted?.key !== key) lastRouted = { key, routed: routeDiagram(doc, layout, nodes) };
  return lastRouted.routed;
}

/**
 * The rails of a diagram: right-angled routes that keep clear of every node and zone name, and
 * avoid the zones they have nothing to do with. Rails that share a line run side by side, so
 * opposite directions between two stations get parallel tracks.
 *
 * Every rail is decided once for an arrangement, whatever the step shows, so a rail keeps its
 * course from step to step.
 */
export class RailRouter {
  readonly #routed: Routed;

  constructor(doc: DavDocument, layout: Layout, nodes: readonly ResolvedNode[]) {
    this.#routed = routedFor(doc, layout, nodes);
  }

  /** The routed rail from `from` to `to`, oriented in the caller's direction. */
  railOf(from: RailEndpoint, to: RailEndpoint): Rail {
    if (from.id === to.id) {
      return selfLoop(from.icon ? stationRect(from.rect, from.icon) : from.rect, 0);
    }
    const stored = this.#routed.rails.get(unorderedPairKey(from.id, to.id));
    if (!stored) return direct(from, to);
    return stored.canonFrom === from.id ? stored.route : reverse(stored.route);
  }

  /** Places labels for any labeled edges in the given view, avoiding rendered stop markers. */
  attachLabels(
    edges: ResolvedEdge[],
    nodes: readonly ResolvedNode[],
    stopPoints: readonly Point[] = [],
  ): void {
    if (!edges.some((e) => e.label)) return;
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const stepRails: Route[] = [];
    const labelInputs: Array<
      { label: string; rail: Route; shared: readonly boolean[] } | undefined
    > = edges.map((e) => {
      if (e.from === e.to) {
        if (e.label) {
          const node = nodeById.get(e.from);
          if (node) e.labelAt = loopLabelSpot(stationRect(node.rect, node.icon));
        }
        return undefined;
      }
      if (!('points' in e.path)) return undefined;
      stepRails.push(e.path);
      if (!e.label) return undefined;
      const stored = this.#routed.rails.get(unorderedPairKey(e.from, e.to));
      const shared = stored
        ? stored.canonFrom === e.from
          ? stored.shared
          : [...stored.shared].reverse()
        : [];
      return { label: e.label, rail: e.path, shared };
    });

    const spots = placeLabels(
      labelInputs,
      this.#routed.solidWalls,
      stepRails,
      this.#routed.groupBorders,
      stopPoints,
    );
    edges.forEach((e, i) => {
      const spot = spots[i];
      if (spot) e.labelAt = spot;
    });
  }
}

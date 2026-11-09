import { type Rect, stationRect } from '../layout';
import { EDGE_LABEL_FONT_SIZE, EDGE_LABEL_MAX_WIDTH } from '../model/text';
import { COLOR_NAMES } from '../model/types';
import { type Bezier, curveLength, type Point, pointAt, svgPath } from './geometry';
import { ICON_SHAPES } from './icons';
import type { Packet, ResolvedEdge, ResolvedGroup, ResolvedNode, ResolvedView } from './resolve';
import { estimateTextWidth, fitText, wrapText } from './text';
import { h, type VElement } from './vnode';

/**
 * Builds the SVG scene as a route map: nodes are stations, edges are rails, groups are zones.
 * All user-provided strings end up as text nodes or attribute values; renderers must
 * set them via DOM APIs (never innerHTML).
 *
 * Default colors are `var(--dav-*)` presentation attributes so they follow the theme, while
 * author-specified colors stay plain attributes that no stylesheet rule overrides.
 */

const COLOR = {
  fg: 'var(--dav-fg)',
  bg: 'var(--dav-bg)',
  panel: 'var(--dav-panel)',
  borderStrong: 'var(--dav-border-strong)',
  accent: 'var(--dav-accent)',
  nodeBg: 'var(--dav-node-bg)',
  zone: 'var(--dav-zone)',
} as const;

/** Color names resolve to a per-theme token; default colors are tokens already. */
export function paint(color: string): string {
  return (COLOR_NAMES as readonly string[]).includes(color) ? `var(--dav-c-${color})` : color;
}

export const SCENE_PADDING = 48;
/** Extra room above a framed diagram for speech bubbles. */
const BUBBLE_HEADROOM = 76;

export function buildScene(view: ResolvedView): VElement {
  return h(
    'g',
    { class: 'dav-scene' },
    h(
      'g',
      { class: 'dav-layer-groups' },
      ...[...view.groups].sort((a, b) => a.depth - b.depth).map(groupElement),
    ),
    h('g', { class: 'dav-layer-edges' }, ...view.edges.map(edgeElement)),
    h('g', { class: 'dav-layer-flows' }, ...view.edges.map(flowElement)),
    h(
      'g',
      { class: 'dav-layer-labels' },
      ...view.groups.map(groupLabelElement),
      ...view.edges.map(edgeLabelElement),
    ),
    h('g', { class: 'dav-layer-stops' }, ...stopElements(view)),
    h('g', { class: 'dav-layer-nodes' }, ...view.nodes.map(nodeElement)),
  );
}

/** Shared <defs>: an arrow marker colored by the referencing path (`context-stroke`). */
export function buildDefs(): VElement {
  return h(
    'defs',
    {},
    h(
      'marker',
      {
        id: 'dav-arrow',
        viewBox: '0 0 10 10',
        refX: 8,
        refY: 5,
        markerWidth: 14,
        markerHeight: 14,
        orient: 'auto-start-reverse',
        markerUnits: 'userSpaceOnUse',
      },
      h('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'context-stroke' }),
    ),
  );
}

/** Bounding box of everything drawn (for fit-to-screen). */
export function sceneBounds(
  view: ResolvedView,
  pad = SCENE_PADDING,
  headroom = BUBBLE_HEADROOM,
): Rect {
  return boundsOf(
    [...view.groups.map((g) => g.rect), ...view.nodes.map((n) => n.rect)],
    pad,
    headroom,
  );
}

/** Bounding box of rectangles plus scene padding (extra top headroom for speech bubbles). */
export function boundsOf(
  rects: readonly Rect[],
  pad = SCENE_PADDING,
  headroom = BUBBLE_HEADROOM,
): Rect {
  if (rects.length === 0) return { x: 0, y: 0, width: 400, height: 300 };
  const minX = Math.min(...rects.map((r) => r.x)) - pad;
  const minY = Math.min(...rects.map((r) => r.y)) - pad - headroom;
  const maxX = Math.max(...rects.map((r) => r.x + r.width)) + pad;
  const maxY = Math.max(...rects.map((r) => r.y + r.height)) + pad;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function dimClass(base: string, dimmed: boolean): string {
  return dimmed ? `${base} dav-dimmed` : base;
}

/** Groups are zones: a tinted area behind the stations they contain. */
function groupElement(g: ResolvedGroup): VElement {
  const { x, y, width, height } = g.rect;
  return h(
    'g',
    { class: dimClass('dav-group', g.dimmed), 'data-id': g.id },
    h('rect', {
      x,
      y,
      width,
      height,
      rx: 14,
      fill: g.color ? `color-mix(in srgb, ${paint(g.color)} 14%, transparent)` : COLOR.zone,
    }),
  );
}

/** A zone's name, in a layer above the rails so that no line can run over it. */
function groupLabelElement(g: ResolvedGroup): VElement {
  const { x, y, width } = g.rect;
  return h(
    'g',
    { class: dimClass('dav-group', g.dimmed), 'data-id': g.id },
    h(
      'text',
      { x: x + 14, y: y + 19, class: 'dav-group-label', 'font-size': 12, fill: COLOR.fg },
      fitText(g.label, 12, Math.max(40, width - 28)),
    ),
  );
}

const ARROW = 'url(#dav-arrow)';

function arrowStart(e: ResolvedEdge): string | undefined {
  return e.direction === 'bidirectional' ? ARROW : undefined;
}

function edgeElement(e: ResolvedEdge): VElement {
  return h(
    'g',
    { class: dimClass('dav-edge', e.dimmed), 'data-id': e.id },
    h('path', {
      d: svgPath(e.path),
      fill: 'none',
      stroke: paint(e.color),
      'stroke-dasharray': e.style === 'dashed' ? '1 9' : undefined,
      'stroke-linecap': 'round',
      'marker-end': ARROW,
      'marker-start': arrowStart(e),
      class: 'dav-rail',
    }),
  );
}

/**
 * The colored overlay of an active edge, in a layer above every rail so that no other rail
 * can cover it. Only the running phase's overlays are shown (see Player.syncPhaseHighlights).
 */
function flowElement(e: ResolvedEdge): VElement | null {
  if (!e.active) return null;
  return h('path', {
    d: svgPath(e.path),
    fill: 'none',
    stroke: e.flowColor ? paint(e.flowColor) : COLOR.accent,
    'stroke-linecap': 'round',
    'marker-end': ARROW,
    'marker-start': arrowStart(e),
    class: 'dav-flow',
    'data-edge': e.id,
  });
}

/** The emphasized color of a label on a rail whose flow has the given color. */
export function activeLabelFill(flowColor: string): string {
  return flowColor === COLOR.accent ? 'var(--dav-accent-text)' : paint(flowColor);
}

function edgeLabelElement(e: ResolvedEdge): VElement | null {
  if (!e.label) return null;
  const mid = pointAt(e.path, 0.5);
  return h(
    'g',
    { class: dimClass('dav-edge-label', e.dimmed) },
    h(
      'text',
      {
        x: mid.x,
        y: e.labelBelow ? mid.y + 25 : mid.y - 17,
        'text-anchor': 'middle',
        'font-size': EDGE_LABEL_FONT_SIZE,
        fill: COLOR.fg,
        // Read by Player.syncPhaseHighlights to emphasize the running phase's label.
        'data-edge': e.active ? e.id : undefined,
      },
      fitText(e.label, EDGE_LABEL_FONT_SIZE, EDGE_LABEL_MAX_WIDTH),
    ),
  );
}

/** Numbered stops showing the order of a step's animation phases. */
function stopElements(view: ResolvedView): VElement[] {
  if (view.phases.length < 2) return [];
  // Phases that share a rail would stack their numbers at its middle, in either direction.
  const byPlace = new Map<string, Array<{ packet: Packet; phase: number }>>();
  view.phases.forEach((packets, phase) => {
    for (const packet of packets) {
      const mid = pointAt(packet.path, 0.5);
      const place = `${Math.round(mid.x)},${Math.round(mid.y)}`;
      byPlace.set(place, [...(byPlace.get(place) ?? []), { packet, phase }]);
    }
  });
  return [...byPlace.values()].flatMap((stops) => {
    const points = stopPoints((stops[0] as { packet: Packet }).packet.path, stops.length);
    return stops.map(({ packet, phase }, i) => stopElement(packet, phase, points[i] as Point));
  });
}

/** Wider than a stop's diameter, because a chord across a tight loop is shorter than its arc. */
const STOP_SPACING = 32;

/** Evenly spaced positions around the middle of a rail. */
function stopPoints(path: Bezier, count: number): Point[] {
  const step = count > 1 ? Math.min(STOP_SPACING / curveLength(path), 0.8 / (count - 1)) : 0;
  return Array.from({ length: count }, (_, i) => pointAt(path, 0.5 + (i - (count - 1) / 2) * step));
}

function stopElement(packet: Packet, phase: number, { x, y }: Point): VElement {
  return h(
    'g',
    {
      class: 'dav-stop',
      'data-phase': phase,
      // Read by Player.syncPhaseHighlights while this phase is running.
      'data-active-fill': paint(packet.color),
      'data-active-text': packet.color === COLOR.accent ? '#ffffff' : COLOR.bg,
    },
    h('circle', { cx: x, cy: y, r: 11, fill: COLOR.fg }),
    h(
      'text',
      { x, y: y + 4, 'text-anchor': 'middle', 'font-size': 11, fill: COLOR.bg },
      String(phase + 1),
    ),
  );
}

const ICON_SIZE = 22;
const WINDOW_BAR = 10;
const WINDOW_ICON_SIZE = 17;
const NODE_LABEL_OFFSET = 94;

function nodeElement(n: ResolvedNode): VElement {
  const { x, y, width } = n.rect;
  const station = stationRect(n.rect, n.icon);
  const isWindow = n.icon === 'screen' || n.icon === 'modal';
  const accent = n.accent ? paint(n.accent) : undefined;
  const classes = ['dav-node'];
  if (n.dimmed) classes.push('dav-dimmed');

  const cx = x + width / 2;
  const cy = station.y + station.height / 2;
  const shape = {
    fill: COLOR.nodeBg,
    stroke: accent ?? COLOR.fg,
    'stroke-width': 3.5,
    class: 'dav-station',
  };
  const iconCy = isWindow ? cy + WINDOW_BAR / 2 : cy;
  const iconSize = isWindow ? WINDOW_ICON_SIZE : ICON_SIZE;
  const textWidth = width - 8;

  return h(
    'g',
    { class: classes.join(' '), 'data-id': n.id },
    h('title', {}, n.sub ? `${n.label}\n${n.sub}` : n.label),
    isWindow
      ? h('rect', {
          x: station.x,
          y: station.y,
          width: station.width,
          height: station.height,
          rx: 6,
          ...shape,
        })
      : h('circle', { cx, cy, r: station.width / 2, ...shape }),
    isWindow ? windowBar(station, shape.stroke) : null,
    h(
      'g',
      {
        transform: `translate(${cx - iconSize / 2} ${iconCy - iconSize / 2}) scale(${iconSize / 24})`,
        fill: 'none',
        stroke: accent ?? COLOR.fg,
        'stroke-width': 2,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
      ...ICON_SHAPES[n.icon].map(([tag, attrs]) => h(tag, { ...attrs })),
    ),
    h(
      'text',
      {
        x: cx,
        y: y + NODE_LABEL_OFFSET,
        'text-anchor': 'middle',
        class: 'dav-node-label',
        'font-size': 14,
        fill: COLOR.fg,
      },
      fitText(n.label, 14, textWidth),
    ),
    n.sub
      ? h(
          'text',
          {
            x: cx,
            y: y + NODE_LABEL_OFFSET + 17,
            'text-anchor': 'middle',
            class: 'dav-node-sub',
            'font-size': 11.5,
            fill: COLOR.fg,
          },
          fitText(n.sub, 11.5, textWidth),
        )
      : null,
    n.badge ? badge(cx, station.y, n.badge, accent ?? COLOR.fg) : null,
  );
}

function windowBar(station: Rect, stroke: string): VElement {
  const lineY = station.y + WINDOW_BAR;
  return h(
    'g',
    {},
    h('path', {
      d: `M ${station.x} ${lineY} H ${station.x + station.width}`,
      stroke,
      'stroke-width': 1.75,
    }),
    ...[0, 1].map((i) =>
      h('circle', {
        cx: station.x + 7 + i * 5,
        cy: station.y + WINDOW_BAR / 2 + 0.5,
        r: 1.4,
        fill: stroke,
      }),
    ),
  );
}

function badge(cx: number, stationTop: number, text: string, color: string): VElement {
  const label = fitText(text, 11, 120);
  const width = estimateTextWidth(label, 11) + 16;
  const y = stationTop - 25;
  return h(
    'g',
    { class: 'dav-badge' },
    h('rect', { x: cx - width / 2, y, width, height: 20, rx: 10, fill: color }),
    h(
      'text',
      { x: cx, y: y + 14, 'text-anchor': 'middle', 'font-size': 11, fill: COLOR.bg },
      label,
    ),
  );
}

export interface PacketCalloutBox {
  cx: number;
  halfW: number;
  boxTop: number;
  boxBottom: number;
  padX: number;
  label: string;
  descLines: string[];
}

const CALLOUT_MAX_TEXT_WIDTH = 360;
const CALLOUT_LABEL_SIZE = 14;
const CALLOUT_DESC_SIZE = 13;
const CALLOUT_LINE_HEIGHT = 18;
/** Keeps a callout above its endpoint nodes, including their badges and crop marks. */
const CALLOUT_NODE_CLEARANCE = 16;
const CALLOUT_LABEL_CLEARANCE = 6;

/**
 * Computes the stationary speech-bubble box positioned above the packet's edge path.
 * Keeping the bubble body stationary while only its pointer tip tracks the moving dot
 * eliminates eye-tracking fatigue when reading multi-line descriptions.
 */
export function computePacketCalloutBox(packet: Packet): PacketCalloutBox | null {
  const label = packet.label
    ? fitText(packet.label, CALLOUT_LABEL_SIZE, CALLOUT_MAX_TEXT_WIDTH)
    : '';
  const descLines = packet.description
    ? wrapText(packet.description, CALLOUT_DESC_SIZE, CALLOUT_MAX_TEXT_WIDTH, 4)
    : [];
  if (!label && descLines.length === 0) return null;

  const labelW = label ? estimateTextWidth(label, CALLOUT_LABEL_SIZE) : 0;
  const descW = descLines.reduce(
    (m, line) => Math.max(m, estimateTextWidth(line, CALLOUT_DESC_SIZE)),
    0,
  );
  const padX = descLines.length > 0 ? 12 : 10;
  const minW = descLines.length > 0 ? 200 : 56;
  const width = Math.max(minW, Math.ceil(Math.max(labelW, descW) + padX * 2));
  const halfW = width / 2;
  const height =
    descLines.length === 0 ? 30 : (label ? 36 : 14) + descLines.length * CALLOUT_LINE_HEIGHT;

  const mid = pointAt(packet.path, 0.5);
  const minY = Math.min(
    packet.path.p0.y,
    packet.path.p1.y,
    packet.path.p2.y,
    packet.path.p3.y,
    mid.y,
  );
  const cx = mid.x;
  let boxBottom = Math.min(mid.y - 36, minY - 26, packet.clearTop - CALLOUT_NODE_CLEARANCE);
  // Moves up past each zone name in the way, nearest first.
  for (const area of [...packet.labelAreas].sort((a, b) => b.y - a.y)) {
    const overlapsX = cx - halfW < area.x + area.width && cx + halfW > area.x;
    const overlapsY = boxBottom - height < area.y + area.height && boxBottom > area.y;
    if (overlapsX && overlapsY) boxBottom = area.y - CALLOUT_LABEL_CLEARANCE;
  }
  const boxTop = boxBottom - height;

  return { cx, halfW, boxTop, boxBottom, padX, label, descLines };
}

/**
 * Builds the path of the stationary annotation box and its leader line, whose end
 * dynamically follows `dot` along the edge path.
 */
export function packetBubblePath(box: PacketCalloutBox, dot: Point): string {
  const { cx, halfW, boxTop, boxBottom } = box;
  const left = cx - halfW;
  const right = cx + halfW;
  const r = 6;
  const maxOffset = Math.max(0, halfW - r - 12);
  const baseX = cx + Math.max(-maxOffset, Math.min(maxOffset, (dot.x - cx) * 0.25));
  const dx = dot.x - baseX;
  const dy = Math.max(12, dot.y - boxBottom);
  const dist = Math.hypot(dx, dy);
  const pull = Math.min(7, dist * 0.35);
  const tipX = dot.x - (dx / dist) * pull;
  const tipY = dot.y - (dy / dist) * pull;
  const n = (value: number) => value.toFixed(1);

  return [
    `M ${n(left + r)} ${n(boxTop)}`,
    `H ${n(right - r)}`,
    `Q ${n(right)} ${n(boxTop)} ${n(right)} ${n(boxTop + r)}`,
    `V ${n(boxBottom - r)}`,
    `Q ${n(right)} ${n(boxBottom)} ${n(right - r)} ${n(boxBottom)}`,
    `H ${n(baseX)}`,
    `L ${n(tipX)} ${n(tipY)}`,
    `L ${n(baseX)} ${n(boxBottom)}`,
    `H ${n(left + r)}`,
    `Q ${n(left)} ${n(boxBottom)} ${n(left)} ${n(boxBottom - r)}`,
    `V ${n(boxTop + r)}`,
    `Q ${n(left)} ${n(boxTop)} ${n(left + r)} ${n(boxTop)}`,
    'Z',
  ].join(' ');
}

/** A packet (stationary callout + a marker riding the rail). */
export function buildPacket(packet: Packet, t = 0): VElement {
  const dot = packetPosition(packet, t);
  const box = computePacketCalloutBox(packet);
  let callout: VElement | null = null;

  if (box) {
    const { cx, halfW, boxTop, padX, label, descLines } = box;
    const hasDesc = descLines.length > 0;
    callout = h(
      'g',
      { class: 'dav-packet-callout' },
      h('path', {
        d: packetBubblePath(box, dot),
        fill: COLOR.panel,
        stroke: COLOR.borderStrong,
        'stroke-width': 1.5,
        'stroke-linejoin': 'round',
        class: 'dav-packet-bubble',
      }),
      label
        ? h(
            'text',
            {
              x: hasDesc ? cx - halfW + padX : cx,
              y: boxTop + (hasDesc ? 21 : 20),
              ...(hasDesc ? {} : { 'text-anchor': 'middle' }),
              'font-size': CALLOUT_LABEL_SIZE,
              fill: COLOR.fg,
              class: 'dav-packet-label',
            },
            label,
          )
        : null,
      ...descLines.map((line, i) =>
        h(
          'text',
          {
            x: cx - halfW + padX,
            y: boxTop + (label ? 40 : 19) + i * CALLOUT_LINE_HEIGHT,
            'font-size': CALLOUT_DESC_SIZE,
            fill: COLOR.fg,
            class: 'dav-packet-desc',
          },
          line,
        ),
      ),
    );
  }

  return h(
    'g',
    { class: 'dav-packet' },
    callout,
    h(
      'g',
      {
        class: 'dav-packet-dot',
        transform: `translate(${dot.x.toFixed(1)} ${dot.y.toFixed(1)})`,
      },
      h('circle', { r: 8, fill: '#ffffff', stroke: paint(packet.color), 'stroke-width': 4 }),
    ),
  );
}

export function packetPosition(packet: Packet, t: number): Point {
  // A round trip covers the path twice in the time of a one-way trip.
  const progress = packet.roundTrip ? 1 - Math.abs(2 * t - 1) : t;
  return pointAt(packet.path, easeInOut(progress));
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

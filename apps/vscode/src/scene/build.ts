import type { Rect } from '../layout';
import { type Point, pointAt, svgPath } from './geometry';
import { ICON_SHAPES } from './icons';
import type { Packet, ResolvedEdge, ResolvedGroup, ResolvedNode, ResolvedView } from './resolve';
import { estimateTextWidth, fitText, wrapText } from './text';
import { h, type VElement } from './vnode';

/**
 * Builds the static SVG scene (groups, edges, nodes) for a resolved view.
 * All user-provided strings end up as text nodes or attribute values; renderers must
 * set them via DOM APIs (never innerHTML).
 */

const STATUS_STROKE: Record<string, string | undefined> = {
  warning: '#f59e0b',
  error: '#ef4444',
};

export const SCENE_PADDING = 48;

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
    h('g', { class: 'dav-layer-labels' }, ...view.edges.map(edgeLabelElement)),
    h('g', { class: 'dav-layer-nodes' }, ...view.nodes.map(nodeElement)),
  );
}

/** Shared <defs>: arrow marker colored by the referencing path (`context-stroke`). */
export function buildDefs(): VElement {
  return h(
    'defs',
    {},
    h(
      'marker',
      {
        id: 'dav-arrow',
        viewBox: '0 0 10 10',
        refX: 9,
        refY: 5,
        markerWidth: 7,
        markerHeight: 7,
        orient: 'auto-start-reverse',
        markerUnits: 'userSpaceOnUse',
      },
      h('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'context-stroke' }),
    ),
  );
}

/** Bounding box of everything drawn (for fit-to-screen). */
export function sceneBounds(view: ResolvedView): Rect {
  return boundsOf([...view.groups.map((g) => g.rect), ...view.nodes.map((n) => n.rect)]);
}

/** Bounding box of rectangles plus scene padding (extra top headroom for speech bubbles). */
export function boundsOf(rects: readonly Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, width: 400, height: 300 };
  const minX = Math.min(...rects.map((r) => r.x)) - SCENE_PADDING;
  const minY = Math.min(...rects.map((r) => r.y)) - SCENE_PADDING - 56;
  const maxX = Math.max(...rects.map((r) => r.x + r.width)) + SCENE_PADDING;
  const maxY = Math.max(...rects.map((r) => r.y + r.height)) + SCENE_PADDING;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function dimClass(base: string, dimmed: boolean): string {
  return dimmed ? `${base} dav-dimmed` : base;
}

function groupElement(g: ResolvedGroup): VElement {
  const stroke = g.color ?? '#475569';
  const { x, y, width, height } = g.rect;
  const label = fitText(g.label, 11.5, Math.max(40, width - 48));
  const pillWidth = Math.min(width - 24, estimateTextWidth(label, 11.5) + 22);
  return h(
    'g',
    { class: dimClass('dav-group', g.dimmed), 'data-id': g.id },
    h('rect', {
      x,
      y,
      width,
      height,
      fill: 'rgba(10, 14, 28, 0.72)',
      stroke,
      'stroke-width': 2,
      'stroke-dasharray': '8 4',
    }),
    h('rect', {
      x: x + 15,
      y: y - 8,
      width: pillWidth,
      height: 22,
      fill: '#03050a',
    }),
    h('rect', {
      x: x + 12,
      y: y - 11,
      width: pillWidth,
      height: 22,
      fill: '#0c1022',
      stroke,
      'stroke-width': 2,
    }),
    h(
      'text',
      { x: x + 23, y: y + 4, class: 'dav-group-label', 'font-size': 11.5, fill: '#e2e8f0' },
      label,
    ),
  );
}

function edgeElement(e: ResolvedEdge): VElement {
  const d = svgPath(e.path);
  return h(
    'g',
    { class: dimClass('dav-edge', e.dimmed), 'data-id': e.id },
    h('path', {
      d,
      fill: 'none',
      stroke: e.color,
      'stroke-width': e.active ? 2.6 : 1.75,
      'stroke-dasharray': e.style === 'dashed' ? '6 5' : undefined,
      'marker-end': 'url(#dav-arrow)',
      'marker-start': e.direction === 'bidirectional' ? 'url(#dav-arrow)' : undefined,
    }),
    e.active
      ? h('path', { d, fill: 'none', stroke: e.color, 'stroke-width': 3, class: 'dav-flow' })
      : null,
  );
}

function edgeLabelElement(e: ResolvedEdge): VElement | null {
  if (!e.label) return null;
  const mid = pointAt(e.path, 0.5);
  return h('g', { class: dimClass('dav-edge-label', e.dimmed) }, ...pill(mid, e.label, '#94a3b8'));
}

function nodeElement(n: ResolvedNode): VElement {
  const { x, y, width, height } = n.rect;
  const isScreen = n.icon === 'screen' || n.icon === 'modal';
  const highlighted = n.status === 'active' || n.focused;
  const stroke = STATUS_STROKE[n.status] ?? (highlighted ? n.accent : '#475569');
  const fill = n.status === 'error' ? '#2a0f16' : '#0d1224';
  const classes = ['dav-node', `dav-status-${n.status}`];
  if (n.dimmed) classes.push('dav-dimmed');

  const header = isScreen ? 22 : 0;
  const iconSize = 22;
  const contentTop = y + header;
  const contentHeight = height - header;
  const iconX = x + 14;
  const iconY = contentTop + (contentHeight - iconSize) / 2;
  const textX = iconX + iconSize + 12;
  const textWidth = x + width - textX - 10;
  const hasSub = Boolean(n.sub);
  const labelY = contentTop + contentHeight / 2 + (hasSub ? -3 : 4.5);

  return h(
    'g',
    { class: classes.join(' '), 'data-id': n.id },
    h('rect', {
      x: x + 4,
      y: y + 4,
      width,
      height,
      fill: '#03050a',
    }),
    highlighted
      ? h('rect', {
          x: x - 5,
          y: y - 5,
          width: width + 10,
          height: height + 10,
          fill: 'none',
          stroke: STATUS_STROKE[n.status] ?? n.accent,
          'stroke-width': 2.5,
          'stroke-dasharray': '6 4',
          class: 'dav-halo',
        })
      : null,
    h('rect', {
      x,
      y,
      width,
      height,
      fill,
      stroke,
      'stroke-width': 2,
    }),
    h('rect', {
      x: x + 3,
      y: y + 3,
      width: width - 6,
      height: height - 6,
      fill: 'none',
      stroke,
      'stroke-opacity': 0.35,
      'stroke-width': 1,
    }),
    isScreen ? screenHeader(x, y, width, header, n.accent) : null,
    h(
      'g',
      {
        transform: `translate(${iconX} ${iconY}) scale(${iconSize / 24})`,
        fill: 'none',
        stroke: n.accent,
        'stroke-width': 1.8,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      },
      ...ICON_SHAPES[n.icon].map(([tag, attrs]) => h(tag, { ...attrs })),
    ),
    h(
      'text',
      { x: textX, y: labelY, class: 'dav-node-label', 'font-size': 13, fill: '#f1f5f9' },
      fitText(n.label, 13, textWidth),
    ),
    hasSub
      ? h(
          'text',
          { x: textX, y: labelY + 17, class: 'dav-node-sub', 'font-size': 11, fill: '#94a3b8' },
          fitText(n.sub ?? '', 11, textWidth),
        )
      : null,
    n.badge ? badge(x + width, y, n.badge, STATUS_STROKE[n.status] ?? n.accent) : null,
  );
}

function screenHeader(x: number, y: number, width: number, height: number, accent: string) {
  return h(
    'g',
    {},
    h('rect', {
      x: x + 1,
      y: y + 1,
      width: width - 2,
      height,
      fill: '#182038',
    }),
    ...[0, 1, 2].map((i) =>
      h('rect', {
        x: x + 10 + i * 9,
        y: y + height / 2 - 2.5,
        width: 5,
        height: 5,
        fill: i === 0 ? accent : '#475569',
      }),
    ),
  );
}

function badge(right: number, top: number, text: string, color: string): VElement {
  const label = fitText(text, 10, 120);
  const width = estimateTextWidth(label, 10) + 14;
  const x = right - width + 8;
  const y = top - 9;
  return h(
    'g',
    { class: 'dav-badge' },
    h('rect', { x: x + 2, y: y + 2, width, height: 18, fill: '#03050a' }),
    h('rect', { x, y, width, height: 18, fill: color, stroke: '#f8fafc', 'stroke-width': 1.5 }),
    h(
      'text',
      { x: x + width / 2, y: y + 12.5, 'text-anchor': 'middle', 'font-size': 10, fill: '#ffffff' },
      label,
    ),
  );
}

function pill(center: Point, text: string, color: string): VElement[] {
  const label = fitText(text, 10.5, 220);
  const width = Math.max(40, estimateTextWidth(label, 10.5) + 16);
  return [
    h('rect', {
      x: center.x - width / 2 + 2,
      y: center.y - 8,
      width,
      height: 20,
      fill: '#03050a',
    }),
    h('rect', {
      x: center.x - width / 2,
      y: center.y - 10,
      width,
      height: 20,
      fill: '#0c1022',
      stroke: '#475569',
      'stroke-width': 1.5,
    }),
    h(
      'text',
      {
        x: center.x,
        y: center.y + 3.8,
        'text-anchor': 'middle',
        'font-size': 10.5,
        fill: color,
      },
      label,
    ),
  ];
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

/**
 * Computes the stationary speech-bubble box positioned above the packet's edge path.
 * Keeping the bubble body stationary while only its pointer tip tracks the moving dot
 * eliminates eye-tracking fatigue when reading multi-line descriptions.
 */
export function computePacketCalloutBox(packet: Packet): PacketCalloutBox | null {
  const label = packet.label ? fitText(packet.label, 16, 480) : '';
  const descLines = packet.description ? wrapText(packet.description, 15, 480, 4) : [];
  if (!label && descLines.length === 0) return null;

  const labelW = label ? estimateTextWidth(label, 16) : 0;
  const descW = descLines.reduce((m, line) => Math.max(m, estimateTextWidth(line, 15)), 0);
  const padX = descLines.length > 0 ? 20 : 14;
  const minW = descLines.length > 0 ? 280 : 72;
  const width = Math.max(minW, Math.ceil(Math.max(labelW, descW) + padX * 2));
  const halfW = width / 2;
  const height = descLines.length === 0 ? 36 : (label ? 46 : 20) + descLines.length * 22;

  const mid = pointAt(packet.path, 0.5);
  const minY = Math.min(
    packet.path.p0.y,
    packet.path.p1.y,
    packet.path.p2.y,
    packet.path.p3.y,
    mid.y,
  );
  const cx = mid.x;
  const boxBottom = Math.min(mid.y - 36, minY - 26);
  const boxTop = boxBottom - height;

  return { cx, halfW, boxTop, boxBottom, padX, label, descLines };
}

/**
 * Builds the closed SVG path for the stationary 8-bit pixel-notched speech bubble whose bottom
 * pointer tip dynamically follows `dot` along the edge path.
 */
export function packetBubblePath(box: PacketCalloutBox, dot: Point): string {
  const { cx, halfW, boxTop, boxBottom } = box;
  const left = cx - halfW;
  const right = cx + halfW;
  const s = 4;
  const maxOffset = Math.max(0, halfW - s - 14);
  const baseX = cx + Math.max(-maxOffset, Math.min(maxOffset, (dot.x - cx) * 0.25));
  const halfBase = Math.min(9, Math.max(5, halfW - s - 2));
  const dx = dot.x - baseX;
  const dy = Math.max(12, dot.y - boxBottom);
  const dist = Math.hypot(dx, dy);
  const pull = Math.min(9, dist * 0.35);
  const tipX = dot.x - (dx / dist) * pull;
  const tipY = dot.y - (dy / dist) * pull;

  return [
    `M ${(left + s).toFixed(1)} ${boxTop.toFixed(1)}`,
    `H ${(right - s).toFixed(1)}`,
    `V ${(boxTop + s).toFixed(1)}`,
    `H ${right.toFixed(1)}`,
    `V ${(boxBottom - s).toFixed(1)}`,
    `H ${(right - s).toFixed(1)}`,
    `V ${boxBottom.toFixed(1)}`,
    `H ${(baseX + halfBase).toFixed(1)}`,
    `L ${tipX.toFixed(1)} ${tipY.toFixed(1)}`,
    `L ${(baseX - halfBase).toFixed(1)} ${boxBottom.toFixed(1)}`,
    `H ${(left + s).toFixed(1)}`,
    `V ${(boxBottom - s).toFixed(1)}`,
    `H ${left.toFixed(1)}`,
    `V ${(boxTop + s).toFixed(1)}`,
    `H ${(left + s).toFixed(1)}`,
    'Z',
  ].join(' ');
}

/** A packet (stationary 8-bit speech-bubble callout + moving pixel dot & pointer tip). */
export function buildPacket(packet: Packet, t = 0): VElement {
  const dot = packetPosition(packet, t);
  const box = computePacketCalloutBox(packet);
  let callout: VElement | null = null;

  if (box) {
    const { cx, halfW, boxTop, boxBottom, padX, label, descLines } = box;
    callout = h(
      'g',
      { class: 'dav-packet-callout' },
      h('path', {
        d: packetBubblePath(box, dot),
        fill: '#0a0e1d',
        stroke: packet.color,
        'stroke-width': 2,
        'stroke-linejoin': 'miter',
        class: 'dav-packet-bubble',
      }),
      h('rect', {
        x: cx - halfW + 4,
        y: boxTop + 4,
        width: halfW * 2 - 8,
        height: boxBottom - boxTop - 8,
        fill: 'none',
        stroke: packet.color,
        'stroke-opacity': 0.35,
        'stroke-width': 1,
      }),
      label
        ? h(
            'text',
            {
              x: descLines.length > 0 ? cx - halfW + padX : cx,
              y: descLines.length > 0 ? boxTop + 26 : boxTop + 23,
              ...(descLines.length === 0 ? { 'text-anchor': 'middle' } : {}),
              'font-size': 16,
              fill: descLines.length > 0 ? packet.color : '#f8fafc',
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
            y: boxTop + (label ? 50 : 25) + i * 22,
            'font-size': 15,
            fill: '#f1f5f9',
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
      h('rect', {
        x: -10,
        y: -10,
        width: 20,
        height: 20,
        fill: packet.color,
        'fill-opacity': 0.25,
        stroke: packet.color,
        'stroke-width': 1,
      }),
      h('rect', {
        x: -5.5,
        y: -5.5,
        width: 11,
        height: 11,
        fill: packet.color,
        stroke: '#ffffff',
        'stroke-width': 2,
      }),
    ),
  );
}

export function packetPosition(packet: Packet, t: number): Point {
  return pointAt(packet.path, easeInOut(t));
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

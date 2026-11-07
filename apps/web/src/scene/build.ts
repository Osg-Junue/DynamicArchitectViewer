import type { Rect } from '../layout';
import { type Point, pointAt, svgPath } from './geometry';
import { ICON_SHAPES } from './icons';
import type { Packet, ResolvedEdge, ResolvedGroup, ResolvedNode, ResolvedView } from './resolve';
import { estimateTextWidth, fitText } from './text';
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

/** Bounding box of rectangles plus scene padding. */
export function boundsOf(rects: readonly Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, width: 400, height: 300 };
  const minX = Math.min(...rects.map((r) => r.x)) - SCENE_PADDING;
  const minY = Math.min(...rects.map((r) => r.y)) - SCENE_PADDING;
  const maxX = Math.max(...rects.map((r) => r.x + r.width)) + SCENE_PADDING;
  const maxY = Math.max(...rects.map((r) => r.y + r.height)) + SCENE_PADDING;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function dimClass(base: string, dimmed: boolean): string {
  return dimmed ? `${base} dav-dimmed` : base;
}

function groupElement(g: ResolvedGroup): VElement {
  const stroke = g.color ?? '#334155';
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
      rx: 12,
      fill: 'rgba(15, 23, 42, 0.5)',
      stroke,
      'stroke-width': 1.5,
      'stroke-dasharray': '6 4',
    }),
    h('rect', {
      x: x + 12,
      y: y - 11,
      width: pillWidth,
      height: 22,
      rx: 6,
      fill: '#1e293b',
      stroke,
    }),
    h(
      'text',
      { x: x + 23, y: y + 4, class: 'dav-group-label', 'font-size': 11.5, fill: '#cbd5e1' },
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
  const stroke = STATUS_STROKE[n.status] ?? (highlighted ? n.accent : '#334155');
  const fill = n.status === 'error' ? '#2a0f16' : '#0f172a';
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
    highlighted
      ? h('rect', {
          x: x - 4,
          y: y - 4,
          width: width + 8,
          height: height + 8,
          rx: 14,
          fill: 'none',
          stroke: STATUS_STROKE[n.status] ?? n.accent,
          'stroke-opacity': 0.35,
          'stroke-width': 4,
          class: 'dav-halo',
        })
      : null,
    h('rect', {
      x,
      y,
      width,
      height,
      rx: 10,
      fill,
      stroke,
      'stroke-width': highlighted || STATUS_STROKE[n.status] ? 2 : 1.25,
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
    h('path', {
      d: `M ${x + 1} ${y + height} V ${y + 10} Q ${x + 1} ${y + 1} ${x + 10} ${y + 1} H ${x + width - 10} Q ${x + width - 1} ${y + 1} ${x + width - 1} ${y + 10} V ${y + height} Z`,
      fill: '#1e293b',
    }),
    ...[0, 1, 2].map((i) =>
      h('circle', {
        cx: x + 12 + i * 9,
        cy: y + height / 2,
        r: 2.6,
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
    h('rect', { x, y, width, height: 18, rx: 9, fill: color }),
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
      x: center.x - width / 2,
      y: center.y - 10,
      width,
      height: 20,
      rx: 6,
      fill: '#0f172a',
      stroke: '#334155',
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

/** A moving packet (dot + label) drawn at the origin; position it with a transform. */
export function buildPacket(packet: Packet): VElement {
  const label = packet.label ? fitText(packet.label, 11, 220) : '';
  const width = estimateTextWidth(label, 11) + 18;
  return h(
    'g',
    { class: 'dav-packet' },
    h('circle', { r: 11, fill: packet.color, 'fill-opacity': 0.25 }),
    h('circle', { r: 6, fill: packet.color, stroke: '#ffffff', 'stroke-width': 1.5 }),
    label
      ? h(
          'g',
          { transform: 'translate(0 -24)' },
          h('rect', {
            x: -width / 2,
            y: -11,
            width,
            height: 22,
            rx: 11,
            fill: '#0b1220',
            stroke: packet.color,
            'stroke-width': 1.5,
          }),
          h(
            'text',
            {
              y: 4,
              'text-anchor': 'middle',
              'font-size': 11,
              fill: '#f8fafc',
              class: 'dav-packet-label',
            },
            label,
          ),
        )
      : null,
  );
}

export function packetPosition(packet: Packet, t: number): Point {
  return pointAt(packet.path, easeInOut(t));
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

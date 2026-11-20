import { type Rect, stationRect } from '../layout';
import { EDGE_LABEL_FONT_SIZE, EDGE_LABEL_MAX_WIDTH } from '../model/text';
import { BUBBLE_HEADROOM, boundsOf } from './bounds';
import { type Point, svgPath } from './geometry';
import type { IconShapes } from './icons';
import { buildPacket, iconGlyph, stopTextFill } from './packet';
import { activeLabelFill, paint, THEME_COLOR } from './paint';
import { stopPlacements } from './rails';
import {
  DEFAULT_FLOW_COLOR,
  type Packet,
  type ResolvedEdge,
  type ResolvedGroup,
  type ResolvedNode,
  type ResolvedView,
} from './resolve';
import {
  BADGE_MAX_WIDTH,
  BADGE_SIZE,
  fitText,
  NODE_LABEL_SIZE,
  NODE_SUB_SIZE,
  textWidth,
  wrapText,
} from './text';
import { h, type VElement } from './vnode';
import { ZONE_LABEL, zoneLabelRoom } from './zones';

export { activeLabelFill, buildPacket };

/**
 * Builds the SVG scene as a route map: nodes are stations, edges are rails, groups are zones.
 * All user-provided strings end up as text nodes or attribute values; renderers must
 * set them via DOM APIs (never innerHTML).
 *
 * Default colors are `var(--dav-*)` presentation attributes so they follow the theme, while
 * author-specified colors stay plain attributes that no stylesheet rule overrides.
 */

export function buildScene(view: ResolvedView, icons: IconShapes): VElement {
  const mountedMasks = view.nodes.flatMap((n) => (n.mounted ? [mountedLabelBox(n)] : []));
  return h(
    'g',
    { class: 'dav-scene' },
    h(
      'g',
      { class: 'dav-layer-groups' },
      ...[...view.groups]
        .sort((a, b) => a.depth - b.depth)
        .map((g) => groupElement(g, mountedMasks)),
    ),
    h('g', { class: 'dav-layer-edges' }, ...view.edges.map(edgeElement)),
    h('g', { class: 'dav-layer-flows' }, ...view.edges.map(flowElement)),
    h(
      'g',
      { class: 'dav-layer-labels' },
      ...view.groups.map((g) => groupLabelElement(g, icons)),
      ...view.edges.map(edgeLabelElement),
    ),
    h('g', { class: 'dav-layer-stops' }, ...stopElements(view)),
    h('g', { class: 'dav-layer-nodes' }, ...view.nodes.map((n) => nodeElement(n, icons))),
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
export function sceneBounds(view: ResolvedView, pad?: number, headroom = BUBBLE_HEADROOM): Rect {
  return boundsOf(
    [...view.groups.map((g) => g.rect), ...view.nodes.map((n) => n.rect)],
    pad,
    headroom,
  );
}

export function dimClass(base: string, dimmed: boolean): string {
  return dimmed ? `${base} dav-dimmed` : base;
}

const GROUP_RADIUS = 14;
const MOUNT_BORDER_GAP_PAD = 3;

type Interval = readonly [start: number, end: number];

/** Removes `gaps` from `[lo, hi]`, returning remaining solid intervals in ascending order. */
function subtractIntervals(lo: number, hi: number, gaps: readonly Interval[]): Interval[] {
  if (hi <= lo) return [];
  const clamped: Array<[number, number]> = [];
  for (const [a, b] of gaps) {
    const s = Math.max(lo, a);
    const e = Math.min(hi, b);
    if (e > s) clamped.push([s, e]);
  }
  if (clamped.length === 0) return [[lo, hi]];
  clamped.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [clamped[0] as [number, number]];
  for (let i = 1; i < clamped.length; i++) {
    const prev = merged[merged.length - 1] as [number, number];
    const curr = clamped[i] as [number, number];
    if (curr[0] <= prev[1]) prev[1] = Math.max(prev[1], curr[1]);
    else merged.push(curr);
  }
  const out: Interval[] = [];
  let cursor = lo;
  for (const [s, e] of merged) {
    if (s > cursor) out.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < hi) out.push([cursor, hi]);
  return out;
}

/**
 * Traces a rounded group border with clean gaps wherever a border-mounted node's label crosses it,
 * keeping translucent nested group fills seamless behind the text.
 */
function gappedGroupBorderPath(rect: Rect, mountedMasks: readonly Rect[]): string | null {
  const { x, y, width: w, height: h } = rect;
  const r = Math.min(GROUP_RADIUS, w / 2, h / 2);
  const topGaps: Interval[] = [];
  const rightGaps: Interval[] = [];
  const botGaps: Interval[] = [];
  const leftGaps: Interval[] = [];
  const tol = 2;

  for (const box of mountedMasks) {
    const bx1 = box.x - MOUNT_BORDER_GAP_PAD;
    const bx2 = box.x + box.width + MOUNT_BORDER_GAP_PAD;
    const by1 = box.y - MOUNT_BORDER_GAP_PAD;
    const by2 = box.y + box.height + MOUNT_BORDER_GAP_PAD;
    if (box.y <= y + tol && box.y + box.height >= y - tol && bx2 > x + r && bx1 < x + w - r) {
      topGaps.push([bx1, bx2]);
    }
    if (
      box.x <= x + w + tol &&
      box.x + box.width >= x + w - tol &&
      by2 > y + r &&
      by1 < y + h - r
    ) {
      rightGaps.push([by1, by2]);
    }
    if (
      box.y <= y + h + tol &&
      box.y + box.height >= y + h - tol &&
      bx2 > x + r &&
      bx1 < x + w - r
    ) {
      botGaps.push([bx1, bx2]);
    }
    if (box.x <= x + tol && box.x + box.width >= x - tol && by2 > y + r && by1 < y + h - r) {
      leftGaps.push([by1, by2]);
    }
  }

  if (
    topGaps.length === 0 &&
    rightGaps.length === 0 &&
    botGaps.length === 0 &&
    leftGaps.length === 0
  ) {
    return null;
  }

  const fmt = (n: number) => Number(n.toFixed(2));
  const cmds: string[] = [];
  let curX = Number.NaN;
  let curY = Number.NaN;
  const moveTo = (px: number, py: number) => {
    if (!Number.isFinite(curX) || Math.abs(curX - px) > 1e-3 || Math.abs(curY - py) > 1e-3) {
      cmds.push(`M ${fmt(px)} ${fmt(py)}`);
      curX = px;
      curY = py;
    }
  };
  const lineTo = (px: number, py: number) => {
    cmds.push(`L ${fmt(px)} ${fmt(py)}`);
    curX = px;
    curY = py;
  };
  const arcTo = (px: number, py: number) => {
    cmds.push(`A ${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(px)} ${fmt(py)}`);
    curX = px;
    curY = py;
  };

  for (const [a, b] of subtractIntervals(x + r, x + w - r, topGaps)) {
    moveTo(a, y);
    lineTo(b, y);
  }
  moveTo(x + w - r, y);
  arcTo(x + w, y + r);

  for (const [a, b] of subtractIntervals(y + r, y + h - r, rightGaps)) {
    moveTo(x + w, a);
    lineTo(x + w, b);
  }
  moveTo(x + w, y + h - r);
  arcTo(x + w - r, y + h);

  for (const [a, b] of subtractIntervals(x + r, x + w - r, botGaps).reverse()) {
    moveTo(b, y + h);
    lineTo(a, y + h);
  }
  moveTo(x + r, y + h);
  arcTo(x, y + h - r);

  for (const [a, b] of subtractIntervals(y + r, y + h - r, leftGaps).reverse()) {
    moveTo(x, b);
    lineTo(x, a);
  }
  moveTo(x, y + r);
  arcTo(x + r, y);

  return cmds.join(' ');
}

/** Groups are zones: a tinted area behind the stations they contain. */
function groupElement(g: ResolvedGroup, mountedMasks: readonly Rect[]): VElement {
  const { x, y, width, height } = g.rect;
  // Attenuate fill opacity slightly at deeper nesting levels so 4–6 stacked frames do not darken
  // sub-labels inside leaf subnets.
  const fillOpacity = g.color
    ? g.depth === 0
      ? 0.14
      : g.depth === 1
        ? 0.08
        : g.depth === 2
          ? 0.055
          : 0.04
    : g.depth === 0
      ? 0.07
      : g.depth === 1
        ? 0.04
        : 0.025;
  const strokeAttrs = {
    // A hairline in the zone's own color: boost stroke contrast slightly at depth >= 2 where
    // fill opacity is heavily attenuated so deep nested boundaries (e.g. AZ/Subnet) stay crisp.
    stroke: g.color ? paint(g.color) : THEME_COLOR.fg,
    'stroke-opacity': g.color ? (g.depth >= 2 ? 0.72 : 0.55) : g.depth >= 2 ? 0.42 : 0.28,
    'stroke-width':
      g.border === 'dashed' ? (g.depth >= 2 ? 1.5 : 1.25) : g.depth >= 2 ? 1.15 : 0.75,
    'stroke-dasharray': g.border === 'dashed' ? '7 5' : undefined,
    'vector-effect': 'non-scaling-stroke',
  };
  const gappedPath = mountedMasks.length > 0 ? gappedGroupBorderPath(g.rect, mountedMasks) : null;
  if (gappedPath) {
    return h(
      'g',
      { class: dimClass('dav-group', g.dimmed), 'data-id': g.id },
      h('rect', {
        x,
        y,
        width,
        height,
        rx: GROUP_RADIUS,
        fill: g.color ? paint(g.color) : THEME_COLOR.fg,
        'fill-opacity': fillOpacity,
        stroke: 'none',
      }),
      h('path', {
        d: gappedPath,
        fill: 'none',
        class: 'dav-group-border',
        ...strokeAttrs,
      }),
    );
  }
  return h(
    'g',
    { class: dimClass('dav-group', g.dimmed), 'data-id': g.id },
    h('rect', {
      x,
      y,
      width,
      height,
      rx: GROUP_RADIUS,
      fill: g.color ? paint(g.color) : THEME_COLOR.fg,
      'fill-opacity': fillOpacity,
      ...strokeAttrs,
    }),
  );
}

/** A zone's name (and optional icon), in a layer above the rails so that no line can run over it. */
function groupLabelElement(g: ResolvedGroup, icons: IconShapes): VElement {
  const { x, y, width } = g.rect;
  const hasIcon = g.icon !== undefined;
  const room = zoneLabelRoom(width, hasIcon);
  const labelX = x + ZONE_LABEL.inset + (hasIcon ? ZONE_LABEL.iconOffset : 0);
  const lines = wrapText(g.label, ZONE_LABEL.size, room, 2);
  const content =
    lines.length > 1
      ? lines.map((line, i) =>
          h('tspan', { x: labelX, dy: i === 0 ? 0 : ZONE_LABEL.lineHeight }, line),
        )
      : [lines[0] ?? fitText(g.label, ZONE_LABEL.size, room)];
  const iconEl = g.icon
    ? iconGlyph(
        icons,
        g.icon,
        { x: x + ZONE_LABEL.inset + ZONE_LABEL.iconSize / 2, y: y + ZONE_LABEL.baseline - 5.5 },
        ZONE_LABEL.iconSize,
        {
          stroke: g.color ? paint(g.color) : THEME_COLOR.fg,
          'stroke-width': 2.1,
          class: 'dav-group-icon',
        },
      )
    : null;
  return h(
    'g',
    { class: dimClass('dav-group', g.dimmed), 'data-id': g.id },
    iconEl,
    h(
      'text',
      {
        x: labelX,
        y: y + ZONE_LABEL.baseline,
        class: 'dav-group-label',
        'font-size': ZONE_LABEL.size,
        fill: THEME_COLOR.fg,
      },
      ...content,
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
    { class: 'dav-edge', 'data-id': e.id },
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
 * can cover it. Only the running phase's overlays are shown (see syncPhaseHighlights).
 */
function flowElement(e: ResolvedEdge): VElement | null {
  if (!e.active) return null;
  return h('path', {
    d: svgPath(e.path),
    fill: 'none',
    stroke: e.flowColor ? paint(e.flowColor) : DEFAULT_FLOW_COLOR,
    'stroke-linecap': 'round',
    'marker-end': ARROW,
    'marker-start': arrowStart(e),
    class: 'dav-flow',
    'data-edge': e.id,
  });
}

function edgeLabelElement(e: ResolvedEdge): VElement | null {
  if (!e.label) return null;
  const at = e.labelAt;
  if (!at) return null;
  return h(
    'g',
    { class: 'dav-edge-label' },
    h(
      'text',
      {
        x: at.x,
        y: at.y,
        'text-anchor': at.anchor,
        'font-size': EDGE_LABEL_FONT_SIZE,
        fill: THEME_COLOR.fg,
        // Read by syncPhaseHighlights to emphasize the running phase's label.
        'data-edge': e.active ? e.id : undefined,
      },
      fitText(e.label, EDGE_LABEL_FONT_SIZE, EDGE_LABEL_MAX_WIDTH),
    ),
  );
}

/** Numbered stops showing the order of a step's animation phases. */
function stopElements(view: ResolvedView): VElement[] {
  return stopPlacements(view.phases).map(({ packet, phase, at }) => stopElement(packet, phase, at));
}

function stopElement(packet: Packet, phase: number, { x, y }: Point): VElement {
  // The same number as on the packet's callout; a letter tells apart the packets of one phase.
  const label = packet.stopLabel ?? String(phase + 1);
  return h(
    'g',
    {
      class: 'dav-stop',
      'data-phase': phase,
      // Read by syncPhaseHighlights while this phase is running.
      'data-active-fill': paint(packet.color),
      'data-active-text': stopTextFill(packet.color),
    },
    h('circle', { cx: x, cy: y, r: 11, fill: THEME_COLOR.fg }),
    h(
      'text',
      {
        x,
        y: y + 4,
        'text-anchor': 'middle',
        // A phase of two digits and a letter still fits the circle.
        'font-size': label.length > 2 ? 9 : 11,
        fill: THEME_COLOR.bg,
      },
      label,
    ),
  );
}

const ICON_SIZE = 22;
const WINDOW_BAR = 10;
const WINDOW_ICON_SIZE = 17;
const NODE_LABEL_OFFSET = 94;
const NODE_LABEL_WRAP_OFFSET = 86;
const NODE_LABEL_WRAP_LINE_HEIGHT = 15;

/** Bounding box of a border-mounted node's label and sub-label for group border stroke gaps. */
function mountedLabelBox(n: ResolvedNode): Rect {
  const { x, y, width } = n.rect;
  const cx = x + width / 2;
  const labelLines = wrapText(n.label, NODE_LABEL_SIZE, width, 2, 'bold');
  const wrapped = labelLines.length > 1;
  const labelY = y + (wrapped ? NODE_LABEL_WRAP_OFFSET : NODE_LABEL_OFFSET);
  const subY =
    y +
    (wrapped ? NODE_LABEL_WRAP_OFFSET + NODE_LABEL_WRAP_LINE_HEIGHT + 14 : NODE_LABEL_OFFSET + 17);
  const labelW = Math.max(0, ...labelLines.map((line) => textWidth(line, NODE_LABEL_SIZE, 'bold')));
  const subW = n.sub ? textWidth(fitText(n.sub, NODE_SUB_SIZE, width), NODE_SUB_SIZE) : 0;
  const maskW = Math.min(width, Math.max(labelW, subW) + 8);
  const maskTop = labelY - NODE_LABEL_SIZE + 1;
  const maskBot = n.sub
    ? subY + 3
    : labelY + (wrapped ? (labelLines.length - 1) * NODE_LABEL_WRAP_LINE_HEIGHT : 0) + 3;
  return {
    x: cx - maskW / 2,
    y: maskTop,
    width: maskW,
    height: Math.max(16, maskBot - maskTop),
  };
}

function nodeElement(n: ResolvedNode, icons: IconShapes): VElement {
  const { x, y, width } = n.rect;
  const station = stationRect(n.rect, n.icon);
  const isWindow = n.icon === 'screen' || n.icon === 'modal';
  const accent = n.accent ? paint(n.accent) : undefined;

  const cx = x + width / 2;
  const cy = station.y + station.height / 2;
  const shape = {
    fill: THEME_COLOR.nodeBg,
    stroke: accent ?? THEME_COLOR.fg,
    'stroke-width': 3.5,
    class: 'dav-station',
  };
  const iconCy = isWindow ? cy + WINDOW_BAR / 2 : cy;
  const iconSize = isWindow ? WINDOW_ICON_SIZE : ICON_SIZE;
  const labelLines = wrapText(n.label, NODE_LABEL_SIZE, width, 2, 'bold');
  const wrapped = labelLines.length > 1;
  const labelY = y + (wrapped ? NODE_LABEL_WRAP_OFFSET : NODE_LABEL_OFFSET);
  const subY =
    y +
    (wrapped ? NODE_LABEL_WRAP_OFFSET + NODE_LABEL_WRAP_LINE_HEIGHT + 14 : NODE_LABEL_OFFSET + 17);
  const labelContent = wrapped
    ? labelLines.map((line, i) =>
        h('tspan', { x: cx, dy: i === 0 ? 0 : NODE_LABEL_WRAP_LINE_HEIGHT }, line),
      )
    : [labelLines[0] ?? fitText(n.label, NODE_LABEL_SIZE, width, 'bold')];

  return h(
    'g',
    { class: dimClass('dav-node', n.dimmed), 'data-id': n.id },
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
    iconGlyph(icons, n.icon, { x: cx, y: iconCy }, iconSize, {
      stroke: accent ?? THEME_COLOR.fg,
      'stroke-width': 2,
    }),
    h(
      'text',
      {
        x: cx,
        y: labelY,
        'text-anchor': 'middle',
        class: 'dav-node-label',
        'font-size': NODE_LABEL_SIZE,
        fill: THEME_COLOR.fg,
      },
      ...labelContent,
    ),
    n.sub
      ? h(
          'text',
          {
            x: cx,
            y: subY,
            'text-anchor': 'middle',
            class: 'dav-node-sub',
            'font-size': NODE_SUB_SIZE,
            fill: THEME_COLOR.fg,
          },
          fitText(n.sub, NODE_SUB_SIZE, width),
        )
      : null,
    n.badge ? badge(cx, station.y, n.badge, accent ?? THEME_COLOR.fg) : null,
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
  const label = fitText(text, BADGE_SIZE, BADGE_MAX_WIDTH, 'bold');
  const width = textWidth(label, BADGE_SIZE, 'bold') + 16;
  const y = stationTop - 25;
  return h(
    'g',
    { class: 'dav-badge' },
    h('rect', { x: cx - width / 2, y, width, height: 20, rx: 10, fill: color }),
    h(
      'text',
      {
        x: cx,
        y: y + 14,
        'text-anchor': 'middle',
        'font-size': BADGE_SIZE,
        fill: THEME_COLOR.bg,
      },
      label,
    ),
  );
}

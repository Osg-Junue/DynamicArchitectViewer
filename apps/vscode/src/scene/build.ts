import { type Rect, stationRect } from '../layout';
import { EDGE_LABEL_FONT_SIZE, EDGE_LABEL_MAX_WIDTH } from '../model/text';
import type { IconName } from '../model/types';
import { BUBBLE_HEADROOM, boundsOf } from './bounds';
import {
  CALLOUT_CODE_HEAD_SIZE,
  CALLOUT_CODE_LINE_HEIGHT,
  CALLOUT_CODE_PAD_X,
  CALLOUT_CODE_SIZE,
  CALLOUT_DESC_SIZE,
  CALLOUT_LABEL_SIZE,
  CALLOUT_LINE_HEIGHT,
  computePacketCalloutBox,
  type PacketCalloutBox,
  type PacketCalloutCodeBox,
  packetBubblePath,
} from './callout';
import { type Bezier, curveLength, type Point, pointAt, svgPath } from './geometry';
import type { IconShapes } from './icons';
import { paint, THEME_COLOR } from './paint';
import {
  DEFAULT_FLOW_COLOR,
  type Packet,
  type ResolvedEdge,
  type ResolvedGroup,
  type ResolvedNode,
  type ResolvedView,
} from './resolve';
import { estimateTextWidth, fitText } from './text';
import { packetPosition } from './timing';
import { h, type VElement, type VNode } from './vnode';
import { ZONE_LABEL, zoneLabelRoom } from './zones';

export { BUBBLE_HEADROOM, boundsOf };

/**
 * Builds the SVG scene as a route map: nodes are stations, edges are rails, groups are zones.
 * All user-provided strings end up as text nodes or attribute values; renderers must
 * set them via DOM APIs (never innerHTML).
 *
 * Default colors are `var(--dav-*)` presentation attributes so they follow the theme, while
 * author-specified colors stay plain attributes that no stylesheet rule overrides.
 */

export function buildScene(
  view: ResolvedView,
  icons: IconShapes,
  options: { groupLabels?: boolean } = {},
): VElement {
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
      ...(options.groupLabels === false ? [] : view.groups.map(groupLabelElement)),
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
      fill: g.color ? paint(g.color) : THEME_COLOR.fg,
      'fill-opacity': g.color ? 0.14 : 0.07,
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
      {
        x: x + ZONE_LABEL.inset,
        y: y + ZONE_LABEL.baseline,
        class: 'dav-group-label',
        'font-size': ZONE_LABEL.size,
        fill: THEME_COLOR.fg,
      },
      fitText(g.label, ZONE_LABEL.size, zoneLabelRoom(width)),
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

/** The emphasized color of a label on a rail whose flow has the given color. */
export function activeLabelFill(flowColor: string): string {
  return flowColor === DEFAULT_FLOW_COLOR ? THEME_COLOR.accentText : paint(flowColor);
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
      // Read by syncPhaseHighlights while this phase is running.
      'data-active-fill': paint(packet.color),
      'data-active-text': packet.color === DEFAULT_FLOW_COLOR ? '#ffffff' : THEME_COLOR.bg,
    },
    h('circle', { cx: x, cy: y, r: 11, fill: THEME_COLOR.fg }),
    h(
      'text',
      { x, y: y + 4, 'text-anchor': 'middle', 'font-size': 11, fill: THEME_COLOR.bg },
      String(phase + 1),
    ),
  );
}

const ICON_SIZE = 22;
const WINDOW_BAR = 10;
const WINDOW_ICON_SIZE = 17;
const NODE_LABEL_OFFSET = 94;

/** A built-in icon, drawn from its 24×24 artwork and centered on a point. */
function iconGlyph(
  icons: IconShapes,
  icon: IconName,
  center: Point,
  size: number,
  attrs: Readonly<Record<string, string | number>>,
): VElement {
  return h(
    'g',
    {
      transform: `translate(${center.x - size / 2} ${center.y - size / 2}) scale(${size / 24})`,
      fill: 'none',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      ...attrs,
    },
    ...(icons[icon] ?? []).map(([tag, shape]) => h(tag, { ...shape })),
  );
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
  const textWidth = width - 8;

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
        y: y + NODE_LABEL_OFFSET,
        'text-anchor': 'middle',
        class: 'dav-node-label',
        'font-size': 14,
        fill: THEME_COLOR.fg,
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
            fill: THEME_COLOR.fg,
          },
          fitText(n.sub, 11.5, textWidth),
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
  const label = fitText(text, 11, 120);
  const width = estimateTextWidth(label, 11) + 16;
  const y = stationTop - 25;
  return h(
    'g',
    { class: 'dav-badge' },
    h('rect', { x: cx - width / 2, y, width, height: 20, rx: 10, fill: color }),
    h(
      'text',
      { x: cx, y: y + 14, 'text-anchor': 'middle', 'font-size': 11, fill: THEME_COLOR.bg },
      label,
    ),
  );
}

/** A packet (stationary callout + a marker riding the rail). */
export function buildPacket(packet: Packet, icons: IconShapes, t = 0): VElement {
  const dot = packetPosition(packet, t);
  const box = computePacketCalloutBox(packet);
  let callout: VElement | null = null;

  if (box) {
    const { cx, halfW, boxTop, padX, label, descLines, code } = box;
    const alignLeft = descLines.length > 0 || code !== undefined;
    callout = h(
      'g',
      { class: 'dav-packet-callout' },
      h('path', {
        d: packetBubblePath(box, dot),
        fill: THEME_COLOR.panel,
        stroke: THEME_COLOR.borderStrong,
        'stroke-width': 1.5,
        'stroke-linejoin': 'round',
        class: 'dav-packet-bubble',
      }),
      label
        ? h(
            'text',
            {
              x: alignLeft ? cx - halfW + padX : cx,
              y: boxTop + (alignLeft ? 21 : 20),
              ...(alignLeft ? {} : { 'text-anchor': 'middle' }),
              'font-size': CALLOUT_LABEL_SIZE,
              fill: THEME_COLOR.fg,
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
            fill: THEME_COLOR.fg,
            class: 'dav-packet-desc',
          },
          line,
        ),
      ),
      code ? packetCodeElement(packet, box, code) : null,
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
      ...packetMarker(packet, icons),
    ),
  );
}

const CODE_TOKEN_RE =
  /(\/\/.*$|(?<=^\s*|\s)#(?:\s.*|$))|("(?:\\.|[^"\\])*(?:"|…))|('(?:\\.|[^'\\])*(?:'|…))|\b(true|false|null|undefined|GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|HTTP\/\d(?:\.\d)?|SELECT|INSERT|UPDATE|FROM|WHERE|INTO|VALUES|RETURNING|SET|AND|OR|LIMIT|BEGIN|COMMIT|ROLLBACK|OK|ERR)\b|((?<![\w.-])-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|([{}[\](),:;]+)/g;

const CODE_KEYWORDS = new Set([
  'true',
  'false',
  'null',
  'undefined',
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
  'SELECT',
  'INSERT',
  'UPDATE',
  'FROM',
  'WHERE',
  'INTO',
  'VALUES',
  'RETURNING',
  'SET',
  'AND',
  'OR',
  'LIMIT',
  'BEGIN',
  'COMMIT',
  'ROLLBACK',
  'OK',
  'ERR',
]);

function highlightCodeLine(line: string): VNode[] {
  const out: VNode[] = [];
  const pushPlain = (text: string) => {
    if (!text) return;
    const prev = out[out.length - 1];
    if (typeof prev === 'string') out[out.length - 1] = prev + text;
    else out.push(text);
  };

  let start = 0;
  const unquotedKey = /^(\s*)([A-Za-z_][\w.-]*)(?=\s*:(?!\/))/.exec(line);
  if (unquotedKey) {
    const [, indent = '', key = ''] = unquotedKey;
    if (!CODE_KEYWORDS.has(key)) {
      pushPlain(indent);
      out.push(h('tspan', { fill: THEME_COLOR.codeKey }, key));
      start = indent.length + key.length;
    }
  }

  CODE_TOKEN_RE.lastIndex = start;
  for (let m = CODE_TOKEN_RE.exec(line); m !== null; m = CODE_TOKEN_RE.exec(line)) {
    if (m.index > start) pushPlain(line.slice(start, m.index));
    const token = m[0];
    let fill: string;
    if (m[1] !== undefined) {
      fill = THEME_COLOR.codePunc;
    } else if (m[2] !== undefined) {
      const after = line.slice(m.index + token.length);
      fill = /^\s*:/.test(after) ? THEME_COLOR.codeKey : THEME_COLOR.codeStr;
    } else if (m[3] !== undefined) {
      fill = THEME_COLOR.codeStr;
    } else if (m[4] !== undefined) {
      fill = THEME_COLOR.codeKw;
    } else if (m[5] !== undefined) {
      fill = THEME_COLOR.codeNum;
    } else {
      fill = THEME_COLOR.codePunc;
    }
    out.push(h('tspan', { fill }, token));
    start = m.index + token.length;
  }
  if (start < line.length) pushPlain(line.slice(start));
  return out;
}

function packetCodeElement(
  packet: Packet,
  box: PacketCalloutBox,
  code: PacketCalloutCodeBox,
): VElement {
  const x = box.cx - box.halfW + box.padX;
  const y = box.boxTop + code.offsetY;
  const { width, height, header, headerHeight, lines } = code;
  const bodyTop = y + headerHeight;
  const hx = x + 0.5;
  const hy = y + 0.5;
  const hw = width - 1;
  const hr = 4.5;
  const n = (value: number) => Number(value.toFixed(2));

  return h(
    'g',
    { class: 'dav-packet-code' },
    h('rect', {
      x: n(x),
      y: n(y),
      width: n(width),
      height: n(height),
      rx: 5,
      fill: THEME_COLOR.codeBg,
      stroke: THEME_COLOR.border,
      'stroke-width': 1,
      class: 'dav-packet-code-box',
    }),
    headerHeight > 0
      ? h('path', {
          d: [
            `M ${n(hx + hr)} ${n(hy)}`,
            `H ${n(hx + hw - hr)}`,
            `Q ${n(hx + hw)} ${n(hy)} ${n(hx + hw)} ${n(hy + hr)}`,
            `V ${n(bodyTop)}`,
            `H ${n(hx)}`,
            `V ${n(hy + hr)}`,
            `Q ${n(hx)} ${n(hy)} ${n(hx + hr)} ${n(hy)}`,
            'Z',
          ].join(' '),
          fill: THEME_COLOR.codeHeadBg,
          class: 'dav-packet-code-head-bg',
        })
      : null,
    headerHeight > 0
      ? h('line', {
          x1: n(x),
          y1: n(bodyTop),
          x2: n(x + width),
          y2: n(bodyTop),
          stroke: THEME_COLOR.border,
          'stroke-width': 1,
        })
      : null,
    headerHeight > 0
      ? h(
          'text',
          {
            x: n(x + CALLOUT_CODE_PAD_X),
            y: n(y + 15),
            'font-size': CALLOUT_CODE_HEAD_SIZE,
            fill: THEME_COLOR.muted,
            'xml:space': 'preserve',
            class: 'dav-mono dav-packet-code-head',
          },
          h('tspan', { fill: activeLabelFill(packet.color), 'font-weight': 700 }, '{ } '),
          header,
        )
      : null,
    ...lines.map((line, i) =>
      line.length === 0
        ? null
        : h(
            'text',
            {
              x: n(x + CALLOUT_CODE_PAD_X),
              y: n(bodyTop + 18 + i * CALLOUT_CODE_LINE_HEIGHT),
              'font-size': CALLOUT_CODE_SIZE,
              fill: THEME_COLOR.fg,
              'xml:space': 'preserve',
              class: 'dav-mono dav-packet-code-line',
            },
            ...highlightCodeLine(line),
          ),
    ),
  );
}

const PACKET_CHIP_RADIUS = 16;
const PACKET_ICON_SIZE = 20;
/** The same in both themes, so that a marker stands out on any rail. */
const PACKET_MARKER_FILL = '#ffffff';
const PACKET_ICON_COLOR = '#20282f';

function packetMarker(packet: Packet, icons: IconShapes): VElement[] {
  const stroke = paint(packet.color);
  if (!packet.icon) {
    return [h('circle', { r: 8, fill: PACKET_MARKER_FILL, stroke, 'stroke-width': 4 })];
  }
  return [
    h('circle', { r: PACKET_CHIP_RADIUS, fill: PACKET_MARKER_FILL, stroke, 'stroke-width': 3 }),
    iconGlyph(icons, packet.icon, { x: 0, y: 0 }, PACKET_ICON_SIZE, {
      stroke: PACKET_ICON_COLOR,
      'stroke-width': 2.2,
      class: 'dav-packet-icon',
    }),
  ];
}

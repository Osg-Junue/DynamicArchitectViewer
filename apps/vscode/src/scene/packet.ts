import type { IconName } from '../model/types';
import {
  CALLOUT_CODE_HEAD_SIZE,
  CALLOUT_CODE_LINE_HEIGHT,
  CALLOUT_CODE_PAD_X,
  CALLOUT_CODE_RADIUS,
  CALLOUT_CODE_SIZE,
  CALLOUT_DESC_SIZE,
  CALLOUT_LABEL_SIZE,
  CALLOUT_LINE_HEIGHT,
  computePacketCalloutBox,
  type PacketCalloutBox,
  type PacketCalloutCodeBox,
  packetBubblePath,
} from './callout';
import { highlightCodeLine } from './codeHighlight';
import type { Point } from './geometry';
import type { IconShapes } from './icons';
import { activeLabelFill, paint, THEME_COLOR } from './paint';
import type { Packet } from './resolve';
import { packetPosition } from './timing';
import { h, type VElement } from './vnode';

/** A built-in icon, drawn from its 24×24 artwork and centered on a point. */
export function iconGlyph(
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

/** A packet (stationary callout + a marker riding the rail). */
export function buildPacket(packet: Packet, icons: IconShapes, t = 0): VElement {
  const dot = packetPosition(packet, t);
  const box = computePacketCalloutBox(packet);
  let callout: VElement | null = null;

  if (box) {
    const { cx, halfW, boxTop, padX, placement, label, descLines, code } = box;
    const alignLeft = descLines.length > 0 || code !== undefined;
    callout = h(
      'g',
      { class: 'dav-packet-callout', 'data-placement': placement },
      h('path', {
        d: packetBubblePath(box, dot, packet.icon ? 21 : 13),
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
              y: boxTop + (alignLeft ? 24 : 21),
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
            y: boxTop + (label ? 44 : 24) + i * CALLOUT_LINE_HEIGHT,
            'font-size': CALLOUT_DESC_SIZE,
            fill: THEME_COLOR.fg,
            'fill-opacity': 0.86,
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
  const hr = CALLOUT_CODE_RADIUS - 0.5;
  const n = (value: number) => Number(value.toFixed(2));

  return h(
    'g',
    { class: 'dav-packet-code' },
    h('rect', {
      x: n(x),
      y: n(y),
      width: n(width),
      height: n(height),
      rx: CALLOUT_CODE_RADIUS,
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
            y: n(y + 19),
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
              y: n(bodyTop + 20.5 + i * CALLOUT_CODE_LINE_HEIGHT),
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

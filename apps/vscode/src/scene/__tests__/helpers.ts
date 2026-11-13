// What the tests of the scene share: packets and views to try things on, and ways to look into a drawn tree.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type Rect, rectOverlaps } from '../../layout';
import type { CodeBlock } from '../../model/types';
import { ICON_SHAPES } from '../icons';
import {
  buildPacket as buildPacketWith,
  calloutRect,
  DEFAULT_FLOW_COLOR,
  type Packet,
  type PacketCalloutBox,
  type ResolvedView,
  type VElement,
  type VNode,
} from '../index';
import { badgeArea, nodeBody } from '../rails';

const REPO_ROOT = resolve(__dirname, '../../../../..');
export const readExample = (file: string): string =>
  readFileSync(resolve(REPO_ROOT, 'examples', file), 'utf8');

export const buildPacket = (packet: Packet, t?: number) => buildPacketWith(packet, ICON_SHAPES, t);

/** The strip across the top of each zone, which its name moves along with the camera. */
export const nameStrips = (view: ResolvedView): Rect[] =>
  view.groups.map((g) => ({ ...g.rect, height: 34 }));
/** What is drawn of each node: its station, its badge and its labels. */
export const nodeParts = (view: ResolvedView): Rect[] =>
  view.nodes.flatMap((n) => [...nodeBody(n), ...badgeArea(n)]);
/** What no callout may cover in a view. */
export const closedAreas = (view: ResolvedView): Rect[] => [
  ...nameStrips(view),
  ...nodeParts(view),
];
export const covers = (box: PacketCalloutBox, areas: readonly Rect[]): boolean =>
  areas.some((area) => rectOverlaps(calloutRect(box), area));

export function collectText(node: VNode): string[] {
  if (typeof node === 'string') return [node];
  return node.children.flatMap(collectText);
}

export function collectAttrs(node: VNode): string[] {
  if (typeof node === 'string') return [];
  return [
    ...Object.entries(node.attrs).map(([k, v]) => `${k}=${v}`),
    ...node.children.flatMap(collectAttrs),
  ];
}

export function findAll(node: VNode, pred: (e: VElement) => boolean): VElement[] {
  if (typeof node === 'string') return [];
  return [...(pred(node) ? [node] : []), ...node.children.flatMap((c) => findAll(c, pred))];
}

export const commandsOf = (d: string): string => (d.match(/[A-Z]/g) ?? []).join(' ');

export function makePacket(
  opts: { x?: number; label?: string; description?: string; code?: CodeBlock; color?: string } = {},
): Packet {
  const pt = { x: opts.x ?? 200, y: 300 };
  const pkt: Packet = {
    from: 'a',
    to: 'b',
    fromLabel: 'A',
    toLabel: 'B',
    color: opts.color ?? DEFAULT_FLOW_COLOR,
    path: { p0: pt, p1: pt, p2: pt, p3: pt },
    roundTrip: false,
    durationMs: 2000,
  };
  if (opts.label !== undefined) pkt.label = opts.label;
  if (opts.description !== undefined) pkt.description = opts.description;
  if (opts.code !== undefined) pkt.code = opts.code;
  return pkt;
}

/** Whether the boxes of two callouts overlap. */
export const overlap = (a: PacketCalloutBox, b: PacketCalloutBox): boolean =>
  rectOverlaps(calloutRect(a), calloutRect(b));

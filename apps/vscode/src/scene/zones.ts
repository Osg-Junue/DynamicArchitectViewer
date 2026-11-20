import type { Layout, Rect } from '../layout';
import {
  ZONE_LABEL_BASELINE,
  ZONE_LABEL_END_GAP,
  ZONE_LABEL_FONT_SIZE,
  ZONE_LABEL_INSET,
  ZONE_LABEL_LINE_HEIGHT,
} from '../model/text';
import type { DavDocument } from '../model/types';
import { idPair, topLevelGroups } from '../model/zones';
import { boundsOf } from './bounds';
import { paint, THEME_COLOR } from './paint';
import type { Packet, ResolvedGroup, ResolvedView } from './resolve';

/** Where a zone's name sits inside its zone; a part of the diagram, so it zooms with it. */
export const ZONE_LABEL = {
  size: ZONE_LABEL_FONT_SIZE,
  inset: ZONE_LABEL_INSET,
  baseline: ZONE_LABEL_BASELINE,
  /** Gap kept between the end of the name and the zone's right edge. */
  endGap: ZONE_LABEL_END_GAP,
  lineHeight: ZONE_LABEL_LINE_HEIGHT,
} as const;

/** How wide a zone's name may be: up to just before the zone's right edge. */
export function zoneLabelRoom(zoneWidth: number): number {
  return Math.max(40, zoneWidth - ZONE_LABEL.inset - ZONE_LABEL.endGap);
}

const MINIMAP_PAD = 40;

export const MAX_ZONE_MOVES = 3;
export const MINIMAP_ZONE_ATTRS = { rx: 16, 'fill-opacity': 0.55 } as const;

export interface MinimapZone {
  id: string;
  rect: Rect;
  fill: string;
}

/** One end of a move: a zone, or a node outside any zone, which goes by its own name. */
export type ZonePlace = Pick<ResolvedGroup, 'id' | 'label' | 'color'>;
export type ZoneMove = readonly [from: ZonePlace, to: ZonePlace];

export function zoneColor(color: string | undefined): string {
  return color ? paint(color) : THEME_COLOR.borderStrong;
}

/** Fill of a node outside any zone, which the minimap shows as a plain block. */
export const MINIMAP_OUTSIDE_FILL = THEME_COLOR.borderStrong;

/**
 * Top-level zones with a layout rectangle, the nodes outside any zone, and the minimap bounds.
 * The bounds cover everything the diagram draws, so that the camera's frame never leaves them.
 */
export function minimapZones(
  doc: Pick<DavDocument, 'groups' | 'nodes'>,
  layout: Layout,
): { zones: MinimapZone[]; outside: Rect[]; bounds: Rect } {
  const zones = topLevelGroups(doc.groups).flatMap((zone): MinimapZone[] => {
    const rect = layout.groups[zone.id];
    return rect ? [{ id: zone.id, rect, fill: zoneColor(zone.color) }] : [];
  });
  const outside = doc.nodes.flatMap((node): Rect[] => {
    const rect = node.parentId === undefined ? layout.nodes[node.id] : undefined;
    return rect ? [rect] : [];
  });
  return {
    zones,
    outside,
    bounds: boundsOf([...zones.map((z) => z.rect), ...outside], MINIMAP_PAD, 0),
  };
}

/** The distinct moves between zones that some packets make, in the order they first appear. */
export function zoneMoves(view: ResolvedView, packets: readonly Packet[]): ZoneMove[] {
  const groups = new Map(view.groups.map((g) => [g.id, g]));
  const moves = new Map<string, ZoneMove>();
  for (const p of packets) {
    const fromZone = p.fromZone === undefined ? undefined : groups.get(p.fromZone);
    const toZone = p.toZone === undefined ? undefined : groups.get(p.toZone);
    if (!fromZone && !toZone) continue;
    const from: ZonePlace = fromZone ?? { id: p.from, label: p.fromLabel };
    const to: ZonePlace = toZone ?? { id: p.to, label: p.toLabel };
    moves.set(idPair(from.id, to.id), [from, to]);
  }
  return [...moves.values()];
}

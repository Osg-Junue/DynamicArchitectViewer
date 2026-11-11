import type { Rect } from '../layout';
import { idPair } from '../model/zones';
import { paint } from './paint';
import type { Packet, ResolvedGroup, ResolvedView } from './resolve';

/** Where a zone's name sits inside its zone; a part of the diagram, so it zooms with it. */
export const ZONE_LABEL = {
  size: 16,
  inset: 14,
  baseline: 24,
  height: 24,
  /** Gap kept between the end of the name and the zone's right edge. */
  endGap: 4,
  /** Room kept below a name that has followed the camera to the bottom of its zone. */
  bottomGap: 6,
} as const;

/** How wide a zone's name may be: up to just before the zone's right edge. */
export function zoneLabelRoom(zoneWidth: number): number {
  return Math.max(40, zoneWidth - ZONE_LABEL.inset - ZONE_LABEL.endGap);
}

export interface ZoneLabelEntry {
  rect: Rect;
  width: number;
  /** Index of the enclosing zone in the same parents-first list, or `-1` for a top-level zone. */
  parentIndex: number;
}

export interface ZoneLabelPosition {
  x: number;
  y: number;
  hidden: boolean;
}

/** Keeps each zone name inside `world`, as far as it still fits inside its own zone. */
export function placeZoneLabels(
  entries: readonly ZoneLabelEntry[],
  world: Rect,
): ZoneLabelPosition[] {
  const placed: ZoneLabelPosition[] = [];
  for (const { rect, width, parentIndex } of entries) {
    const left = Math.max(rect.x, world.x);
    const top = Math.max(rect.y, world.y);
    const right = Math.min(rect.x + rect.width, world.x + world.width);
    const bottom = Math.min(rect.y + rect.height, world.y + world.height);
    const lowest = rect.y + rect.height - ZONE_LABEL.bottomGap;
    // A nested zone's name stays below its nearest shown ancestor's, which follows the camera too.
    let p = parentIndex;
    while (p >= 0 && placed[p]?.hidden) {
      p = entries[p]?.parentIndex ?? -1;
    }
    const ancestor = p >= 0 ? placed[p] : undefined;
    const belowParent = ancestor ? ancestor.y + ZONE_LABEL.height : Number.NEGATIVE_INFINITY;
    const hidden = right <= left || bottom <= top || belowParent > lowest;
    if (hidden) {
      placed.push({ x: rect.x + ZONE_LABEL.inset, y: rect.y + ZONE_LABEL.baseline, hidden: true });
      continue;
    }
    const lastX = Math.max(
      rect.x + ZONE_LABEL.inset,
      rect.x + rect.width - width - ZONE_LABEL.endGap,
    );
    const x = Math.min(left + ZONE_LABEL.inset, lastX);
    const y = Math.max(Math.min(top + ZONE_LABEL.baseline, lowest), belowParent);
    placed.push({ x, y, hidden: false });
  }
  return placed;
}

/** One end of a move: a zone, or a node outside any zone, which goes by its own name. */
export type ZonePlace = Pick<ResolvedGroup, 'id' | 'label' | 'color'>;
export type ZoneMove = readonly [from: ZonePlace, to: ZonePlace];

export function zoneColor(color: string | undefined): string {
  return color ? paint(color) : 'var(--dav-border-strong)';
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

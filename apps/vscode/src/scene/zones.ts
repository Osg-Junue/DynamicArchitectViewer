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
} as const;

/** How wide a zone's name may be: up to just before the zone's right edge. */
export function zoneLabelRoom(zoneWidth: number): number {
  return Math.max(40, zoneWidth - ZONE_LABEL.inset - ZONE_LABEL.endGap);
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

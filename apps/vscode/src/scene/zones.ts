import { paint } from './build';
import type { Packet, ResolvedGroup, ResolvedView } from './resolve';

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
    moves.set(`${from.id}\u0000${to.id}`, [from, to]);
  }
  return [...moves.values()];
}

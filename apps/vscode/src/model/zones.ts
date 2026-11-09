import type { DavGroup } from './types';

/** The top-level group each group belongs to. Parents always precede their children. */
export function zoneOfGroups(groups: readonly DavGroup[]): Map<string, string> {
  const zones = new Map<string, string>();
  for (const g of groups) {
    zones.set(g.id, g.parentId === undefined ? g.id : (zones.get(g.parentId) ?? g.id));
  }
  return zones;
}

/** The groups enclosing something, innermost first, starting from the group it is directly in. */
export function ancestorIds(
  parentOf: ReadonlyMap<string, string | undefined>,
  start: string | undefined,
): string[] {
  const out: string[] = [];
  for (let g = start; g !== undefined; g = parentOf.get(g)) out.push(g);
  return out;
}

/** A map key for an ordered pair of IDs. */
export const idPair = (a: string, b: string): string => `${a}\u0000${b}`;

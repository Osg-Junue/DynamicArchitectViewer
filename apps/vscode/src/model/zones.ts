import type { DavDocument, DavGroup } from './types';

/** Maps each item's ID to its `parentId`. */
export function parentMap(
  items: ReadonlyArray<{ id: string; parentId?: string }>,
): Map<string, string | undefined> {
  return new Map(items.map((item) => [item.id, item.parentId]));
}

/** Groups that are not nested inside another group, in document order. */
export function topLevelGroups<G extends { parentId?: string }>(groups: readonly G[]): G[] {
  return groups.filter((g) => g.parentId === undefined);
}

/** The top-level group each group belongs to. Parents always precede their children. */
export function zoneOfGroups(groups: readonly DavGroup[]): Map<string, string> {
  const zones = new Map<string, string>();
  for (const g of groups) {
    zones.set(g.id, g.parentId === undefined ? g.id : (zones.get(g.parentId) ?? g.id));
  }
  return zones;
}

/** The top-level group each node belongs to, or `undefined` when outside any group. */
export function zoneOfNodes(
  doc: Pick<DavDocument, 'groups' | 'nodes'>,
): Map<string, string | undefined> {
  const zoneOfGroup = zoneOfGroups(doc.groups);
  return new Map(
    doc.nodes.map((n) => [
      n.id,
      n.parentId === undefined ? undefined : (zoneOfGroup.get(n.parentId) ?? n.parentId),
    ]),
  );
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

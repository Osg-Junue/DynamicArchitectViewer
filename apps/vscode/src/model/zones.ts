import type { DavGroup } from './types';

/** The top-level group each group belongs to. Parents always precede their children. */
export function zoneOfGroups(groups: readonly DavGroup[]): Map<string, string> {
  const zones = new Map<string, string>();
  for (const g of groups) {
    zones.set(g.id, g.parentId === undefined ? g.id : (zones.get(g.parentId) ?? g.id));
  }
  return zones;
}

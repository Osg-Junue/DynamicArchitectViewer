import type { Animation, DavEdge } from '../model/types';

/** A packet rides an edge the way it points, or a two-way edge either way. */
export const carries = (e: DavEdge, a: Pick<Animation, 'from' | 'to'>): boolean =>
  (e.from === a.from && e.to === a.to) ||
  (e.direction === 'bidirectional' && e.from === a.to && e.to === a.from);

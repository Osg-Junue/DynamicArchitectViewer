import type { Animation, DavConnection } from '../model/types';

/** A packet rides a connection the way it points, or a two-way connection either way. */
export const carries = (
  c: Pick<DavConnection, 'from' | 'to' | 'direction'>,
  a: Pick<Animation, 'from' | 'to'>,
): boolean =>
  (c.from === a.from && c.to === a.to) ||
  (c.direction === 'bidirectional' && c.from === a.to && c.to === a.from);

import type { DavDocument } from '../model/types';
import { type Layout, STATION_CENTER } from './metrics';

export type Link = readonly [from: string, to: string];

/** Pairs of connected nodes; a self-loop has no extent, so it cannot cross anything. */
export function linksOf(doc: DavDocument): Link[] {
  const known = new Set(doc.nodes.map((n) => n.id));
  return doc.edges
    .filter((e) => e.from !== e.to && known.has(e.from) && known.has(e.to))
    .map((e) => [e.from, e.to]);
}

export interface Segment {
  from: string;
  to: string;
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

export function segmentsOf(links: readonly Link[], layout: Pick<Layout, 'nodes'>): Segment[] {
  return links.flatMap(([from, to]) => {
    const a = layout.nodes[from];
    const b = layout.nodes[to];
    if (!a || !b) return [];
    return [
      {
        from,
        to,
        ax: a.x + a.width / 2,
        ay: a.y + STATION_CENTER,
        bx: b.x + b.width / 2,
        by: b.y + STATION_CENTER,
      },
    ];
  });
}

function side(x0: number, y0: number, x1: number, y1: number, x: number, y: number): number {
  return Math.sign((x1 - x0) * (y - y0) - (y1 - y0) * (x - x0));
}

/** Rails that meet at a station do not count as crossing. */
export function shareStation(s: Segment, t: Segment): boolean {
  return s.from === t.from || s.from === t.to || s.to === t.from || s.to === t.to;
}

export function properlyCross(s: Segment, t: Segment): boolean {
  return (
    side(s.ax, s.ay, s.bx, s.by, t.ax, t.ay) * side(s.ax, s.ay, s.bx, s.by, t.bx, t.by) < 0 &&
    side(t.ax, t.ay, t.bx, t.by, s.ax, s.ay) * side(t.ax, t.ay, t.bx, t.by, s.bx, s.by) < 0
  );
}

export function crossingsOf(segments: readonly Segment[]): number {
  let crossings = 0;
  segments.forEach((s, i) => {
    for (let j = i + 1; j < segments.length; j++) {
      const t = segments[j];
      if (t && !shareStation(s, t) && properlyCross(s, t)) crossings++;
    }
  });
  return crossings;
}

/** How many pairs of edges cross, drawn as straight lines between their stations. */
export function countCrossings(doc: DavDocument, layout: Layout): number {
  return crossingsOf(segmentsOf(linksOf(doc), layout));
}

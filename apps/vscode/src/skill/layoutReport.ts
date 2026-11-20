import {
  type BackEdge,
  backEdgesOf,
  computeLayout,
  type Layout,
  type Rect,
  zonesPlacedFreely,
} from '../layout';
import { linksOf, properlyCross, type Segment, segmentsOf, shareStation } from '../layout/links';
import { enclosingRect } from '../layout/metrics';
import { synthesizedConnections } from '../model/connections';
import type { DavConnection, DavDocument } from '../model/types';
import { ancestorIds, idPair, parentMap, topLevelGroups, zoneOfNodes } from '../model/zones';
import { arrowOf } from './outline';
import type { Hint } from './review';

/**
 * What `dav-check --detail` says about where the layout puts things: the nearest an agent that
 * cannot see the diagram comes to looking at it. It is the layout the preview draws, since the
 * layout depends on the text alone. `summary` states facts; `notes` point at shapes that are
 * often not what the author meant. Neither is a fault of the file, so neither fails the check.
 */
export interface LayoutReport {
  summary: string[];
  notes: Hint[];
}

/** From how many nodes stacked in one column of a zone is worth pointing out. */
const STACK_FROM = 4;
/** How many times taller than wide a diagram has to be before it is pointed out. */
const TALL_FROM = 1.5;
/** How many crossings are named; the count says how many there are. */
const CROSSINGS_NAMED = 3;
/** Every code a note is given with, in the order that the checker's reference lists them. */
export const NOTE_CODES = [
  'tall-diagram',
  'stacked-zone',
  'back-edge',
  'left-links',
  'crossings',
] as const;
/** How many connections that point left are named; the count says how many there are. */
const LEFT_LINKS_NAMED = 5;
/** How many pairs of kinds of connections are given with their crossings; the rest are summed. */
const KINDS_NAMED = 10;

/** Nodes of a row or column share a coordinate exactly, up to rounding. */
const distinct = (values: readonly number[]): number => new Set(values.map(Math.round)).size;

const columns = (rects: readonly Rect[]): number => distinct(rects.map((r) => r.x));
const rows = (rects: readonly Rect[]): number => distinct(rects.map((r) => r.y));
const grid = (rects: readonly Rect[]): string => `${columns(rects)} x ${rows(rects)}`;

const proportion = (width: number, height: number): string =>
  width >= height ? `${(width / height).toFixed(1)} : 1` : `1 : ${(height / width).toFixed(1)}`;

/** Two connections that cross, as straight lines between their stations. */
export type CrossingPair = readonly [Segment, Segment];

/**
 * How many crossings there are between connections of each two kinds, most first. The kind of
 * a connection is the zones it joins: one zone for a connection inside it, two for one between
 * them. A zone is one at the top level, with the zones inside it, and a node outside every zone
 * stands for itself. Each crossing is counted once, so the counts add up to the crossings.
 */
export function crossingsByZone(
  doc: DavDocument,
  pairs: readonly CrossingPair[],
): Array<{ zones: string; count: number }> {
  const zoneOf = zoneOfNodes(doc);
  const zones = topLevelGroups(doc.groups);
  // Zones are named in the order of the file, and nodes outside every zone after them.
  const order = new Map<string, number>([
    ...zones.map((g, i): [string, number] => [g.id, i]),
    ...doc.nodes.map((n, i): [string, number] => [n.id, zones.length + i]),
  ]);
  const rank = (piece: string): number => order.get(piece) ?? 0;
  const called = new Map(zones.map((g) => [g.id, `"${g.label || g.id}"`]));
  const name = (piece: string): string => called.get(piece) ?? piece;
  /** What a connection joins: `"A"` inside zone A, `"A"–"B"` between two. */
  const kindOf = (s: Segment) => {
    const [a = '', b = ''] = [zoneOf.get(s.from) ?? s.from, zoneOf.get(s.to) ?? s.to].sort(
      (p, q) => rank(p) - rank(q),
    );
    return {
      key: idPair(a, b),
      rank: [rank(a), rank(b)] as const,
      text: a === b ? name(a) : `${name(a)}–${name(b)}`,
    };
  };
  const tally = new Map<string, { zones: string; count: number }>();
  for (const [s, t] of pairs) {
    const [one, other] = [kindOf(s), kindOf(t)].sort(
      (p, q) => p.rank[0] - q.rank[0] || p.rank[1] - q.rank[1],
    );
    if (!one || !other) continue;
    const key = idPair(one.key, other.key);
    const seen = tally.get(key);
    if (seen) seen.count++;
    else tally.set(key, { zones: `${one.text} × ${other.text}`, count: 1 });
  }
  // Ties stay in the order they were first met, which follows the edges as written.
  return [...tally.values()].sort((a, b) => b.count - a.count);
}

/**
 * The connections between two zones whose second node stands to the left of their first, as
 * `--map` would say `left` of them, named as written with the zones they leave and enter. A
 * node outside every zone stands for itself.
 */
export function leftLinks(doc: DavDocument, layout: Pick<Layout, 'nodes'>): string[] {
  const zoneOf = zoneOfNodes(doc);
  const called = new Map(doc.groups.map((g) => [g.id, `"${g.label || g.id}"`]));
  const zoneName = (node: string): string | undefined => {
    const zone = zoneOf.get(node);
    return zone === undefined ? undefined : called.get(zone);
  };
  return synthesizedConnections(doc).flatMap((e) => {
    if (e.from === e.to || (zoneOf.get(e.from) ?? e.from) === (zoneOf.get(e.to) ?? e.to)) {
      return [];
    }
    const [segment] = segmentsOf([[e.from, e.to]], layout);
    // As the map counts it: a node less than a unit aside stands straight above or below.
    if (!segment || Math.round(segment.bx - segment.ax) > -1) return [];
    const [from, to] = [zoneName(e.from), zoneName(e.to)];
    const across =
      from && to
        ? `, from ${from} into ${to}`
        : to
          ? `, into ${to}`
          : from
            ? `, out of ${from}`
            : '';
    return [`${e.from} ${arrowOf(e)} ${e.to}${across}`];
  });
}

/**
 * Whether an edge that closes a loop is worth a note. A loop of two nodes is mostly a request
 * and its response, laid out as the guide says: the node of the two declared first on the left.
 * It is told only where the other one stands there, having been reached first from elsewhere.
 */
function surprising(edge: BackEdge, declared: ReadonlyMap<string, number>): boolean {
  if (edge.loop.length > 2) return true;
  return (declared.get(edge.to) ?? 0) > (declared.get(edge.from) ?? 0);
}

/** What an edge that sets no column did to the layout, and how to have it otherwise. */
function backEdgeNote(
  connections: readonly DavConnection[],
  edge: BackEdge,
  columnOf: (id: string) => number,
): string {
  const written = connections.find(
    (e) => (e.from === edge.from && e.to === edge.to) || (e.from === edge.to && e.to === edge.from),
  );
  const arrow = written ? arrowOf(written) : '-->';
  const cameIn =
    edge.root === edge.to
      ? `${edge.to}, the node of it declared first`
      : `${edge.to}, from ${edge.root}`;
  return `${edge.from} ${arrow} ${edge.to} points back, so it does not count for the columns: it closes the loop ${edge.loop.join(' → ')}. The layout came into the loop at ${cameIn}, and set it out from left to right in that order: ${edge.from} stands at its far end, in column ${columnOf(edge.from)}, with ${edge.to} in column ${columnOf(edge.to)}.`;
}

export function layoutReport(doc: DavDocument): LayoutReport {
  if (doc.nodes.length === 0) return { summary: [], notes: [] };
  const layout = computeLayout(doc);
  const connections = synthesizedConnections(doc);
  const rectOf = (id: string): Rect[] => {
    const rect = layout.nodes[id];
    return rect ? [rect] : [];
  };
  const nodeRects = doc.nodes.flatMap((n) => rectOf(n.id));
  const all = enclosingRect([...nodeRects, ...Object.values(layout.groups)]);
  const width = Math.round(all.width);
  const height = Math.round(all.height);
  // The pairs of connections that cross, as the layout counts them: on straight lines.
  const segments = segmentsOf(linksOf(doc), layout);
  const crossingPairs = segments.flatMap((s, i) =>
    segments
      .slice(i + 1)
      .filter((t) => !shareStation(s, t) && properlyCross(s, t))
      .map((t): CrossingPair => [s, t]),
  );
  // Each connection as synthesized across steps.
  const written = (s: Segment): string => {
    const edge = connections.find((e) => e.from === s.from && e.to === s.to);
    return `${s.from} ${edge ? arrowOf(edge) : '-->'} ${s.to}`;
  };
  const crossing = crossingPairs.map(([s, t]) => `${written(s)} and ${written(t)}`);
  const crossings = crossing.length;

  const summary = [
    `layout: ${width} x ${height} (${proportion(width, height)}), ${columns(nodeRects)} columns x ${rows(nodeRects)} rows of nodes, ${crossings} ${crossings === 1 ? 'crossing' : 'crossings'}`,
  ];
  // Every node of a zone, those of the zones inside it included.
  const parents = parentMap(doc.groups);
  const inside = (zone: string) =>
    doc.nodes.filter((n) => ancestorIds(parents, n.parentId).includes(zone));
  const zones = topLevelGroups(doc.groups)
    .map((g) => ({ g, rects: inside(g.id).flatMap((n) => rectOf(n.id)) }))
    .filter(({ rects }) => rects.length > 0);
  // Placed freely, zones share no columns, and a link between them sets none.
  const free = zones.length > 0 && zonesPlacedFreely(doc);
  if (zones.length > 0) {
    summary.push(
      `layout: zones ${free ? 'placed freely' : 'in shared columns'}, as columns x rows of nodes: ${zones.map(({ g, rects }) => `"${g.label || g.id}" ${grid(rects)}`).join(', ')}`,
    );
  }
  if (zones.length > 0 && crossings > 0) {
    const kinds = crossingsByZone(doc, crossingPairs);
    const rest = kinds.slice(KINDS_NAMED);
    const restCrossings = rest.reduce((sum, { count }) => sum + count, 0);
    const byZone = `${kinds
      .slice(0, KINDS_NAMED)
      .map(({ zones: joined, count }) => `${joined} ${count}`)
      .join(
        ', ',
      )}${rest.length > 0 ? `, and ${restCrossings} more in ${rest.length} other pairs` : ''}`;
    summary.push(
      `layout: crossings by the zones the two connections join, "A" for one inside a zone and "A"–"B" for one between two: ${byZone}`,
    );
  }

  const notes: Array<Hint & { code: (typeof NOTE_CODES)[number] }> = [];
  if (height > width * TALL_FROM) {
    notes.push({
      code: 'tall-diagram',
      message: `The diagram is ${(height / width).toFixed(1)} times as tall as it is wide. Nodes that no edge puts in order are stacked in one column: where one of them really feeds another, declare that edge, and it moves to the right.`,
    });
  }
  for (const g of doc.groups) {
    const own = doc.nodes.filter((n) => n.parentId === g.id).flatMap((n) => rectOf(n.id));
    if (own.length >= STACK_FROM && columns(own) === 1) {
      notes.push({
        code: 'stacked-zone',
        message: `Zone "${g.label || g.id}" stacks its ${own.length} nodes in one column, because no edge runs between them. That is right for peers, such as replicas, separate stores, outside services or people, and the note can then be left. If one of them feeds another, declare that edge, and they spread to the right.`,
      });
    }
  }
  // The columns as `--map` numbers them: across the whole diagram, from the left.
  const columnXs = [...new Set(nodeRects.map((r) => Math.round(r.x)))].sort((a, b) => a - b);
  const columnOf = (id: string): number =>
    columnXs.indexOf(Math.round(layout.nodes[id]?.x ?? Number.NaN)) + 1;
  const declared = new Map(doc.nodes.map((n, i) => [n.id, i]));
  // Two edges that join the same pair the same way close the same loop: one note says it.
  const told = new Set<string>();
  for (const edge of backEdgesOf(doc)) {
    const pair = idPair(edge.from, edge.to);
    if (told.has(pair) || !surprising(edge, declared)) continue;
    told.add(pair);
    notes.push({ code: 'back-edge', message: backEdgeNote(connections, edge, columnOf) });
  }
  // In columns, only an edge left out of a loop points left, and `back-edge` names it.
  const leftward = free ? leftLinks(doc, layout) : [];
  if (leftward.length > 0) {
    const count = leftward.length;
    notes.push({
      code: 'left-links',
      message: `${count === 1 ? 'One connection between zones points' : `${count} connections between zones point`} left, against the reading direction: ${leftward.slice(0, LEFT_LINKS_NAMED).join('; ')}${count > LEFT_LINKS_NAMED ? '; and more' : ''}. The zones are placed freely, and a link between zones sets no column, whichever way it is written. Leave a link whose edge is written as you mean: pointing left is the price of shorter links that cross less. Change only an edge written other than you mean, such as a call back written one way, which becomes one two-way edge that names the node on the left first. Nesting two zones in one zone that is a real boundary makes the links between them point right, since edges set the columns inside a zone, though crossings can rise. references/large-diagrams.md has more.`,
    });
  }
  if (crossings > 0) {
    notes.push({
      code: 'crossings',
      message: `${crossings === 1 ? 'One pair of connections crosses' : `${crossings} pairs of connections cross`}, counted on straight lines between the nodes: ${crossing.slice(0, CROSSINGS_NAMED).join('; ')}${crossings > CROSSINGS_NAMED ? '; and more' : ''}. Swapping the declarations of two nodes that share a column often removes a crossing. In a large diagram, leave the rest once the zones stand in the order you mean; references/layout.md has more.`,
    });
  }
  return { summary, notes };
}

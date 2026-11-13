import { computeLayout, type Rect } from '../layout';
import { linksOf, properlyCross, segmentsOf, shareStation } from '../layout/links';
import { enclosingRect } from '../layout/metrics';
import type { DavDocument } from '../model/types';
import { ancestorIds, parentMap, topLevelGroups } from '../model/zones';
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

/** Nodes of a row or column share a coordinate exactly, up to rounding. */
const distinct = (values: readonly number[]): number => new Set(values.map(Math.round)).size;

const columns = (rects: readonly Rect[]): number => distinct(rects.map((r) => r.x));
const rows = (rects: readonly Rect[]): number => distinct(rects.map((r) => r.y));
const grid = (rects: readonly Rect[]): string => `${columns(rects)} x ${rows(rects)}`;

const proportion = (width: number, height: number): string =>
  width >= height ? `${(width / height).toFixed(1)} : 1` : `1 : ${(height / width).toFixed(1)}`;

export function layoutReport(doc: DavDocument): LayoutReport {
  if (doc.nodes.length === 0) return { summary: [], notes: [] };
  const layout = computeLayout(doc);
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
  const crossing = segments.flatMap((s, i) =>
    segments
      .slice(i + 1)
      .filter((t) => !shareStation(s, t) && properlyCross(s, t))
      .map((t) => `${s.from} --> ${s.to} and ${t.from} --> ${t.to}`),
  );
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
  if (zones.length > 0) {
    summary.push(
      `layout: zones, as columns x rows of nodes: ${zones.map(({ g, rects }) => `"${g.label || g.id}" ${grid(rects)}`).join(', ')}`,
    );
  }

  const notes: Hint[] = [];
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
        message: `Zone "${g.label || g.id}" stacks its ${own.length} nodes in one column, because no edge runs between them. That is right for peers, such as replicas or separate stores. If one of them feeds another, declare that edge, and they spread to the right.`,
      });
    }
  }
  if (crossings > 0) {
    notes.push({
      code: 'crossings',
      message: `${crossings === 1 ? 'One pair of connections crosses' : `${crossings} pairs of connections cross`}, counted on straight lines between the nodes: ${crossing.slice(0, CROSSINGS_NAMED).join('; ')}${crossings > CROSSINGS_NAMED ? '; and more' : ''}. Swapping the declarations of two nodes that share a column often removes a crossing; references/layout.md has more.`,
    });
  }
  return { summary, notes };
}

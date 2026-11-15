import { computeLayout, type Rect } from '../layout';
import { segmentsOf } from '../layout/links';
import type { DavDocument, DavGroup, DavNode } from '../model/types';
import { ancestorIds, parentMap, topLevelGroups, zoneOfNodes } from '../model/zones';
import { arrowOf } from './outline';

/**
 * What `dav-check --map` prints: which node is where, for a reader that cannot see the diagram.
 * `layoutReport` gives the numbers of the layout; this gives the places, and it is as long as
 * the diagram is large, so it is printed only when asked for.
 *
 * It says the places in words and in small tables, not in coordinates: a reader of text takes
 * "right of" as it stands, and has to work on two numbers to find the same.
 *
 * It goes from the whole to the parts, as a look at a picture does:
 *
 * 1. A zone, and a node outside every zone, is one piece of the layout. The pieces come first,
 *    each with a line that says which pieces are beside it: the map of the zones.
 * 2. The nodes of a zone stand on a grid of their own, so each zone then gets a table. Zones
 *    placed freely do not share columns, so there is no table of the whole diagram where there
 *    are zones.
 * 3. Last, each connection gets a line that says where its second node lies from its first.
 */

/** Places that differ by less are one place: the layout rounds to whole units. */
const SAME = 1;

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Columns or rows by their numbers: `column 3`, `columns 3 to 4` where they follow on each
 * other, `columns 3, 5 and 6` where a column of another zone stands between them.
 */
function listed(numbers: readonly number[], unit: string): string {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const [first = 0] = sorted;
  const last = sorted[sorted.length - 1] ?? first;
  if (sorted.length === 1) return `${unit} ${first}`;
  if (last - first + 1 === sorted.length) return `${unit}s ${first} to ${last}`;
  return `${unit}s ${sorted.slice(0, -1).join(', ')} and ${last}`;
}

/** The distinct values of a coordinate, in order: the columns or the rows of a grid. */
function places(values: readonly number[]): number[] {
  return [...new Set(values.map(Math.round))].sort((a, b) => a - b);
}

interface Piece {
  /** As a line about it starts. */
  title: string;
  /** As other lines call it. */
  name: string;
  rect: Rect;
  /** The columns and the rows its nodes stand in, as coordinates: one of each for a node. */
  xs: readonly number[];
  ys: readonly number[];
  /** The table of a zone with nodes, which other pieces can be placed against. */
  grid?: Grid;
}

/**
 * How the places of one piece meet the table of the zone beside it. All of them in its columns
 * or rows: `under its columns 3 to 4`. One node between two of them: `between its rows 1 and 2`.
 * Nothing when neither holds: zones placed freely need not line up, and then nothing is said.
 */
function meets(
  own: readonly number[],
  table: readonly number[],
  numbers: readonly number[],
  unit: 'column' | 'row',
  word: string,
): string {
  if (own.length === 0 || table.length === 0) return '';
  const at = own.flatMap((place) => numbers[table.indexOf(place)] ?? []);
  if (at.length === own.length) return `, ${word} its ${listed(at, unit)}`;
  const [only] = own;
  const after = only === undefined || own.length > 1 ? -1 : table.findIndex((p) => p > only);
  return after > 0 ? `, between its ${unit}s ${numbers[after - 1]} and ${numbers[after]}` : '';
}

/** Whether two single nodes stand in one column, or in one row. */
const inLine = (own: readonly number[], theirs: readonly number[]): boolean =>
  own.length === 1 && theirs.length === 1 && own[0] === theirs[0];

/**
 * Whether two stretches along one axis lie beside each other: they share at least half of the
 * shorter one. A node that only reaches a few units past the corner of a zone is not level
 * with it to the eye, and saying so would put it in the wrong place.
 */
const alongside = (a: number, aSize: number, b: number, bSize: number): boolean =>
  Math.min(a + aSize, b + bSize) - Math.max(a, b) >= Math.min(aSize, bSize) / 2;
const sharesRows = (a: Rect, b: Rect): boolean => alongside(a.y, a.height, b.y, b.height);
const sharesColumns = (a: Rect, b: Rect): boolean => alongside(a.x, a.width, b.x, b.width);

/** Where a piece is, told by the nearest piece on each side of it. */
function beside(piece: Piece, pieces: readonly Piece[]): string {
  const { rect } = piece;
  const others = pieces.filter((other) => other !== piece);
  const nearest = (found: readonly Piece[], gap: (other: Rect) => number): Piece | undefined =>
    [...found].sort((a, b) => gap(a.rect) - gap(b.rect))[0];
  const level = others.filter((o) => sharesRows(rect, o.rect));
  const upright = others.filter((o) => sharesColumns(rect, o.rect));
  const left = nearest(
    level.filter((o) => o.rect.x + o.rect.width <= rect.x + SAME),
    (o) => rect.x - (o.x + o.width),
  );
  const right = nearest(
    level.filter((o) => o.rect.x >= rect.x + rect.width - SAME),
    (o) => o.x - (rect.x + rect.width),
  );
  const above = nearest(
    upright.filter((o) => o.rect.y + o.rect.height <= rect.y + SAME),
    (o) => rect.y - (o.y + o.height),
  );
  const below = nearest(
    upright.filter((o) => o.rect.y >= rect.y + rect.height - SAME),
    (o) => o.y - (rect.y + rect.height),
  );
  // Beside a zone, which of its rows or columns the piece meets; beside a node, whether the
  // two stand in line. That is what "right of" leaves open: at which height.
  const sideways = (other: Piece, words: string) =>
    other.grid
      ? `${words} ${other.name}${meets(piece.ys, other.grid.ys, other.grid.rows, 'row', 'level with')}`
      : `${words} ${other.name}${inLine(piece.ys, other.ys) ? ', level' : ''}`;
  const upDown = (other: Piece, words: string, meeting: string) =>
    other.grid
      ? `${words} ${other.name}${meets(piece.xs, other.grid.xs, other.grid.columns, 'column', meeting)}`
      : `${inLine(piece.xs, other.xs) ? 'straight ' : ''}${words} ${other.name}`;
  const told = [
    left && sideways(left, 'right of'),
    right && sideways(right, 'left of'),
    above && upDown(above, 'below', 'under'),
    below && upDown(below, 'above', 'over'),
  ].filter((phrase): phrase is string => Boolean(phrase));
  if (told.length > 0) return told.join('; ');

  // Nothing is level with it or straight above or below it: the nearest piece, cornerwise.
  const middle = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
  const here = middle(rect);
  const corner = nearest(others, (o) => Math.hypot(middle(o).x - here.x, middle(o).y - here.y));
  if (!corner) return '';
  const there = middle(corner.rect);
  return `${here.y < there.y ? 'above' : 'below'} and ${here.x < there.x ? 'left' : 'right'} of ${corner.name}`;
}

interface Grid {
  size: string;
  lines: string[];
  /** The coordinates of its columns and of its rows, in order. */
  xs: number[];
  ys: number[];
  /** The numbers of those columns and rows among all of the diagram. */
  columns: number[];
  rows: number[];
  columnOf: Map<string, number>;
  rowOf: Map<string, number>;
}

/** The columns and the rows of the whole diagram, as coordinates in order. */
interface Whole {
  xs: readonly number[];
  ys: readonly number[];
}

/**
 * The nodes as a table of their columns and rows. The columns and rows carry their numbers in
 * the whole diagram, counted from the left and from the top, so that two nodes of different
 * tables compare by their numbers: zones placed freely share no columns, but every column has
 * its place in the order of all of them.
 */
function gridOf(
  nodes: readonly DavNode[],
  rects: Readonly<Record<string, Rect>>,
  whole: Whole,
): Grid {
  const placed = nodes.flatMap((node) => {
    const rect = rects[node.id];
    return rect ? [{ node, x: Math.round(rect.x), y: Math.round(rect.y) }] : [];
  });
  const xs = places(placed.map((p) => p.x));
  const ys = places(placed.map((p) => p.y));
  const columns = xs.map((x) => whole.xs.indexOf(x) + 1);
  const rows = ys.map((y) => whole.ys.indexOf(y) + 1);
  const columnOf = new Map(placed.map((p) => [p.node.id, columns[xs.indexOf(p.x)] ?? 0]));
  const rowOf = new Map(placed.map((p) => [p.node.id, rows[ys.indexOf(p.y)] ?? 0]));

  const cells = ys.map((y) =>
    xs.map((x) => {
      const found = placed.find((p) => p.x === x && p.y === y);
      // A hidden node keeps its place, so the place is told, and that nothing shows there yet.
      return found ? `${found.node.id}${found.node.visible ? '' : ' (hidden)'}` : '-';
    }),
  );
  const heads = [
    ['column', ...columns.map(String)],
    ...cells.map((row, i) => [`row ${rows[i]}`, ...row]),
  ];
  const widths = heads[0]?.map((_, i) => Math.max(...heads.map((row) => row[i]?.length ?? 0)));
  const lines = heads.map((row) =>
    row
      .map((cell, i) => cell.padEnd(widths?.[i] ?? 0))
      .join(' | ')
      .trimEnd(),
  );
  return {
    size: `${plural(xs.length, 'column')} x ${plural(ys.length, 'row')}`,
    lines,
    xs,
    ys,
    columns,
    rows,
    columnOf,
    rowOf,
  };
}

/** The lines of the map, without the name of the file. Empty for a diagram without nodes. */
export function layoutMap(doc: DavDocument): string[] {
  if (doc.nodes.length === 0) return [];
  const layout = computeLayout(doc);
  const lines: string[] = [];
  const zones = topLevelGroups(doc.groups);
  const called = (g: DavGroup) => `"${g.label || g.id}"`;
  const everywhere = doc.nodes.flatMap((n) => layout.nodes[n.id] ?? []);
  const whole: Whole = {
    xs: places(everywhere.map((rect) => rect.x)),
    ys: places(everywhere.map((rect) => rect.y)),
  };

  if (zones.length === 0) {
    const grid = gridOf(doc.nodes, layout.nodes, whole);
    lines.push(`no zones, ${grid.size}`, ...grid.lines.map((line) => `  ${line}`));
  } else {
    lines.push(
      `${plural(whole.xs.length, 'column')} x ${plural(whole.ys.length, 'row')} in all, numbered from the left and from the top across the whole diagram`,
    );
    const parents = parentMap(doc.groups);
    const within = (zone: string) =>
      doc.nodes.filter((n) => ancestorIds(parents, n.parentId).includes(zone));
    const pieces: Array<Piece & { zone?: DavGroup }> = [
      ...zones.flatMap((zone) => {
        const rect = layout.groups[zone.id];
        if (!rect) return [];
        const nodes = within(zone.id);
        const grid = nodes.length > 0 ? gridOf(nodes, layout.nodes, whole) : undefined;
        const title = `zone ${called(zone)} (${zone.id})`;
        return [
          { title, name: called(zone), rect, zone, grid, xs: grid?.xs ?? [], ys: grid?.ys ?? [] },
        ];
      }),
      ...doc.nodes
        .filter((n) => n.parentId === undefined)
        .flatMap((n) => {
          const rect = layout.nodes[n.id];
          if (!rect) return [];
          const [x, y] = [Math.round(rect.x), Math.round(rect.y)];
          const title = `node ${n.id}, outside every zone, column ${whole.xs.indexOf(x) + 1}, row ${whole.ys.indexOf(y) + 1}`;
          return [{ title, name: n.id, rect, xs: [x], ys: [y] }];
        }),
    ].sort((a, b) => a.rect.x - b.rect.x || a.rect.y - b.rect.y);

    // The pieces first, from left to right: the whole picture, before what is inside each zone.
    for (const piece of pieces) {
      const where = beside(piece, pieces);
      lines.push(
        `${piece.title}${piece.grid ? `, ${piece.grid.size}` : ''}${where ? `: ${where}` : ''}`,
      );
    }
    for (const piece of pieces) {
      const { grid } = piece;
      if (!piece.zone || !grid) continue;
      lines.push(`nodes of ${piece.name} (${piece.zone.id}):`);
      lines.push(...grid.lines.map((line) => `  ${line}`));
      // A zone inside it, by the part of the table its nodes take.
      for (const inner of doc.groups) {
        if (inner.id === piece.zone.id || !ancestorIds(parents, inner.id).includes(piece.zone.id)) {
          continue;
        }
        const columns = within(inner.id).flatMap((n) => grid.columnOf.get(n.id) ?? []);
        const rows = within(inner.id).flatMap((n) => grid.rowOf.get(n.id) ?? []);
        if (columns.length === 0) continue;
        const outer = doc.groups.find((g) => g.id === inner.parentId);
        const inside = outer && outer.id !== piece.zone.id ? called(outer) : 'it';
        lines.push(
          `  inside ${inside}, zone ${called(inner)} (${inner.id}): ${listed(columns, 'column')}, ${listed(rows, 'row')}`,
        );
      }
    }
  }

  // Each connection, by where its second node lies from its first, on a straight line.
  const zoneOf = zoneOfNodes(doc);
  const zoneCalled = (node: string) => {
    const zone = doc.groups.find((g) => g.id === zoneOf.get(node));
    return zone ? called(zone) : undefined;
  };
  for (const edge of doc.edges) {
    const [segment] = segmentsOf([[edge.from, edge.to]], layout);
    if (edge.from === edge.to || !segment) continue;
    const across = Math.round(segment.bx - segment.ax);
    const down = Math.round(segment.by - segment.ay);
    const sideways = across > 0 ? 'right' : 'left';
    const direction =
      Math.abs(down) < SAME
        ? `${sideways}, level`
        : Math.abs(across) < SAME
          ? `straight ${down > 0 ? 'down' : 'up'}`
          : `${down > 0 ? 'down' : 'up'} and ${sideways}`;
    const [from, to] = [zoneCalled(edge.from), zoneCalled(edge.to)];
    const crossing =
      from === to
        ? ''
        : from && to
          ? `, from ${from} into ${to}`
          : to
            ? `, into ${to}`
            : `, out of ${from}`;
    lines.push(`${edge.from} ${arrowOf(edge)} ${edge.to}: ${direction}${crossing}`);
  }
  return lines;
}

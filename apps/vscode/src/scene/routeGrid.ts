import type { Rect } from '../layout';
import type { Point } from './geometry';
import type { RouteEdge, RouteGroup, RouteNode } from './route';

/** How far beside a node, and beside a zone's border, a line of the grid runs. */
const NODE_MARGIN = 8;
const ZONE_MARGIN = 12;
/** Lines of the grid nearer than this become one. */
const MERGE = 3;
/**
 * How far off the middle of a station a route may meet it, to reach in a straight line a station
 * that is almost level with it or almost straight above it.
 */
export const PORT_REACH = 12;

/** The lines a node's links may meet it on. */
export interface Ports {
  xs: Set<number>;
  ys: Set<number>;
}

/**
 * What is known of every stretch that runs one way: level, or upright. A stretch is the piece
 * of a line between two neighboring crossings, and has the number of the crossing it starts at:
 * the one on its left if it is level, the one above it if it is upright.
 */
export interface Lane {
  /**
   * Who closes the stretch: nobody (-1), everybody (-2: a wall, or two nodes at once), or the
   * node it lies in, which lets in only its own links.
   */
  block: Int32Array;
  /** 1 where a node lets its own links in: on one of the lines of its ports. */
  door: Uint8Array;
  /** The innermost zone around the stretch, or -1. */
  zone: Int16Array;
  /** How many routes run on the stretch so far. */
  use: Uint8Array;
}

/**
 * The lines routes run on, and their crossings. Crossing `p` is in column `p % W` and row
 * `(p / W) | 0`, so the next one to its right is `p + 1` and the next one below it `p + W`.
 */
export interface Grid {
  xs: number[];
  ys: number[];
  W: number;
  H: number;
  level: Lane;
  upright: Lane;
  ports: Ports[];
  xIndex: Map<number, number>;
  yIndex: Map<number, number>;
}

export const stationCenter = (n: RouteNode): Point => ({
  x: n.station.x + n.station.width / 2,
  y: n.station.y + n.station.height / 2,
});

export const pointOf = (grid: Grid, p: number): Point => ({
  x: grid.xs[p % grid.W] as number,
  y: grid.ys[(p / grid.W) | 0] as number,
});

/** The stretch between two neighboring crossings, as a key: `h` level, `v` upright. */
export const stretchKey = (p: number, q: number): string =>
  `${Math.abs(p - q) === 1 ? 'h' : 'v'}${Math.min(p, q)}`;

type Mark = [at: number, throughStation: boolean];

/** Sorted lines of the grid; a line through a station is kept as it is. */
function gridLines(marks: Mark[]): number[] {
  marks.sort((a, b) => a[0] - b[0]);
  const out: Mark[] = [];
  for (const mark of marks) {
    const last = out[out.length - 1];
    if (!last || mark[0] - last[0] >= MERGE) out.push(mark);
    else if (mark[1] && !last[1]) out[out.length - 1] = mark;
    else if (mark[1] && last[1] && mark[0] !== last[0]) out.push(mark);
  }
  return out.map((m) => m[0]);
}

/** A line through every station, beside every node, on both sides of every zone's border. */
function linesOf(
  nodes: readonly RouteNode[],
  groups: readonly RouteGroup[],
  walls: readonly Rect[],
): { xs: number[]; ys: number[] } {
  const xMarks: Mark[] = [];
  const yMarks: Mark[] = [];
  for (const n of nodes) {
    const c = stationCenter(n);
    xMarks.push(
      [c.x, true],
      [n.area.x - NODE_MARGIN, false],
      [n.area.x + n.area.width + NODE_MARGIN, false],
    );
    yMarks.push(
      [c.y, true],
      [n.area.y - NODE_MARGIN, false],
      [n.area.y + n.area.height + NODE_MARGIN, false],
    );
  }
  for (const g of groups) {
    for (const side of [-ZONE_MARGIN, ZONE_MARGIN]) {
      xMarks.push([g.rect.x + side, false], [g.rect.x + g.rect.width + side, false]);
      yMarks.push([g.rect.y + side, false], [g.rect.y + g.rect.height + side, false]);
    }
  }
  for (const w of walls) {
    xMarks.push([w.x + w.width + 4, false]);
    yMarks.push([w.y + w.height + 4, false]);
  }
  return { xs: gridLines(xMarks), ys: gridLines(yMarks) };
}

/**
 * The lines a node's links may meet it on: those through the middle of its station, and those
 * through a linked station that is only a little off them.
 */
function portsOf(nodes: readonly RouteNode[], edges: readonly RouteEdge[]): Ports[] {
  const ports: Ports[] = nodes.map((n) => {
    const c = stationCenter(n);
    return { xs: new Set([c.x]), ys: new Set([c.y]) };
  });
  for (const e of edges) {
    const a = stationCenter(nodes[e.from] as RouteNode);
    const b = stationCenter(nodes[e.to] as RouteNode);
    if (a.y !== b.y && Math.abs(a.y - b.y) <= PORT_REACH) {
      ports[e.from]?.ys.add(b.y);
      ports[e.to]?.ys.add(a.y);
    }
    if (a.x !== b.x && Math.abs(a.x - b.x) <= PORT_REACH) {
      ports[e.from]?.xs.add(b.x);
      ports[e.to]?.xs.add(a.x);
    }
  }
  return ports;
}

function closeStretch(lane: Lane, i: number, who: number, door: boolean): void {
  if (lane.block[i] === -1) {
    lane.block[i] = who;
    lane.door[i] = door ? 1 : 0;
  } else if (lane.block[i] !== who) lane.block[i] = -2;
}

/**
 * Closes every stretch inside `box`: to all routes (`who` -2), or to all but a node's own,
 * which may enter along the lines of `own`.
 */
function close(grid: Grid, box: Rect, who: number, own?: Ports): void {
  const { xs, ys, W, H } = grid;
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  for (let iy = 0; iy < H; iy++) {
    const y = ys[iy] as number;
    for (let ix = 0; ix < W; ix++) {
      const x = xs[ix] as number;
      const i = iy * W + ix;
      if (ix < W - 1 && y > box.y && y < bottom && (xs[ix + 1] as number) > box.x && x < right) {
        closeStretch(grid.level, i, who, own?.ys.has(y) ?? false);
      }
      if (iy < H - 1 && x > box.x && x < right && (ys[iy + 1] as number) > box.y && y < bottom) {
        closeStretch(grid.upright, i, who, own?.xs.has(x) ?? false);
      }
    }
  }
}

/** Notes the innermost zone around each stretch: deeper zones are written last. */
function markZones(grid: Grid, groups: readonly RouteGroup[]): void {
  const { xs, ys, W, H } = grid;
  const inside = (r: Rect, x: number, y: number) =>
    x > r.x && x < r.x + r.width && y > r.y && y < r.y + r.height;
  const outermostFirst = groups
    .map((_, i) => i)
    .sort((a, b) => (groups[a]?.depth ?? 0) - (groups[b]?.depth ?? 0));
  for (const k of outermostFirst) {
    const rect = (groups[k] as RouteGroup).rect;
    for (let iy = 0; iy < H; iy++) {
      for (let ix = 0; ix < W; ix++) {
        const x = xs[ix] as number;
        const y = ys[iy] as number;
        const i = iy * W + ix;
        if (ix < W - 1 && inside(rect, (x + (xs[ix + 1] as number)) / 2, y)) grid.level.zone[i] = k;
        if (iy < H - 1 && inside(rect, x, (y + (ys[iy + 1] as number)) / 2)) {
          grid.upright.zone[i] = k;
        }
      }
    }
  }
}

const lane = (size: number): Lane => ({
  block: new Int32Array(size).fill(-1),
  door: new Uint8Array(size),
  zone: new Int16Array(size).fill(-1),
  use: new Uint8Array(size),
});

/** The grid for a diagram, with what closes each stretch and which zone it lies in. */
export function buildGrid(
  nodes: readonly RouteNode[],
  groups: readonly RouteGroup[],
  walls: readonly Rect[],
  edges: readonly RouteEdge[],
): Grid {
  const { xs, ys } = linesOf(nodes, groups, walls);
  const size = xs.length * ys.length;
  const grid: Grid = {
    xs,
    ys,
    W: xs.length,
    H: ys.length,
    level: lane(size),
    upright: lane(size),
    ports: portsOf(nodes, edges),
    xIndex: new Map(xs.map((x, i) => [x, i])),
    yIndex: new Map(ys.map((y, i) => [y, i])),
  };
  nodes.forEach((n, k) => {
    close(grid, n.area, k, grid.ports[k]);
  });
  for (const w of walls) close(grid, w, -2);
  markZones(grid, groups);
  return grid;
}

/** Notes that a route runs on every stretch of `path`, which makes them dearer for the next. */
export function occupy(grid: Grid, path: readonly number[]): void {
  for (let i = 0; i + 1 < path.length; i++) {
    const p = path[i] as number;
    const q = path[i + 1] as number;
    const { use } = Math.abs(p - q) === 1 ? grid.level : grid.upright;
    const stretch = Math.min(p, q);
    use[stretch] = Math.min(255, (use[stretch] as number) + 1);
  }
}

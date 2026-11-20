import type { Rect } from '../layout';
import type { Point } from './geometry';
import type { RouteEdge, RouteGroup, RouteNode } from './route';

/** How far beside a node, beside its wider label block, and beside a zone's border, a line of the grid runs. */
const NODE_MARGIN = 8;
const LABEL_MARGIN = 12;
const ZONE_MARGIN = 12;
/** Parallel distance below which a track is treated as hugging a zone border. */
const BORDER_CLEARANCE = 5;
/** How wide a rail is drawn: `.dav-rail` in `runtime/scene.css` has to say the same. */
export const RAIL_WIDTH = 3;
/** Distance between two routes that run on one line. */
export const RAIL_GAP = 7;
/**
 * Lines of the grid nearer than this become one: two lines nearer than rails are set apart
 * would be drawn as one anyway, and every line costs each search time.
 */
const MERGE = RAIL_GAP;
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
  /** Indices of the routes currently using each stretch (lazily created per occupied stretch). */
  routes: Array<number[] | undefined>;
  /** 1 where a level stretch runs through the room above a station that its badge is written in. */
  badge: Uint8Array;
  /** 1 where a stretch runs parallel to and within `BORDER_CLEARANCE` of any zone border segment. */
  border: Uint8Array;
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
  /** How many routes pass each crossing: asked before `vertexRoutes`, which is slow to read where empty. */
  vertexUse: Uint8Array;
  /**
   * The routes that pass each crossing, one number each: the route, the heading it came
   * with and the heading it left with, as `passage` packs them. A route's two ends are not in it.
   */
  vertexRoutes: Array<number[] | undefined>;
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
  // Add evenly spaced interior tracks across wide gaps so unrelated rails do not all stack on border lines.
  const coords = out.map((m) => m[0]);
  const expanded: number[] = [];
  for (let i = 0; i < coords.length; i++) {
    const a = coords[i] as number;
    expanded.push(a);
    const b = coords[i + 1];
    if (b === undefined) continue;
    const gap = b - a;
    if (gap >= 36) {
      const count = gap >= 64 ? 2 : 1;
      const step = gap / (count + 1);
      for (let k = 1; k <= count; k++) expanded.push(a + step * k);
    }
  }
  return expanded;
}

/**
 * A line through every station, beside every node (including wide labels), above the room of
 * every badge, on both sides of every zone's border, and on all four sides of every wall.
 */
function linesOf(
  nodes: readonly RouteNode[],
  groups: readonly RouteGroup[],
  walls: readonly Rect[],
  ports: readonly Ports[],
): { xs: number[]; ys: number[] } {
  const xMarks: Mark[] = [];
  const yMarks: Mark[] = [];
  nodes.forEach((n, k) => {
    if (n.groupBorder) {
      const r = n.groupBorder;
      // Keep the group endpoint's exact border coordinates as guaranteed grid lines for border doors.
      xMarks.push([r.x, true], [r.x + r.width, true], [r.x + r.width / 2, false]);
      yMarks.push([r.y, true], [r.y + r.height, true], [r.y + r.height / 2, false]);
      return;
    }
    const c = stationCenter(n);
    for (const x of ports[k]?.xs ?? [c.x]) xMarks.push([x, true]);
    for (const y of ports[k]?.ys ?? [c.y]) yMarks.push([y, true]);
    xMarks.push([n.area.x - NODE_MARGIN, false], [n.area.x + n.area.width + NODE_MARGIN, false]);
    if (n.labelArea) {
      xMarks.push(
        [n.labelArea.x - LABEL_MARGIN, false],
        [n.labelArea.x + n.labelArea.width + LABEL_MARGIN, false],
      );
    }
    yMarks.push(
      [n.badge.y, false],
      [n.area.y - NODE_MARGIN, false],
      [n.area.y + n.area.height + NODE_MARGIN, false],
    );
  });
  for (const g of groups) {
    for (const side of [-ZONE_MARGIN, ZONE_MARGIN]) {
      xMarks.push([g.rect.x + side, false], [g.rect.x + g.rect.width + side, false]);
      yMarks.push([g.rect.y + side, false], [g.rect.y + g.rect.height + side, false]);
    }
  }
  // Add midpoints between nested parallel borders (12..24px apart, e.g. GROUP_PADDING = 16)
  // so corridors between nested frames have a centered border-clear track.
  const addBorderMidpoints = (coords: number[], marks: Mark[]) => {
    const uniq = [...new Set(coords)].sort((a, b) => a - b);
    for (let i = 0; i + 1 < uniq.length; i++) {
      const a = uniq[i] as number;
      const b = uniq[i + 1] as number;
      const d = b - a;
      if (d >= BORDER_CLEARANCE * 2 + 2 && d <= ZONE_MARGIN * 2) {
        marks.push([(a + b) / 2, false]);
      }
    }
  };
  addBorderMidpoints(
    groups.flatMap((g) => [g.rect.x, g.rect.x + g.rect.width]),
    xMarks,
  );
  addBorderMidpoints(
    groups.flatMap((g) => [g.rect.y, g.rect.y + g.rect.height]),
    yMarks,
  );
  for (const w of walls) {
    xMarks.push([w.x - 6, false], [w.x + w.width + 6, false]);
    yMarks.push([w.y - 6, false], [w.y + w.height + 6, false]);
  }
  return { xs: gridLines(xMarks), ys: gridLines(yMarks) };
}

/**
 * The lines a node's links may meet it on: those through the middle of its station, those
 * through a linked station that is only a little off them, and off-center vertical ports when
 * a wall (such as a zone label) sits over the node's centerline above the station.
 */
function portsOf(
  nodes: readonly RouteNode[],
  edges: readonly RouteEdge[],
  walls: readonly Rect[],
): Ports[] {
  const ports: Ports[] = nodes.map((n) => {
    if (n.groupBorder) return { xs: new Set(), ys: new Set() };
    const c = stationCenter(n);
    const xs = new Set([c.x]);
    const overhead = walls.filter(
      (w) => w.y + w.height + 4 <= n.station.y && n.station.y - (w.y + w.height) <= 120,
    );
    if (overhead.some((w) => c.x > w.x - 4 && c.x < w.x + w.width + 4)) {
      for (const side of [
        [-10, -11],
        [10, 11],
      ]) {
        for (const offset of side) {
          const px = c.x + offset;
          if (!overhead.some((w) => px > w.x - 4 && px < w.x + w.width + 4)) {
            xs.add(px);
            break;
          }
        }
      }
    }
    return { xs, ys: new Set([c.y]) };
  });
  for (const e of edges) {
    const na = nodes[e.from] as RouteNode;
    const nb = nodes[e.to] as RouteNode;
    if (na.groupBorder || nb.groupBorder) continue;
    const a = stationCenter(na);
    const b = stationCenter(nb);
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

/** The first of the sorted `values` that is greater than `value`; their number when none is. */
function firstAbove(values: readonly number[], value: number): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((values[mid] as number) <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function closeStretch(lane: Lane, i: number, who: number, door: boolean): void {
  if (lane.block[i] === -1) {
    lane.block[i] = who;
    lane.door[i] = door ? 1 : 0;
  } else if (lane.block[i] !== who) lane.block[i] = -2;
}

/**
 * Closes every stretch inside `box`: to all routes (`who` -2), or to all but a node's own,
 * which may enter along the lines of `own`. When `skipLines` is given, stretches sitting on a
 * station's centerline are left untouched so wall padding never seals off a station port.
 */
function close(
  grid: Grid,
  box: Rect,
  who: number,
  own?: Ports,
  skipLines?: { xs: ReadonlySet<number>; ys: ReadonlySet<number> },
): void {
  const { xs, ys, W, H } = grid;
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  // Only the stretches that reach into the box: the one before its first line counts too.
  const firstX = Math.max(0, firstAbove(xs, box.x) - 1);
  for (let iy = Math.max(0, firstAbove(ys, box.y) - 1); iy < H; iy++) {
    const y = ys[iy] as number;
    if (y >= bottom) break;
    const skipLevel = skipLines?.ys.has(y) ?? false;
    for (let ix = firstX; ix < W; ix++) {
      const x = xs[ix] as number;
      if (x >= right) break;
      const i = iy * W + ix;
      if (
        !skipLevel &&
        ix < W - 1 &&
        y > box.y &&
        y < bottom &&
        (xs[ix + 1] as number) > box.x &&
        x < right
      ) {
        closeStretch(grid.level, i, who, own?.ys.has(y) ?? false);
      }
      if (
        !(skipLines?.xs.has(x) ?? false) &&
        iy < H - 1 &&
        x > box.x &&
        x < right &&
        (ys[iy + 1] as number) > box.y &&
        y < bottom
      ) {
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
    const firstX = Math.max(0, firstAbove(xs, rect.x) - 1);
    for (let iy = Math.max(0, firstAbove(ys, rect.y) - 1); iy < H; iy++) {
      const y = ys[iy] as number;
      if (y >= rect.y + rect.height) break;
      for (let ix = firstX; ix < W; ix++) {
        const x = xs[ix] as number;
        if (x >= rect.x + rect.width) break;
        const i = iy * W + ix;
        if (ix < W - 1 && inside(rect, (x + (xs[ix + 1] as number)) / 2, y)) grid.level.zone[i] = k;
        if (iy < H - 1 && inside(rect, x, (y + (ys[iy + 1] as number)) / 2)) {
          grid.upright.zone[i] = k;
        }
      }
    }
  }
}

/** Notes the level stretches a badge would be written over. */
function markBadges(grid: Grid, nodes: readonly RouteNode[]): void {
  const { xs, ys, W, H } = grid;
  for (const { badge, groupBorder } of nodes) {
    if (groupBorder) continue;
    const right = badge.x + badge.width;
    const bottom = badge.y + badge.height;
    const firstX = Math.max(0, firstAbove(xs, badge.x) - 1);
    for (let iy = firstAbove(ys, badge.y); iy < H; iy++) {
      const y = ys[iy] as number;
      if (y >= bottom) break;
      for (let ix = firstX; ix < W - 1; ix++) {
        if ((xs[ix] as number) >= right) break;
        if ((xs[ix + 1] as number) > badge.x && (xs[ix] as number) < right) {
          grid.level.badge[iy * W + ix] = 1;
        }
      }
    }
  }
}

/** Marks stretches running parallel to and within `BORDER_CLEARANCE` of any group's border. */
function markBorders(grid: Grid, groups: readonly RouteGroup[]): void {
  const { xs, ys, W, H } = grid;
  for (const { rect } of groups) {
    const right = rect.x + rect.width;
    const bottom = rect.y + rect.height;
    // Horizontal top and bottom borders affect level stretches overlapping [rect.x, right].
    const firstX = Math.max(0, firstAbove(xs, rect.x) - 1);
    for (const borderY of [rect.y, bottom]) {
      for (let iy = Math.max(0, firstAbove(ys, borderY - BORDER_CLEARANCE - 1)); iy < H; iy++) {
        const y = ys[iy] as number;
        if (y >= borderY + BORDER_CLEARANCE) break;
        if (Math.abs(y - borderY) >= BORDER_CLEARANCE) continue;
        for (let ix = firstX; ix < W - 1; ix++) {
          const x = xs[ix] as number;
          if (x >= right) break;
          if ((xs[ix + 1] as number) > rect.x) {
            grid.level.border[iy * W + ix] = 1;
          }
        }
      }
    }
    // Vertical left and right borders affect upright stretches overlapping [rect.y, bottom].
    const firstY = Math.max(0, firstAbove(ys, rect.y) - 1);
    for (const borderX of [rect.x, right]) {
      for (let ix = Math.max(0, firstAbove(xs, borderX - BORDER_CLEARANCE - 1)); ix < W; ix++) {
        const x = xs[ix] as number;
        if (x >= borderX + BORDER_CLEARANCE) break;
        if (Math.abs(x - borderX) >= BORDER_CLEARANCE) continue;
        for (let iy = firstY; iy < H - 1; iy++) {
          const y = ys[iy] as number;
          if (y >= bottom) break;
          if ((ys[iy + 1] as number) > rect.y) {
            grid.upright.border[iy * W + ix] = 1;
          }
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
  routes: new Array(size),
  badge: new Uint8Array(size),
  border: new Uint8Array(size),
});

/** The grid for a diagram, with what closes each stretch and which zone it lies in. */
export function buildGrid(
  nodes: readonly RouteNode[],
  groups: readonly RouteGroup[],
  walls: readonly Rect[],
  edges: readonly RouteEdge[],
): Grid {
  const ports = portsOf(nodes, edges, walls);
  const { xs, ys } = linesOf(nodes, groups, walls, ports);
  const size = xs.length * ys.length;
  const grid: Grid = {
    xs,
    ys,
    W: xs.length,
    H: ys.length,
    level: lane(size),
    upright: lane(size),
    vertexUse: new Uint8Array(size),
    vertexRoutes: new Array(size),
    ports,
    xIndex: new Map(xs.map((x, i) => [x, i])),
    yIndex: new Map(ys.map((y, i) => [y, i])),
  };
  nodes.forEach((n, k) => {
    if (n.groupBorder) return;
    close(grid, n.area, k, grid.ports[k]);
    if (n.labelArea) close(grid, n.labelArea, k, grid.ports[k]);
  });
  const stationLines = {
    xs: new Set(nodes.filter((n) => !n.groupBorder).map((n) => stationCenter(n).x)),
    ys: new Set(nodes.filter((n) => !n.groupBorder).map((n) => stationCenter(n).y)),
  };
  for (const w of walls) {
    close(grid, w, -2);
    close(
      grid,
      { x: w.x - 4, y: w.y - 4, width: w.width + 8, height: w.height + 8 },
      -2,
      undefined,
      stationLines,
    );
  }
  markZones(grid, groups);
  markBadges(grid, nodes);
  markBorders(grid, groups);
  return grid;
}

/** The heading of the step from crossing `p` to its neighbor `q`: right 0, down 1, left 2, up 3. */
export const headingOf = (p: number, q: number, W: number): number =>
  q - p === 1 ? 0 : q - p === W ? 1 : q - p === -1 ? 2 : 3;

/** A route's way through a crossing: the heading it comes with and the heading it leaves with. */
export const passage = (route: number, into: number, out: number): number =>
  (route << 4) | (into << 2) | out;

/**
 * On which side of someone heading `forward` an arm of a crossing lies: -1 left, 1 right, 0
 * straight on or straight behind.
 */
const sideOf = (arm: number, forward: number): number =>
  arm === forward || arm === ((forward + 2) & 3) ? 0 : arm === ((forward + 3) & 3) ? -1 : 1;

/**
 * Whether a route crosses another one at a crossing it comes to heading `d` and leaves heading
 * `nd`, where `other` is the other route's passage through that crossing.
 *
 * Two routes that both go straight through cross there. Two that run on together do not, yet:
 * that is asked where they part. And two that part here after running together cross if they
 * are not on the same sides of each other as where they met: one that joined from the left and
 * leaves to the right has to get across. `earlier` gives the route's way back from the
 * crossing, one step a call: the crossing before, times four, plus the heading it was reached
 * with; -1 when there is none.
 */
export function crossesAt(
  vertexRoutes: Grid['vertexRoutes'],
  other: number,
  d: number,
  nd: number,
  earlier: () => number,
): boolean {
  const back = (d + 2) & 3;
  const otherBack = (((other >> 2) & 3) + 2) & 3;
  const otherOn = other & 3;
  if (nd === otherBack || nd === otherOn) return false;
  if (back !== otherBack && back !== otherOn) {
    return otherOn === ((otherBack + 2) & 3) && nd === ((back + 2) & 3);
  }
  const route = other >> 4;
  const parting = sideOf(nd, d) - sideOf(otherBack === back ? otherOn : otherBack, d);
  let forward = d;
  for (let step = earlier(); step !== -1; step = earlier()) {
    const list = vertexRoutes[step >> 2];
    let there = -1;
    if (list) {
      for (let k = 0; k < list.length; k++) {
        if ((list[k] as number) >> 4 === route) {
          there = list[k] as number;
          break;
        }
      }
    }
    // The other route starts or ends here, at its station: nothing to cross.
    if (there < 0) return false;
    const into = step & 3;
    const cameFrom = (into + 2) & 3;
    const thereBack = (((there >> 2) & 3) + 2) & 3;
    const otherFrom = thereBack === forward ? there & 3 : thereBack;
    if (cameFrom !== otherFrom) {
      return (
        Math.sign(sideOf(cameFrom, forward) - sideOf(otherFrom, forward)) !== Math.sign(parting)
      );
    }
    forward = into;
  }
  return false;
}

/** Notes that a route runs on every stretch of `path`, which makes them dearer for the next. */
export function occupy(grid: Grid, path: readonly number[], edgeIndex = -1): void {
  const { W, vertexUse, vertexRoutes } = grid;
  for (let i = 0; i + 1 < path.length; i++) {
    const p = path[i] as number;
    const q = path[i + 1] as number;
    const l = Math.abs(p - q) === 1 ? grid.level : grid.upright;
    const stretch = Math.min(p, q);
    l.use[stretch] = Math.min(255, (l.use[stretch] as number) + 1);
    if (edgeIndex >= 0) {
      const list = l.routes[stretch];
      if (list) list.push(edgeIndex);
      else l.routes[stretch] = [edgeIndex];
      if (i > 0) {
        const prev = path[i - 1] as number;
        const packed = passage(edgeIndex, headingOf(prev, p, W), headingOf(p, q, W));
        const vList = vertexRoutes[p];
        if (vList) vList.push(packed);
        else vertexRoutes[p] = [packed];
        vertexUse[p] = Math.min(255, (vertexUse[p] as number) + 1);
      }
    }
  }
}

/** Removes a route from every stretch of `path` before re-routing it. */
export function unoccupy(grid: Grid, path: readonly number[], edgeIndex: number): void {
  const { vertexUse, vertexRoutes } = grid;
  for (let i = 0; i + 1 < path.length; i++) {
    const p = path[i] as number;
    const q = path[i + 1] as number;
    const l = Math.abs(p - q) === 1 ? grid.level : grid.upright;
    const stretch = Math.min(p, q);
    const list = l.routes[stretch];
    if (list) {
      const idx = list.indexOf(edgeIndex);
      if (idx !== -1) list.splice(idx, 1);
      if (list.length === 0) l.routes[stretch] = undefined;
    }
    if ((l.use[stretch] as number) > 0) {
      l.use[stretch] = (l.use[stretch] as number) - 1;
    }
    if (i > 0) {
      const vList = vertexRoutes[p];
      if (vList) {
        for (let m = vList.length - 1; m >= 0; m--) {
          if ((vList[m] as number) >> 4 === edgeIndex) vList.splice(m, 1);
        }
        vertexUse[p] = Math.min(255, vList.length);
        if (vList.length === 0) vertexRoutes[p] = undefined;
      }
    }
  }
}

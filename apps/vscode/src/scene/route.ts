/**
 * Right-angled routes for rails.
 *
 * Every route runs on a grid made of the lines that pass through each station and beside each
 * node and zone (`routeGrid.ts`). A route is the cheapest way over that grid, where turning,
 * crossing another route, passing through a zone it has nothing to do with, running level
 * through the room of a node's badge and turning right before the node it ends at all cost
 * extra (`routeSearch.ts`). Routes that end up on the same line are then moved apart, so each
 * rail stays a line of its own (`routeSpread.ts`).
 */
import type { Rect } from '../layout';
import type { Point } from './geometry';
import {
  buildGrid,
  crossesAt,
  type Grid,
  headingOf,
  occupy,
  stationCenter,
  unoccupy,
} from './routeGrid';
import { RouteSearch, SHARED_STATION_CROSS } from './routeSearch';
import { apart, cornersOf, sides } from './routeSpread';

export interface RouteNode {
  /** The station symbol: a route starts and ends at its center. */
  station: Rect;
  /** The station with its labels: no other node's route may enter it. */
  area: Rect;
  /** The rendered label rectangle below the station (may be wider than `area`). */
  labelArea?: Rect;
  /** Whether the node carries a self-loop at its upper right. */
  hasLoop?: boolean;
  /** The room above the station that its badge is written in, whenever a step gives it one. */
  badge: Rect;
  /** When present, this endpoint is a group's outer boundary rather than a station node. */
  groupBorder?: Rect;
}
export interface RouteGroup {
  rect: Rect;
  depth: number;
}
export interface RouteEdge {
  id: string;
  from: number;
  to: number;
  /** The zones around either end: passing through any other zone costs extra. */
  home: ReadonlySet<number>;
  /** The rail has an arrowhead at its start too. */
  bothWays?: boolean;
}

export interface RoutedRail {
  /** Start, corners and end. */
  points: Point[];
  /** For each stretch between two points: another route runs beside it. */
  shared: boolean[];
}

const MAX_REROUTE_PASSES = 2;

function pathTurns(path: readonly number[]): number {
  let turns = 0;
  for (let k = 1; k + 1 < path.length; k++) {
    const a = path[k - 1] as number;
    const b = path[k] as number;
    const c = path[k + 1] as number;
    if (b - a !== c - b) turns++;
  }
  return turns;
}

function evaluatePaths(
  paths: ReadonlyMap<string, number[]>,
  grid: Grid,
  edges: readonly RouteEdge[],
  edgeIndex: ReadonlyMap<string, number>,
): { score: number; turnsByEdge: Int32Array; crossingsByEdge: Int32Array } {
  const { xs, ys, W, vertexRoutes } = grid;
  const turnsByEdge = new Int32Array(edges.length);
  const crossingsByEdge = new Int32Array(edges.length);
  let windingCount = 0;
  let totalTurns = 0;
  let totalLength = 0;
  let gridCrossings = 0;

  for (const [id, path] of paths) {
    const idx = edgeIndex.get(id) ?? -1;
    if (idx < 0) continue;
    const h = edges[idx] as RouteEdge;
    const turns = pathTurns(path);
    turnsByEdge[idx] = turns;
    totalTurns += turns;
    if (turns >= 3) windingCount++;
    for (let k = 0; k + 1 < path.length; k++) {
      const p = path[k] as number;
      const q = path[k + 1] as number;
      totalLength +=
        Math.abs((xs[q % W] as number) - (xs[p % W] as number)) +
        Math.abs((ys[(q / W) | 0] as number) - (ys[(p / W) | 0] as number));
      if (k === 0) continue;
      const vList = vertexRoutes[p];
      if (!vList) continue;
      const d = headingOf(path[k - 1] as number, p, W);
      const nd = headingOf(p, q, W);
      // The way back from `p`, for `crossesAt`: the first of the path has no heading it was
      // reached with, and no other route passes it.
      let j = k;
      const earlier = (): number => {
        j--;
        return j >= 1
          ? (path[j] as number) * 4 + headingOf(path[j - 1] as number, path[j] as number, W)
          : -1;
      };
      for (let m = 0; m < vList.length; m++) {
        const entry = vList[m] as number;
        const vi = entry >> 4;
        // A pair is counted once, from the route that comes first.
        if (vi <= idx) continue;
        const v = edges[vi] as RouteEdge;
        // A route between the same two stations runs beside this one, and one that shares a
        // station with it counts for less: see `SHARED_STATION_CROSS`.
        if ((h.from === v.from && h.to === v.to) || (h.from === v.to && h.to === v.from)) continue;
        const shares = h.from === v.from || h.from === v.to || h.to === v.from || h.to === v.to;
        j = k;
        const crossed = crossesAt(vertexRoutes, entry, d, nd, earlier);
        if (crossed) {
          gridCrossings += shares ? SHARED_STATION_CROSS : 1;
          crossingsByEdge[idx] = (crossingsByEdge[idx] ?? 0) + 1;
          crossingsByEdge[vi] = (crossingsByEdge[vi] ?? 0) + 1;
        }
      }
    }
  }

  return {
    score: windingCount * 400 + gridCrossings * 250 + totalTurns * 40 + totalLength * 0.05,
    turnsByEdge,
    crossingsByEdge,
  };
}

export function routeEdges(
  nodes: readonly RouteNode[],
  groups: readonly RouteGroup[],
  walls: readonly Rect[],
  edges: readonly RouteEdge[],
): Map<string, RoutedRail> {
  const grid = buildGrid(nodes, groups, walls, edges);
  const edgeIndex = new Map(edges.map((e, i) => [e.id, i]));
  const search = new RouteSearch(
    grid,
    nodes,
    edges.map((e) => [e.from, e.to] as const),
  );
  const span = (e: RouteEdge): number => {
    const a = stationCenter(nodes[e.from] as RouteNode);
    const b = stationCenter(nodes[e.to] as RouteNode);
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  };
  // Short links first: they have the least room to give way. A link with no way at all gets
  // no route, and is drawn straight.
  let paths = new Map<string, number[]>();
  for (const edge of [...edges].sort((a, b) => span(a) - span(b))) {
    const path = search.find(edge);
    if (!path) continue;
    occupy(grid, path, edgeIndex.get(edge.id) ?? -1);
    search.recordPorts(edge, path);
    paths.set(edge.id, path);
  }

  let current = evaluatePaths(paths, grid, edges, edgeIndex);
  // A search answers the same for as long as no route has changed: `changes` counts the
  // routes that have, and `searchedAt` holds what it was when each link was last searched for.
  let changes = 0;
  const searchedAt = new Int32Array(edges.length).fill(-1);
  for (let pass = 0; pass < MAX_REROUTE_PASSES; pass++) {
    const candidates = edges
      .map((edge, idx) => {
        const turns = current.turnsByEdge[idx] ?? 0;
        const crosses = current.crossingsByEdge[idx] ?? 0;
        return { edge, idx, turns, crosses };
      })
      .filter(({ edge, turns, crosses }) => paths.has(edge.id) && (turns >= 3 || crosses > 0))
      .sort((a, b) => {
        const pa = (a.turns >= 3 ? 1000 : 0) + a.crosses * 300 + a.turns * 40 + span(a.edge);
        const pb = (b.turns >= 3 ? 1000 : 0) + b.crosses * 300 + b.turns * 40 + span(b.edge);
        return pb - pa || a.idx - b.idx;
      });
    if (candidates.length === 0) break;

    const snapshot = new Map(paths);
    for (const { edge, idx } of candidates) {
      const oldPath = paths.get(edge.id);
      if (!oldPath || searchedAt[idx] === changes) continue;
      unoccupy(grid, oldPath, idx);
      search.removePorts(edge, oldPath);
      const nextPath = search.find(edge) ?? oldPath;
      occupy(grid, nextPath, idx);
      search.recordPorts(edge, nextPath);
      paths.set(edge.id, nextPath);
      if (nextPath.length !== oldPath.length || nextPath.some((p, k) => p !== oldPath[k])) {
        changes++;
      }
      searchedAt[idx] = changes;
    }
    const nextEval = evaluatePaths(paths, grid, edges, edgeIndex);
    if (nextEval.score < current.score) {
      current = nextEval;
    } else {
      paths = snapshot;
      break;
    }
  }

  return apart(cornersOf(paths, grid), sides(paths, grid.W), edges, nodes, groups);
}

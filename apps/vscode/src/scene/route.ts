/**
 * Right-angled routes for rails.
 *
 * Every route runs on a grid made of the lines that pass through each station and beside each
 * node and zone (`routeGrid.ts`). A route is the cheapest way over that grid, where turning,
 * crossing another route and passing through a zone it has nothing to do with all cost extra
 * (`routeSearch.ts`). Routes that end up on the same line are then moved apart, so each rail
 * stays a line of its own (`routeSpread.ts`).
 */
import type { Rect } from '../layout';
import type { Point } from './geometry';
import { buildGrid, occupy, stationCenter } from './routeGrid';
import { RouteSearch } from './routeSearch';
import { apart, cornersOf, sides } from './routeSpread';

export interface RouteNode {
  /** The station symbol: a route starts and ends at its center. */
  station: Rect;
  /** The station with its labels: no other node's route may enter it. */
  area: Rect;
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
}

export interface RoutedRail {
  /** Start, corners and end. */
  points: Point[];
  /** For each stretch between two points: another route runs beside it. */
  shared: boolean[];
}

export function routeEdges(
  nodes: readonly RouteNode[],
  groups: readonly RouteGroup[],
  walls: readonly Rect[],
  edges: readonly RouteEdge[],
): Map<string, RoutedRail> {
  const grid = buildGrid(nodes, groups, walls, edges);
  const search = new RouteSearch(grid, nodes);
  const span = (e: RouteEdge): number => {
    const a = stationCenter(nodes[e.from] as RouteNode);
    const b = stationCenter(nodes[e.to] as RouteNode);
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  };
  // Short links first: they have the least room to give way. A link with no way at all gets
  // no route, and is drawn straight.
  const paths = new Map<string, number[]>();
  for (const edge of [...edges].sort((a, b) => span(a) - span(b))) {
    const path = search.find(edge);
    if (!path) continue;
    occupy(grid, path);
    paths.set(edge.id, path);
  }
  return apart(cornersOf(paths, grid), sides(paths, grid.W), edges, nodes);
}

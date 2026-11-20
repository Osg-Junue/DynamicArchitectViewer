import { synthesizedConnections } from '../model/connections';
import type { DavDocument } from '../model/types';
import { topLevelGroups } from '../model/zones';
import { applyBorderMounts } from './borderMount';
import { computeColumnLayout, computeSingleGroupLayout } from './columns';
import { analyzeFlow, flowPairKey } from './flow';
import type { Layout } from './metrics';
import {
  buildRecursiveZoneBlock,
  computeSingleTopRecursiveLayout,
  hasRecursiveNesting,
} from './nestedZone';
import { type BackEdge, computeRanks } from './ranks';
import { straightenNodes } from './straightenNodes';
import { connectedSubdoc, intraZoneFlow } from './zoneBlocks';
import {
  applyZonePlacement,
  hasZonesToPlace,
  linksBetweenZones,
  ownersOf,
  searchZonePlacement,
  structureKey,
  withoutLabels,
  type ZonePlacement,
} from './zoned';

export { countCrossings } from './links';
export {
  type Layout,
  NODE_SIZE,
  type Rect,
  rectContains,
  rectOverlaps,
  STATION_SIZE,
  stationRect,
  WINDOW_SIZE,
} from './metrics';
export type { BackEdge } from './ranks';
export type { ZonePlacement } from './zoned';

/**
 * Computes automatic positions and sizes for every node and group.
 *
 * - Diagrams with `<= 1` top-level group use rank-based column layout (`computeSingleGroupLayout`)
 *   with disconnected components and isolated `deg === 0` blocks partitioned below so isolated
 *   additions cause 0.0-unit drift.
 * - Diagrams with `>= 2` top-level groups place zones via the unified deterministic macro
 *   stage+band skeleton (`searchZonePlacement` -> `applyZonePlacement`), then straighten nodes.
 */
export function computeLayout(doc: DavDocument): Layout {
  if (!hasZonesToPlace(doc)) {
    const base = computeSingleGroupLayout(doc, (subDoc) =>
      hasRecursiveNesting(subDoc)
        ? computeSingleTopRecursiveLayout(subDoc, computeColumnLayout)
        : computeColumnLayout(subDoc),
    );
    return applyBorderMounts(doc, base);
  }
  const placement = zonePlacementOf(doc);
  const placed = placement
    ? applyZonePlacement(doc, placement, computeColumnLayout, buildRecursiveZoneBlock)
    : computeColumnLayout(doc);
  return applyBorderMounts(doc, straightenNodes(doc, placed));
}

/** Whether `computeLayout` places the zones of a diagram freely, rather than in shared columns. */
export function zonesPlacedFreely(doc: DavDocument): boolean {
  return hasZonesToPlace(doc);
}

/** Where the zones are placed freely, searched for first if need be; `undefined` in columns. */
function zonePlacementOf(doc: DavDocument): ZonePlacement | undefined {
  if (!hasZonesToPlace(doc)) return undefined;
  const search = pendingZoneSearch(doc);
  if (search) adoptZonePlan(search.key, searchZones(search.doc));
  return zonePlan?.placement;
}

function findDirectedPath(
  adj: ReadonlyMap<string, readonly string[]>,
  start: string,
  target: string,
): string[] | undefined {
  if (start === target) return [start];
  const prev = new Map<string, string>();
  const visited = new Set<string>([start]);
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    if (cur === undefined) continue;
    for (const next of adj.get(cur) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        prev.set(next, cur);
        if (next === target) {
          const path: string[] = [target];
          for (let p = prev.get(target); p !== undefined; p = prev.get(p)) path.push(p);
          path.reverse();
          return path;
        }
        queue.push(next);
      }
    }
  }
  return undefined;
}

function scopeBackEdges(
  scopeIds: readonly string[],
  forwardEdges: ReadonlyArray<readonly [string, string]>,
  allScopeConns: ReadonlyArray<{
    from: string;
    to: string;
    role?: 'primary' | 'return' | 'static';
  }>,
  rankOverrides?: Readonly<Record<string, number>>,
  rawForwardDirs?: ReadonlyArray<readonly [string, string]>,
): BackEdge[] {
  const base = computeRanks(scopeIds, forwardEdges);
  const known = new Set(scopeIds);
  const effRank = (id: string): number => rankOverrides?.[id] ?? base.rank.get(id) ?? 0;

  const baseBackPairs = new Set(base.back.map((b) => flowPairKey(b.from, b.to)));
  const baseBackDir = new Set(base.back.map((b) => `${b.from}\0${b.to}`));
  const dagAdj = new Map<string, string[]>(scopeIds.map((id) => [id, []]));
  const fwdByPair = new Map<string, readonly [string, string]>();
  const dagFwdByPair = new Map<string, readonly [string, string]>();
  const dagFwdDir = new Set<string>();

  for (const [u, v] of forwardEdges) {
    if (u === v || !known.has(u) || !known.has(v)) continue;
    const pk = flowPairKey(u, v);
    if (!fwdByPair.has(pk)) fwdByPair.set(pk, [u, v]);
    if (!baseBackDir.has(`${u}\0${v}`) && effRank(u) < effRank(v)) {
      dagAdj.get(u)?.push(v);
      dagFwdByPair.set(pk, [u, v]);
      dagFwdDir.add(`${u}\0${v}`);
    }
  }

  let rootOf: Map<string, string> | undefined;
  const getRoot = (target: string): string => {
    if (!rootOf) {
      rootOf = new Map<string, string>();
      for (const r of scopeIds) {
        if (rootOf.has(r)) continue;
        rootOf.set(r, r);
        const q = [r];
        for (let head = 0; head < q.length; head++) {
          const cur = q[head];
          if (cur === undefined) continue;
          for (const nxt of dagAdj.get(cur) ?? []) {
            if (!rootOf.has(nxt)) {
              rootOf.set(nxt, r);
              q.push(nxt);
            }
          }
        }
      }
    }
    return rootOf.get(target) ?? target;
  };

  const out: BackEdge[] = [...base.back];
  const seenPairs = new Set(baseBackPairs);
  const seenDirs = new Set(baseBackDir);
  for (const c of allScopeConns) {
    if (c.from === c.to || !known.has(c.from) || !known.has(c.to)) continue;
    const pk = flowPairKey(c.from, c.to);
    if (seenPairs.has(pk) || dagFwdByPair.has(pk)) continue;
    const [from, to] = fwdByPair.get(pk) ?? [c.from, c.to];
    const path = findDirectedPath(dagAdj, to, from);
    if (path) {
      seenPairs.add(pk);
      seenDirs.add(`${from}\0${to}`);
      out.push({ from, to, loop: path, root: getRoot(to) });
    } else if ((c.role !== 'static' || fwdByPair.has(pk)) && effRank(from) >= effRank(to)) {
      seenPairs.add(pk);
      seenDirs.add(`${from}\0${to}`);
      out.push({ from, to, loop: [to, from], root: getRoot(to) });
    }
  }
  if (rawForwardDirs) {
    for (const [from, to] of rawForwardDirs) {
      const dirKey = `${from}\0${to}`;
      if (
        from === to ||
        !known.has(from) ||
        !known.has(to) ||
        seenDirs.has(dirKey) ||
        dagFwdDir.has(dirKey)
      ) {
        continue;
      }
      const path = findDirectedPath(dagAdj, to, from);
      if (path && path.length >= 2) {
        seenDirs.add(dirKey);
        out.push({ from, to, loop: path, root: getRoot(to) });
      }
    }
  }
  return out;
}

/**
 * The edges that set no column because each closes a loop, in the arrangement `computeLayout`
 * draws. In columns, they are those of the whole diagram. Where the zones are placed freely,
 * each zone is laid out on its own and a link between zones sets no column at all, so they are
 * those of the loops inside each zone.
 */
export function backEdgesOf(doc: DavDocument): BackEdge[] {
  const ids = doc.nodes.map((n) => n.id);
  const connections = synthesizedConnections(doc);
  const rawForwardDirs: Array<readonly [string, string]> = [];
  for (const step of doc.steps) {
    for (const a of step.animations) {
      if (a.direction === 'forward' && a.from !== a.to) rawForwardDirs.push([a.from, a.to]);
    }
    for (const s of step.statics) {
      if (s.direction === 'forward' && s.from !== s.to) rawForwardDirs.push([s.from, s.to]);
    }
  }
  if (!hasZonesToPlace(doc)) {
    const flow = analyzeFlow(doc, connections);
    return scopeBackEdges(ids, flow.forwardEdges, flow.connections, undefined, rawForwardDirs);
  }
  const placement = zonePlacementOf(doc);
  const owners = ownersOf(doc);
  const connDoc = connectedSubdoc(doc);
  const connZoneIds =
    connDoc === doc ? null : new Set(topLevelGroups(connDoc.groups).map((g) => g.id));
  const fullFlow = analyzeFlow(doc, connections);
  const connFlow = connDoc === doc ? fullFlow : analyzeFlow(connDoc);
  return topLevelGroups(doc.groups).flatMap((zone) => {
    const zoneIds = ids.filter((id) => owners.get(id) === zone.id);
    const idSet = new Set(zoneIds);
    const zConns = connections.filter((e) => idSet.has(e.from) && idSet.has(e.to));
    const zDocFlow = connZoneIds === null || connZoneIds.has(zone.id) ? connFlow : fullFlow;
    const localFlow = intraZoneFlow(idSet, zConns, zDocFlow, owners);
    const zRawDirs = rawForwardDirs.filter(([u, v]) => idSet.has(u) && idSet.has(v));
    return scopeBackEdges(
      zoneIds,
      localFlow.forwardEdges,
      localFlow.connections,
      placement?.get(zone.id)?.ranks,
      zRawDirs,
    );
  });
}

/** The last answer: most edits do not change the structure the placement depends on. */
let zonePlan: { key: string; placement: ZonePlacement | undefined } | undefined;

/** A search for where to place the zones of a diagram, to hand to `searchZones`. */
export interface ZoneSearch {
  key: string;
  /**
   * The diagram without labels, so that the layout stays a function of the file alone while
   * typing a label cannot rearrange anything.
   */
  doc: DavDocument;
  /** How many links run between zones: the time the search takes grows with them. */
  links: number;
}

/**
 * The search `computeLayout` would have to run for this diagram before it can answer, which
 * takes a noticeable moment on a large one; `undefined` when it answers at once. A caller that
 * must not wait runs `searchZones` elsewhere and hands the result to `adoptZonePlan`.
 */
export function pendingZoneSearch(doc: DavDocument): ZoneSearch | undefined {
  if (!hasZonesToPlace(doc)) return undefined;
  const key = structureKey(doc);
  if (zonePlan?.key === key) return undefined;
  const bare = withoutLabels(doc);
  return { key, doc: bare, links: linksBetweenZones(bare) };
}

export function adoptZonePlan(key: string, placement: ZonePlacement | undefined): void {
  zonePlan = { key, placement };
}

/** Places the connected top-level zones of a diagram with `>= 2` top-level groups. */
export function searchZones(doc: DavDocument): ZonePlacement | undefined {
  return hasZonesToPlace(doc)
    ? searchZonePlacement(doc, computeColumnLayout, buildRecursiveZoneBlock)
    : undefined;
}

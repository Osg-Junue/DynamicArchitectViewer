import { synthesizedConnections } from '../model/connections';
import type { DavConnection, DavDocument } from '../model/types';
import { parentMap, topLevelGroups, zoneOfNodes } from '../model/zones';
import { idPair } from '../model/zones';

/** Behavioral role of a connection for flow-driven layout and quality scoring. */
export type TransitionRole = 'primary' | 'return' | 'static';

export interface ClassifiedConnection {
  from: string;
  to: string;
  role: TransitionRole;
}

export interface FlowAnalysis {
  /** Synthesized inter-node connections classified by step flow role (`primary` / `return` / `static`). */
  connections: ClassifiedConnection[];
  /** Keyed by unordered node pair (`a|b`) via `flowPairKey`. */
  byPair: Map<string, ClassifiedConnection>;
  /** Forward-oriented acyclic node pairs for column ranking (`primary` + safe `static`). */
  forwardEdges: ReadonlyArray<readonly [string, string]>;
  /** Whether the document (or filtered edge set) contains any animated transitions. */
  hasAnimate: boolean;
  /** Macro stage index (`0..k`) for each top-level block (top-level group or ungrouped node). */
  zoneStage: Map<string, number>;
  /** Top-level zones that serve cross-cutting `static`/monitoring/platform roles across stages. */
  auxiliaryZones: Set<string>;
  /** Directed `fromOwner->toOwner` keys where `primary` forward flow crosses from an upstream zone. */
  primaryZonePairs: Set<string>;
}

export const flowPairKey = (a: string, b: string): string => (a < b ? idPair(a, b) : idPair(b, a));

function blockOwnersOf(doc: Pick<DavDocument, 'groups' | 'nodes'>): {
  owners: Map<string, string>;
  blockOrder: Map<string, number>;
} {
  const zoneOf = zoneOfNodes(doc);
  const topIds = new Set(topLevelGroups(doc.groups).map((g) => g.id));
  const owners = new Map<string, string>();
  const blockOrder = new Map<string, number>();

  for (const g of topLevelGroups(doc.groups)) {
    if (!blockOrder.has(g.id)) blockOrder.set(g.id, blockOrder.size);
  }
  for (const n of doc.nodes) {
    const z = zoneOf.get(n.id);
    const owner = z !== undefined && topIds.has(z) ? z : n.id;
    owners.set(n.id, owner);
    if (!blockOrder.has(owner)) blockOrder.set(owner, blockOrder.size);
  }
  // When running inside a detached single-zone subgraph where `parentMap` has only nested child groups:
  if (topIds.size === 0 && doc.groups.length > 0) {
    const groupParent = parentMap(doc.groups);
    for (const g of doc.groups) {
      if (!g.parentId && !groupParent.get(g.id) && !blockOrder.has(g.id)) {
        blockOrder.set(g.id, blockOrder.size);
      }
    }
  }
  return { owners, blockOrder };
}

function addAdj(adj: Map<string, Set<string>>, from: string, to: string): void {
  let set = adj.get(from);
  if (!set) {
    set = new Set();
    adj.set(from, set);
  }
  set.add(to);
}

function canReach(adj: ReadonlyMap<string, ReadonlySet<string>>, start: string, target: string): boolean {
  if (start === target) return true;
  const visited = new Set<string>([start]);
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    if (cur === undefined) continue;
    for (const next of adj.get(cur) ?? []) {
      if (next === target) return true;
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

/**
 * Traces `doc.steps` chronologically to separate primary forward flows, return/feedback transitions,
 * and `static` structural links, then infers macro zone stages and auxiliary cross-cutting zones.
 */
export function analyzeFlow(
  doc: DavDocument,
  connections: readonly DavConnection[] = synthesizedConnections(doc),
): FlowAnalysis {
  const known = new Set(doc.nodes.map((n) => n.id));
  const { owners, blockOrder } = blockOwnersOf(doc);

  const connByPair = new Map<string, DavConnection>();
  for (const c of connections) {
    if (c.from !== c.to && known.has(c.from) && known.has(c.to)) {
      connByPair.set(flowPairKey(c.from, c.to), c);
    }
  }

  const enteredSeq = new Map<string, number>();
  let seq = 0;
  const markEntered = (id: string) => {
    if (!enteredSeq.has(id)) enteredSeq.set(id, seq++);
  };

  const nodeAdj = new Map<string, Set<string>>();
  const zoneAdj = new Map<string, Set<string>>();
  const byPair = new Map<string, ClassifiedConnection>();
  const primaryEdges: Array<readonly [string, string]> = [];
  let hasAnimate = false;

  const acceptPrimary = (src: string, dst: string) => {
    const key = flowPairKey(src, dst);
    markEntered(src);
    markEntered(dst);
    addAdj(nodeAdj, src, dst);
    const zs = owners.get(src);
    const zd = owners.get(dst);
    if (zs !== undefined && zd !== undefined && zs !== zd && !canReach(zoneAdj, zd, zs)) {
      addAdj(zoneAdj, zs, zd);
    }
    if (!byPair.has(key)) byPair.set(key, { from: src, to: dst, role: 'primary' });
    primaryEdges.push([src, dst]);
  };

  for (const step of doc.steps) {
    for (const a of step.animations) {
      if (a.from === a.to) continue;
      const key = flowPairKey(a.from, a.to);
      if (!connByPair.has(key)) continue;
      hasAnimate = true;

      if (a.direction === 'bidirectional') {
        const uVisited = enteredSeq.has(a.from);
        const vVisited = enteredSeq.has(a.to);
        let src = a.from;
        let dst = a.to;
        if (canReach(nodeAdj, a.to, a.from) && !canReach(nodeAdj, a.from, a.to)) {
          src = a.to;
          dst = a.from;
        } else if (uVisited && vVisited && (enteredSeq.get(a.to) ?? 0) < (enteredSeq.get(a.from) ?? 0)) {
          src = a.to;
          dst = a.from;
        }
        if (canReach(nodeAdj, dst, src)) {
          if (!byPair.has(key)) byPair.set(key, { from: a.from, to: a.to, role: 'return' });
        } else {
          acceptPrimary(src, dst);
        }
        continue;
      }

      const closesNodeCycle = canReach(nodeAdj, a.to, a.from);
      const zu = owners.get(a.from);
      const zv = owners.get(a.to);
      const bothVisited = enteredSeq.has(a.from) && enteredSeq.has(a.to);
      const vEarlier = (enteredSeq.get(a.to) ?? 0) < (enteredSeq.get(a.from) ?? 0);
      const zoneCycle = zu !== undefined && zv !== undefined && zu !== zv && canReach(zoneAdj, zv, zu);

      if (closesNodeCycle || (bothVisited && vEarlier && zoneCycle)) {
        if (!byPair.has(key)) byPair.set(key, { from: a.from, to: a.to, role: 'return' });
      } else {
        acceptPrimary(a.from, a.to);
      }
    }
  }

  // Classify remaining static-only connections and append safe forward edges for ranking.
  const staticConnections: ClassifiedConnection[] = [];
  for (const [key, conn] of connByPair) {
    if (byPair.has(key)) continue;
    const classified: ClassifiedConnection = { from: conn.from, to: conn.to, role: 'static' };
    byPair.set(key, classified);
    staticConnections.push(classified);
  }

  const forwardEdges: Array<readonly [string, string]> = [...primaryEdges];
  if (!hasAnimate) {
    // Purely static diagrams/subgraphs preserve all edges so computeRanks handles cycle breaking naturally.
    for (const c of staticConnections) forwardEdges.push([c.from, c.to]);
  } else {
    for (const c of staticConnections) {
      if (canReach(nodeAdj, c.to, c.from)) continue;
      const zu = owners.get(c.from);
      const zv = owners.get(c.to);
      if (zu !== undefined && zv !== undefined && zu !== zv && canReach(zoneAdj, zv, zu)) {
        continue;
      }
      addAdj(nodeAdj, c.from, c.to);
      forwardEdges.push([c.from, c.to]);
    }
  }

  const allClassified = [...byPair.values()];
  const { zoneStage, auxiliaryZones, primaryZonePairs } = computeMacroZones(
    doc,
    allClassified,
    owners,
    blockOrder,
    zoneAdj,
  );

  return {
    connections: allClassified,
    byPair,
    forwardEdges,
    hasAnimate,
    zoneStage,
    auxiliaryZones,
    primaryZonePairs,
  };
}

function computeMacroZones(
  doc: DavDocument,
  classified: readonly ClassifiedConnection[],
  owners: ReadonlyMap<string, string>,
  blockOrder: ReadonlyMap<string, number>,
  chronZoneAdj: ReadonlyMap<string, ReadonlySet<string>>,
): {
  zoneStage: Map<string, number>;
  auxiliaryZones: Set<string>;
  primaryZonePairs: Set<string>;
} {
  const topIds = new Set(topLevelGroups(doc.groups).map((g) => g.id));
  const blockIds = [...blockOrder.keys()];
  const primaryInter = new Map<string, number>();
  const staticInter = new Map<string, number>();
  const touchPrimary = new Map<string, Set<string>>();
  const touchStatic = new Map<string, Set<string>>();
  const primaryDegree = new Map<string, number>();
  const staticDegree = new Map<string, number>();

  for (const id of blockIds) {
    touchPrimary.set(id, new Set());
    touchStatic.set(id, new Set());
    primaryDegree.set(id, 0);
    staticDegree.set(id, 0);
  }

  // Also count `return` inter-zone connections toward animate vs static share without voting stage direction.
  const animateTouch = new Map<string, number>(blockIds.map((id) => [id, 0]));
  const neighbors = new Map<string, Set<string>>(blockIds.map((id) => [id, new Set()]));
  const directedVotes = new Map<string, number>();

  for (const c of classified) {
    const bu = owners.get(c.from);
    const bv = owners.get(c.to);
    if (!bu || !bv || bu === bv) continue;
    neighbors.get(bu)?.add(bv);
    neighbors.get(bv)?.add(bu);

    const dirKey = idPair(bu, bv);
    if (c.role === 'primary') {
      primaryInter.set(dirKey, (primaryInter.get(dirKey) ?? 0) + 1);
      directedVotes.set(dirKey, (directedVotes.get(dirKey) ?? 0) + 3);
      touchPrimary.get(bu)?.add(bv);
      touchPrimary.get(bv)?.add(bu);
      primaryDegree.set(bu, (primaryDegree.get(bu) ?? 0) + 1);
      primaryDegree.set(bv, (primaryDegree.get(bv) ?? 0) + 1);
      animateTouch.set(bu, (animateTouch.get(bu) ?? 0) + 1);
      animateTouch.set(bv, (animateTouch.get(bv) ?? 0) + 1);
    } else if (c.role === 'return') {
      animateTouch.set(bu, (animateTouch.get(bu) ?? 0) + 1);
      animateTouch.set(bv, (animateTouch.get(bv) ?? 0) + 1);
    } else {
      staticInter.set(dirKey, (staticInter.get(dirKey) ?? 0) + 1);
      directedVotes.set(dirKey, (directedVotes.get(dirKey) ?? 0) + 0.1);
      touchStatic.get(bu)?.add(bv);
      touchStatic.get(bv)?.add(bu);
      staticDegree.set(bu, (staticDegree.get(bu) ?? 0) + 1);
      staticDegree.set(bv, (staticDegree.get(bv) ?? 0) + 1);
    }
  }

  // Auxiliary cross-cutting zones: static-only zones or static-heavy zones spanning >=3 blocks.
  const auxiliaryZones = new Set<string>();
  for (const id of topIds) {
    const anim = animateTouch.get(id) ?? 0;
    const stat = staticDegree.get(id) ?? 0;
    const distinctNbrs = neighbors.get(id)?.size ?? 0;
    if ((anim === 0 && stat > 0 && distinctNbrs >= 2) || (stat > anim && distinctNbrs >= 3)) {
      auxiliaryZones.add(id);
    }
  }

  // Resolve net acyclic inter-block precedence over non-auxiliary pairs first.
  const pairMargin: Array<{ a: string; b: string; weight: number; primary: boolean }> = [];
  const seenPairs = new Set<string>();
  for (const bu of blockIds) {
    for (const bv of blockIds) {
      if (bu >= bv) continue;
      const pk = flowPairKey(bu, bv);
      if (seenPairs.has(pk)) continue;
      seenPairs.add(pk);
      const fwd = directedVotes.get(idPair(bu, bv)) ?? 0;
      const rev = directedVotes.get(idPair(bv, bu)) ?? 0;
      if (fwd === 0 && rev === 0) continue;

      const auxA = auxiliaryZones.has(bu);
      const auxB = auxiliaryZones.has(bv);
      const hasPri = (primaryInter.get(idPair(bu, bv)) ?? 0) + (primaryInter.get(idPair(bv, bu)) ?? 0) > 0;
      let winnerFrom = bu;
      let winnerTo = bv;
      let diff = fwd - rev;
      if (rev > fwd) {
        winnerFrom = bv;
        winnerTo = bu;
        diff = rev - fwd;
      } else if (fwd === rev) {
        const chronFwd = canReach(chronZoneAdj, bu, bv);
        const chronRev = canReach(chronZoneAdj, bv, bu);
        if (chronRev && !chronFwd) {
          winnerFrom = bv;
          winnerTo = bu;
        } else if (!chronFwd && (blockOrder.get(bv) ?? 0) < (blockOrder.get(bu) ?? 0)) {
          winnerFrom = bv;
          winnerTo = bu;
        }
      }
      // Keep non-auxiliary backbone edges highest priority, then static-to-unplaced edges.
      const weight = (auxA || auxB ? 0 : 1000) + (hasPri ? 100 : 0) + diff;
      pairMargin.push({ a: winnerFrom, b: winnerTo, weight, primary: hasPri && !auxA && !auxB });
    }
  }
  pairMargin.sort((x, y) => y.weight - x.weight || (blockOrder.get(x.a) ?? 0) - (blockOrder.get(y.a) ?? 0));

  const dag = new Map<string, string[]>(blockIds.map((id) => [id, []]));
  const reachMap = new Map<string, Set<string>>(blockIds.map((id) => [id, new Set()]));
  const primaryZonePairs = new Set<string>();

  for (const edge of pairMargin) {
    if (canReach(reachMap, edge.b, edge.a)) continue;
    dag.get(edge.a)?.push(edge.b);
    addAdj(reachMap, edge.a, edge.b);
    if (edge.primary) primaryZonePairs.add(idPair(edge.a, edge.b));
  }

  // Longest-path macro stage assignment over non-auxiliary nodes, then position auxiliary zones at barycenter.
  const primaryIds = blockIds.filter((id) => !auxiliaryZones.has(id));
  const indeg = new Map<string, number>(blockIds.map((id) => [id, 0]));
  for (const u of primaryIds) {
    for (const v of dag.get(u) ?? []) {
      if (!auxiliaryZones.has(v)) indeg.set(v, (indeg.get(v) ?? 0) + 1);
    }
  }
  const zoneStage = new Map<string, number>(blockIds.map((id) => [id, 0]));
  const queue = primaryIds.filter((id) => (indeg.get(id) ?? 0) === 0);
  for (let head = 0; head < queue.length; head++) {
    const u = queue[head];
    if (u === undefined) continue;
    for (const v of dag.get(u) ?? []) {
      if (auxiliaryZones.has(v)) continue;
      zoneStage.set(v, Math.max(zoneStage.get(v) ?? 0, (zoneStage.get(u) ?? 0) + 1));
      const next = (indeg.get(v) ?? 0) - 1;
      indeg.set(v, next);
      if (next === 0) queue.push(v);
    }
  }

  for (const aux of auxiliaryZones) {
    const nbrStages = [...(neighbors.get(aux) ?? [])]
      .filter((n) => !auxiliaryZones.has(n))
      .map((n) => zoneStage.get(n) ?? 0);
    if (nbrStages.length > 0) {
      const mean = nbrStages.reduce((a, b) => a + b, 0) / nbrStages.length;
      zoneStage.set(aux, Math.round(mean));
    }
  }

  return { zoneStage, auxiliaryZones, primaryZonePairs };
}

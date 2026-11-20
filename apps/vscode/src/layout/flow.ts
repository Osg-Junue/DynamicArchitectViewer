import { synthesizedConnections } from '../model/connections';
import type { DavConnection, DavDocument, Direction } from '../model/types';
import { idPair, topLevelGroups, zoneOfNodes } from '../model/zones';
import type { Rect } from './metrics';

/** Behavioral role of a connection for flow-driven layout and quality scoring. */
export type TransitionRole = 'primary' | 'return' | 'static';

export interface ClassifiedConnection {
  from: string;
  to: string;
  role: TransitionRole;
  direction: Direction;
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
  /** Earliest connection-bearing step index (`0..activeStepCount-1`) where each unordered node pair (`flowPairKey`) appears. */
  pairFirstStep: ReadonlyMap<string, number>;
  /** Number of steps that contain at least one valid inter-node connection. */
  activeStepCount: number;
}

export const flowPairKey = (a: string, b: string): string => (a < b ? idPair(a, b) : idPair(b, a));

/**
 * Returns true when an auxiliary zone (`firstStep >= 2`) fires a `primary` alert back into a
 * non-auxiliary zone at the same or earlier macro stage; treated as a return/feedback link.
 */
export function isLateAuxAlert(
  conn: Pick<ClassifiedConnection, 'from' | 'to' | 'role'>,
  flow: Pick<FlowAnalysis, 'auxiliaryZones' | 'pairFirstStep' | 'zoneStage'>,
  owners: ReadonlyMap<string, string>,
): boolean {
  if (conn.role !== 'primary') return false;
  const za = owners.get(conn.from) ?? conn.from;
  const zb = owners.get(conn.to) ?? conn.to;
  if (za === zb) return false;
  const firstStep = flow.pairFirstStep.get(flowPairKey(conn.from, conn.to)) ?? 0;
  return (
    flow.auxiliaryZones.has(za) &&
    !flow.auxiliaryZones.has(zb) &&
    firstStep >= 2 &&
    (flow.zoneStage.get(za) ?? 0) >= (flow.zoneStage.get(zb) ?? 0)
  );
}

const compareId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function blockOwnersOf(doc: Pick<DavDocument, 'groups' | 'nodes'>): {
  owners: Map<string, string>;
  blockIds: string[];
} {
  const zoneOf = zoneOfNodes(doc);
  const topIds = new Set(topLevelGroups(doc.groups).map((g) => g.id));
  const owners = new Map<string, string>();
  const idSet = new Set<string>();

  for (const g of topLevelGroups(doc.groups)) {
    idSet.add(g.id);
  }
  for (const n of doc.nodes) {
    const z = zoneOf.get(n.id);
    const owner = z !== undefined && topIds.has(z) ? z : n.id;
    owners.set(n.id, owner);
    idSet.add(owner);
  }
  return { owners, blockIds: [...idSet].sort(compareId) };
}

function addAdj(adj: Map<string, Set<string>>, from: string, to: string): void {
  let set = adj.get(from);
  if (!set) {
    set = new Set();
    adj.set(from, set);
  }
  set.add(to);
}

/** Returns whether `target` is reachable from `start` along directed adjacency `adj`. */
export function canReach(
  adj: ReadonlyMap<string, ReadonlySet<string>>,
  start: string,
  target: string,
): boolean {
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

/** Connected non-self primary zone corridor and the intermediate stages permitted inside it. */
export interface PrimaryCorridor {
  a: string;
  b: string;
  allowed: ReadonlySet<string>;
}

/** Builds inter-zone primary corridors and intermediate stage allowlists for intrusion checks. */
export function primaryCorridors(
  flow: FlowAnalysis,
  owners: ReadonlyMap<string, string>,
): PrimaryCorridor[] {
  const fwdZoneAdj = new Map<string, Set<string>>();
  const connected = new Map<string, readonly [string, string]>();
  for (const c of flow.connections) {
    if (c.role !== 'primary') continue;
    const za = owners.get(c.from) ?? c.from;
    const zb = owners.get(c.to) ?? c.to;
    if (za === zb) continue;
    if (flow.auxiliaryZones.has(za) || flow.auxiliaryZones.has(zb)) continue;
    const pk = flowPairKey(za, zb);
    if (!connected.has(pk)) connected.set(pk, [za, zb]);
    if ((flow.zoneStage.get(za) ?? 0) < (flow.zoneStage.get(zb) ?? 0)) {
      addAdj(fwdZoneAdj, za, zb);
    }
  }

  const allBlocks = [...new Set([...flow.zoneStage.keys(), ...owners.values()])];
  const corridors: PrimaryCorridor[] = [];
  for (const [a, b] of connected.values()) {
    const allowed = new Set<string>();
    for (const zc of allBlocks) {
      if (zc === a || zc === b || flow.auxiliaryZones.has(zc)) continue;
      if (
        (canReach(fwdZoneAdj, a, zc) && canReach(fwdZoneAdj, zc, b)) ||
        (canReach(fwdZoneAdj, b, zc) && canReach(fwdZoneAdj, zc, a))
      ) {
        allowed.add(zc);
      }
    }
    corridors.push({ a, b, allowed });
  }
  return corridors;
}

/** Counts non-intermediate blocks intruding horizontally and vertically in primary zone corridors. */
export function countCorridorIntrusions(
  corridors: readonly PrimaryCorridor[],
  rects: ReadonlyMap<string, Pick<Rect, 'x' | 'y' | 'width' | 'height'>>,
  rowOfBlock?: ReadonlyMap<string, number>,
): number {
  let intrusions = 0;
  for (const { a, b, allowed } of corridors) {
    const rowA = rowOfBlock?.get(a);
    const rowB = rowOfBlock?.get(b);
    if (rowA !== undefined && rowB !== undefined && rowA !== rowB) continue;
    const ra = rects.get(a);
    const rb = rects.get(b);
    if (!ra || !rb) continue;
    const ax = ra.x + ra.width / 2;
    const bx = rb.x + rb.width / 2;
    const minX = Math.min(ax, bx);
    const maxX = Math.max(ax, bx);
    const bandTop = Math.min(ra.y, rb.y);
    const bandBot = Math.max(ra.y + ra.height, rb.y + rb.height);
    for (const [zc, rc] of rects) {
      if (zc === a || zc === b || allowed.has(zc)) continue;
      if (rowOfBlock) {
        const rowC = rowOfBlock.get(zc);
        if (
          rowC !== undefined &&
          ((rowA !== undefined && rowC !== rowA) || (rowB !== undefined && rowC !== rowB))
        ) {
          continue;
        }
      }
      const cx = rc.x + rc.width / 2;
      if (cx > minX && cx < maxX && rc.y < bandBot && rc.y + rc.height > bandTop) {
        intrusions++;
      }
    }
  }
  return intrusions;
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
  const { owners, blockIds } = blockOwnersOf(doc);

  const connByPair = new Map<string, DavConnection>();
  for (const c of connections) {
    if (c.from !== c.to && known.has(c.from) && known.has(c.to)) {
      connByPair.set(flowPairKey(c.from, c.to), c);
    }
  }

  const enteredSeq = new Map<string, number>();
  const enteredZones = new Set<string>();
  const returnReached = new Set<string>();
  let seq = 0;

  const nodeAdj = new Map<string, Set<string>>();
  const zoneAdj = new Map<string, Set<string>>();
  const effectiveNodeAdj = new Map<string, Set<string>>();
  const effectiveZoneAdj = new Map<string, Set<string>>();
  const pendingStatics = new Map<string, string[]>();
  const effectiveEntered = new Set<string>();
  const byPair = new Map<string, ClassifiedConnection>();
  const primaryEdges: Array<readonly [string, string]> = [];
  const seenPrimaryEdges = new Set<string>();
  const pairFirstStep = new Map<string, number>();
  let hasAnimate = false;

  const recordStep = (from: string, to: string, stepIdx: number) => {
    if (from === to || !known.has(from) || !known.has(to)) return;
    const pk = flowPairKey(from, to);
    if (!connByPair.has(pk)) return;
    if (!pairFirstStep.has(pk)) pairFirstStep.set(pk, stepIdx);
  };

  const activateStaticEdge = (from: string, to: string, seen: Set<string>): void => {
    if (!canReach(effectiveNodeAdj, to, from)) {
      addAdj(effectiveNodeAdj, from, to);
    }
    effectiveEntered.add(to);
    const zf = owners.get(from);
    const zt = owners.get(to);
    if (zf !== undefined && zt !== undefined && zf !== zt && !canReach(effectiveZoneAdj, zt, zf)) {
      addAdj(effectiveZoneAdj, zf, zt);
    }
    if (!seen.has(to)) {
      seen.add(to);
      for (const next of pendingStatics.get(to) ?? []) {
        activateStaticEdge(to, next, seen);
      }
    }
  };

  const activateFrom = (id: string): void => {
    const targets = pendingStatics.get(id);
    if (!targets || targets.length === 0) return;
    const seen = new Set<string>([id]);
    for (const to of targets) activateStaticEdge(id, to, seen);
  };

  const markEntered = (id: string) => {
    if (!enteredSeq.has(id)) {
      enteredSeq.set(id, seq++);
      effectiveEntered.add(id);
      const z = owners.get(id);
      if (z !== undefined) enteredZones.add(z);
      activateFrom(id);
    }
  };

  const acceptPrimary = (src: string, dst: string, direction: Direction) => {
    const key = flowPairKey(src, dst);
    if (byPair.has(key)) return;
    if (returnReached.has(src)) returnReached.add(dst);
    else returnReached.delete(dst);
    addAdj(nodeAdj, src, dst);
    addAdj(effectiveNodeAdj, src, dst);
    const zs = owners.get(src);
    const zd = owners.get(dst);
    if (zs !== undefined && zd !== undefined && zs !== zd) {
      if (!canReach(zoneAdj, zd, zs)) addAdj(zoneAdj, zs, zd);
      if (!canReach(effectiveZoneAdj, zd, zs)) addAdj(effectiveZoneAdj, zs, zd);
    }
    markEntered(src);
    markEntered(dst);
    byPair.set(key, { from: src, to: dst, role: 'primary', direction });
    const edgeKey = idPair(src, dst);
    if (!seenPrimaryEdges.has(edgeKey)) {
      seenPrimaryEdges.add(edgeKey);
      primaryEdges.push([src, dst]);
    }
  };

  let activeStepCount = 0;
  for (const step of doc.steps) {
    const hasStepConn =
      step.statics.some((s) => s.from !== s.to && connByPair.has(flowPairKey(s.from, s.to))) ||
      step.animations.some((a) => a.from !== a.to && connByPair.has(flowPairKey(a.from, a.to)));
    if (!hasStepConn) continue;
    const stepIdx = activeStepCount++;
    const stepStaticSources: string[] = [];
    for (const s of step.statics) {
      recordStep(s.from, s.to, stepIdx);
      if (s.from === s.to || s.direction !== 'forward') continue;
      if (!known.has(s.from) || !known.has(s.to)) continue;
      if (!connByPair.has(flowPairKey(s.from, s.to))) continue;
      const list = pendingStatics.get(s.from);
      if (list) list.push(s.to);
      else pendingStatics.set(s.from, [s.to]);
      stepStaticSources.push(s.from);
    }
    for (const src of stepStaticSources) {
      if (effectiveEntered.has(src)) activateFrom(src);
    }

    for (const a of step.animations) {
      if (a.from === a.to) continue;
      const key = flowPairKey(a.from, a.to);
      if (!connByPair.has(key)) continue;
      recordStep(a.from, a.to, stepIdx);
      hasAnimate = true;
      if (byPair.has(key)) continue;

      if (a.direction === 'bidirectional') {
        const zu = owners.get(a.from);
        const zv = owners.get(a.to);
        let src = a.from;
        let dst = a.to;
        if (canReach(effectiveNodeAdj, a.to, a.from) && !canReach(effectiveNodeAdj, a.from, a.to)) {
          src = a.to;
          dst = a.from;
        } else if (
          zu !== undefined &&
          zv !== undefined &&
          zu !== zv &&
          canReach(effectiveZoneAdj, zv, zu) &&
          !canReach(effectiveZoneAdj, zu, zv)
        ) {
          src = a.to;
          dst = a.from;
        }
        const sz = owners.get(src);
        const dz = owners.get(dst);
        const closesNode = canReach(effectiveNodeAdj, dst, src);
        const closesZone =
          sz !== undefined &&
          dz !== undefined &&
          sz !== dz &&
          enteredZones.has(dz) &&
          canReach(effectiveZoneAdj, dz, sz);
        if (closesNode || closesZone) {
          byPair.set(key, { from: a.from, to: a.to, role: 'return', direction: 'bidirectional' });
          if (!enteredSeq.has(dst)) returnReached.add(dst);
        } else {
          acceptPrimary(src, dst, 'bidirectional');
        }
        continue;
      }

      const closesNodeCycle = canReach(effectiveNodeAdj, a.to, a.from);
      const zu = owners.get(a.from);
      const zv = owners.get(a.to);
      const closesZoneCycle =
        zu !== undefined &&
        zv !== undefined &&
        zu !== zv &&
        enteredZones.has(zv) &&
        canReach(effectiveZoneAdj, zv, zu);
      const returnCont = returnReached.has(a.from) && enteredSeq.has(a.to);

      if (closesNodeCycle || closesZoneCycle || returnCont) {
        byPair.set(key, { from: a.from, to: a.to, role: 'return', direction: 'forward' });
        if (!enteredSeq.has(a.to)) returnReached.add(a.to);
      } else {
        acceptPrimary(a.from, a.to, 'forward');
      }
    }
  }

  // Classify remaining static-only connections and append safe forward edges for ranking.
  const staticConnections: ClassifiedConnection[] = [];
  for (const [key, conn] of connByPair) {
    if (byPair.has(key)) continue;
    const classified: ClassifiedConnection = {
      from: conn.from,
      to: conn.to,
      role: 'static',
      direction: conn.direction,
    };
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
    connByPair,
    owners,
    blockIds,
    zoneAdj,
    hasAnimate,
    pairFirstStep,
    activeStepCount,
  );

  return {
    connections: allClassified,
    byPair,
    forwardEdges,
    hasAnimate,
    zoneStage,
    auxiliaryZones,
    primaryZonePairs,
    pairFirstStep,
    activeStepCount,
  };
}

function computeMacroZones(
  doc: DavDocument,
  classified: readonly ClassifiedConnection[],
  connByPair: ReadonlyMap<string, DavConnection>,
  owners: ReadonlyMap<string, string>,
  blockIds: readonly string[],
  chronZoneAdj: ReadonlyMap<string, ReadonlySet<string>>,
  hasAnimate: boolean,
  pairFirstStep: ReadonlyMap<string, number>,
  activeStepCount: number,
): {
  zoneStage: Map<string, number>;
  auxiliaryZones: Set<string>;
  primaryZonePairs: Set<string>;
} {
  const topIds = new Set(topLevelGroups(doc.groups).map((g) => g.id));
  const primaryInter = new Map<string, number>();
  const primaryDegree = new Map<string, number>(blockIds.map((id) => [id, 0]));
  const neighbors = new Map<string, Set<string>>(blockIds.map((id) => [id, new Set()]));
  const directedVotes = new Map<string, number>();
  const pairMinPriStep = new Map<string, number>();
  const zoneNodeCount = new Map<string, number>(blockIds.map((id) => [id, 0]));
  for (const owner of owners.values()) {
    zoneNodeCount.set(owner, (zoneNodeCount.get(owner) ?? 0) + 1);
  }

  // Decay late-step additions symmetrically on multi-step diagrams (weight = 1 when active steps <= 3)
  // so late cross-cutting links cannot flip earlier-established auxiliary roles or stages.
  const multiStep = activeStepCount >= 4;
  const stepDecay = (fs: number): number => (multiStep ? 1 / (1 + 0.12 * Math.max(0, fs - 2)) : 1);

  // Also count `return` inter-zone connections toward animate vs static share without voting stage direction,
  // and track intra-zone connections (`intraTotal`) to distinguish unchained shared-resource bags from stages.
  const animateTouch = new Map<string, number>(blockIds.map((id) => [id, 0]));
  const staticDegree = new Map<string, number>(blockIds.map((id) => [id, 0]));
  const intraTotal = new Map<string, number>(blockIds.map((id) => [id, 0]));

  for (const c of classified) {
    const bu = owners.get(c.from);
    const bv = owners.get(c.to);
    if (!bu || !bv) continue;
    if (bu === bv) {
      intraTotal.set(bu, (intraTotal.get(bu) ?? 0) + 1);
      continue;
    }
    neighbors.get(bu)?.add(bv);
    neighbors.get(bv)?.add(bu);

    const pk = flowPairKey(c.from, c.to);
    const fs = pairFirstStep.get(pk) ?? 0;
    const stepScore = 1 / (1 + 0.05 * fs);
    const w = stepDecay(fs);
    const dirKey = idPair(bu, bv);
    if (c.role === 'primary') {
      primaryInter.set(dirKey, (primaryInter.get(dirKey) ?? 0) + 1);
      directedVotes.set(dirKey, (directedVotes.get(dirKey) ?? 0) + 3 * stepScore);
      const zonePairKey = flowPairKey(bu, bv);
      pairMinPriStep.set(zonePairKey, Math.min(pairMinPriStep.get(zonePairKey) ?? fs, fs));
      primaryDegree.set(bu, (primaryDegree.get(bu) ?? 0) + 1);
      primaryDegree.set(bv, (primaryDegree.get(bv) ?? 0) + 1);
      animateTouch.set(bu, (animateTouch.get(bu) ?? 0) + w);
      animateTouch.set(bv, (animateTouch.get(bv) ?? 0) + w);
    } else if (c.role === 'return') {
      animateTouch.set(bu, (animateTouch.get(bu) ?? 0) + w);
      animateTouch.set(bv, (animateTouch.get(bv) ?? 0) + w);
    } else {
      if (connByPair.get(pk)?.direction !== 'bidirectional') {
        directedVotes.set(dirKey, (directedVotes.get(dirKey) ?? 0) + 0.1 * stepScore);
      }
      staticDegree.set(bu, (staticDegree.get(bu) ?? 0) + w);
      staticDegree.set(bv, (staticDegree.get(bv) ?? 0) + w);
    }
  }

  // Auxiliary cross-cutting zones: zones with no primary inter-zone connections (e.g. static-only
  // monitoring or feedback/return loops), multi-node shared utility bags with zero intra-zone edges
  // (`isSharedBag && stat > anim`), or overwhelmingly static telemetry hubs (`stat > anim * 2`).
  const auxiliaryZones = new Set<string>();
  if (hasAnimate) {
    for (const id of topIds) {
      const priInter = primaryDegree.get(id) ?? 0;
      const anim = animateTouch.get(id) ?? 0;
      const stat = staticDegree.get(id) ?? 0;
      const distinctNbrs = neighbors.get(id)?.size ?? 0;
      const isSharedBag = (zoneNodeCount.get(id) ?? 0) >= 2 && (intraTotal.get(id) ?? 0) === 0;
      const staticHeavy = isSharedBag ? stat > anim : stat > anim * 2;
      if ((priInter === 0 && distinctNbrs >= 2) || (staticHeavy && distinctNbrs >= 3)) {
        auxiliaryZones.add(id);
      }
    }
    if (auxiliaryZones.size > 0) {
      const nonAuxConnected = blockIds.filter(
        (id) => (neighbors.get(id)?.size ?? 0) > 0 && !auxiliaryZones.has(id),
      ).length;
      if (primaryInter.size === 0 || nonAuxConnected < 2) {
        auxiliaryZones.clear();
      }
    }
  }

  // Undirected primary connectivity among non-auxiliary blocks: static-only cross links inside an
  // already primary-connected backbone must not push sibling stages downstream.
  const primaryComponentAdj = new Map<string, Set<string>>(blockIds.map((id) => [id, new Set()]));
  for (const c of classified) {
    if (c.role !== 'primary') continue;
    const bu = owners.get(c.from);
    const bv = owners.get(c.to);
    if (!bu || !bv || bu === bv || auxiliaryZones.has(bu) || auxiliaryZones.has(bv)) continue;
    addAdj(primaryComponentAdj, bu, bv);
    addAdj(primaryComponentAdj, bv, bu);
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
      const hasPri =
        (primaryInter.get(idPair(bu, bv)) ?? 0) + (primaryInter.get(idPair(bv, bu)) ?? 0) > 0;
      if (
        hasAnimate &&
        !auxA &&
        !auxB &&
        !hasPri &&
        (primaryDegree.get(bu) ?? 0) > 0 &&
        (primaryDegree.get(bv) ?? 0) > 0 &&
        canReach(primaryComponentAdj, bu, bv)
      ) {
        continue;
      }
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
        }
      }
      // Keep non-auxiliary early-established primary backbone edges highest priority.
      const priBonus = hasPri ? 100 + 10 / (1 + 0.05 * (pairMinPriStep.get(pk) ?? 0)) : 0;
      const weight = (auxA || auxB ? 0 : 1000) + priBonus + diff;
      pairMargin.push({ a: winnerFrom, b: winnerTo, weight, primary: hasPri && !auxA && !auxB });
    }
  }
  pairMargin.sort((x, y) => y.weight - x.weight || compareId(x.a, y.a) || compareId(x.b, y.b));

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

  // Infer downstream stage for 1-neighbor terminal blocks attached only via unoriented bidirectional `static` links.
  const baseStage = new Map(zoneStage);
  for (const id of primaryIds) {
    if ((indeg.get(id) ?? 0) !== 0 || (dag.get(id)?.length ?? 0) !== 0) continue;
    const nbrs = neighbors.get(id);
    if (!nbrs) continue;
    if (nbrs.size !== 1) continue;
    const [onlyNbr] = nbrs;
    if (!onlyNbr || auxiliaryZones.has(onlyNbr)) continue;
    if ((baseStage.get(onlyNbr) ?? 0) > 0 || compareId(onlyNbr, id) < 0) {
      zoneStage.set(id, (baseStage.get(onlyNbr) ?? 0) + 1);
    }
  }

  const auxNbrMaxWeight = new Map<string, Map<string, number>>();
  for (const c of classified) {
    const bu = owners.get(c.from);
    const bv = owners.get(c.to);
    if (!bu || !bv || bu === bv) continue;
    const fs = pairFirstStep.get(flowPairKey(c.from, c.to)) ?? 0;
    for (const [auxId, nbrId] of [
      [bu, bv],
      [bv, bu],
    ] as const) {
      if (!auxiliaryZones.has(auxId) || auxiliaryZones.has(nbrId)) continue;
      let m = auxNbrMaxWeight.get(auxId);
      if (!m) {
        m = new Map();
        auxNbrMaxWeight.set(auxId, m);
      }
      const w = stepDecay(fs);
      if (w > (m.get(nbrId) ?? 0)) m.set(nbrId, w);
    }
  }
  for (const aux of auxiliaryZones) {
    const nbrWeights = auxNbrMaxWeight.get(aux);
    if (!nbrWeights || nbrWeights.size === 0) continue;
    let sw = 0;
    let sws = 0;
    for (const [n, w] of nbrWeights) {
      sws += (zoneStage.get(n) ?? 0) * w;
      sw += w;
    }
    if (sw > 0) zoneStage.set(aux, Math.round(sws / sw));
  }

  // Stage non-aux blocks that attach solely to auxiliary zones relative to those aux zones.
  for (const id of primaryIds) {
    if ((indeg.get(id) ?? 0) !== 0 || (dag.get(id)?.length ?? 0) !== 0) continue;
    const nbrs = neighbors.get(id);
    if (!nbrs || nbrs.size === 0) continue;
    if ([...nbrs].some((n) => !auxiliaryZones.has(n))) continue;
    const auxIn = [...nbrs].filter((n) => (primaryInter.get(idPair(n, id)) ?? 0) > 0);
    const auxOut = [...nbrs].filter((n) => (primaryInter.get(idPair(id, n)) ?? 0) > 0);
    if (auxIn.length > 0) {
      zoneStage.set(id, Math.max(...auxIn.map((n) => (zoneStage.get(n) ?? 0) + 1)));
    } else if (auxOut.length > 0) {
      zoneStage.set(id, Math.max(0, Math.min(...auxOut.map((n) => (zoneStage.get(n) ?? 0) - 1))));
    } else {
      const stages = [...nbrs].map((n) => zoneStage.get(n) ?? 0);
      zoneStage.set(id, Math.round(stages.reduce((a, b) => a + b, 0) / stages.length));
    }
  }

  return { zoneStage, auxiliaryZones, primaryZonePairs };
}

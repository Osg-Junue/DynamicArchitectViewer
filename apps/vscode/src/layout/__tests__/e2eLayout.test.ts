import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasFatalError, parse } from '../../dsl';
import { synthesizedConnections } from '../../model/connections';
import type { DavDocument, DavNode, IconName } from '../../model/types';
import { topLevelGroups, zoneOfNodes } from '../../model/zones';
import {
  type BackEdge,
  backEdgesOf,
  computeLayout,
  countCrossings,
  type Layout,
  NODE_SIZE,
  type Rect,
  rectContains,
  rectOverlaps,
  STATION_SIZE,
  stationRect,
  WINDOW_SIZE,
  zonesPlacedFreely,
} from '../index';

const EXAMPLES_DIR = resolve(__dirname, '../../../../../examples');
const FIXTURES_DIR = resolve(__dirname, '../../scene/__tests__/fixtures');

function parseValidDoc(dsl: string, options?: { allowWarnings?: boolean }): DavDocument {
  const result = parse(dsl);
  expect(hasFatalError(result)).toBe(false);
  if (options?.allowWarnings) {
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  } else {
    expect(result.diagnostics).toEqual([]);
  }
  return result.document;
}

function rectOf(record: Record<string, Rect>, id: string): Rect {
  if (!Object.hasOwn(record, id)) {
    throw new Error(`Missing rect for "${id}"`);
  }
  const rect = record[id];
  if (!rect) {
    throw new Error(`Undefined rect for "${id}"`);
  }
  return rect;
}

function centerX(rect: Rect): number {
  return rect.x + rect.width / 2;
}

function centerY(rect: Rect): number {
  return rect.y + rect.height / 2;
}

function enclosingRect(rects: readonly Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const r of rects) {
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.width > maxX) maxX = r.x + r.width;
    if (r.y + r.height > maxY) maxY = r.y + r.height;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function layoutAspect(layout: Layout): number {
  const rects = [...Object.values(layout.nodes), ...Object.values(layout.groups)];
  const bounds = enclosingRect(rects);
  if (bounds.height === 0) return 1;
  return Math.round((bounds.width / bounds.height) * 100) / 100;
}

function clusterRows(rects: readonly Rect[]): Rect[][] {
  if (rects.length === 0) return [];
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: { minY: number; maxY: number; items: Rect[] }[] = [];
  for (const r of sorted) {
    const last = rows[rows.length - 1];
    if (last && r.y < last.maxY && r.y + r.height > last.minY) {
      last.minY = Math.min(last.minY, r.y);
      last.maxY = Math.max(last.maxY, r.y + r.height);
      last.items.push(r);
    } else {
      rows.push({ minY: r.y, maxY: r.y + r.height, items: [r] });
    }
  }
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x || a.y - b.y);
  }
  return rows.map((row) => row.items);
}

function ancestorsOf(
  groupParent: ReadonlyMap<string, string | undefined>,
  startParent: string | undefined,
): Set<string> {
  const ancestors = new Set<string>();
  let cur = startParent;
  while (cur !== undefined) {
    ancestors.add(cur);
    cur = groupParent.get(cur);
  }
  return ancestors;
}

function assertValidLayout(doc: DavDocument, layout: Layout): void {
  const expectedNodeIds = doc.nodes.map((n) => n.id).sort();
  const actualNodeIds = Object.keys(layout.nodes).sort();
  expect(actualNodeIds).toEqual(expectedNodeIds);

  const expectedGroupIds = doc.groups.map((g) => g.id).sort();
  const actualGroupIds = Object.keys(layout.groups).sort();
  expect(actualGroupIds).toEqual(expectedGroupIds);

  const groupParent = new Map<string, string | undefined>(
    doc.groups.map((g) => [g.id, g.parentId]),
  );
  const groupAncestors = new Map<string, Set<string>>();
  for (const g of doc.groups) {
    groupAncestors.set(g.id, ancestorsOf(groupParent, g.parentId));
  }

  for (const n of doc.nodes) {
    const r = rectOf(layout.nodes, n.id);
    expect(Number.isFinite(r.x)).toBe(true);
    expect(Number.isFinite(r.y)).toBe(true);
    expect(r.width).toBe(NODE_SIZE.width);
    expect(r.height).toBe(NODE_SIZE.height);
    const st = stationRect(r, n.icon);
    expect(st.width === STATION_SIZE || st.width === WINDOW_SIZE.width).toBe(true);
    expect(st.height === STATION_SIZE || st.height === WINDOW_SIZE.height).toBe(true);
  }

  for (const g of doc.groups) {
    const r = rectOf(layout.groups, g.id);
    expect(Number.isFinite(r.x)).toBe(true);
    expect(Number.isFinite(r.y)).toBe(true);
    expect(r.width).toBeGreaterThan(0);
    expect(r.height).toBeGreaterThan(0);
  }

  for (let i = 0; i < doc.nodes.length; i++) {
    const ni = doc.nodes[i];
    if (!ni) continue;
    const ri = rectOf(layout.nodes, ni.id);
    for (let j = i + 1; j < doc.nodes.length; j++) {
      const nj = doc.nodes[j];
      if (!nj) continue;
      const rj = rectOf(layout.nodes, nj.id);
      expect(rectOverlaps(ri, rj)).toBe(false);
    }
  }

  for (const g of doc.groups) {
    if (g.parentId !== undefined) {
      expect(rectContains(rectOf(layout.groups, g.parentId), rectOf(layout.groups, g.id))).toBe(
        true,
      );
    }
  }

  for (const n of doc.nodes) {
    const nr = rectOf(layout.nodes, n.id);
    const anc = ancestorsOf(groupParent, n.parentId);
    if (n.parentId !== undefined) {
      expect(rectContains(rectOf(layout.groups, n.parentId), nr)).toBe(true);
    }
    for (const g of doc.groups) {
      if (!anc.has(g.id)) {
        expect(rectOverlaps(rectOf(layout.groups, g.id), nr)).toBe(false);
      }
    }
  }

  for (let i = 0; i < doc.groups.length; i++) {
    const gi = doc.groups[i];
    if (!gi) continue;
    const ri = rectOf(layout.groups, gi.id);
    const ancI = groupAncestors.get(gi.id) ?? new Set<string>();
    for (let j = i + 1; j < doc.groups.length; j++) {
      const gj = doc.groups[j];
      if (!gj) continue;
      const rj = rectOf(layout.groups, gj.id);
      const ancJ = groupAncestors.get(gj.id) ?? new Set<string>();
      if (!ancI.has(gj.id) && !ancJ.has(gi.id)) {
        expect(rectOverlaps(ri, rj)).toBe(false);
      }
    }
  }
}

function clearZoneCache(): void {
  const dummy = parseValidDoc(
    `group _cache_evict_a "A" {\n  node _ca\n}\ngroup _cache_evict_b "B" {\n  node _cb\n}\nstep "Clear" {\n  animate _ca --> _cb\n}`,
  );
  computeLayout(dummy);
}

interface OpaqueFlowEdge {
  from: string;
  to: string;
  role: 'primary' | 'return' | 'static';
  firstStep: number;
  direction: 'forward' | 'bidirectional';
}

interface OpaqueFlow {
  edges: OpaqueFlowEdge[];
  hasAnimate: boolean;
  owners: Map<string, string>;
  blockOrder: Map<string, number>;
  zoneStage: Map<string, number>;
  auxiliaryZones: Set<string>;
  activeStepCount: number;
}

function canReach(
  adj: ReadonlyMap<string, ReadonlySet<string>>,
  src: string,
  dst: string,
): boolean {
  if (src === dst) return true;
  const visited = new Set<string>([src]);
  const queue = [src];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    if (cur === undefined) continue;
    for (const nxt of adj.get(cur) ?? []) {
      if (nxt === dst) return true;
      if (!visited.has(nxt)) {
        visited.add(nxt);
        queue.push(nxt);
      }
    }
  }
  return false;
}

function addAdjEdge(adj: Map<string, Set<string>>, u: string, v: string): void {
  let s = adj.get(u);
  if (!s) {
    s = new Set<string>();
    adj.set(u, s);
  }
  s.add(v);
}

function pairKey(a: string, b: string): string {
  return a <= b ? `${a}\0${b}` : `${b}\0${a}`;
}

function dirPairKey(a: string, b: string): string {
  return `${a}\0${b}`;
}

function analyzeOpaqueFlow(doc: DavDocument): OpaqueFlow {
  const known = new Set(doc.nodes.map((n) => n.id));
  const rawOwners = zoneOfNodes(doc);
  const topIds = new Set(topLevelGroups(doc.groups).map((g) => g.id));
  const owners = new Map<string, string>();
  const blockOrder = new Map<string, number>();

  for (const g of topLevelGroups(doc.groups)) {
    if (!blockOrder.has(g.id)) blockOrder.set(g.id, blockOrder.size);
  }
  for (const n of doc.nodes) {
    const z = rawOwners.get(n.id);
    const owner = z !== undefined && topIds.has(z) ? z : n.id;
    owners.set(n.id, owner);
    if (!blockOrder.has(owner)) blockOrder.set(owner, blockOrder.size);
  }
  const ownerOf = (id: string): string => owners.get(id) ?? id;

  const conns = synthesizedConnections(doc);
  const connByPair = new Map<string, (typeof conns)[number]>();
  for (const c of conns) {
    if (c.from !== c.to && known.has(c.from) && known.has(c.to)) {
      connByPair.set(pairKey(c.from, c.to), c);
    }
  }

  const byPair = new Map<string, OpaqueFlowEdge>();
  const nodeAdj = new Map<string, Set<string>>();
  const zoneAdj = new Map<string, Set<string>>();
  const effNodeAdj = new Map<string, Set<string>>();
  const effZoneAdj = new Map<string, Set<string>>();
  const pendingStatics = new Map<string, string[]>();
  const enteredNodes = new Set<string>();
  const effEnteredNodes = new Set<string>();
  const enteredZones = new Set<string>();
  const returnReached = new Set<string>();
  const pairFirstStep = new Map<string, number>();
  let hasAnimate = false;

  const recordStep = (from: string, to: string, stepIdx: number): void => {
    if (from === to || !known.has(from) || !known.has(to)) return;
    const pk = pairKey(from, to);
    if (!connByPair.has(pk)) return;
    if (!pairFirstStep.has(pk)) pairFirstStep.set(pk, stepIdx);
  };

  const activateStaticEdge = (from: string, to: string, seen: Set<string>): void => {
    if (!canReach(effNodeAdj, to, from)) {
      addAdjEdge(effNodeAdj, from, to);
    }
    effEnteredNodes.add(to);
    const zf = owners.get(from);
    const zt = owners.get(to);
    if (zf !== undefined && zt !== undefined && zf !== zt && !canReach(effZoneAdj, zt, zf)) {
      addAdjEdge(effZoneAdj, zf, zt);
    }
    if (!seen.has(to)) {
      seen.add(to);
      for (const nxt of pendingStatics.get(to) ?? []) {
        activateStaticEdge(to, nxt, seen);
      }
    }
  };

  const activateFrom = (id: string): void => {
    const targets = pendingStatics.get(id);
    if (!targets || targets.length === 0) return;
    const seen = new Set<string>([id]);
    for (const to of targets) activateStaticEdge(id, to, seen);
  };

  const markEntered = (id: string): void => {
    if (!enteredNodes.has(id)) {
      enteredNodes.add(id);
      effEnteredNodes.add(id);
      const z = owners.get(id);
      if (z !== undefined) enteredZones.add(z);
      activateFrom(id);
    }
  };

  const acceptPrimary = (
    src: string,
    dst: string,
    direction: 'forward' | 'bidirectional',
    stepIdx: number,
  ): void => {
    const pk = pairKey(src, dst);
    if (byPair.has(pk)) return;
    if (returnReached.has(src)) returnReached.add(dst);
    else returnReached.delete(dst);
    addAdjEdge(nodeAdj, src, dst);
    addAdjEdge(effNodeAdj, src, dst);
    const zu = owners.get(src);
    const zv = owners.get(dst);
    if (zu !== undefined && zv !== undefined && zu !== zv) {
      if (!canReach(zoneAdj, zv, zu)) addAdjEdge(zoneAdj, zu, zv);
      if (!canReach(effZoneAdj, zv, zu)) addAdjEdge(effZoneAdj, zu, zv);
    }
    markEntered(src);
    markEntered(dst);
    byPair.set(pk, {
      from: src,
      to: dst,
      role: 'primary',
      firstStep: pairFirstStep.get(pk) ?? stepIdx,
      direction,
    });
  };

  let activeStepCount = 0;
  for (const step of doc.steps) {
    const hasActiveConn =
      step.statics.some((s) => s.from !== s.to && connByPair.has(pairKey(s.from, s.to))) ||
      step.animations.some((a) => a.from !== a.to && connByPair.has(pairKey(a.from, a.to)));
    if (!hasActiveConn) continue;
    const stepIdx = activeStepCount++;

    const stepStaticSources: string[] = [];
    for (const s of step.statics) {
      recordStep(s.from, s.to, stepIdx);
      if (s.from === s.to || s.direction !== 'forward') continue;
      if (!known.has(s.from) || !known.has(s.to)) continue;
      if (!connByPair.has(pairKey(s.from, s.to))) continue;
      const list = pendingStatics.get(s.from);
      if (list) list.push(s.to);
      else pendingStatics.set(s.from, [s.to]);
      stepStaticSources.push(s.from);
    }
    for (const src of stepStaticSources) {
      if (effEnteredNodes.has(src)) activateFrom(src);
    }

    for (const a of step.animations) {
      if (a.from === a.to) continue;
      const pk = pairKey(a.from, a.to);
      if (!connByPair.has(pk)) continue;
      recordStep(a.from, a.to, stepIdx);
      hasAnimate = true;
      if (byPair.has(pk)) continue;

      if (a.direction === 'bidirectional') {
        const zu = owners.get(a.from);
        const zv = owners.get(a.to);
        let src = a.from;
        let dst = a.to;
        if (canReach(effNodeAdj, a.to, a.from) && !canReach(effNodeAdj, a.from, a.to)) {
          src = a.to;
          dst = a.from;
        } else if (
          zu !== undefined &&
          zv !== undefined &&
          zu !== zv &&
          canReach(effZoneAdj, zv, zu) &&
          !canReach(effZoneAdj, zu, zv)
        ) {
          src = a.to;
          dst = a.from;
        }
        const sz = owners.get(src);
        const dz = owners.get(dst);
        const closesNode = canReach(effNodeAdj, dst, src);
        const closesZone =
          sz !== undefined &&
          dz !== undefined &&
          sz !== dz &&
          enteredZones.has(dz) &&
          canReach(effZoneAdj, dz, sz);
        if (closesNode || closesZone) {
          byPair.set(pk, {
            from: a.from,
            to: a.to,
            role: 'return',
            firstStep: pairFirstStep.get(pk) ?? stepIdx,
            direction: 'bidirectional',
          });
          if (!enteredNodes.has(dst)) returnReached.add(dst);
        } else {
          acceptPrimary(src, dst, 'bidirectional', stepIdx);
        }
        continue;
      }

      const closesNodeCycle = canReach(effNodeAdj, a.to, a.from);
      const zu = owners.get(a.from);
      const zv = owners.get(a.to);
      const closesZoneCycle =
        zu !== undefined &&
        zv !== undefined &&
        zu !== zv &&
        enteredZones.has(zv) &&
        canReach(effZoneAdj, zv, zu);
      const returnCont = returnReached.has(a.from) && enteredNodes.has(a.to);
      if (closesNodeCycle || closesZoneCycle || returnCont) {
        byPair.set(pk, {
          from: a.from,
          to: a.to,
          role: 'return',
          firstStep: pairFirstStep.get(pk) ?? stepIdx,
          direction: 'forward',
        });
        if (!enteredNodes.has(a.to)) returnReached.add(a.to);
      } else {
        acceptPrimary(a.from, a.to, 'forward', stepIdx);
      }
    }
  }

  for (const [pk, conn] of connByPair) {
    if (byPair.has(pk)) continue;
    byPair.set(pk, {
      from: conn.from,
      to: conn.to,
      role: 'static',
      firstStep: pairFirstStep.get(pk) ?? 0,
      direction: conn.direction,
    });
  }

  const edges = [...byPair.values()];
  const { auxiliaryZones, zoneStage } = computeOpaqueMacro(
    doc,
    edges,
    connByPair,
    ownerOf,
    blockOrder,
    zoneAdj,
    hasAnimate,
    activeStepCount,
  );

  return {
    edges,
    hasAnimate,
    owners,
    blockOrder,
    zoneStage,
    auxiliaryZones,
    activeStepCount,
  };
}

function computeOpaqueMacro(
  doc: DavDocument,
  edges: readonly OpaqueFlowEdge[],
  connByPair: ReadonlyMap<string, { direction: 'forward' | 'bidirectional' }>,
  ownerOf: (id: string) => string,
  blockOrder: ReadonlyMap<string, number>,
  chronZoneAdj: ReadonlyMap<string, ReadonlySet<string>>,
  hasAnimate: boolean,
  activeStepCount: number,
): { auxiliaryZones: Set<string>; zoneStage: Map<string, number> } {
  const topIds = new Set(topLevelGroups(doc.groups).map((g) => g.id));
  const blockIds = [...blockOrder.keys()];
  const primaryInter = new Map<string, number>();
  const priInterDeg = new Map<string, number>(blockIds.map((id) => [id, 0]));
  const nbrs = new Map<string, Set<string>>(blockIds.map((id) => [id, new Set()]));
  const directedVotes = new Map<string, number>();
  const pairMinPriStep = new Map<string, number>();
  const zoneNodeCount = new Map<string, number>(blockIds.map((id) => [id, 0]));
  for (const n of doc.nodes) {
    const z = ownerOf(n.id);
    zoneNodeCount.set(z, (zoneNodeCount.get(z) ?? 0) + 1);
  }

  const multiStep = activeStepCount >= 4;
  const stepDecay = (fs: number): number => (multiStep ? 1 / (1 + 0.12 * Math.max(0, fs - 2)) : 1);

  const animTouch = new Map<string, number>(blockIds.map((id) => [id, 0]));
  const statDeg = new Map<string, number>(blockIds.map((id) => [id, 0]));
  const intraTotal = new Map<string, number>(blockIds.map((id) => [id, 0]));

  for (const e of edges) {
    const bu = ownerOf(e.from);
    const bv = ownerOf(e.to);
    if (bu === bv) {
      intraTotal.set(bu, (intraTotal.get(bu) ?? 0) + 1);
      continue;
    }
    nbrs.get(bu)?.add(bv);
    nbrs.get(bv)?.add(bu);

    const pk = pairKey(e.from, e.to);
    const fs = e.firstStep;
    const stepScore = 1 / (1 + 0.05 * fs);
    const w = stepDecay(fs);
    const dk = dirPairKey(bu, bv);
    if (e.role === 'primary') {
      primaryInter.set(dk, (primaryInter.get(dk) ?? 0) + 1);
      directedVotes.set(dk, (directedVotes.get(dk) ?? 0) + 3 * stepScore);
      const zpk = pairKey(bu, bv);
      pairMinPriStep.set(zpk, Math.min(pairMinPriStep.get(zpk) ?? fs, fs));
      priInterDeg.set(bu, (priInterDeg.get(bu) ?? 0) + 1);
      priInterDeg.set(bv, (priInterDeg.get(bv) ?? 0) + 1);
      animTouch.set(bu, (animTouch.get(bu) ?? 0) + w);
      animTouch.set(bv, (animTouch.get(bv) ?? 0) + w);
    } else if (e.role === 'return') {
      animTouch.set(bu, (animTouch.get(bu) ?? 0) + w);
      animTouch.set(bv, (animTouch.get(bv) ?? 0) + w);
    } else {
      if (connByPair.get(pk)?.direction !== 'bidirectional') {
        directedVotes.set(dk, (directedVotes.get(dk) ?? 0) + 0.1 * stepScore);
      }
      statDeg.set(bu, (statDeg.get(bu) ?? 0) + w);
      statDeg.set(bv, (statDeg.get(bv) ?? 0) + w);
    }
  }

  const auxiliaryZones = new Set<string>();
  if (hasAnimate) {
    for (const id of topIds) {
      const priInter = priInterDeg.get(id) ?? 0;
      const anim = animTouch.get(id) ?? 0;
      const stat = statDeg.get(id) ?? 0;
      const distinctNbrs = nbrs.get(id)?.size ?? 0;
      const isSharedBag = (zoneNodeCount.get(id) ?? 0) >= 2 && (intraTotal.get(id) ?? 0) === 0;
      const staticHeavy = isSharedBag ? stat > anim : stat > anim * 2;
      if ((priInter === 0 && distinctNbrs >= 2) || (staticHeavy && distinctNbrs >= 3)) {
        auxiliaryZones.add(id);
      }
    }
    if (auxiliaryZones.size > 0) {
      const nonAuxConnected = blockIds.filter(
        (id) => (nbrs.get(id)?.size ?? 0) > 0 && !auxiliaryZones.has(id),
      ).length;
      if (primaryInter.size === 0 || nonAuxConnected < 2) {
        auxiliaryZones.clear();
      }
    }
  }

  const primaryComponentAdj = new Map<string, Set<string>>(blockIds.map((id) => [id, new Set()]));
  for (const e of edges) {
    if (e.role !== 'primary') continue;
    const bu = ownerOf(e.from);
    const bv = ownerOf(e.to);
    if (bu === bv || auxiliaryZones.has(bu) || auxiliaryZones.has(bv)) continue;
    addAdjEdge(primaryComponentAdj, bu, bv);
    addAdjEdge(primaryComponentAdj, bv, bu);
  }

  const pairMargin: Array<{ a: string; b: string; weight: number }> = [];
  const seenPairs = new Set<string>();
  for (const bu of blockIds) {
    for (const bv of blockIds) {
      if (bu >= bv) continue;
      const pk = pairKey(bu, bv);
      if (seenPairs.has(pk)) continue;
      seenPairs.add(pk);
      const fwd = directedVotes.get(dirPairKey(bu, bv)) ?? 0;
      const rev = directedVotes.get(dirPairKey(bv, bu)) ?? 0;
      if (fwd === 0 && rev === 0) continue;

      const auxA = auxiliaryZones.has(bu);
      const auxB = auxiliaryZones.has(bv);
      const hasPri =
        (primaryInter.get(dirPairKey(bu, bv)) ?? 0) + (primaryInter.get(dirPairKey(bv, bu)) ?? 0) >
        0;
      if (
        hasAnimate &&
        !auxA &&
        !auxB &&
        !hasPri &&
        (priInterDeg.get(bu) ?? 0) > 0 &&
        (priInterDeg.get(bv) ?? 0) > 0 &&
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
        } else if (!chronFwd && (blockOrder.get(bv) ?? 0) < (blockOrder.get(bu) ?? 0)) {
          winnerFrom = bv;
          winnerTo = bu;
        }
      }
      const priBonus = hasPri ? 100 + 10 / (1 + 0.05 * (pairMinPriStep.get(pk) ?? 0)) : 0;
      const weight = (auxA || auxB ? 0 : 1000) + priBonus + diff;
      pairMargin.push({ a: winnerFrom, b: winnerTo, weight });
    }
  }
  pairMargin.sort(
    (x, y) => y.weight - x.weight || (blockOrder.get(x.a) ?? 0) - (blockOrder.get(y.a) ?? 0),
  );

  const dag = new Map<string, string[]>(blockIds.map((id) => [id, []]));
  const reachMap = new Map<string, Set<string>>(blockIds.map((id) => [id, new Set()]));
  for (const edge of pairMargin) {
    if (canReach(reachMap, edge.b, edge.a)) continue;
    dag.get(edge.a)?.push(edge.b);
    addAdjEdge(reachMap, edge.a, edge.b);
  }

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

  for (const id of primaryIds) {
    if ((indeg.get(id) ?? 0) !== 0 || (dag.get(id)?.length ?? 0) !== 0) continue;
    const idNbrs = nbrs.get(id);
    if (idNbrs?.size !== 1) continue;
    const [onlyNbr] = idNbrs;
    if (!onlyNbr || auxiliaryZones.has(onlyNbr)) continue;
    if (
      (zoneStage.get(onlyNbr) ?? 0) > 0 ||
      (blockOrder.get(onlyNbr) ?? 0) < (blockOrder.get(id) ?? 0)
    ) {
      zoneStage.set(id, (zoneStage.get(onlyNbr) ?? 0) + 1);
    }
  }

  const auxNbrMaxWeight = new Map<string, Map<string, number>>();
  for (const e of edges) {
    const bu = ownerOf(e.from);
    const bv = ownerOf(e.to);
    if (bu === bv) continue;
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
      const w = stepDecay(e.firstStep);
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

  for (const id of primaryIds) {
    if ((indeg.get(id) ?? 0) !== 0 || (dag.get(id)?.length ?? 0) !== 0) continue;
    const idNbrs = nbrs.get(id);
    if (!idNbrs || idNbrs.size === 0) continue;
    if ([...idNbrs].some((n) => !auxiliaryZones.has(n))) continue;
    const auxIn = [...idNbrs].filter((n) => (primaryInter.get(dirPairKey(n, id)) ?? 0) > 0);
    const auxOut = [...idNbrs].filter((n) => (primaryInter.get(dirPairKey(id, n)) ?? 0) > 0);
    if (auxIn.length > 0) {
      zoneStage.set(id, Math.max(...auxIn.map((n) => (zoneStage.get(n) ?? 0) + 1)));
    } else if (auxOut.length > 0) {
      zoneStage.set(id, Math.max(0, Math.min(...auxOut.map((n) => (zoneStage.get(n) ?? 0) - 1))));
    } else {
      const stages = [...idNbrs].map((n) => zoneStage.get(n) ?? 0);
      zoneStage.set(id, Math.round(stages.reduce((a, b) => a + b, 0) / stages.length));
    }
  }

  return { auxiliaryZones, zoneStage };
}

function stationCenterX(
  nodeMap: ReadonlyMap<string, DavNode>,
  layout: Layout,
  nodeId: string,
): number {
  const node = nodeMap.get(nodeId);
  const icon: IconName = node?.icon ?? 'server';
  const st = stationRect(rectOf(layout.nodes, nodeId), icon);
  return st.x + st.width / 2;
}

function measurePrimaryRightward(
  doc: DavDocument,
  layout: Layout,
  explicitAuxIds?: readonly string[],
): number {
  const flow = analyzeOpaqueFlow(doc);
  const aux = explicitAuxIds ? new Set(explicitAuxIds) : flow.auxiliaryZones;
  const nodeMap = new Map(doc.nodes.map((n) => [n.id, n]));
  const ownerOf = (id: string): string => flow.owners.get(id) ?? id;
  const interPri = flow.edges.filter((e) => {
    if (e.role !== 'primary') return false;
    const za = ownerOf(e.from);
    const zb = ownerOf(e.to);
    if (za === zb) return false;
    // Late alert from an auxiliary zone back to an equal-or-earlier primary stage (firstStep >= 2) is feedback
    if (
      aux.has(za) &&
      !aux.has(zb) &&
      e.firstStep >= 2 &&
      (flow.zoneStage.get(za) ?? 0) >= (flow.zoneStage.get(zb) ?? 0)
    ) {
      return false;
    }
    return true;
  });
  if (interPri.length === 0) return 1;
  let right = 0;
  for (const e of interPri) {
    if (stationCenterX(nodeMap, layout, e.to) > stationCenterX(nodeMap, layout, e.from)) {
      right++;
    }
  }
  return right / interPri.length;
}

function measureCorridorIntrusions(
  doc: DavDocument,
  layout: Layout,
  explicitAuxIds?: readonly string[],
): number {
  const flow = analyzeOpaqueFlow(doc);
  const ownerOf = (id: string): string => flow.owners.get(id) ?? id;
  const aux = explicitAuxIds ? new Set(explicitAuxIds) : flow.auxiliaryZones;

  const priZoneAdj = new Map<string, Set<string>>();
  const corridors: Array<[string, string]> = [];
  const seenCorridor = new Set<string>();

  for (const e of flow.edges) {
    if (e.role !== 'primary') continue;
    const za = ownerOf(e.from);
    const zb = ownerOf(e.to);
    if (za === zb || aux.has(za) || aux.has(zb)) continue;
    if ((flow.zoneStage.get(za) ?? 0) < (flow.zoneStage.get(zb) ?? 0)) {
      addAdjEdge(priZoneAdj, za, zb);
    }
    const key = pairKey(za, zb);
    if (!seenCorridor.has(key)) {
      seenCorridor.add(key);
      corridors.push([za, zb]);
    }
  }

  const blockRect = new Map<string, Rect>();
  for (const g of topLevelGroups(doc.groups)) {
    blockRect.set(g.id, rectOf(layout.groups, g.id));
  }
  const rawOwners = zoneOfNodes(doc);
  for (const n of doc.nodes) {
    if (rawOwners.get(n.id) === undefined && n.visible) {
      blockRect.set(n.id, rectOf(layout.nodes, n.id));
    }
  }

  let intrusions = 0;
  for (const [a, b] of corridors) {
    const ra = blockRect.get(a);
    const rb = blockRect.get(b);
    if (!ra || !rb) continue;
    const minX = Math.min(centerX(ra), centerX(rb));
    const maxX = Math.max(centerX(ra), centerX(rb));
    const minY = Math.min(ra.y, rb.y);
    const maxY = Math.max(ra.y + ra.height, rb.y + rb.height);

    const allowed = new Set<string>([a, b]);
    for (const c of blockRect.keys()) {
      if (c === a || c === b) continue;
      if (
        (canReach(priZoneAdj, a, c) && canReach(priZoneAdj, c, b)) ||
        (canReach(priZoneAdj, b, c) && canReach(priZoneAdj, c, a))
      ) {
        allowed.add(c);
      }
    }

    for (const [c, rc] of blockRect.entries()) {
      if (allowed.has(c)) continue;
      const cx = centerX(rc);
      if (cx > minX && cx < maxX && rc.y < maxY && rc.y + rc.height > minY) {
        intrusions++;
      }
    }
  }
  return intrusions;
}

function assertStageOrderPreserved(stages: readonly (readonly string[])[], layout: Layout): void {
  for (let s = 0; s < stages.length; s++) {
    const curStage = stages[s] ?? [];
    for (let t = s + 1; t < stages.length; t++) {
      const nextStage = stages[t] ?? [];
      for (const u of curStage) {
        for (const v of nextStage) {
          expect(centerX(rectOf(layout.groups, u))).toBeLessThan(centerX(rectOf(layout.groups, v)));
        }
      }
    }
  }
}

function assertAuxBandSeparated(
  primaryGroupIds: readonly string[],
  auxGroupIds: readonly string[],
  layout: Layout,
): void {
  const priBounds = enclosingRect(primaryGroupIds.map((id) => rectOf(layout.groups, id)));
  const priTop = priBounds.y;
  const priBot = priBounds.y + priBounds.height;
  for (const auxId of auxGroupIds) {
    const auxRect = rectOf(layout.groups, auxId);
    const outsideVerticalBand = auxRect.y + auxRect.height <= priTop || auxRect.y >= priBot;
    expect(outsideVerticalBand).toBe(true);
  }
}

function assertSkeletonContinuity(
  sharedStages: readonly (readonly string[])[],
  lBefore: Layout,
  lAfter: Layout,
  auxIds: readonly string[] = [],
): void {
  assertStageOrderPreserved(sharedStages, lBefore);
  assertStageOrderPreserved(sharedStages, lAfter);
  for (const stage of sharedStages) {
    if (stage.length < 2) continue;
    for (let i = 0; i < stage.length; i++) {
      const u = stage[i];
      if (!u) continue;
      for (let j = i + 1; j < stage.length; j++) {
        const v = stage[j];
        if (!v) continue;
        const dyBefore = centerY(rectOf(lBefore.groups, u)) - centerY(rectOf(lBefore.groups, v));
        if (Math.abs(dyBefore) > 1) {
          const dyAfter = centerY(rectOf(lAfter.groups, u)) - centerY(rectOf(lAfter.groups, v));
          expect(Math.sign(dyAfter)).toBe(Math.sign(dyBefore));
        }
      }
    }
  }
  expect(Math.abs(layoutAspect(lAfter) - layoutAspect(lBefore))).toBeLessThanOrEqual(1.5);
  const sharedPrimaryIds = sharedStages.flat().filter((id) => !auxIds.includes(id));
  if (auxIds.length > 0 && sharedPrimaryIds.length > 0) {
    assertAuxBandSeparated(sharedPrimaryIds, auxIds, lBefore);
    assertAuxBandSeparated(sharedPrimaryIds, auxIds, lAfter);
    const priBefore = enclosingRect(sharedPrimaryIds.map((id) => rectOf(lBefore.groups, id)));
    const priAfter = enclosingRect(sharedPrimaryIds.map((id) => rectOf(lAfter.groups, id)));
    for (const auxId of auxIds) {
      const auxBeforeTop =
        rectOf(lBefore.groups, auxId).y + rectOf(lBefore.groups, auxId).height <= priBefore.y;
      const auxAfterTop =
        rectOf(lAfter.groups, auxId).y + rectOf(lAfter.groups, auxId).height <= priAfter.y;
      expect(auxAfterTop).toBe(auxBeforeTop);
    }
  }
}

function assertRowWrapped(
  rects: readonly Rect[],
  layout: Layout,
  minAspect = 1,
  maxAspect = 5.5,
): Rect[][] {
  const rows = clusterRows(rects);
  expect(rows.length).toBeGreaterThanOrEqual(2);
  expect(rows.filter((r) => r.length >= 2).length).toBeGreaterThanOrEqual(2);
  const asp = layoutAspect(layout);
  expect(asp).toBeGreaterThanOrEqual(minAspect);
  expect(asp).toBeLessThanOrEqual(maxAspect);
  return rows;
}

function assertZeroConnectedDrift(
  connectedNodeIds: readonly string[],
  connectedGroupIds: readonly string[],
  before: Layout,
  after: Layout,
): void {
  for (const nid of connectedNodeIds) {
    expect(rectOf(after.nodes, nid)).toEqual(rectOf(before.nodes, nid));
  }
  for (const gid of connectedGroupIds) {
    expect(rectOf(after.groups, gid)).toEqual(rectOf(before.groups, gid));
  }
}

function makeZoneGroup(id: string, nodeCount: number, labelPrefix = id): string {
  const nodes = Array.from(
    { length: nodeCount },
    (_, i) => `  node ${id}_n${i} "${labelPrefix} ${i}"`,
  ).join('\n');
  return `group ${id} "${id}" {\n${nodes}\n}`;
}

function makeConnectedNodeFlowDsl(extraNodeInZ6: boolean): string {
  // 7 primary zones in 5 stages: z0 -> (z1, z2) -> (z3, z4) -> z5 -> z6
  // Compact 3-column fan-out/fan-in per zone (5 nodes each = 35; + z6_n5 = 36) so preserveFlow stays true.
  const z0_5 = Array.from({ length: 6 }, (_, i) => makeZoneGroup(`z${i}`, 5)).join('\n');
  const z6 = makeZoneGroup('z6', extraNodeInZ6 ? 6 : 5);
  const internalEdges: string[] = [];
  for (let z = 0; z < 7; z++) {
    internalEdges.push(
      `  animate z${z}_n0 --> z${z}_n1`,
      `  animate z${z}_n0 --> z${z}_n2`,
      `  animate z${z}_n1 --> z${z}_n3`,
      `  animate z${z}_n2 --> z${z}_n4`,
    );
  }
  if (extraNodeInZ6) {
    internalEdges.push('  animate z6_n3 --> z6_n5');
  }
  const interEdges = [
    '  animate z0_n3 --> z1_n0',
    '  animate z0_n4 --> z2_n0',
    '  animate z1_n3 --> z3_n0',
    '  animate z2_n4 --> z4_n0',
    '  animate z3_n3 --> z5_n0',
    '  animate z4_n4 --> z5_n0',
    '  animate z5_n3 --> z6_n0',
  ];
  return `title "35-36 Boundary"\n${z0_5}\n${z6}\nstep "Flow" {\n${internalEdges.join('\n')}\n${interEdges.join('\n')}\n}`;
}

function makeMultiZoneStageDsl(zoneCount: number, nodesPerZone = 2): string {
  // 5 stages x up to 3 lanes = up to 15 zones; with nodesPerZone=2 => 28->30 nodes (<=35).
  const groups = Array.from({ length: zoneCount }, (_, i) => makeZoneGroup(`z${i}`, nodesPerZone));
  const internal: string[] = [];
  for (let z = 0; z < zoneCount; z++) {
    for (let i = 0; i < nodesPerZone - 1; i++) {
      internal.push(`  animate z${z}_n${i} --> z${z}_n${i + 1}`);
    }
  }
  const inter: string[] = [];
  const last = (z: number) => `z${z}_n${nodesPerZone - 1}`;
  const first = (z: number) => `z${z}_n0`;
  // Stage 0: z0, z1, z2 -> Stage 1: z3, z4, z5 -> Stage 2: z6, z7, z8 -> Stage 3: z9, z10, z11 -> Stage 4: z12, z13, (z14)
  for (let z = 0; z + 3 < zoneCount; z++) {
    inter.push(`  animate ${last(z)} --> ${first(z + 3)}`);
  }
  if (zoneCount >= 6) inter.push(`  animate ${last(0)} --> ${first(4)}`);
  if (zoneCount >= 9) inter.push(`  animate ${last(4)} --> ${first(8)}`);
  if (zoneCount >= 12) inter.push(`  animate ${last(7)} --> ${first(11)}`);
  return `title "Zone Boundary ${zoneCount}"\n${groups.join('\n')}\nstep "Pipeline" {\n${internal.join('\n')}\n${inter.join('\n')}\n}`;
}

function makeStaticMeshDsl(zoneCount: number, nodesPerZone: number, withSkipLinks = true): string {
  const groups = Array.from({ length: zoneCount }, (_, i) => makeZoneGroup(`s${i}`, nodesPerZone));
  const statics: string[] = [];
  for (let z = 0; z < zoneCount; z++) {
    for (let i = 0; i < nodesPerZone - 1; i++) {
      statics.push(`  static s${z}_n${i} --> s${z}_n${i + 1}`);
    }
    if (z + 1 < zoneCount) {
      statics.push(`  static s${z}_n${nodesPerZone - 1} --> s${z + 1}_n0`);
    }
    if (withSkipLinks && z + 3 < zoneCount) {
      statics.push(`  static s${z}_n0 ..> s${z + 3}_n0`);
    }
  }
  return `title "Static Mesh ${zoneCount}"\n${groups.join('\n')}\nstep "Static" {\n${statics.join('\n')}\n}`;
}

function makeWideAnimatedStripDsl(zoneCount: number, nodesPerZone = 3): string {
  const groups = Array.from({ length: zoneCount }, (_, i) => makeZoneGroup(`w${i}`, nodesPerZone));
  const anims: string[] = [];
  for (let z = 0; z < zoneCount; z++) {
    for (let i = 0; i < nodesPerZone - 1; i++) {
      anims.push(`  animate w${z}_n${i} --> w${z}_n${i + 1}`);
    }
    if (z + 1 < zoneCount) {
      anims.push(`  animate w${z}_n${nodesPerZone - 1} --> w${z + 1}_n0`);
    }
  }
  return `title "Wide Strip ${zoneCount}"\n${groups.join('\n')}\nstep "Strip" {\n${anims.join('\n')}\n}`;
}

// ============================================================================
// TIER 1: Isolated Feature Tests (>= 5 tests per feature area across 10 areas)
// ============================================================================

describe('Tier 1 — Isolated Feature Tests', () => {
  describe('T1.1 Forward backbone L->R flow', () => {
    it('places a linear 3-zone animate pipeline monotonically left-to-right', () => {
      const doc = parseValidDoc(`
group g0 "Edge" {
  node a0 "Client"
}
group g1 "API" {
  node b0 "Gateway"
  node b1 "Worker"
}
group g2 "Data" {
  node c0 "Store"
}
step "Forward" {
  animate a0 --> b0 : "HTTP"
  animate b0 --> b1 : "RPC"
  animate b1 --> c0 : "SQL"
}
`);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(zonesPlacedFreely(doc)).toBe(true);
      expect(measurePrimaryRightward(doc, layout)).toBe(1);
      expect(measureCorridorIntrusions(doc, layout)).toBe(0);
      assertStageOrderPreserved([['g0'], ['g1'], ['g2']], layout);
    });

    it('keeps parallel multi-lane pipelines flowing left-to-right with zero crossings', () => {
      const doc = parseValidDoc(`
group src "Ingress" {
  node s1 "Web"
  node s2 "Mobile"
}
group mid "Services" {
  node m1 "Checkout"
  node m2 "Profile"
}
group dst "Storage" {
  node d1 "OrdersDB"
  node d2 "UsersDB"
}
step "Parallel" {
  animate s1 --> m1 : "buy" [parallel: true]
  animate s2 --> m2 : "me" [parallel: true]
  animate m1 --> d1 : "write" [parallel: true]
  animate m2 --> d2 : "read" [parallel: true]
}
`);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(zonesPlacedFreely(doc)).toBe(true);
      expect(measurePrimaryRightward(doc, layout)).toBe(1);
      expect(measureCorridorIntrusions(doc, layout)).toBe(0);
      expect(countCrossings(doc, layout)).toBe(0);
      assertStageOrderPreserved([['src'], ['mid'], ['dst']], layout);
    });

    it('overrides reverse group declaration order using chronological animate flow', () => {
      const doc = parseValidDoc(`
group g2 "Third" {
  node n2 "N2"
}
group g1 "Second" {
  node n1 "N1"
}
group g0 "First" {
  node n0 "N0"
}
step "Flow" {
  animate n0 --> n1 : "step1"
  animate n1 --> n2 : "step2"
}
`);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(zonesPlacedFreely(doc)).toBe(true);
      expect(measurePrimaryRightward(doc, layout)).toBe(1);
      assertStageOrderPreserved([['g0'], ['g1'], ['g2']], layout);
    });

    it('preserves forward L->R backbone across bidirectional <-> links', () => {
      const doc = parseValidDoc(`
group z0 "Client" {
  node c0 "Browser"
}
group z1 "Edge" {
  node e0 "Proxy"
}
group z2 "Core" {
  node k0 "Engine"
}
group z3 "Ledger" {
  node l0 "DB"
}
step "Exchange" {
  animate c0 --> e0 : "req"
  animate e0 <-> k0 : "sync"
  animate k0 --> l0 : "commit"
}
`);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(zonesPlacedFreely(doc)).toBe(true);
      expect(measurePrimaryRightward(doc, layout)).toBe(1);
      assertStageOrderPreserved([['z0'], ['z1'], ['z2'], ['z3']], layout);
    });

    it('keeps stage coordinates fixed and monotonic across progressive multi-step activation', () => {
      const doc = parseValidDoc(`
group s0 "S0" {
  node n0 "N0"
}
group s1 "S1" {
  node n1 "N1"
}
group s2 "S2" {
  node n2 "N2"
}
group s3 "S3" {
  node n3 "N3"
}
group s4 "S4" {
  node n4 "N4"
}
step "1" {
  animate n0 --> n1
}
step "2" {
  animate n1 --> n2
}
step "3" {
  animate n2 --> n3
}
step "4" {
  animate n3 --> n4
}
`);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(zonesPlacedFreely(doc)).toBe(true);
      expect(measurePrimaryRightward(doc, layout)).toBe(1);
      expect(measureCorridorIntrusions(doc, layout)).toBe(0);
      assertStageOrderPreserved([['s0'], ['s1'], ['s2'], ['s3'], ['s4']], layout);
    });
  });

  describe('T1.2 Return, reply, rollback, and late-alert tolerance', () => {
    it('tolerates direct upstream reply without inverting primary forward order', () => {
      const doc = parseValidDoc(`
group g0 "Client" {
  node c "C"
}
group g1 "App" {
  node a "A"
}
group g2 "DB" {
  node d "D"
}
step "Forward & Reply" {
  animate c --> a : "req"
  animate a --> d : "query"
  animate d ..> a : "rows"
  animate a ..> c : "200"
}
`);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(zonesPlacedFreely(doc)).toBe(true);
      expect(measurePrimaryRightward(doc, layout)).toBe(1);
      assertStageOrderPreserved([['g0'], ['g1'], ['g2']], layout);
    });

    it('tolerates a multi-hop rollback chain across 4 zones', () => {
      const doc = parseValidDoc(`
group g0 "A" {
  node n0 "N0"
}
group g1 "B" {
  node n1 "N1"
}
group g2 "C" {
  node n2 "N2"
}
group g3 "D" {
  node n3 "N3"
}
step "Commit" {
  animate n0 --> n1
  animate n1 --> n2
  animate n2 --> n3
}
step "Rollback" {
  animate n3 ..> n2 : "fail"
  animate n2 ..> n1 : "undo"
  animate n1 ..> n0 : "500"
}
`);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(zonesPlacedFreely(doc)).toBe(true);
      expect(measurePrimaryRightward(doc, layout)).toBe(1);
      expect(measureCorridorIntrusions(doc, layout)).toBe(0);
      assertStageOrderPreserved([['g0'], ['g1'], ['g2'], ['g3']], layout);
    });

    it('tolerates late alert from auxiliary zone back to upstream primary zone', () => {
      const doc = parseValidDoc(`
group g0 "Ingress" {
  node u0 "GW"
}
group g1 "Service" {
  node u1 "API"
}
group g2 "Store" {
  node u2 "DB"
}
group sec "Security" {
  node siem "SIEM"
  node pager "Pager"
}
step "Normal" {
  static u0 ..> siem : "log"
  static u1 ..> siem : "audit"
  static u2 ..> siem : "slow"
  animate u0 --> u1 : "call"
  animate u1 --> u2 : "sql"
}
step "Audit" {
  animate siem --> pager : "rule"
}
step "Late Alert" {
  animate pager ..> u0 : "block"
}
`);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(zonesPlacedFreely(doc)).toBe(true);
      expect(measurePrimaryRightward(doc, layout)).toBe(1);
      expect(measureCorridorIntrusions(doc, layout, ['sec'])).toBe(0);
      assertStageOrderPreserved([['g0'], ['g1'], ['g2']], layout);
    });

    it('handles bidirectional <-> closing an upstream loop in a later step', () => {
      const doc = parseValidDoc(`
group g0 "Source" {
  node a "A"
}
group g1 "Mid" {
  node b "B"
}
group g2 "Sink" {
  node c "C"
}
step "Forward" {
  animate a --> b
  animate b --> c
}
step "Loopback" {
  animate c <-> a : "sync"
}
`);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(zonesPlacedFreely(doc)).toBe(true);
      expect(measurePrimaryRightward(doc, layout)).toBe(1);
      assertStageOrderPreserved([['g0'], ['g1'], ['g2']], layout);
    });

    it('keeps intra-zone return cycles distinct from inter-zone primary flow', () => {
      const doc = parseValidDoc(`
group g0 "In" {
  node a "A"
}
group g1 "Loop" {
  node b0 "B0"
  node b1 "B1"
  node b2 "B2"
}
group g2 "Out" {
  node c "C"
}
step "Flow" {
  animate a --> b0
  animate b0 --> b1
  animate b1 --> b2
  animate b2 --> b0 : "retry"
  animate b2 --> c
}
`);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(zonesPlacedFreely(doc)).toBe(true);
      expect(measurePrimaryRightward(doc, layout)).toBe(1);
      assertStageOrderPreserved([['g0'], ['g1'], ['g2']], layout);
      const backEdges = backEdgesOf(doc);
      expect(backEdges.length).toBeGreaterThanOrEqual(1);
      for (const be of backEdges) {
        expect(['b0', 'b1', 'b2']).toContain(be.from);
        expect(['b0', 'b1', 'b2']).toContain(be.to);
      }
    });
  });

  describe('T1.3 Layer separation and containment', () => {
    it('maintains zero intrusions across a strict 4-layer architecture', () => {
      const doc = parseValidDoc(`
group edge "Edge" {
  node cdn "CDN"
}
group ingress "Ingress" {
  node waf "WAF"
  node lb "LB"
}
group app "App" {
  node api "API"
  node worker "Worker"
}
group data "Data" {
  node pg "Postgres"
}
step "Request" {
  animate cdn --> waf
  animate waf --> lb
  animate lb --> api
  animate api --> worker
  animate worker --> pg
}
`);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(zonesPlacedFreely(doc)).toBe(true);
      expect(measurePrimaryRightward(doc, layout)).toBe(1);
      expect(measureCorridorIntrusions(doc, layout)).toBe(0);
      assertStageOrderPreserved([['edge'], ['ingress'], ['app'], ['data']], layout);
    });

    it('separates fan-out and fan-in diamond branches without corridor intrusion', () => {
      const doc = parseValidDoc(`
group g0 "Router" {
  node r "Router"
}
group g1 "North" {
  node n "North"
}
group g2 "South" {
  node s "South"
}
group g3 "Aggregator" {
  node a "Agg"
}
step "Fan" {
  animate r --> n
  animate r --> s
  animate n --> a
  animate s --> a
}
`);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(zonesPlacedFreely(doc)).toBe(true);
      expect(measurePrimaryRightward(doc, layout)).toBe(1);
      expect(measureCorridorIntrusions(doc, layout)).toBe(0);
      assertStageOrderPreserved([['g0'], ['g1', 'g2'], ['g3']], layout);
    });

    it('separates mixed ungrouped nodes and multi-zone groups cleanly', () => {
      const doc = parseValidDoc(`
node client "Client"
group api "API" {
  node gw "GW"
  node svc "SVC"
}
group db "DB" {
  node pg "PG"
}
node webhook "ExtWebhook"
step "Traffic" {
  animate client --> gw
  animate gw --> svc
  animate svc --> pg
  animate svc --> webhook
}
`);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(zonesPlacedFreely(doc)).toBe(true);
      expect(measurePrimaryRightward(doc, layout)).toBe(1);
      expect(measureCorridorIntrusions(doc, layout)).toBe(0);
      expect(centerX(rectOf(layout.nodes, 'client'))).toBeLessThan(
        centerX(rectOf(layout.groups, 'api')),
      );
      expect(centerX(rectOf(layout.groups, 'api'))).toBeLessThan(
        centerX(rectOf(layout.groups, 'db')),
      );
    });

    it('expands intra-zone column spacing for wide static labels without overlapping neighbors', () => {
      const baseDsl = (label: string) => `
group g0 "Upstream" {
  node a "A"
}
group g1 "Middle" {
  node m0 "M0"
  node m1 "M1"
}
group g2 "Downstream" {
  node b "B"
}
step "S" {
  animate a --> m0
  static m0 --> m1 : "${label}"
  animate m1 --> b
}
`;
      const shortDoc = parseValidDoc(baseDsl('x'));
      const wideDoc = parseValidDoc(
        baseDsl('Very Long Intra-Zone Compliance Validation Label Over TLS'),
      );
      const shortLayout = computeLayout(shortDoc);
      clearZoneCache();
      const wideLayout = computeLayout(wideDoc);
      assertValidLayout(shortDoc, shortLayout);
      assertValidLayout(wideDoc, wideLayout);
      expect(zonesPlacedFreely(shortDoc)).toBe(true);
      expect(zonesPlacedFreely(wideDoc)).toBe(true);
      expect(rectOf(wideLayout.groups, 'g1').width).toBeGreaterThan(
        rectOf(shortLayout.groups, 'g1').width,
      );
      expect(measureCorridorIntrusions(wideDoc, wideLayout)).toBe(0);
    });

    it('handles heavily unbalanced zone sizes without overlap or intrusion', () => {
      const doc = parseValidDoc(`
group small_in "In" {
  node entry "Entry"
}
${makeZoneGroup('huge_mid', 8, 'Worker')}
group small_out "Out" {
  node sink "Sink"
}
step "Flow" {
  animate entry --> huge_mid_n0
  animate huge_mid_n0 --> huge_mid_n1
  animate huge_mid_n1 --> huge_mid_n2
  animate huge_mid_n2 --> huge_mid_n3
  animate huge_mid_n3 --> huge_mid_n4
  animate huge_mid_n4 --> huge_mid_n5
  animate huge_mid_n5 --> huge_mid_n6
  animate huge_mid_n6 --> huge_mid_n7
  animate huge_mid_n7 --> sink
}
`);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(zonesPlacedFreely(doc)).toBe(true);
      expect(measurePrimaryRightward(doc, layout)).toBe(1);
      expect(measureCorridorIntrusions(doc, layout)).toBe(0);
      assertStageOrderPreserved([['small_in'], ['huge_mid'], ['small_out']], layout);
    });
  });

  describe('T1.4 Auxiliary and hub band placement', () => {
    it('places a static-only monitoring hub outside the primary stage corridor', () => {
      const doc = parseValidDoc(`
group g0 "Edge" {
  node n0 "N0"
}
group g1 "Core" {
  node n1 "N1"
}
group g2 "Store" {
  node n2 "N2"
}
group mon "Monitoring" {
  node prom "Prometheus"
}
step "Traffic" {
  animate n0 --> n1
  animate n1 --> n2
  static n0 ..> prom : "m0"
  static n1 ..> prom : "m1"
  static n2 ..> prom : "m2"
}
`);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(zonesPlacedFreely(doc)).toBe(true);
      expect(measurePrimaryRightward(doc, layout)).toBe(1);
      expect(measureCorridorIntrusions(doc, layout, ['mon'])).toBe(0);
      assertAuxBandSeparated(['g0', 'g1', 'g2'], ['mon'], layout);
      assertStageOrderPreserved([['g0'], ['g1'], ['g2']], layout);
    });

    it('separates dual upper and lower auxiliary hubs from multi-lane primary corridors', () => {
      const doc = parseValidDoc(`
group src "Src" {
  node s0 "S0"
  node s1 "S1"
  node s2 "S2"
}
group mid "Mid" {
  node m_top "Top"
  node m_mid "Mid"
  node m_bot "Bot"
}
group dst "Dst" {
  node d0 "D0"
  node d1 "D1"
  node d2 "D2"
}
group aux_top "Aux Top" {
  node at "AT"
}
group aux_bot "Aux Bot" {
  node ab "AB"
}
step "Backbone" {
  animate s0 --> m_top : "1"
  animate s1 --> m_mid : "2"
  animate s2 --> m_bot : "3"
  animate m_top --> d0 : "4"
  animate m_mid --> d1 : "5"
  animate m_bot --> d2 : "6"
  static s0 ..> at : "top1"
  static m_top ..> at : "top2"
  static d0 ..> at : "top3"
  static s2 ..> ab : "bot1"
  static m_bot ..> ab : "bot2"
  static d2 ..> ab : "bot3"
}
`);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(zonesPlacedFreely(doc)).toBe(true);
      expect(measurePrimaryRightward(doc, layout)).toBe(1);
      expect(measureCorridorIntrusions(doc, layout, ['aux_top', 'aux_bot'])).toBe(0);
      assertAuxBandSeparated(['src', 'mid', 'dst'], ['aux_top', 'aux_bot'], layout);
      assertStageOrderPreserved([['src'], ['mid'], ['dst']], layout);
    });

    it('places a shared multi-node utility bag without distorting primary stages', () => {
      const doc = parseValidDoc(`
group g0 "Gateway" {
  node gw "GW"
}
group g1 "Service" {
  node svc "SVC"
}
group g2 "Worker" {
  node wrk "WRK"
}
group platform "Shared Platform" {
  node cache "Redis"
  node vault "Vault"
}
step "Flow" {
  animate gw --> svc
  animate svc --> wrk
  static gw ..> cache : "rate"
  static svc ..> vault : "keys"
  static wrk ..> cache : "lock"
}
`);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(zonesPlacedFreely(doc)).toBe(true);
      expect(measurePrimaryRightward(doc, layout)).toBe(1);
      expect(measureCorridorIntrusions(doc, layout, ['platform'])).toBe(0);
      assertAuxBandSeparated(['g0', 'g1', 'g2'], ['platform'], layout);
      assertStageOrderPreserved([['g0'], ['g1'], ['g2']], layout);
    });

    it('keeps a static-heavy telemetry hub with one late animate alert out of primary corridors', () => {
      const doc = parseValidDoc(`
group g0 "Edge" {
  node e "Edge"
}
group g1 "App" {
  node a "App"
}
group g2 "Data" {
  node d "Data"
}
group siem "SIEM" {
  node collector "Collector"
}
step "S0" {
  animate e --> a
  static e ..> collector : "l1"
  static a ..> collector : "l2"
}
step "S1" {
  animate a --> d
  static d ..> collector : "l3"
}
step "Alert" {
  animate collector --> e : "block"
}
`);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(zonesPlacedFreely(doc)).toBe(true);
      expect(measurePrimaryRightward(doc, layout)).toBe(1);
      expect(measureCorridorIntrusions(doc, layout, ['siem'])).toBe(0);
      assertAuxBandSeparated(['g0', 'g1', 'g2'], ['siem'], layout);
      assertStageOrderPreserved([['g0'], ['g1'], ['g2']], layout);
    });

    it('guards against all-auxiliary collapse when inter-zone links are static alongside intra-zone animations', () => {
      const doc = parseValidDoc(`
group g0 "Stage0" {
  node a0 "A0"
  node a1 "A1"
}
group g1 "Stage1" {
  node b0 "B0"
  node b1 "B1"
}
group g2 "Stage2" {
  node c0 "C0"
  node c1 "C1"
}
step "StaticInter" {
  animate a0 --> a1
  animate b0 --> b1
  animate c0 --> c1
  static a1 --> b0
  static b1 --> c0
}
`);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(zonesPlacedFreely(doc)).toBe(true);
      expect(measureCorridorIntrusions(doc, layout)).toBe(0);
      assertStageOrderPreserved([['g0'], ['g1'], ['g2']], layout);
    });
  });

  describe('T1.5 Nested groups', () => {
    it('enforces 2-level nested containment inside a single top-level parent', () => {
      const doc = parseValidDoc(`
group vpc "VPC" {
  group subnet "Subnet" {
    node api "API"
    node db "DB"
  }
}
step "S" {
  animate api --> db
}
`);
      expect(zonesPlacedFreely(doc)).toBe(false);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(rectContains(rectOf(layout.groups, 'vpc'), rectOf(layout.groups, 'subnet'))).toBe(
        true,
      );
    });

    it('separates sibling nested groups inside one top-level zone alongside a second zone', () => {
      const doc = parseValidDoc(`
group edge "Edge" {
  node gw "Gateway"
}
group workloads "Workloads" {
  group k8s "K8s" {
    node podA "PodA"
    node podB "PodB"
  }
  group legacy "Legacy" {
    node vm "VM"
    node mq "MQ"
  }
}
step "Route" {
  animate gw --> podA
  animate podA --> podB
  animate gw --> vm
  animate vm --> mq
}
`);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(zonesPlacedFreely(doc)).toBe(true);
      expect(rectOverlaps(rectOf(layout.groups, 'k8s'), rectOf(layout.groups, 'legacy'))).toBe(
        false,
      );
      expect(measurePrimaryRightward(doc, layout)).toBe(1);
    });

    it('enforces containment across a 4-level nested group chain', () => {
      const doc = parseValidDoc(`
group g0 "L0" {
  group g1 "L1" {
    group g2 "L2" {
      group g3 "L3" {
        node leaf "Leaf"
      }
    }
  }
}
group ext "External" {
  node peer "Peer"
}
step "Call" {
  animate leaf --> peer
}
`);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(zonesPlacedFreely(doc)).toBe(true);
      expect(rectContains(rectOf(layout.groups, 'g0'), rectOf(layout.groups, 'g1'))).toBe(true);
      expect(rectContains(rectOf(layout.groups, 'g1'), rectOf(layout.groups, 'g2'))).toBe(true);
      expect(rectContains(rectOf(layout.groups, 'g2'), rectOf(layout.groups, 'g3'))).toBe(true);
      expect(rectContains(rectOf(layout.groups, 'g3'), rectOf(layout.nodes, 'leaf'))).toBe(true);
    });

    it('maintains forward L->R flow across nested subgroups in distinct top-level zones', () => {
      const doc = parseValidDoc(`
group z0 "Users" {
  group sub0 "Staff" {
    node browser "Browser"
  }
}
group z1 "Core" {
  group sub1 "Runtime" {
    node svc "Service"
  }
}
group z2 "Data" {
  group sub2 "Primary" {
    node db "DB"
  }
}
step "Flow" {
  animate browser --> svc
  animate svc --> db
}
`);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(zonesPlacedFreely(doc)).toBe(true);
      expect(measurePrimaryRightward(doc, layout)).toBe(1);
      expect(measureCorridorIntrusions(doc, layout)).toBe(0);
      assertStageOrderPreserved([['z0'], ['z1'], ['z2']], layout);
    });

    it('separates direct nodes from sibling nested groups within the same parent', () => {
      const doc = parseValidDoc(`
group outer "Outer" {
  node direct_a "DirectA"
  group inner "Inner" {
    node nested_a "NestedA"
    node nested_b "NestedB"
  }
}
group downstream "Downstream" {
  node sink "Sink"
}
step "Flow" {
  animate direct_a --> nested_a
  animate nested_a --> nested_b
  animate nested_b --> sink
}
`);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(zonesPlacedFreely(doc)).toBe(true);
      expect(rectOverlaps(rectOf(layout.nodes, 'direct_a'), rectOf(layout.groups, 'inner'))).toBe(
        false,
      );
    });
  });

  describe('T1.6 Isolated blocks and 0.0 drift guarantee', () => {
    const connectedMultiZone = `
group g0 "Edge" {
  node a0 "A0"
  node a1 "A1"
}
group g1 "Core" {
  node b0 "B0"
  node b1 "B1"
}
group g2 "Store" {
  node c0 "C0"
  node c1 "C1"
}
`;
    const connectedMultiSteps = `
  animate a0 --> a1
  animate a1 --> b0
  animate b0 --> b1
  animate b1 --> c0
  animate c0 --> c1
  animate a0 --> c0
`;

    it('causes 0.0 drift in >= 2 mode when adding an isolated top-level group', () => {
      const baseDoc = parseValidDoc(
        `${connectedMultiZone}\nstep "Flow" {\n${connectedMultiSteps}\n}`,
      );
      const isoDoc = parseValidDoc(
        `${connectedMultiZone}\ngroup g_iso "Isolated" {\n  node i0 "I0"\n  node i1 "I1"\n}\nstep "Flow" {\n${connectedMultiSteps}\n}`,
      );
      const before = computeLayout(baseDoc);
      clearZoneCache();
      const after = computeLayout(isoDoc);
      assertValidLayout(baseDoc, before);
      assertValidLayout(isoDoc, after);
      assertZeroConnectedDrift(
        baseDoc.nodes.map((n) => n.id),
        baseDoc.groups.map((g) => g.id),
        before,
        after,
      );
      expect(zonesPlacedFreely(baseDoc)).toBe(true);
      expect(zonesPlacedFreely(isoDoc)).toBe(true);
    });

    it('causes 0.0 drift in >= 2 mode when animating and self-looping inside an isolated group', () => {
      const baseDoc = parseValidDoc(
        `${connectedMultiZone}\nstep "Flow" {\n${connectedMultiSteps}\n}`,
      );
      const isoAnimDoc = parseValidDoc(
        `${connectedMultiZone}\ngroup g_iso "IsoAnim" {\n  node i0 "I0"\n  node i1 "I1"\n}\nstep "Flow" {\n${connectedMultiSteps}\n  animate i0 --> i1\n  animate i0 --> i0\n}`,
      );
      const before = computeLayout(baseDoc);
      clearZoneCache();
      const after = computeLayout(isoAnimDoc);
      assertValidLayout(isoAnimDoc, after);
      assertZeroConnectedDrift(
        baseDoc.nodes.map((n) => n.id),
        baseDoc.groups.map((g) => g.id),
        before,
        after,
      );
      expect(zonesPlacedFreely(baseDoc)).toBe(true);
      expect(zonesPlacedFreely(isoAnimDoc)).toBe(true);
    });

    it('causes 0.0 drift in >= 2 mode when adding isolated ungrouped nodes', () => {
      const baseDoc = parseValidDoc(
        `${connectedMultiZone}\nstep "Flow" {\n${connectedMultiSteps}\n}`,
      );
      const isoLooseDoc = parseValidDoc(
        `${connectedMultiZone}\nnode loose0 "L0"\nnode loose1 "L1"\nstep "Flow" {\n${connectedMultiSteps}\n}`,
      );
      const before = computeLayout(baseDoc);
      clearZoneCache();
      const after = computeLayout(isoLooseDoc);
      assertValidLayout(isoLooseDoc, after);
      assertZeroConnectedDrift(
        baseDoc.nodes.map((n) => n.id),
        baseDoc.groups.map((g) => g.id),
        before,
        after,
      );
      expect(zonesPlacedFreely(baseDoc)).toBe(true);
      expect(zonesPlacedFreely(isoLooseDoc)).toBe(true);
    });

    it('causes 0.0 drift in <= 1 mode (0 groups) when adding isolated ungrouped nodes with self-loop', () => {
      const baseDoc = parseValidDoc(`
node a "A"
node b "B"
node c "C"
step "Flow" {
  animate a --> b
  animate b --> c
}
`);
      const isoDoc = parseValidDoc(`
node a "A"
node b "B"
node c "C"
node iso0 "Iso0"
node iso1 "Iso1"
step "Flow" {
  animate a --> b
  animate b --> c
  animate iso0 --> iso0
}
`);
      expect(zonesPlacedFreely(baseDoc)).toBe(false);
      expect(zonesPlacedFreely(isoDoc)).toBe(false);
      const before = computeLayout(baseDoc);
      clearZoneCache();
      const after = computeLayout(isoDoc);
      assertValidLayout(baseDoc, before);
      assertValidLayout(isoDoc, after);
      assertZeroConnectedDrift(['a', 'b', 'c'], [], before, after);
    });

    it('causes 0.0 drift in <= 1 mode (1 group) when adding and animating isolated ungrouped nodes', () => {
      const baseDoc = parseValidDoc(`
group main "Main" {
  node a "A"
  node b "B"
}
node c "C"
step "Flow" {
  animate a --> b
  animate b --> c
}
`);
      const isoDoc = parseValidDoc(`
group main "Main" {
  node a "A"
  node b "B"
}
node c "C"
node iso0 "Iso0"
node iso1 "Iso1"
step "Flow" {
  animate a --> b
  animate b --> c
  animate iso0 --> iso1
}
`);
      expect(zonesPlacedFreely(baseDoc)).toBe(false);
      expect(zonesPlacedFreely(isoDoc)).toBe(false);
      const before = computeLayout(baseDoc);
      clearZoneCache();
      const after = computeLayout(isoDoc);
      assertValidLayout(baseDoc, before);
      assertValidLayout(isoDoc, after);
      assertZeroConnectedDrift(['a', 'b', 'c'], ['main'], before, after);
    });
  });

  describe('T1.7 Single-group layout (<= 1 top-level group)', () => {
    it('lays out a 0-group ungrouped DAG with zonesPlacedFreely === false', () => {
      const doc = parseValidDoc(`
node a "A"
node b "B"
node c "C"
node d "D"
node e "E"
step "DAG" {
  animate a --> b
  animate a --> c
  animate b --> d
  animate c --> d
  animate d --> e
}
`);
      expect(zonesPlacedFreely(doc)).toBe(false);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(centerX(rectOf(layout.nodes, 'a'))).toBeLessThan(centerX(rectOf(layout.nodes, 'b')));
      expect(centerX(rectOf(layout.nodes, 'd'))).toBeLessThan(centerX(rectOf(layout.nodes, 'e')));
    });

    it('lays out a 1-group internal pipeline monotonically left-to-right', () => {
      const doc = parseValidDoc(`
group app "App" {
  node a "A"
  node b "B"
  node c "C"
  node d "D"
}
step "Pipe" {
  animate a --> b
  animate b --> c
  animate c --> d
}
`);
      expect(zonesPlacedFreely(doc)).toBe(false);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(rectOf(layout.nodes, 'a').x).toBeLessThan(rectOf(layout.nodes, 'b').x);
      expect(rectOf(layout.nodes, 'b').x).toBeLessThan(rectOf(layout.nodes, 'c').x);
      expect(rectOf(layout.nodes, 'c').x).toBeLessThan(rectOf(layout.nodes, 'd').x);
    });

    it('keeps zonesPlacedFreely === false when 1 top-level group contains nested child groups', () => {
      const doc = parseValidDoc(`
group vpc "VPC" {
  group web "Web" {
    node w "W"
  }
  group db "DB" {
    node d "D"
  }
}
step "Call" {
  animate w --> d
}
`);
      expect(topLevelGroups(doc.groups)).toHaveLength(1);
      expect(zonesPlacedFreely(doc)).toBe(false);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(rectOf(layout.nodes, 'w').x).toBeLessThan(rectOf(layout.nodes, 'd').x);
    });

    it('handles 1 top-level group mixed with ungrouped upstream and downstream nodes', () => {
      const doc = parseValidDoc(`
node client "Client"
group vpc "VPC" {
  node api "API"
  node db "DB"
}
node ext "External"
step "Flow" {
  animate client --> api
  animate api --> db
  animate db --> ext
}
`);
      expect(zonesPlacedFreely(doc)).toBe(false);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(rectOf(layout.nodes, 'client').x).toBeLessThan(rectOf(layout.nodes, 'api').x);
      expect(rectOf(layout.nodes, 'api').x).toBeLessThan(rectOf(layout.nodes, 'db').x);
      expect(rectOf(layout.nodes, 'db').x).toBeLessThan(rectOf(layout.nodes, 'ext').x);
    });

    it('reports diagram-wide backEdgesOf in <= 1 mode', () => {
      const doc = parseValidDoc(`
group g0 "Core" {
  node a "A"
  node b "B"
}
node c "C"
step "Cycle" {
  animate a --> b
  animate b --> c
  animate c --> a
}
`);
      expect(zonesPlacedFreely(doc)).toBe(false);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      const back: BackEdge[] = backEdgesOf(doc);
      expect(back.length).toBeGreaterThanOrEqual(1);
      for (const edge of back) {
        expect(rectOf(layout.nodes, edge.from).x).toBeGreaterThanOrEqual(
          rectOf(layout.nodes, edge.to).x,
        );
      }
    });
  });

  describe('T1.8 Multi-zone free placement (>= 2 top-level groups)', () => {
    it('sets zonesPlacedFreely === true even for 2 compact short-linked zones', () => {
      const doc = parseValidDoc(`
group g0 "G0" {
  node a0 "A0"
  node a1 "A1"
}
group g1 "G1" {
  node b0 "B0"
  node b1 "B1"
}
step "Compact" {
  static a0 --> a1
  static b0 --> b1
  static a1 --> b0
}
`);
      expect(zonesPlacedFreely(doc)).toBe(true);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
    });

    it('sets zonesPlacedFreely === true for 2 completely disconnected zones', () => {
      const doc = parseValidDoc(`
group g0 "G0" {
  node a0 "A0"
  node a1 "A1"
}
group g1 "G1" {
  node b0 "B0"
  node b1 "B1"
}
step "LocalOnly" {
  animate a0 --> a1
  animate b0 --> b1
}
`);
      expect(zonesPlacedFreely(doc)).toBe(true);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
    });

    it('sets zonesPlacedFreely === true for 2 empty top-level groups', () => {
      const doc = parseValidDoc(`
group g0 "Empty0" {}
group g1 "Empty1" {}
step "Empty" {}
`);
      expect(zonesPlacedFreely(doc)).toBe(true);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
    });

    it('places 3-zone primary flow freely with Pillar 1 preserved', () => {
      const doc = parseValidDoc(`
group g0 "In" {
  node a0 "A0"
}
group g1 "Mid" {
  node b0 "B0"
}
group g2 "Out" {
  node c0 "C0"
}
step "Flow" {
  animate a0 --> b0
  animate b0 --> c0
}
`);
      expect(zonesPlacedFreely(doc)).toBe(true);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(measurePrimaryRightward(doc, layout)).toBe(1);
    });

    it('limits backEdgesOf in >= 2 mode strictly to intra-zone loops', () => {
      const doc = parseValidDoc(`
group g0 "In" {
  node a0 "A0"
}
group g1 "Loop" {
  node b0 "B0"
  node b1 "B1"
  node b2 "B2"
}
group g2 "Out" {
  node c0 "C0"
}
step "MixedCycles" {
  animate a0 --> b0
  animate b0 --> b1
  animate b1 --> b2
  animate b2 --> b0
  animate b2 --> c0
  animate c0 --> a0
}
`);
      expect(zonesPlacedFreely(doc)).toBe(true);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      const owners = zoneOfNodes(doc);
      const back = backEdgesOf(doc);
      expect(back.length).toBeGreaterThanOrEqual(1);
      for (const edge of back) {
        expect(owners.get(edge.from)).toBe(owners.get(edge.to));
      }
    });
  });

  describe('T1.9 Non-flow and static row-wrapping', () => {
    it('wraps a pure static 10-zone chain without skip links into multiple non-overlapping rows', () => {
      const doc = parseValidDoc(makeStaticMeshDsl(10, 2, false));
      expect(zonesPlacedFreely(doc)).toBe(true);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      const topRects = topLevelGroups(doc.groups).map((g) => rectOf(layout.groups, g.id));
      assertRowWrapped(topRects, layout, 0.8, 5.0);
    });

    it('wraps a 12-zone static multi-tier mesh cleanly without excessive aspect', () => {
      const doc = parseValidDoc(makeStaticMeshDsl(12, 3));
      expect(zonesPlacedFreely(doc)).toBe(true);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      const topRects = topLevelGroups(doc.groups).map((g) => rectOf(layout.groups, g.id));
      assertRowWrapped(topRects, layout, 1, 5.0);
    });

    it('wraps an ultra-wide 10-zone animated strip into multiple L->R rows', () => {
      const doc = parseValidDoc(makeWideAnimatedStripDsl(10, 3));
      expect(zonesPlacedFreely(doc)).toBe(true);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      const topRects = topLevelGroups(doc.groups).map((g) => rectOf(layout.groups, g.id));
      const rows = assertRowWrapped(topRects, layout, 1, 5.5);

      const rowIndexByGroup = new Map<string, number>();
      for (let r = 0; r < rows.length; r++) {
        for (const rect of rows[r] ?? []) {
          for (const g of topLevelGroups(doc.groups)) {
            if (rectOf(layout.groups, g.id) === rect) {
              rowIndexByGroup.set(g.id, r);
            }
          }
        }
      }
      for (let z = 0; z < 9; z++) {
        const curRect = rectOf(layout.groups, `w${z}`);
        const nxtRect = rectOf(layout.groups, `w${z + 1}`);
        const rCur = rowIndexByGroup.get(`w${z}`) ?? 0;
        const rNxt = rowIndexByGroup.get(`w${z + 1}`) ?? 0;
        if (rCur === rNxt) {
          expect(centerX(nxtRect)).toBeGreaterThan(centerX(curRect));
        } else {
          expect(rNxt).toBeGreaterThan(rCur);
          expect(centerY(nxtRect)).toBeGreaterThan(centerY(curRect));
        }
      }
    });

    it('splits a tall static star fan-out across multiple X columns instead of a vertical tower', () => {
      const leaves = Array.from(
        { length: 8 },
        (_, i) => `group leaf${i} "Leaf${i}" {\n  node l${i} "L${i}"\n}`,
      ).join('\n');
      const links = Array.from({ length: 8 }, (_, i) => `  static hub_n --> l${i}`).join('\n');
      const doc = parseValidDoc(
        `group hub "Hub" {\n  node hub_n "Hub"\n}\n${leaves}\nstep "Star" {\n${links}\n}`,
      );
      expect(zonesPlacedFreely(doc)).toBe(true);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      const leafXs = new Set(
        Array.from({ length: 8 }, (_, i) => Math.round(rectOf(layout.groups, `leaf${i}`).x)),
      );
      expect(leafXs.size).toBeGreaterThanOrEqual(2);
      expect(layoutAspect(layout)).toBeGreaterThanOrEqual(0.8);
    });

    it('wraps an 8-zone static mesh with backward and diagonal links cleanly', () => {
      const groups = Array.from({ length: 8 }, (_, i) => makeZoneGroup(`m${i}`, 2)).join('\n');
      const doc = parseValidDoc(`
${groups}
step "Mesh" {
  static m0_n0 --> m0_n1
  static m0_n1 --> m1_n0
  static m1_n0 --> m2_n0
  static m2_n0 --> m3_n0
  static m3_n0 --> m4_n0
  static m4_n0 --> m5_n0
  static m5_n0 --> m6_n0
  static m6_n0 --> m7_n0
  static m7_n0 ..> m0_n0
  static m2_n1 ..> m5_n1
  static m1_n1 ..> m6_n1
}
`);
      expect(zonesPlacedFreely(doc)).toBe(true);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      const topRects = topLevelGroups(doc.groups).map((g) => rectOf(layout.groups, g.id));
      assertRowWrapped(topRects, layout, 0.8, 5.5);
    });
  });

  describe('T1.10 Determinism and edit invariance', () => {
    const sampleDsl = `
title "Determinism"
group g0 "Edge" {
  node a0 "A0"
  node a1 "A1"
}
group g1 "Core" {
  node b0 "B0"
  node b1 "B1"
}
group g2 "Data" {
  node c0 "C0"
}
group obs "Obs" {
  node mon "Mon"
}
step "Main" {
  animate a0 --> a1 : "in"
  animate a1 --> b0 : "call"
  animate b0 --> b1 : "proc"
  animate b1 --> c0 : "save"
  animate c0 ..> b1 : "ack"
  static b0 ..> mon : "metric"
  static c0 ..> mon : "slow"
}
`;

    it('produces byte-identical layouts across 5 consecutive cold runs', () => {
      const baseDoc = parseValidDoc(sampleDsl);
      const baseline = computeLayout(baseDoc);
      for (let i = 0; i < 5; i++) {
        clearZoneCache();
        const run = computeLayout(parseValidDoc(sampleDsl));
        expect(run).toEqual(baseline);
      }
      expect(zonesPlacedFreely(baseDoc)).toBe(true);
    });

    it('is immune to interleaved layouts of unrelated diagrams', () => {
      const doc = parseValidDoc(sampleDsl);
      const first = computeLayout(doc);
      computeLayout(parseValidDoc(makeStaticMeshDsl(6, 2)));
      computeLayout(parseValidDoc(makeWideAnimatedStripDsl(8, 2)));
      const second = computeLayout(doc);
      expect(second).toEqual(first);
      expect(zonesPlacedFreely(doc)).toBe(true);
    });

    it('ignores pure annotation steps (desc, focus, state) with 0.0 drift', () => {
      const baseDoc = parseValidDoc(sampleDsl);
      const annotatedDoc = parseValidDoc(`
${sampleDsl}
step "Commentary" {
  desc "Explains the core processing step without adding edges."
  focus b0, b1
  state b0 [badge: "Hot", color: orange]
}
`);
      const before = computeLayout(baseDoc);
      clearZoneCache();
      const after = computeLayout(annotatedDoc);
      expect(after).toEqual(before);
      expect(zonesPlacedFreely(baseDoc)).toBe(true);
      expect(zonesPlacedFreely(annotatedDoc)).toBe(true);
    });

    it('keeps 0.0 drift when editing node labels, subs, badges, and animate labels', () => {
      const baseDoc = parseValidDoc(sampleDsl);
      const editedDoc = parseValidDoc(`
title "Edited Labels"
group g0 "Ingress Edge Layer" {
  node a0 "Browser Client" [sub: "SPA", badge: "v2"]
  node a1 "API Router"
}
group g1 "Core Processing Cluster" {
  node b0 "Order Service" [badge: "Primary"]
  node b1 "Ledger Writer"
}
group g2 "Persistent Storage" {
  node c0 "PostgreSQL Primary"
}
group obs "Observability" {
  node mon "Prometheus"
}
step "Main" {
  animate a0 --> a1 : "HTTPS POST /orders"
  animate a1 --> b0 : "gRPC CreateOrder"
  animate b0 --> b1 : "TxBegin"
  animate b1 --> c0 : "INSERT INTO ledger"
  animate c0 ..> b1 : "COMMIT OK"
  static b0 ..> mon : "metric"
  static c0 ..> mon : "slow"
}
`);
      const before = computeLayout(baseDoc);
      clearZoneCache();
      const after = computeLayout(editedDoc);
      expect(after).toEqual(before);
      expect(zonesPlacedFreely(baseDoc)).toBe(true);
      expect(zonesPlacedFreely(editedDoc)).toBe(true);
    });

    it('keeps 0.0 drift when repeating an already-classified pair in a later active step', () => {
      const baseDsl = `
group g0 "G0" {
  node a0 "A0"
}
group g1 "G1" {
  node b0 "B0"
}
group g2 "G2" {
  node c0 "C0"
}
step "S1" {
  animate a0 --> b0 : "first"
}
step "S2" {
  animate b0 --> c0 : "second"
}
`;
      const repeatDsl = `
${baseDsl}
step "S3" {
  animate b0 --> c0 : "repeat"
  animate a0 --> b0 : "repeat2"
}
`;
      const baseDoc = parseValidDoc(baseDsl);
      const repeatDoc = parseValidDoc(repeatDsl);
      const before = computeLayout(baseDoc);
      clearZoneCache();
      const after = computeLayout(repeatDoc);
      expect(after).toEqual(before);
      expect(zonesPlacedFreely(baseDoc)).toBe(true);
      expect(zonesPlacedFreely(repeatDoc)).toBe(true);
    });
  });
});

// ============================================================================
// TIER 2: Boundary & Corner-Case Tests
// ============================================================================

describe('Tier 2 — Boundary & Corner-Case Tests', () => {
  describe('B1: 35 -> 36 connected nodes continuity', () => {
    it('B1.1 preserves stage-X order and Pillar 1 when adding 36th node to trailing zone', () => {
      const doc35 = parseValidDoc(makeConnectedNodeFlowDsl(false));
      const doc36 = parseValidDoc(makeConnectedNodeFlowDsl(true));
      expect(doc35.nodes).toHaveLength(35);
      expect(doc36.nodes).toHaveLength(36);

      const l35 = computeLayout(doc35);
      clearZoneCache();
      const l36 = computeLayout(doc36);
      assertValidLayout(doc35, l35);
      assertValidLayout(doc36, l36);

      expect(measurePrimaryRightward(doc35, l35)).toBe(1);
      expect(measurePrimaryRightward(doc36, l36)).toBe(1);
      expect(measureCorridorIntrusions(doc35, l35)).toBe(0);
      expect(measureCorridorIntrusions(doc36, l36)).toBe(0);

      const stages = [['z0'], ['z1', 'z2'], ['z3', 'z4'], ['z5'], ['z6']];
      expect(layoutAspect(l35)).toBeGreaterThan(1);
      expect(layoutAspect(l35)).toBeLessThanOrEqual(6.5);
      expect(layoutAspect(l36)).toBeGreaterThan(1);
      expect(layoutAspect(l36)).toBeLessThanOrEqual(6.5);
      assertSkeletonContinuity(stages, l35, l36);
      expect(zonesPlacedFreely(doc35)).toBe(true);
      expect(zonesPlacedFreely(doc36)).toBe(true);
    });

    it('B1.2 preserves stage-X order when adding 36th node inside a middle zone (widening middle stage)', () => {
      const makeMidDsl = (extra: boolean) => {
        const groups = Array.from({ length: 7 }, (_, z) =>
          makeZoneGroup(`z${z}`, z === 3 && extra ? 6 : 5),
        ).join('\n');
        const edges: string[] = [];
        for (let z = 0; z < 7; z++) {
          edges.push(
            `  animate z${z}_n0 --> z${z}_n1`,
            `  animate z${z}_n0 --> z${z}_n2`,
            `  animate z${z}_n1 --> z${z}_n3`,
            `  animate z${z}_n2 --> z${z}_n4`,
          );
        }
        if (extra) {
          edges.push('  animate z3_n3 --> z3_n5');
        }
        edges.push(
          '  animate z0_n3 --> z1_n0',
          '  animate z0_n4 --> z2_n0',
          '  animate z1_n3 --> z3_n0',
          '  animate z2_n4 --> z3_n0',
          '  animate z3_n3 --> z4_n0',
          '  animate z3_n4 --> z5_n0',
          '  animate z4_n3 --> z6_n0',
          '  animate z5_n4 --> z6_n0',
        );
        return `title "Mid35-36"\n${groups}\nstep "Flow" {\n${edges.join('\n')}\n}`;
      };
      const doc35 = parseValidDoc(makeMidDsl(false));
      const doc36 = parseValidDoc(makeMidDsl(true));
      expect(doc35.nodes).toHaveLength(35);
      expect(doc36.nodes).toHaveLength(36);

      const l35 = computeLayout(doc35);
      clearZoneCache();
      const l36 = computeLayout(doc36);
      assertValidLayout(doc35, l35);
      assertValidLayout(doc36, l36);
      expect(measurePrimaryRightward(doc35, l35)).toBe(1);
      expect(measurePrimaryRightward(doc36, l36)).toBe(1);
      expect(measureCorridorIntrusions(doc35, l35)).toBe(0);
      expect(measureCorridorIntrusions(doc36, l36)).toBe(0);
      expect(layoutAspect(l35)).toBeGreaterThan(1);
      expect(layoutAspect(l35)).toBeLessThanOrEqual(6.5);
      expect(layoutAspect(l36)).toBeGreaterThan(1);
      expect(layoutAspect(l36)).toBeLessThanOrEqual(6.5);
      assertSkeletonContinuity([['z0'], ['z1', 'z2'], ['z3'], ['z4', 'z5'], ['z6']], l35, l36);
      expect(zonesPlacedFreely(doc35)).toBe(true);
      expect(zonesPlacedFreely(doc36)).toBe(true);
    });

    it('B1.3 preserves primary corridors when 36th node is added inside an auxiliary zone', () => {
      // 6 primary zones in 4 stages: p0 -> (p1, p2) -> (p3, p4) -> p5, 2-3 internal columns each (5 nodes/zone = 30) + aux (5 -> 6) = 35 -> 36
      const makeWithAux = (extraAux: boolean) => {
        const pri = Array.from({ length: 6 }, (_, z) => makeZoneGroup(`p${z}`, 5)).join('\n');
        const aux = makeZoneGroup('aux', extraAux ? 6 : 5);
        const edges: string[] = [];
        for (let z = 0; z < 6; z++) {
          edges.push(
            `  animate p${z}_n0 --> p${z}_n1`,
            `  animate p${z}_n0 --> p${z}_n2`,
            `  animate p${z}_n1 --> p${z}_n3`,
            `  animate p${z}_n2 --> p${z}_n4`,
            `  static p${z}_n0 ..> aux_n0`,
          );
        }
        edges.push(
          '  animate p0_n3 --> p1_n0',
          '  animate p0_n4 --> p2_n0',
          '  animate p1_n3 --> p3_n0',
          '  animate p2_n4 --> p4_n0',
          '  animate p3_n3 --> p5_n0',
          '  animate p4_n4 --> p5_n0',
        );
        const auxCount = extraAux ? 6 : 5;
        for (let i = 0; i < auxCount - 1; i++) {
          edges.push(`  static aux_n${i} --> aux_n${i + 1}`);
        }
        return `${pri}\n${aux}\nstep "Flow" {\n${edges.join('\n')}\n}`;
      };
      const doc35 = parseValidDoc(makeWithAux(false));
      const doc36 = parseValidDoc(makeWithAux(true));
      expect(doc35.nodes).toHaveLength(35);
      expect(doc36.nodes).toHaveLength(36);

      const l35 = computeLayout(doc35);
      clearZoneCache();
      const l36 = computeLayout(doc36);
      assertValidLayout(doc35, l35);
      assertValidLayout(doc36, l36);
      expect(measurePrimaryRightward(doc35, l35)).toBe(1);
      expect(measurePrimaryRightward(doc36, l36)).toBe(1);
      expect(measureCorridorIntrusions(doc35, l35, ['aux'])).toBe(0);
      expect(measureCorridorIntrusions(doc36, l36, ['aux'])).toBe(0);
      expect(layoutAspect(l35)).toBeGreaterThan(1);
      expect(layoutAspect(l35)).toBeLessThanOrEqual(6.5);
      expect(layoutAspect(l36)).toBeGreaterThan(1);
      expect(layoutAspect(l36)).toBeLessThanOrEqual(6.5);
      assertSkeletonContinuity([['p0'], ['p1', 'p2'], ['p3', 'p4'], ['p5']], l35, l36, ['aux']);
      expect(zonesPlacedFreely(doc35)).toBe(true);
      expect(zonesPlacedFreely(doc36)).toBe(true);
    });

    it('B1.4 preserves branching DAG + return tolerance across 35 -> 36 connected nodes', () => {
      const makeBranchDsl = (extra: boolean) => {
        // 6 zones: 6+6+6+6+6+5 = 35 -> 36, each zone 2-3 internal columns (fan-out/fan-in)
        const counts = [6, 6, 6, 6, 6, extra ? 6 : 5];
        const groups = counts.map((c, z) => makeZoneGroup(`b${z}`, c)).join('\n');
        const edges: string[] = [];
        for (let z = 0; z < 6; z++) {
          const cnt = counts[z] ?? 5;
          edges.push(
            `  animate b${z}_n0 --> b${z}_n1`,
            `  animate b${z}_n0 --> b${z}_n2`,
            `  animate b${z}_n1 --> b${z}_n3`,
            `  animate b${z}_n2 --> b${z}_n4`,
          );
          if (cnt >= 6) {
            edges.push(`  animate b${z}_n3 --> b${z}_n5`);
          }
        }
        edges.push(
          '  animate b0_n3 --> b1_n0',
          '  animate b0_n4 --> b2_n0',
          '  animate b1_n3 --> b3_n0',
          '  animate b2_n4 --> b4_n0',
          '  animate b3_n3 --> b5_n0',
          '  animate b4_n4 --> b5_n0',
          '  animate b5_n0 ..> b0_n0',
        );
        return `${groups}\nstep "Branch" {\n${edges.join('\n')}\n}`;
      };
      const doc35 = parseValidDoc(makeBranchDsl(false));
      const doc36 = parseValidDoc(makeBranchDsl(true));
      expect(doc35.nodes).toHaveLength(35);
      expect(doc36.nodes).toHaveLength(36);

      const l35 = computeLayout(doc35);
      clearZoneCache();
      const l36 = computeLayout(doc36);
      assertValidLayout(doc35, l35);
      assertValidLayout(doc36, l36);
      expect(measurePrimaryRightward(doc35, l35)).toBe(1);
      expect(measurePrimaryRightward(doc36, l36)).toBe(1);
      expect(measureCorridorIntrusions(doc35, l35)).toBe(0);
      expect(measureCorridorIntrusions(doc36, l36)).toBe(0);
      expect(layoutAspect(l35)).toBeGreaterThan(1);
      expect(layoutAspect(l35)).toBeLessThanOrEqual(6.5);
      expect(layoutAspect(l36)).toBeGreaterThan(1);
      expect(layoutAspect(l36)).toBeLessThanOrEqual(6.5);
      assertSkeletonContinuity([['b0'], ['b1', 'b2'], ['b3', 'b4'], ['b5']], l35, l36);
      expect(zonesPlacedFreely(doc35)).toBe(true);
      expect(zonesPlacedFreely(doc36)).toBe(true);
    });

    it('B1.5 preserves nested containment and stage order across 35 -> 36 nodes', () => {
      const makeNestedDsl = (extra: boolean) => {
        const z0 = `group z0 "Z0" {\n  group sub0 "Sub0" {\n    node z0_n0 "N0"\n    node z0_n1 "N1"\n    node z0_n2 "N2"\n    node z0_n3 "N3"\n    node z0_n4 "N4"\n  }\n}`;
        const others = [1, 2, 3, 4, 5].map((z) => makeZoneGroup(`z${z}`, 5)).join('\n');
        const z6 = makeZoneGroup('z6', extra ? 6 : 5);
        const edges: string[] = [];
        for (let z = 0; z < 7; z++) {
          edges.push(
            `  animate z${z}_n0 --> z${z}_n1`,
            `  animate z${z}_n0 --> z${z}_n2`,
            `  animate z${z}_n1 --> z${z}_n3`,
            `  animate z${z}_n2 --> z${z}_n4`,
          );
        }
        if (extra) {
          edges.push('  animate z6_n3 --> z6_n5');
        }
        edges.push(
          '  animate z0_n3 --> z1_n0',
          '  animate z0_n4 --> z2_n0',
          '  animate z1_n3 --> z3_n0',
          '  animate z2_n4 --> z4_n0',
          '  animate z3_n3 --> z5_n0',
          '  animate z4_n4 --> z5_n0',
          '  animate z5_n3 --> z6_n0',
        );
        return `${z0}\n${others}\n${z6}\nstep "NestedFlow" {\n${edges.join('\n')}\n}`;
      };
      const doc35 = parseValidDoc(makeNestedDsl(false));
      const doc36 = parseValidDoc(makeNestedDsl(true));
      expect(doc35.nodes).toHaveLength(35);
      expect(doc36.nodes).toHaveLength(36);

      const l35 = computeLayout(doc35);
      clearZoneCache();
      const l36 = computeLayout(doc36);
      assertValidLayout(doc35, l35);
      assertValidLayout(doc36, l36);
      expect(measurePrimaryRightward(doc35, l35)).toBe(1);
      expect(measurePrimaryRightward(doc36, l36)).toBe(1);
      expect(measureCorridorIntrusions(doc35, l35)).toBe(0);
      expect(measureCorridorIntrusions(doc36, l36)).toBe(0);
      expect(layoutAspect(l35)).toBeGreaterThan(1);
      expect(layoutAspect(l35)).toBeLessThanOrEqual(6.5);
      expect(layoutAspect(l36)).toBeGreaterThan(1);
      expect(layoutAspect(l36)).toBeLessThanOrEqual(6.5);
      assertSkeletonContinuity([['z0'], ['z1', 'z2'], ['z3', 'z4'], ['z5'], ['z6']], l35, l36);
      expect(zonesPlacedFreely(doc35)).toBe(true);
      expect(zonesPlacedFreely(doc36)).toBe(true);
    });
  });

  describe('B2: 14 -> 15 connected zones continuity', () => {
    const sharedStages14 = [
      ['z0', 'z1', 'z2'],
      ['z3', 'z4', 'z5'],
      ['z6', 'z7', 'z8'],
      ['z9', 'z10', 'z11'],
      ['z12', 'z13'],
    ];
    const stages15 = [
      ['z0', 'z1', 'z2'],
      ['z3', 'z4', 'z5'],
      ['z6', 'z7', 'z8'],
      ['z9', 'z10', 'z11'],
      ['z12', 'z13', 'z14'],
    ];

    it('B2.1 preserves stage order and Pillar 1 at 14 -> 15 zones while keeping <= 35 nodes', () => {
      const doc14 = parseValidDoc(makeMultiZoneStageDsl(14, 2));
      const doc15 = parseValidDoc(makeMultiZoneStageDsl(15, 2));
      expect(topLevelGroups(doc14.groups)).toHaveLength(14);
      expect(topLevelGroups(doc15.groups)).toHaveLength(15);
      expect(doc14.nodes).toHaveLength(28);
      expect(doc15.nodes).toHaveLength(30);

      const l14 = computeLayout(doc14);
      clearZoneCache();
      const l15 = computeLayout(doc15);
      assertValidLayout(doc14, l14);
      assertValidLayout(doc15, l15);

      expect(measurePrimaryRightward(doc14, l14)).toBe(1);
      expect(measurePrimaryRightward(doc15, l15)).toBe(1);
      expect(measureCorridorIntrusions(doc14, l14)).toBe(0);
      expect(measureCorridorIntrusions(doc15, l15)).toBe(0);

      expect(layoutAspect(l14)).toBeGreaterThan(1);
      expect(layoutAspect(l14)).toBeLessThanOrEqual(6.5);
      expect(layoutAspect(l15)).toBeGreaterThan(1);
      expect(layoutAspect(l15)).toBeLessThanOrEqual(6.5);
      assertSkeletonContinuity(sharedStages14, l14, l15);
      assertStageOrderPreserved(stages15, l15);
      expect(zonesPlacedFreely(doc14)).toBe(true);
      expect(zonesPlacedFreely(doc15)).toBe(true);
    });

    it('B2.2 preserves stage order at 14 -> 15 zones when node count exceeds 35', () => {
      const doc14 = parseValidDoc(makeMultiZoneStageDsl(14, 3));
      const doc15 = parseValidDoc(makeMultiZoneStageDsl(15, 3));
      expect(doc14.nodes).toHaveLength(42);
      expect(doc15.nodes).toHaveLength(45);

      const l14 = computeLayout(doc14);
      clearZoneCache();
      const l15 = computeLayout(doc15);
      assertValidLayout(doc14, l14);
      assertValidLayout(doc15, l15);
      expect(measurePrimaryRightward(doc14, l14)).toBe(1);
      expect(measurePrimaryRightward(doc15, l15)).toBe(1);
      expect(measureCorridorIntrusions(doc14, l14)).toBe(0);
      expect(measureCorridorIntrusions(doc15, l15)).toBe(0);
      expect(layoutAspect(l14)).toBeGreaterThan(1);
      expect(layoutAspect(l14)).toBeLessThanOrEqual(6.5);
      expect(layoutAspect(l15)).toBeGreaterThan(1);
      expect(layoutAspect(l15)).toBeLessThanOrEqual(6.5);
      assertSkeletonContinuity(sharedStages14, l14, l15);
      assertStageOrderPreserved(stages15, l15);
      expect(zonesPlacedFreely(doc14)).toBe(true);
      expect(zonesPlacedFreely(doc15)).toBe(true);
    });

    it('B2.3 keeps primary stage order intact when adding 15th zone as an auxiliary hub', () => {
      const base14 = makeMultiZoneStageDsl(14, 2);
      const with15Aux = `${base14.replace(/step "Pipeline" \{[\s\S]*\}/, '')}
group aux14 "Monitoring" {
  node mon0 "Mon0"
  node mon1 "Mon1"
}
${base14.match(/step "Pipeline" \{[\s\S]*\}/)?.[0].replace(/\}$/, '  static z0_n0 ..> mon0\n  static z6_n0 ..> mon0\n  static z12_n0 ..> mon1\n  static mon0 --> mon1\n}') ?? ''}
`;
      const doc14 = parseValidDoc(base14);
      const doc15 = parseValidDoc(with15Aux);
      expect(topLevelGroups(doc15.groups)).toHaveLength(15);

      const l14 = computeLayout(doc14);
      clearZoneCache();
      const l15 = computeLayout(doc15);
      assertValidLayout(doc14, l14);
      assertValidLayout(doc15, l15);
      expect(measurePrimaryRightward(doc14, l14)).toBe(1);
      expect(measurePrimaryRightward(doc15, l15)).toBe(1);
      expect(measureCorridorIntrusions(doc14, l14)).toBe(0);
      expect(measureCorridorIntrusions(doc15, l15, ['aux14'])).toBe(0);
      expect(layoutAspect(l14)).toBeGreaterThan(1);
      expect(layoutAspect(l14)).toBeLessThanOrEqual(6.5);
      expect(layoutAspect(l15)).toBeGreaterThan(1);
      expect(layoutAspect(l15)).toBeLessThanOrEqual(6.5);
      assertSkeletonContinuity(sharedStages14, l14, l15);
      assertAuxBandSeparated(sharedStages14.flat(), ['aux14'], l15);
      expect(zonesPlacedFreely(doc14)).toBe(true);
      expect(zonesPlacedFreely(doc15)).toBe(true);
    });

    it('B2.4 handles 14 -> 15 zones with nested child groups cleanly', () => {
      const buildNested = (count: number) => {
        const groups = Array.from({ length: count }, (_, i) =>
          i === 0
            ? `group z0 "Z0" {\n  group sub0 "Sub0" {\n    node z0_n0 "N0"\n    node z0_n1 "N1"\n  }\n}`
            : makeZoneGroup(`z${i}`, 2),
        ).join('\n');
        const edges: string[] = [];
        for (let z = 0; z < count; z++) {
          edges.push(`  animate z${z}_n0 --> z${z}_n1`);
          if (z + 3 < count) edges.push(`  animate z${z}_n1 --> z${z + 3}_n0`);
        }
        return `${groups}\nstep "NestedPipeline" {\n${edges.join('\n')}\n}`;
      };
      const doc14 = parseValidDoc(buildNested(14));
      const doc15 = parseValidDoc(buildNested(15));
      const l14 = computeLayout(doc14);
      clearZoneCache();
      const l15 = computeLayout(doc15);
      assertValidLayout(doc14, l14);
      assertValidLayout(doc15, l15);
      expect(measurePrimaryRightward(doc14, l14)).toBe(1);
      expect(measurePrimaryRightward(doc15, l15)).toBe(1);
      expect(measureCorridorIntrusions(doc14, l14)).toBe(0);
      expect(measureCorridorIntrusions(doc15, l15)).toBe(0);
      expect(layoutAspect(l14)).toBeGreaterThan(1);
      expect(layoutAspect(l14)).toBeLessThanOrEqual(6.5);
      expect(layoutAspect(l15)).toBeGreaterThan(1);
      expect(layoutAspect(l15)).toBeLessThanOrEqual(6.5);
      assertSkeletonContinuity(sharedStages14, l14, l15);
      assertStageOrderPreserved(stages15, l15);
      expect(zonesPlacedFreely(doc14)).toBe(true);
      expect(zonesPlacedFreely(doc15)).toBe(true);
    });

    it('B2.5 maintains crossing & aspect continuity across 14 -> 15 zones with return edges', () => {
      const addReturn = (count: number) =>
        makeMultiZoneStageDsl(count, 2).replace(/\}$/, '  animate z12_n1 ..> z0_n0\n}');
      const doc14 = parseValidDoc(addReturn(14));
      const doc15 = parseValidDoc(addReturn(15));
      const l14 = computeLayout(doc14);
      clearZoneCache();
      const l15 = computeLayout(doc15);
      assertValidLayout(doc14, l14);
      assertValidLayout(doc15, l15);
      expect(measurePrimaryRightward(doc14, l14)).toBe(1);
      expect(measurePrimaryRightward(doc15, l15)).toBe(1);
      expect(measureCorridorIntrusions(doc14, l14)).toBe(0);
      expect(measureCorridorIntrusions(doc15, l15)).toBe(0);
      expect(layoutAspect(l14)).toBeGreaterThan(1);
      expect(layoutAspect(l14)).toBeLessThanOrEqual(6.5);
      expect(layoutAspect(l15)).toBeGreaterThan(1);
      expect(layoutAspect(l15)).toBeLessThanOrEqual(6.5);
      assertSkeletonContinuity(sharedStages14, l14, l15);
      assertStageOrderPreserved(stages15, l15);
      const cross14 = countCrossings(doc14, l14);
      const cross15 = countCrossings(doc15, l15);
      expect(cross15).toBeLessThanOrEqual(cross14 + 4);
      expect(zonesPlacedFreely(doc14)).toBe(true);
      expect(zonesPlacedFreely(doc15)).toBe(true);
    });
  });

  describe('B3: 1 -> 2 top-level group boundary (zonesPlacedFreely)', () => {
    it('B3.1 switches zonesPlacedFreely from false to true when splitting 1 group into 2', () => {
      const doc1 = parseValidDoc(`
group g0 "All" {
  node a0 "A0"
  node a1 "A1"
  node b0 "B0"
  node b1 "B1"
}
step "S" {
  animate a0 --> a1
  animate a1 --> b0
  animate b0 --> b1
}
`);
      const doc2 = parseValidDoc(`
group g0 "Front" {
  node a0 "A0"
  node a1 "A1"
}
group g1 "Back" {
  node b0 "B0"
  node b1 "B1"
}
step "S" {
  animate a0 --> a1
  animate a1 --> b0
  animate b0 --> b1
}
`);
      expect(zonesPlacedFreely(doc1)).toBe(false);
      expect(zonesPlacedFreely(doc2)).toBe(true);
      assertValidLayout(doc1, computeLayout(doc1));
      const l2 = computeLayout(doc2);
      assertValidLayout(doc2, l2);
      expect(measurePrimaryRightward(doc2, l2)).toBe(1);
    });

    it('B3.2 switches zonesPlacedFreely from false to true when promoting a nested subgroup to top level', () => {
      const doc1 = parseValidDoc(`
group g0 "Parent" {
  group sub0 "Sub0" {
    node a "A"
  }
  group sub1 "Sub1" {
    node b "B"
  }
}
step "S" {
  static a --> b
}
`);
      const doc2 = parseValidDoc(`
group g0 "Parent" {
  group sub0 "Sub0" {
    node a "A"
  }
}
group sub1 "Sub1" {
  node b "B"
}
step "S" {
  static a --> b
}
`);
      expect(zonesPlacedFreely(doc1)).toBe(false);
      expect(zonesPlacedFreely(doc2)).toBe(true);
      assertValidLayout(doc1, computeLayout(doc1));
      assertValidLayout(doc2, computeLayout(doc2));
    });

    it('B3.3 switches zonesPlacedFreely from false to true when wrapping ungrouped nodes into a 2nd group', () => {
      const doc1 = parseValidDoc(`
group g0 "G0" {
  node a0 "A0"
  node a1 "A1"
}
node b0 "B0"
node b1 "B1"
step "S" {
  animate a0 --> a1
  animate a1 --> b0
  animate b0 --> b1
}
`);
      const doc2 = parseValidDoc(`
group g0 "G0" {
  node a0 "A0"
  node a1 "A1"
}
group g1 "G1" {
  node b0 "B0"
  node b1 "B1"
}
step "S" {
  animate a0 --> a1
  animate a1 --> b0
  animate b0 --> b1
}
`);
      expect(zonesPlacedFreely(doc1)).toBe(false);
      expect(zonesPlacedFreely(doc2)).toBe(true);
      assertValidLayout(doc1, computeLayout(doc1));
      assertValidLayout(doc2, computeLayout(doc2));
    });

    it('B3.4 switches zonesPlacedFreely from false to true when adding a 2nd empty top-level group', () => {
      const doc1 = parseValidDoc(`
group g0 "G0" {
  node a0 "A0"
}
node loose "Loose"
step "S" {
  animate a0 --> loose
}
`);
      const doc2 = parseValidDoc(`
group g0 "G0" {
  node a0 "A0"
}
node loose "Loose"
group g1 "Empty" {}
step "S" {
  animate a0 --> loose
}
`);
      expect(zonesPlacedFreely(doc1)).toBe(false);
      expect(zonesPlacedFreely(doc2)).toBe(true);
      assertValidLayout(doc1, computeLayout(doc1));
      assertValidLayout(doc2, computeLayout(doc2));
    });

    it('B3.5 changes backEdgesOf scope from whole-diagram to intra-zone across 1 -> 2 boundary', () => {
      const doc1 = parseValidDoc(`
group g0 "G0" {
  node a0 "A0"
  node a1 "A1"
}
node b0 "B0"
step "S" {
  animate a0 --> a1
  animate a1 --> b0
  animate b0 --> a0
}
`);
      const doc2 = parseValidDoc(`
group g0 "G0" {
  node a0 "A0"
  node a1 "A1"
}
group g1 "G1" {
  node b0 "B0"
}
step "S" {
  animate a0 --> a1
  animate a1 --> b0
  animate b0 --> a0
}
`);
      expect(zonesPlacedFreely(doc1)).toBe(false);
      expect(zonesPlacedFreely(doc2)).toBe(true);
      expect(backEdgesOf(doc1).length).toBeGreaterThanOrEqual(1);
      expect(backEdgesOf(doc2)).toEqual([]);
    });
  });

  describe('B4: 0.0-unit isolated-block drift in BOTH <= 1 and >= 2 modes', () => {
    it('B4.1 keeps 0.0 drift in 0-group <= 1 mode across 1 and 3 isolated ungrouped additions', () => {
      const base = parseValidDoc(`
node c0 "C0"
node c1 "C1"
node c2 "C2"
step "Flow" {
  animate c0 --> c1
  animate c1 --> c2
}
`);
      const oneIso = parseValidDoc(`
node c0 "C0"
node c1 "C1"
node c2 "C2"
node iso0 "Iso0"
step "Flow" {
  animate c0 --> c1
  animate c1 --> c2
}
`);
      const threeIso = parseValidDoc(`
node c0 "C0"
node c1 "C1"
node c2 "C2"
node iso0 "Iso0"
node iso1 "Iso1"
node iso2 "Iso2"
step "Flow" {
  animate c0 --> c1
  animate c1 --> c2
  animate iso0 --> iso1
  animate iso1 --> iso2
}
`);
      const l0 = computeLayout(base);
      clearZoneCache();
      const l1 = computeLayout(oneIso);
      clearZoneCache();
      const l3 = computeLayout(threeIso);
      assertValidLayout(oneIso, l1);
      assertValidLayout(threeIso, l3);
      assertZeroConnectedDrift(['c0', 'c1', 'c2'], [], l0, l1);
      assertZeroConnectedDrift(['c0', 'c1', 'c2'], [], l0, l3);
    });

    it('B4.2 keeps 0.0 drift in 1-group <= 1 mode when adding an isolated self-loop node', () => {
      const base = parseValidDoc(`
group g0 "G0" {
  node a0 "A0"
  node a1 "A1"
}
step "Flow" {
  animate a0 --> a1
}
`);
      const withIsoLoop = parseValidDoc(`
group g0 "G0" {
  node a0 "A0"
  node a1 "A1"
}
node iso0 "Iso0"
step "Flow" {
  animate a0 --> a1
  animate iso0 --> iso0
}
`);
      const l0 = computeLayout(base);
      clearZoneCache();
      const l1 = computeLayout(withIsoLoop);
      assertValidLayout(withIsoLoop, l1);
      assertZeroConnectedDrift(['a0', 'a1'], ['g0'], l0, l1);
    });

    it('B4.3 keeps 0.0 drift at exact 2-connected-zone boundary when adding an isolated 3rd group', () => {
      const base = parseValidDoc(`
group g0 "G0" {
  node a0 "A0"
  node a1 "A1"
}
group g1 "G1" {
  node b0 "B0"
  node b1 "B1"
}
step "Flow" {
  animate a0 --> a1
  animate a1 --> b0
  animate b0 --> b1
}
`);
      const withIso = parseValidDoc(`
group g0 "G0" {
  node a0 "A0"
  node a1 "A1"
}
group g1 "G1" {
  node b0 "B0"
  node b1 "B1"
}
group g_iso "Isolated" {
  node i0 "I0"
  node i1 "I1"
}
step "Flow" {
  animate a0 --> a1
  animate a1 --> b0
  animate b0 --> b1
  animate i0 --> i1
  animate i0 --> i0
}
`);
      expect(zonesPlacedFreely(base)).toBe(true);
      expect(zonesPlacedFreely(withIso)).toBe(true);
      const l0 = computeLayout(base);
      clearZoneCache();
      const l1 = computeLayout(withIso);
      assertValidLayout(withIso, l1);
      assertZeroConnectedDrift(['a0', 'a1', 'b0', 'b1'], ['g0', 'g1'], l0, l1);
    });

    it('B4.4 keeps 0.0 drift at >= 36 connected nodes when adding isolated group and ungrouped node', () => {
      const baseDsl = makeConnectedNodeFlowDsl(true);
      const isoDsl = `${baseDsl}\ngroup iso_z "Sandbox" {\n  node iso_n "SandboxNode"\n}\nnode loose_iso "LooseIso"`;
      const baseDoc = parseValidDoc(baseDsl);
      const isoDoc = parseValidDoc(isoDsl);
      expect(zonesPlacedFreely(baseDoc)).toBe(true);
      expect(zonesPlacedFreely(isoDoc)).toBe(true);
      const l0 = computeLayout(baseDoc);
      clearZoneCache();
      const l1 = computeLayout(isoDoc);
      assertValidLayout(isoDoc, l1);
      assertZeroConnectedDrift(
        baseDoc.nodes.map((n) => n.id),
        baseDoc.groups.map((g) => g.id),
        l0,
        l1,
      );
    });

    it('B4.5 keeps 0.0 drift at >= 15 connected zones when adding an isolated 16th zone', () => {
      const baseDsl = makeMultiZoneStageDsl(15, 2);
      const isoDsl = `${baseDsl}\ngroup z_iso "Iso16" {\n  node iso_a "IsoA"\n  node iso_b "IsoB"\n}`;
      const baseDoc = parseValidDoc(baseDsl);
      const isoDoc = parseValidDoc(isoDsl);
      expect(zonesPlacedFreely(baseDoc)).toBe(true);
      expect(zonesPlacedFreely(isoDoc)).toBe(true);
      const l0 = computeLayout(baseDoc);
      clearZoneCache();
      const l1 = computeLayout(isoDoc);
      assertValidLayout(isoDoc, l1);
      assertZeroConnectedDrift(
        baseDoc.nodes.map((n) => n.id),
        baseDoc.groups.map((g) => g.id),
        l0,
        l1,
      );
    });
  });

  describe('Corner cases', () => {
    it('C1 handles empty document and empty step without throwing', () => {
      const emptyStepDoc = parseValidDoc('step "Empty" {}');
      expect(zonesPlacedFreely(emptyStepDoc)).toBe(false);
      expect(backEdgesOf(emptyStepDoc)).toEqual([]);
      const l1 = computeLayout(emptyStepDoc);
      expect(l1.nodes).toEqual({});
      expect(l1.groups).toEqual({});

      const rawEmptyDoc = parse('').document;
      const l2 = computeLayout(rawEmptyDoc);
      expect(l2.nodes).toEqual({});
      expect(l2.groups).toEqual({});
    });

    it('C2 handles 1-node diagram and 1-node self-loop', () => {
      const soloDoc = parseValidDoc('node solo "Solo"\nstep "S" {}');
      const loopDoc = parseValidDoc(
        'node solo "Solo"\nstep "S" {\n  animate solo --> solo : "tick"\n}',
      );
      for (const doc of [soloDoc, loopDoc]) {
        expect(zonesPlacedFreely(doc)).toBe(false);
        expect(backEdgesOf(doc)).toEqual([]);
        const layout = computeLayout(doc);
        assertValidLayout(doc, layout);
      }
    });

    it('C3 handles empty groups and nested empty groups without overlap', () => {
      const doc = parseValidDoc(`
group g0 "OuterEmpty" {
  group g1 "InnerEmpty" {}
}
group g2 "SiblingEmpty" {}
step "Empty" {}
`);
      expect(zonesPlacedFreely(doc)).toBe(true);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
    });

    it('C4 terminates on pure cycles with self-loops and breaks cycles via backEdgesOf', () => {
      const doc = parseValidDoc(`
group g0 "Ring" {
  node a "A"
  node b "B"
  node c "C"
}
group g1 "Ring2" {
  node d "D"
  node e "E"
}
step "PureCycle" {
  animate a --> b
  animate b --> c
  animate c --> a
  animate c --> c
  animate c --> d
  animate d --> e
  animate e --> d
  animate e --> a
}
`);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(zonesPlacedFreely(doc)).toBe(true);
      const back = backEdgesOf(doc);
      expect(back.length).toBeGreaterThanOrEqual(2);
      for (const be of back) {
        expect(be.loop.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('C5 handles 5 completely disconnected groups with mixed internal animate and static flows', () => {
      const doc = parseValidDoc(`
group g0 "IsoAnim1" {
  node a0 "A0"
  node a1 "A1"
}
group g1 "IsoStatic1" {
  node b0 "B0"
  node b1 "B1"
}
group g2 "IsoAnim2" {
  node c0 "C0"
  node c1 "C1"
}
group g3 "IsoStatic2" {
  node d0 "D0"
  node d1 "D1"
}
group g4 "IsoEmpty" {}
step "InternalOnly" {
  animate a0 --> a1
  static b0 --> b1
  animate c0 --> c1
  static d0 --> d1
}
`);
      expect(zonesPlacedFreely(doc)).toBe(true);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(layoutAspect(layout)).toBeGreaterThan(1);
      expect(layoutAspect(layout)).toBeLessThanOrEqual(6.5);
    });

    it('C6 handles visible: false nodes, state overrides, and prototype-property node IDs safely', () => {
      const doc = parseValidDoc(`
group g0 "G0" {
  node constructor "Ctor" [visible: false]
  node toString "ToStr"
}
group g1 "G1" {
  node hasOwnProperty "HasOwn"
}
step "Hidden" {
  state toString [visible: false]
  animate constructor --> toString
  animate toString --> hasOwnProperty
}
`);
      expect(WINDOW_SIZE.width).toBeGreaterThan(0);
      expect(WINDOW_SIZE.height).toBeGreaterThan(0);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);
      expect(zonesPlacedFreely(doc)).toBe(true);
    });
  });
});

// ============================================================================
// TIER 3: Pairwise Cross-Feature Combinations (>= 10 tests)
// ============================================================================

describe('Tier 3 — Pairwise Cross-Feature Combinations', () => {
  it('P1: Forward backbone + upstream rollback + late aux alert', () => {
    const doc = parseValidDoc(`
group g0 "Client" {
  node c0 "C0"
}
group g1 "Gateway" {
  node gw "GW"
}
group g2 "Core" {
  node svc "SVC"
}
group g3 "Store" {
  node db "DB"
}
group aux "Alerting" {
  node mon "Mon"
  node pager "Pager"
}
step "Forward" {
  static gw ..> mon
  static svc ..> mon
  static db ..> mon
  animate c0 --> gw
  animate gw --> svc
  animate svc --> db
}
step "Rollback" {
  animate db ..> svc : "timeout"
  animate svc ..> gw : "504"
}
step "Escalate" {
  animate mon --> pager
}
step "Alert" {
  animate pager ..> c0 : "incident"
}
`);
    const layout = computeLayout(doc);
    assertValidLayout(doc, layout);
    expect(zonesPlacedFreely(doc)).toBe(true);
    expect(measurePrimaryRightward(doc, layout)).toBe(1);
    expect(measureCorridorIntrusions(doc, layout, ['aux'])).toBe(0);
    assertStageOrderPreserved([['g0'], ['g1'], ['g2'], ['g3']], layout);
  });

  it('P2: Nested groups + dual aux bands + isolated group (0.0 drift)', () => {
    const baseDsl = `
group edge "Edge" {
  node cdn "CDN"
}
group core "Core" {
  group api_tier "API" {
    node api "API"
  }
  group worker_tier "Worker" {
    node wrk "Worker"
  }
}
group store "Store" {
  node db "DB"
}
group obs "Obs" {
  node prom "Prom"
}
group vault "Vault" {
  node kms "KMS"
}
step "Flow" {
  animate cdn --> api
  animate api --> wrk
  animate wrk --> db
  static cdn ..> prom
  static api ..> prom
  static db ..> prom
  static api ..> kms
  static wrk ..> kms
  static db ..> kms
}
`;
    const withIsoDsl = `${baseDsl}\ngroup iso "Sandbox" {\n  node iso_n "Iso"\n}`;
    const baseDoc = parseValidDoc(baseDsl);
    const isoDoc = parseValidDoc(withIsoDsl);
    const l0 = computeLayout(baseDoc);
    clearZoneCache();
    const l1 = computeLayout(isoDoc);
    assertValidLayout(baseDoc, l0);
    assertValidLayout(isoDoc, l1);
    expect(measurePrimaryRightward(baseDoc, l0)).toBe(1);
    expect(measureCorridorIntrusions(baseDoc, l0, ['obs', 'vault'])).toBe(0);
    assertZeroConnectedDrift(
      baseDoc.nodes.map((n) => n.id),
      baseDoc.groups.map((g) => g.id),
      l0,
      l1,
    );
    expect(zonesPlacedFreely(baseDoc)).toBe(true);
    expect(zonesPlacedFreely(isoDoc)).toBe(true);
  });

  it('P3: Isolated blocks (0.0 drift) + multi-zone (>= 2) + self-loops', () => {
    const baseDsl = `
group g0 "G0" {
  node a0 "A0"
  node a1 "A1"
}
group g1 "G1" {
  node b0 "B0"
  node b1 "B1"
}
step "Loops" {
  animate a0 --> a0 : "poll"
  animate a0 --> a1
  animate a1 --> b0
  animate b0 --> b1
  animate b1 --> b1 : "retry"
}
`;
    const isoDsl = `${baseDsl}\ngroup g_iso "Iso" {\n  node i0 "I0"\n}\nstep "IsoLoop" {\n  animate i0 --> i0 : "heartbeat"\n}`;
    const baseDoc = parseValidDoc(baseDsl);
    const isoDoc = parseValidDoc(isoDsl);
    const l0 = computeLayout(baseDoc);
    clearZoneCache();
    const l1 = computeLayout(isoDoc);
    assertValidLayout(baseDoc, l0);
    assertValidLayout(isoDoc, l1);
    assertZeroConnectedDrift(['a0', 'a1', 'b0', 'b1'], ['g0', 'g1'], l0, l1);
    expect(zonesPlacedFreely(baseDoc)).toBe(true);
    expect(zonesPlacedFreely(isoDoc)).toBe(true);
  });

  it('P4: Single-group (<= 1) + nested groups + isolated ungrouped node (0.0 drift)', () => {
    const baseDsl = `
group vpc "VPC" {
  group sub "Subnet" {
    node api "API"
    node db "DB"
  }
}
node client "Client"
step "Flow" {
  animate client --> api
  animate api --> db
}
`;
    const isoDsl = `${baseDsl}\nnode orphan "Orphan"\nstep "OrphanLoop" {\n  animate orphan --> orphan\n}`;
    const baseDoc = parseValidDoc(baseDsl);
    const isoDoc = parseValidDoc(isoDsl);
    expect(zonesPlacedFreely(baseDoc)).toBe(false);
    expect(zonesPlacedFreely(isoDoc)).toBe(false);
    const l0 = computeLayout(baseDoc);
    clearZoneCache();
    const l1 = computeLayout(isoDoc);
    assertValidLayout(baseDoc, l0);
    assertValidLayout(isoDoc, l1);
    assertZeroConnectedDrift(['api', 'db', 'client'], ['vpc', 'sub'], l0, l1);
  });

  it('P5: Non-flow static row-wrapping + nested groups + isolated static group (0.0 drift)', () => {
    const baseNested = Array.from(
      { length: 8 },
      (_, i) =>
        `group p${i} "P${i}" {\n  group c${i} "C${i}" {\n    node n${i}_0 "N0"\n    node n${i}_1 "N1"\n  }\n}`,
    ).join('\n');
    const links = Array.from({ length: 8 }, (_, i) => {
      const own = `  static n${i}_0 --> n${i}_1`;
      const next = i + 1 < 8 ? `\n  static n${i}_1 --> n${i + 1}_0` : '';
      return own + next;
    }).join('\n');
    const baseDsl = `${baseNested}\nstep "Static" {\n${links}\n}`;
    const isoDsl = `${baseDsl}\ngroup iso_s "IsoS" {\n  node iso_n "IsoN"\n}`;
    const baseDoc = parseValidDoc(baseDsl);
    const isoDoc = parseValidDoc(isoDsl);
    const l0 = computeLayout(baseDoc);
    clearZoneCache();
    const l1 = computeLayout(isoDoc);
    assertValidLayout(baseDoc, l0);
    assertValidLayout(isoDoc, l1);
    assertRowWrapped(
      topLevelGroups(baseDoc.groups).map((g) => rectOf(l0.groups, g.id)),
      l0,
      0.8,
      5.5,
    );
    assertZeroConnectedDrift(
      baseDoc.nodes.map((n) => n.id),
      baseDoc.groups.map((g) => g.id),
      l0,
      l1,
    );
    expect(zonesPlacedFreely(baseDoc)).toBe(true);
    expect(zonesPlacedFreely(isoDoc)).toBe(true);
  });

  it('P6: Multi-step decay (>= 4 active steps) + late aux cross-cutting links + returns', () => {
    const doc = parseValidDoc(`
group g0 "G0" {
  node a "A"
}
group g1 "G1" {
  node b "B"
}
group g2 "G2" {
  node c "C"
}
group g3 "G3" {
  node d "D"
}
group aux "Aux" {
  node hub "Hub"
}
step "S0" {
  animate a --> b
}
step "S1" {
  animate b --> c
}
step "S2" {
  animate c --> d
}
step "S3" {
  static a ..> hub
  static b ..> hub
  static c ..> hub
  static d ..> hub
  animate d ..> b
}
step "S4" {
  animate hub ..> a : "late"
}
`);
    const layout = computeLayout(doc);
    assertValidLayout(doc, layout);
    expect(zonesPlacedFreely(doc)).toBe(true);
    expect(measurePrimaryRightward(doc, layout)).toBe(1);
    expect(measureCorridorIntrusions(doc, layout, ['aux'])).toBe(0);
    assertStageOrderPreserved([['g0'], ['g1'], ['g2'], ['g3']], layout);
  });

  it('P7: Long intra-zone static labels + nested groups + multi-zone + isolated drift check', () => {
    const makeDoc = (label: string, withIso: boolean) => `
group g0 "Entry" {
  node a "A"
}
group g1 "Mid" {
  group sub "Sub" {
    node m0 "M0"
    node m1 "M1"
  }
}
group g2 "Exit" {
  node b "B"
}
${withIso ? 'group iso "Iso" {\n  node i0 "I0"\n}' : ''}
step "S" {
  animate a --> m0
  static m0 --> m1 : "${label}"
  animate m1 --> b
}
`;
    const shortDoc = parseValidDoc(makeDoc('ok', false));
    const longDoc = parseValidDoc(
      makeDoc('Long Static Intra-Zone Protocol Compliance Specification Label', false),
    );
    const longIsoDoc = parseValidDoc(
      makeDoc('Long Static Intra-Zone Protocol Compliance Specification Label', true),
    );
    const lShort = computeLayout(shortDoc);
    clearZoneCache();
    const lLong = computeLayout(longDoc);
    clearZoneCache();
    const lLongIso = computeLayout(longIsoDoc);
    assertValidLayout(shortDoc, lShort);
    assertValidLayout(longDoc, lLong);
    assertValidLayout(longIsoDoc, lLongIso);
    expect(rectOf(lLong.groups, 'g1').width).toBeGreaterThan(rectOf(lShort.groups, 'g1').width);
    expect(rectOf(lLong.groups, 'g2').x).toBeGreaterThan(rectOf(lShort.groups, 'g2').x);
    assertZeroConnectedDrift(
      longDoc.nodes.map((n) => n.id),
      longDoc.groups.map((g) => g.id),
      lLong,
      lLongIso,
    );
    expect(zonesPlacedFreely(shortDoc)).toBe(true);
    expect(zonesPlacedFreely(longDoc)).toBe(true);
    expect(zonesPlacedFreely(longIsoDoc)).toBe(true);
  });

  it('P8: >= 36 connected nodes + auxiliary hub + upstream return paths', () => {
    const base = makeConnectedNodeFlowDsl(true);
    const doc = parseValidDoc(`
${base.replace(/step "Flow" \{[\s\S]*\}/, '')}
group aux_hub "Telemetry" {
  node t0 "T0"
  node t1 "T1"
}
${
  base
    .match(/step "Flow" \{[\s\S]*\}/)?.[0]
    .replace(
      /\}$/,
      '  static z0_n0 ..> t0\n  static z3_n0 ..> t0\n  static z6_n0 ..> t1\n  animate z6_n0 ..> z3_n0 : "nack"\n}',
    ) ?? ''
}
`);
    expect(doc.nodes.length).toBeGreaterThanOrEqual(38);
    const layout = computeLayout(doc);
    assertValidLayout(doc, layout);
    expect(zonesPlacedFreely(doc)).toBe(true);
    expect(measurePrimaryRightward(doc, layout)).toBe(1);
    expect(measureCorridorIntrusions(doc, layout, ['aux_hub'])).toBe(0);
    assertStageOrderPreserved([['z0'], ['z1', 'z2'], ['z3', 'z4'], ['z5'], ['z6']], layout);
  });

  it('P9: >= 15 connected zones + nested groups + isolated block (0.0 drift)', () => {
    const groups = Array.from({ length: 15 }, (_, i) =>
      i < 2
        ? `group z${i} "Z${i}" {\n  group sub${i} "Sub${i}" {\n    node z${i}_n0 "N0"\n    node z${i}_n1 "N1"\n  }\n}`
        : makeZoneGroup(`z${i}`, 2),
    ).join('\n');
    const edges: string[] = [];
    for (let z = 0; z < 15; z++) {
      edges.push(`  animate z${z}_n0 --> z${z}_n1`);
      if (z + 3 < 15) edges.push(`  animate z${z}_n1 --> z${z + 3}_n0`);
    }
    const baseDsl = `${groups}\nstep "Scale" {\n${edges.join('\n')}\n}`;
    const isoDsl = `${baseDsl}\ngroup iso_z "IsoZ" {\n  node iso_n "IsoN"\n}`;
    const baseDoc = parseValidDoc(baseDsl);
    const isoDoc = parseValidDoc(isoDsl);
    const l0 = computeLayout(baseDoc);
    clearZoneCache();
    const l1 = computeLayout(isoDoc);
    assertValidLayout(baseDoc, l0);
    assertValidLayout(isoDoc, l1);
    expect(measurePrimaryRightward(baseDoc, l0)).toBe(1);
    expect(measureCorridorIntrusions(baseDoc, l0)).toBe(0);
    assertZeroConnectedDrift(
      baseDoc.nodes.map((n) => n.id),
      baseDoc.groups.map((g) => g.id),
      l0,
      l1,
    );
    expect(zonesPlacedFreely(baseDoc)).toBe(true);
    expect(zonesPlacedFreely(isoDoc)).toBe(true);
  });

  it('P10: Ultra-wide animated strip row-wrap + isolated self-loop group (0.0 drift)', () => {
    const baseDsl = makeWideAnimatedStripDsl(10, 3);
    const isoDsl = `${baseDsl}\ngroup iso_loop "IsoLoop" {\n  node il "IL"\n}\nstep "IsoStep" {\n  animate il --> il\n}`;
    const baseDoc = parseValidDoc(baseDsl);
    const isoDoc = parseValidDoc(isoDsl);
    const l0 = computeLayout(baseDoc);
    clearZoneCache();
    const l1 = computeLayout(isoDoc);
    assertValidLayout(baseDoc, l0);
    assertValidLayout(isoDoc, l1);
    assertRowWrapped(
      topLevelGroups(baseDoc.groups).map((g) => rectOf(l0.groups, g.id)),
      l0,
      1,
      5.5,
    );
    assertZeroConnectedDrift(
      baseDoc.nodes.map((n) => n.id),
      baseDoc.groups.map((g) => g.id),
      l0,
      l1,
    );
    expect(zonesPlacedFreely(baseDoc)).toBe(true);
    expect(zonesPlacedFreely(isoDoc)).toBe(true);
  });
});

// ============================================================================
// TIER 4: Real-World Fixtures (All 17) & Large-Scale Synthetic Scenarios
// ============================================================================

describe('Tier 4 — Real-World Fixtures & Large Synthetic Architectures', () => {
  const exampleFiles = readdirSync(EXAMPLES_DIR)
    .filter((f) => f.endsWith('.dav'))
    .sort()
    .map((f) => ({ name: `examples/${f}`, path: resolve(EXAMPLES_DIR, f), base: f }));

  const fixtureFiles = readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith('.dav'))
    .sort()
    .map((f) => ({ name: `fixtures/${f}`, path: resolve(FIXTURES_DIR, f), base: f }));

  const allFixtures = [...exampleFiles, ...fixtureFiles];

  it('discovers all 17 committed .dav fixtures (7 examples + 10 scene fixtures)', () => {
    expect(exampleFiles).toHaveLength(7);
    expect(fixtureFiles).toHaveLength(10);
    expect(allFixtures).toHaveLength(17);
  });

  it.each(allFixtures)(
    '$name passes parse, geometry, determinism, mode, and Pillar 1',
    ({ path, base }) => {
      const dsl = readFileSync(path, 'utf8');
      const doc = parseValidDoc(dsl);
      const layout = computeLayout(doc);
      assertValidLayout(doc, layout);

      clearZoneCache();
      const coldLayout = computeLayout(parseValidDoc(dsl));
      expect(coldLayout).toEqual(layout);

      const topCount = topLevelGroups(doc.groups).length;
      expect(zonesPlacedFreely(doc)).toBe(topCount >= 2);
      expect(measurePrimaryRightward(doc, layout)).toBe(1);

      const maxIntrusions = base === '05-multi-region.dav' ? 1 : 0;
      expect(measureCorridorIntrusions(doc, layout)).toBeLessThanOrEqual(maxIntrusions);

      if (topCount >= 2) {
        const asp = layoutAspect(layout);
        expect(asp).toBeGreaterThan(1);
        expect(asp).toBeLessThanOrEqual(6.5);
      }
    },
  );

  it('enforces 0.0 isolated-block drift on representative fixtures in BOTH <= 1 and >= 2 modes', () => {
    // <= 1 group fixture: examples/03-event-driven-async.dav (1 top-level group)
    const singleGroupDsl = readFileSync(resolve(EXAMPLES_DIR, '03-event-driven-async.dav'), 'utf8');
    const singleDoc = parseValidDoc(singleGroupDsl);
    expect(topLevelGroups(singleDoc.groups)).toHaveLength(1);
    expect(zonesPlacedFreely(singleDoc)).toBe(false);
    const singleIsoDoc = parseValidDoc(
      `${singleGroupDsl}\nnode _e2e_iso_node "Iso"\nstep "IsoProbe" {\n  animate _e2e_iso_node --> _e2e_iso_node\n}`,
    );
    const sBefore = computeLayout(singleDoc);
    clearZoneCache();
    const sAfter = computeLayout(singleIsoDoc);
    assertValidLayout(singleIsoDoc, sAfter);
    assertZeroConnectedDrift(
      singleDoc.nodes.map((n) => n.id),
      singleDoc.groups.map((g) => g.id),
      sBefore,
      sAfter,
    );

    // >= 2 groups fixtures: 04-enterprise-zero-trust-payment.dav and 07-zero-trust-nested.dav
    for (const fixturePath of [
      resolve(EXAMPLES_DIR, '04-enterprise-zero-trust-payment.dav'),
      resolve(FIXTURES_DIR, '07-zero-trust-nested.dav'),
    ]) {
      const dsl = readFileSync(fixturePath, 'utf8');
      const baseDoc = parseValidDoc(dsl);
      expect(topLevelGroups(baseDoc.groups).length).toBeGreaterThanOrEqual(2);
      expect(zonesPlacedFreely(baseDoc)).toBe(true);
      const isoDoc = parseValidDoc(
        `${dsl}\ngroup _e2e_iso_grp "Sandbox" {\n  node _e2e_iso_a "A"\n  node _e2e_iso_b "B"\n}\nstep "IsoProbe" {\n  animate _e2e_iso_a --> _e2e_iso_b\n  animate _e2e_iso_a --> _e2e_iso_a\n}`,
      );
      expect(zonesPlacedFreely(isoDoc)).toBe(true);
      const before = computeLayout(baseDoc);
      clearZoneCache();
      const after = computeLayout(isoDoc);
      assertValidLayout(isoDoc, after);
      assertZeroConnectedDrift(
        baseDoc.nodes.map((n) => n.id),
        baseDoc.groups.map((g) => g.id),
        before,
        after,
      );
    }
  });

  it('L1: 48-node / 12-zone enterprise multi-tier architecture with nested groups, aux bands & 0.0 isolated drift', () => {
    // 10 primary zones (4 nodes each = 40) + 2 aux zones (4 nodes each = 8) = 48 connected nodes, 12 top-level zones
    const dsl = `
title "Enterprise 48-Node 12-Zone"
group clients "Clients" {
  node c_web "Web" [icon: browser]
  node c_mob "Mobile" [icon: mobile]
  node c_pos "POS" [icon: device]
  node c_api "Partner" [icon: external]
}
group edge "Edge" {
  node e_cdn "CDN" [icon: cdn]
  node e_waf "WAF" [icon: firewall]
  node e_lb "LB" [icon: lb]
  node e_gw "GW" [icon: router]
}
group auth "Zero Trust" {
  node a_idp "IdP" [icon: auth]
  node a_tok "Token" [icon: key]
  node a_pol "Policy" [icon: logic]
  node a_pdp "PDP" [icon: auth]
}
group core_a "Core A" {
  group sub_a "Mesh A" {
    node ca_0 "Order" [icon: container]
    node ca_1 "Cart" [icon: container]
    node ca_2 "Price" [icon: function]
    node ca_3 "Promo" [icon: function]
  }
}
group core_b "Core B" {
  group sub_b "Mesh B" {
    node cb_0 "Risk" [icon: ai]
    node cb_1 "Limit" [icon: logic]
    node cb_2 "Score" [icon: ai]
    node cb_3 "KYC" [icon: auth]
  }
}
group core_c "Core C" {
  node cc_0 "Ledger" [icon: server]
  node cc_1 "Batch" [icon: schedule]
  node cc_2 "Recon" [icon: sheet]
  node cc_3 "Audit" [icon: file]
}
group async_bus "Event Bus" {
  node q_in "TopicIn" [icon: queue]
  node q_dlq "DLQ" [icon: queue]
  node q_wrk "Consumer" [icon: runtime]
  node q_out "TopicOut" [icon: queue]
}
group settle_a "Settlement A" {
  node sa_0 "ACH" [icon: payment]
  node sa_1 "Swift" [icon: payment]
  node sa_2 "Clear" [icon: server]
  node sa_3 "Export" [icon: file]
}
group settle_b "Settlement B" {
  node sb_0 "CardNet" [icon: payment]
  node sb_1 "3DS" [icon: key]
  node sb_2 "Tokenize" [icon: auth]
  node sb_3 "Notify" [icon: mail]
}
group data "Storage" {
  node d_pg "PrimaryDB" [icon: database]
  node d_rep "Replica" [icon: database]
  node d_cache "Redis" [icon: cache]
  node d_obj "Archive" [icon: storage]
}
group obs "Observability" {
  node o_prom "Prom" [icon: monitor]
  node o_log "Logs" [icon: search]
  node o_trc "Traces" [icon: monitor]
  node o_pg "Pager" [icon: chat]
}
group sec "Security Vault" {
  node v_kms "KMS" [icon: key]
  node v_siem "SIEM" [icon: firewall]
  node v_cert "CA" [icon: auth]
  node v_scan "Scanner" [icon: search]
}
step "Ingress & Auth" {
  animate c_web --> e_cdn
  animate c_mob --> e_cdn
  animate c_pos --> e_waf
  animate c_api --> e_waf
  animate e_cdn --> e_lb
  animate e_waf --> e_gw
  animate e_lb --> a_idp
  animate e_gw --> a_tok
  animate a_idp --> a_pol
  animate a_tok --> a_pdp
  static e_gw ..> o_prom
  static a_idp ..> v_kms
  static a_pdp ..> v_siem
}
step "Core Processing" {
  animate a_pol --> ca_0
  animate a_pdp --> ca_1
  animate ca_0 --> ca_2
  animate ca_1 --> ca_3
  animate a_pol --> cb_0
  animate a_pdp --> cb_1
  animate cb_0 --> cb_2
  animate cb_1 --> cb_3
  animate ca_2 --> cc_0
  animate ca_3 --> cc_1
  animate cb_2 --> cc_0
  animate cb_3 --> cc_1
  animate cc_0 --> cc_2
  animate cc_1 --> cc_3
  static ca_0 ..> o_trc
  static cb_0 ..> o_log
  static cc_0 ..> v_kms
}
step "Async & Settlement" {
  animate cc_2 --> q_in
  animate cc_3 --> q_wrk
  animate q_in --> q_dlq
  animate q_wrk --> q_out
  animate q_out --> sa_0
  animate q_out --> sa_1
  animate sa_0 --> sa_2
  animate sa_1 --> sa_3
  animate q_out --> sb_0
  animate q_out --> sb_1
  animate sb_0 --> sb_2
  animate sb_1 --> sb_3
  animate sa_2 --> d_pg
  animate sa_3 --> d_rep
  animate sb_2 --> d_cache
  animate sb_3 --> d_pg
  animate d_pg --> d_obj
  static sa_0 ..> v_cert
  static sb_2 ..> v_scan
  static d_pg ..> o_prom
}
step "Returns & Late Alert" {
  animate d_pg ..> sb_3 : "ack"
  animate o_prom --> o_pg
  animate o_pg ..> e_gw : "throttle"
}
`;
    const baseDoc = parseValidDoc(dsl);
    expect(baseDoc.nodes).toHaveLength(48);
    expect(topLevelGroups(baseDoc.groups)).toHaveLength(12);

    const l0 = computeLayout(baseDoc);
    assertValidLayout(baseDoc, l0);
    expect(measurePrimaryRightward(baseDoc, l0)).toBe(1);
    expect(measureCorridorIntrusions(baseDoc, l0, ['obs', 'sec'])).toBe(0);
    expect(layoutAspect(l0)).toBeGreaterThan(1);
    expect(layoutAspect(l0)).toBeLessThanOrEqual(6.5);

    const isoDoc = parseValidDoc(`${dsl}\ngroup sandbox "Sandbox" {\n  node sb_test "Test"\n}`);
    clearZoneCache();
    const l1 = computeLayout(isoDoc);
    assertValidLayout(isoDoc, l1);
    assertZeroConnectedDrift(
      baseDoc.nodes.map((n) => n.id),
      baseDoc.groups.map((g) => g.id),
      l0,
      l1,
    );
    expect(zonesPlacedFreely(baseDoc)).toBe(true);
    expect(zonesPlacedFreely(isoDoc)).toBe(true);
  });

  it('L2: 60-node / 16-zone deep microservice mesh with aux hubs and isolated sandbox', () => {
    // 14 primary zones (4 nodes each = 56) + 2 aux zones (2 nodes each = 4) = 60 connected nodes, 16 top-level groups
    const primaryZones: string[] = [];
    const edges: string[] = [];
    for (let z = 0; z < 14; z++) {
      if (z === 4 || z === 9) {
        primaryZones.push(
          `group p${z} "P${z}" {\n  group sub${z} "Sub${z}" {\n    node p${z}_n0 "N0"\n    node p${z}_n1 "N1"\n    node p${z}_n2 "N2"\n    node p${z}_n3 "N3"\n  }\n}`,
        );
      } else {
        primaryZones.push(makeZoneGroup(`p${z}`, 4));
      }
      for (let i = 0; i < 3; i++) {
        edges.push(`  animate p${z}_n${i} --> p${z}_n${i + 1}`);
      }
      if (z + 3 < 14) {
        edges.push(`  animate p${z}_n3 --> p${z + 3}_n0`);
      }
    }
    const auxZones = `${makeZoneGroup('aux_obs', 2)}\n${makeZoneGroup('aux_bill', 2)}`;
    const auxLinks = [
      '  static p0_n0 ..> aux_obs_n0',
      '  static p4_n0 ..> aux_obs_n0',
      '  static p9_n0 ..> aux_obs_n1',
      '  static p12_n0 ..> aux_obs_n1',
      '  static p1_n0 ..> aux_bill_n0',
      '  static p7_n0 ..> aux_bill_n0',
      '  static p13_n0 ..> aux_bill_n1',
      '  animate aux_obs_n0 --> aux_obs_n1',
      '  animate aux_bill_n0 --> aux_bill_n1',
      '  animate p13_n3 ..> p10_n0',
    ].join('\n');

    const dsl = `title "60-Node 16-Zone Mesh"\n${primaryZones.join('\n')}\n${auxZones}\nstep "Mesh" {\n${edges.join('\n')}\n${auxLinks}\n}`;
    const baseDoc = parseValidDoc(dsl);
    expect(baseDoc.nodes).toHaveLength(60);
    expect(topLevelGroups(baseDoc.groups)).toHaveLength(16);

    const l0 = computeLayout(baseDoc);
    assertValidLayout(baseDoc, l0);
    expect(measurePrimaryRightward(baseDoc, l0)).toBe(1);
    expect(measureCorridorIntrusions(baseDoc, l0, ['aux_obs', 'aux_bill'])).toBe(0);
    expect(layoutAspect(l0)).toBeGreaterThan(1);
    expect(layoutAspect(l0)).toBeLessThanOrEqual(6.5);

    const isoDoc = parseValidDoc(`${dsl}\ngroup iso_mesh "IsoMesh" {\n  node im0 "IM0"\n}`);
    clearZoneCache();
    const l1 = computeLayout(isoDoc);
    assertValidLayout(isoDoc, l1);
    assertZeroConnectedDrift(
      baseDoc.nodes.map((n) => n.id),
      baseDoc.groups.map((g) => g.id),
      l0,
      l1,
    );
    expect(zonesPlacedFreely(baseDoc)).toBe(true);
    expect(zonesPlacedFreely(isoDoc)).toBe(true);
  });

  it('L3: 52-node / 16-zone static infrastructure topology wraps cleanly without overlap', () => {
    // 12 zones * 3 nodes + 4 zones * 4 nodes = 52 nodes, 16 zones, static-only (!preserveFlow)
    const groups = Array.from({ length: 16 }, (_, z) =>
      makeZoneGroup(`st${z}`, z < 12 ? 3 : 4),
    ).join('\n');
    const statics: string[] = [];
    for (let z = 0; z < 16; z++) {
      const cnt = z < 12 ? 3 : 4;
      for (let i = 0; i < cnt - 1; i++) {
        statics.push(`  static st${z}_n${i} --> st${z}_n${i + 1}`);
      }
      if (z + 1 < 16) statics.push(`  static st${z}_n${cnt - 1} --> st${z + 1}_n0`);
      if (z + 4 < 16) statics.push(`  static st${z}_n0 ..> st${z + 4}_n0`);
    }
    const dsl = `title "52-Node 16-Zone Static"\n${groups}\nstep "Topo" {\n${statics.join('\n')}\n}`;
    const doc = parseValidDoc(dsl);
    expect(doc.nodes).toHaveLength(52);
    expect(topLevelGroups(doc.groups)).toHaveLength(16);
    expect(zonesPlacedFreely(doc)).toBe(true);

    const layout = computeLayout(doc);
    assertValidLayout(doc, layout);
    assertRowWrapped(
      topLevelGroups(doc.groups).map((g) => rectOf(layout.groups, g.id)),
      layout,
      1,
      5.5,
    );

    clearZoneCache();
    expect(computeLayout(parseValidDoc(dsl))).toEqual(layout);
  });
});

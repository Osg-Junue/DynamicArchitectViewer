import { pushToMap } from '../model/text';
import type { DavConnection, DavDocument } from '../model/types';
import { topLevelGroups } from '../model/zones';
import { type FlowAnalysis, flowPairKey } from './flow';
import type { Link } from './links';
import { NODE_SIZE, ORIGIN, type Rect, STATION_CENTER } from './metrics';
import { computeRanks, type RankResult } from './ranks';
import {
  type Block,
  buildSingleZoneBlock,
  type ColumnLayout,
  flippedY,
  HORIZONTAL_CLEARANCE,
  intraZoneFlow,
  type Placed,
  toLayout,
  VERTICAL_CLEARANCE,
  type ZonePlacement,
} from './zoneBlocks';
import {
  type BlockLink,
  buildLinks,
  countBackwardPrimary,
  createFastCrossingEvaluator,
  evaluateAnchoredObjective,
  evaluateArrangementScore,
  type FlowContext,
  isClear,
  refreshSegments,
  refreshTouchingSegments,
} from './zoneScore';

/**
 * Bounded exploration budget for intra-zone refinement and coordinate polishing, scaling
 * smoothly with diagram size without switching macro layout regimes.
 */
export interface RefineBudget {
  slackRanks: boolean;
  orderSweeps: number;
  verticalSwapPasses: number;
  coupledSwapPasses: number;
  flipBitmaskCap: number;
  polishSteps: readonly number[];
  polishPasses: number;
}

export type OrderRefineBudget = Pick<
  RefineBudget,
  'orderSweeps' | 'verticalSwapPasses' | 'coupledSwapPasses'
>;

export interface ZoneSlackMeta {
  nodeIds: string[];
  idSet: Set<string>;
  ranks: RankResult;
  maxRank: number;
  colRelXs: number[];
  fwd: Map<string, string[]>;
  revTopo: string[];
}

export interface OptimizeFlipsContext {
  doc: DavDocument;
  placed: Placed[];
  links: BlockLink[];
  flow: FlowAnalysis;
  flowCtx: FlowContext;
  targets?: readonly Placed[];
  entryMask?: Uint8Array;
  preserveFlowOverride?: boolean;
  flippability?: 'flippable' | 'unflippable';
  rowFilter?: 'multi-row' | 'multi-node' | 'any';
  fallback?: 'score-greedy' | 'none';
  fallbackTargets?: readonly Placed[];
}

/** Derives continuous, bounded intra-zone refinement parameters from diagram dimensions. */
export function deriveRefineBudget(
  zoneCount: number,
  nodeCount: number,
  preserveFlow: boolean,
): RefineBudget {
  const rich = zoneCount <= 16 && nodeCount <= 75;
  return {
    slackRanks: rich,
    orderSweeps: nodeCount <= 100 ? 4 : nodeCount <= 160 ? 3 : 2,
    verticalSwapPasses: !rich ? 0 : nodeCount <= 45 ? 3 : nodeCount <= 65 ? 2 : 1,
    coupledSwapPasses: rich ? 1 : 0,
    flipBitmaskCap: 7,
    polishSteps: preserveFlow ? [128, 64, 32, 16] : [],
    polishPasses: preserveFlow ? (nodeCount <= 80 ? 3 : 2) : 0,
  };
}

export function cloneBlockNodes(block: Block): Block {
  return {
    ...block,
    nodes: new Map([...block.nodes].map(([id, r]) => [id, { ...r }])),
  };
}

export function nodeOrderOf(nodes: ReadonlyMap<string, Rect>): string[] {
  return [...nodes.entries()].sort((a, b) => a[1].y - b[1].y).map(([id]) => id);
}

export function hasMultipleNodeRows(block: Block): boolean {
  let firstY: number | undefined;
  for (const r of block.nodes.values()) {
    const ry = Math.round(r.y);
    if (firstY === undefined) firstY = ry;
    else if (ry !== firstY) return true;
  }
  return false;
}

export function snapshot(
  placed: readonly Placed[],
  baseOrders: ReadonlyMap<string, readonly string[]>,
  ranksByZone: ReadonlyMap<string, Readonly<Record<string, number>>>,
): ZonePlacement {
  return new Map(
    placed.map((p) => {
      const base = baseOrders.get(p.block.id);
      const cur = nodeOrderOf(p.block.nodes);
      const changed =
        base !== undefined &&
        (cur.length !== base.length || cur.some((id, idx) => id !== base[idx]));
      const ranks = ranksByZone.get(p.block.id);
      const entry: {
        x: number;
        y: number;
        flip: 0 | 1;
        order?: readonly string[];
        ranks?: Readonly<Record<string, number>>;
      } = {
        x: p.x,
        y: p.y,
        flip: p.flip,
      };
      if (changed) entry.order = cur;
      if (ranks) entry.ranks = ranks;
      return [p.block.id, entry];
    }),
  );
}

/** Precomputes intra-zone DAG slack metadata for zones whose nodes have slack columns toward external links. */
export function buildZoneSlackMeta(
  connDoc: DavDocument,
  connConns: readonly DavConnection[],
  connected: readonly Block[],
  flow: FlowAnalysis,
  owners: ReadonlyMap<string, string>,
  adj: ReadonlyMap<string, readonly string[]>,
): Map<string, ZoneSlackMeta> {
  const topIds = new Set(topLevelGroups(connDoc.groups).map((g) => g.id));
  const slackMeta = new Map<string, ZoneSlackMeta>();
  for (const block of connected) {
    if (!topIds.has(block.id) || block.nodes.size < 2) continue;
    const nodeIds = [...block.nodes.keys()];
    const idSet = new Set(nodeIds);
    const localFlow = intraZoneFlow(idSet, connConns, flow, owners);
    const intraEdges = localFlow.forwardEdges;
    const ranks = computeRanks(nodeIds, intraEdges);
    const maxRank = Math.max(0, ...ranks.rank.values());
    if (maxRank < 1) continue;
    const colRelXs = [...new Set([...block.nodes.values()].map((r) => Math.round(r.x)))].sort(
      (a, b) => a - b,
    );
    if (colRelXs.length <= maxRank) continue;
    const fwd = new Map<string, string[]>(nodeIds.map((id) => [id, []]));
    for (const [u, v] of intraEdges) {
      if ((ranks.rank.get(u) ?? 0) < (ranks.rank.get(v) ?? 0)) fwd.get(u)?.push(v);
    }
    const hasSlackExt = nodeIds.some(
      (u) => (ranks.rank.get(u) ?? 0) < maxRank && (adj.get(u) ?? []).some((v) => !idSet.has(v)),
    );
    if (!hasSlackExt) continue;
    const revTopo = [...nodeIds].sort(
      (a, b) => (ranks.rank.get(b) ?? 0) - (ranks.rank.get(a) ?? 0),
    );
    slackMeta.set(block.id, { nodeIds, idSet, ranks, maxRank, colRelXs, fwd, revTopo });
  }
  return slackMeta;
}

/**
 * Assigns intra-zone DAG slack columns (`earliest[u] < latest[u]`) toward external inter-zone
 * neighbors (and empty row slots), keeping changes only when total diagram score improves.
 */
export function optimizeZoneSlackRanks(
  doc: DavDocument,
  columnLayout: ColumnLayout,
  placed: Placed[],
  owners: ReadonlyMap<string, string>,
  zoneOf: ReadonlyMap<string, string>,
  nodeParent: ReadonlyMap<string, string | undefined>,
  adj: ReadonlyMap<string, readonly string[]>,
  baseOrders: Map<string, readonly string[]>,
  slackMeta: ReadonlyMap<string, ZoneSlackMeta>,
  blockCache: Map<string, Block>,
  flow: FlowAnalysis,
  flowCtx: FlowContext,
  budget?: Pick<RefineBudget, 'slackRanks'>,
): Map<string, Readonly<Record<string, number>>> {
  const chosenByZone = new Map<string, Readonly<Record<string, number>>>();
  if ((budget && !budget.slackRanks) || slackMeta.size === 0) return chosenByZone;

  let curTotal: number | undefined;

  for (const p of placed) {
    const zoneId = p.block.id;
    const meta = slackMeta.get(zoneId);
    if (!meta) continue;
    const { nodeIds, idSet, ranks, maxRank, colRelXs, fwd, revTopo } = meta;

    const layoutNow = toLayout(placed);
    const zoneLeft = layoutNow.groups[zoneId]?.x ?? p.x;
    const centerX = (id: string) => (layoutNow.nodes[id]?.x ?? 0) + NODE_SIZE.width / 2;

    const buildCandidate = (balanceWeight: number): Map<string, number> | undefined => {
      const assigned = new Map(ranks.rank);
      const colCountsByParent = new Map<string, Int32Array>();
      for (const id of nodeIds) {
        const pk = nodeParent.get(id) ?? '';
        let arr = colCountsByParent.get(pk);
        if (!arr) {
          arr = new Int32Array(maxRank + 1);
          colCountsByParent.set(pk, arr);
        }
        const r = assigned.get(id) ?? 0;
        arr[r] = (arr[r] ?? 0) + 1;
      }

      let anyDiff = false;
      for (const u of revTopo) {
        const loR = ranks.rank.get(u) ?? 0;
        const succs = fwd.get(u) ?? [];
        const hiR =
          succs.length === 0
            ? maxRank
            : Math.min(maxRank, ...succs.map((v) => (assigned.get(v) ?? maxRank) - 1));
        if (loR >= hiR) continue;

        const extNeighbors = (adj.get(u) ?? []).filter((v) => !idSet.has(v) && layoutNow.nodes[v]);
        if (extNeighbors.length === 0) continue;

        const pk = nodeParent.get(u) ?? '';
        const counts = colCountsByParent.get(pk);
        if (!counts) continue;
        counts[loR] = (counts[loR] ?? 1) - 1;
        const minCount = Math.min(...counts);

        let bestC = loR;
        let bestCost = Number.POSITIVE_INFINITY;
        for (let c = loR; c <= hiR; c++) {
          const absX = zoneLeft + (colRelXs[c] ?? 0) + NODE_SIZE.width / 2;
          let cost = c * 2;
          for (const v of extNeighbors) {
            const role = flow.byPair.get(flowPairKey(u, v))?.role ?? 'static';
            const rw = role === 'primary' ? 1.0 : role === 'return' ? 0.25 : 0.1;
            cost += Math.abs(absX - centerX(v)) * rw;
          }
          cost += Math.max(0, (counts[c] ?? 0) - minCount) * balanceWeight;
          if (cost < bestCost) {
            bestCost = cost;
            bestC = c;
          }
        }
        counts[bestC] = (counts[bestC] ?? 0) + 1;
        if (bestC !== loR) {
          assigned.set(u, bestC);
          anyDiff = true;
        }
      }
      return anyDiff ? assigned : undefined;
    };

    const prevBlock: Block = p.block;
    const prevX = p.x;
    let bestBlock = prevBlock;
    let bestX = prevX;
    let bestMap: Map<string, number> | undefined;
    let triedKeys: Set<string> | undefined;

    for (const bw of [0, 260] as const) {
      const cand = buildCandidate(bw);
      if (!cand) continue;
      const cacheKey = `${zoneId}|${[...cand.entries()].map(([k, v]) => `${k}:${v}`).join(',')}`;
      if (!triedKeys) triedKeys = new Set();
      if (triedKeys.has(cacheKey)) continue;
      triedKeys.add(cacheKey);

      if (curTotal === undefined) {
        const curLinks = buildLinks(doc, placed, flow);
        refreshSegments(curLinks);
        curTotal = evaluateArrangementScore(doc, placed, curLinks, flow, flowCtx, {
          mode: 'flip',
          layout: layoutNow,
        });
      }

      let cached = blockCache.get(cacheKey);
      if (!cached) {
        cached = buildSingleZoneBlock(doc, zoneId, columnLayout, cand, zoneOf, owners, flow);
        blockCache.set(cacheKey, cached);
      }
      const nextBlock = cloneBlockNodes(cached);
      for (const tryX of new Set([prevX, prevX + prevBlock.width - nextBlock.width])) {
        p.block = nextBlock;
        p.x = tryX;
        if (isClear(p, placed)) {
          const tLinks = buildLinks(doc, placed, flow);
          refreshSegments(tLinks);
          const score = evaluateArrangementScore(doc, placed, tLinks, flow, flowCtx, {
            mode: 'flip',
          });
          if (score < curTotal - 1) {
            curTotal = score;
            bestBlock = nextBlock;
            bestX = tryX;
            bestMap = cand;
          }
        }
      }
      p.block = prevBlock;
      p.x = prevX;
    }

    if (bestMap) {
      p.block = bestBlock;
      p.x = bestX;
      baseOrders.set(zoneId, nodeOrderOf(bestBlock.nodes));
      const rec: Record<string, number> = {};
      for (const [k, v] of bestMap) {
        if (v !== (ranks.rank.get(k) ?? 0)) rec[k] = v;
      }
      chosenByZone.set(zoneId, rec);
    }
  }
  return chosenByZone;
}

/**
 * Reorders nodes sharing a parent group and column within each placed zone using both
 * intra-zone and inter-zone connections, keeping changes only when crossings or link span drop.
 */
export function refineZoneNodeOrder(
  placed: readonly Placed[],
  nodeParent: ReadonlyMap<string, string | undefined>,
  owners: ReadonlyMap<string, string>,
  adj: ReadonlyMap<string, readonly string[]>,
  docLinks: readonly Link[],
  budget: OrderRefineBudget,
  flow: FlowAnalysis,
): boolean {
  if (budget.orderSweeps <= 0) return false;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let totalNodes = 0;
  for (const p of placed) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    totalNodes += p.block.nodes.size;
  }
  if (totalNodes < 2 || docLinks.length === 0) return false;

  const richOrdering = budget.verticalSwapPasses > 0 || budget.coupledSwapPasses > 0;
  const idToIdx = new Map<string, number>();
  const nodeX = new Float64Array(totalNodes);
  const nodeY = new Float64Array(totalNodes);
  const blockTop = new Float64Array(placed.length);

  placed.forEach((p, pIdx) => {
    const left = Math.round(p.x - minX + ORIGIN.x);
    const top = Math.round(p.y - minY + ORIGIN.y);
    blockTop[pIdx] = top;
    for (const [id, r] of p.block.nodes) {
      const idx = idToIdx.size;
      idToIdx.set(id, idx);
      nodeX[idx] = left + r.x + r.width / 2;
      nodeY[idx] = top + (p.flip ? flippedY(p.block, r, id) : r.y) + STATION_CENTER;
    }
  });

  const maxSegs = docLinks.length;
  const segU = new Int32Array(maxSegs);
  const segV = new Int32Array(maxSegs);
  const segSame = new Uint8Array(maxSegs);
  const segRole = new Uint8Array(maxSegs);
  const segAx = new Float64Array(maxSegs);
  const segAy = new Float64Array(maxSegs);
  const segBx = new Float64Array(maxSegs);
  const segBy = new Float64Array(maxSegs);
  const segMinX = new Float64Array(maxSegs);
  const segMaxX = new Float64Array(maxSegs);
  const segMinY = new Float64Array(maxSegs);
  const segMaxY = new Float64Array(maxSegs);
  const incident: number[][] = Array.from({ length: totalNodes }, () => []);

  let segCount = 0;
  for (const [from, to] of docLinks) {
    const u = idToIdx.get(from);
    const v = idToIdx.get(to);
    if (u === undefined || v === undefined) continue;
    const m = segCount++;
    segU[m] = u;
    segV[m] = v;
    segSame[m] = owners.get(from) === owners.get(to) ? 1 : 0;
    const role = flow.byPair.get(flowPairKey(from, to))?.role ?? 'static';
    segRole[m] = role === 'primary' ? 2 : role === 'return' ? 1 : 0;
    const ax = nodeX[u] ?? 0;
    const bx = nodeX[v] ?? 0;
    const ay = nodeY[u] ?? 0;
    const by = nodeY[v] ?? 0;
    segAx[m] = ax;
    segBx[m] = bx;
    segMinX[m] = Math.min(ax, bx);
    segMaxX[m] = Math.max(ax, bx);
    segAy[m] = ay;
    segBy[m] = by;
    segMinY[m] = Math.min(ay, by);
    segMaxY[m] = Math.max(ay, by);
    incident[u]?.push(m);
    incident[v]?.push(m);
  }
  if (segCount === 0) return false;

  const segStamp = new Int32Array(segCount);
  let stampCounter = 0;
  const touchedBuf: number[] = [];

  const collectTouched = (nodeIndices: readonly number[]): number => {
    const mark = ++stampCounter;
    touchedBuf.length = 0;
    for (const ni of nodeIndices) {
      const list = incident[ni];
      if (!list) continue;
      for (const si of list) {
        if (segStamp[si] !== mark) {
          segStamp[si] = mark;
          touchedBuf.push(si);
        }
      }
    }
    return mark;
  };

  const syncTouchedSegs = (): void => {
    for (const m of touchedBuf) {
      const ay = nodeY[segU[m] ?? 0] ?? 0;
      const by = nodeY[segV[m] ?? 0] ?? 0;
      segAy[m] = ay;
      segBy[m] = by;
      segMinY[m] = Math.min(ay, by);
      segMaxY[m] = Math.max(ay, by);
    }
  };

  let useDenseCross = false;
  const evalTouched = (mark: number): { cross: number; broken: number; span: number } => {
    let cross = 0;
    let broken = 0;
    let span = 0;
    for (const i of touchedBuf) {
      const ay = segAy[i] ?? 0;
      const by = segBy[i] ?? 0;
      const dy = Math.abs(ay - by);
      const ri = segRole[i] ?? 0;
      span += dy * (ri === 2 ? 1 : ri === 1 ? 0.35 : 0.2);
      if (richOrdering && segSame[i] === 1 && dy >= 1) {
        broken += ri === 2 ? 0.9 : 0.2;
      }
      const sMinX = segMinX[i] ?? 0;
      const sMaxX = segMaxX[i] ?? 0;
      const sMinY = segMinY[i] ?? 0;
      const sMaxY = segMaxY[i] ?? 0;
      const ui = segU[i] ?? 0;
      const vi = segV[i] ?? 0;
      const ax = segAx[i] ?? 0;
      const bx = segBx[i] ?? 0;
      const dx1 = bx - ax;
      const dy1 = by - ay;
      for (let j = 0; j < segCount; j++) {
        if (j === i || (segStamp[j] === mark && j < i)) continue;
        if (
          sMaxX <= (segMinX[j] ?? 0) ||
          (segMaxX[j] ?? 0) <= sMinX ||
          sMaxY <= (segMinY[j] ?? 0) ||
          (segMaxY[j] ?? 0) <= sMinY
        ) {
          continue;
        }
        const uj = segU[j] ?? 0;
        const vj = segV[j] ?? 0;
        if (ui === uj || ui === vj || vi === uj || vi === vj) continue;
        const tax = segAx[j] ?? 0;
        const tay = segAy[j] ?? 0;
        const tbx = segBx[j] ?? 0;
        const tby = segBy[j] ?? 0;
        const s1 = dx1 * (tay - ay) - dy1 * (tax - ax);
        const s2 = dx1 * (tby - ay) - dy1 * (tbx - ax);
        if (Math.sign(s1) * Math.sign(s2) >= 0) continue;
        const dx2 = tbx - tax;
        const dy2 = tby - tay;
        const s3 = dx2 * (ay - tay) - dy2 * (ax - tax);
        const s4 = dx2 * (by - tay) - dy2 * (bx - tax);
        if (Math.sign(s3) * Math.sign(s4) < 0) {
          const rj = segRole[j] ?? 0;
          const minR = Math.min(ri, rj);
          const maxR = Math.max(ri, rj);
          cross += useDenseCross
            ? minR === 2
              ? 2.5
              : maxR === 2
                ? 1.35
                : 0.85
            : minR === 2
              ? 2.5
              : maxR === 2
                ? 1.2
                : 0.5;
        }
      }
    }
    return { cross, broken, span };
  };

  const frozenY = new Float64Array(totalNodes);
  let anyChanged = false;
  for (let sweep = 0; sweep < budget.orderSweeps; sweep++) {
    let changed = false;
    placed.forEach((p, pIdx) => {
      if (p.block.nodes.size < 2) return;
      useDenseCross = placed.length >= 7 && p.block.flippable;
      frozenY.set(nodeY);
      const top = blockTop[pIdx] ?? 0;
      const zoneFrame = (p.flip ? p.block.groupsFlipped : p.block.groups).get(p.block.id);
      const zTop = zoneFrame ? top + zoneFrame.y - 60 : Number.NEGATIVE_INFINITY;
      const zBot = zoneFrame ? top + zoneFrame.y + zoneFrame.height + 60 : Number.POSITIVE_INFINITY;
      const groups = new Map<string, Array<[string, Rect]>>();
      for (const entry of p.block.nodes.entries()) {
        const [id, r] = entry;
        pushToMap(groups, `${nodeParent.get(id) ?? ''}|${Math.round(r.x)}`, entry);
      }
      for (const items of groups.values()) {
        if (items.length < 2) continue;
        const partitionIds = new Set(items.map(([id]) => id));
        const partIndices = items.map(([id]) => idToIdx.get(id) ?? 0);
        const keyed = items.map(([id, r]) => {
          const uIdx = idToIdx.get(id) ?? 0;
          const sx = nodeX[uIdx] ?? 0;
          const sy = frozenY[uIdx] ?? 0;
          let wSum = 0;
          let ySum = 0;
          for (const other of adj.get(id) ?? []) {
            if (partitionIds.has(other)) continue;
            const oIdx = idToIdx.get(other);
            if (oIdx === undefined) continue;
            const rawY = frozenY[oIdx] ?? 0;
            if (richOrdering) {
              const clampedY = Math.min(zBot, Math.max(zTop, rawY));
              const dx = Math.abs((nodeX[oIdx] ?? 0) - sx);
              const sameZ = owners.get(other) === p.block.id ? 2.5 : 1;
              const role = flow.byPair.get(flowPairKey(id, other))?.role ?? 'static';
              const rw = role === 'primary' ? 1 : role === 'return' ? 0.35 : 0.2;
              const w = (sameZ * rw) / Math.max(160, dx * 0.8);
              wSum += w;
              ySum += clampedY * w;
            } else {
              wSum += 1;
              ySum += rawY;
            }
          }
          return {
            id,
            idx: uIdx,
            r,
            oldY: r.y,
            cur: nodeY[uIdx] ?? 0,
            target: wSum > 0 ? ySum / wSum : sy,
          };
        });
        const slotYs = items.map(([, r]) => r.y).sort((a, b) => a - b);
        if (p.flip) slotYs.reverse();
        const sorted = [...keyed].sort((a, b) => a.target - b.target || a.cur - b.cur);
        if (!sorted.every((item, idx) => item.oldY === slotYs[idx])) {
          const mark = collectTouched(partIndices);
          if (touchedBuf.length > 0) {
            const before = evalTouched(mark);
            sorted.forEach((item, k) => {
              const nextRY = slotYs[k] ?? item.oldY;
              item.r.y = nextRY;
              nodeY[item.idx] =
                top + (p.flip ? flippedY(p.block, item.r, item.id) : nextRY) + STATION_CENTER;
            });
            syncTouchedSegs();
            const after = evalTouched(mark);
            const dScore = after.cross - before.cross + (after.broken - before.broken);
            const dSpan = after.span - before.span;
            if (dScore < -1e-6 || (Math.abs(dScore) <= 1e-6 && dSpan < -0.5)) {
              changed = true;
              anyChanged = true;
            } else {
              for (const item of keyed) {
                item.r.y = item.oldY;
                nodeY[item.idx] = item.cur;
              }
              syncTouchedSegs();
            }
          }
        }

        if (budget.verticalSwapPasses <= 0) continue;
        const byScreenY = [...items].sort((a, b) => (p.flip ? b[1].y - a[1].y : a[1].y - b[1].y));
        for (let pass = 0; pass < budget.verticalSwapPasses; pass++) {
          let swapped = false;
          for (let a = 0; a < byScreenY.length; a++) {
            for (let b = a + 1; b < byScreenY.length; b++) {
              const itemA = byScreenY[a];
              const itemB = byScreenY[b];
              if (!itemA || !itemB) continue;
              const [idA, rA] = itemA;
              const [idB, rB] = itemB;
              const idxA = idToIdx.get(idA) ?? 0;
              const idxB = idToIdx.get(idB) ?? 0;
              const mark = collectTouched([idxA, idxB]);
              if (touchedBuf.length === 0) continue;
              const before = evalTouched(mark);
              const prevRYA = rA.y;
              const prevRYB = rB.y;
              const prevNYA = nodeY[idxA] ?? 0;
              const prevNYB = nodeY[idxB] ?? 0;
              rA.y = prevRYB;
              rB.y = prevRYA;
              nodeY[idxA] = top + (p.flip ? flippedY(p.block, rA, idA) : prevRYB) + STATION_CENTER;
              nodeY[idxB] = top + (p.flip ? flippedY(p.block, rB, idB) : prevRYA) + STATION_CENTER;
              syncTouchedSegs();
              const after = evalTouched(mark);
              const dScore = after.cross - before.cross + (after.broken - before.broken);
              const dSpan = after.span - before.span;
              if (dScore < -1e-6 || (Math.abs(dScore) <= 1e-6 && dSpan < -0.5)) {
                byScreenY[a] = [idB, rB];
                byScreenY[b] = [idA, rA];
                changed = true;
                anyChanged = true;
                swapped = true;
              } else {
                rA.y = prevRYA;
                rB.y = prevRYB;
                nodeY[idxA] = prevNYA;
                nodeY[idxB] = prevNYB;
                syncTouchedSegs();
              }
            }
          }
          if (!swapped) break;
        }
      }

      if (budget.coupledSwapPasses > 0 && p.block.flippable && groups.size >= 2) {
        const intraPairs: Array<{
          parent: string;
          u: string;
          v: string;
          rU: Rect;
          rV: Rect;
          xU: number;
          xV: number;
        }> = [];
        for (const [from, to] of docLinks) {
          const rFrom = p.block.nodes.get(from);
          const rTo = p.block.nodes.get(to);
          if (!rFrom || !rTo) continue;
          const pFrom = nodeParent.get(from) ?? '';
          if (pFrom !== (nodeParent.get(to) ?? '')) continue;
          const xFrom = Math.round(rFrom.x);
          const xTo = Math.round(rTo.x);
          if (xFrom === xTo) continue;
          if (xFrom < xTo) {
            intraPairs.push({
              parent: pFrom,
              u: from,
              v: to,
              rU: rFrom,
              rV: rTo,
              xU: xFrom,
              xV: xTo,
            });
          } else {
            intraPairs.push({
              parent: pFrom,
              u: to,
              v: from,
              rU: rTo,
              rV: rFrom,
              xU: xTo,
              xV: xFrom,
            });
          }
        }
        for (let pass = 0; pass < budget.coupledSwapPasses; pass++) {
          let coupledSwapped = false;
          for (let a = 0; a < intraPairs.length; a++) {
            for (let b = a + 1; b < intraPairs.length; b++) {
              const pa = intraPairs[a];
              const pb = intraPairs[b];
              if (!pa || !pb || pa.parent !== pb.parent) continue;
              if (pa.xU !== pb.xU || pa.xV !== pb.xV) continue;
              if (pa.u === pb.u || pa.v === pb.v) continue;
              const idxU1 = idToIdx.get(pa.u) ?? 0;
              const idxV1 = idToIdx.get(pa.v) ?? 0;
              const idxU2 = idToIdx.get(pb.u) ?? 0;
              const idxV2 = idToIdx.get(pb.v) ?? 0;
              const mark = collectTouched([idxU1, idxV1, idxU2, idxV2]);
              if (touchedBuf.length === 0) continue;
              const before = evalTouched(mark);
              const prevU1 = pa.rU.y;
              const prevU2 = pb.rU.y;
              const prevV1 = pa.rV.y;
              const prevV2 = pb.rV.y;
              const nyU1 = nodeY[idxU1] ?? 0;
              const nyU2 = nodeY[idxU2] ?? 0;
              const nyV1 = nodeY[idxV1] ?? 0;
              const nyV2 = nodeY[idxV2] ?? 0;
              pa.rU.y = prevU2;
              pb.rU.y = prevU1;
              pa.rV.y = prevV2;
              pb.rV.y = prevV1;
              nodeY[idxU1] =
                top + (p.flip ? flippedY(p.block, pa.rU, pa.u) : prevU2) + STATION_CENTER;
              nodeY[idxU2] =
                top + (p.flip ? flippedY(p.block, pb.rU, pb.u) : prevU1) + STATION_CENTER;
              nodeY[idxV1] =
                top + (p.flip ? flippedY(p.block, pa.rV, pa.v) : prevV2) + STATION_CENTER;
              nodeY[idxV2] =
                top + (p.flip ? flippedY(p.block, pb.rV, pb.v) : prevV1) + STATION_CENTER;
              syncTouchedSegs();
              const after = evalTouched(mark);
              const dScore = after.cross - before.cross + (after.broken - before.broken);
              const dSpan = after.span - before.span;
              if (dScore < -1e-6 || (Math.abs(dScore) <= 1e-6 && dSpan < -0.5)) {
                changed = true;
                anyChanged = true;
                coupledSwapped = true;
              } else {
                pa.rU.y = prevU1;
                pb.rU.y = prevU2;
                pa.rV.y = prevV1;
                pb.rV.y = prevV2;
                nodeY[idxU1] = nyU1;
                nodeY[idxU2] = nyU2;
                nodeY[idxV1] = nyV1;
                nodeY[idxV2] = nyV2;
                syncTouchedSegs();
              }
            }
          }
          if (!coupledSwapped) break;
        }
      }
    });
    if (!changed) break;
  }
  return anyChanged;
}

/**
 * Optimizes vertical zone flips using exact bitmask search when `targets.length <= budgetCap`
 * (for flippable zones), falling back to greedy single-zone sweeps otherwise. Evaluates full
 * arrangement scores via `evaluateArrangementScore(..., { mode: 'flip' })` or `evaluateMove`
 * so nested-group flips never read stale intra-block crossing caches, and preserves existing flips on ties.
 */
export function optimizeZoneFlips(
  ctx: OptimizeFlipsContext,
  budgetCap: number,
  entryMaskArg?: Uint8Array,
): boolean {
  const entryMask = entryMaskArg ?? ctx.entryMask;
  const flippability = ctx.flippability ?? 'flippable';
  const rowFilter = ctx.rowFilter ?? 'multi-row';
  const fallback = ctx.fallback ?? 'score-greedy';
  const baseTargets = ctx.targets ?? ctx.placed;

  const matchesFlippability = (p: Placed): boolean =>
    flippability === 'flippable' ? p.block.flippable : !p.block.flippable;
  const matchesRows = (p: Placed): boolean =>
    rowFilter === 'multi-row'
      ? hasMultipleNodeRows(p.block)
      : rowFilter === 'multi-node'
        ? p.block.nodes.size >= 2
        : true;

  const targets = baseTargets.filter((p) => matchesFlippability(p) && matchesRows(p));

  const effectiveCap = Math.min(budgetCap, 20);
  if (
    flippability === 'flippable' &&
    effectiveCap > 0 &&
    targets.length > 0 &&
    targets.length <= effectiveCap
  ) {
    const scoreOpts = {
      mode: 'flip' as const,
      ...(ctx.preserveFlowOverride !== undefined
        ? { preserveFlowOverride: ctx.preserveFlowOverride }
        : {}),
      ...(entryMask ? { entryMask } : {}),
    };
    let curMask = 0;
    targets.forEach((p, idx) => {
      if (p.flip === 1) curMask |= 1 << idx;
    });
    refreshSegments(ctx.links);
    let bestMask = curMask;
    let bestObj = evaluateArrangementScore(
      ctx.doc,
      ctx.placed,
      ctx.links,
      ctx.flow,
      ctx.flowCtx,
      scoreOpts,
    );
    const startObj = bestObj;
    const totalMasks = 1 << targets.length;
    for (let mask = 0; mask < totalMasks; mask++) {
      if (mask === curMask) continue;
      targets.forEach((p, idx) => {
        p.flip = ((mask >> idx) & 1) as 0 | 1;
      });
      refreshSegments(ctx.links);
      const obj = evaluateArrangementScore(
        ctx.doc,
        ctx.placed,
        ctx.links,
        ctx.flow,
        ctx.flowCtx,
        scoreOpts,
      );
      if (obj < bestObj && obj < startObj - 1) {
        bestObj = obj;
        bestMask = mask;
      }
    }
    targets.forEach((p, idx) => {
      p.flip = ((bestMask >> idx) & 1) as 0 | 1;
    });
    refreshSegments(ctx.links);
    return bestMask !== curMask;
  }

  if (fallback === 'none') return false;
  const greedyTargets = ctx.fallbackTargets
    ? ctx.fallbackTargets.filter(matchesFlippability)
    : targets;
  if (greedyTargets.length === 0) return false;

  const scoreOpts = {
    mode: 'flip' as const,
    ...(ctx.preserveFlowOverride !== undefined
      ? { preserveFlowOverride: ctx.preserveFlowOverride }
      : {}),
    ...(entryMask ? { entryMask } : {}),
  };
  refreshSegments(ctx.links);
  let curScore = evaluateArrangementScore(
    ctx.doc,
    ctx.placed,
    ctx.links,
    ctx.flow,
    ctx.flowCtx,
    scoreOpts,
  );
  let anyFlipped = false;
  for (const p of greedyTargets) {
    const prev = p.flip;
    p.flip = prev === 0 ? 1 : 0;
    refreshTouchingSegments(ctx.links, p, undefined);
    const nextScore = evaluateArrangementScore(
      ctx.doc,
      ctx.placed,
      ctx.links,
      ctx.flow,
      ctx.flowCtx,
      scoreOpts,
    );
    if (nextScore < curScore - 1) {
      curScore = nextScore;
      anyFlipped = true;
    } else {
      p.flip = prev;
      refreshTouchingSegments(ctx.links, p, undefined);
    }
  }
  return anyFlipped;
}

/**
 * Performs multi-scale cardinal coordinate polishing using `createFastCrossingEvaluator` +
 * `evaluateAnchoredObjective`, never increasing `countBackwardPrimary` or violating clearances.
 */
export function polishZoneCoordinates(
  placed: Placed[],
  links: BlockLink[],
  docLinks: readonly Link[],
  flow: FlowAnalysis,
  flowCtx: FlowContext,
  budget: Pick<RefineBudget, 'polishSteps' | 'polishPasses'>,
  horizontalClearance = HORIZONTAL_CLEARANCE,
  preserveAuxBands = false,
): boolean {
  if (budget.polishPasses <= 0 || budget.polishSteps.length === 0 || placed.length === 0) {
    return false;
  }
  const auxSide = new Map<string, 'above' | 'below'>();
  if (preserveAuxBands && flowCtx.preserveFlow && flowCtx.auxiliaryZones.size > 0) {
    let initPriMinY = Number.POSITIVE_INFINITY;
    let initPriMaxBot = Number.NEGATIVE_INFINITY;
    for (const p of placed) {
      if (flowCtx.auxiliaryZones.has(p.block.id)) continue;
      initPriMinY = Math.min(initPriMinY, p.y);
      initPriMaxBot = Math.max(initPriMaxBot, p.y + p.block.height);
    }
    if (Number.isFinite(initPriMinY)) {
      for (const p of placed) {
        if (!flowCtx.auxiliaryZones.has(p.block.id)) continue;
        if (p.y + p.block.height <= initPriMinY + 1e-6) auxSide.set(p.block.id, 'above');
        else if (p.y >= initPriMaxBot - 1e-6) auxSide.set(p.block.id, 'below');
      }
    }
  }
  const preservesBands = (): boolean => {
    if (auxSide.size === 0) return true;
    let priMinY = Number.POSITIVE_INFINITY;
    let priMaxBot = Number.NEGATIVE_INFINITY;
    for (const q of placed) {
      if (flowCtx.auxiliaryZones.has(q.block.id)) continue;
      priMinY = Math.min(priMinY, q.y);
      priMaxBot = Math.max(priMaxBot, q.y + q.block.height);
    }
    if (!Number.isFinite(priMinY)) return true;
    for (const q of placed) {
      const side = auxSide.get(q.block.id);
      if (side === 'above' && q.y + q.block.height > priMinY - (VERTICAL_CLEARANCE + 24)) {
        return false;
      }
      if (side === 'below' && q.y < priMaxBot + (VERTICAL_CLEARANCE + 24)) return false;
    }
    return true;
  };
  refreshSegments(links);
  const crossingEval = createFastCrossingEvaluator(placed, docLinks, flow);
  let curBackPri = countBackwardPrimary(links, flowCtx);
  let curObj = evaluateAnchoredObjective(crossingEval, placed, links, flowCtx, curBackPri);
  let anyMoved = false;

  for (const step of budget.polishSteps) {
    for (let pass = 0; pass < budget.polishPasses; pass++) {
      let moved = false;
      for (const p of placed) {
        const hx = p.x;
        const hy = p.y;
        let bestMove: { x: number; y: number; obj: number; backPri: number } | undefined;
        for (const [dx, dy] of [
          [0, -step],
          [0, step],
          [-step, 0],
          [step, 0],
        ] as const) {
          p.x = hx + dx;
          p.y = hy + dy;
          if (!isClear(p, placed, horizontalClearance) || !preservesBands()) continue;
          refreshTouchingSegments(links, p, undefined);
          const nextBackPri = countBackwardPrimary(links, flowCtx);
          if (nextBackPri > curBackPri) continue;
          const obj = evaluateAnchoredObjective(crossingEval, placed, links, flowCtx, nextBackPri);
          if (obj < curObj - 1 && (!bestMove || obj < bestMove.obj)) {
            bestMove = { x: p.x, y: p.y, obj, backPri: nextBackPri };
          }
        }
        if (bestMove) {
          p.x = bestMove.x;
          p.y = bestMove.y;
          curObj = bestMove.obj;
          curBackPri = bestMove.backPri;
          refreshTouchingSegments(links, p, undefined);
          moved = true;
          anyMoved = true;
        } else {
          p.x = hx;
          p.y = hy;
          refreshTouchingSegments(links, p, undefined);
        }
      }
      if (!moved) break;
    }
  }
  return anyMoved;
}

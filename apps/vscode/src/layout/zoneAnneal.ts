import { synthesizedConnections } from '../model/connections';
import { pushToMap } from '../model/text';
import type { DavDocument } from '../model/types';
import { parentMap, topLevelGroups, zoneOfGroups } from '../model/zones';
import { analyzeFlow } from './flow';
import { countCrossings, type Link, linksOf } from './links';
import { NODE_SIZE, ORIGIN, type Rect, STATION_CENTER } from './metrics';
import { computeRanks, type RankResult } from './ranks';
import {
  type Block,
  buildBlocks,
  buildSingleZoneBlock,
  type ColumnLayout,
  flippedY,
  initialPositions,
  type Placed,
  toLayout,
  type ZonePlacement,
} from './zoneBlocks';
import {
  type BlockLink,
  buildLinks,
  evaluateMove,
  isClear,
  linkCost,
  refreshSegments,
  refreshTouchingSegments,
} from './zoneCost';
import {
  alignEdges,
  CHOSEN_STRAIGHT_WORTH,
  compact,
  STRAIGHT_WORTH,
  straighten,
  straightLinks,
  tighten,
} from './zoneFinish';

const ITERATIONS = 16000;
/** Where the search starts from, one run each: the same diagram must always get the same layout. */
export const SEEDS: readonly number[] = [11, 23, 37, 53, 71, 97];
const START_TEMPERATURE = 500;
const END_TEMPERATURE = 1.5;
/** What a crossing anywhere in the diagram, inside a zone too, costs an arrangement in the end. */
const DIAGRAM_CROSSING_COST = 180;
/**
 * Maximum top-level zones for post-anneal slack-rank, nested-flip, and pairwise-swap refinements:
 * `ITERATIONS` is fixed across all blocks, so graphs beyond ~20 top-level zones have a diluted
 * per-zone move budget where extra intra-zone degrees of freedom add local doglegs.
 */
const MAX_REFINED_ZONES = 20;

interface Pose {
  x: number;
  y: number;
  flip: 0 | 1;
}

/** Small seeded generator: the same diagram must always get the same layout. */
function seededRandom(start: number): () => number {
  let seed = start;
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function posesOf(placed: readonly Placed[]): Pose[] {
  return placed.map((p) => ({ x: p.x, y: p.y, flip: p.flip }));
}

function restore(placed: readonly Placed[], poses: readonly Pose[]): void {
  placed.forEach((p, i) => {
    const pose = poses[i];
    if (!pose) return;
    p.x = pose.x;
    p.y = pose.y;
    p.flip = pose.flip;
  });
}

function anneal(links: readonly BlockLink[], placed: Placed[], random: () => number): void {
  let current = linkCost(links, placed);
  let best = current;
  const bestState = posesOf(placed);
  let temperature = START_TEMPERATURE;
  const ratio = (END_TEMPERATURE / START_TEMPERATURE) ** (1 / ITERATIONS);
  for (let it = 0; it < ITERATIONS; it++) {
    temperature *= ratio;
    const a = placed[Math.floor(random() * placed.length)];
    if (!a) continue;
    const prevAX = a.x;
    const prevAY = a.y;
    const prevAFlip = a.flip;
    let nextAX = prevAX;
    let nextAY = prevAY;
    let nextAFlip: 0 | 1 = prevAFlip;
    let other: Placed | undefined;
    let prevOX = 0;
    let prevOY = 0;
    let prevOFlip: 0 | 1 = 0;
    let nextOX = 0;
    let nextOY = 0;
    let nextOFlip: 0 | 1 = 0;
    const roll = random();
    if (roll < 0.08 && a.block.flippable) {
      nextAFlip = prevAFlip === 0 ? 1 : 0;
    } else if (roll < 0.2) {
      other = placed[Math.floor(random() * placed.length)];
      if (!other || other === a) continue;
      prevOX = other.x;
      prevOY = other.y;
      prevOFlip = other.flip;
      nextAX = prevOX;
      nextAY = prevOY;
      nextOX = prevAX;
      nextOY = prevAY;
      nextOFlip = prevOFlip;
    } else {
      const span = 80 + 1500 * (temperature / START_TEMPERATURE);
      nextAX = prevAX + (random() - 0.5) * 2 * span;
      nextAY = prevAY + (random() - 0.5) * 2 * span;
    }
    const change = evaluateMove(
      links,
      placed,
      a,
      nextAX,
      nextAY,
      nextAFlip,
      other,
      nextOX,
      nextOY,
      nextOFlip,
    );
    if (Number.isNaN(change)) continue;
    if (change <= 0 || random() < Math.exp(-change / temperature)) {
      current += change;
      if (current < best) {
        best = current;
        for (let i = 0; i < placed.length; i++) {
          const p = placed[i];
          const saved = bestState[i];
          if (p && saved) {
            saved.x = p.x;
            saved.y = p.y;
            saved.flip = p.flip;
          }
        }
      }
    } else {
      a.x = prevAX;
      a.y = prevAY;
      a.flip = prevAFlip;
      if (other) {
        other.x = prevOX;
        other.y = prevOY;
        other.flip = prevOFlip;
      }
      refreshTouchingSegments(links, a, other);
    }
  }
  restore(placed, bestState);
  // The segments are those of the last arrangement tried, which is rarely the best one.
  refreshSegments(links);
}

function nodeOrderOf(nodes: ReadonlyMap<string, Rect>): string[] {
  return [...nodes.entries()].sort((a, b) => a[1].y - b[1].y).map(([id]) => id);
}

function snapshot(
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

/**
 * Finds where to put each zone, which has been arranged on its own, by simulated annealing.
 * Shared columns are given up for shorter links between zones. Seeded, so the same diagram
 * always gets the same placement.
 */
export function searchZonePlacement(doc: DavDocument, columnLayout: ColumnLayout): ZonePlacement {
  const arrangement = arrange(doc, columnLayout);
  let best = NOTHING_FOUND;
  for (const seed of SEEDS) {
    const found = searchFrom(doc, columnLayout, arrangement, seed);
    // The first of two that are as good, which `bestOfSeeds` has to match.
    if (found.score < best.score) best = found;
  }
  return best.placement;
}

/**
 * The part of `searchZonePlacement` that one seed does. The seeds do not depend on each other,
 * so they can run side by side: `bestOfSeeds` then gives what the whole search would have.
 */
export function searchZonePlacementFrom(
  doc: DavDocument,
  columnLayout: ColumnLayout,
  seed: number,
): SeedPlacement {
  return searchFrom(doc, columnLayout, arrange(doc, columnLayout), seed);
}

/** What the whole search gives, from what each of its seeds found. */
export function bestOfSeeds<T extends { score: number }>(
  found: ReadonlyMap<number, T>,
): T | undefined {
  let best: T | undefined;
  for (const seed of SEEDS) {
    const one = found.get(seed);
    if (one && one.score < (best?.score ?? Number.POSITIVE_INFINITY)) best = one;
  }
  return best;
}

/** The best arrangement found from one seed, and its score: the lower, the better. */
export interface SeedPlacement {
  score: number;
  placement: ZonePlacement;
}

const NOTHING_FOUND: SeedPlacement = { score: Number.POSITIVE_INFINITY, placement: new Map() };

/**
 * A zone some of whose nodes could stand in a later column than their edges put them in, and
 * are linked to another zone: what `optimizeZoneSlackRanks` needs to try those columns.
 */
interface ZoneSlackMeta {
  nodeIds: string[];
  idSet: Set<string>;
  ranks: RankResult;
  maxRank: number;
  colRelXs: number[];
  fwd: Map<string, string[]>;
  revTopo: string[];
}

/**
 * What every seed starts from: the zones, where they stand at first, and the links between
 * them. No seed changes any of it, so one arrangement serves them all.
 */
interface Arrangement {
  placed: Placed[];
  links: BlockLink[];
  start: ReadonlyMap<string, { x: number; y: number }>;
  nodeParent: ReadonlyMap<string, string | undefined>;
  owners: ReadonlyMap<string, string>;
  zoneOf: ReadonlyMap<string, string>;
  adj: ReadonlyMap<string, readonly string[]>;
  docLinks: readonly Link[];
  baseOrders: ReadonlyMap<string, readonly string[]>;
  /** Few enough zones for the moves inside zones: see `MAX_REFINED_ZONES`. */
  richRefine: boolean;
  slackMeta: ReadonlyMap<string, ZoneSlackMeta>;
  /** Zones laid out with nodes in other columns, by zone and columns: the seeds try the same ones. */
  blockCache: Map<string, Block>;
}

function cloneBlockNodes(block: Block): Block {
  return {
    ...block,
    nodes: new Map([...block.nodes].map(([id, r]) => [id, { ...r }])),
  };
}

function arrange(doc: DavDocument, columnLayout: ColumnLayout): Arrangement {
  const { blocks, owners } = buildBlocks(doc, columnLayout);
  const start = initialPositions(doc, blocks, owners, columnLayout);
  const placed: Placed[] = blocks.map((block) => ({ block, x: 0, y: 0, flip: 0 }));
  const connections = synthesizedConnections(doc);
  const adj = new Map<string, string[]>();
  for (const e of connections) {
    if (e.from === e.to) continue;
    pushToMap(adj, e.from, e.to);
    pushToMap(adj, e.to, e.from);
  }
  const baseOrders = new Map(blocks.map((b) => [b.id, nodeOrderOf(b.nodes)]));
  const topGroups = topLevelGroups(doc.groups);
  const richRefine = topGroups.length <= MAX_REFINED_ZONES;
  const slackMeta = new Map<string, ZoneSlackMeta>();
  if (richRefine) {
    const topIds = new Set(topGroups.map((g) => g.id));
    for (const block of blocks) {
      if (!topIds.has(block.id) || block.nodes.size < 2) continue;
      const nodeIds = doc.nodes.filter((n) => owners.get(n.id) === block.id).map((n) => n.id);
      const idSet = new Set(nodeIds);
      const intraConns = connections.filter((e) => idSet.has(e.from) && idSet.has(e.to) && e.from !== e.to);
      const intraSteps = doc.steps.map((s) => ({
        ...s,
        animations: s.animations.filter((a) => idSet.has(a.from) && idSet.has(a.to)),
        statics: s.statics.filter((st) => idSet.has(st.from) && idSet.has(st.to)),
      }));
      const intraFlow = analyzeFlow(
        { ...doc, nodes: doc.nodes.filter((n) => idSet.has(n.id)), groups: [], steps: intraSteps },
        intraConns,
      );
      const intraEdges = intraFlow.forwardEdges;
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
  }
  return {
    placed,
    links: buildLinks(doc, placed),
    start,
    nodeParent: parentMap(doc.nodes),
    owners,
    zoneOf: zoneOfGroups(doc.groups),
    adj,
    docLinks: linksOf(doc),
    baseOrders,
    richRefine,
    slackMeta,
    blockCache: new Map(),
  };
}

/**
 * Assigns intra-zone DAG slack columns (`earliest[u] < latest[u]`) toward external inter-zone
 * neighbors (and empty row slots), keeping changes only when total diagram score improves.
 */
function optimizeZoneSlackRanks(
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
): Map<string, Readonly<Record<string, number>>> {
  const chosenByZone = new Map<string, Readonly<Record<string, number>>>();
  if (slackMeta.size === 0) return chosenByZone;

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
          const absX = zoneLeft + (colRelXs[c] as number) + NODE_SIZE.width / 2;
          let cost = c * 2;
          for (const v of extNeighbors) cost += Math.abs(absX - centerX(v));
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

    for (const bw of [0, 260]) {
      const cand = buildCandidate(bw);
      if (!cand) continue;
      const cacheKey = `${zoneId}|${[...cand.entries()].map(([k, v]) => `${k}:${v}`).join(',')}`;
      if (!triedKeys) triedKeys = new Set();
      if (triedKeys.has(cacheKey)) continue;
      triedKeys.add(cacheKey);

      if (curTotal === undefined) {
        const curLinks = buildLinks(doc, placed);
        refreshSegments(curLinks);
        curTotal =
          linkCost(curLinks, placed) + countCrossings(doc, layoutNow) * DIAGRAM_CROSSING_COST;
      }

      let cached = blockCache.get(cacheKey);
      if (!cached) {
        cached = buildSingleZoneBlock(doc, zoneId, columnLayout, cand, zoneOf, owners);
        blockCache.set(cacheKey, cached);
      }
      const nextBlock = cloneBlockNodes(cached);
      for (const tryX of new Set([prevX, prevX + prevBlock.width - nextBlock.width])) {
        p.block = nextBlock;
        p.x = tryX;
        if (isClear(p, placed)) {
          const tLinks = buildLinks(doc, placed);
          refreshSegments(tLinks);
          const score =
            linkCost(tLinks, placed) +
            countCrossings(doc, toLayout(placed)) * DIAGRAM_CROSSING_COST;
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
function refineZoneNodeOrder(
  placed: readonly Placed[],
  nodeParent: ReadonlyMap<string, string | undefined>,
  owners: ReadonlyMap<string, string>,
  adj: ReadonlyMap<string, readonly string[]>,
  docLinks: readonly Link[],
  richRefine: boolean,
): boolean {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let totalNodes = 0;
  for (const p of placed) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    totalNodes += p.block.nodes.size;
  }
  if (totalNodes < 2 || docLinks.length === 0) return false;

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
    const ax = nodeX[u] as number;
    const bx = nodeX[v] as number;
    const ay = nodeY[u] as number;
    const by = nodeY[v] as number;
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
    for (let k = 0; k < nodeIndices.length; k++) {
      const list = incident[nodeIndices[k] as number];
      if (!list) continue;
      for (let m = 0; m < list.length; m++) {
        const si = list[m] as number;
        if (segStamp[si] !== mark) {
          segStamp[si] = mark;
          touchedBuf.push(si);
        }
      }
    }
    return mark;
  };

  const syncTouchedSegs = (): void => {
    for (let k = 0; k < touchedBuf.length; k++) {
      const m = touchedBuf[k] as number;
      const ay = nodeY[segU[m] as number] as number;
      const by = nodeY[segV[m] as number] as number;
      segAy[m] = ay;
      segBy[m] = by;
      segMinY[m] = Math.min(ay, by);
      segMaxY[m] = Math.max(ay, by);
    }
  };

  const evalTouched = (mark: number): { cross: number; broken: number; span: number } => {
    let cross = 0;
    let broken = 0;
    let span = 0;
    for (let ti = 0; ti < touchedBuf.length; ti++) {
      const i = touchedBuf[ti] as number;
      const ay = segAy[i] as number;
      const by = segBy[i] as number;
      const dy = Math.abs(ay - by);
      span += dy;
      if (richRefine && segSame[i] === 1 && dy >= 1) broken += 0.6;
      const sMinX = segMinX[i] as number;
      const sMaxX = segMaxX[i] as number;
      const sMinY = segMinY[i] as number;
      const sMaxY = segMaxY[i] as number;
      const ui = segU[i] as number;
      const vi = segV[i] as number;
      const ax = segAx[i] as number;
      const bx = segBx[i] as number;
      const dx1 = bx - ax;
      const dy1 = by - ay;
      for (let j = 0; j < segCount; j++) {
        if (j === i || (segStamp[j] === mark && j < i)) continue;
        if (
          sMaxX <= (segMinX[j] as number) ||
          (segMaxX[j] as number) <= sMinX ||
          sMaxY <= (segMinY[j] as number) ||
          (segMaxY[j] as number) <= sMinY
        ) {
          continue;
        }
        const uj = segU[j] as number;
        const vj = segV[j] as number;
        if (ui === uj || ui === vj || vi === uj || vi === vj) continue;
        const tax = segAx[j] as number;
        const tay = segAy[j] as number;
        const tbx = segBx[j] as number;
        const tby = segBy[j] as number;
        if (
          Math.sign(dx1 * (tay - ay) - dy1 * (tax - ax)) *
            Math.sign(dx1 * (tby - ay) - dy1 * (tbx - ax)) >=
          0
        ) {
          continue;
        }
        const dx2 = tbx - tax;
        const dy2 = tby - tay;
        if (
          Math.sign(dx2 * (ay - tay) - dy2 * (ax - tax)) *
            Math.sign(dx2 * (by - tay) - dy2 * (bx - tax)) <
          0
        ) {
          cross++;
        }
      }
    }
    return { cross, broken, span };
  };

  const frozenY = new Float64Array(totalNodes);
  let anyChanged = false;
  for (let sweep = 0; sweep < 4; sweep++) {
    let changed = false;
    placed.forEach((p, pIdx) => {
      if (p.block.nodes.size < 2) return;
      frozenY.set(nodeY);
      const top = blockTop[pIdx] as number;
      const zoneFrame = (p.flip ? p.block.groupsFlipped : p.block.groups).get(p.block.id);
      const zTop = zoneFrame ? top + zoneFrame.y - 60 : Number.NEGATIVE_INFINITY;
      const zBot = zoneFrame ? top + zoneFrame.y + zoneFrame.height + 60 : Number.POSITIVE_INFINITY;

      const groups = new Map<string, Array<[string, Rect]>>();
      for (const entry of p.block.nodes.entries()) {
        const [id, r] = entry;
        const key = `${nodeParent.get(id) ?? ''}|${Math.round(r.x)}`;
        const list = groups.get(key);
        if (list) list.push(entry);
        else groups.set(key, [entry]);
      }
      for (const items of groups.values()) {
        if (items.length < 2) continue;
        const partitionIds = new Set(items.map(([id]) => id));
        const partIndices = items.map(([id]) => idToIdx.get(id) as number);

        const keyed = items.map(([id, r]) => {
          const uIdx = idToIdx.get(id) as number;
          const sx = nodeX[uIdx] as number;
          const sy = frozenY[uIdx] as number;
          const neighbors = adj.get(id) ?? [];
          let wSum = 0;
          let ySum = 0;
          for (const other of neighbors) {
            if (partitionIds.has(other)) continue;
            const oIdx = idToIdx.get(other);
            if (oIdx === undefined) continue;
            const rawY = frozenY[oIdx] as number;
            if (richRefine) {
              const clampedY = Math.min(zBot, Math.max(zTop, rawY));
              const dx = Math.abs((nodeX[oIdx] as number) - sx);
              const sameZ = owners.get(other) === p.block.id ? 2.5 : 1;
              const w = sameZ / Math.max(160, dx * 0.8);
              wSum += w;
              ySum += clampedY * w;
            } else {
              wSum += 1;
              ySum += rawY;
            }
          }
          const target = wSum > 0 ? ySum / wSum : sy;
          return { id, idx: uIdx, r, oldY: r.y, cur: nodeY[uIdx] as number, target };
        });
        const slotYs = items.map(([, r]) => r.y).sort((a, b) => a - b);
        if (p.flip) slotYs.reverse();
        const sorted = [...keyed].sort((a, b) => a.target - b.target || a.cur - b.cur);
        if (!sorted.every((item, idx) => item.oldY === slotYs[idx])) {
          const mark = collectTouched(partIndices);
          if (touchedBuf.length > 0) {
            const before = evalTouched(mark);
            sorted.forEach((item, k) => {
              const nextRY = slotYs[k] as number;
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

        if (!richRefine) continue;
        const byScreenY = [...items].sort((a, b) => (p.flip ? b[1].y - a[1].y : a[1].y - b[1].y));
        for (let k = 0; k + 1 < byScreenY.length; k++) {
          const pairA = byScreenY[k];
          const pairB = byScreenY[k + 1];
          if (!pairA || !pairB) continue;
          const [idA, rA] = pairA;
          const [idB, rB] = pairB;
          const idxA = idToIdx.get(idA) as number;
          const idxB = idToIdx.get(idB) as number;
          const mark = collectTouched([idxA, idxB]);
          if (touchedBuf.length === 0) continue;
          const before = evalTouched(mark);
          const prevRYA = rA.y;
          const prevRYB = rB.y;
          const prevNYA = nodeY[idxA] as number;
          const prevNYB = nodeY[idxB] as number;
          rA.y = prevRYB;
          rB.y = prevRYA;
          nodeY[idxA] = top + (p.flip ? flippedY(p.block, rA, idA) : rA.y) + STATION_CENTER;
          nodeY[idxB] = top + (p.flip ? flippedY(p.block, rB, idB) : rB.y) + STATION_CENTER;
          syncTouchedSegs();
          const after = evalTouched(mark);
          const dScore = after.cross - before.cross + (after.broken - before.broken);
          const dSpan = after.span - before.span;
          if (dScore < -1e-6 || (Math.abs(dScore) <= 1e-6 && dSpan < -0.5)) {
            byScreenY[k] = [idB, rB];
            byScreenY[k + 1] = [idA, rA];
            changed = true;
            anyChanged = true;
          } else {
            rA.y = prevRYA;
            rB.y = prevRYB;
            nodeY[idxA] = prevNYA;
            nodeY[idxB] = prevNYB;
            syncTouchedSegs();
          }
        }
      }
    });
    if (!changed) break;
  }
  return anyChanged;
}

function clonePlaced(placed: readonly Placed[], poses: readonly Pose[]): Placed[] {
  return placed.map((p, i) => {
    const pose = poses[i] ?? { x: p.x, y: p.y, flip: p.flip };
    return {
      block: {
        ...p.block,
        nodes: new Map([...p.block.nodes].map(([id, r]) => [id, { ...r }])),
      },
      x: pose.x,
      y: pose.y,
      flip: pose.flip,
    };
  });
}

function searchFrom(
  doc: DavDocument,
  columnLayout: ColumnLayout,
  {
    placed,
    links,
    start,
    nodeParent,
    owners,
    zoneOf,
    adj,
    docLinks,
    baseOrders,
    richRefine,
    slackMeta,
    blockCache,
  }: Arrangement,
  seed: number,
): SeedPlacement {
  for (const p of placed) {
    const at = start.get(p.block.id) ?? { x: 0, y: 0 };
    p.x = at.x;
    p.y = at.y;
    p.flip = 0;
  }
  anneal(links, placed, seededRandom(seed * 104729));
  tighten(links, placed);
  const tightened = posesOf(placed);
  let best = NOTHING_FOUND;
  // Stepping aside is judged by the cost between zones alone, and can cost more in
  // crossings inside them than it saves: the arrangement is finished both ways, and the
  // one with steps aside is taken only where the whole score is lower for it.
  for (const aside of [false, true]) {
    const trialPlaced = clonePlaced(placed, tightened);
    const trialBaseOrders = new Map(baseOrders);
    let trialLinks = buildLinks(doc, trialPlaced);
    refreshSegments(trialLinks);
    compact(trialLinks, trialPlaced, aside);
    alignEdges(trialLinks, trialPlaced);
    // Lining up edges moves zones a little; close what that opened.
    tighten(trialLinks, trialPlaced);
    compact(trialLinks, trialPlaced, aside);

    const ranksByZone = optimizeZoneSlackRanks(
      doc,
      columnLayout,
      trialPlaced,
      owners,
      zoneOf,
      nodeParent,
      adj,
      trialBaseOrders,
      slackMeta,
      blockCache,
    );
    if (ranksByZone.size > 0) {
      trialLinks = buildLinks(doc, trialPlaced);
      refreshSegments(trialLinks);
      tighten(trialLinks, trialPlaced);
    }

    // The annealing only turns over zones that mirror as a whole. One with groups in it or
    // with loops is tried here, once the others stand where they will, and kept upside down
    // only where the whole score is lower for it.
    if (richRefine && trialPlaced.some((p) => !p.block.flippable && p.block.nodes.size >= 2)) {
      let curFlipScore =
        linkCost(trialLinks, trialPlaced) +
        countCrossings(doc, toLayout(trialPlaced)) * DIAGRAM_CROSSING_COST;
      for (const p of trialPlaced) {
        if (p.block.flippable || p.block.nodes.size < 2) continue;
        const prevFlip = p.flip;
        p.flip = prevFlip === 0 ? 1 : 0;
        refreshTouchingSegments(trialLinks, p, undefined);
        const nextFlipScore =
          linkCost(trialLinks, trialPlaced) +
          countCrossings(doc, toLayout(trialPlaced)) * DIAGRAM_CROSSING_COST;
        if (nextFlipScore < curFlipScore - 1) {
          curFlipScore = nextFlipScore;
        } else {
          p.flip = prevFlip;
          refreshTouchingSegments(trialLinks, p, undefined);
        }
      }
    }

    if (refineZoneNodeOrder(trialPlaced, nodeParent, owners, adj, docLinks, richRefine)) {
      trialLinks = buildLinks(doc, trialPlaced);
      refreshSegments(trialLinks);
    }
    // Last, since sliding would undo it.
    straighten(trialLinks, trialPlaced);
    const score =
      linkCost(trialLinks, trialPlaced) +
      countCrossings(doc, toLayout(trialPlaced)) * DIAGRAM_CROSSING_COST -
      straightLinks(trialLinks, trialPlaced) * STRAIGHT_WORTH;
    if (score < best.score) {
      // Straightened further once the score is taken, so that which seed wins does not change.
      straighten(trialLinks, trialPlaced, CHOSEN_STRAIGHT_WORTH);
      best = { score, placement: snapshot(trialPlaced, trialBaseOrders, ranksByZone) };
    }
  }
  return best;
}

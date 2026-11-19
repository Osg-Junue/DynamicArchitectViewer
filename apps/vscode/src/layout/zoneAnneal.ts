import { synthesizedConnections } from '../model/connections';
import { pushToMap } from '../model/text';
import type { DavConnection, DavDocument } from '../model/types';
import { parentMap, topLevelGroups, zoneOfGroups } from '../model/zones';
import { analyzeFlow, countCorridorIntrusions, type FlowAnalysis, flowPairKey } from './flow';
import { countCrossings, type Link, linksOf, primaryCrossingsOf } from './links';
import {
  enclosingRect,
  type Layout,
  NODE_SIZE,
  ORIGIN,
  type Rect,
  STATION_CENTER,
} from './metrics';
import { computeRanks, type RankResult } from './ranks';
import {
  type Block,
  buildBlocks,
  buildSingleZoneBlock,
  type ColumnLayout,
  flippedY,
  HORIZONTAL_CLEARANCE,
  initialPositions,
  intraZoneFlow,
  ownersOf,
  type Placed,
  partitionIsolatedBlocks,
  shouldPreserveFlow,
  stageColumns,
  toLayout,
  VERTICAL_CLEARANCE,
  type ZonePlacement,
} from './zoneBlocks';
import {
  type BlockLink,
  blockedPrimaryPorts,
  buildFlowContext,
  buildLinks,
  estimateRoutingDefects,
  evaluateMove,
  extent,
  type FlowContext,
  isClear,
  linkCost,
  refreshSegments,
  refreshTouchingSegments,
  rightwardShare,
  runsThrough,
  wallDetourCount,
} from './zoneCost';
import {
  alignEdges,
  CHOSEN_STRAIGHT_WORTH,
  compact,
  eliminateShortJogs,
  restoreStageBreathingRoom,
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
/** Compact 2D annealing cutoff; larger staged pipelines use the fast deterministic stage solver. */
const MAX_COMPACT_ZONES = 14;
const ANCHORED_FLOW_NODES = 35;
const MAX_REFINED_ZONES = 16;
const MAX_REFINED_NODES = 75;
const STAGE_GAP = 80;
const ROW_GAP = 44;

interface Pose {
  x: number;
  y: number;
  flip: 0 | 1;
}

/** Deterministic Mulberry32 PRNG keyed solely by seed so `computeLayout(doc)` is a pure function of `doc`. */
function hashBlockId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
}

function randSlot01(seed: number, iter: number, idHash: number, slot: number): number {
  let h =
    (Math.imul(seed | 0, 0x9e3779b1) ^
      Math.imul(iter + 1, 0x85ebca6b) ^
      Math.imul(idHash, 0xc2b2ae35) ^
      Math.imul(slot + 1, 0x27d4eb2f)) |
    0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
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

function cloneBlockNodes(block: Block): Block {
  return {
    ...block,
    nodes: new Map([...block.nodes].map(([id, r]) => [id, { ...r }])),
  };
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
 * Gentle canonical orientation tie-breaker (`< 1` crossing = 180) that breaks whole-diagram
 * `(y, flip) <-> (-y - h, 1 - flip)` mirror symmetry: entry/primary blocks prefer upright header
 * order and the primary backbone prefers sitting above the first auxiliary foundation/telemetry band.
 */
interface PolarityModel {
  preserveFlow: boolean;
  allFlippable: boolean;
  passiveStaticAux: boolean;
  primaryIndices: Int32Array;
  sameStagePairs: Int32Array;
  firstAuxIdx: number;
}

function buildPolarityModel(
  connected: readonly Block[],
  flow: FlowAnalysis,
  owners: ReadonlyMap<string, string>,
  start: ReadonlyMap<string, { x: number; y: number }>,
  preserveFlow: boolean,
): PolarityModel {
  const n = connected.length;
  const allFlippable = n > 0 && connected.every((b) => b.flippable);
  const priList: number[] = [];
  let firstAuxIdx = -1;

  for (let i = 0; i < n; i++) {
    const b = connected[i];
    if (!b) continue;
    if (flow.auxiliaryZones.has(b.id)) {
      if (firstAuxIdx < 0) firstAuxIdx = i;
    } else {
      priList.push(i);
    }
  }

  const outPriCount = new Map<string, number>();
  const minPredStage = new Map<string, number>();
  for (const c of flow.connections) {
    if (c.role !== 'primary') continue;
    const bu = owners.get(c.from) ?? c.from;
    const bv = owners.get(c.to) ?? c.to;
    if (bu === bv) continue;
    outPriCount.set(bu, (outPriCount.get(bu) ?? 0) + 1);
    const su = flow.zoneStage.get(bu) ?? 0;
    const curMin = minPredStage.get(bv);
    if (curMin === undefined || su < curMin) minPredStage.set(bv, su);
  }
  const isMovableLeafSink = (b: Block): boolean =>
    !allFlippable &&
    b.flippable &&
    (outPriCount.get(b.id) ?? 0) === 0 &&
    (minPredStage.get(b.id) ?? 0) > 0;

  const stagePairsFlat: number[] = [];
  for (let a = 0; a < priList.length; a++) {
    const ia = priList[a] ?? 0;
    const ba = connected[ia];
    if (!ba) continue;
    const sa = flow.zoneStage.get(ba.id) ?? 0;
    const cya = (start.get(ba.id)?.y ?? 0) + ba.height / 2;
    for (let b = a + 1; b < priList.length; b++) {
      const ib = priList[b] ?? 0;
      const bb = connected[ib];
      if (!bb) continue;
      const sb = flow.zoneStage.get(bb.id) ?? 0;
      if (sa !== sb) continue;
      const cyb = (start.get(bb.id)?.y ?? 0) + bb.height / 2;
      if (cya + 20 < cyb) {
        if (!isMovableLeafSink(ba) || isMovableLeafSink(bb)) stagePairsFlat.push(ia, ib);
      } else if (cyb + 20 < cya) {
        if (!isMovableLeafSink(bb) || isMovableLeafSink(ba)) stagePairsFlat.push(ib, ia);
      }
    }
  }

  let passiveStaticAux = false;
  if (firstAuxIdx >= 0) {
    const auxId = connected[firstAuxIdx]?.id;
    if (auxId) {
      let hasAnimTouch = false;
      let outInter = 0;
      for (const c of flow.connections) {
        const bu = owners.get(c.from) ?? c.from;
        const bv = owners.get(c.to) ?? c.to;
        if (bu === bv || (bu !== auxId && bv !== auxId)) continue;
        if (c.role !== 'static') hasAnimTouch = true;
        if (bu === auxId) outInter++;
      }
      passiveStaticAux = !hasAnimTouch && outInter === 0;
    }
  }

  return {
    preserveFlow,
    allFlippable,
    passiveStaticAux,
    primaryIndices: new Int32Array(priList),
    sameStagePairs: new Int32Array(stagePairsFlat),
    firstAuxIdx,
  };
}

function polarityPenalty(placed: readonly Placed[], model: PolarityModel): number {
  if (!model.preserveFlow) return 0;
  let pen = 0;
  const { passiveStaticAux, primaryIndices, sameStagePairs, firstAuxIdx } = model;
  const sameStageWeight = model.allFlippable ? (sameStagePairs.length <= 2 ? 950 : 220) : 3200;
  for (let k = 0; k < sameStagePairs.length; k += 2) {
    const topP = placed[sameStagePairs[k] ?? 0];
    const botP = placed[sameStagePairs[k + 1] ?? 0];
    if (!topP || !botP) continue;
    const topCy = topP.y + topP.block.height / 2;
    const botCy = botP.y + botP.block.height / 2;
    if (topCy > botCy + 20) pen += sameStageWeight;
  }
  if (firstAuxIdx >= 0 && primaryIndices.length > 0) {
    const aux = placed[firstAuxIdx];
    if (aux) {
      let minPriX = Number.POSITIVE_INFINITY;
      let priCySum = 0;
      for (let k = 0; k < primaryIndices.length; k++) {
        const p = placed[primaryIndices[k] ?? 0];
        if (p) {
          if (p.x < minPriX) minPriX = p.x;
          priCySum += p.y + p.block.height / 2;
        }
      }
      // Keep cross-cutting auxiliary feedback/monitoring from drifting upstream left of Stage 0.
      if (aux.x + aux.block.width < minPriX) {
        pen += 500 + (minPriX - (aux.x + aux.block.width)) * 1.5;
      }
      // Break mirror tie on passive static-only observability bands consistently across edits.
      if (passiveStaticAux) {
        const priMeanCy = priCySum / primaryIndices.length;
        const auxCy = aux.y + aux.block.height / 2;
        if (auxCy > priMeanCy + 20) pen += 450;
      }
    }
  }
  return pen;
}

interface AnnealOptions {
  iters?: number;
  startTemp?: number;
  maxSpan?: number;
  anchorPoses?: readonly Pose[];
}

function hasMultipleNodeRows(block: Block): boolean {
  let firstY: number | undefined;
  for (const r of block.nodes.values()) {
    const ry = Math.round(r.y);
    if (firstY === undefined) firstY = ry;
    else if (ry !== firstY) return true;
  }
  return false;
}

function anneal(
  links: readonly BlockLink[],
  placed: Placed[],
  seed: number,
  entryMask: Uint8Array,
  ctx?: FlowContext,
  opts?: AnnealOptions,
): void {
  const n = placed.length;
  if (n === 0) return;
  const iters = opts?.iters ?? ITERATIONS;
  const startTemp = opts?.startTemp ?? START_TEMPERATURE;
  const maxSpan = opts?.maxSpan ?? 1500;
  const anchorPoses = opts?.anchorPoses;
  const blockHashes = placed.map((p) => hashBlockId(p.block.id));
  let current = linkCost(links, placed, ctx);
  for (let i = 0; i < n; i++) {
    if (entryMask[i] === 1 && placed[i]?.flip === 1) current += 120;
  }
  let best = current;
  const bestState = posesOf(placed);
  let temperature = startTemp;
  const ratio = (END_TEMPERATURE / startTemp) ** (1 / iters);

  for (let it = 0; it < iters; it++) {
    temperature *= ratio;
    let pickIdx = 0;
    let bestPickKey = Number.POSITIVE_INFINITY;
    for (let i = 0; i < n; i++) {
      const k = randSlot01(seed, it, blockHashes[i] ?? 0, 0);
      if (k < bestPickKey) {
        bestPickKey = k;
        pickIdx = i;
      }
    }
    const a = placed[pickIdx];
    if (!a) continue;
    const hashA = blockHashes[pickIdx] ?? 0;
    const roll = randSlot01(seed, it, hashA, 1);
    const rX = randSlot01(seed, it, hashA, 2);
    const rY = randSlot01(seed, it, hashA, 3);
    const rAcc = randSlot01(seed, it, hashA, 4);

    const prevAX = a.x;
    const prevAY = a.y;
    const prevAFlip = a.flip;
    let nextAX = prevAX;
    let nextAY = prevAY;
    let nextAFlip: 0 | 1 = prevAFlip;
    let other: Placed | undefined;
    let otherIdx = -1;
    let prevOX = 0;
    let prevOY = 0;
    let prevOFlip: 0 | 1 = 0;
    let nextOX = 0;
    let nextOY = 0;
    let nextOFlip: 0 | 1 = 0;

    if (roll < 0.08 && a.block.flippable && hasMultipleNodeRows(a.block)) {
      nextAFlip = prevAFlip === 0 ? 1 : 0;
    } else if (!anchorPoses && roll < 0.2) {
      const pairSalt = Math.imul(hashA, 0x9e3779b1);
      let bestOtherKey = Number.POSITIVE_INFINITY;
      for (let j = 0; j < n; j++) {
        if (j === pickIdx) continue;
        const k = randSlot01(seed, it, (blockHashes[j] ?? 0) ^ pairSalt, 5);
        if (k < bestOtherKey) {
          bestOtherKey = k;
          otherIdx = j;
        }
      }
      other = otherIdx >= 0 ? placed[otherIdx] : undefined;
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
      const coolFrac = temperature / startTemp;
      const span = 60 + maxSpan * coolFrac;
      const anc = anchorPoses?.[pickIdx];
      const alpha = anc ? 0.08 * coolFrac : 0;
      const pullX = anc ? alpha * (anc.x - prevAX) : 0;
      const pullY = anc ? alpha * (anc.y - prevAY) : 0;
      nextAX = prevAX + pullX + (rX - 0.5) * 2 * span;
      nextAY = prevAY + pullY + (rY - 0.5) * 2 * span;
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
      ctx,
    );
    if (Number.isNaN(change)) continue;
    const entryDelta =
      entryMask[pickIdx] === 1 && nextAFlip !== prevAFlip ? (nextAFlip === 1 ? 120 : -120) : 0;
    const totalDelta = change + entryDelta;

    if (totalDelta <= 0 || rAcc < Math.exp(-totalDelta / temperature)) {
      current += totalDelta;
      if (current < best) {
        best = current;
        for (let i = 0; i < n; i++) {
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
  refreshSegments(links);
}

/**
 * Finds where to put each zone, which has been arranged on its own, as a pure function of `doc`.
 * Isolated `deg === 0` blocks are partitioned out so they never perturb connected zone placement.
 */
export function searchZonePlacement(doc: DavDocument, columnLayout: ColumnLayout): ZonePlacement {
  const arrangement = arrange(doc, columnLayout);
  let best = NOTHING_FOUND;
  for (const seed of SEEDS) {
    const found = searchFrom(columnLayout, arrangement, seed);
    if (found.score < best.score) best = found;
  }
  return best.placement;
}

/**
 * Fast lightweight check before building per-zone column layouts on secondary seeds (`seed !== SEEDS[0]`):
 * avoids 5 redundant `arrange(doc)` builds when `doc` has no connected zones or is a large staged pipeline.
 */
function isSingleSeedFlow(connected: readonly Block[], preserveFlow: boolean): boolean {
  if (connected.length === 0) return true;
  if (!preserveFlow) return false;
  const connBlockNodes = connected.reduce((sum, b) => sum + b.nodes.size, 0);
  return connected.length > MAX_COMPACT_ZONES || connBlockNodes > ANCHORED_FLOW_NODES;
}

function shouldSkipSecondarySeed(
  doc: DavDocument,
  columnLayout: ColumnLayout,
  seed: number,
): boolean {
  if (seed === SEEDS[0]) return false;
  const allConns = synthesizedConnections(doc);
  const flow = analyzeFlow(doc, allConns);
  const owners = ownersOf(doc);
  const connectedIds = new Set<string>();
  for (const c of flow.connections) {
    const bu = owners.get(c.from) ?? c.from;
    const bv = owners.get(c.to) ?? c.to;
    if (bu !== bv) {
      connectedIds.add(bu);
      connectedIds.add(bv);
    }
  }
  if (connectedIds.size === 0) return true;
  if (!flow.hasAnimate) return false;
  let connNodeCount = 0;
  for (const n of doc.nodes) {
    if (connectedIds.has(owners.get(n.id) ?? n.id)) connNodeCount++;
  }
  if (connNodeCount <= ANCHORED_FLOW_NODES && connectedIds.size <= MAX_COMPACT_ZONES) return false;
  const { blocks } = buildBlocks(doc, columnLayout, undefined, flow);
  const { connected } = partitionIsolatedBlocks(blocks, flow, owners);
  return isSingleSeedFlow(connected, shouldPreserveFlow(connected, flow));
}

export function searchZonePlacementFrom(
  doc: DavDocument,
  columnLayout: ColumnLayout,
  seed: number,
): SeedPlacement {
  if (shouldSkipSecondarySeed(doc, columnLayout, seed)) return NOTHING_FOUND;
  return searchFrom(columnLayout, arrange(doc, columnLayout), seed);
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

interface ZoneSlackMeta {
  nodeIds: string[];
  idSet: Set<string>;
  ranks: RankResult;
  maxRank: number;
  colRelXs: number[];
  fwd: Map<string, string[]>;
  revTopo: string[];
}

interface Arrangement {
  connDoc: DavDocument;
  connected: Block[];
  placed: Placed[];
  links: BlockLink[];
  flow: FlowAnalysis;
  flowCtx: FlowContext;
  preserveFlow: boolean;
  isStagedPipeline: boolean;
  isAnchoredFlow: boolean;
  richRefine: boolean;
  columns: Block[][];
  auxiliary: Block[];
  start: ReadonlyMap<string, { x: number; y: number }>;
  polarity: PolarityModel;
  nodeParent: ReadonlyMap<string, string | undefined>;
  owners: ReadonlyMap<string, string>;
  zoneOf: ReadonlyMap<string, string>;
  adj: ReadonlyMap<string, readonly string[]>;
  docLinks: readonly Link[];
  baseOrders: ReadonlyMap<string, readonly string[]>;
  slackMeta: ReadonlyMap<string, ZoneSlackMeta>;
  blockCache: Map<string, Block>;
}

const compareId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function diagramCrossingPenalty(
  doc: DavDocument,
  layout: Layout,
  flow: FlowAnalysis,
  preserveFlow: boolean,
): number {
  const total = countCrossings(doc, layout);
  if (total === 0) return 0;
  if (!preserveFlow) return total * DIAGRAM_CROSSING_COST;
  return total * DIAGRAM_CROSSING_COST + primaryCrossingsOf(flow.connections, layout) * 440;
}

function arrange(doc: DavDocument, columnLayout: ColumnLayout): Arrangement {
  const allConns = synthesizedConnections(doc);
  const flow = analyzeFlow(doc, allConns);
  const { blocks, owners } = buildBlocks(doc, columnLayout, undefined, flow);
  const { connected: rawConn, isolated } = partitionIsolatedBlocks(blocks, flow, owners);

  // Sort connected blocks by pure graph-topological features (never DSL declaration index) so
  // reordering top-level group blocks in the file produces 0.0px layout drift.
  const firstAnimStep = new Map<string, number>();
  const firstAnyStep = new Map<string, number>();
  const interPriDeg = new Map<string, number>();
  for (const c of flow.connections) {
    const bu = owners.get(c.from) ?? c.from;
    const bv = owners.get(c.to) ?? c.to;
    const fs = flow.pairFirstStep.get(flowPairKey(c.from, c.to)) ?? 0;
    firstAnyStep.set(bu, Math.min(firstAnyStep.get(bu) ?? fs, fs));
    firstAnyStep.set(bv, Math.min(firstAnyStep.get(bv) ?? fs, fs));
    if (c.role !== 'static') {
      firstAnimStep.set(bu, Math.min(firstAnimStep.get(bu) ?? fs, fs));
      firstAnimStep.set(bv, Math.min(firstAnimStep.get(bv) ?? fs, fs));
    }
    if (c.role === 'primary' && bu !== bv) {
      interPriDeg.set(bu, (interPriDeg.get(bu) ?? 0) + 1);
      interPriDeg.set(bv, (interPriDeg.get(bv) ?? 0) + 1);
    }
  }
  const connected = [...rawConn].sort((a, b) => {
    const aa = flow.auxiliaryZones.has(a.id) ? 1 : 0;
    const ab = flow.auxiliaryZones.has(b.id) ? 1 : 0;
    if (aa !== ab) return aa - ab;
    const fa = firstAnimStep.get(a.id) ?? firstAnyStep.get(a.id) ?? 0;
    const fb = firstAnimStep.get(b.id) ?? firstAnyStep.get(b.id) ?? 0;
    if (fa !== fb) return fa - fb;
    const sa = flow.zoneStage.get(a.id) ?? 0;
    const sb = flow.zoneStage.get(b.id) ?? 0;
    if (sa !== sb) return sa - sb;
    const da = interPriDeg.get(a.id) ?? 0;
    const db = interPriDeg.get(b.id) ?? 0;
    if (a.nodes.size !== b.nodes.size) return b.nodes.size - a.nodes.size;
    if (da !== db) return db - da;
    return compareId(a.id, b.id);
  });

  const connIds = new Set(connected.map((b) => b.id));
  const connNodes = new Set(connected.flatMap((b) => [...b.nodes.keys()]));
  const zoneOf = zoneOfGroups(doc.groups);

  const connDoc: DavDocument =
    isolated.length === 0 || connected.length === 0
      ? doc
      : {
          ...doc,
          groups: doc.groups.filter((g) => connIds.has(zoneOf.get(g.id) ?? g.id)),
          nodes: doc.nodes.filter((n) => connNodes.has(n.id)),
          steps: doc.steps.map((s) => ({
            ...s,
            animations: s.animations.filter((a) => connNodes.has(a.from) && connNodes.has(a.to)),
            statics: s.statics.filter((st) => connNodes.has(st.from) && connNodes.has(st.to)),
          })),
        };
  const connConns: readonly DavConnection[] =
    isolated.length === 0 || connected.length === 0
      ? allConns
      : allConns.filter((c) => connNodes.has(c.from) && connNodes.has(c.to));

  const preserveFlow = shouldPreserveFlow(connected, flow);
  const flowCtx = buildFlowContext(flow, owners, preserveFlow);
  const { columns, auxiliary } = stageColumns(connected, flow);
  const start = initialPositions(connDoc, connected, owners, columnLayout, flow);
  const connBlockNodes = connected.reduce((sum, b) => sum + b.nodes.size, 0);
  const isStagedPipeline = preserveFlow && connected.length > MAX_COMPACT_ZONES;
  const isAnchoredFlow = !isStagedPipeline && preserveFlow && connBlockNodes > ANCHORED_FLOW_NODES;
  const richRefine =
    !isStagedPipeline &&
    connected.length <= MAX_REFINED_ZONES &&
    connBlockNodes <= MAX_REFINED_NODES;

  const placed: Placed[] = connected.map((block) => ({ block, x: 0, y: 0, flip: 0 }));
  const adj = new Map<string, string[]>();
  for (const e of connConns) {
    if (e.from === e.to) continue;
    pushToMap(adj, e.from, e.to);
    pushToMap(adj, e.to, e.from);
  }
  const polarity = buildPolarityModel(connected, flow, owners, start, preserveFlow);
  const baseOrders = new Map(connected.map((b) => [b.id, nodeOrderOf(b.nodes)]));
  const docLinks = linksOf(connDoc).filter(([u, v]) => connNodes.has(u) && connNodes.has(v));
  const topIds = new Set(topLevelGroups(connDoc.groups).map((g) => g.id));

  const slackMeta = new Map<string, ZoneSlackMeta>();
  if (richRefine) {
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
  }

  return {
    connDoc,
    connected,
    placed,
    links: buildLinks(connDoc, placed, flow),
    flow,
    flowCtx,
    preserveFlow,
    isStagedPipeline,
    isAnchoredFlow,
    richRefine,
    columns,
    auxiliary,
    start,
    polarity,
    nodeParent: parentMap(connDoc.nodes),
    owners,
    zoneOf,
    adj,
    docLinks,
    baseOrders,
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
  flow: FlowAnalysis,
  flowCtx: FlowContext,
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
        curTotal =
          linkCost(curLinks, placed, flowCtx) +
          diagramCrossingPenalty(doc, layoutNow, flow, flowCtx.preserveFlow);
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
          const score =
            linkCost(tLinks, placed, flowCtx) +
            diagramCrossingPenalty(doc, toLayout(placed), flow, flowCtx.preserveFlow);
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
  flow: FlowAnalysis,
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
      if (richRefine && segSame[i] === 1 && dy >= 1) {
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
  for (let sweep = 0; sweep < 4; sweep++) {
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
            if (richRefine) {
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

        if (!richRefine) continue;
        const byScreenY = [...items].sort((a, b) => (p.flip ? b[1].y - a[1].y : a[1].y - b[1].y));
        for (let pass = 0; pass < 3; pass++) {
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

      if (richRefine && p.block.flippable && groups.size >= 2) {
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
      }
    });
    if (!changed) break;
  }
  return anyChanged;
}

/** Splits tall multi-zone stages (`>= 3` zones) into upstream-closer and downstream-closer sub-columns. */
function buildSplitStageColumns(arr: Arrangement): Block[][] {
  const { columns, flow, owners } = arr;
  const maxPriStage = Math.max(0, ...columns.map((_, i) => i));
  const neighborStageScore = (blockId: string): number => {
    const ownStage = flow.zoneStage.get(blockId) ?? 0;
    let wStageSum = 0;
    let wSum = 0;
    for (const c of flow.connections) {
      const bu = owners.get(c.from) ?? c.from;
      const bv = owners.get(c.to) ?? c.to;
      if (bu === bv || (bu !== blockId && bv !== blockId)) continue;
      const otherId = bu === blockId ? bv : bu;
      const isAuxOther = flow.auxiliaryZones.has(otherId);
      if (isAuxOther && bv === blockId) continue;
      const otherStage = isAuxOther ? maxPriStage + 0.5 : (flow.zoneStage.get(otherId) ?? ownStage);
      if (!isAuxOther && otherStage === ownStage) continue;
      const firstStep = flow.pairFirstStep.get(flowPairKey(c.from, c.to)) ?? 0;
      const w = isAuxOther
        ? (flow.hasAnimate ? 0.04 : 0.3) / (1 + 0.5 * firstStep)
        : c.role === 'primary'
          ? 2.0 / (1 + 0.08 * firstStep)
          : c.role === 'return'
            ? 0.8 / (1 + 0.08 * firstStep)
            : (flow.hasAnimate ? 0.04 : 0.3) / (1 + 0.5 * firstStep);
      wStageSum += otherStage * w;
      wSum += w;
    }
    return wSum > 0 ? wStageSum / wSum : ownStage;
  };

  const out: Block[][] = [];
  for (const col of columns) {
    if (col.length <= 2) {
      out.push([...col]);
      continue;
    }
    const sorted = [...col].sort(
      (a, b) => neighborStageScore(a.id) - neighborStageScore(b.id) || compareId(a.id, b.id),
    );
    const half = Math.ceil(sorted.length / 2);
    out.push(sorted.slice(0, half), sorted.slice(half));
  }
  return out;
}

/** Fast deterministic multi-sweep stage solver for large staged pipelines (`>14` zones or `>65` nodes). */
function solveStagedPipeline(
  arr: Arrangement,
  customColumns?: readonly (readonly Block[])[],
  auxMode: 'bands' | 'right-top' | 'right-bot' = 'bands',
): Placed[] {
  const { connDoc, connected, columns, auxiliary, start, flow, flowCtx, owners } = arr;
  const pm = new Map<string, Placed>();
  const base: Placed[] = connected.map((b) => {
    const at = start.get(b.id) ?? { x: 0, y: 0 };
    const p: Placed = { block: cloneBlockNodes(b), x: at.x, y: at.y, flip: 0 };
    pm.set(b.id, p);
    return p;
  });
  const primaryPlaced = base.filter((p) => !flow.auxiliaryZones.has(p.block.id));

  const nbrWeights = new Map<string, Array<{ id: string; w: number }>>();
  for (const c of flow.connections) {
    const bu = owners.get(c.from);
    const bv = owners.get(c.to);
    if (!bu || !bv || bu === bv) continue;
    const firstStep = flow.pairFirstStep.get(flowPairKey(c.from, c.to)) ?? 0;
    const w =
      c.role === 'primary'
        ? 3 / (1 + 0.08 * firstStep)
        : c.role === 'return'
          ? 0.6 / (1 + 0.08 * firstStep)
          : (flow.hasAnimate ? 0.06 : 0.3) / (1 + 0.35 * firstStep);
    pushToMap(nbrWeights, bu, { id: bv, w });
    pushToMap(nbrWeights, bv, { id: bu, w });
  }

  const colsCopy = (customColumns ?? columns).map((c) => [...c]);
  const subColIdx = new Map<string, number>();
  colsCopy.forEach((c, idx) => {
    for (const b of c) subColIdx.set(b.id, idx);
  });
  const layoutCols = () => {
    const colHeights = colsCopy.map(
      (c) => c.reduce((s, b) => s + b.height, 0) + Math.max(0, c.length - 1) * ROW_GAP,
    );
    const tallest = Math.max(0, ...colHeights);
    let x = 0;
    colsCopy.forEach((c, ci) => {
      const colW = Math.max(0, ...c.map((b) => b.width));
      let y = (tallest - (colHeights[ci] ?? 0)) / 2;
      for (const b of c) {
        const p = pm.get(b.id);
        if (p) {
          p.x = x + (colW - b.width) / 2;
          p.y = y;
        }
        y += b.height + ROW_GAP;
      }
      x += colW + STAGE_GAP;
    });
  };

  layoutCols();
  for (let sweep = 0; sweep < 6; sweep++) {
    const indices =
      sweep % 2 === 0 ? colsCopy.map((_, i) => i) : colsCopy.map((_, i) => colsCopy.length - 1 - i);
    for (const ci of indices) {
      const col = colsCopy[ci];
      if (!col || col.length < 2) continue;
      col.sort((a, b) => {
        const targetY = (id: string) => {
          let sw = 0;
          let swy = 0;
          for (const { id: nid, w } of nbrWeights.get(id) ?? []) {
            if (subColIdx.get(nid) === ci || flow.auxiliaryZones.has(nid)) {
              continue;
            }
            const np = pm.get(nid);
            if (np) {
              swy += (np.y + np.block.height / 2) * w;
              sw += w;
            }
          }
          return sw > 0 ? swy / sw : Number.POSITIVE_INFINITY;
        };
        return targetY(a.id) - targetY(b.id) || compareId(a.id, b.id);
      });
      layoutCols();
    }
  }

  // Align single-block columns with intermediate corridor bridges (`allowed`) so non-allowed
  // intermediate blocks stay outside `[min(a.y, b.y), max(a.bot, b.bot)]` (`layerIntrusions = 0`).
  const colOfBlock = new Map<string, Block[]>();
  for (const c of colsCopy) {
    for (const b of c) colOfBlock.set(b.id, c);
  }
  for (const { a, b, allowed } of flowCtx.corridors) {
    if (allowed.size === 0) continue;
    const pa = pm.get(a);
    const pb = pm.get(b);
    if (!pa || !pb) continue;
    const minCx = Math.min(pa.x + pa.block.width / 2, pb.x + pb.block.width / 2);
    const maxCx = Math.max(pa.x + pa.block.width / 2, pb.x + pb.block.width / 2);
    const allowedPlaced = [...allowed]
      .map((id) => pm.get(id))
      .filter(
        (p): p is Placed =>
          p !== undefined && p.x + p.block.width / 2 > minCx && p.x + p.block.width / 2 < maxCx,
      );
    if (allowedPlaced.length === 0) continue;
    const blocked = primaryPlaced.filter((rc) => {
      if (rc === pa || rc === pb || allowed.has(rc.block.id)) return false;
      const cx = rc.x + rc.block.width / 2;
      return cx > minCx && cx < maxCx;
    });
    if (blocked.length === 0) continue;
    const allowMinY = Math.min(...allowedPlaced.map((p) => p.y));
    const allowMaxBot = Math.max(...allowedPlaced.map((p) => p.y + p.block.height));
    const belowBlocked = blocked.filter((rc) => rc.y + rc.block.height <= allowMinY + 4);
    const aboveBlocked = blocked.filter((rc) => rc.y >= allowMaxBot - 4);
    if (belowBlocked.length === blocked.length) {
      const floorY = Math.max(...belowBlocked.map((rc) => rc.y + rc.block.height)) + 8;
      if ((colOfBlock.get(a)?.length ?? 0) === 1 && pa.y < floorY) pa.y = floorY;
      if ((colOfBlock.get(b)?.length ?? 0) === 1 && pb.y < floorY) pb.y = floorY;
    } else if (aboveBlocked.length === blocked.length) {
      const ceilY = Math.min(...aboveBlocked.map((rc) => rc.y)) - 8;
      if ((colOfBlock.get(a)?.length ?? 0) === 1 && pa.y + pa.block.height > ceilY) {
        pa.y = ceilY - pa.block.height;
      }
      if ((colOfBlock.get(b)?.length ?? 0) === 1 && pb.y + pb.block.height > ceilY) {
        pb.y = ceilY - pb.block.height;
      }
    }
  }

  const rowFracOf = new Map<string, number>();
  for (const c of colsCopy) {
    c.forEach((b, ri) => {
      rowFracOf.set(b.id, c.length <= 1 ? 0.5 : ri / (c.length - 1));
    });
  }

  if (primaryPlaced.length > 0) {
    const priLinks = buildLinks(connDoc, primaryPlaced, flow);
    refreshSegments(priLinks);
    for (const p of primaryPlaced) {
      if (!p.block.flippable) continue;
      const prev = p.flip;
      const d = evaluateMove(
        priLinks,
        primaryPlaced,
        p,
        p.x,
        p.y,
        prev === 0 ? 1 : 0,
        undefined,
        0,
        0,
        0,
        flowCtx,
      );
      if (Number.isNaN(d) || d >= -40) {
        if (!Number.isNaN(d)) {
          p.flip = prev;
          refreshTouchingSegments(priLinks, p, undefined);
        }
      }
    }
    compact(priLinks, primaryPlaced, false, flowCtx, HORIZONTAL_CLEARANCE);
    alignEdges(priLinks, primaryPlaced, flowCtx);
    tighten(priLinks, primaryPlaced, flowCtx);
    compact(priLinks, primaryPlaced, false, flowCtx, HORIZONTAL_CLEARANCE);
    straighten(priLinks, primaryPlaced, CHOSEN_STRAIGHT_WORTH, flowCtx);
  }

  if (auxiliary.length > 0) {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const p of primaryPlaced) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x + p.block.width);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y + p.block.height);
    }
    const hasPri = Number.isFinite(minX);
    const midX = hasPri ? (minX + maxX) / 2 : 0;
    const bandMinY = hasPri ? minY : 0;
    const bandMaxY = hasPri ? maxY : 0;
    const rowLimit = Math.max(hasPri ? maxX - minX : 1600, 1600) + 400;

    const statsFor = (id: string) => {
      let wx = 0;
      let wFrac = 0;
      let wSum = 0;
      let minTargetCenter = Number.NEGATIVE_INFINITY;
      let maxSourceCenter = Number.POSITIVE_INFINITY;
      let minOutPriStep = Number.POSITIVE_INFINITY;
      const ownPlaced = pm.get(id);
      for (const c of flow.connections) {
        const bu = owners.get(c.from) ?? c.from;
        const bv = owners.get(c.to) ?? c.to;
        if (bu === bv || (bu !== id && bv !== id)) continue;
        const otherId = bu === id ? bv : bu;
        if (flow.auxiliaryZones.has(otherId)) continue;
        const op = pm.get(otherId);
        if (!op) continue;
        const otherNodeId = bu === id ? c.to : c.from;
        const selfNodeId = bu === id ? c.from : c.to;
        const nr = op.block.nodes.get(otherNodeId);
        const sx = op.x + (nr ? nr.x + nr.width / 2 : op.block.width / 2);
        const relNodeFrac = nr
          ? ((op.flip ? flippedY(op.block, nr, otherNodeId) : nr.y) / Math.max(1, op.block.height) -
              0.5) *
            0.12
          : 0;
        const slotFrac = (rowFracOf.get(otherId) ?? 0.5) + relNodeFrac;
        const fs = flow.pairFirstStep.get(flowPairKey(c.from, c.to)) ?? 0;
        const w =
          c.role === 'primary'
            ? 3 / (1 + 0.08 * fs)
            : c.role === 'return'
              ? 1 / (1 + 0.08 * fs)
              : (flow.hasAnimate ? 0.06 : 0.5) / (1 + 0.35 * fs);
        wx += sx * w;
        wFrac += slotFrac * w;
        wSum += w;
        if (c.role === 'primary' && ownPlaced) {
          const sn = ownPlaced.block.nodes.get(selfNodeId);
          if (sn) {
            const relSelfX = sn.x + sn.width / 2;
            if (bv === id) {
              minTargetCenter = Math.max(
                minTargetCenter,
                sx + 24 - relSelfX + ownPlaced.block.width / 2,
              );
            } else {
              minOutPriStep = Math.min(minOutPriStep, fs);
              maxSourceCenter = Math.min(
                maxSourceCenter,
                sx - 24 - relSelfX + ownPlaced.block.width / 2,
              );
            }
          }
        }
      }
      const meanX = wSum > 0 ? wx / wSum : midX;
      const meanFrac = wSum > 0 ? wFrac / wSum : 0.5;
      const clampedX =
        minTargetCenter <= maxSourceCenter
          ? Math.min(maxSourceCenter, Math.max(meanX, minTargetCenter))
          : Math.max(meanX, minTargetCenter);
      return {
        meanX,
        minOutPriStep,
        cx: clampedX,
        maxRight: Number.isFinite(maxSourceCenter)
          ? maxSourceCenter + (ownPlaced?.block.width ?? 0) / 2
          : Number.POSITIVE_INFINITY,
        side: meanFrac < 0.42 ? ('above' as const) : ('below' as const),
      };
    };

    const meta = new Map(auxiliary.map((b) => [b.id, statsFor(b.id)]));
    const orderedAux = [...auxiliary].sort((a, b) => {
      const ca = meta.get(a.id)?.cx ?? midX;
      const cb = meta.get(b.id)?.cx ?? midX;
      return ca - cb || compareId(a.id, b.id);
    });
    const placeBand = (band: readonly Block[], isAbove: boolean) => {
      const startRefX = hasPri ? minX : 0;
      const rows: Array<{ items: Array<{ block: Block; x: number }>; height: number }> = [];
      let end = Number.NEGATIVE_INFINITY;
      for (const b of band) {
        const m = meta.get(b.id);
        const cx = m?.cx ?? midX;
        const maxR = m?.maxRight ?? Number.POSITIVE_INFINITY;
        const rawX = cx - b.width / 2;
        const cur = rows[rows.length - 1];
        const nextX = Math.max(rawX, end + HORIZONTAL_CLEARANCE);
        if (
          !cur ||
          (cur.items.length > 0 &&
            (nextX - startRefX + b.width > rowLimit || nextX + b.width > maxR + 1))
        ) {
          rows.push({ items: [{ block: b, x: rawX }], height: b.height });
          end = rawX + b.width;
        } else {
          cur.items.push({ block: b, x: nextX });
          cur.height = Math.max(cur.height, b.height);
          end = nextX + b.width;
        }
      }
      let edgeY = isAbove ? bandMinY - VERTICAL_CLEARANCE - 24 : bandMaxY + VERTICAL_CLEARANCE + 24;
      for (const row of rows) {
        for (const { block, x } of row.items) {
          const p = pm.get(block.id);
          if (p) {
            p.x = x;
            p.y = isAbove ? edgeY - block.height : edgeY;
          }
        }
        edgeY = isAbove ? edgeY - row.height - ROW_GAP : edgeY + row.height + ROW_GAP;
      }
    };

    const isRightAux = auxMode === 'right-top' || auxMode === 'right-bot';
    const rightAux =
      isRightAux && hasPri
        ? orderedAux.filter((b) => {
            const m = meta.get(b.id);
            return m !== undefined && m.minOutPriStep > 1 && m.meanX >= midX;
          })
        : [];
    const bandAux =
      rightAux.length > 0 ? orderedAux.filter((b) => !rightAux.includes(b)) : orderedAux;

    if (rightAux.length > 0 && hasPri) {
      const lastCol = colsCopy[colsCopy.length - 1];
      const lastP = lastCol?.length === 1 && lastCol[0] ? pm.get(lastCol[0].id) : undefined;
      if (lastP && rightAux.length === 1 && rightAux[0]) {
        const auxP = pm.get(rightAux[0].id);
        if (auxP) {
          const prevLastY = lastP.y;
          const totalStackH = auxP.block.height + ROW_GAP + lastP.block.height;
          const midPriY = (minY + maxY) / 2;
          let stackX = lastP.x;
          for (const p of primaryPlaced) {
            if (p === lastP) continue;
            stackX = Math.max(stackX, p.x + p.block.width + STAGE_GAP);
          }
          auxP.x = stackX;
          lastP.x = stackX;
          if (auxMode === 'right-top') {
            auxP.y = midPriY - totalStackH / 2;
            lastP.y = auxP.y + auxP.block.height + ROW_GAP;
          } else {
            lastP.y = midPriY - totalStackH / 2;
            auxP.y = lastP.y + lastP.block.height + ROW_GAP;
          }
          if (!isClear(auxP, base) || !isClear(lastP, base)) {
            lastP.y = prevLastY;
            auxP.x = maxX + STAGE_GAP;
            auxP.y = midPriY - auxP.block.height / 2;
          }
        }
      } else {
        const totalAuxH =
          rightAux.reduce((s, b) => s + b.height, 0) + Math.max(0, rightAux.length - 1) * ROW_GAP;
        let curY = (minY + maxY - totalAuxH) / 2;
        const rightX = maxX + STAGE_GAP;
        for (const b of rightAux) {
          const p = pm.get(b.id);
          if (p) {
            p.x = rightX;
            p.y = curY;
          }
          curY += b.height + ROW_GAP;
        }
      }
    }
    if (bandAux.length > 0) {
      placeBand(
        bandAux.filter((b) => meta.get(b.id)?.side === 'above'),
        true,
      );
      placeBand(
        bandAux.filter((b) => meta.get(b.id)?.side !== 'above'),
        false,
      );
    }

    const allLinks = buildLinks(connDoc, base, flow);
    refreshSegments(allLinks);
    const flippableAll = base.filter((p) => p.block.flippable && p.block.nodes.size >= 2);
    if (isRightAux && flippableAll.length > 0 && flippableAll.length <= 7) {
      let bestMask = 0;
      let bestObj = Number.POSITIVE_INFINITY;
      const totalMasks = 1 << flippableAll.length;
      for (let mask = 0; mask < totalMasks; mask++) {
        flippableAll.forEach((p, idx) => {
          p.flip = ((mask >> idx) & 1) as 0 | 1;
        });
        refreshSegments(allLinks);
        const obj =
          linkCost(allLinks, base, flowCtx) +
          diagramCrossingPenalty(connDoc, toLayout(base), flow, true);
        if (obj < bestObj - 1) {
          bestObj = obj;
          bestMask = mask;
        }
      }
      flippableAll.forEach((p, idx) => {
        p.flip = ((bestMask >> idx) & 1) as 0 | 1;
      });
      refreshSegments(allLinks);
    } else {
      for (const b of orderedAux) {
        const p = pm.get(b.id);
        if (!p?.block.flippable) continue;
        const prev = p.flip;
        const d = evaluateMove(
          allLinks,
          base,
          p,
          p.x,
          p.y,
          prev === 0 ? 1 : 0,
          undefined,
          0,
          0,
          0,
          flowCtx,
        );
        if (Number.isNaN(d) || d >= -40) {
          if (!Number.isNaN(d)) {
            p.flip = prev;
            refreshTouchingSegments(allLinks, p, undefined);
          }
        }
      }
    }
  }

  return base;
}

function clearCorridorIntrusions(
  doc: DavDocument,
  placed: Placed[],
  links: BlockLink[],
  flow: FlowAnalysis,
  flowCtx: FlowContext,
): void {
  if (!flowCtx.preserveFlow || flowCtx.corridors.length === 0) return;
  const countIntrusions = () => {
    const rectMap = new Map(
      placed.map((p) => [
        p.block.id,
        { x: p.x, y: p.y, width: p.block.width, height: p.block.height },
      ]),
    );
    return countCorridorIntrusions(flowCtx.corridors, rectMap);
  };
  const hasBackwardPrimary = () => {
    for (const l of links) {
      if (l.role === 'primary' && l.bx <= l.ax) return true;
    }
    return false;
  };
  let curInt = countIntrusions();
  if (curInt === 0) return;

  for (let pass = 0; pass < 3 && curInt > 0; pass++) {
    let improved = false;
    const byId = new Map(placed.map((p) => [p.block.id, p]));
    for (const c of flowCtx.corridors) {
      const ra = byId.get(c.a);
      const rb = byId.get(c.b);
      if (!ra || !rb) continue;
      const ax = ra.x + ra.block.width / 2;
      const bx = rb.x + rb.block.width / 2;
      const minX = Math.min(ax, bx);
      const maxX = Math.max(ax, bx);
      const bandTop = Math.min(ra.y, rb.y);
      const bandBot = Math.max(ra.y + ra.block.height, rb.y + rb.block.height);

      for (const rc of placed) {
        if (rc === ra || rc === rb || c.allowed.has(rc.block.id)) continue;
        const cx = rc.x + rc.block.width / 2;
        if (!(cx > minX && cx < maxX && rc.y < bandBot && rc.y + rc.block.height > bandTop)) {
          continue;
        }
        const tallAspectPen = () => {
          const e = extent(placed);
          const a = e.width / Math.max(1, e.height);
          return a < 1.35 ? (1.35 - a) * 10000 : 0;
        };
        const prevX = rc.x;
        const prevY = rc.y;
        refreshSegments(links);
        const curCost =
          linkCost(links, placed, flowCtx) +
          diagramCrossingPenalty(doc, toLayout(placed), flow, true) +
          curInt * 4200 +
          tallAspectPen();

        const targetRightX = maxX - rc.block.width / 2 + 2;
        const vGap = VERTICAL_CLEARANCE + 1;
        const hGap = HORIZONTAL_CLEARANCE + 1;
        const candidatePoses: Array<{ x: number; y: number }> = [
          { x: targetRightX, y: prevY },
          { x: prevX, y: bandTop - vGap - rc.block.height },
          { x: prevX, y: bandBot + vGap },
          { x: targetRightX, y: bandTop - vGap - rc.block.height },
        ];
        for (const q of placed) {
          if (q === rc) continue;
          const rightOfQ = q.x + q.block.width + hGap;
          const leftOfQ = q.x - hGap - rc.block.width;
          candidatePoses.push(
            { x: Math.max(targetRightX, q.x), y: q.y - vGap - rc.block.height },
            { x: Math.max(targetRightX, q.x), y: q.y + q.block.height + vGap },
            { x: rightOfQ, y: prevY },
            { x: rightOfQ, y: q.y },
            { x: rightOfQ, y: q.y - vGap - rc.block.height },
            { x: Math.max(targetRightX, rightOfQ), y: q.y - vGap - rc.block.height },
            { x: rightOfQ, y: bandTop - 4 - rc.block.height },
            { x: rightOfQ, y: bandBot + 4 },
            { x: leftOfQ, y: bandTop - 4 - rc.block.height },
          );
        }

        let bestPose: { x: number; y: number; cost: number; intCount: number } | undefined;
        for (const cand of candidatePoses) {
          rc.x = cand.x;
          rc.y = cand.y;
          if (!isClear(rc, placed)) continue;
          refreshSegments(links);
          if (hasBackwardPrimary()) continue;
          const nextInt = countIntrusions();
          if (nextInt >= curInt) continue;
          const nextCost =
            linkCost(links, placed, flowCtx) +
            diagramCrossingPenalty(doc, toLayout(placed), flow, true) +
            nextInt * 4200 +
            tallAspectPen();
          if (nextCost < curCost && (!bestPose || nextCost < bestPose.cost)) {
            bestPose = { x: cand.x, y: cand.y, cost: nextCost, intCount: nextInt };
          }
        }

        if (bestPose) {
          rc.x = bestPose.x;
          rc.y = bestPose.y;
          curInt = bestPose.intCount;
          refreshSegments(links);
          improved = true;
        } else {
          rc.x = prevX;
          rc.y = prevY;
          refreshSegments(links);
        }
      }
    }
    if (!improved) break;
  }
}

function clonePlacedWithPoses(placed: readonly Placed[], poses: readonly Pose[]): Placed[] {
  return placed.map((p, i) => {
    const pose = poses[i] ?? { x: p.x, y: p.y, flip: p.flip };
    return {
      block: cloneBlockNodes(p.block),
      x: pose.x,
      y: pose.y,
      flip: pose.flip,
    };
  });
}

function searchFrom(columnLayout: ColumnLayout, arr: Arrangement, seed: number): SeedPlacement {
  const isPrimarySeed = seed === SEEDS[0];
  if (arr.connected.length === 0) {
    return isPrimarySeed ? { score: 0, placement: new Map() } : NOTHING_FOUND;
  }
  if (!isPrimarySeed && isSingleSeedFlow(arr.connected, arr.preserveFlow)) {
    return NOTHING_FOUND;
  }
  if (arr.isStagedPipeline) {
    const scoreStagedCandidate = (cand: Placed[]): SeedPlacement => {
      refineZoneNodeOrder(cand, arr.nodeParent, arr.owners, arr.adj, arr.docLinks, false, arr.flow);
      const minX = Math.min(...cand.map((p) => p.x));
      const minY = Math.min(...cand.map((p) => p.y));
      for (const p of cand) {
        p.x -= minX;
        p.y -= minY;
      }
      const trialLinks = buildLinks(arr.connDoc, cand, arr.flow);
      refreshSegments(trialLinks);
      const ext = extent(cand);
      const asp = ext.width / Math.max(1, ext.height);
      const portraitPen = asp < 1.2 ? (1.2 - asp) * 35000 : 0;
      const score =
        linkCost(trialLinks, cand, arr.flowCtx) +
        diagramCrossingPenalty(arr.connDoc, toLayout(cand), arr.flow, arr.preserveFlow) +
        portraitPen -
        straightLinks(trialLinks, cand) * STRAIGHT_WORTH;
      return { score, placement: snapshot(cand, arr.baseOrders, new Map()) };
    };

    const unsplitPlaced = solveStagedPipeline(arr);
    const unsplitExt = extent(unsplitPlaced);
    const unsplitAsp = unsplitExt.width / Math.max(1, unsplitExt.height);
    let bestStaged = scoreStagedCandidate(unsplitPlaced);
    if (unsplitAsp < 1.35 && arr.columns.some((c) => c.length >= 3)) {
      const splitCols = buildSplitStageColumns(arr);
      for (const mode of ['bands', 'right-top'] as const) {
        const cand = scoreStagedCandidate(solveStagedPipeline(arr, splitCols, mode));
        if (cand.score < bestStaged.score) bestStaged = cand;
      }
    }
    return bestStaged;
  }
  const {
    connDoc,
    connected,
    placed,
    links,
    flow,
    flowCtx,
    start,
    polarity,
    nodeParent,
    owners,
    zoneOf,
    adj,
    docLinks,
    baseOrders,
    richRefine,
    slackMeta,
    blockCache,
  } = arr;

  let priMinY = Number.POSITIVE_INFINITY;
  let priMaxY = Number.NEGATIVE_INFINITY;
  for (const p of placed) {
    if (flow.auxiliaryZones.has(p.block.id)) continue;
    const at = start.get(p.block.id) ?? { x: 0, y: 0 };
    priMinY = Math.min(priMinY, at.y);
    priMaxY = Math.max(priMaxY, at.y + p.block.height);
  }
  for (const p of placed) {
    const at = start.get(p.block.id) ?? { x: 0, y: 0 };
    p.x = at.x;
    p.y = at.y;
    p.flip = 0;
  }
  const auxOrdered = arr.auxiliary
    .map((b) => placed.find((p) => p.block.id === b.id))
    .filter((p): p is Placed => p !== undefined)
    .sort(
      (a, b) =>
        (start.get(a.block.id)?.x ?? 0) - (start.get(b.block.id)?.x ?? 0) ||
        compareId(a.block.id, b.block.id),
    );
  if (flowCtx.preserveFlow && Number.isFinite(priMaxY) && auxOrdered.length > 0) {
    let belowEnd = Number.NEGATIVE_INFINITY;
    for (const p of auxOrdered) {
      const rawX = start.get(p.block.id)?.x ?? 0;
      const px = Math.max(rawX, belowEnd + HORIZONTAL_CLEARANCE);
      p.x = px;
      p.y = priMaxY + VERTICAL_CLEARANCE + 24;
      belowEnd = px + p.block.width;
    }
  }
  const startSnapshot = posesOf(placed);
  const resetStart = () => restore(placed, startSnapshot);

  const entryMask = new Uint8Array(placed.length);
  if (flowCtx.preserveFlow && arr.columns[0]?.length === 1) {
    placed.forEach((p, i) => {
      if (
        p.block.flippable &&
        hasMultipleNodeRows(p.block) &&
        !flow.auxiliaryZones.has(p.block.id) &&
        (flow.zoneStage.get(p.block.id) ?? 0) === 0
      ) {
        entryMask[i] = 1;
      }
    });
  }

  const hClear = HORIZONTAL_CLEARANCE;
  const hasNestedGroups = connDoc.groups.some((g) => g.parentId !== undefined);
  const baseCandidates: Array<{ poses: Pose[]; staged: boolean }> = [];
  const canonicalAnchorPoses: Pose[] = startSnapshot;

  if (arr.isAnchoredFlow) {
    const splitCols = buildSplitStageColumns(arr);
    const splitRightTop = solveStagedPipeline(arr, splitCols, 'right-top');
    const splitTopLinks = buildLinks(connDoc, splitRightTop, flow);
    refreshSegments(splitTopLinks);
    tighten(splitTopLinks, splitRightTop, flowCtx, hClear);
    const topPoses = posesOf(splitRightTop);
    baseCandidates.push({ poses: topPoses, staged: true });

    if (arr.auxiliary.length >= 2) {
      const splitBands = solveStagedPipeline(arr, splitCols, 'bands');
      const splitBandLinks = buildLinks(connDoc, splitBands, flow);
      refreshSegments(splitBandLinks);
      tighten(splitBandLinks, splitBands, flowCtx, hClear);
      const bandPoses = posesOf(splitBands);
      const differs = bandPoses.some(
        (bp, idx) =>
          Math.abs(bp.x - (topPoses[idx]?.x ?? 0)) > 1 ||
          Math.abs(bp.y - (topPoses[idx]?.y ?? 0)) > 1,
      );
      if (differs) baseCandidates.push({ poses: bandPoses, staged: true });
    }
  } else {
    if (
      isPrimarySeed &&
      flowCtx.preserveFlow &&
      connected.length <= 6 &&
      auxOrdered.length === 1 &&
      !polarity.passiveStaticAux &&
      Number.isFinite(priMinY)
    ) {
      const flippablePlaced = placed.filter(
        (p) => p.block.flippable && hasMultipleNodeRows(p.block),
      );
      const optimizeExactFlips = () => {
        if (flippablePlaced.length === 0 || flippablePlaced.length > 5) return;
        let bestMask = 0;
        let bestObj = Number.POSITIVE_INFINITY;
        const totalMasks = 1 << flippablePlaced.length;
        for (let mask = 0; mask < totalMasks; mask++) {
          flippablePlaced.forEach((p, idx) => {
            p.flip = ((mask >> idx) & 1) as 0 | 1;
          });
          refreshSegments(links);
          let obj =
            linkCost(links, placed, flowCtx) +
            diagramCrossingPenalty(connDoc, toLayout(placed), flow, true);
          for (let i = 0; i < placed.length; i++) {
            if (entryMask[i] === 1 && placed[i]?.flip === 1) obj += 120;
          }
          if (obj < bestObj - 1) {
            bestObj = obj;
            bestMask = mask;
          }
        }
        flippablePlaced.forEach((p, idx) => {
          p.flip = ((bestMask >> idx) & 1) as 0 | 1;
        });
        refreshSegments(links);
      };

      const auxP = auxOrdered[0];
      if (auxP) {
        for (let ci = 1; ci < arr.columns.length; ci++) {
          const firstB = arr.columns[ci]?.[0];
          if (!firstB) continue;
          const colX = start.get(firstB.id)?.x ?? 0;
          for (const above of [false, true]) {
            resetStart();
            auxP.x = colX;
            let minOverlapY = Number.POSITIVE_INFINITY;
            let maxOverlapBot = Number.NEGATIVE_INFINITY;
            for (const q of placed) {
              if (q === auxP || flow.auxiliaryZones.has(q.block.id)) continue;
              if (
                auxP.x < q.x + q.block.width + hClear &&
                q.x < auxP.x + auxP.block.width + hClear
              ) {
                minOverlapY = Math.min(minOverlapY, q.y);
                maxOverlapBot = Math.max(maxOverlapBot, q.y + q.block.height);
              }
            }
            auxP.y = above
              ? (Number.isFinite(minOverlapY) ? minOverlapY : priMinY) -
                VERTICAL_CLEARANCE -
                24 -
                auxP.block.height
              : (Number.isFinite(maxOverlapBot) ? maxOverlapBot : priMaxY) +
                VERTICAL_CLEARANCE +
                24;
            optimizeExactFlips();
            tighten(links, placed, flowCtx, hClear);
            baseCandidates.push({ poses: posesOf(placed), staged: false });
          }
        }
        resetStart();
      }
    }

    refreshSegments(links);
    anneal(links, placed, seed, entryMask, flowCtx);
    tighten(links, placed, flowCtx, hClear);
    baseCandidates.push({ poses: posesOf(placed), staged: false });
    if (flowCtx.preserveFlow && polarity.allFlippable && polarity.passiveStaticAux) {
      let maxBot = Number.NEGATIVE_INFINITY;
      for (const p of placed) {
        if (p.y + p.block.height > maxBot) maxBot = p.y + p.block.height;
      }
      const mirrorPoses: Pose[] = placed.map((p) => ({
        x: p.x,
        y: maxBot - (p.y + p.block.height),
        flip: p.flip === 0 ? 1 : 0,
      }));
      const mirrorPlaced = clonePlacedWithPoses(placed, mirrorPoses);
      const mirrorLinks = buildLinks(connDoc, mirrorPlaced, flow);
      refreshSegments(mirrorLinks);
      tighten(mirrorLinks, mirrorPlaced, flowCtx, hClear);
      baseCandidates.push({ poses: posesOf(mirrorPlaced), staged: false });
    }
    if (isPrimarySeed && flowCtx.preserveFlow && connected.length >= 7 && arr.columns.length >= 3) {
      const stagedPlaced = solveStagedPipeline(arr);
      const stagedLinks = buildLinks(connDoc, stagedPlaced, flow);
      refreshSegments(stagedLinks);
      tighten(stagedLinks, stagedPlaced, flowCtx, hClear);
      baseCandidates.push({ poses: posesOf(stagedPlaced), staged: true });
    }
  }

  let best = NOTHING_FOUND;
  const annealModes: ReadonlyArray<{ aside: boolean; breathe: boolean }> =
    flowCtx.preserveFlow && (polarity.allFlippable || polarity.firstAuxIdx < 0)
      ? [
          { aside: false, breathe: false },
          { aside: true, breathe: false },
          { aside: false, breathe: true },
          { aside: true, breathe: true },
        ]
      : [
          { aside: false, breathe: false },
          { aside: true, breathe: false },
        ];
  const stagedModes: ReadonlyArray<{ aside: boolean; breathe: boolean }> = arr.isAnchoredFlow
    ? [{ aside: false, breathe: false }]
    : [
        { aside: false, breathe: false },
        { aside: true, breathe: false },
      ];

  const relAnchorPenalty = (cand: readonly Placed[]): number => {
    if (!flowCtx.preserveFlow) return 0;
    const isSmallNested = hasNestedGroups && connected.length <= 6 && polarity.firstAuxIdx < 0;
    if (!isSmallNested) return 0;
    const wx = isSmallNested ? 1.1 : 1.3;
    const wy = isSmallNested ? 0.6 : 0.45;
    let priCount = 0;
    let sumPX = 0;
    let sumPY = 0;
    let sumSX = 0;
    let sumSY = 0;
    for (let i = 0; i < cand.length; i++) {
      const p = cand[i];
      const sp = canonicalAnchorPoses[i];
      if (!p || !sp || (!arr.isAnchoredFlow && flow.auxiliaryZones.has(p.block.id))) continue;
      priCount++;
      sumPX += p.x;
      sumPY += p.y;
      sumSX += sp.x;
      sumSY += sp.y;
    }
    if (priCount === 0) return 0;
    const meanPX = sumPX / priCount;
    const meanPY = sumPY / priCount;
    const meanSX = sumSX / priCount;
    const meanSY = sumSY / priCount;
    let pen = 0;
    for (let i = 0; i < cand.length; i++) {
      const p = cand[i];
      const sp = canonicalAnchorPoses[i];
      if (!p || !sp || (!arr.isAnchoredFlow && flow.auxiliaryZones.has(p.block.id))) continue;
      pen +=
        Math.abs(p.x - meanPX - (sp.x - meanSX)) * wx +
        Math.abs(p.y - meanPY - (sp.y - meanSY)) * wy;
    }
    return pen;
  };

  for (const { poses: basePoses, staged } of baseCandidates) {
    for (const { aside, breathe } of staged ? stagedModes : annealModes) {
      const trialPlaced = clonePlacedWithPoses(placed, basePoses);
      const trialBaseOrders = new Map(baseOrders);
      let trialLinks = buildLinks(connDoc, trialPlaced, flow);
      refreshSegments(trialLinks);
      compact(trialLinks, trialPlaced, aside, flowCtx, hClear);
      alignEdges(trialLinks, trialPlaced, flowCtx, hClear);
      tighten(trialLinks, trialPlaced, flowCtx, hClear);
      compact(trialLinks, trialPlaced, aside, flowCtx, hClear);

      const ranksByZone = optimizeZoneSlackRanks(
        connDoc,
        columnLayout,
        trialPlaced,
        owners,
        zoneOf,
        nodeParent,
        adj,
        trialBaseOrders,
        slackMeta,
        blockCache,
        flow,
        flowCtx,
      );
      if (ranksByZone.size > 0) {
        trialLinks = buildLinks(connDoc, trialPlaced, flow);
        refreshSegments(trialLinks);
        tighten(trialLinks, trialPlaced, flowCtx, hClear);
      }
      if (connected.length >= 7 && flowCtx.preserveFlow) {
        clearCorridorIntrusions(connDoc, trialPlaced, trialLinks, flow, flowCtx);
      }

      // Re-optimize multi-row flippable zone flips AFTER compaction on compact non-nested aux
      // pipelines so vertical flip orientation reflects compacted stage positions.
      if (
        isPrimarySeed &&
        richRefine &&
        flowCtx.preserveFlow &&
        !hasNestedGroups &&
        polarity.firstAuxIdx >= 0 &&
        !polarity.passiveStaticAux &&
        connected.length <= 6
      ) {
        const flipTargets = trialPlaced.filter(
          (p) => p.block.flippable && hasMultipleNodeRows(p.block),
        );
        if (flipTargets.length > 0 && flipTargets.length <= 5) {
          let bestMask = 0;
          flipTargets.forEach((p, idx) => {
            if (p.flip === 1) bestMask |= 1 << idx;
          });
          let bestFlipObj = Number.POSITIVE_INFINITY;
          const totalMasks = 1 << flipTargets.length;
          for (let mask = 0; mask < totalMasks; mask++) {
            flipTargets.forEach((p, idx) => {
              p.flip = ((mask >> idx) & 1) as 0 | 1;
            });
            refreshSegments(trialLinks);
            let obj =
              linkCost(trialLinks, trialPlaced, flowCtx) +
              diagramCrossingPenalty(connDoc, toLayout(trialPlaced), flow, true);
            for (let i = 0; i < trialPlaced.length; i++) {
              if (entryMask[i] === 1 && trialPlaced[i]?.flip === 1) obj += 120;
            }
            if (obj < bestFlipObj - 1) {
              bestFlipObj = obj;
              bestMask = mask;
            }
          }
          flipTargets.forEach((p, idx) => {
            p.flip = ((bestMask >> idx) & 1) as 0 | 1;
          });
          refreshSegments(trialLinks);
          tighten(trialLinks, trialPlaced, flowCtx, hClear);
        }
      }

      // Only consider turning loop zones upside down on small non-nested compact graphs (`<= 6` zones)
      // so nested-group architectures keep their vertical sub-group hierarchy intact.
      if (
        richRefine &&
        !hasNestedGroups &&
        connected.length <= 6 &&
        trialPlaced.some((p) => !p.block.flippable && hasMultipleNodeRows(p.block))
      ) {
        let flippedAny = false;
        let curFlipScore =
          linkCost(trialLinks, trialPlaced, flowCtx) +
          diagramCrossingPenalty(connDoc, toLayout(trialPlaced), flow, flowCtx.preserveFlow);
        for (const p of trialPlaced) {
          if (p.block.flippable || !hasMultipleNodeRows(p.block)) continue;
          const prevFlip = p.flip;
          p.flip = prevFlip === 0 ? 1 : 0;
          refreshTouchingSegments(trialLinks, p, undefined);
          const nextFlipScore =
            linkCost(trialLinks, trialPlaced, flowCtx) +
            diagramCrossingPenalty(connDoc, toLayout(trialPlaced), flow, flowCtx.preserveFlow);
          if (nextFlipScore < curFlipScore - 1) {
            curFlipScore = nextFlipScore;
            flippedAny = true;
          } else {
            p.flip = prevFlip;
            refreshTouchingSegments(trialLinks, p, undefined);
          }
        }
        if (flippedAny) {
          tighten(trialLinks, trialPlaced, flowCtx, hClear);
          compact(trialLinks, trialPlaced, aside, flowCtx, hClear);
        }
      }

      if (arr.isAnchoredFlow) {
        const flipTargets = trialPlaced.filter(
          (p) => p.block.flippable && hasMultipleNodeRows(p.block),
        );
        if (flipTargets.length > 0 && flipTargets.length <= 7) {
          let bestMask = 0;
          flipTargets.forEach((p, idx) => {
            if (p.flip === 1) bestMask |= 1 << idx;
          });
          let bestFlipObj = Number.POSITIVE_INFINITY;
          const totalMasks = 1 << flipTargets.length;
          for (let mask = 0; mask < totalMasks; mask++) {
            flipTargets.forEach((p, idx) => {
              p.flip = ((mask >> idx) & 1) as 0 | 1;
            });
            refreshSegments(trialLinks);
            const obj =
              linkCost(trialLinks, trialPlaced, flowCtx) +
              diagramCrossingPenalty(connDoc, toLayout(trialPlaced), flow, true);
            if (obj < bestFlipObj - 1) {
              bestFlipObj = obj;
              bestMask = mask;
            }
          }
          flipTargets.forEach((p, idx) => {
            p.flip = ((bestMask >> idx) & 1) as 0 | 1;
          });
          refreshSegments(trialLinks);
        }
      }

      if (refineZoneNodeOrder(trialPlaced, nodeParent, owners, adj, docLinks, richRefine, flow)) {
        trialLinks = buildLinks(connDoc, trialPlaced, flow);
        refreshSegments(trialLinks);
      }
      if (arr.isAnchoredFlow) {
        const countBackPri = (): number => {
          let cnt = 0;
          for (const l of trialLinks) {
            if (l.role === 'primary' && l.bx <= l.ax) cnt++;
          }
          return cnt;
        };
        const evalAnchored = (backPriCount: number) => {
          const lay = toLayout(trialPlaced);
          const e = extent(trialPlaced);
          const a = e.width / Math.max(1, e.height);
          const pPen = a < 1.28 ? (1.28 - a) * 35000 : 0;
          const rectMap = new Map(
            trialPlaced.map((p) => [
              p.block.id,
              { x: p.x, y: p.y, width: p.block.width, height: p.block.height },
            ]),
          );
          return (
            linkCost(trialLinks, trialPlaced, flowCtx) * 0.45 +
            countCrossings(connDoc, lay) * 420 +
            countCorridorIntrusions(flowCtx.corridors, rectMap) * 4200 +
            primaryCrossingsOf(flow.connections, lay) * 700 +
            backPriCount * 8000 +
            pPen
          );
        };
        let curBackPri = countBackPri();
        let curObj = evalAnchored(curBackPri);
        for (const step of [128, 64, 32, 16]) {
          for (let pass = 0; pass < 3; pass++) {
            let moved = false;
            for (const p of trialPlaced) {
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
                if (!isClear(p, trialPlaced, hClear)) continue;
                refreshTouchingSegments(trialLinks, p, undefined);
                const nextBackPri = countBackPri();
                if (nextBackPri > curBackPri) continue;
                const obj = evalAnchored(nextBackPri);
                if (obj < curObj - 1 && (!bestMove || obj < bestMove.obj)) {
                  bestMove = { x: p.x, y: p.y, obj, backPri: nextBackPri };
                }
              }
              if (bestMove) {
                p.x = bestMove.x;
                p.y = bestMove.y;
                curObj = bestMove.obj;
                curBackPri = bestMove.backPri;
                refreshTouchingSegments(trialLinks, p, undefined);
                moved = true;
              } else {
                p.x = hx;
                p.y = hy;
                refreshTouchingSegments(trialLinks, p, undefined);
              }
            }
            if (!moved) break;
          }
        }
        if (refineZoneNodeOrder(trialPlaced, nodeParent, owners, adj, docLinks, richRefine, flow)) {
          trialLinks = buildLinks(connDoc, trialPlaced, flow);
          refreshSegments(trialLinks);
        }
      }
      if (breathe) {
        restoreStageBreathingRoom(trialPlaced, flowCtx);
        refreshSegments(trialLinks);
      }
      straighten(trialLinks, trialPlaced, STRAIGHT_WORTH, flowCtx, hClear);

      const candLayout = toLayout(trialPlaced);
      const layoutBounds = enclosingRect([
        ...Object.values(candLayout.nodes),
        ...Object.values(candLayout.groups),
      ]);
      const layoutAsp = layoutBounds.width / Math.max(1, layoutBounds.height);
      const ext = extent(trialPlaced);
      const asp = ext.width / Math.max(1, ext.height);
      const minAsp = connected.length >= 7 ? 1.28 : 1.08;
      const portraitPen =
        flowCtx.preserveFlow && (asp < minAsp || layoutAsp < 1.08)
          ? Math.max(minAsp - asp, 1.08 - layoutAsp) * 35000
          : 0;
      const minWideAsp = arr.columns.length >= 4 ? 2.28 : 2.05;
      const minNoAuxAsp = arr.columns.length >= 4 ? 2.48 : 1.85;
      const clampedAsp = Math.max(1.5, layoutAsp);
      const underTwoPen =
        flowCtx.preserveFlow && (polarity.allFlippable || polarity.firstAuxIdx < 0)
          ? polarity.firstAuxIdx >= 0
            ? clampedAsp < minWideAsp
              ? (minWideAsp - clampedAsp) * 20000
              : 0
            : clampedAsp < minNoAuxAsp
              ? (minNoAuxAsp - clampedAsp) * 18000
              : 0
          : 0;
      const polPen = polarityPenalty(trialPlaced, polarity);
      let entryPen = 0;
      for (let i = 0; i < trialPlaced.length; i++) {
        if (entryMask[i] === 1 && trialPlaced[i]?.flip === 1) entryPen += 120;
      }
      let primaryThroughPen = 0;
      if (flowCtx.preserveFlow && polarity.firstAuxIdx >= 0 && !hasNestedGroups) {
        for (const l of trialLinks) {
          if (l.role !== 'return') {
            const len = Math.hypot(l.bx - l.ax, l.by - l.ay);
            if (len > 1900) primaryThroughPen += (len - 1900) * 1.5;
          }
          if (l.role !== 'primary') continue;
          for (const p of trialPlaced) {
            if (p !== l.source && p !== l.target && runsThrough(l, p)) primaryThroughPen += 120;
          }
        }
      }
      const rShare = flowCtx.preserveFlow ? rightwardShare(trialLinks) : 1;
      const lowRightPen =
        flowCtx.preserveFlow && connected.length <= 6 && rShare < 0.5 ? (0.5 - rShare) * 25000 : 0;
      const needDefects =
        flowCtx.preserveFlow &&
        (arr.isAnchoredFlow ||
          (connected.length <= 6 &&
            (hasNestedGroups || (polarity.firstAuxIdx >= 0 && !polarity.passiveStaticAux))));
      const defects = needDefects
        ? estimateRoutingDefects(trialLinks, trialPlaced)
        : {
            jogs: 0,
            portWindings: 0,
            primaryPortWindings: 0,
            sharedCrossings: 0,
            orthoPrimaryCrossings: 0,
          };
      const auxPriCrossExtra =
        flowCtx.preserveFlow && polarity.firstAuxIdx >= 0 && connected.length <= 6
          ? primaryCrossingsOf(flow.connections, candLayout) * 350
          : 0;
      const nestedOrthoPen = hasNestedGroups
        ? defects.orthoPrimaryCrossings * 900 +
          defects.sharedCrossings * 450 +
          defects.jogs * 360 +
          defects.primaryPortWindings * 260
        : defects.portWindings * 200;
      const wallPen = flowCtx.preserveFlow
        ? wallDetourCount(trialLinks, trialPlaced) * (hasNestedGroups ? 2800 : 800) +
          primaryThroughPen +
          auxPriCrossExtra +
          (polarity.firstAuxIdx < 0 ? blockedPrimaryPorts(trialLinks) * 430 : 0) +
          lowRightPen +
          nestedOrthoPen
        : 0;
      let stageOverlapExtra = 0;
      if (flowCtx.preserveFlow) {
        const byId = new Map(trialPlaced.map((p) => [p.block.id, p]));
        for (const [za, zb] of flowCtx.stagePairs) {
          const u = byId.get(za);
          const v = byId.get(zb);
          if (u && v && u.x + u.block.width + HORIZONTAL_CLEARANCE > v.x) {
            stageOverlapExtra += 6000;
          }
        }
        if (connected.length >= 7) {
          const rectMap = new Map(
            trialPlaced.map((p) => [
              p.block.id,
              { x: p.x, y: p.y, width: p.block.width, height: p.block.height },
            ]),
          );
          stageOverlapExtra +=
            countCorridorIntrusions(flowCtx.corridors, rectMap) * 4200 +
            primaryCrossingsOf(flow.connections, candLayout) * 420;
        }
      }
      const sparsePen = !flowCtx.preserveFlow
        ? (() => {
            const area = trialPlaced.reduce((s, p) => s + p.block.width * p.block.height, 0);
            const fill = area / Math.max(1, ext.width * ext.height);
            return fill < 0.54 ? (0.54 - fill) * 12000 : 0;
          })()
        : 0;
      const score =
        linkCost(trialLinks, trialPlaced, flowCtx) +
        diagramCrossingPenalty(connDoc, candLayout, flow, flowCtx.preserveFlow) +
        polPen +
        entryPen +
        relAnchorPenalty(trialPlaced) +
        wallPen +
        sparsePen +
        stageOverlapExtra +
        portraitPen +
        underTwoPen -
        straightLinks(trialLinks, trialPlaced) * STRAIGHT_WORTH;
      if (score < best.score) {
        const savedBeforeChosen = posesOf(trialPlaced);
        straighten(trialLinks, trialPlaced, CHOSEN_STRAIGHT_WORTH, flowCtx, hClear);
        if (hasNestedGroups && connected.length <= 6) {
          eliminateShortJogs(trialLinks, trialPlaced, 900, flowCtx, hClear);
        }
        if (breathe && polarity.firstAuxIdx < 0) {
          restoreStageBreathingRoom(trialPlaced, flowCtx);
          refreshSegments(trialLinks);
        } else if (
          !breathe &&
          flowCtx.preserveFlow &&
          polarity.firstAuxIdx < 0 &&
          !hasNestedGroups &&
          layoutAsp > 1.5
        ) {
          restoreStageBreathingRoom(trialPlaced, flowCtx, 86, true);
          refreshSegments(trialLinks);
        }
        if (flowCtx.preserveFlow) {
          let postLay = toLayout(trialPlaced);
          let postB = enclosingRect([
            ...Object.values(postLay.nodes),
            ...Object.values(postLay.groups),
          ]);
          let postAsp = postB.width / Math.max(1, postB.height);
          if (arr.isAnchoredFlow && postAsp < 1.06) {
            const needW = Math.ceil(postB.height * 1.06 - postB.width);
            restoreStageBreathingRoom(trialPlaced, flowCtx, 98 + needW, true);
            refreshSegments(trialLinks);
            postLay = toLayout(trialPlaced);
            postB = enclosingRect([
              ...Object.values(postLay.nodes),
              ...Object.values(postLay.groups),
            ]);
            postAsp = postB.width / Math.max(1, postB.height);
          }
          if (
            (postAsp < 1.08 && layoutAsp >= 1.08) ||
            (breathe && polarity.firstAuxIdx < 0 && postAsp < 1.78 && layoutAsp >= 1.78)
          ) {
            restore(trialPlaced, savedBeforeChosen);
            refreshSegments(trialLinks);
          }
        }
        best = { score, placement: snapshot(trialPlaced, trialBaseOrders, ranksByZone) };
      }
    }
  }
  return best;
}

import { synthesizedConnections } from '../model/connections';
import { pushToMap } from '../model/text';
import type { DavDocument } from '../model/types';
import { parentMap, zoneOfGroups } from '../model/zones';
import {
  analyzeFlow,
  countCorridorIntrusions,
  type FlowAnalysis,
  flowPairKey,
  isLateAuxAlert,
} from './flow';
import { type Link, linksOf } from './links';
import { enclosingRect, STATION_CENTER } from './metrics';
import {
  type Block,
  buildBlocks,
  type ColumnLayout,
  connectedSubdoc,
  HORIZONTAL_CLEARANCE,
  initialPositions,
  type MacroGrid,
  type Placed,
  partitionIsolatedBlocks,
  placeAuxiliaryBlocks,
  prepareMacroGrid,
  shouldPreserveFlow,
  toLayout,
  VERTICAL_CLEARANCE,
  type ZonePlacement,
} from './zoneBlocks';
import {
  alignEdges,
  CHOSEN_STRAIGHT_WORTH,
  compact,
  eliminateShortJogs,
  restoreStageBreathingRoom,
  STRAIGHT_WORTH,
  straighten,
  tighten,
} from './zoneFinish';
import {
  buildZoneSlackMeta,
  cloneBlockNodes,
  deriveRefineBudget,
  hasMultipleNodeRows,
  nodeOrderOf,
  optimizeZoneFlips,
  optimizeZoneSlackRanks,
  polishZoneCoordinates,
  type RefineBudget,
  refineZoneNodeOrder,
  snapshot,
  type ZoneSlackMeta,
} from './zoneRefine';
import {
  type BlockLink,
  buildFlowContext,
  buildLinks,
  countBackwardPrimary,
  evaluateArrangementScore,
  extent,
  type FlowContext,
  isClear,
  refreshSegments,
} from './zoneScore';

const STAGE_GAP = 80;
const ROW_GAP = 44;
const ROW_BAND_GAP = VERTICAL_CLEARANCE + 24;

interface Pose {
  x: number;
  y: number;
  flip: 0 | 1;
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

const compareId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

interface Arrangement {
  connDoc: DavDocument;
  connected: Block[];
  links: BlockLink[];
  flow: FlowAnalysis;
  flowCtx: FlowContext;
  preserveFlow: boolean;
  hasNestedGroups: boolean;
  refineBudget: RefineBudget;
  grid: MacroGrid;
  columns: Block[][];
  auxiliary: Block[];
  start: ReadonlyMap<string, { x: number; y: number }>;
  nodeParent: ReadonlyMap<string, string | undefined>;
  owners: ReadonlyMap<string, string>;
  zoneOf: ReadonlyMap<string, string>;
  adj: ReadonlyMap<string, readonly string[]>;
  docLinks: readonly Link[];
  baseOrders: ReadonlyMap<string, readonly string[]>;
  slackMeta: ReadonlyMap<string, ZoneSlackMeta>;
  blockCache: Map<string, Block>;
}

function arrange(doc: DavDocument, columnLayout: ColumnLayout): Arrangement {
  const connDoc = connectedSubdoc(doc);
  const connConns = synthesizedConnections(connDoc);
  const flow = analyzeFlow(connDoc, connConns);
  const { blocks, owners } = buildBlocks(connDoc, columnLayout, undefined, flow);
  const { connected: rawConn } = partitionIsolatedBlocks(blocks, flow, owners);

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

  const connNodes = new Set(connected.flatMap((b) => [...b.nodes.keys()]));
  const zoneOf = zoneOfGroups(connDoc.groups);
  const preserveFlow = shouldPreserveFlow(connected, flow);
  const grid = prepareMacroGrid(connected, flow, owners);
  const flowCtx = buildFlowContext(
    flow,
    owners,
    preserveFlow,
    grid.wrapped,
    grid.wrapped ? grid.rowOfBlock : undefined,
  );
  const columns = grid.rows.flat();
  const auxiliary = grid.auxiliary;
  const start = initialPositions(connDoc, connected, owners, flow);
  const connBlockNodes = connected.reduce((sum, b) => sum + b.nodes.size, 0);
  const refineBudget = deriveRefineBudget(connected.length, connBlockNodes, preserveFlow);

  const placed: Placed[] = connected.map((block) => ({ block, x: 0, y: 0, flip: 0 }));
  const adj = new Map<string, string[]>();
  for (const e of connConns) {
    if (e.from === e.to) continue;
    pushToMap(adj, e.from, e.to);
    pushToMap(adj, e.to, e.from);
  }
  const baseOrders = new Map(connected.map((b) => [b.id, nodeOrderOf(b.nodes)]));
  const docLinks = linksOf(connDoc).filter(([u, v]) => connNodes.has(u) && connNodes.has(v));
  const slackMeta = refineBudget.slackRanks
    ? buildZoneSlackMeta(connDoc, connConns, connected, flow, owners, adj)
    : new Map<string, ZoneSlackMeta>();
  const hasNestedGroups = connDoc.groups.some((g) => g.parentId !== undefined);

  return {
    connDoc,
    connected,
    links: buildLinks(connDoc, placed, flow),
    flow,
    flowCtx,
    preserveFlow,
    hasNestedGroups,
    refineBudget,
    grid,
    columns,
    auxiliary,
    start,
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

/** Splits tall multi-zone stages (`>= 3` zones) into upstream-closer and downstream-closer sub-columns. */
function buildSplitStageColumns(arr: Arrangement): Block[][] {
  const { columns, flow, owners } = arr;
  let maxPriStage = 0;
  for (const col of columns) {
    for (const b of col) {
      const s = flow.zoneStage.get(b.id) ?? 0;
      if (s > maxPriStage) maxPriStage = s;
    }
  }
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

function preservesRowBands(
  placed: readonly Placed[],
  rowOfBlock: ReadonlyMap<string, number>,
): boolean {
  const bands = new Map<number, { minY: number; maxBot: number }>();
  for (const p of placed) {
    const r = rowOfBlock.get(p.block.id);
    if (r === undefined) continue;
    const prev = bands.get(r);
    const bot = p.y + p.block.height;
    if (!prev) {
      bands.set(r, { minY: p.y, maxBot: bot });
    } else {
      prev.minY = Math.min(prev.minY, p.y);
      prev.maxBot = Math.max(prev.maxBot, bot);
    }
  }
  const rows = [...bands.entries()].sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < rows.length; i++) {
    const prevBand = rows[i - 1]?.[1];
    const curBand = rows[i]?.[1];
    if (prevBand && curBand && prevBand.maxBot + VERTICAL_CLEARANCE > curBand.minY) {
      return false;
    }
  }
  return true;
}

function captureAuxSides(
  placed: readonly Placed[],
  flowCtx: FlowContext,
): Map<string, 'above' | 'below'> {
  const auxSide = new Map<string, 'above' | 'below'>();
  if (!flowCtx.preserveFlow || flowCtx.auxiliaryZones.size === 0) return auxSide;
  let priMinY = Number.POSITIVE_INFINITY;
  let priMaxBot = Number.NEGATIVE_INFINITY;
  for (const p of placed) {
    if (flowCtx.auxiliaryZones.has(p.block.id)) continue;
    priMinY = Math.min(priMinY, p.y);
    priMaxBot = Math.max(priMaxBot, p.y + p.block.height);
  }
  if (!Number.isFinite(priMinY)) return auxSide;
  for (const p of placed) {
    if (!flowCtx.auxiliaryZones.has(p.block.id)) continue;
    if (p.y + p.block.height <= priMinY + 1e-6) auxSide.set(p.block.id, 'above');
    else if (p.y >= priMaxBot - 1e-6) auxSide.set(p.block.id, 'below');
  }
  return auxSide;
}

function preservesAuxBands(
  placed: readonly Placed[],
  flowCtx: FlowContext,
  auxSide: ReadonlyMap<string, 'above' | 'below'>,
): boolean {
  if (auxSide.size === 0) return true;
  let priMinY = Number.POSITIVE_INFINITY;
  let priMaxBot = Number.NEGATIVE_INFINITY;
  for (const p of placed) {
    if (flowCtx.auxiliaryZones.has(p.block.id)) continue;
    priMinY = Math.min(priMinY, p.y);
    priMaxBot = Math.max(priMaxBot, p.y + p.block.height);
  }
  if (!Number.isFinite(priMinY)) return true;
  for (const p of placed) {
    const side = auxSide.get(p.block.id);
    if (side === 'above' && p.y + p.block.height > priMinY - (VERTICAL_CLEARANCE + 24)) {
      return false;
    }
    if (side === 'below' && p.y < priMaxBot + (VERTICAL_CLEARANCE + 24)) return false;
  }
  return true;
}

function runWithBandGuard(
  placed: readonly Placed[],
  links: readonly BlockLink[],
  flowCtx: FlowContext,
  auxSide: ReadonlyMap<string, 'above' | 'below'>,
  rowOfBlock: ReadonlyMap<string, number> | undefined,
  fn: () => void,
): void {
  const saved = posesOf(placed);
  fn();
  const rowOk = !rowOfBlock || preservesRowBands(placed, rowOfBlock);
  const auxOk = preservesAuxBands(placed, flowCtx, auxSide);
  if (!rowOk || !auxOk) {
    restore(placed, saved);
    refreshSegments(links);
  }
}

function hasLateRightAux(
  flow: FlowAnalysis,
  owners: ReadonlyMap<string, string>,
  auxiliary: readonly Block[],
): boolean {
  const auxIds = new Set(auxiliary.map((b) => b.id));
  for (const c of flow.connections) {
    if (c.role !== 'primary') continue;
    const bu = owners.get(c.from) ?? c.from;
    const bv = owners.get(c.to) ?? c.to;
    if (!auxIds.has(bu) || auxIds.has(bv)) continue;
    const fs = flow.pairFirstStep.get(flowPairKey(c.from, c.to)) ?? 0;
    if (fs > 1) return true;
  }
  return false;
}

/** Deterministic stage+band macro solver generalized over `MacroGrid.rows` (`wrapped` or single-row). */
function solveStagedPipeline(
  arr: Arrangement,
  rowsOverride?: readonly (readonly (readonly Block[])[])[],
  auxMode: 'bands' | 'right-top' = 'bands',
): Placed[] {
  const { connDoc, connected, auxiliary, start, flow, flowCtx, owners } = arr;
  const pm = new Map<string, Placed>();
  const base: Placed[] = connected.map((b) => {
    const at = start.get(b.id) ?? { x: 0, y: 0 };
    const p: Placed = { block: cloneBlockNodes(b), x: at.x, y: at.y, flip: 0 };
    pm.set(b.id, p);
    return p;
  });
  const primaryPlaced = base.filter((p) => !flow.auxiliaryZones.has(p.block.id));

  const nbrWeights = new Map<
    string,
    Array<{ id: string; selfNode: string; otherNode: string; w: number }>
  >();
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
    pushToMap(nbrWeights, bu, { id: bv, selfNode: c.from, otherNode: c.to, w });
    pushToMap(nbrWeights, bv, { id: bu, selfNode: c.to, otherNode: c.from, w });
  }

  const stationY = (p: Placed, nodeId: string): number => {
    const r = p.block.nodes.get(nodeId);
    return p.y + (r ? r.y + STATION_CENTER : p.block.height / 2);
  };

  const rowsCopy = (rowsOverride ?? arr.grid.rows).map((rowCols) => rowCols.map((col) => [...col]));
  const cellOf = new Map<string, { ri: number; ci: number }>();
  rowsCopy.forEach((rowCols, ri) => {
    rowCols.forEach((col, ci) => {
      for (const b of col) cellOf.set(b.id, { ri, ci });
    });
  });

  const layoutRows = () => {
    if (!arr.grid.wrapped) {
      const cols = rowsCopy[0] ?? [];
      const colHeights = cols.map(
        (c) => c.reduce((s, b) => s + b.height, 0) + Math.max(0, c.length - 1) * ROW_GAP,
      );
      const tallest = Math.max(0, ...colHeights);
      let x = 0;
      cols.forEach((c, ci) => {
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
      return;
    }

    let rowY = 0;
    for (const rowCols of rowsCopy) {
      const colHeights = rowCols.map(
        (c) => c.reduce((s, b) => s + b.height, 0) + Math.max(0, c.length - 1) * ROW_GAP,
      );
      const rowH = Math.max(0, ...colHeights);
      let x = 0;
      rowCols.forEach((c, ci) => {
        const colW = Math.max(0, ...c.map((b) => b.width));
        let y = rowY + (rowH - (colHeights[ci] ?? 0)) / 2;
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
      rowY += rowH + ROW_BAND_GAP;
    }
  };

  layoutRows();
  // Forward topological predecessor initialization so stage columns align with upstream lanes
  // before bidirectional barycenter sweeps run (preventing lexicographic tie inversions).
  for (let ri = 0; ri < rowsCopy.length; ri++) {
    const rowCols = rowsCopy[ri];
    if (!rowCols) continue;
    for (let ci = 0; ci < rowCols.length; ci++) {
      const col = rowCols[ci];
      if (!col || col.length < 2) continue;
      col.sort((a, b) => {
        const predY = (id: string) => {
          let sw = 0;
          let swy = 0;
          for (const { id: nid, otherNode, w } of nbrWeights.get(id) ?? []) {
            const nc = cellOf.get(nid);
            if (!nc || flow.auxiliaryZones.has(nid)) continue;
            if (nc.ri > ri || (nc.ri === ri && nc.ci >= ci)) continue;
            const np = pm.get(nid);
            if (np) {
              swy += stationY(np, otherNode) * w;
              sw += w;
            }
          }
          return sw > 0 ? swy / sw : Number.POSITIVE_INFINITY;
        };
        return predY(a.id) - predY(b.id) || compareId(a.id, b.id);
      });
      layoutRows();
    }
  }

  for (let sweep = 0; sweep < 6; sweep++) {
    const rowIndices =
      sweep % 2 === 0
        ? rowsCopy.map((_, ri) => ri)
        : rowsCopy.map((_, ri) => rowsCopy.length - 1 - ri);
    for (const ri of rowIndices) {
      const rowCols = rowsCopy[ri];
      if (!rowCols) continue;
      const colIndices =
        sweep % 2 === 0
          ? rowCols.map((_, ci) => ci)
          : rowCols.map((_, ci) => rowCols.length - 1 - ci);
      for (const ci of colIndices) {
        const col = rowCols[ci];
        if (!col || col.length < 2) continue;
        col.sort((a, b) => {
          const targetY = (id: string) => {
            let sw = 0;
            let swy = 0;
            for (const { id: nid, otherNode, w } of nbrWeights.get(id) ?? []) {
              const nc = cellOf.get(nid);
              if ((nc && nc.ri === ri && nc.ci === ci) || flow.auxiliaryZones.has(nid)) {
                continue;
              }
              const np = pm.get(nid);
              if (np) {
                swy += stationY(np, otherNode) * w;
                sw += w;
              }
            }
            return sw > 0 ? swy / sw : Number.POSITIVE_INFINITY;
          };
          return targetY(a.id) - targetY(b.id) || compareId(a.id, b.id);
        });
        layoutRows();
      }
    }
  }

  // Align single-block columns with intermediate corridor bridges (`allowed`) so non-allowed
  // intermediate blocks stay outside `[min(a.y, b.y), max(a.bot, b.bot)]` (`layerIntrusions = 0`).
  const allCols = rowsCopy.flat();
  if (!arr.grid.wrapped && arr.preserveFlow) {
    const colOfBlock = new Map<string, Block[]>();
    for (const c of allCols) {
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
  }

  const rowFracOf = new Map<string, number>();
  for (const c of allCols) {
    c.forEach((b, ri) => {
      rowFracOf.set(b.id, c.length <= 1 ? 0.5 : ri / (c.length - 1));
    });
  }

  if (primaryPlaced.length > 0) {
    const priLinks = buildLinks(connDoc, primaryPlaced, flow);
    refreshSegments(priLinks);
    optimizeZoneFlips(
      {
        doc: connDoc,
        placed: primaryPlaced,
        links: priLinks,
        flow,
        flowCtx,
        rowFilter: 'any',
        fallback: 'score-greedy',
      },
      0,
    );
    if (arr.grid.wrapped) {
      const rowGuard = arr.grid.rowOfBlock;
      runWithBandGuard(primaryPlaced, priLinks, flowCtx, new Map(), rowGuard, () => {
        compact(priLinks, primaryPlaced, false, flowCtx, HORIZONTAL_CLEARANCE);
      });
    } else {
      compact(priLinks, primaryPlaced, false, flowCtx, HORIZONTAL_CLEARANCE);
      alignEdges(priLinks, primaryPlaced, flowCtx);
      tighten(priLinks, primaryPlaced, flowCtx);
      compact(priLinks, primaryPlaced, false, flowCtx, HORIZONTAL_CLEARANCE);
      straighten(priLinks, primaryPlaced, CHOSEN_STRAIGHT_WORTH, flowCtx);
    }
  }

  if (auxiliary.length > 0) {
    const auxPlaced = auxiliary
      .map((b) => pm.get(b.id))
      .filter((p): p is Placed => p !== undefined);
    const orderedAux = placeAuxiliaryBlocks(auxPlaced, primaryPlaced, owners, flow, {
      auxMode,
      cols: allCols,
      rowFracOf,
      sideMode: 'stationY',
      clampMaxSource: true,
      decayStatic: true,
    });

    const allLinks = buildLinks(connDoc, base, flow);
    refreshSegments(allLinks);
    if (arr.preserveFlow && !arr.grid.wrapped) {
      const outgoingPrimary = new Map<Placed, BlockLink[]>();
      for (const l of allLinks) {
        if (
          l.role === 'primary' &&
          !isLateAuxAlert({ from: l.from, to: l.to, role: l.role }, flow, owners)
        ) {
          let list = outgoingPrimary.get(l.source);
          if (!list) {
            list = [];
            outgoingPrimary.set(l.source, list);
          }
          list.push(l);
        }
      }
      const savedPoses = posesOf(base);
      const backBefore = countBackwardPrimary(allLinks, flowCtx);
      const pushQueue: Placed[] = [];
      for (const l of allLinks) {
        if (
          l.role !== 'primary' ||
          !flow.auxiliaryZones.has(l.source.block.id) ||
          flow.auxiliaryZones.has(l.target.block.id) ||
          isLateAuxAlert({ from: l.from, to: l.to, role: l.role }, flow, owners)
        ) {
          continue;
        }
        if (l.ax >= l.bx - 24) {
          l.target.x += Math.ceil(l.ax + 24 - l.bx);
          while (!isClear(l.target, base, HORIZONTAL_CLEARANCE)) {
            l.target.x += HORIZONTAL_CLEARANCE;
          }
          refreshSegments(allLinks);
          pushQueue.push(l.target);
        }
      }
      // Transitively propagate rightward clearance to downstream primary targets so pushing
      // `l.target` past an auxiliary zone never pushes it past its own primary targets.
      if (pushQueue.length > 0) {
        let steps = 0;
        const maxSteps = base.length * allLinks.length + 16;
        for (let head = 0; head < pushQueue.length && steps < maxSteps; head++) {
          const src = pushQueue[head];
          if (!src) continue;
          for (const outLink of outgoingPrimary.get(src) ?? []) {
            if (outLink.ax >= outLink.bx - 24) {
              steps++;
              outLink.target.x += Math.ceil(outLink.ax + 24 - outLink.bx);
              while (!isClear(outLink.target, base, HORIZONTAL_CLEARANCE)) {
                outLink.target.x += HORIZONTAL_CLEARANCE;
              }
              refreshSegments(allLinks);
              pushQueue.push(outLink.target);
            }
          }
        }
        if (steps >= maxSteps || countBackwardPrimary(allLinks, flowCtx) > backBefore) {
          restore(base, savedPoses);
          refreshSegments(allLinks);
        }
      }
    }
    optimizeZoneFlips(
      {
        doc: connDoc,
        placed: base,
        links: allLinks,
        flow,
        flowCtx,
        preserveFlowOverride: true,
        rowFilter: 'multi-node',
        fallback: 'score-greedy',
        fallbackTargets: orderedAux,
      },
      auxMode === 'right-top' ? arr.refineBudget.flipBitmaskCap : 0,
    );
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
  const rowOf = flowCtx.wrapped ? flowCtx.rowOfBlock : undefined;
  const countIntrusions = () => {
    const rectMap = new Map(
      placed.map((p) => [
        p.block.id,
        { x: p.x, y: p.y, width: p.block.width, height: p.block.height },
      ]),
    );
    return countCorridorIntrusions(flowCtx.corridors, rectMap, rowOf);
  };
  let curInt = countIntrusions();
  if (curInt === 0) return;

  for (let pass = 0; pass < 3 && curInt > 0; pass++) {
    let improved = false;
    const byId = new Map(placed.map((p) => [p.block.id, p]));
    for (const c of flowCtx.corridors) {
      const rowA = rowOf?.get(c.a);
      const rowB = rowOf?.get(c.b);
      if (rowA !== undefined && rowB !== undefined && rowA !== rowB) continue;
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
        if (rowOf) {
          const rowC = rowOf.get(rc.block.id);
          if (
            rowC !== undefined &&
            ((rowA !== undefined && rowC !== rowA) || (rowB !== undefined && rowC !== rowB))
          ) {
            continue;
          }
        }
        const cx = rc.x + rc.block.width / 2;
        if (!(cx > minX && cx < maxX && rc.y < bandBot && rc.y + rc.block.height > bandTop)) {
          continue;
        }
        const prevX = rc.x;
        const prevY = rc.y;
        refreshSegments(links);
        const backBefore = countBackwardPrimary(links, flowCtx);
        const curCost = evaluateArrangementScore(doc, placed, links, flow, flowCtx, {
          mode: 'intrusion',
          intrusions: curInt,
        });

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
          if (countBackwardPrimary(links, flowCtx) > backBefore) continue;
          const nextInt = countIntrusions();
          if (nextInt >= curInt) continue;
          const nextCost = evaluateArrangementScore(doc, placed, links, flow, flowCtx, {
            mode: 'intrusion',
            intrusions: nextInt,
          });
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

/** Places connected top-level blocks using a single deterministic stage+band skeleton and bounded local refinement. */
export function searchZonePlacement(doc: DavDocument, columnLayout: ColumnLayout): ZonePlacement {
  const arr = arrange(doc, columnLayout);
  if (arr.connected.length === 0) return new Map();

  const {
    connDoc,
    connected,
    flow,
    flowCtx,
    hasNestedGroups,
    refineBudget,
    nodeParent,
    owners,
    zoneOf,
    adj,
    docLinks,
    baseOrders,
    slackMeta,
    blockCache,
  } = arr;

  const hClear = HORIZONTAL_CLEARANCE;
  const entryMask = new Uint8Array(connected.length);
  if (flowCtx.preserveFlow && arr.grid.rows[0]?.[0]?.length === 1) {
    connected.forEach((b, i) => {
      if (
        b.flippable &&
        hasMultipleNodeRows(b) &&
        !flow.auxiliaryZones.has(b.id) &&
        (flow.zoneStage.get(b.id) ?? 0) === 0
      ) {
        entryMask[i] = 1;
      }
    });
  }

  const allowRightAux =
    !arr.grid.wrapped && arr.auxiliary.length > 0 && hasLateRightAux(flow, owners, arr.auxiliary);

  const candidates: Array<{ poses: Pose[]; auxMode: 'bands' | 'right-top' }> = [];
  const unsplitBands = solveStagedPipeline(arr, arr.grid.rows, 'bands');
  const unsplitBandsPoses = posesOf(unsplitBands);
  candidates.push({ poses: unsplitBandsPoses, auxMode: 'bands' });

  const differsFrom = (a: readonly Pose[], b: readonly Pose[]): boolean =>
    a.some(
      (pa, idx) =>
        Math.abs(pa.x - (b[idx]?.x ?? 0)) > 1 ||
        Math.abs(pa.y - (b[idx]?.y ?? 0)) > 1 ||
        pa.flip !== (b[idx]?.flip ?? 0),
    );

  if (allowRightAux) {
    const rightTop = solveStagedPipeline(arr, arr.grid.rows, 'right-top');
    const rightTopPoses = posesOf(rightTop);
    if (differsFrom(rightTopPoses, unsplitBandsPoses)) {
      candidates.push({ poses: rightTopPoses, auxMode: 'right-top' });
    }
  }

  if (!arr.grid.wrapped && arr.grid.rows[0]?.some((c) => c.length >= 3)) {
    const unsplitExt = extent(unsplitBands);
    const unsplitAsp = unsplitExt.width / Math.max(1, unsplitExt.height);
    if (unsplitAsp < 1.35) {
      const splitCols = buildSplitStageColumns(arr);
      const splitBands = solveStagedPipeline(arr, [splitCols], 'bands');
      const splitBandsPoses = posesOf(splitBands);
      candidates.push({ poses: splitBandsPoses, auxMode: 'bands' });
      if (allowRightAux) {
        const splitRightTop = solveStagedPipeline(arr, [splitCols], 'right-top');
        const splitRightPoses = posesOf(splitRightTop);
        if (differsFrom(splitRightPoses, splitBandsPoses)) {
          candidates.push({ poses: splitRightPoses, auxMode: 'right-top' });
        }
      }
    }
  }

  const modes: ReadonlyArray<{ aside: boolean; breathe: boolean }> = arr.grid.wrapped
    ? [{ aside: false, breathe: false }]
    : arr.auxiliary.length > 0
      ? [{ aside: false, breathe: false }]
      : !hasNestedGroups && connected.length <= 10
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

  const allFlippable = connected.every((b) => b.flippable);
  const firstAuxIdx = arr.auxiliary.length > 0 ? 0 : -1;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestPlacement: ZonePlacement = new Map();

  for (const { poses: basePoses, auxMode } of candidates) {
    for (const { aside, breathe } of modes) {
      const trialPlaced = clonePlacedWithPoses(unsplitBands, basePoses);
      const trialBaseOrders = new Map(baseOrders);
      let trialLinks = buildLinks(connDoc, trialPlaced, flow);
      refreshSegments(trialLinks);
      const auxSide =
        auxMode === 'bands'
          ? captureAuxSides(trialPlaced, flowCtx)
          : new Map<string, 'above' | 'below'>();
      const rowGuard = arr.grid.wrapped ? arr.grid.rowOfBlock : undefined;
      let ranksByZone = new Map<string, Readonly<Record<string, number>>>();

      if (arr.grid.wrapped) {
        runWithBandGuard(trialPlaced, trialLinks, flowCtx, auxSide, rowGuard, () => {
          compact(trialLinks, trialPlaced, false, flowCtx, hClear);
        });
        optimizeZoneFlips(
          {
            doc: connDoc,
            placed: trialPlaced,
            links: trialLinks,
            flow,
            flowCtx,
            fallback: 'score-greedy',
          },
          refineBudget.flipBitmaskCap,
          entryMask,
        );
        if (
          refineZoneNodeOrder(trialPlaced, nodeParent, owners, adj, docLinks, refineBudget, flow)
        ) {
          trialLinks = buildLinks(connDoc, trialPlaced, flow);
          refreshSegments(trialLinks);
        }
        runWithBandGuard(trialPlaced, trialLinks, flowCtx, auxSide, rowGuard, () => {
          straighten(trialLinks, trialPlaced, STRAIGHT_WORTH, flowCtx, hClear);
        });
      } else {
        runWithBandGuard(trialPlaced, trialLinks, flowCtx, auxSide, undefined, () => {
          compact(trialLinks, trialPlaced, aside, flowCtx, hClear);
          alignEdges(trialLinks, trialPlaced, flowCtx, hClear);
          tighten(trialLinks, trialPlaced, flowCtx, hClear);
          compact(trialLinks, trialPlaced, aside, flowCtx, hClear);
        });

        ranksByZone = optimizeZoneSlackRanks(
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
          refineBudget,
        );
        if (ranksByZone.size > 0) {
          trialLinks = buildLinks(connDoc, trialPlaced, flow);
          refreshSegments(trialLinks);
          runWithBandGuard(trialPlaced, trialLinks, flowCtx, auxSide, undefined, () => {
            tighten(trialLinks, trialPlaced, flowCtx, hClear);
          });
        }
        if (flowCtx.preserveFlow && flowCtx.corridors.length > 0) {
          runWithBandGuard(trialPlaced, trialLinks, flowCtx, auxSide, undefined, () => {
            clearCorridorIntrusions(connDoc, trialPlaced, trialLinks, flow, flowCtx);
          });
        }
        if (
          optimizeZoneFlips(
            {
              doc: connDoc,
              placed: trialPlaced,
              links: trialLinks,
              flow,
              flowCtx,
              preserveFlowOverride: true,
              fallback: 'score-greedy',
            },
            refineBudget.flipBitmaskCap,
            entryMask,
          ) &&
          arr.auxiliary.length > 0 &&
          auxMode === 'bands'
        ) {
          const pri = trialPlaced.filter((p) => !flow.auxiliaryZones.has(p.block.id));
          const aux = trialPlaced.filter((p) => flow.auxiliaryZones.has(p.block.id));
          placeAuxiliaryBlocks(aux, pri, owners, flow, {
            auxMode: 'bands',
            cols: arr.grid.rows.flat(),
            sideMode: 'stationY',
            clampMaxSource: true,
            decayStatic: true,
          });
          auxSide.clear();
          for (const [k, v] of captureAuxSides(trialPlaced, flowCtx)) auxSide.set(k, v);
          refreshSegments(trialLinks);
        }
        if (!hasNestedGroups && refineBudget.slackRanks) {
          optimizeZoneFlips(
            {
              doc: connDoc,
              placed: trialPlaced,
              links: trialLinks,
              flow,
              flowCtx,
              flippability: 'unflippable',
              fallback: 'score-greedy',
            },
            0,
          );
        }
        if (
          refineZoneNodeOrder(trialPlaced, nodeParent, owners, adj, docLinks, refineBudget, flow)
        ) {
          trialLinks = buildLinks(connDoc, trialPlaced, flow);
          refreshSegments(trialLinks);
        }
        polishZoneCoordinates(
          trialPlaced,
          trialLinks,
          docLinks,
          flow,
          flowCtx,
          refineBudget,
          hClear,
          auxMode === 'bands',
        );
        if (
          refineZoneNodeOrder(trialPlaced, nodeParent, owners, adj, docLinks, refineBudget, flow)
        ) {
          trialLinks = buildLinks(connDoc, trialPlaced, flow);
          refreshSegments(trialLinks);
        }
        if (breathe) {
          restoreStageBreathingRoom(trialPlaced, flowCtx);
          refreshSegments(trialLinks);
        }
        runWithBandGuard(trialPlaced, trialLinks, flowCtx, auxSide, undefined, () => {
          straighten(trialLinks, trialPlaced, STRAIGHT_WORTH, flowCtx, hClear);
        });
      }

      const candLayout = toLayout(trialPlaced);
      const layoutBounds = enclosingRect([
        ...Object.values(candLayout.nodes),
        ...Object.values(candLayout.groups),
      ]);
      const layoutAsp = layoutBounds.width / Math.max(1, layoutBounds.height);
      const score = evaluateArrangementScore(connDoc, trialPlaced, trialLinks, flow, flowCtx, {
        mode: 'full',
        layout: candLayout,
        columnsCount: arr.columns.length,
        hasNestedGroups,
        allFlippable,
        firstAuxIdx,
        entryMask,
      });

      if (score < bestScore) {
        const savedBeforeChosen = posesOf(trialPlaced);
        runWithBandGuard(trialPlaced, trialLinks, flowCtx, auxSide, rowGuard, () => {
          straighten(trialLinks, trialPlaced, CHOSEN_STRAIGHT_WORTH, flowCtx, hClear);
        });
        if (!arr.grid.wrapped) {
          if (hasNestedGroups) {
            runWithBandGuard(trialPlaced, trialLinks, flowCtx, auxSide, undefined, () => {
              eliminateShortJogs(trialLinks, trialPlaced, 900, flowCtx, hClear);
            });
          }
          if (breathe && firstAuxIdx < 0) {
            restoreStageBreathingRoom(trialPlaced, flowCtx);
            refreshSegments(trialLinks);
          } else if (
            !breathe &&
            flowCtx.preserveFlow &&
            firstAuxIdx < 0 &&
            !hasNestedGroups &&
            layoutAsp > 1.5
          ) {
            restoreStageBreathingRoom(trialPlaced, flowCtx, 86, true);
            refreshSegments(trialLinks);
          }
          if (flowCtx.preserveFlow) {
            const postLay = toLayout(trialPlaced);
            const postB = enclosingRect([
              ...Object.values(postLay.nodes),
              ...Object.values(postLay.groups),
            ]);
            const postAsp = postB.width / Math.max(1, postB.height);
            if (
              (postAsp < 1.08 && layoutAsp >= 1.08) ||
              (breathe && firstAuxIdx < 0 && postAsp < 1.78 && layoutAsp >= 1.78)
            ) {
              restore(trialPlaced, savedBeforeChosen);
              refreshSegments(trialLinks);
            }
          }
        }
        bestScore = score;
        bestPlacement = snapshot(trialPlaced, trialBaseOrders, ranksByZone);
      }
    }
  }

  return bestPlacement;
}

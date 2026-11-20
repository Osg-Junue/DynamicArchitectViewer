import { pushToMap } from '../model/text';
import type { DavDocument } from '../model/types';
import { idPair, parentMap, topLevelGroups, zoneOfGroups } from '../model/zones';
import { analyzeFlow, analyzeScopeFlow, type FlowAnalysis, flowPairKey } from './flow';
import {
  EMPTY_GROUP_CONTENT,
  enclosingRect,
  GROUP_PADDING,
  groupHeaderHeight,
  type Layout,
  NODE_SIZE,
  type Rect,
  STATION_CENTER,
  selfLoopRoom,
  zoneMinWidth,
} from './metrics';
import {
  type Block,
  buildSingleZoneBlock,
  type ColumnLayout,
  computeFlipMetadata,
  flippedY,
  NESTED_SPACING,
  ownersOf,
  type Placed,
  placeAuxiliaryBlocks,
  placeIsolatedBlocks,
  stageColumns,
  TOP_SPACING,
  toLayout,
  type ZoneSpacing,
} from './zoneBlocks';
import { compact, straighten, tighten } from './zoneFinish';
import { optimizeZoneFlips } from './zoneRefine';
import { buildFlowContext, buildLinks, refreshSegments } from './zoneScore';

const compareId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const ROOT_TARGET_ASPECT = 2.0;
const MIN_TARGET_ASPECT = 0.75;
const ROW_WRAP_GAP = 36;

interface ParentScopeHint {
  parentOwners: ReadonlyMap<string, string>;
  parentScopeFlow: FlowAnalysis;
  targetAspect: number;
}

/**
 * Returns true when a single-top-level-group diagram has genuine multi-tier branching
 * (depth >= 2 below the top-level group AND at least one group with >= 2 direct child groups,
 * e.g. Cloud > Region > VPC > AZ > Subnet). Linear single-child wrappers and flat 1-level
 * static sub-groups stay on shared columns.
 */
export function hasRecursiveNesting(doc: DavDocument): boolean {
  const tops = topLevelGroups(doc.groups);
  if (tops.length !== 1 || !tops[0]) return false;
  const topId = tops[0].id;
  const childCount = new Map<string, number>();
  const directChildren = new Set<string>();
  for (const g of doc.groups) {
    if (g.parentId === undefined) continue;
    childCount.set(g.parentId, (childCount.get(g.parentId) ?? 0) + 1);
    if (g.parentId === topId) directChildren.add(g.id);
  }
  if (directChildren.size === 0) return false;
  const hasGrandchild = doc.groups.some(
    (g) => g.parentId !== undefined && directChildren.has(g.parentId),
  );
  if (!hasGrandchild) return false;
  for (const count of childCount.values()) {
    if (count >= 2) return true;
  }
  return false;
}

/** Maps every descendant node of `containerId` to the direct child (group or node) owning it. */
function mapDescendantOwners(doc: DavDocument, containerId: string): Map<string, string> {
  const groupParent = parentMap(doc.groups);
  const directChildOf = new Map<string, string>();
  for (const g of doc.groups) {
    let cur: string | undefined = g.id;
    let prev = g.id;
    while (cur !== undefined && cur !== containerId) {
      prev = cur;
      cur = groupParent.get(cur);
    }
    if (cur === containerId && g.id !== containerId) {
      directChildOf.set(g.id, prev);
    }
  }
  const owners = new Map<string, string>();
  for (const [gid, owner] of directChildOf) {
    owners.set(gid, owner);
  }
  for (const n of doc.nodes) {
    if (n.parentId === containerId) {
      owners.set(n.id, n.id);
    } else if (n.parentId !== undefined) {
      const owner = directChildOf.get(n.parentId);
      if (owner !== undefined) owners.set(n.id, owner);
    }
  }
  return owners;
}

/**
 * Computes structural sibling signatures to detect isomorphic sibling groups (e.g. Multi-AZ
 * containers with matching subnet topology) so they preserve symmetric internal orientation
 * and synchronized flip polarity.
 */
function detectIsomorphicSiblings(
  doc: DavDocument,
  directGroups: ReadonlyArray<{ id: string }>,
  fullFlow: FlowAnalysis,
  scopeFlow: FlowAnalysis,
): Map<string, number> {
  const bySignature = new Map<string, string[]>();
  const egressPairs = fullFlow.egressReturnPairs ?? new Set<string>();

  for (const g of directGroups) {
    const subGroups = doc.groups.filter((cg) => cg.parentId === g.id);
    const subNodes = doc.nodes.filter((n) => n.parentId === g.id);
    if (subGroups.length === 0 && subNodes.length < 2) continue;

    const subOwners = mapDescendantOwners(doc, g.id);
    const subBlockIds = [...subGroups.map((cg) => cg.id), ...subNodes.map((n) => n.id)];

    // Count descendant nodes and child groups under each direct child of `g`.
    const descCount = new Map<string, number>(subBlockIds.map((id) => [id, 0]));
    for (const owner of subOwners.values()) {
      descCount.set(owner, (descCount.get(owner) ?? 0) + 1);
    }
    const subGroupCount = new Map<string, number>(
      subGroups.map((cg) => [cg.id, doc.groups.filter((gg) => gg.parentId === cg.id).length]),
    );

    const deg = new Map<string, [number, number, number, number, number, number]>(
      subBlockIds.map((id) => [id, [0, 0, 0, 0, 0, 0]]),
    );
    for (const c of fullFlow.connections) {
      const bu = subOwners.get(c.from);
      const bv = subOwners.get(c.to);
      if (!bu || !bv || bu === bv) continue;
      const du = deg.get(bu);
      const dv = deg.get(bv);
      if (!du || !dv) continue;
      if (c.role === 'primary') {
        du[1]++;
        dv[0]++;
      } else if (c.role === 'static') {
        if (egressPairs.has(flowPairKey(c.from, c.to))) {
          du[5]++;
          dv[4]++;
        } else {
          du[3]++;
          dv[2]++;
        }
      }
    }

    const childFingerprints = subBlockIds
      .map((id) => {
        const isGrp = subGroupCount.has(id) ? 1 : 0;
        const d = deg.get(id) ?? [0, 0, 0, 0, 0, 0];
        return `${isGrp}:${descCount.get(id) ?? 0}:${subGroupCount.get(id) ?? 0}:${d.join(',')}`;
      })
      .sort();

    // Only sibling groups in the same stage & primary/auxiliary role can be parallel isomorphic
    // siblings — upstream/downstream pipeline stages (e.g. App Subnet -> Data Subnet) must flip independently.
    const stage = scopeFlow.zoneStage.get(g.id) ?? 0;
    const isAux = scopeFlow.auxiliaryZones.has(g.id) ? 1 : 0;
    const sig = `${stage}|${isAux}|${subGroups.length}|${subNodes.length}|${childFingerprints.join(';')}`;
    pushToMap(bySignature, sig, g.id);
  }

  const symmetryGroups = new Map<string, number>();
  let nextSymId = 1;
  for (const ids of bySignature.values()) {
    if (ids.length < 2) continue;
    const symId = nextSymId++;
    for (const id of ids) symmetryGroups.set(id, symId);
  }
  return symmetryGroups;
}

/** Expands a rigid `Block`'s width to `targetWidth`, centering all contained nodes and groups horizontally. */
function widenBlock(block: Block, targetWidth: number): Block {
  if (targetWidth <= block.width) return block;
  const dx = Math.round((targetWidth - block.width) / 2);
  const shiftRect = (r: Rect): Rect => ({ ...r, x: r.x + dx });
  const nodes = new Map([...block.nodes].map(([id, r]) => [id, shiftRect(r)]));
  const groups = new Map(
    [...block.groups].map(([id, r]) => [
      id,
      id === block.id ? { ...r, width: targetWidth } : shiftRect(r),
    ]),
  );
  const groupsFlipped = new Map(
    [...block.groupsFlipped].map(([id, r]) => [
      id,
      id === block.id ? { ...r, width: targetWidth } : shiftRect(r),
    ]),
  );
  return { ...block, width: targetWidth, nodes, groups, groupsFlipped };
}

/**
 * Aligns outer width and internal child-column tracks of structurally similar composite sibling
 * containers stacked in the same stage column (e.g. Multi-AZ boxes with matching subnet tiers
 * where one AZ's App Subnet is 2x1 and the peer AZ's App Subnet is 1x2).
 */
function alignStackedSiblingColumns(doc: DavDocument, col: Block[]): void {
  if (col.length < 2) return;

  interface Candidate {
    index: number;
    block: Block;
    sig: string;
    childCols: Array<{ groupIds: string[]; x: number; w: number }>;
  }

  const bySig = new Map<string, Candidate[]>();
  for (let index = 0; index < col.length; index++) {
    const block = col[index];
    if (!block || block.groups.size <= 1) continue;
    const directGroups = doc.groups.filter((g) => g.parentId === block.id);
    if (directGroups.length < 2) continue;
    if (doc.nodes.some((n) => n.parentId === block.id)) continue;

    const entries = directGroups
      .map((g) => ({ id: g.id, r: block.groups.get(g.id) }))
      .filter((e): e is { id: string; r: Rect } => e.r !== undefined)
      .sort((a, b) => a.r.x - b.r.x || compareId(a.id, b.id));
    if (entries.length !== directGroups.length) continue;

    // Group direct child groups into vertical columns by horizontal overlap.
    const childCols: Array<{ groupIds: string[]; x: number; right: number }> = [];
    for (const { id, r } of entries) {
      const last = childCols[childCols.length - 1];
      if (last && r.x < last.right) {
        last.groupIds.push(id);
        last.x = Math.min(last.x, r.x);
        last.right = Math.max(last.right, r.x + r.width);
      } else {
        childCols.push({ groupIds: [id], x: r.x, right: r.x + r.width });
      }
    }
    if (childCols.length < 2) continue;

    const sig = `${directGroups.length}|${childCols.length}`;
    pushToMap(bySig, sig, {
      index,
      block,
      sig,
      childCols: childCols.map((c) => ({ groupIds: c.groupIds, x: c.x, w: c.right - c.x })),
    });
  }

  for (const members of bySig.values()) {
    if (members.length < 2) continue;
    const minOrigW = Math.min(...members.map((m) => m.block.width));
    const maxOrigW = Math.max(...members.map((m) => m.block.width));
    if (minOrigW <= 0 || maxOrigW > minOrigW * 1.5) continue;

    const numCols = members[0]?.childCols.length ?? 0;
    const targetColW: number[] = [];
    for (let k = 0; k < numCols; k++) {
      targetColW.push(Math.max(...members.map((m) => m.childCols[k]?.w ?? 0)));
    }
    const targetColX: number[] = [GROUP_PADDING];
    for (let k = 1; k < numCols; k++) {
      const gap = Math.max(
        GROUP_PADDING,
        ...members.map((m) => {
          const prev = m.childCols[k - 1];
          const cur = m.childCols[k];
          return prev && cur ? cur.x - (prev.x + prev.w) : GROUP_PADDING;
        }),
      );
      targetColX.push((targetColX[k - 1] ?? 0) + (targetColW[k - 1] ?? 0) + gap);
    }
    const contentRight =
      (targetColX[numCols - 1] ?? 0) + (targetColW[numCols - 1] ?? 0) + GROUP_PADDING;
    const targetBlockW = Math.max(contentRight, maxOrigW);
    const gridOffset = Math.round((targetBlockW - contentRight) / 2);
    if (gridOffset > 0) {
      for (let k = 0; k < numCols; k++) targetColX[k] = (targetColX[k] ?? 0) + gridOffset;
    }

    for (const m of members) {
      const alreadyAligned =
        m.block.width === targetBlockW &&
        m.childCols.every((c, k) => c.x === targetColX[k] && c.w === targetColW[k]);
      if (alreadyAligned) continue;

      const owners = mapDescendantOwners(doc, m.block.id);
      const childTarget = new Map<string, { x: number; width: number }>();
      const innerDxByChild = new Map<string, number>();
      m.childCols.forEach((c, k) => {
        const newX = targetColX[k] ?? c.x;
        const newW = targetColW[k] ?? c.w;
        for (const gid of c.groupIds) {
          const oldR = m.block.groups.get(gid);
          if (!oldR) continue;
          childTarget.set(gid, { x: newX, width: newW });
          innerDxByChild.set(gid, newX - oldR.x + Math.round((newW - oldR.width) / 2));
        }
      });

      const remapGroupMap = (src: ReadonlyMap<string, Rect>): Map<string, Rect> =>
        new Map(
          [...src].map(([gid, r]) => {
            if (gid === m.block.id) return [gid, { ...r, width: targetBlockW }];
            const ct = childTarget.get(gid);
            if (ct) return [gid, { ...r, x: ct.x, width: ct.width }];
            const owner = owners.get(gid);
            const dx = owner !== undefined ? (innerDxByChild.get(owner) ?? 0) : 0;
            return [gid, dx !== 0 ? { ...r, x: r.x + dx } : r];
          }),
        );

      const nodes = new Map(
        [...m.block.nodes].map(([nid, r]) => {
          const owner = owners.get(nid);
          const dx = owner !== undefined ? (innerDxByChild.get(owner) ?? 0) : 0;
          return [nid, dx !== 0 ? { ...r, x: r.x + dx } : r];
        }),
      );

      col[m.index] = {
        ...m.block,
        width: targetBlockW,
        nodes,
        groups: remapGroupMap(m.block.groups),
        groupsFlipped: remapGroupMap(m.block.groupsFlipped),
      };
    }
  }
}

/** Builds a rigid single-node `Block` for a node sitting directly inside a container. */
function makeNodeBlock(id: string, docLoops: ReadonlyMap<string, number>): Block {
  const { width, height } = NODE_SIZE;
  const loopRoom = docLoops.get(id) ?? 0;
  return {
    id,
    width,
    height,
    head: 0,
    contentHeight: height,
    loopRoom,
    nodeLoopRoom: loopRoom > 0 ? new Map([[id, loopRoom]]) : new Map(),
    flippable: false,
    nodes: new Map([[id, { x: 0, y: 0, width, height }]]),
    groups: new Map(),
    groupsFlipped: new Map(),
    reflectConst: new Map(),
  };
}

/** Computes the visual bounding box of placed child blocks, preserving room for self-loops on direct nodes. */
function visualBoundsOf(placed: readonly Placed[]): Rect {
  const rects: Rect[] = placed.map((p) => {
    const extraTop = p.block.groups.size === 0 ? p.block.loopRoom : 0;
    return {
      x: p.x,
      y: p.y - extraTop,
      width: p.block.width,
      height: p.block.height + extraTop,
    };
  });
  return enclosingRect(rects);
}

/** Wraps placed child blocks inside a parent group's frame, honoring header width/height guarantees. */
function wrapPlacedChildren(doc: DavDocument, zoneId: string, placed: readonly Placed[]): Block {
  const pad = GROUP_PADDING;
  const group = doc.groups.find((g) => g.id === zoneId);
  const groupLabel = group?.label ?? '';
  const hasIcon = Boolean(group?.icon);

  if (placed.length === 0) {
    const rawWidth = EMPTY_GROUP_CONTENT.width + pad * 2;
    const width = Math.max(rawWidth, zoneMinWidth(groupLabel, hasIcon));
    const head = groupHeaderHeight(groupLabel, width, hasIcon) + pad;
    const height = head + EMPTY_GROUP_CONTENT.height + pad;
    const groupsMap = new Map<string, Rect>([[zoneId, { x: 0, y: 0, width, height }]]);
    return {
      id: zoneId,
      width,
      height,
      head,
      contentHeight: EMPTY_GROUP_CONTENT.height,
      loopRoom: 0,
      nodeLoopRoom: new Map(),
      flippable: false,
      nodes: new Map(),
      groups: groupsMap,
      groupsFlipped: new Map(groupsMap),
      reflectConst: new Map(),
    };
  }

  const bounds = visualBoundsOf(placed);
  const roundedPlaced = placed.map((p) => ({
    p,
    rx: Math.round(p.x - bounds.x),
    ry: Math.round(p.y - bounds.y),
  }));
  let maxRight = 0;
  let maxBot = 0;
  let minTop = 0;
  for (const { p, rx, ry } of roundedPlaced) {
    const extraTop = p.block.groups.size === 0 ? p.block.loopRoom : 0;
    minTop = Math.min(minTop, ry - extraTop);
    maxRight = Math.max(maxRight, rx + p.block.width);
    maxBot = Math.max(maxBot, ry + p.block.height);
  }
  const contentWidth = maxRight;
  const contentHeight = maxBot - minTop;
  const rawWidth = contentWidth + pad * 2;
  const width = Math.max(rawWidth, zoneMinWidth(groupLabel, hasIcon));
  const padLeft = pad + Math.round((width - rawWidth) / 2);
  const head = groupHeaderHeight(groupLabel, width, hasIcon) + pad;
  const height = head + contentHeight + pad;

  const nodesMap = new Map<string, Rect>();
  const groupsMap = new Map<string, Rect>([[zoneId, { x: 0, y: 0, width, height }]]);
  const nodeLoopRoom = new Map<string, number>();

  for (const { p, rx, ry } of roundedPlaced) {
    const { block } = p;
    const bx = padLeft + rx;
    const by = head + ry - minTop;
    for (const [nid, nr] of block.nodes) {
      nodesMap.set(nid, {
        ...nr,
        x: bx + nr.x,
        y: by + (p.flip ? flippedY(block, nr, nid) : nr.y),
      });
    }
    for (const [gid, gr] of p.flip ? block.groupsFlipped : block.groups) {
      groupsMap.set(gid, { ...gr, x: bx + gr.x, y: by + gr.y });
    }
    for (const [nid, room] of block.nodeLoopRoom) {
      nodeLoopRoom.set(nid, room);
    }
  }

  const detachParent = <T extends { parentId?: string }>(item: T) => {
    if (item.parentId !== zoneId) return item;
    const { parentId: _p, ...rest } = item;
    return rest;
  };
  const descNodes = doc.nodes.filter((n) => nodesMap.has(n.id)).map(detachParent);
  const descGroups = doc.groups
    .filter((g) => g.id !== zoneId && groupsMap.has(g.id))
    .map(detachParent);
  const { groupsFlipped, reflectConst } = computeFlipMetadata(
    zoneId,
    descNodes,
    descGroups,
    0,
    nodesMap,
    groupsMap,
  );

  return {
    id: zoneId,
    width,
    height,
    head,
    contentHeight,
    loopRoom: 0,
    nodeLoopRoom,
    flippable: false,
    nodes: nodesMap,
    groups: groupsMap,
    groupsFlipped,
    reflectConst,
    recursive: true,
  };
}

interface WrappedRowPlan {
  rows: Block[][][];
}

/**
 * Evaluates ordered contiguous row partitions of `columns` inside a nested composite container
 * so wide multi-stage pipelines, asymmetric height pairs, and parallel-ingress sibling groups
 * pack into a balanced 2D footprint instead of stretching into extreme horizontal ribbons.
 */
function planContainerRowWrap(
  columns: readonly Block[][],
  depth: number,
  targetAspect: number,
  spacing: ZoneSpacing,
  scopeFlow: FlowAnalysis,
  childOwners: ReadonlyMap<string, string>,
  extInCount: ReadonlyMap<string, number>,
  extPriInCount: ReadonlyMap<string, number>,
): WrappedRowPlan | undefined {
  const k = columns.length;
  if (depth < 1 || k < 2) return undefined;

  const colW = columns.map((c) => Math.max(0, ...c.map((b) => b.width)));
  const colH = columns.map(
    (c) =>
      c.reduce((s, b) => s + b.height + (b.groups.size === 0 ? b.loopRoom : 0), 0) +
      Math.max(0, c.length - 1) * spacing.rowGap,
  );
  const colHasGroup = columns.map((c) => c.some((b) => b.groups.size > 0));
  const W1 = colW.reduce((s, w) => s + w, 0) + (k - 1) * spacing.stageGap;
  const H1 = Math.max(1, ...colH);
  const A1 = W1 * H1;
  const R1 = W1 / H1;

  // Quick exit: compact single-row containers stay strictly left-to-right.
  if (W1 < 800 || R1 < 1.8) return undefined;

  const rowGap = Math.max(spacing.auxGap, ROW_WRAP_GAP);
  const candidates: number[][] = [];
  if (k <= 10) {
    // 2-row partitions: 1 cut index c1 in [1 .. k-1].
    for (let c1 = 1; c1 < k; c1++) candidates.push([c1]);
    // 3-row partitions for 4+ stage containers.
    if (k >= 4) {
      for (let c1 = 1; c1 < k - 1; c1++) {
        for (let c2 = c1 + 1; c2 < k; c2++) candidates.push([c1, c2]);
      }
    }
  } else {
    // Deterministic greedy target-width wrap for very long (> 10 stage) chains.
    const avgRowH = colH.reduce((s, h) => s + h, 0) / k + rowGap;
    const rowTargetW = Math.max(900, Math.sqrt(W1 * avgRowH * Math.max(1.0, targetAspect)));
    const cuts: number[] = [];
    let curW = 0;
    for (let i = 0; i < k; i++) {
      const addW = (curW > 0 ? spacing.stageGap : 0) + (colW[i] ?? 0);
      if (curW > 0 && curW + addW > rowTargetW) {
        cuts.push(i);
        curW = colW[i] ?? 0;
      } else {
        curW += addW;
      }
    }
    if (cuts.length > 0) candidates.push(cuts);
  }

  // Pre-index inter-column primary connection counts so wrapping favors low-cut boundaries.
  const colIdxByBlock = new Map<string, number>();
  columns.forEach((col, ci) => {
    for (const b of col) colIdxByBlock.set(b.id, ci);
  });
  const interColPri: Array<readonly [number, number]> = [];
  for (const c of scopeFlow.connections) {
    if (c.role !== 'primary') continue;
    const cu = colIdxByBlock.get(childOwners.get(c.from) ?? '');
    const cv = colIdxByBlock.get(childOwners.get(c.to) ?? '');
    if (cu !== undefined && cv !== undefined && cu !== cv) interColPri.push([cu, cv]);
  }

  const inMultiStageParent = targetAspect < 1.5;
  let best: { rows: Block[][][]; score: number } | undefined;

  for (const cuts of candidates) {
    const bounds = [0, ...cuts, k];
    const rowCount = bounds.length - 1;
    let valid = true;
    let maxRowW = 0;
    let sumRowH = 0;
    const rowOfCol = new Array<number>(k).fill(0);

    for (let r = 0; r < rowCount; r++) {
      const start = bounds[r] as number;
      const end = bounds[r + 1] as number;
      let hasGroup = false;
      let rw = 0;
      let rh = 0;
      for (let i = start; i < end; i++) {
        rowOfCol[i] = r;
        if (colHasGroup[i]) hasGroup = true;
        rw += (i > start ? spacing.stageGap : 0) + (colW[i] ?? 0);
        rh = Math.max(rh, colH[i] ?? 0);
      }
      // Never isolate a bare single-node column (e.g. a gateway or hub) onto its own wrapped row.
      if (!hasGroup) {
        valid = false;
        break;
      }
      maxRowW = Math.max(maxRowW, rw);
      sumRowH += rh;
    }
    if (!valid) continue;

    const W = maxRowW;
    const H = sumRowH + (rowCount - 1) * rowGap;
    if (W >= W1 * 0.85) continue; // Require meaningful horizontal width reduction.
    const A = W * H;
    const R = W / Math.max(1, H);

    // Check the three general geometric/topological criteria:
    // 1) Asymmetric height packing that eliminates significant dead-space area (>= 15% area reduction).
    const qualifiesByArea = W1 >= 1400 && A <= A1 * 0.85 && R >= 0.8;

    // 2) Extreme ribbon wrapping, scaled by whether ancestors already pack multiple horizontal stages.
    const qualifiesByRibbon = inMultiStageParent
      ? ((W1 >= 1200 && R1 >= 4.2) || (W1 >= 1800 && R1 >= 2.8)) && R >= 1.0 && A <= A1 * 1.15
      : ((W1 >= 2400 && R1 >= 4.5) || (W1 >= 3200 && R1 >= 3.2)) && R >= 1.2 && A <= A1 * 1.15;

    // 3) Parallel external ingress: two sibling groups that both receive external ingress stack so
    //    both entry points sit cleanly on the left boundary instead of leaping over the first group.
    let qualifiesByParallelIngress = false;
    if (rowCount === 2 && k === 2) {
      const c0 = columns[0];
      const c1 = columns[1];
      const b0 = c0?.length === 1 ? c0[0] : undefined;
      const b1 = c1?.length === 1 ? c1[0] : undefined;
      if (b0 && b1 && b0.groups.size > 0 && b1.groups.size > 0) {
        const bothExtIn = (extInCount.get(b0.id) ?? 0) > 0 && (extInCount.get(b1.id) ?? 0) > 0;
        const b1HasPriIn = (extPriInCount.get(b1.id) ?? 0) > 0;
        if (bothExtIn && (!scopeFlow.hasAnimate || b1HasPriIn)) {
          qualifiesByParallelIngress =
            (inMultiStageParent && W1 >= 800 && R1 >= 2.2) || (W1 > 1400 && R1 > 2.2 && b1HasPriIn);
        }
      }
    }

    if (!qualifiesByArea && !qualifiesByRibbon && !qualifiesByParallelIngress) continue;

    let crossRowPri = 0;
    for (const [cu, cv] of interColPri) {
      if (rowOfCol[cu] !== rowOfCol[cv]) crossRowPri++;
    }
    const aspectErr = Math.abs(Math.log(Math.max(0.1, R) / Math.max(0.5, targetAspect)));
    const score = aspectErr * 2.0 + (A / A1) * 1.5 + crossRowPri * 0.15 + (rowCount - 2) * 0.25;
    if (!best || score < best.score - 1e-9) {
      const rows: Block[][][] = [];
      for (let r = 0; r < rowCount; r++) {
        rows.push(columns.slice(bounds[r] as number, bounds[r + 1] as number).map((c) => [...c]));
      }
      best = { rows, score };
    }
  }

  return best ? { rows: best.rows } : undefined;
}

/**
 * Places child blocks of a composite container using deterministic stage+band layout,
 * isomorphic sibling symmetry, auxiliary band separation, and bounded local refinement.
 */
function placeContainerChildren(
  doc: DavDocument,
  blocks: readonly Block[],
  childOwners: ReadonlyMap<string, string>,
  scopeFlow: FlowAnalysis,
  fullFlow: FlowAnalysis,
  symmetryGroups: ReadonlyMap<string, number>,
  isAuxiliary: boolean,
  depth: number,
  spacing: ZoneSpacing,
  targetAspect = ROOT_TARGET_ASPECT,
): Placed[] {
  if (blocks.length === 0) return [];
  if (blocks.length === 1 && blocks[0]) {
    const b = blocks[0];
    const extraTop = b.groups.size === 0 ? b.loopRoom : 0;
    return [{ block: b, x: 0, y: extraTop, flip: 0 }];
  }

  // Classify each child block by internal inter-child edges vs external boundary edges.
  const internalConnectedIds = new Set<string>();
  const primaryOutDeg = new Map<string, number>(blocks.map((b) => [b.id, 0]));
  const primaryInDeg = new Map<string, number>(blocks.map((b) => [b.id, 0]));
  const isEgressChild = new Map<string, boolean>(blocks.map((b) => [b.id, false]));
  const egressPairs = fullFlow.egressReturnPairs ?? new Set<string>();

  for (const c of scopeFlow.connections) {
    const bu = childOwners.get(c.from);
    const bv = childOwners.get(c.to);
    if (!bu || !bv || bu === bv) continue;
    internalConnectedIds.add(bu);
    internalConnectedIds.add(bv);
    if (c.role === 'primary') {
      primaryOutDeg.set(bu, (primaryOutDeg.get(bu) ?? 0) + 1);
      primaryInDeg.set(bv, (primaryInDeg.get(bv) ?? 0) + 1);
    } else if (c.role === 'static' && egressPairs.has(flowPairKey(c.from, c.to))) {
      isEgressChild.set(bv, true);
    }
  }

  const extInCount = new Map<string, number>(blocks.map((b) => [b.id, 0]));
  const extOutCount = new Map<string, number>(blocks.map((b) => [b.id, 0]));
  const extPriInCount = new Map<string, number>(blocks.map((b) => [b.id, 0]));
  const extPriInFirstStep = new Map<string, number>();
  const blockFirstPriStep = new Map<string, number>();
  const recordMinStep = (map: Map<string, number>, id: string, step: number) => {
    const prev = map.get(id);
    if (prev === undefined || step < prev) map.set(id, step);
  };
  for (const c of fullFlow.connections) {
    const inFrom = childOwners.get(c.from);
    const inTo = childOwners.get(c.to);
    const fs = fullFlow.pairFirstStep.get(flowPairKey(c.from, c.to)) ?? 0;
    if (c.role === 'primary') {
      if (inFrom !== undefined) recordMinStep(blockFirstPriStep, inFrom, fs);
      if (inTo !== undefined) recordMinStep(blockFirstPriStep, inTo, fs);
    }
    if ((inFrom !== undefined) === (inTo !== undefined)) continue;
    if (inTo !== undefined) {
      extInCount.set(inTo, (extInCount.get(inTo) ?? 0) + 1);
      if (c.role === 'primary') {
        extPriInCount.set(inTo, (extPriInCount.get(inTo) ?? 0) + 1);
        recordMinStep(extPriInFirstStep, inTo, fs);
      }
    }
    if (inFrom !== undefined) {
      extOutCount.set(inFrom, (extOutCount.get(inFrom) ?? 0) + 1);
    }
  }
  const declOrder = new Map<string, number>();
  let declIdx = 0;
  for (const g of doc.groups) declOrder.set(g.id, declIdx++);
  for (const n of doc.nodes) declOrder.set(n.id, declIdx++);

  const internalConnected: Block[] = [];
  const externalOnly: Block[] = [];
  const trulyIsolated: Block[] = [];
  for (const b of blocks) {
    if (internalConnectedIds.has(b.id)) internalConnected.push(b);
    else if ((extInCount.get(b.id) ?? 0) + (extOutCount.get(b.id) ?? 0) > 0) externalOnly.push(b);
    else trulyIsolated.push(b);
  }

  const active = [...internalConnected, ...externalOnly];

  // Subcase 1: Zero inter-child edges inside this container (e.g. `security_obs_account` or `users { staff, partner }`).
  if (internalConnected.length === 0) {
    const toPlace = active.length > 0 ? active : trulyIsolated;
    const sorted = [...toPlace].sort((a, b) => {
      // Upstream-receiving children left/top, downstream-sending children right/bottom.
      const sa = (extOutCount.get(a.id) ?? 0) - (extInCount.get(a.id) ?? 0);
      const sb = (extOutCount.get(b.id) ?? 0) - (extInCount.get(b.id) ?? 0);
      if (isAuxiliary && sa !== sb) return sa - sb;
      return compareId(a.id, b.id);
    });
    const placedActive: Placed[] = [];
    if (isAuxiliary) {
      // Auxiliary containers sit in horizontal bands: pack disconnected children side-by-side.
      const maxH = Math.max(0, ...sorted.map((b) => b.height));
      let x = 0;
      for (const b of sorted) {
        placedActive.push({ block: b, x, y: Math.round((maxH - b.height) / 2), flip: 0 });
        x += b.width + spacing.horizontalClearance;
      }
    } else {
      // Non-auxiliary stage containers stack disconnected children vertically facing the next stage.
      let y = 0;
      for (const b of sorted) {
        const extraTop = b.groups.size === 0 ? b.loopRoom : 0;
        placedActive.push({ block: b, x: 0, y: y + extraTop, flip: 0 });
        y += extraTop + b.height + spacing.rowGap;
      }
    }
    if (active.length === 0) return placedActive;
    return [...placedActive, ...placeIsolatedBlocks(trulyIsolated, placedActive, spacing)];
  }

  // Subcase 2: Connected children — stage external-only siblings (e.g. Route 53 in AWS Cloud) on entry/exit side.
  if (externalOnly.length > 0) {
    const primaryStages = internalConnected
      .filter((b) => !scopeFlow.auxiliaryZones.has(b.id))
      .map((b) => scopeFlow.zoneStage.get(b.id) ?? 0);
    const maxStage = primaryStages.length > 0 ? Math.max(...primaryStages) : 0;
    for (const b of externalOnly) {
      const eIn = extInCount.get(b.id) ?? 0;
      const eOut = extOutCount.get(b.id) ?? 0;
      scopeFlow.zoneStage.set(b.id, eOut > 0 && eIn === 0 ? maxStage : 0);
    }
  }

  const { auxiliary, columns } = stageColumns(active, scopeFlow);
  const effectiveSymmetryGroups = new Map(symmetryGroups);

  // Prevent early external-entry sink nodes (e.g. an auth/IdP or shared registry entered directly
  // from outside the container before or alongside a downstream composite group, with zero
  // outgoing primary flow inside this container) from being pushed past that composite group by a
  // later verification/lookup reference (e.g. `alb ..> cognito`). Keep them on the entry side
  // between the external boundary and the referencing group, and treat those inward-to-entry
  // lookups as return edges inside this scope.
  if (depth >= 1 && columns.length >= 2) {
    const colOfBlockId = new Map<string, number>();
    columns.forEach((col, ci) => {
      for (const b of col) colOfBlockId.set(b.id, ci);
    });
    const blockById = new Map(active.map((b) => [b.id, b]));
    const relocatedTo = new Map<string, { targetCol: number; minRefCol: number }>();

    for (let ci = 1; ci < columns.length; ci++) {
      const col = columns[ci];
      if (!col) continue;
      for (const b of col) {
        if (b.groups.size > 0 || (primaryOutDeg.get(b.id) ?? 0) > 0) continue;
        const extStep = extPriInFirstStep.get(b.id);
        if (extStep === undefined || (extPriInCount.get(b.id) ?? 0) === 0) continue;

        let minRefGroupCol = Number.POSITIVE_INFINITY;
        let maxUpstreamNonGroupCol = -1;
        let hasValidRefGroup = false;
        let hasLaterNonGroupRef = false;

        for (const c of scopeFlow.connections) {
          if (c.role !== 'primary') continue;
          const bu = childOwners.get(c.from);
          const bv = childOwners.get(c.to);
          if (!bu || !bv || bu === bv || bv !== b.id) continue;
          const srcCol = colOfBlockId.get(bu);
          const srcBlock = blockById.get(bu);
          if (srcCol === undefined || !srcBlock) continue;
          if (srcBlock.groups.size >= 1 && srcBlock.nodes.size >= 2) {
            const srcStep = blockFirstPriStep.get(bu) ?? Number.POSITIVE_INFINITY;
            if (srcCol < ci && extStep <= srcStep) {
              hasValidRefGroup = true;
              if (srcCol < minRefGroupCol) minRefGroupCol = srcCol;
            }
          } else if (srcCol < ci) {
            if (srcCol > maxUpstreamNonGroupCol) maxUpstreamNonGroupCol = srcCol;
            hasLaterNonGroupRef = true;
          }
        }

        if (!hasValidRefGroup || !Number.isFinite(minRefGroupCol)) continue;
        let targetCol = Math.max(0, minRefGroupCol - 1);
        if (hasLaterNonGroupRef && maxUpstreamNonGroupCol + 1 < minRefGroupCol) {
          targetCol = Math.max(targetCol, maxUpstreamNonGroupCol + 1);
        }
        if (targetCol < ci) {
          relocatedTo.set(b.id, { targetCol, minRefCol: minRefGroupCol });
        }
      }
    }

    if (relocatedTo.size > 0) {
      const movedBlocks: Array<{ block: Block; targetCol: number }> = [];
      for (let ci = columns.length - 1; ci >= 0; ci--) {
        const col = columns[ci];
        if (!col) continue;
        for (let bi = col.length - 1; bi >= 0; bi--) {
          const b = col[bi];
          if (!b) continue;
          const info = relocatedTo.get(b.id);
          if (!info) continue;
          col.splice(bi, 1);
          movedBlocks.push({ block: b, targetCol: info.targetCol });
        }
      }
      for (const { block, targetCol } of movedBlocks) {
        const destCol = columns[targetCol];
        if (!destCol) continue;
        destCol.push(block);
        const destStage =
          destCol.find((x) => x.id !== block.id) !== undefined
            ? (scopeFlow.zoneStage.get(destCol[0]?.id ?? '') ?? targetCol)
            : targetCol;
        scopeFlow.zoneStage.set(block.id, destStage);
      }
      for (let ci = columns.length - 1; ci >= 0; ci--) {
        if (columns[ci]?.length === 0) columns.splice(ci, 1);
      }

      // Demote downstream-group -> relocated-entry-sink primary references to `'return'` inside
      // this container scope so downstream refinement keeps the node on the entry side.
      const demotedPairs = new Set<string>();
      for (const [bId, { minRefCol }] of relocatedTo) {
        for (const [srcId, srcCol] of colOfBlockId) {
          if (srcCol >= minRefCol && srcId !== bId) {
            scopeFlow.primaryZonePairs.delete(idPair(srcId, bId));
            demotedPairs.add(`${srcId}\0${bId}`);
          }
        }
      }
      if (demotedPairs.size > 0) {
        scopeFlow = {
          ...scopeFlow,
          connections: scopeFlow.connections.map((c) => {
            if (c.role !== 'primary') return c;
            const bu = childOwners.get(c.from);
            const bv = childOwners.get(c.to);
            if (bu && bv && demotedPairs.has(`${bu}\0${bv}`)) {
              return { ...c, role: 'return' as const };
            }
            return c;
          }),
        };
      }
    }
  }

  // Merge parallel fan-out peer sibling containers into a single vertical stage column so peer
  // zones (e.g. Active/Active or Active/Standby Multi-AZ boxes) stay vertically symmetric instead
  // of stretching into a wide ribbon or drifting into an auxiliary top/bottom band.
  if (depth >= 1 && columns.length >= 2) {
    const firstStepByDirPair = new Map<string, number>();
    const anyDirPair = new Set<string>();
    const hasStaticBetween = new Set<string>();
    const hasBidirBetween = new Set<string>();
    for (const c of scopeFlow.connections) {
      const bu = childOwners.get(c.from);
      const bv = childOwners.get(c.to);
      if (!bu || !bv || bu === bv) continue;
      const pk = flowPairKey(bu, bv);
      anyDirPair.add(`${bu}\0${bv}`);
      if (c.role === 'primary') {
        const fs = fullFlow.pairFirstStep.get(flowPairKey(c.from, c.to)) ?? 0;
        const dk = `${bu}\0${bv}`;
        const prev = firstStepByDirPair.get(dk);
        if (prev === undefined || fs < prev) firstStepByDirPair.set(dk, fs);
        if (c.direction === 'bidirectional') hasBidirBetween.add(pk);
      } else if (c.role === 'static') {
        hasStaticBetween.add(pk);
      }
    }
    const directChildGroupCount = (gid: string): number =>
      doc.groups.filter((g) => g.parentId === gid).length;
    let nextSymId = Math.max(0, ...effectiveSymmetryGroups.values()) + 1;

    // Pull a standby peer container (e.g. Standby AZ linked only via static failover + replication)
    // back out of `auxiliary` into its active peer's column when both share an upstream distributor.
    if (auxiliary.length > 0) {
      for (let ai = auxiliary.length - 1; ai >= 0; ai--) {
        const aux = auxiliary[ai];
        if (!aux || aux.groups.size < 1 || aux.nodes.size < 2) continue;
        const auxSub = directChildGroupCount(aux.id);
        let merged = false;
        for (let ci = 1; ci < columns.length && !merged; ci++) {
          const colA = columns[ci];
          if (!colA) continue;
          for (const a of colA) {
            if (a.groups.size < 1 || a.nodes.size < 2) continue;
            if (directChildGroupCount(a.id) !== auxSub) continue;
            const minN = Math.min(a.nodes.size, aux.nodes.size);
            if (Math.abs(a.nodes.size - aux.nodes.size) > Math.max(1, Math.floor(minN / 2))) {
              continue;
            }
            const pk = flowPairKey(a.id, aux.id);
            if (!hasStaticBetween.has(pk) && !hasBidirBetween.has(pk)) continue;
            let upstreamId: string | undefined;
            for (const prevCol of columns.slice(0, ci)) {
              const found = prevCol.find(
                (p) =>
                  firstStepByDirPair.has(`${p.id}\0${a.id}`) &&
                  anyDirPair.has(`${p.id}\0${aux.id}`),
              );
              if (found) {
                upstreamId = found.id;
                break;
              }
            }
            if (upstreamId === undefined) continue;
            colA.push(aux);
            auxiliary.splice(ai, 1);
            scopeFlow.auxiliaryZones.delete(aux.id);
            scopeFlow.zoneStage.set(aux.id, scopeFlow.zoneStage.get(a.id) ?? ci);
            scopeFlow.primaryZonePairs.add(idPair(upstreamId, aux.id));
            if (a.nodes.size === aux.nodes.size) {
              const sym = effectiveSymmetryGroups.get(a.id) ?? nextSymId++;
              effectiveSymmetryGroups.set(a.id, sym);
              effectiveSymmetryGroups.set(aux.id, sym);
            }
            merged = true;
            break;
          }
        }
      }
    }
    const subOwnerCache = new Map<string, Map<string, string>>();
    const subOwnersOf = (gid: string): Map<string, string> => {
      let m = subOwnerCache.get(gid);
      if (!m) {
        m = mapDescendantOwners(doc, gid);
        subOwnerCache.set(gid, m);
      }
      return m;
    };
    const isInternalFanoutPeer = (a: Block, b: Block): boolean => {
      const subA = directChildGroupCount(a.id);
      const subB = directChildGroupCount(b.id);
      if (subA < 2 || subB < 2 || Math.abs(subA - subB) > 1) return false;
      const aToB = scopeFlow.connections.filter(
        (c) =>
          c.role === 'primary' &&
          c.direction !== 'bidirectional' &&
          childOwners.get(c.from) === a.id &&
          childOwners.get(c.to) === b.id,
      );
      if (aToB.length === 0) return false;
      const hasReversePrimary = scopeFlow.connections.some(
        (c) =>
          c.role === 'primary' &&
          c.direction !== 'bidirectional' &&
          childOwners.get(c.from) === b.id &&
          childOwners.get(c.to) === a.id,
      );
      if (hasReversePrimary) return false;
      // Every forward primary edge from `a` into `b` must originate from an internal fan-out hub
      // inside `a` that also sends primary flow to another child sub-group of `a` (e.g. an ALB in
      // AZ-A's Public Subnet fanning out to both AZ-A App Subnet and AZ-B App Subnet).
      const aSubOwners = subOwnersOf(a.id);
      return aToB.every((edge) => {
        const srcSub = aSubOwners.get(edge.from);
        if (srcSub === undefined) return false;
        return fullFlow.connections.some(
          (ic) =>
            ic.role === 'primary' &&
            ic.from === edge.from &&
            aSubOwners.has(ic.to) &&
            aSubOwners.get(ic.to) !== srcSub,
        );
      });
    };

    for (let ci = 0; ci < columns.length; ci++) {
      const colA = columns[ci];
      if (!colA || colA.length === 0) continue;
      for (const a of [...colA]) {
        if (a.groups.size < 1 || a.nodes.size < 2) continue;
        for (let cj = ci + 1; cj < columns.length; cj++) {
          const colB = columns[cj];
          if (!colB) continue;
          for (let bi = colB.length - 1; bi >= 0; bi--) {
            const b = colB[bi];
            if (!b || b.groups.size < 1 || b.nodes.size < 2) continue;
            const minN = Math.min(a.nodes.size, b.nodes.size);
            if (Math.abs(a.nodes.size - b.nodes.size) > Math.max(1, Math.floor(minN / 2))) {
              continue;
            }
            const pk = flowPairKey(a.id, b.id);
            if (!hasStaticBetween.has(pk) && !hasBidirBetween.has(pk)) continue;
            // Match either (1) a shared external upstream distributor feeding both `a` and `b` in
            // the same step, or (2) a composite peer whose internal entry hub fans out to both
            // its own sub-groups and `b`.
            const sameSubCount = directChildGroupCount(a.id) === directChildGroupCount(b.id);
            const sharedParallelParent =
              sameSubCount &&
              columns.slice(0, ci).some((prevCol) =>
                prevCol.some((p) => {
                  const sa = firstStepByDirPair.get(`${p.id}\0${a.id}`);
                  const sb = firstStepByDirPair.get(`${p.id}\0${b.id}`);
                  return sa !== undefined && sb !== undefined && sa === sb;
                }),
              );
            if (!sharedParallelParent && !isInternalFanoutPeer(a, b)) continue;
            colA.push(b);
            colB.splice(bi, 1);
            scopeFlow.zoneStage.set(b.id, scopeFlow.zoneStage.get(a.id) ?? ci);
            // Synchronize flip polarity for merged peer groups with identical structure.
            if (sameSubCount && a.nodes.size === b.nodes.size) {
              const sym = effectiveSymmetryGroups.get(a.id) ?? nextSymId++;
              effectiveSymmetryGroups.set(a.id, sym);
              effectiveSymmetryGroups.set(b.id, sym);
            }
          }
          if (colB.length === 0) {
            columns.splice(cj, 1);
            cj--;
          }
        }
      }
    }
  }

  // Stack a wide later-step secondary feeder pipeline (col 0) vertically beneath an earlier-step
  // primary ingress container (col 1) when the two are comparable in height so the Step-1 main
  // ingress stays unobstructed without burying a compact edge gateway beneath a huge region.
  if (depth >= 1 && columns.length >= 2) {
    const c0 = columns[0];
    const c1 = columns[1];
    const b0 = c0?.length === 1 ? c0[0] : undefined;
    const b1 = c1?.length === 1 ? c1[0] : undefined;
    const b0Step = b0 ? blockFirstPriStep.get(b0.id) : undefined;
    const b1ExtStep = b1 ? extPriInFirstStep.get(b1.id) : undefined;
    if (
      c1 &&
      b0 &&
      b1 &&
      b0.groups.size >= 1 &&
      b1.groups.size >= 1 &&
      b0.width >= 500 &&
      b1.width >= 500 &&
      b1.height <= b0.height * 2.5 &&
      b0Step !== undefined &&
      b1ExtStep !== undefined &&
      b0Step > b1ExtStep
    ) {
      c1.push(b0);
      columns.splice(0, 1);
      scopeFlow.zoneStage.set(b0.id, scopeFlow.zoneStage.get(b1.id) ?? 0);
    }
  }

  // Fold a dead-end internal sidecar sink group (zero external edges, zero outgoing primary edges)
  // out of the rightmost primary column into the auxiliary band when upstream primary stages have
  // external egress and keeping the sidecar inline would create an overly wide ribbon.
  if (depth >= 1 && columns.length >= 2) {
    const lastCol = columns[columns.length - 1];
    const sink = lastCol?.length === 1 ? lastCol[0] : undefined;
    if (
      sink &&
      sink.groups.size >= 1 &&
      sink.nodes.size >= 2 &&
      (primaryOutDeg.get(sink.id) ?? 0) === 0 &&
      (extInCount.get(sink.id) ?? 0) === 0 &&
      (extOutCount.get(sink.id) ?? 0) === 0
    ) {
      const upstreamHasExtOut = columns
        .slice(0, -1)
        .some((col) => col.some((b) => (extOutCount.get(b.id) ?? 0) > 0));
      if (upstreamHasExtOut) {
        const estW =
          columns.reduce((s, col) => s + Math.max(0, ...col.map((b) => b.width)), 0) +
          (columns.length - 1) * spacing.stageGap;
        const estH = Math.max(
          1,
          ...columns.map(
            (col) =>
              col.reduce((s, b) => s + b.height, 0) + Math.max(0, col.length - 1) * spacing.rowGap,
          ),
        );
        if (estW >= 1000 && estW / estH >= 2.4) {
          columns.pop();
          auxiliary.push(sink);
          scopeFlow.auxiliaryZones.add(sink.id);
        }
      }
    }
  }

  // Fold a wide rightmost container back into column 1 when a multi-stage nested container would
  // otherwise stretch into an extreme ribbon (`estW >= 2200`, aspect `>= 2.8`), provided that the
  // trailing container receives direct primary flow from column 0 AND also connects to external
  // boundaries (e.g. an Ingress/Edge tier feeding both a Streaming pipeline and a Core VPC that
  // was pushed to column 3 only by an indirect workflow hop).
  if (depth >= 1 && columns.length >= 3) {
    const col0 = columns[0];
    const col1 = columns[1];
    const lastCol = columns[columns.length - 1];
    const tail = lastCol?.length === 1 ? lastCol[0] : undefined;
    if (
      col0 &&
      col1 &&
      tail &&
      tail.groups.size >= 1 &&
      tail.width >= 500 &&
      (extInCount.get(tail.id) ?? 0) + (extOutCount.get(tail.id) ?? 0) > 0
    ) {
      const col0Ids = new Set(col0.map((b) => b.id));
      const fedByCol0 = scopeFlow.connections.some(
        (c) =>
          c.role === 'primary' &&
          col0Ids.has(childOwners.get(c.from) ?? '') &&
          childOwners.get(c.to) === tail.id,
      );
      if (fedByCol0) {
        const estW =
          columns.reduce((s, col) => s + Math.max(0, ...col.map((b) => b.width)), 0) +
          (columns.length - 1) * spacing.stageGap;
        const estH = Math.max(
          1,
          ...columns.map(
            (col) =>
              col.reduce((s, b) => s + b.height, 0) + Math.max(0, col.length - 1) * spacing.rowGap,
          ),
        );
        const col1W = Math.max(tail.width, ...col1.map((b) => b.width));
        const col1H =
          col1.reduce((s, b) => s + b.height, 0) + tail.height + col1.length * spacing.rowGap;
        const newW =
          columns
            .slice(0, -1)
            .reduce(
              (s, col, idx) => s + (idx === 1 ? col1W : Math.max(0, ...col.map((b) => b.width))),
              0,
            ) +
          (columns.length - 2) * spacing.stageGap;
        const newH = Math.max(estH, col1H);
        if (estW >= 2200 && estW / estH >= 2.8 && newW / Math.max(1, newH) >= 1.4) {
          columns.pop();
          col1.push(tail);
          const col1Stage = scopeFlow.zoneStage.get(col1[0]?.id ?? '') ?? 1;
          scopeFlow.zoneStage.set(tail.id, col1Stage);
          for (const midCol of columns.slice(2)) {
            for (const mb of midCol) {
              scopeFlow.primaryZonePairs.delete(idPair(mb.id, tail.id));
            }
          }
        }
      }
    }
  }

  // Equalize outer widths and internal subnet-column grids for structurally similar sibling
  // containers stacked in the same stage column (e.g. AZ-a and AZ-c inside a VPC).
  if (depth >= 1) {
    for (const col of columns) alignStackedSiblingColumns(doc, col);
  }

  // Deterministic stage-column layout + barycenter ordering.
  const pm = new Map<string, Placed>();
  const primaryPlaced: Placed[] = [];
  const colsCopy = columns.map((c) => [...c]);
  const colIdxOf = new Map<string, number>();
  colsCopy.forEach((col, ci) => {
    for (const b of col) {
      colIdxOf.set(b.id, ci);
      const p: Placed = { block: b, x: 0, y: 0, flip: 0 };
      pm.set(b.id, p);
      primaryPlaced.push(p);
    }
  });

  // Sort ties inside each column deterministically by topological role so isomorphic AZs align identically:
  // egress-only blocks (e.g. Public Subnet) sit consistently above primary-out blocks (App Subnet).
  const topoColRank = (id: string): number => {
    const hasPri = (primaryOutDeg.get(id) ?? 0) + (primaryInDeg.get(id) ?? 0) > 0;
    if (!hasPri && isEgressChild.get(id)) return 0;
    if (!hasPri) return 1;
    return 2;
  };
  const compareColumnTie = (a: Block, b: Block): number =>
    (blockFirstPriStep.get(a.id) ?? Number.POSITIVE_INFINITY) -
      (blockFirstPriStep.get(b.id) ?? Number.POSITIVE_INFINITY) ||
    (declOrder.get(a.id) ?? 0) - (declOrder.get(b.id) ?? 0) ||
    compareId(a.id, b.id);
  // Keep parallel peer groups stacked in the same column (e.g. AZ-a / AZ-b linked by static
  // replication or synchronized symmetry) in their declared top-to-bottom order so incidental
  // step ordering or asymmetric neighbor pulls never invert AZ-b above AZ-a.
  const peerEdgePairs = new Set<string>();
  if (depth >= 1) {
    for (const c of scopeFlow.connections) {
      const bu = childOwners.get(c.from);
      const bv = childOwners.get(c.to);
      if (!bu || !bv || bu === bv) continue;
      if (c.role === 'static' || c.direction === 'bidirectional') {
        peerEdgePairs.add(flowPairKey(bu, bv));
      }
    }
  }
  const childGrpCount = (gid: string): number =>
    doc.groups.filter((g) => g.parentId === gid).length;
  const areColumnPeers = (a: Block, b: Block): boolean => {
    if (depth < 1 || a.groups.size < 1 || b.groups.size < 1) return false;
    if (a.nodes.size < 2 || b.nodes.size < 2) return false;
    const symA = effectiveSymmetryGroups.get(a.id);
    if (symA !== undefined && symA === effectiveSymmetryGroups.get(b.id)) return true;
    const minN = Math.min(a.nodes.size, b.nodes.size);
    if (Math.abs(a.nodes.size - b.nodes.size) > Math.max(1, Math.floor(minN / 2))) return false;
    if (Math.abs(childGrpCount(a.id) - childGrpCount(b.id)) > 1) return false;
    return peerEdgePairs.has(flowPairKey(a.id, b.id));
  };
  const preservePeerDeclOrder = (col: Block[]): void => {
    if (depth < 1 || col.length < 2) return;
    const visited = new Set<number>();
    for (let i = 0; i < col.length; i++) {
      if (visited.has(i)) continue;
      const compIdx: number[] = [i];
      visited.add(i);
      for (let head = 0; head < compIdx.length; head++) {
        const cur = col[compIdx[head] as number];
        if (!cur) continue;
        for (let j = 0; j < col.length; j++) {
          if (visited.has(j)) continue;
          const other = col[j];
          if (other && areColumnPeers(cur, other)) {
            visited.add(j);
            compIdx.push(j);
          }
        }
      }
      if (compIdx.length < 2) continue;
      compIdx.sort((x, y) => x - y);
      const sortedBlocks = compIdx
        .map((idx) => col[idx] as Block)
        .sort(
          (a, b) =>
            (declOrder.get(a.id) ?? 0) - (declOrder.get(b.id) ?? 0) || compareId(a.id, b.id),
        );
      compIdx.forEach((idx, k) => {
        col[idx] = sortedBlocks[k] as Block;
      });
    }
  };

  for (const col of colsCopy) {
    if (col.length < 2) continue;
    col.sort(
      (a, b) =>
        topoColRank(a.id) - topoColRank(b.id) ||
        (primaryOutDeg.get(a.id) ?? 0) - (primaryOutDeg.get(b.id) ?? 0) ||
        compareColumnTie(a, b),
    );
    preservePeerDeclOrder(col);
  }

  const preserveFlow = scopeFlow.hasAnimate;
  const hClear = spacing.horizontalClearance;
  const vClear = spacing.verticalClearance;

  // Check if wrapping wide multi-stage / asymmetric / parallel-ingress sibling columns into
  // multiple rows produces a substantially better 2D aspect ratio or eliminates dead space.
  const wrappedPlan = planContainerRowWrap(
    colsCopy,
    depth,
    targetAspect,
    spacing,
    scopeFlow,
    childOwners,
    extInCount,
    extPriInCount,
  );
  if (wrappedPlan) {
    const wrappedRows = wrappedPlan.rows;
    // Equalize minor width differences (<= 80 px) when every wrapped row is a single group box.
    const allSingleGroupRows = wrappedRows.every(
      (row) => row.length === 1 && row[0]?.length === 1 && (row[0][0]?.groups.size ?? 0) > 0,
    );
    if (allSingleGroupRows) {
      const widths = wrappedRows.map((row) => row[0]?.[0]?.width ?? 0);
      const maxW = Math.max(...widths);
      const minW = Math.min(...widths);
      if (maxW - minW > 0 && maxW - minW <= 80) {
        for (const row of wrappedRows) {
          const b = row[0]?.[0];
          if (b && row[0]) {
            const widened = widenBlock(b, maxW);
            row[0][0] = widened;
            const p = pm.get(b.id);
            if (p) p.block = widened;
          }
        }
      }
    }

    const rowBandGap = Math.max(spacing.auxGap, ROW_WRAP_GAP);
    const rowOfBlock = new Map<string, number>();
    let rowY = 0;
    wrappedRows.forEach((rowCols, rowIdx) => {
      const colHeights = rowCols.map(
        (c) =>
          c.reduce((s, b) => s + b.height + (b.groups.size === 0 ? b.loopRoom : 0), 0) +
          Math.max(0, c.length - 1) * spacing.rowGap,
      );
      const rowH = Math.max(0, ...colHeights);
      let x = 0;
      rowCols.forEach((c, ci) => {
        const colW = Math.max(0, ...c.map((b) => b.width));
        let y = rowY + (rowH - (colHeights[ci] ?? 0)) / 2;
        for (const b of c) {
          rowOfBlock.set(b.id, rowIdx);
          const extraTop = b.groups.size === 0 ? b.loopRoom : 0;
          const p = pm.get(b.id);
          if (p) {
            p.x = x + (colW - b.width) / 2;
            p.y = y + extraTop;
          }
          y += extraTop + b.height + spacing.rowGap;
        }
        x += colW + spacing.stageGap;
      });
      rowY += rowH + rowBandGap;
    });

    const wrappedFlowCtx = buildFlowContext(
      scopeFlow,
      childOwners,
      preserveFlow,
      true,
      rowOfBlock,
      hClear,
    );
    if (primaryPlaced.length >= 2) {
      const priLinks = buildLinks(doc, primaryPlaced, scopeFlow);
      refreshSegments(priLinks);
      optimizeZoneFlips(
        {
          doc,
          placed: primaryPlaced,
          links: priLinks,
          flow: scopeFlow,
          flowCtx: wrappedFlowCtx,
          rowFilter: 'any',
          fallback: 'score-greedy',
          symmetryGroups: effectiveSymmetryGroups,
        },
        5,
      );
    }

    const allWrappedPlaced: Placed[] = [...primaryPlaced];
    if (auxiliary.length > 0) {
      const auxPlaced: Placed[] = auxiliary.map((block) => ({ block, x: 0, y: 0, flip: 0 }));
      const orderedAux = placeAuxiliaryBlocks(auxPlaced, primaryPlaced, childOwners, scopeFlow, {
        auxMode: 'bands',
        cols: colsCopy,
        sideMode: 'stationY',
        clampMaxSource: true,
        decayStatic: true,
        spacing,
      });
      allWrappedPlaced.push(...auxPlaced);
      const allLinks = buildLinks(doc, allWrappedPlaced, scopeFlow);
      refreshSegments(allLinks);
      optimizeZoneFlips(
        {
          doc,
          placed: allWrappedPlaced,
          links: allLinks,
          flow: scopeFlow,
          flowCtx: wrappedFlowCtx,
          preserveFlowOverride: true,
          rowFilter: 'multi-node',
          fallback: 'score-greedy',
          fallbackTargets: orderedAux,
          symmetryGroups: effectiveSymmetryGroups,
        },
        0,
      );
    }
    return [...allWrappedPlaced, ...placeIsolatedBlocks(trulyIsolated, allWrappedPlaced, spacing)];
  }

  const layoutColumns = () => {
    const colHeights = colsCopy.map(
      (c) =>
        c.reduce((s, b) => s + b.height + (b.groups.size === 0 ? b.loopRoom : 0), 0) +
        Math.max(0, c.length - 1) * spacing.rowGap,
    );
    const tallest = Math.max(0, ...colHeights);
    let x = 0;
    colsCopy.forEach((c, ci) => {
      const colW = Math.max(0, ...c.map((b) => b.width));
      let y = (tallest - (colHeights[ci] ?? 0)) / 2;
      for (const b of c) {
        const extraTop = b.groups.size === 0 ? b.loopRoom : 0;
        const p = pm.get(b.id);
        if (p) {
          p.x = x + (colW - b.width) / 2;
          p.y = y + extraTop;
        }
        y += extraTop + b.height + spacing.rowGap;
      }
      x += colW + spacing.stageGap;
    });
  };

  layoutColumns();

  // Build inter-child neighbor weights for 4 barycenter vertical ordering sweeps.
  const nbrWeights = new Map<string, Array<{ id: string; otherNode: string; w: number }>>();
  for (const c of scopeFlow.connections) {
    const bu = childOwners.get(c.from);
    const bv = childOwners.get(c.to);
    if (!bu || !bv || bu === bv) continue;
    if (scopeFlow.auxiliaryZones.has(bu) || scopeFlow.auxiliaryZones.has(bv)) continue;
    const w = c.role === 'primary' ? 3 : c.role === 'return' ? 0.6 : 0.08;
    pushToMap(nbrWeights, bu, { id: bv, otherNode: c.to, w });
    pushToMap(nbrWeights, bv, { id: bu, otherNode: c.from, w });
  }
  const stationY = (p: Placed, nodeId: string): number => {
    const r = p.block.nodes.get(nodeId);
    return p.y + (r ? r.y + STATION_CENTER : p.block.height / 2);
  };

  for (let sweep = 0; sweep < 4; sweep++) {
    const order =
      sweep % 2 === 0
        ? colsCopy.map((_, ci) => ci)
        : colsCopy.map((_, ci) => colsCopy.length - 1 - ci);
    for (const ci of order) {
      const col = colsCopy[ci];
      if (!col || col.length < 2) continue;
      col.sort((a, b) => {
        const targetY = (id: string): number => {
          let sw = 0;
          let swy = 0;
          for (const { id: nid, otherNode, w } of nbrWeights.get(id) ?? []) {
            if (colIdxOf.get(nid) === ci) continue;
            const np = pm.get(nid);
            if (np) {
              swy += stationY(np, otherNode) * w;
              sw += w;
            }
          }
          return sw > 0 ? swy / sw : Number.POSITIVE_INFINITY;
        };
        const ta = targetY(a.id);
        const tb = targetY(b.id);
        if (Math.abs(ta - tb) > 1e-6) return ta - tb;
        return topoColRank(a.id) - topoColRank(b.id) || compareColumnTie(a, b);
      });
      preservePeerDeclOrder(col);
      layoutColumns();
    }
  }

  // Local refinement of primary children with tighter nested spacing and synchronized sibling flips.
  const flowCtx = buildFlowContext(scopeFlow, childOwners, preserveFlow, false, undefined, hClear);

  if (primaryPlaced.length >= 2) {
    const priLinks = buildLinks(doc, primaryPlaced, scopeFlow);
    refreshSegments(priLinks);
    optimizeZoneFlips(
      {
        doc,
        placed: primaryPlaced,
        links: priLinks,
        flow: scopeFlow,
        flowCtx,
        rowFilter: 'any',
        fallback: 'score-greedy',
        symmetryGroups: effectiveSymmetryGroups,
      },
      5,
    );
    compact(priLinks, primaryPlaced, false, flowCtx, hClear, vClear);
    tighten(priLinks, primaryPlaced, flowCtx, hClear, vClear);
    compact(priLinks, primaryPlaced, false, flowCtx, hClear, vClear);
    straighten(priLinks, primaryPlaced, 200, flowCtx, hClear, vClear);
  }

  // Place auxiliary child zones (e.g. Security & Observability Account inside Region).
  // When an outer primary column is much shorter than a tall middle column, try tucking the
  // auxiliary band into the unused vertical pocket above/below that outer column (zero extra
  // height and zero corridor intrusion) before falling back to a full-width top/bottom band.
  const allActivePlaced: Placed[] = [...primaryPlaced];
  if (auxiliary.length > 0) {
    const auxPlaced: Placed[] = auxiliary.map((block) => ({ block, x: 0, y: 0, flip: 0 }));
    const orderedAux = placeAuxiliaryBlocks(auxPlaced, primaryPlaced, childOwners, scopeFlow, {
      auxMode: 'bands',
      cols: colsCopy,
      sideMode: 'stationY',
      clampMaxSource: true,
      decayStatic: true,
      spacing,
    });
    if (depth >= 1 && colsCopy.length >= 2 && primaryPlaced.length >= 2) {
      const auxGap = spacing.auxGap;
      const auxW =
        auxPlaced.reduce((s, p) => s + p.block.width, 0) +
        Math.max(0, auxPlaced.length - 1) * spacing.horizontalClearance;
      const auxH = Math.max(0, ...auxPlaced.map((p) => p.block.height));
      const priMinY = Math.min(...primaryPlaced.map((p) => p.y));
      const priMaxBot = Math.max(...primaryPlaced.map((p) => p.y + p.block.height));
      const priH = priMaxBot - priMinY;
      const colBounds = colsCopy.map((col) => {
        const items = col.map((b) => pm.get(b.id)).filter((p): p is Placed => p !== undefined);
        const minX = Math.min(...items.map((p) => p.x));
        const maxR = Math.max(...items.map((p) => p.x + p.block.width));
        const minY = Math.min(...items.map((p) => p.y));
        const maxB = Math.max(...items.map((p) => p.y + p.block.height));
        return { items, minX, maxR, minY, maxB, w: maxR - minX, h: maxB - minY };
      });

      // Score candidate corner pockets on the leftmost (0) and rightmost (last) primary columns.
      const auxIds = new Set(auxPlaced.map((p) => p.block.id));
      const auxPeerIds = new Map<string, number>();
      for (const c of scopeFlow.connections) {
        const bu = childOwners.get(c.from);
        const bv = childOwners.get(c.to);
        if (!bu || !bv || bu === bv) continue;
        if (auxIds.has(bu) && !auxIds.has(bv)) {
          auxPeerIds.set(bv, (auxPeerIds.get(bv) ?? 0) + 1);
        } else if (auxIds.has(bv) && !auxIds.has(bu)) {
          auxPeerIds.set(bu, (auxPeerIds.get(bu) ?? 0) + 1);
        }
      }
      // External links into/out of aux blocks bias toward left (ingress) or right (egress) side.
      const auxExtLeft = [...auxIds].reduce((s, id) => s + (extInCount.get(id) ?? 0), 0);
      const auxExtRight = [...auxIds].reduce((s, id) => s + (extOutCount.get(id) ?? 0), 0);

      interface Pocket {
        colIdx: number;
        side: 'top' | 'bottom';
        auxX: number;
        auxY: number;
        colShiftY: number;
        score: number;
      }
      let bestPocket: Pocket | undefined;

      for (const colIdx of [0, colsCopy.length - 1]) {
        const cb = colBounds[colIdx];
        if (!cb || cb.h + auxGap + auxH > priH + 24) continue;
        const nextCb = colIdx === 0 ? colBounds[1] : undefined;
        const prevCb = colIdx === colsCopy.length - 1 ? colBounds[colIdx - 1] : undefined;
        // Center aux over this outer column, keeping horizontal clearance from the adjacent column.
        let auxX = Math.round(cb.minX + (cb.w - auxW) / 2);
        if (nextCb) {
          const maxRight = nextCb.minX - spacing.horizontalClearance;
          if (auxX + auxW > maxRight) auxX = Math.round(maxRight - auxW);
          if (auxX < cb.minX - 40) continue;
        }
        if (prevCb) {
          const minLeft = prevCb.maxR + spacing.horizontalClearance;
          if (auxX < minLeft) auxX = Math.round(minLeft);
          if (auxX + auxW > cb.maxR + 40) continue;
        }
        for (const side of ['top', 'bottom'] as const) {
          const auxY = side === 'top' ? priMinY : priMaxBot - auxH;
          const colShiftY =
            side === 'top'
              ? Math.max(0, auxY + auxH + auxGap - cb.minY)
              : Math.min(0, auxY - auxGap - cb.maxB);
          // Ensure shifted column stays inside the existing primary vertical bounds.
          if (cb.minY + colShiftY < priMinY - 24 || cb.maxB + colShiftY > priMaxBot + 24) {
            continue;
          }
          // Score by Manhattan distance from aux center to connected primary peers + external bias.
          const auxCx = auxX + auxW / 2;
          const auxCy = auxY + auxH / 2;
          let score = 0;
          for (const [peerId, w] of auxPeerIds) {
            const peer = pm.get(peerId);
            if (!peer) continue;
            const py = cb.items.includes(peer) ? peer.y + colShiftY : peer.y;
            score +=
              w *
              (Math.abs(auxCx - (peer.x + peer.block.width / 2)) +
                Math.abs(auxCy - (py + peer.block.height / 2)));
          }
          // Mild preference for top side (matches typical observability/security header band) and external pull.
          if (side === 'bottom') score += 60;
          if (colIdx === 0) score += (auxExtRight - auxExtLeft) * 180;
          else score += (auxExtLeft - auxExtRight) * 180;
          if (!bestPocket || score < bestPocket.score) {
            bestPocket = { colIdx, side, auxX, auxY, colShiftY, score };
          }
        }
      }

      if (bestPocket) {
        const cb = colBounds[bestPocket.colIdx];
        if (cb && bestPocket.colShiftY !== 0) {
          for (const item of cb.items) item.y += bestPocket.colShiftY;
        }
        let x = bestPocket.auxX;
        for (const ap of auxPlaced) {
          ap.x = x;
          ap.y = Math.round(bestPocket.auxY + (auxH - ap.block.height) / 2);
          x += ap.block.width + spacing.horizontalClearance;
        }
      }
    }
    allActivePlaced.push(...auxPlaced);
    const allLinks = buildLinks(doc, allActivePlaced, scopeFlow);
    refreshSegments(allLinks);
    optimizeZoneFlips(
      {
        doc,
        placed: allActivePlaced,
        links: allLinks,
        flow: scopeFlow,
        flowCtx,
        preserveFlowOverride: true,
        rowFilter: 'multi-node',
        fallback: 'score-greedy',
        fallbackTargets: orderedAux,
        symmetryGroups: effectiveSymmetryGroups,
      },
      0,
    );
  }

  return [...allActivePlaced, ...placeIsolatedBlocks(trulyIsolated, allActivePlaced, spacing)];
}

/** Counts descendant nodes under each group ID in `doc`. */
function groupDescendantNodeCount(doc: DavDocument): Map<string, number> {
  const gp = parentMap(doc.groups);
  const counts = new Map<string, number>(doc.groups.map((g) => [g.id, 0]));
  for (const n of doc.nodes) {
    let cur = n.parentId;
    while (cur !== undefined) {
      counts.set(cur, (counts.get(cur) ?? 0) + 1);
      cur = gp.get(cur);
    }
  }
  return counts;
}

/**
 * Splits a parent container's target aspect ratio among its horizontal non-auxiliary group
 * stages proportionally to each stage's descendant node count (`W_s / H = R_parent * N_s / N_all`),
 * so a small peer container (e.g. a 3-node on-prem DC) never starves a dominant 40-node cloud
 * container of horizontal budget, while balanced multi-stage siblings each receive compact budgets.
 */
function childStageTargetAspect(
  parentAspect: number,
  groups: ReadonlyArray<{ id: string }>,
  stageOf: ReadonlyMap<string, number>,
  auxiliaryZones: ReadonlySet<string>,
  descCount: ReadonlyMap<string, number>,
  targetGroupId: string,
): number {
  const stageWeights = new Map<number, number>();
  let totalWeight = 0;
  for (const g of groups) {
    if (auxiliaryZones.has(g.id)) continue;
    const st = stageOf.get(g.id) ?? 0;
    const w = Math.max(1, descCount.get(g.id) ?? 0);
    stageWeights.set(st, (stageWeights.get(st) ?? 0) + w);
    totalWeight += w;
  }
  if (stageWeights.size <= 1 || totalWeight <= 0) return parentAspect;
  if (auxiliaryZones.has(targetGroupId)) {
    return Math.max(MIN_TARGET_ASPECT, parentAspect / stageWeights.size);
  }
  const myStage = stageOf.get(targetGroupId) ?? 0;
  const myWeight = stageWeights.get(myStage) ?? 1;
  return Math.max(
    MIN_TARGET_ASPECT,
    Math.min(parentAspect, parentAspect * (myWeight / totalWeight)),
  );
}

/**
 * Recursively lays out `zoneId` bottom-up: leaf groups use `columnLayout` with header width
 * guarantees, single-child wrappers wrap their child block directly, and composite containers
 * place their direct children via scoped flow stages, auxiliary separation, and sibling symmetry.
 */
export function buildRecursiveZoneBlock(
  doc: DavDocument,
  zoneId: string,
  columnLayout: ColumnLayout,
  fullFlow: FlowAnalysis,
  isAuxiliary = false,
  depth = 0,
  parentHint?: ParentScopeHint,
): Block {
  const directGroups = doc.groups.filter((g) => g.parentId === zoneId);
  const directNodes = doc.nodes.filter((n) => n.parentId === zoneId);

  // Case 0 & 1: Leaf group (no nested child groups).
  if (directGroups.length === 0) {
    // Edge-less auxiliary peer bags with >= 4 nodes lay out as a compact 2D grid instead of a
    // tall 1xN vertical pole so horizontal auxiliary bands stay compact and balanced.
    if (isAuxiliary && directNodes.length >= 4) {
      const idSet = new Set(directNodes.map((n) => n.id));
      const hasIntraEdge = fullFlow.connections.some(
        (c) => c.from !== c.to && idSet.has(c.from) && idSet.has(c.to),
      );
      if (!hasIntraEdge) {
        const pad = GROUP_PADDING;
        const hGap = 36;
        const vGap = 14;
        const group = doc.groups.find((g) => g.id === zoneId);
        const groupLabel = group?.label ?? '';
        const hasIcon = Boolean(group?.icon);
        const nodeLoopRoom = selfLoopRoom({
          steps: doc.steps.map((s) => ({
            ...s,
            animations: s.animations.filter((a) => idSet.has(a.from) && idSet.has(a.to)),
            statics: s.statics.filter((st) => idSet.has(st.from) && idSet.has(st.to)),
          })),
        });
        const loopRoom = Math.max(0, ...nodeLoopRoom.values());
        const cols = Math.min(4, Math.ceil(directNodes.length / 2));
        const rows = Math.ceil(directNodes.length / cols);
        const contentW = cols * NODE_SIZE.width + Math.max(0, cols - 1) * hGap;
        const contentH = rows * NODE_SIZE.height + Math.max(0, rows - 1) * (vGap + loopRoom);
        const rawWidth = contentW + pad * 2;
        const width = Math.max(rawWidth, zoneMinWidth(groupLabel, hasIcon));
        const padLeft = pad + Math.round((width - rawWidth) / 2);
        const head = groupHeaderHeight(groupLabel, width, hasIcon) + pad + loopRoom;
        const height = head + contentH + pad;
        const nodesMap = new Map<string, Rect>();
        directNodes.forEach((n, idx) => {
          const row = Math.floor(idx / cols);
          const col = idx % cols;
          nodesMap.set(n.id, {
            x: padLeft + col * (NODE_SIZE.width + hGap),
            y: head + row * (NODE_SIZE.height + vGap + loopRoom),
            width: NODE_SIZE.width,
            height: NODE_SIZE.height,
          });
        });
        const groupsMap = new Map<string, Rect>([[zoneId, { x: 0, y: 0, width, height }]]);
        const detached = directNodes.map(({ parentId: _p, ...rest }) => rest);
        const { groupsFlipped, reflectConst } = computeFlipMetadata(
          zoneId,
          detached,
          [],
          loopRoom,
          nodesMap,
          groupsMap,
        );
        return {
          id: zoneId,
          width,
          height,
          head,
          contentHeight: contentH,
          loopRoom,
          nodeLoopRoom,
          flippable: loopRoom === 0,
          nodes: nodesMap,
          groups: groupsMap,
          groupsFlipped,
          reflectConst,
        };
      }
    }
    const leafOwners = parentHint?.parentOwners ?? ownersOf(doc);
    const leafFlow: FlowAnalysis = parentHint
      ? {
          ...fullFlow,
          zoneStage: parentHint.parentScopeFlow.zoneStage,
          auxiliaryZones: parentHint.parentScopeFlow.auxiliaryZones,
        }
      : fullFlow;
    const zoneOf = zoneOfGroups(doc.groups);
    // Map only this leaf's direct nodes to `zoneId` so `buildSingleZoneBlock` extracts them cleanly.
    const scopedOwners = new Map(leafOwners);
    for (const n of directNodes) scopedOwners.set(n.id, zoneId);
    return buildSingleZoneBlock(
      doc,
      zoneId,
      columnLayout,
      undefined,
      zoneOf,
      scopedOwners,
      leafFlow,
    );
  }

  // Case 2: Single-child wrapper group (e.g. outer cloud/account wrapping a single child container).
  if (directGroups.length === 1 && directNodes.length === 0 && directGroups[0]) {
    const childBlock = buildRecursiveZoneBlock(
      doc,
      directGroups[0].id,
      columnLayout,
      fullFlow,
      isAuxiliary,
      depth + 1,
      parentHint,
    );
    return wrapPlacedChildren(doc, zoneId, [{ block: childBlock, x: 0, y: 0, flip: 0 }]);
  }

  // Case 3: Composite container with nested child groups.
  const childOwners = mapDescendantOwners(doc, zoneId);
  const childGroupIdSet = new Set(directGroups.map((g) => g.id));
  const childBlockIds = [...directGroups.map((g) => g.id), ...directNodes.map((n) => n.id)].sort(
    compareId,
  );
  const scopeFlow = analyzeScopeFlow(childGroupIdSet, childBlockIds, childOwners, fullFlow);
  const symmetryGroups = detectIsomorphicSiblings(doc, directGroups, fullFlow, scopeFlow);
  const docLoops = selfLoopRoom(doc);

  const descCounts = groupDescendantNodeCount(doc);
  const currentTargetAspect =
    parentHint?.targetAspect ??
    childStageTargetAspect(
      ROOT_TARGET_ASPECT,
      topLevelGroups(doc.groups),
      fullFlow.zoneStage,
      fullFlow.auxiliaryZones,
      descCounts,
      zoneId,
    );

  const rawBlocks: Block[] = [
    ...directGroups.map((cg) =>
      buildRecursiveZoneBlock(
        doc,
        cg.id,
        columnLayout,
        fullFlow,
        scopeFlow.auxiliaryZones.has(cg.id),
        depth + 1,
        {
          parentOwners: childOwners,
          parentScopeFlow: scopeFlow,
          targetAspect: childStageTargetAspect(
            currentTargetAspect,
            directGroups,
            scopeFlow.zoneStage,
            scopeFlow.auxiliaryZones,
            descCounts,
            cg.id,
          ),
        },
      ),
    ),
    ...directNodes.map((dn) => makeNodeBlock(dn.id, docLoops)),
  ];

  // Equalize widths of isomorphic sibling blocks (e.g. AZ-a and AZ-c) when their headers differ slightly.
  const symMaxW = new Map<number, number>();
  const symMinW = new Map<number, number>();
  for (const b of rawBlocks) {
    const sym = symmetryGroups.get(b.id);
    if (sym === undefined) continue;
    symMaxW.set(sym, Math.max(symMaxW.get(sym) ?? 0, b.width));
    symMinW.set(sym, Math.min(symMinW.get(sym) ?? Number.POSITIVE_INFINITY, b.width));
  }
  const childBlocks = rawBlocks.map((b) => {
    const sym = symmetryGroups.get(b.id);
    if (sym === undefined) return b;
    const maxW = symMaxW.get(sym) ?? b.width;
    const minW = symMinW.get(sym) ?? b.width;
    return maxW - minW <= 80 ? widenBlock(b, maxW) : b;
  });

  const placedChildren = placeContainerChildren(
    doc,
    childBlocks,
    childOwners,
    scopeFlow,
    fullFlow,
    symmetryGroups,
    isAuxiliary,
    depth + 1,
    NESTED_SPACING,
    currentTargetAspect,
  );
  return wrapPlacedChildren(doc, zoneId, placedChildren);
}

/**
 * Lays out a single-top-level-group diagram (e.g. `Shoppers -> AWS Cloud { Region { VPC { AZs } } }`)
 * using bottom-up recursive container placement for the top-level group and staged placement
 * alongside any ungrouped top-level nodes.
 */
export function computeSingleTopRecursiveLayout(
  doc: DavDocument,
  columnLayout: ColumnLayout,
): Layout {
  const tops = topLevelGroups(doc.groups);
  const topGroup = tops[0];
  if (!topGroup) return columnLayout(doc);

  const fullFlow = analyzeFlow(doc);
  const owners = ownersOf(doc);
  const docLoops = selfLoopRoom(doc);

  const topBlock = buildRecursiveZoneBlock(doc, topGroup.id, columnLayout, fullFlow, false, 0);
  const ungroupedBlocks = doc.nodes
    .filter((n) => n.parentId === undefined)
    .map((n) => makeNodeBlock(n.id, docLoops));

  const allBlocks = [topBlock, ...ungroupedBlocks];
  const placed = placeContainerChildren(
    doc,
    allBlocks,
    owners,
    fullFlow,
    fullFlow,
    new Map(),
    false,
    0,
    TOP_SPACING,
  );
  return toLayout(placed);
}

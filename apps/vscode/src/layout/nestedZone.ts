import { pushToMap } from '../model/text';
import type { DavDocument } from '../model/types';
import { parentMap, topLevelGroups, zoneOfGroups } from '../model/zones';
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

interface ParentScopeHint {
  parentOwners: ReadonlyMap<string, string>;
  parentScopeFlow: FlowAnalysis;
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
  const groupLabel = doc.groups.find((g) => g.id === zoneId)?.label ?? '';

  if (placed.length === 0) {
    const rawWidth = EMPTY_GROUP_CONTENT.width + pad * 2;
    const width = Math.max(rawWidth, zoneMinWidth(groupLabel));
    const head = groupHeaderHeight(groupLabel, width) + pad;
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
  const width = Math.max(rawWidth, zoneMinWidth(groupLabel));
  const padLeft = pad + Math.round((width - rawWidth) / 2);
  const head = groupHeaderHeight(groupLabel, width) + pad;
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

  // Merge same-step parallel fan-out sibling containers (e.g. Multi-AZ boxes fed in the same
  // step by a shared load balancer/distributor, where one cross-AZ service call pushed AZ-c
  // into stage k+1 behind AZ-a) into a single vertical stage column to avoid wide ribbons and
  // corridor jumps across the sibling AZ.
  if (depth >= 1 && columns.length >= 2) {
    const firstStepByDirPair = new Map<string, number>();
    const hasStaticBetween = new Set<string>();
    for (const c of scopeFlow.connections) {
      const bu = childOwners.get(c.from);
      const bv = childOwners.get(c.to);
      if (!bu || !bv || bu === bv) continue;
      if (c.role === 'primary') {
        const fs = fullFlow.pairFirstStep.get(flowPairKey(c.from, c.to)) ?? 0;
        const dk = `${bu}\0${bv}`;
        const prev = firstStepByDirPair.get(dk);
        if (prev === undefined || fs < prev) firstStepByDirPair.set(dk, fs);
      } else if (c.role === 'static') {
        hasStaticBetween.add(flowPairKey(bu, bv));
      }
    }
    const directChildGroupCount = (gid: string): number =>
      doc.groups.filter((g) => g.parentId === gid).length;

    let ci = 0;
    while (ci + 1 < columns.length) {
      const colA = columns[ci];
      const colB = columns[ci + 1];
      if (!colA || !colB || colA.length !== 1 || colB.length !== 1) {
        ci++;
        continue;
      }
      const a = colA[0];
      const b = colB[0];
      const isLast = ci + 1 === columns.length - 1;
      if (
        !a ||
        !b ||
        !isLast ||
        a.groups.size <= 1 ||
        b.groups.size <= 1 ||
        directChildGroupCount(a.id) !== directChildGroupCount(b.id)
      ) {
        ci++;
        continue;
      }
      // Check for a shared upstream distributor `p` feeding BOTH `a` and `b` in the same step.
      const sharedParallelParent = columns.slice(0, ci).some((prevCol) =>
        prevCol.some((p) => {
          const sa = firstStepByDirPair.get(`${p.id}\0${a.id}`);
          const sb = firstStepByDirPair.get(`${p.id}\0${b.id}`);
          return sa !== undefined && sb !== undefined && sa === sb;
        }),
      );
      if (sharedParallelParent && hasStaticBetween.has(flowPairKey(a.id, b.id))) {
        colA.push(b);
        columns.splice(ci + 1, 1);
        scopeFlow.zoneStage.set(b.id, scopeFlow.zoneStage.get(a.id) ?? ci);
      } else {
        ci++;
      }
    }
  }

  // Stack a wide later-step secondary feeder pipeline (col 0) vertically beneath an earlier-step
  // primary ingress container (col 1) so the Step-1 main ingress from outside stays unobstructed.
  if (depth >= 1 && columns.length >= 2) {
    const c0 = columns[0];
    const c1 = columns[1];
    const b0 = c0?.length === 1 ? c0[0] : undefined;
    const b1 = c1?.length === 1 ? c1[0] : undefined;
    const b0Step = b0 ? blockFirstPriStep.get(b0.id) : undefined;
    const b1ExtStep = b1 ? extPriInFirstStep.get(b1.id) : undefined;
    if (
      b0 &&
      b1 &&
      b0.groups.size >= 1 &&
      b1.groups.size >= 1 &&
      b0.width >= 500 &&
      b1.width >= 500 &&
      b0Step !== undefined &&
      b1ExtStep !== undefined &&
      b0Step > b1ExtStep
    ) {
      c1.push(b0);
      columns.splice(0, 1);
      scopeFlow.zoneStage.set(b0.id, scopeFlow.zoneStage.get(b1.id) ?? 0);
    }
  }

  // Equalize outer widths and internal subnet-column grids for structurally similar sibling
  // containers stacked in the same stage column (e.g. AZ-a and AZ-c inside a VPC).
  if (depth >= 1) {
    for (const col of columns) alignStackedSiblingColumns(doc, col);
  }

  // Nested wide-2-stage parallel-ingress stacking: when two wide multi-column sub-groups inside
  // a nested account/container BOTH receive external primary ingress (e.g. Workload VPC + Partner API,
  // or Analytics VPC + Lakehouse), stack them vertically to eliminate ribbon sprawl while keeping
  // both entry points on the left boundary.
  const canStackWideTwoStage = (() => {
    if (depth < 1 || auxiliary.length > 0 || columns.length !== 2) return false;
    const c0 = columns[0];
    const c1 = columns[1];
    if (!c0 || !c1 || c0.length !== 1 || c1.length !== 1) return false;
    const b0 = c0[0];
    const b1 = c1[0];
    if (!b0 || !b1 || b0.groups.size === 0 || b1.groups.size === 0) return false;
    if (b0.width < 500 || b1.width < 500) return false;
    const horizW = b0.width + spacing.stageGap + b1.width;
    const horizH = Math.max(b0.height, b1.height);
    if (horizW <= 1400 || horizW / Math.max(1, horizH) <= 2.2) return false;
    return (extPriInCount.get(b1.id) ?? 0) > 0;
  })();

  if (canStackWideTwoStage && columns[0]?.[0] && columns[1]?.[0]) {
    const b0 = columns[0][0];
    const b1 = columns[1][0];
    const stacked: Placed[] = [
      { block: b0, x: 0, y: 0, flip: 0 },
      { block: b1, x: 0, y: b0.height + spacing.rowGap, flip: 0 },
    ];
    return [...stacked, ...placeIsolatedBlocks(trulyIsolated, stacked, spacing)];
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
  for (const col of colsCopy) {
    if (col.length < 2) continue;
    col.sort(
      (a, b) =>
        topoColRank(a.id) - topoColRank(b.id) ||
        (primaryOutDeg.get(a.id) ?? 0) - (primaryOutDeg.get(b.id) ?? 0) ||
        compareColumnTie(a, b),
    );
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
      layoutColumns();
    }
  }

  // Local refinement of primary children with tighter nested spacing and synchronized sibling flips.
  const preserveFlow = scopeFlow.hasAnimate;
  const hClear = spacing.horizontalClearance;
  const vClear = spacing.verticalClearance;
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
        symmetryGroups,
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
        symmetryGroups,
      },
      0,
    );
  }

  return [...allActivePlaced, ...placeIsolatedBlocks(trulyIsolated, allActivePlaced, spacing)];
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
        const groupLabel = doc.groups.find((g) => g.id === zoneId)?.label ?? '';
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
        const width = Math.max(rawWidth, zoneMinWidth(groupLabel));
        const padLeft = pad + Math.round((width - rawWidth) / 2);
        const head = groupHeaderHeight(groupLabel, width) + pad + loopRoom;
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

  const hint: ParentScopeHint = { parentOwners: childOwners, parentScopeFlow: scopeFlow };
  const rawBlocks: Block[] = [
    ...directGroups.map((cg) =>
      buildRecursiveZoneBlock(
        doc,
        cg.id,
        columnLayout,
        fullFlow,
        scopeFlow.auxiliaryZones.has(cg.id),
        depth + 1,
        hint,
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

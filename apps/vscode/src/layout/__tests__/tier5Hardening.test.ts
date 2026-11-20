import { beforeEach, describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { synthesizedConnections } from '../../model/connections';
import { pushToMap } from '../../model/text';
import type { DavDocument } from '../../model/types';
import { parentMap, topLevelGroups, zoneOfGroups } from '../../model/zones';
import { computeColumnLayout } from '../columns';
import { analyzeFlow, type FlowAnalysis } from '../flow';
import {
  adoptZonePlan,
  backEdgesOf,
  computeLayout,
  countCrossings,
  type Layout,
  NODE_SIZE,
  pendingZoneSearch,
  type Rect,
  rectContains,
  rectOverlaps,
  STATION_SIZE,
  stationRect,
  WINDOW_SIZE,
  zonesPlacedFreely,
} from '../index';
import { crossingsOf, linksOf, primaryCrossingsOf, type Segment } from '../links';
import { enclosingRect, STATION_CENTER, selfLoopRoom } from '../metrics';
import { computeRanks } from '../ranks';
import { straightenNodes } from '../straightenNodes';
import {
  type Block,
  buildBlocks,
  buildSingleZoneBlock,
  HORIZONTAL_CLEARANCE,
  type Placed,
  partitionIsolatedBlocks,
  placeAuxiliaryBlocks,
  prepareMacroGrid,
  shouldPreserveFlow,
  stageColumns,
  toLayout,
  VERTICAL_CLEARANCE,
  wrapStageColumns,
} from '../zoneBlocks';
import {
  alignEdges,
  CHOSEN_STRAIGHT_WORTH,
  eliminateShortJogs,
  restoreStageBreathingRoom,
  straighten,
} from '../zoneFinish';
import {
  buildZoneSlackMeta,
  cloneBlockNodes,
  nodeOrderOf,
  optimizeZoneFlips,
  optimizeZoneSlackRanks,
  polishZoneCoordinates,
  refineZoneNodeOrder,
} from '../zoneRefine';
import {
  buildFlowContext,
  buildLinks,
  createFastCrossingEvaluator,
  evaluateMove,
  isClear,
  linkCost,
  refreshSegments,
  runsThrough,
  wallDetourCount,
} from '../zoneScore';

function assertValidLayout(doc: DavDocument, layout: Layout): void {
  const loops = selfLoopRoom(doc);
  const nodeVisual = (id: string, r: Rect): Rect => {
    const room = loops.get(id) ?? 0;
    return { x: r.x, y: r.y - room, width: r.width, height: r.height + room };
  };
  for (const n of doc.nodes) {
    const r = layout.nodes[n.id];
    expect(r, `missing node ${n.id}`).toBeDefined();
    if (!r) continue;
    expect(Number.isFinite(r.x) && Number.isFinite(r.y)).toBe(true);
    expect(r.width).toBeGreaterThan(0);
    expect(r.height).toBeGreaterThan(0);
    if (n.parentId) {
      const g = layout.groups[n.parentId];
      expect(g, `missing parent group ${n.parentId}`).toBeDefined();
      if (g) expect(rectContains(g, nodeVisual(n.id, r))).toBe(true);
    }
  }
  for (const g of doc.groups) {
    const r = layout.groups[g.id];
    expect(r, `missing group ${g.id}`).toBeDefined();
    if (!r) continue;
    expect(Number.isFinite(r.x) && Number.isFinite(r.y)).toBe(true);
    if (g.parentId) {
      const p = layout.groups[g.parentId];
      expect(p, `missing parent group ${g.parentId}`).toBeDefined();
      if (p) expect(rectContains(p, r)).toBe(true);
    }
  }
  for (let i = 0; i < doc.nodes.length; i++) {
    const a = doc.nodes[i];
    if (!a) continue;
    const ra = layout.nodes[a.id];
    if (!ra) continue;
    const va = nodeVisual(a.id, ra);
    for (let j = i + 1; j < doc.nodes.length; j++) {
      const b = doc.nodes[j];
      if (!b) continue;
      const rb = layout.nodes[b.id];
      if (!rb) continue;
      expect(rectOverlaps(va, nodeVisual(b.id, rb)), `${a.id} overlaps ${b.id}`).toBe(false);
    }
  }
  const topIds = topLevelGroups(doc.groups).map((g) => g.id);
  for (let i = 0; i < topIds.length; i++) {
    const a = topIds[i];
    if (!a) continue;
    const ra = layout.groups[a];
    if (!ra) continue;
    for (let j = i + 1; j < topIds.length; j++) {
      const b = topIds[j];
      if (!b) continue;
      const rb = layout.groups[b];
      if (!rb) continue;
      expect(rectOverlaps(ra, rb), `top groups ${a} and ${b} overlap`).toBe(false);
    }
  }
}

describe('Tier 5 adversarial hardening: Challenger #1 (T5-A1..T5-A11)', () => {
  beforeEach(() => adoptZonePlan('', undefined));

  it('T5-A1: solveStagedPipeline propagates rightward clearance transitively across aux->primary chains', () => {
    const doc = parse(`
group p0 "P0" { node n0 }
group p1 "P1" { node n1 }
group p2 "P2" { node n2 }
group p3 "P3" { node n3 }
group aux "Aux" { node a0; node a1; node a2; node a3; node a4; node a5 }
step "S0" {
  animate n3 --> n1
  animate n1 --> a1
  animate a0 --> n0
  animate n0 --> n2
  static a2 --> n2
  static a3 --> n3
  static a4 --> n1
  static a5 --> n0
}
`).document;
    const layout = computeLayout(doc);
    assertValidLayout(doc, layout);

    const flow = analyzeFlow(doc);
    const primaryLinks = flow.connections.filter((c) => c.role === 'primary');
    expect(primaryLinks.length).toBeGreaterThanOrEqual(4);
    for (const c of primaryLinks) {
      const src = layout.nodes[c.from];
      const dst = layout.nodes[c.to];
      expect(src && dst).toBeTruthy();
      if (src && dst) {
        expect(dst.x, `${c.from} -> ${c.to} must point right`).toBeGreaterThan(src.x);
      }
    }
  });

  it('T5-A2: straighten resolves 15px jog under corridorReturnBiasY in single-block mode', () => {
    const doc = parse(`
group z0 "Z0" { node a0; node a1 }
group z1 "Z1" { node b0; node b1 }
step "S0" {
  animate a0 --> b0
  animate b0 --> a1
}
`).document;
    const flow = analyzeFlow(doc);
    const { blocks, owners } = buildBlocks(doc, computeColumnLayout, undefined, flow);
    const placed: Placed[] = [
      { block: blocks[0] as Block, x: 0, y: 0, flip: 0 },
      { block: blocks[1] as Block, x: 400, y: 15, flip: 0 },
    ];
    const ctx = buildFlowContext(flow, owners, true, false);
    const links = buildLinks(doc, placed, flow);
    refreshSegments(links);

    const primaryLink = links.find((l) => l.role === 'primary');
    expect(primaryLink).toBeDefined();
    expect(Math.abs((primaryLink?.ay ?? 0) - (primaryLink?.by ?? 0))).toBe(15);

    straighten(links, placed, CHOSEN_STRAIGHT_WORTH, ctx);
    refreshSegments(links);
    expect(placed[0]?.y).toBe(12);
    expect(Math.abs((primaryLink?.by ?? 0) - ((primaryLink?.ay ?? 0) + 3))).toBeLessThan(0.5);
    expect(Math.abs((primaryLink?.ay ?? 0) - (primaryLink?.by ?? 0))).toBeLessThanOrEqual(3);
  });

  it('T5-A3: runsThrough uses exact Liang-Barsky clipping on long links and boundary cases', () => {
    const doc = parse(`
group z0 "Z0" { node a0 }
group z1 "Z1" { node b0 }
group z2 "Z2" { node c0 }
step "S0" {
  animate a0 --> c0
}
`).document;
    const flow = analyzeFlow(doc);
    const { blocks } = buildBlocks(doc, computeColumnLayout, undefined, flow);
    const placed: Placed[] = [
      { block: blocks[0] as Block, x: 0, y: 0, flip: 0 },
      { block: blocks[1] as Block, x: 420, y: 0, flip: 0 },
      { block: blocks[2] as Block, x: 2000, y: 0, flip: 0 },
    ];
    const links = buildLinks(doc, placed, flow);
    refreshSegments(links);
    const link = links[0];
    expect(link).toBeDefined();
    if (!link) return;
    expect(runsThrough(link, placed[1] as Placed)).toBe(true);

    // Segment touching only the top boundary or grazing a corner must not count as running through.
    const z1 = placed[1] as Placed;
    const topEdgeLink = { ...link, ax: 0, ay: z1.y, bx: 2000, by: z1.y, minY: z1.y, maxY: z1.y };
    expect(runsThrough(topEdgeLink, z1)).toBe(false);

    const endAtLeftLink = {
      ...link,
      ax: 0,
      ay: z1.y + 40,
      bx: z1.x,
      by: z1.y + 40,
      minX: 0,
      maxX: z1.x,
      minY: z1.y + 40,
      maxY: z1.y + 40,
    };
    expect(runsThrough(endAtLeftLink, z1)).toBe(false);
  });

  it('T5-A4: tall stage columns split into sub-columns when unsplit aspect < 1.35', () => {
    const doc = parse(`
group hub "Hub" { node h0; node h1 }
group s0 "S0" { node s0a; node s0b }
group s1 "S1" { node s1a; node s1b }
group s2 "S2" { node s2a; node s2b }
group s3 "S3" { node s3a; node s3b }
group tail "Tail" { node t0; node t1 }
step "S0" {
  animate h0 --> s0a
  animate h0 --> s1a
  static s0b ..> t0
  static s1b ..> t0
  static h1 ..> s2a
  static h1 ..> s3a
  animate s2b --> t1
  animate s3b --> t1
}
`).document;
    const layout = computeLayout(doc);
    assertValidLayout(doc, layout);
    const xs = ['s0', 's1', 's2', 's3'].map((id) => layout.groups[id]?.x ?? -1);
    expect(new Set(xs).size).toBe(2);
    const hubX = layout.groups.hub?.x ?? 0;
    const tailX = layout.groups.tail?.x ?? 0;
    for (const x of xs) {
      expect(x).toBeGreaterThan(hubX);
      expect(x).toBeLessThan(tailX);
    }

    const fanDoc = parse(`
group root "Root" { node r }
${Array.from({ length: 12 }, (_, i) => `group g${i} "G${i}" { node n${i} }`).join('\n')}
step "Fan" {
  ${Array.from({ length: 12 }, (_, i) => `animate r --> n${i}`).join('\n  ')}
}
`).document;
    const fanLayout = computeLayout(fanDoc);
    assertValidLayout(fanDoc, fanLayout);
    const leafXs = Array.from({ length: 12 }, (_, i) => fanLayout.groups[`g${i}`]?.x ?? 0);
    expect(new Set(leafXs).size).toBeGreaterThanOrEqual(2);
  });

  it("T5-A5: 'right-top' auxiliary pocket placement and clearance fallback", () => {
    const doc = parse(`
group z0 "Z0" { node n0 }
group z1 "Z1" { node n1 }
group z2 "Z2" { node n2 }
group aux "Aux" { node a0; node a1; node a2 }
step "S0" {
  animate n0 --> n1
  animate n1 --> n2
  static n1 ..> a1
  static n2 ..> a2
}
step "S1" {
  animate n1 --> a0
}
step "S2" {
  animate a0 --> n2
}
`).document;
    const layout = computeLayout(doc);
    assertValidLayout(doc, layout);

    const directDoc = parse(`
group z0 "Z0" { node n0 }
group z1 "Z1" { node n1 }
group z2 "Z2" { node n2 }
group aux "Aux" { node a0; node a1; node a2 }
step "S0" {
  animate n0 --> n1
  animate n1 --> n2
  static n1 ..> a1
  static n2 ..> a2
}
step "S1" {
  animate n2 --> a0
}
step "S2" {
  animate a0 --> n2
}
`).document;
    const flow = analyzeFlow(directDoc);
    const { blocks, owners } = buildBlocks(directDoc, computeColumnLayout, undefined, flow);
    const byId = new Map(blocks.map((b) => [b.id, b]));
    const pri: Placed[] = [
      { block: byId.get('z0') as Block, x: 0, y: 100, flip: 0 },
      { block: byId.get('z1') as Block, x: 500, y: -80, flip: 0 },
      { block: byId.get('z2') as Block, x: 600, y: 100, flip: 0 },
    ];
    const aux: Placed[] = [{ block: byId.get('aux') as Block, x: 0, y: 0, flip: 0 }];
    placeAuxiliaryBlocks(aux, pri, owners, flow, {
      auxMode: 'right-top',
      cols: [[byId.get('z0') as Block], [byId.get('z1') as Block], [byId.get('z2') as Block]],
      sideMode: 'stationY',
      clampMaxSource: true,
      decayStatic: true,
    });
    const auxPlaced = aux[0] as Placed;
    const z2Placed = pri[2] as Placed;
    expect(auxPlaced.x).toBe(z2Placed.x);
    expect(auxPlaced.y + auxPlaced.block.height + 44).toBe(z2Placed.y);
    expect(isClear(auxPlaced, [...pri, ...aux])).toBe(true);

    // Multi-block final stage skips pocket and pushes aux to trailing right column.
    const auxMulti: Placed[] = [{ block: byId.get('aux') as Block, x: 0, y: 0, flip: 0 }];
    const z1Placed = pri[1] as Placed;
    z1Placed.x = 600;
    z1Placed.y = 300;
    placeAuxiliaryBlocks(auxMulti, pri, owners, flow, {
      auxMode: 'right-top',
      cols: [[byId.get('z0') as Block], [byId.get('z1') as Block, byId.get('z2') as Block]],
      sideMode: 'stationY',
      clampMaxSource: true,
      decayStatic: true,
    });
    expect(auxMulti[0]?.x).toBeGreaterThanOrEqual(z2Placed.x + z2Placed.block.width + 60);
    expect(isClear(auxMulti[0] as Placed, [...pri, ...auxMulti])).toBe(true);
  });

  it('T5-A6: polishZoneCoordinates preserves auxiliary band clearance >= VERTICAL_CLEARANCE + 24', () => {
    const doc = parse(`
group z0 "Z0" { node n0; node n1 }
group z1 "Z1" { node m0; node m1 }
group z2 "Z2" { node k0; node k1 }
group aux "Aux" { node a0; node a1 }
step "S0" {
  animate n0 --> m0
  animate m0 --> k0
  animate n1 --> m1
  animate m1 --> k1
  static m0 ..> a0
  static k0 ..> a1
}
`).document;
    const flow = analyzeFlow(doc);
    const { blocks, owners } = buildBlocks(doc, computeColumnLayout, undefined, flow);
    const byId = new Map(blocks.map((b) => [b.id, b]));
    const priPlaced: Placed[] = [
      { block: byId.get('z0') as Block, x: 0, y: 200, flip: 0 },
      { block: byId.get('z1') as Block, x: 300, y: 200, flip: 0 },
      { block: byId.get('z2') as Block, x: 600, y: 200, flip: 0 },
    ];
    const auxBlock = byId.get('aux') as Block;
    const auxPlaced: Placed = {
      block: auxBlock,
      x: 300,
      y: 200 - auxBlock.height - (VERTICAL_CLEARANCE + 24),
      flip: 0,
    };
    const allPlaced = [...priPlaced, auxPlaced];
    const flowCtx = buildFlowContext(flow, owners, true, false);
    const links = buildLinks(doc, allPlaced, flow);
    refreshSegments(links);

    polishZoneCoordinates(
      allPlaced,
      links,
      linksOf(doc),
      flow,
      flowCtx,
      { polishSteps: [64, 32, 16], polishPasses: 2 },
      HORIZONTAL_CLEARANCE,
      true,
    );

    const priMinY = Math.min(...priPlaced.map((p) => p.y));
    expect(auxPlaced.y + auxPlaced.block.height).toBeLessThanOrEqual(
      priMinY - (VERTICAL_CLEARANCE + 24),
    );
    expect(isClear(auxPlaced, allPlaced)).toBe(true);
  });

  it('T5-A7: optimizeZoneSlackRanks handles nested frames and coupledSwapPasses resolves crossings at flip=0 & flip=1', () => {
    const slackDoc = parse(`
group z0 "Z0" {
  group inner "Inner" {
    node a
    node b
    node c
  }
  node s
}
group z1 "Z1" { node t }
step "S0" {
  animate a --> b
  animate b --> c
  animate a --> s
  animate s --> t
  animate c --> t
}
`).document;
    const slackFlow = analyzeFlow(slackDoc);
    const slackBuilt = buildBlocks(slackDoc, computeColumnLayout, undefined, slackFlow);
    const slackPlaced: Placed[] = slackBuilt.blocks.map((b, i) => ({
      block: cloneBlockNodes(b),
      x: i * 1000,
      y: 0,
      flip: 0,
    }));
    const connConns = synthesizedConnections(slackDoc);
    const adj = new Map<string, string[]>();
    for (const e of connConns) {
      if (e.from === e.to) continue;
      pushToMap(adj, e.from, e.to);
      pushToMap(adj, e.to, e.from);
    }
    const slackMeta = buildZoneSlackMeta(
      slackDoc,
      connConns,
      slackBuilt.blocks,
      slackFlow,
      slackBuilt.owners,
      adj,
    );
    const baseOrders = new Map(slackBuilt.blocks.map((b) => [b.id, nodeOrderOf(b.nodes)]));
    const flowCtx = buildFlowContext(slackFlow, slackBuilt.owners, true, false);
    const ranks = optimizeZoneSlackRanks(
      slackDoc,
      computeColumnLayout,
      slackPlaced,
      slackBuilt.owners,
      zoneOfGroups(slackDoc.groups),
      parentMap(slackDoc.nodes),
      adj,
      baseOrders,
      slackMeta,
      new Map(),
      slackFlow,
      flowCtx,
      { slackRanks: true },
    );
    const lay = toLayout(slackPlaced);
    expect(lay.groups.z0 && lay.groups.inner && lay.nodes.s).toBeTruthy();
    if (lay.groups.z0 && lay.groups.inner && lay.nodes.s) {
      expect(rectContains(lay.groups.z0, lay.groups.inner)).toBe(true);
      expect(rectContains(lay.groups.z0, lay.nodes.s)).toBe(true);
      expect(rectOverlaps(lay.groups.inner, lay.nodes.s)).toBe(false);
    }
    expect(ranks.get('z0')?.s).toBe(2);

    // Coupled pair swap inside z0 at both flip=0 and flip=1.
    const swapDoc = parse(`
group z0 "Z0" { node a0; node a1; node b0; node b1 }
group z1 "Z1" { node c0; node c1 }
step "S0" {
  animate a0 --> b0
  animate a1 --> b1
  animate b0 --> c1
  animate b1 --> c0
}
`).document;
    for (const flip of [0, 1] as const) {
      const f = analyzeFlow(swapDoc);
      const built = buildBlocks(swapDoc, computeColumnLayout, undefined, f);
      const placed: Placed[] = built.blocks.map((b, i) => ({
        block: cloneBlockNodes(b),
        x: i * 500,
        y: 0,
        flip,
      }));
      const swapAdj = new Map<string, string[]>();
      for (const e of synthesizedConnections(swapDoc)) {
        if (e.from === e.to) continue;
        pushToMap(swapAdj, e.from, e.to);
        pushToMap(swapAdj, e.to, e.from);
      }
      const beforeCross = countCrossings(swapDoc, toLayout(placed));
      expect(beforeCross).toBe(1);
      const changed = refineZoneNodeOrder(
        placed,
        parentMap(swapDoc.nodes),
        built.owners,
        swapAdj,
        linksOf(swapDoc),
        { orderSweeps: 2, verticalSwapPasses: 0, coupledSwapPasses: 1 },
        f,
      );
      expect(changed).toBe(true);
      expect(countCrossings(swapDoc, toLayout(placed))).toBe(0);
    }
  });

  it('T5-A8: optimizeZoneFlips resolves coupled pairs at cap=7 via bitmask and completes deterministically at n=8', () => {
    const makeChain = (n: number) => {
      const groups = Array.from(
        { length: n },
        (_, i) => `group z${i} "Z${i}" { node n${i}a; node n${i}b }`,
      ).join('\n');
      const links: string[] = [];
      for (let i = 0; i < n - 1; i++) {
        links.push(`  animate n${i}a --> n${i + 1}a`);
        links.push(`  animate n${i}b --> n${i + 1}b`);
      }
      return parse(`${groups}\nstep "S" {\n${links.join('\n')}\n}`).document;
    };

    const doc7 = makeChain(7);
    const f7 = analyzeFlow(doc7);
    const b7 = buildBlocks(doc7, computeColumnLayout, undefined, f7);
    const p7: Placed[] = b7.blocks.map((b, i) => ({
      block: cloneBlockNodes(b),
      x: i * 320,
      y: 0,
      flip: i === 2 || i === 3 ? 1 : 0,
    }));
    const ctx7 = buildFlowContext(f7, b7.owners, true, false);
    const links7 = buildLinks(doc7, p7, f7);
    const flipped7 = optimizeZoneFlips(
      { doc: doc7, placed: p7, links: links7, flow: f7, flowCtx: ctx7, fallback: 'score-greedy' },
      7,
    );
    expect(flipped7).toBe(true);
    expect(countCrossings(doc7, toLayout(p7))).toBe(0);

    const doc8 = makeChain(8);
    const f8 = analyzeFlow(doc8);
    const b8 = buildBlocks(doc8, computeColumnLayout, undefined, f8);
    const p8: Placed[] = b8.blocks.map((b, i) => ({
      block: cloneBlockNodes(b),
      x: i * 320,
      y: 0,
      flip: i === 2 || i === 3 ? 1 : 0,
    }));
    const ctx8 = buildFlowContext(f8, b8.owners, true, false);
    const links8 = buildLinks(doc8, p8, f8);
    optimizeZoneFlips(
      { doc: doc8, placed: p8, links: links8, flow: f8, flowCtx: ctx8, fallback: 'score-greedy' },
      7,
    );
    const l8 = toLayout(p8);
    assertValidLayout(doc8, l8);
  });

  it('T5-A9: alignEdges wallsOk guard, restoreStageBreathingRoom aux shift, and eliminateShortJogs on nested zones', () => {
    // (a) alignEdges must not increase wallDetourCount.
    const wallDoc = parse(`
group z0 "Z0" { node a0 }
group z1 "Z1" { node b0 }
group z2 "Z2" { node c0 }
step "S0" {
  animate a0 --> c0
  animate a0 --> b0
}
`).document;
    const wf = analyzeFlow(wallDoc);
    const wb = buildBlocks(wallDoc, computeColumnLayout, undefined, wf);
    const wp: Placed[] = [
      { block: wb.blocks[0] as Block, x: 0, y: 0, flip: 0 },
      { block: wb.blocks[1] as Block, x: 300, y: 185, flip: 0 },
      { block: wb.blocks[2] as Block, x: 600, y: 60, flip: 0 },
    ];
    const wCtx = buildFlowContext(wf, wb.owners, true, false);
    const wLinks = buildLinks(wallDoc, wp, wf);
    refreshSegments(wLinks);
    const wallsBefore = wallDetourCount(wLinks, wp, wCtx);
    alignEdges(wLinks, wp, wCtx);
    expect(wallDetourCount(wLinks, wp, wCtx)).toBeLessThanOrEqual(wallsBefore);

    // (b) restoreStageBreathingRoom shifts trailing primary and straddling aux zones together.
    const breatheDoc = parse(`
group z0 "Z0" { node a0 }
group z1 "Z1" { node b0 }
group aux "Aux" { node ax }
step "S0" {
  animate a0 --> b0
  static a0 ..> ax
  static b0 ..> ax
}
`).document;
    const bf = analyzeFlow(breatheDoc);
    const bb = buildBlocks(breatheDoc, computeColumnLayout, undefined, bf);
    const byId = new Map(bb.blocks.map((b) => [b.id, b]));
    const bp: Placed[] = [
      { block: byId.get('z0') as Block, x: 0, y: 200, flip: 0 },
      { block: byId.get('z1') as Block, x: 268, y: 200, flip: 0 },
      { block: byId.get('aux') as Block, x: 210, y: 0, flip: 0 },
    ];
    const bCtx = buildFlowContext(bf, bb.owners, true, false);
    restoreStageBreathingRoom(bp, bCtx, 98);
    expect(bp[1]?.x).toBe(306);
    expect(bp[2]?.x).toBe(248);

    // (c) eliminateShortJogs removes 18px offset on nested zones.
    const jogDoc = parse(`
group z0 "Z0" { group g0 "G0" { node a0 }; node a1 }
group z1 "Z1" { group g1 "G1" { node b0 }; node b1 }
step "S0" {
  animate a0 --> b0
  animate a1 --> b1
}
`).document;
    const jf = analyzeFlow(jogDoc);
    const jb = buildBlocks(jogDoc, computeColumnLayout, undefined, jf);
    const jp: Placed[] = [
      { block: jb.blocks[0] as Block, x: 0, y: 0, flip: 0 },
      { block: jb.blocks[1] as Block, x: 400, y: 18, flip: 0 },
    ];
    const jCtx = buildFlowContext(jf, jb.owners, true, false);
    const jLinks = buildLinks(jogDoc, jp, jf);
    refreshSegments(jLinks);
    eliminateShortJogs(jLinks, jp, 900, jCtx);
    refreshSegments(jLinks);
    expect(Math.abs((jLinks[0]?.ay ?? 0) - (jLinks[0]?.by ?? 0))).toBeLessThan(0.5);
  });

  it('T5-A10: straightenNodes respects REACH=60/61, NEAR_LEVEL=12/13, primary dx>0 guard, and GROUP_GAP=28', () => {
    const simpleDoc = parse(`
node a
node b
step "S" { animate a --> b }
`).document;
    const mkRect = (x: number, y: number): Rect => ({ x, y, ...NODE_SIZE });

    // REACH boundary: 60 moves, 61 stays.
    const r60 = straightenNodes(simpleDoc, {
      nodes: { a: mkRect(40, 40), b: mkRect(300, 100) },
      groups: {},
    });
    expect(r60.nodes.a?.y === 100 || r60.nodes.b?.y === 40).toBe(true);
    const r61 = straightenNodes(simpleDoc, {
      nodes: { a: mkRect(40, 40), b: mkRect(300, 101) },
      groups: {},
    });
    expect(r61.nodes.a?.y).toBe(40);
    expect(r61.nodes.b?.y).toBe(101);

    // NEAR_LEVEL boundary: 12 stays, 13 moves.
    const n12 = straightenNodes(simpleDoc, {
      nodes: { a: mkRect(40, 40), b: mkRect(300, 52) },
      groups: {},
    });
    expect(n12.nodes.a?.y).toBe(40);
    expect(n12.nodes.b?.y).toBe(52);
    const n13 = straightenNodes(simpleDoc, {
      nodes: { a: mkRect(40, 40), b: mkRect(300, 53) },
      groups: {},
    });
    expect(n13.nodes.a?.y === n13.nodes.b?.y).toBe(true);

    // Inter-zone primary dx>0 guard: vertical alignment candidate (dx=40) must not collapse a.x >= b.x.
    const zoneDoc = parse(`
group z0 "Z0" { node a }
group z1 "Z1" { node b }
step "S" { animate a --> b }
`).document;
    const guardLay = straightenNodes(zoneDoc, {
      nodes: { a: mkRect(56, 56), b: mkRect(96, 260) },
      groups: {
        z0: { x: 40, y: 40, width: 400, height: 200 },
        z1: { x: 80, y: 244, width: 220, height: 150 },
      },
    });
    expect(guardLay.nodes.a?.x).toBeLessThan(guardLay.nodes.b?.x ?? 0);

    // Nested sibling GROUP_GAP = 28 inside outer frame.
    const nestedDoc = parse(`
group outer "Outer" {
  node o0
  group inner "Inner" { node i0 }
}
group far "Far" { node f0 }
step "S" {
  animate o0 --> f0
  static i0 ..> f0
}
`).document;
    const nestedLay = straightenNodes(nestedDoc, {
      nodes: {
        o0: mkRect(56, 74),
        i0: mkRect(72, 266),
        f0: mkRect(400, 114),
      },
      groups: {
        outer: { x: 40, y: 40, width: 240, height: 376 },
        inner: { x: 56, y: 232, width: 208, height: 168 },
        far: { x: 384, y: 80, width: 208, height: 168 },
      },
    });
    const o0 = nestedLay.nodes.o0 as Rect;
    const inner = nestedLay.groups.inner as Rect;
    const outer = nestedLay.groups.outer as Rect;
    expect(rectContains(outer, o0)).toBe(true);
    expect(o0.y + o0.height + 28).toBeLessThanOrEqual(inner.y);
  });

  it('T5-A11: zoneScore evaluateMove, FastCrossingEvaluator, and wrapped wallDetourCount parity', () => {
    const doc = parse(`
group z0 "Z0" { group g0 "G0" { node a0; node a1 }; node a2 }
group z1 "Z1" { node b0; node b1 }
group z2 "Z2" { node c0; node c1 }
group z3 "Z3" { node d0; node d1 }
step "S0" {
  animate a0 --> b0
  animate a1 --> b1
  animate a2 --> c0
  animate b0 --> c1
  animate c0 --> d0
  animate c1 --> d1
  static a0 ..> a1
  static b0 ..> b1
}
`).document;
    const flow = analyzeFlow(doc);
    const { blocks, owners } = buildBlocks(doc, computeColumnLayout, undefined, flow);
    const rowOfBlock = new Map<string, number>([
      [blocks[0]?.id ?? 'z0', 0],
      [blocks[1]?.id ?? 'z1', 0],
      [blocks[2]?.id ?? 'z2', 1],
      [blocks[3]?.id ?? 'z3', 1],
    ]);
    const placed: Placed[] = blocks.map((b, i) => ({
      block: cloneBlockNodes(b),
      x: (i % 2) * 500.3,
      y: Math.floor(i / 2) * 520.7,
      flip: i === 1 ? 1 : 0,
    }));
    const ctx = buildFlowContext(flow, owners, false, true, rowOfBlock);
    const links = buildLinks(doc, placed, flow);
    refreshSegments(links);

    // evaluateMove vs linkCost parity
    const target = placed[2] as Placed;
    const beforeCost = linkCost(links, placed, ctx);
    const delta = evaluateMove(
      links,
      placed,
      target,
      target.x + 17.5,
      target.y - 9.25,
      1,
      undefined,
      0,
      0,
      0,
      ctx,
    );
    expect(Number.isNaN(delta)).toBe(false);
    const afterCost = linkCost(links, placed, ctx);
    expect(Math.abs(delta - (afterCost - beforeCost))).toBeLessThan(1e-6);

    // FastCrossingEvaluator parity (with nested + flip=1 + fractional coords)
    const fast = createFastCrossingEvaluator(placed, linksOf(doc), flow);
    const fastRes = fast.syncAndCountCrossings(placed);
    const lay = toLayout(placed);
    expect(fastRes.totalCross).toBe(countCrossings(doc, lay));
    expect(fastRes.priCross).toBe(primaryCrossingsOf(flow.connections, lay));

    // wallDetourCount skips cross-row links when wrapped
    const crossRowDoc = parse(`
group z0 "Z0" { node a }
group z1 "Z1" { node mid }
group z2 "Z2" { node b }
step "S" {
  animate a --> b
  static mid ..> b
}
`).document;
    const cf = analyzeFlow(crossRowDoc);
    const cb = buildBlocks(crossRowDoc, computeColumnLayout, undefined, cf);
    const byId = new Map(cb.blocks.map((b) => [b.id, b]));
    const cp: Placed[] = [
      { block: byId.get('z0') as Block, x: 0, y: 0, flip: 0 },
      { block: byId.get('z1') as Block, x: 300, y: 0, flip: 0 },
      { block: byId.get('z2') as Block, x: 600, y: 0, flip: 0 },
    ];
    const cl = buildLinks(crossRowDoc, cp, cf);
    refreshSegments(cl);
    const unCtx = buildFlowContext(cf, cb.owners, true, false);
    const wrapCtx = buildFlowContext(
      cf,
      cb.owners,
      true,
      true,
      new Map([
        ['z0', 0],
        ['z1', 0],
        ['z2', 1],
      ]),
    );
    expect(wallDetourCount(cl, cp, unCtx)).toBeGreaterThan(0);
    expect(wallDetourCount(cl, cp, wrapCtx)).toBe(0);
  });
});

describe('Tier 5 adversarial hardening: Challenger #2 Sections A & B', () => {
  beforeEach(() => adoptZonePlan('', undefined));

  describe('Section A: zoneBlocks.ts & columns.ts', () => {
    it('0-group single self-loop and multi-row self-loops preserve 0.0-px drift and loop headroom', () => {
      const base1 = parse(`
node a_loop
step "S" { animate a_loop --> a_loop }
`).document;
      const ext1 = parse(`
node a_loop
node z_plain
step "S" { animate a_loop --> a_loop }
`).document;
      const lBase1 = computeLayout(base1);
      const lExt1 = computeLayout(ext1);
      assertValidLayout(ext1, lExt1);
      expect(lExt1.nodes.a_loop).toEqual(lBase1.nodes.a_loop);

      const nodes12 = Array.from(
        { length: 12 },
        (_, i) => `node n${String(i).padStart(2, '0')}`,
      ).join('\n');
      const loops12 = ['00', '03', '06', '09']
        .map((id) => `  animate n${id} --> n${id}`)
        .join('\n');
      const base12 = parse(`${nodes12}\nstep "S" {\n${loops12}\n}`).document;
      const ext12 = parse(
        `${nodes12}\nnode z_last_loop\nstep "S" {\n${loops12}\n  animate z_last_loop --> z_last_loop\n}`,
      ).document;
      const lBase12 = computeLayout(base12);
      const lExt12 = computeLayout(ext12);
      assertValidLayout(ext12, lExt12);
      for (let i = 0; i < 12; i++) {
        const id = `n${String(i).padStart(2, '0')}`;
        expect(lExt12.nodes[id]).toEqual(lBase12.nodes[id]);
      }
    });

    it('<= 1 mode preserves 0.0-px drift on 0->1 isolated group addition and complex nested/multiComp edits', () => {
      // Bug 6 regression: 0 -> 1 isolated group or empty group keeps connected nodes at 0.0-px drift
      const base0 = parse('node a\nnode b\nstep "S" { animate a --> b }').document;
      const extGrp = parse(
        'node a\nnode b\ngroup z_iso_grp { node z_iso_x }\nstep "S" { animate a --> b }',
      ).document;
      const extEmpty = parse(
        'node a\nnode b\ngroup g_empty {}\nstep "S" { animate a --> b }',
      ).document;
      const lBase0 = computeLayout(base0);
      const lExtGrp = computeLayout(extGrp);
      const lExtEmpty = computeLayout(extEmpty);
      expect(zonesPlacedFreely(extGrp)).toBe(false);
      assertValidLayout(extGrp, lExtGrp);
      assertValidLayout(extEmpty, lExtEmpty);
      expect(lExtGrp.nodes.a).toEqual(lBase0.nodes.a);
      expect(lExtGrp.nodes.b).toEqual(lBase0.nodes.b);
      expect(lExtEmpty.nodes.a).toEqual(lBase0.nodes.a);
      expect(lExtEmpty.nodes.b).toEqual(lBase0.nodes.b);

      // Input A: empty group + ungrouped a-->b + append z_loop
      const baseA = parse(
        'group g_empty {}\nnode a\nnode b\nstep "S" { animate a --> b }',
      ).document;
      const extA = parse(
        'group g_empty {}\nnode a\nnode b\nnode z_loop\nstep "S" { animate a --> b; animate z_loop --> z_loop }',
      ).document;
      const lBaseA = computeLayout(baseA);
      const lExtA = computeLayout(extA);
      assertValidLayout(extA, lExtA);
      expect(lExtA.nodes.a).toEqual(lBaseA.nodes.a);
      expect(lExtA.nodes.b).toEqual(lBaseA.nodes.b);
      expect(lExtA.groups.g_empty).toEqual(lBaseA.groups.g_empty);

      // Input B: nested empty groups + append z_iso_loop
      const baseB = parse(
        'group root { node a; node b; group inner_empty { group deep_empty {} } }\nstep "S" { animate a --> b }',
      ).document;
      const extB = parse(
        'group root { node a; node b; group inner_empty { group deep_empty {} } }\nnode z_iso_loop\nstep "S" { animate a --> b; animate z_iso_loop --> z_iso_loop }',
      ).document;
      const lBaseB = computeLayout(baseB);
      const lExtB = computeLayout(extB);
      assertValidLayout(extB, lExtB);
      expect(lExtB.nodes).toEqual({ ...lBaseB.nodes, z_iso_loop: lExtB.nodes.z_iso_loop });
      expect(lExtB.groups).toEqual(lBaseB.groups);

      // Input C: group + nested empty/full + 2 multiComps + long static label + singleton + append z_iso_2
      const dslC = `
group g0 {
  node a
  node b
  group inner_empty {}
  group inner_full { node c }
}
node c1
node c2
node c3
node c4
node m_iso
step "S" {
  animate a --> b
  static a --> b : "very long diagnostic label across internal edge"
  animate c1 --> c2
  animate c3 --> c4
  animate c3 --> c3
}`;
      const baseC = parse(dslC).document;
      const extC = parse(
        `${dslC}\nnode z_iso_2\nstep "S2" { animate z_iso_2 --> z_iso_2 }`,
      ).document;
      const lBaseC = computeLayout(baseC);
      const lExtC = computeLayout(extC);
      assertValidLayout(extC, lExtC);
      for (const id of Object.keys(lBaseC.nodes)) {
        expect(lExtC.nodes[id]).toEqual(lBaseC.nodes[id]);
      }
      for (const id of Object.keys(lBaseC.groups)) {
        expect(lExtC.groups[id]).toEqual(lBaseC.groups[id]);
      }
    });

    it('>= 2 mode preserves 0.0-px drift across all-isolated, multi-row wrap, aux-above, and isolated-animate cases', () => {
      // All-isolated >= 2 groups
      const isoBase = parse(`
group g1 { group g1_in { node x } }
group g2 { group g2_in {} }
step "S" { animate x --> x }
`).document;
      const isoExt = parse(`
group g1 { group g1_in { node x } }
group g2 { group g2_in {} }
node z_iso_loop
step "S" { animate x --> x; animate z_iso_loop --> z_iso_loop }
`).document;
      const lIsoB = computeLayout(isoBase);
      const lIsoE = computeLayout(isoExt);
      assertValidLayout(isoExt, lIsoE);
      expect(lIsoE.nodes.x).toEqual(lIsoB.nodes.x);
      expect(lIsoE.groups).toEqual(lIsoB.groups);

      // Multi-row isolated wrapping (10 isolated nodes with alternating self-loops)
      const iso10Nodes = Array.from({ length: 10 }, (_, i) => `node i${i}`).join('\n');
      const iso10Loops = Array.from(
        { length: 5 },
        (_, i) => `  animate i${i * 2} --> i${i * 2}`,
      ).join('\n');
      const wrapBase = parse(
        `group g0 { node a }\ngroup g1 { node b }\n${iso10Nodes}\nstep "S" {\n  animate a --> b\n${iso10Loops}\n}`,
      ).document;
      const wrapExt = parse(
        `group g0 { node a }\ngroup g1 { node b }\n${iso10Nodes}\nnode z_new_loop\nstep "S" {\n  animate a --> b\n${iso10Loops}\n  animate z_new_loop --> z_new_loop\n}`,
      ).document;
      const lWrapB = computeLayout(wrapBase);
      const lWrapE = computeLayout(wrapExt);
      assertValidLayout(wrapExt, lWrapE);
      for (const id of Object.keys(lWrapB.nodes))
        expect(lWrapE.nodes[id]).toEqual(lWrapB.nodes[id]);
      expect(lWrapE.groups).toEqual(lWrapB.groups);

      // Auxiliary band above primary + append z_loop
      const auxBase = parse(`
group s { node s0; node s1 }
group d { node d0; node d1 }
group aux_top { node at }
step "S" {
  animate s0 --> d0
  animate s1 --> d1
  static s0 ..> at
  static d0 ..> at
}
`).document;
      const auxExt = parse(`
group s { node s0; node s1 }
group d { node d0; node d1 }
group aux_top { node at }
node z_loop
step "S" {
  animate s0 --> d0
  animate s1 --> d1
  static s0 ..> at
  static d0 ..> at
  animate z_loop --> z_loop
}
`).document;
      const lAuxB = computeLayout(auxBase);
      const lAuxE = computeLayout(auxExt);
      assertValidLayout(auxExt, lAuxE);
      for (const id of Object.keys(lAuxB.nodes)) expect(lAuxE.nodes[id]).toEqual(lAuxB.nodes[id]);
      expect(lAuxE.groups).toEqual(lAuxB.groups);

      // Isolated animated group appended to static-only connected zones
      const statBase = parse(`
group g0 { node n0 }
group g1 { node n1 }
group g2 { node n2 }
group g3 { node n3 }
step "S" {
  static n0 --> n1
  static n1 --> n2
  static n2 --> n3
}
`).document;
      const statExt = parse(`
group g0 { node n0 }
group g1 { node n1 }
group g2 { node n2 }
group g3 { node n3 }
group iso_anim { node ia; node ib }
step "S" {
  static n0 --> n1
  static n1 --> n2
  static n2 --> n3
  animate ia --> ib
}
`).document;
      const lStatB = computeLayout(statBase);
      const lStatE = computeLayout(statExt);
      assertValidLayout(statExt, lStatE);
      for (const id of ['n0', 'n1', 'n2', 'n3']) expect(lStatE.nodes[id]).toEqual(lStatB.nodes[id]);
      for (const id of ['g0', 'g1', 'g2', 'g3'])
        expect(lStatE.groups[id]).toEqual(lStatB.groups[id]);
    });

    it('handles prototype-keyed IDs (__proto__, constructor, toString, valueOf) safely in both modes', () => {
      const protoDocs: DavDocument[] = [
        {
          title: 'Proto1',
          groups: [{ id: '__proto__', label: 'P' }],
          nodes: [
            { id: 'constructor', label: 'C', icon: 'server', visible: true, parentId: '__proto__' },
            { id: 'toString', label: 'T', icon: 'server', visible: true },
            { id: 'valueOf', label: 'V', icon: 'server', visible: true },
          ],
          steps: [
            {
              index: 0,
              title: 'S',
              description: '',
              focus: [],
              states: [],
              animations: [
                {
                  from: 'constructor',
                  to: 'toString',
                  style: 'solid',
                  direction: 'forward',
                  parallel: false,
                },
              ],
              statics: [],
            },
          ],
        },
        {
          title: 'Proto2',
          groups: [
            { id: '__proto__', label: 'P1' },
            { id: 'constructor', label: 'P2' },
          ],
          nodes: [
            { id: 'toString', label: 'T', icon: 'server', visible: true, parentId: '__proto__' },
            { id: 'valueOf', label: 'V', icon: 'server', visible: true, parentId: 'constructor' },
          ],
          steps: [
            {
              index: 0,
              title: 'S',
              description: '',
              focus: [],
              states: [],
              animations: [
                {
                  from: 'toString',
                  to: 'valueOf',
                  style: 'solid',
                  direction: 'forward',
                  parallel: false,
                },
              ],
              statics: [],
            },
          ],
        },
      ];
      for (const doc of protoDocs) {
        const lay = computeLayout(doc);
        assertValidLayout(doc, lay);
        for (const n of doc.nodes) expect(Object.hasOwn(lay.nodes, n.id)).toBe(true);
        for (const g of doc.groups) expect(Object.hasOwn(lay.groups, g.id)).toBe(true);
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      }
    });

    it('prepareMacroGrid & wrapStageColumns handle empty, 1-block static, 25-block tall static, and 7-stage strip + aux', () => {
      const emptyDoc = parse('').document;
      const emptyFlow = analyzeFlow(emptyDoc);
      expect(prepareMacroGrid([], emptyFlow, new Map())).toEqual({
        rows: [],
        wrapped: false,
        auxiliary: [],
        rowOfBlock: new Map(),
      });

      const oneDoc = parse('group g0 { node n0 }').document;
      const oneFlow = analyzeFlow(oneDoc);
      const oneBuilt = buildBlocks(oneDoc, computeColumnLayout, undefined, oneFlow);
      const oneGrid = prepareMacroGrid(oneBuilt.blocks, oneFlow, oneBuilt.owners);
      expect(oneGrid.wrapped).toBe(true);
      expect(oneGrid.rows).toHaveLength(1);

      const tall25 = parse(
        `group hub { node h }\n${Array.from({ length: 24 }, (_, i) => `group s${i} { node n${i} }`).join('\n')}\nstep "S" {\n${Array.from({ length: 24 }, (_, i) => `  static h --> n${i}`).join('\n')}\n}`,
      ).document;
      const tallLay = computeLayout(tall25);
      assertValidLayout(tall25, tallLay);
      const tallBounds = enclosingRect(Object.values(tallLay.groups));
      expect(tallBounds.width / Math.max(1, tallBounds.height)).toBeLessThan(4);

      // 7-stage animated strip + auxiliary zone wraps cleanly
      const strip7 = parse(`
${Array.from({ length: 7 }, (_, i) => `group s${i} { node n${i} }`).join('\n')}
group aux { node ax }
step "S" {
  ${Array.from({ length: 6 }, (_, i) => `animate n${i} --> n${i + 1}`).join('\n  ')}
  static n0 ..> ax
  static n6 ..> ax
}
`).document;
      const s7Flow = analyzeFlow(strip7);
      const s7Built = buildBlocks(strip7, computeColumnLayout, undefined, s7Flow);
      const { connected: s7Conn } = partitionIsolatedBlocks(s7Built.blocks, s7Flow, s7Built.owners);
      const s7Grid = prepareMacroGrid(s7Conn, s7Flow, s7Built.owners);
      expect(s7Grid.wrapped).toBe(true);
      expect(s7Grid.auxiliary).toHaveLength(1);
      assertValidLayout(strip7, computeLayout(strip7));

      // shouldPreserveFlow: 6-stage thin strip -> false vs 3-stage connected -> true
      const thin6 = parse(`
${Array.from({ length: 6 }, (_, i) => `group z${i} { node a${i}; node b${i}; node c${i} }`).join('\n')}
step "S" {
  ${Array.from({ length: 6 }, (_, i) => `animate a${i} --> b${i}; animate b${i} --> c${i}`).join('\n  ')}
  ${Array.from({ length: 5 }, (_, i) => `animate c${i} --> a${i + 1}`).join('\n  ')}
}
`).document;
      const t6Flow = analyzeFlow(thin6);
      const t6Built = buildBlocks(thin6, computeColumnLayout, undefined, t6Flow);
      expect(shouldPreserveFlow(t6Built.blocks, t6Flow)).toBe(false);

      const conn3 = parse(`
group z0 { node n0 }
group z1 { node n1 }
group z2 { node n2 }
step "S" { animate n0 --> n1; animate n1 --> n2 }
`).document;
      const c3Flow = analyzeFlow(conn3);
      const c3Built = buildBlocks(conn3, computeColumnLayout, undefined, c3Flow);
      expect(shouldPreserveFlow(c3Built.blocks, c3Flow)).toBe(true);
    });

    it('buildSingleZoneBlock nested+self-loop flip metadata, right-top 3-aux rowFrac, and stageColumns all-aux fallback', () => {
      const nlDoc = parse(`
group z0 "Z0" {
  group inner "Inner" { node a; node b }
  node c
}
step "S" {
  animate a --> b
  animate a --> a
  animate b --> c
}
`).document;
      const nlFlow = analyzeFlow(nlDoc);
      const block = buildSingleZoneBlock(
        nlDoc,
        'z0',
        computeColumnLayout,
        undefined,
        zoneOfGroups(nlDoc.groups),
        nlBuiltOwners(nlDoc),
        nlFlow,
      );
      expect(block.loopRoom).toBe(30);
      expect(block.flippable).toBe(false);
      const flippedLay = toLayout([{ block, x: 0, y: 0, flip: 1 }]);
      const frame = flippedLay.groups.z0 as Rect;
      const nodeA = flippedLay.nodes.a as Rect;
      expect(rectContains(frame, { ...nodeA, y: nodeA.y - 30, height: nodeA.height + 30 })).toBe(
        true,
      );

      // placeAuxiliaryBlocks with 3 rightAux blocks & sideMode: 'rowFrac'
      const aux3Doc = parse(`
group p0 { node n0; node n1 }
group p1 { node m0; node m1 }
group ax0 { node a0 }
group ax1 { node a1 }
group ax2 { node a2 }
step "S0" {
  animate n0 --> m0
  animate n1 --> m1
  static n0 ..> a0
  static m0 ..> a1
  static m1 ..> a2
}
step "S1" {
  static n1 ..> a0
}
step "S2" {
  animate m0 --> a0
  animate m1 --> a1
  animate m1 --> a2
}
`).document;
      const f3 = analyzeFlow(aux3Doc);
      const b3 = buildBlocks(aux3Doc, computeColumnLayout, undefined, f3);
      const bm = new Map(b3.blocks.map((b) => [b.id, b]));
      const pri: Placed[] = [
        { block: bm.get('p0') as Block, x: 0, y: 0, flip: 0 },
        { block: bm.get('p1') as Block, x: 300, y: 0, flip: 0 },
      ];
      const aux: Placed[] = [
        { block: bm.get('ax0') as Block, x: 0, y: 0, flip: 0 },
        { block: bm.get('ax1') as Block, x: 0, y: 0, flip: 0 },
        { block: bm.get('ax2') as Block, x: 0, y: 0, flip: 0 },
      ];
      placeAuxiliaryBlocks(aux, pri, b3.owners, f3, {
        auxMode: 'right-top',
        cols: [[bm.get('p0') as Block], [bm.get('p1') as Block]],
        rowFracOf: new Map([
          ['p0', 0.2],
          ['p1', 0.8],
        ]),
        sideMode: 'rowFrac',
        clampMaxSource: true,
        decayStatic: true,
      });
      const all = [...pri, ...aux];
      for (const p of aux) expect(isClear(p, all)).toBe(true);

      // stageColumns all-aux fallback promotes all to primary
      const fakeAllAuxFlow: FlowAnalysis = {
        ...nlFlow,
        auxiliaryZones: new Set(['z0']),
      };
      const staged = stageColumns([block], fakeAllAuxFlow);
      expect(staged.auxiliary).toHaveLength(0);
      expect(staged.columns.flat().map((b) => b.id)).toEqual(['z0']);
      expect(
        wrapStageColumns(staged.columns, nlFlow, nlBuiltOwners(nlDoc)).length,
      ).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Section B: flow.ts, index.ts, ranks.ts, links.ts, metrics.ts', () => {
    it('backEdgesOf handles static cycles, mixed cycles, opposing steps, inter-zone cycles, and slackRanks parity', () => {
      // Static-only 3-cycle
      const stat3 = parse(
        'node a; node b; node c\nstep "S" { static a --> b; static b --> c; static c --> a }',
      ).document;
      expect(backEdgesOf(stat3)).toHaveLength(1);

      // Mixed animate + static cycle
      const mixed = parse(
        'node a; node b; node c\nstep "S" { animate a --> b; animate b --> c; static c --> a }',
      ).document;
      expect(backEdgesOf(mixed).length).toBeGreaterThanOrEqual(1);

      // Opposing forward steps
      const opp = parse(
        'node a; node b\nstep "S0" { animate a --> b }\nstep "S1" { animate b --> a }',
      ).document;
      expect(backEdgesOf(opp)).toHaveLength(1);

      // Inter-zone cycle returns []
      const inter = parse(
        'group z0 { node a }\ngroup z1 { node b }\nstep "S" { animate a --> b; animate b --> a }',
      ).document;
      expect(backEdgesOf(inter)).toEqual([]);

      // >= 2 mode with isolated cyclic group + self-loop-only zone
      const isoCyc = parse(`
group g0 { node a; node b }
group g1 { node x; node y; node z }
group g2 { node s }
step "S" {
  animate a --> b
  static x --> y
  static y --> z
  static z --> x
  animate s --> s
}
`).document;
      expect(backEdgesOf(isoCyc)).toHaveLength(1);

      // <= 1 mode with 2 disconnected cycles
      const twoCyc = parse(`
node a; node b; node c; node d
step "S" {
  static a --> b; static b --> a
  static c --> d; static d --> c
}
`).document;
      expect(backEdgesOf(twoCyc)).toHaveLength(2);

      // Cold vs warm backEdgesOf parity when slackRanks modifies node ranks
      const slackDoc = parse(`
group z0 { node a; node b; node c; node s }
group z1 { node t }
step "S" {
  animate a --> b
  animate b --> c
  animate a --> s
  animate s --> t
  animate c --> t
}
`).document;
      adoptZonePlan('', undefined);
      const coldBack = backEdgesOf(slackDoc);
      computeLayout(slackDoc);
      const warmBack = backEdgesOf(slackDoc);
      expect(warmBack).toEqual(coldBack);
    });

    it('computeRanks terminates on disconnected cycles, self-loops, and unknown node IDs', () => {
      const res = computeRanks(
        ['a', 'b', 'c', 'd'],
        [
          ['a', 'b'],
          ['b', 'a'],
          ['c', 'd'],
          ['d', 'c'],
          ['a', 'a'],
          ['a', 'missing'],
          ['missing', 'b'],
        ],
      );
      expect(res.back).toHaveLength(2);
      expect(res.rank.get('a')).toBe(0);
      expect(res.rank.get('b')).toBe(1);
      expect(res.rank.get('c')).toBe(0);
      expect(res.rank.get('d')).toBe(1);
    });

    it('links.ts treats collinear overlaps and T-junctions as 0 crossings, and primaryCrossingsOf ignores non-primary', () => {
      const colA: Segment = { from: 'a', to: 'b', ax: 0, ay: 0, bx: 100, by: 0 };
      const colB: Segment = { from: 'c', to: 'd', ax: 20, ay: 0, bx: 120, by: 0 };
      expect(crossingsOf([colA, colB])).toBe(0);

      const tA: Segment = { from: 'a', to: 'b', ax: 0, ay: 50, bx: 100, by: 50 };
      const tB: Segment = { from: 'c', to: 'd', ax: 50, ay: 0, bx: 50, by: 50 };
      expect(crossingsOf([tA, tB])).toBe(0);

      const lay: Layout = {
        nodes: {
          a: { x: 0, y: 0, ...NODE_SIZE },
          b: { x: 400, y: 200, ...NODE_SIZE },
          c: { x: 0, y: 200, ...NODE_SIZE },
          d: { x: 400, y: 0, ...NODE_SIZE },
        },
        groups: {},
      };
      expect(
        primaryCrossingsOf(
          [
            { from: 'a', to: 'b', role: 'static' },
            { from: 'c', to: 'd', role: 'return' },
          ],
          lay,
        ),
      ).toBe(0);
      expect(
        primaryCrossingsOf(
          [
            { from: 'a', to: 'b', role: 'primary' },
            { from: 'c', to: 'd', role: 'primary' },
          ],
          lay,
        ),
      ).toBe(1);
    });

    it('metrics.ts stationRect, enclosingRect, rectOverlaps, and rectContains boundaries', () => {
      const node: Rect = { x: 100, y: 200, ...NODE_SIZE };
      const scr = stationRect(node, 'screen');
      expect(scr.width).toBe(WINDOW_SIZE.width);
      expect(scr.height).toBe(WINDOW_SIZE.height);
      const mdl = stationRect(node, 'modal');
      expect(mdl.width).toBe(WINDOW_SIZE.width);
      const srv = stationRect(node, 'server');
      expect(srv.width).toBe(STATION_SIZE);
      expect(srv.height).toBe(STATION_SIZE);
      expect(scr.y + scr.height / 2).toBe(node.y + STATION_CENTER);

      expect(enclosingRect([])).toEqual({ x: 40, y: 40, width: 0, height: 0 });
      expect(
        rectOverlaps(
          { x: 0, y: 0, width: 100, height: 100 },
          { x: 100, y: 0, width: 100, height: 100 },
        ),
      ).toBe(false);
      expect(
        rectContains(
          { x: 10, y: 20, width: 100, height: 50 },
          { x: 10, y: 20, width: 100, height: 50 },
        ),
      ).toBe(true);
    });

    it('adoptZonePlan rejects stale keys, and analyzeFlow handles multi-hop static bridges & edge-free steps', () => {
      const doc = parse(`
group z0 { node a }
group z1 { node b }
step "S" { animate a --> b }
`).document;
      const expected = computeLayout(doc);
      adoptZonePlan('', undefined);
      adoptZonePlan(
        'bogus-stale-key',
        new Map([
          ['z0', { x: 9999, y: 9999, flip: 0 }],
          ['z1', { x: -9999, y: -9999, flip: 0 }],
        ]),
      );
      expect(pendingZoneSearch(doc)).toBeDefined();
      expect(computeLayout(doc)).toEqual(expected);

      // Multi-hop static bridge + edge-free step
      const bridgeDoc = parse(`
node a
node b
node c
node x
step "Empty" {
  desc "annotation only"
}
step "Static bridge" {
  static b --> c
}
step "Animate" {
  animate a --> b
  animate c --> x
  animate x --> a
}
`).document;
      const bf = analyzeFlow(bridgeDoc);
      expect(bf.activeStepCount).toBe(2);
      expect(bf.connections.find((e) => e.from === 'c' && e.to === 'x')?.role).toBe('primary');
      expect(bf.connections.find((e) => e.from === 'x' && e.to === 'a')?.role).toBe('return');

      // Static bridge reaching from an already-visited node into a target returning to `a`
      const backBridgeDoc = parse(`
node a
node b
node c
step "Static bridge" {
  static b --> c
}
step "Animate" {
  animate a --> b
  animate c --> a
}
`).document;
      const bbf = analyzeFlow(backBridgeDoc);
      expect(bbf.connections.find((e) => e.from === 'c' && e.to === 'a')?.role).toBe('return');
    });
  });
});

function nlBuiltOwners(doc: DavDocument): ReadonlyMap<string, string> {
  return buildBlocks(doc, computeColumnLayout).owners;
}

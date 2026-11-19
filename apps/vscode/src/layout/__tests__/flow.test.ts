import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { zoneOfNodes } from '../../model/zones';
import { computeColumnLayout } from '../columns';
import { analyzeFlow, flowPairKey } from '../flow';
import { computeLayout, pendingZoneSearch, zonesPlacedFreely } from '../index';
import { type Rect, rectContains, rectOverlaps, STATION_CENTER } from '../metrics';
import { straightenNodes } from '../straightenNodes';
import {
  applyZonePlacement,
  buildBlocks,
  initialPositions,
  partitionIsolatedBlocks,
  placeIsolatedBlocks,
  shouldPreserveFlow,
  structureKey,
  type ZonePlacement,
} from '../zoneBlocks';

const centerX = (r: { x: number; width: number }) => r.x + r.width / 2;

const rectOf = (record: Readonly<Record<string, Rect>>, id: string): Rect => {
  const rect = record[id];
  if (!rect) throw new Error(`Missing layout rect for "${id}"`);
  return rect;
};

describe('analyzeFlow & flow-aware layout', () => {
  it('classifies cyclic return transitions via static telemetry bridges without inverting stages', () => {
    const dsl = `
group dev "Dev" { node ide "IDE"; node git "Git" }
group ci "CI" { node build "Build" }
group prod "Prod" { node deploy "Deploy"; node k8s "K8s"; node rollback "Rollback" }
group obs "Obs" { node metrics "Metrics"; node alert "Alert" }

step "build & release" {
  static k8s --> metrics : "scrape"
  animate ide --> git : "push"
  animate git --> build : "webhook"
  animate build --> deploy : "release"
  animate deploy --> k8s : "rollout"
  animate metrics --> rollback : "slo breach"
  animate rollback --> deploy : "revert"
  animate metrics --> alert : "notify"
  animate alert --> ide : "page"
}
`;
    const doc = parse(dsl).document;
    const flow = analyzeFlow(doc);

    expect(flow.byPair.get(flowPairKey('ide', 'git'))?.role).toBe('primary');
    expect(flow.byPair.get(flowPairKey('git', 'build'))?.role).toBe('primary');
    expect(flow.byPair.get(flowPairKey('build', 'deploy'))?.role).toBe('primary');
    expect(flow.byPair.get(flowPairKey('metrics', 'rollback'))?.role).toBe('return');
    expect(flow.byPair.get(flowPairKey('rollback', 'deploy'))?.role).toBe('return');
    expect(flow.byPair.get(flowPairKey('alert', 'ide'))?.role).toBe('return');
    expect(flow.auxiliaryZones.has('obs')).toBe(true);
    expect(flow.zoneStage.get('dev')).toBeLessThan(flow.zoneStage.get('ci') ?? -1);
    expect(flow.zoneStage.get('ci')).toBeLessThan(flow.zoneStage.get('prod') ?? -1);

    const layout = computeLayout(doc);
    expect(centerX(rectOf(layout.groups, 'dev'))).toBeLessThan(
      centerX(rectOf(layout.groups, 'ci')),
    );
    expect(centerX(rectOf(layout.groups, 'ci'))).toBeLessThan(
      centerX(rectOf(layout.groups, 'prod')),
    );
  });

  it('keeps bidirectional fan-in spokes oriented toward the hub rather than inverting earlier branches', () => {
    const dsl = `
group branchA "Branch A" { node a_rt "Router A" }
group branchB "Branch B" { node b_rt "Router B" }
group hq "HQ" { node hq_vpn "HQ VPN"; node core "Core" }

step "mesh" {
  static a_rt <.> b_rt : "backup"
  animate a_rt --> hq_vpn : "vpn"
  animate b_rt <-> hq_vpn : "vpn"
  animate hq_vpn --> core : "lan"
}
`;
    const doc = parse(dsl).document;
    const flow = analyzeFlow(doc);

    const bConn = flow.byPair.get(flowPairKey('b_rt', 'hq_vpn'));
    expect(bConn?.role).toBe('primary');
    expect(bConn?.from).toBe('b_rt');
    expect(bConn?.to).toBe('hq_vpn');
    expect(flow.zoneStage.get('branchB')).toBeLessThan(flow.zoneStage.get('hq') ?? -1);

    const layout = computeLayout(doc);
    expect(centerX(rectOf(layout.nodes, 'b_rt'))).toBeLessThan(
      centerX(rectOf(layout.nodes, 'hq_vpn')),
    );
  });

  it('keeps primary inter-zone links flowing left-to-right without auxiliary layer intrusion', () => {
    const dsl = `
group clients "Clients" { node web "Web"; node app "App" }
group edge "Edge" { node cdn "CDN"; node gw "GW" }
group core "Core" { node svc "Service" }
group data "Data" { node db "DB"; node s3 "S3" }
group obs "Obs" { node log "Logs"; node mon "Monitor" }

step "traffic" {
  static cdn ..> s3 : "assets"
  static gw ..> log : "access"
  static svc ..> log : "app log"
  static svc ..> mon : "metrics"
  static db ..> mon : "db metrics"
  animate web --> cdn : "GET"
  animate app --> gw : "API"
  animate cdn --> gw : "origin"
  animate gw --> svc : "gRPC"
  animate svc --> db : "SQL"
  animate svc --> s3 : "PUT"
}
`;
    const doc = parse(dsl).document;
    const flow = analyzeFlow(doc);
    const layout = computeLayout(doc);
    const zoneOf = zoneOfNodes(doc);

    expect(zonesPlacedFreely(doc)).toBe(true);
    expect(flow.auxiliaryZones.has('obs')).toBe(true);

    for (const c of flow.connections) {
      if (c.role !== 'primary') continue;
      if ((zoneOf.get(c.from) ?? c.from) === (zoneOf.get(c.to) ?? c.to)) continue;
      const fromR = rectOf(layout.nodes, c.from);
      const toR = rectOf(layout.nodes, c.to);
      expect(centerX(toR)).toBeGreaterThan(centerX(fromR));
    }

    // Obs sits outside the primary edge <-> core <-> data horizontal corridor.
    const edgeR = rectOf(layout.groups, 'edge');
    const dataR = rectOf(layout.groups, 'data');
    const obsR = rectOf(layout.groups, 'obs');
    const obsInBand =
      obsR.y < Math.max(edgeR.y + edgeR.height, dataR.y + dataR.height) &&
      obsR.y + obsR.height > Math.min(edgeR.y, dataR.y);
    const obsBetween =
      centerX(obsR) > Math.min(centerX(edgeR), centerX(dataR)) &&
      centerX(obsR) < Math.max(centerX(edgeR), centerX(dataR));
    expect(obsInBand && obsBetween).toBe(false);
  });

  it('prevents straightenNodes from collapsing positive inter-zone primary dx to <= 0', () => {
    const dsl = `
group left "Left" { node a "A"; node b "B" }
group right "Right" { node c "C"; node d "D" }

step "forward" {
  animate a --> c : "primary"
  static b --> d : "ref"
}
`;
    const doc = parse(dsl).document;
    const base = computeLayout(doc);
    const layout = {
      nodes: {
        a: { ...rectOf(base.nodes, 'a'), x: 100, y: 100 },
        b: { ...rectOf(base.nodes, 'b'), x: 130, y: 260 },
        c: { ...rectOf(base.nodes, 'c'), x: 130, y: 420 }, // +30px right of `a`, vertically separable
        d: { ...rectOf(base.nodes, 'd'), x: 130, y: 580 },
      },
      groups: {
        left: { x: 80, y: 60, width: 260, height: 300 },
        right: { x: 110, y: 380, width: 240, height: 300 },
      },
    };
    const res = straightenNodes(doc, layout);
    const aR = rectOf(res.nodes, 'a');
    const bR = rectOf(res.nodes, 'b');
    const cR = rectOf(res.nodes, 'c');
    expect(centerX(cR)).toBeGreaterThan(centerX(aR));
    expect(aR.y + STATION_CENTER).toBeLessThan(bR.y + STATION_CENTER);
  });

  it('keeps real multi-stage fixtures rightward without feedback/cross-cutting inversion', () => {
    for (const fixture of [
      '01-ec-microservices.dav',
      '03-hub-spoke-network.dav',
      '04-event-bus.dav',
      '06-cicd-feedback.dav',
      '07-zero-trust-nested.dav',
    ]) {
      const dsl = readFileSync(
        resolve(__dirname, '../../scene/__tests__/fixtures', fixture),
        'utf8',
      );
      const doc = parse(dsl).document;
      const flow = analyzeFlow(doc);
      const layout = computeLayout(doc);
      const zoneOf = zoneOfNodes(doc);
      for (const c of flow.connections) {
        if (c.role !== 'primary') continue;
        if ((zoneOf.get(c.from) ?? c.from) === (zoneOf.get(c.to) ?? c.to)) continue;
        expect(centerX(rectOf(layout.nodes, c.to))).toBeGreaterThan(
          centerX(rectOf(layout.nodes, c.from)),
        );
      }
    }
  });

  it('invalidates structureKey on static direction flips (..> vs <.>) and self-loop edits', () => {
    const baseDsl = `
group g0 "G0" { node a "A" }
group g1 "G1" { node b "B" }
group g2 "G2" { node c "C" }
group g3 "G3" { node d "D" }
group g4 "G4" { node e "E" }
step "s" {
  static a ..> b : "directed"
  static b --> c : "hop1"
  static c --> d : "hop2"
  static d --> e : "hop3"
  static a --> e : "long span"
}
`;
    const bidirDsl = baseDsl.replace('static a ..> b : "directed"', 'static a <.> b : "directed"');
    const loopDsl = `${baseDsl}\nstep "loop" { animate b --> b : "self" }\n`;

    const clearDoc = parse('group q0 "Q0" { node p "P" }\ngroup q1 "Q1" { node q "Q" }').document;
    const baseDoc = parse(baseDsl).document;
    const bidirDoc = parse(bidirDsl).document;
    const loopDoc = parse(loopDsl).document;

    expect(structureKey(bidirDoc)).not.toBe(structureKey(baseDoc));
    expect(structureKey(loopDoc)).not.toBe(structureKey(baseDoc));

    computeLayout(clearDoc);
    const coldBidir = computeLayout(bidirDoc);
    computeLayout(baseDoc);
    expect(pendingZoneSearch(bidirDoc)).toBeDefined();
    const warmedBidir = computeLayout(bidirDoc);
    expect(warmedBidir).toEqual(coldBidir);

    computeLayout(clearDoc);
    const coldLoop = computeLayout(loopDoc);
    computeLayout(baseDoc);
    expect(pendingZoneSearch(loopDoc)).toBeDefined();
    const warmedLoop = computeLayout(loopDoc);
    expect(warmedLoop).toEqual(coldLoop);
  });

  it('propagates multi-hop static bridges order-independently and stages 1-neighbor <.> terminals', () => {
    const forwardOrder = parse(`
group entry "Entry" { node u "U" }
group src "Src" { node a "A"; node d "D" }
group mid "Mid" { node b "B"; node c "C" }
group sink "Sink" { node e "E" }
step "s1" {
  animate u --> a : "start"
  animate a --> d : "init"
}
step "s2" {
  static a ..> b : "hop1"
  static b ..> c : "hop2"
  static d <.> e : "ext"
  animate c --> d : "feedback"
}
`).document;
    const reversedOrder = parse(`
group entry "Entry" { node u "U" }
group src "Src" { node a "A"; node d "D" }
group mid "Mid" { node b "B"; node c "C" }
group sink "Sink" { node e "E" }
step "s1" {
  animate u --> a : "start"
  animate a --> d : "init"
}
step "s2" {
  static b ..> c : "hop2"
  static a ..> b : "hop1"
  static d <.> e : "ext"
  animate c --> d : "feedback"
}
`).document;

    const f1 = analyzeFlow(forwardOrder);
    const f2 = analyzeFlow(reversedOrder);
    expect(f1.byPair.get(flowPairKey('c', 'd'))?.role).toBe('return');
    expect(f2.byPair.get(flowPairKey('c', 'd'))?.role).toBe('return');
    expect(f1.zoneStage.get('sink')).toBeGreaterThan(f1.zoneStage.get('src') ?? -1);
  });

  it('disables preserveFlow for static-only graphs and guards ungrouped primary pairs in straightenNodes', () => {
    const staticOnly = parse(`
group g0 "G0" { node a "A" }
group g1 "G1" { node b "B" }
step "s" { static a --> b : "ref" }
`).document;
    const sFlow = analyzeFlow(staticOnly);
    const { blocks } = buildBlocks(staticOnly, computeColumnLayout, undefined, sFlow);
    expect(shouldPreserveFlow(blocks, sFlow)).toBe(false);

    const ungrouped = parse(`
node a "A"
node b "B"
node c "C"
node d "D"
step "flow" {
  animate a --> c : "primary"
  static b --> d : "ref"
}
`).document;
    const base = computeLayout(ungrouped);
    const res = straightenNodes(ungrouped, {
      nodes: {
        a: { ...rectOf(base.nodes, 'a'), x: 100, y: 100 },
        b: { ...rectOf(base.nodes, 'b'), x: 130, y: 260 },
        c: { ...rectOf(base.nodes, 'c'), x: 130, y: 420 },
        d: { ...rectOf(base.nodes, 'd'), x: 130, y: 580 },
      },
      groups: {},
    });
    expect(centerX(rectOf(res.nodes, 'c'))).toBeGreaterThan(centerX(rectOf(res.nodes, 'a')));
  });

  it('keeps early-established stages and auxiliaryZones invariant under late-step cross-cutting links', () => {
    const evRaw = readFileSync(
      resolve(__dirname, '../../../../../scratch/ev-charging-smart-grid.dav'),
      'utf8',
    );
    const evDoc = parse(evRaw).document;
    const evFlow = analyzeFlow(evDoc);
    const evLateStatic = parse(
      evRaw.replace(
        'animate field_tech --> cp_dc2 : "Replace cable" [color: green, desc: "At 08:20 the cable is replaced, and the charger is back in service 25 minutes later"]',
        'animate field_tech --> cp_dc2 : "Replace cable" [color: green, desc: "At 08:20 the cable is replaced, and the charger is back in service 25 minutes later"]\n  static work_orders ..> bi : "MTTR report"',
      ),
    ).document;
    const evLateRevStatic = parse(
      evRaw.replace(
        'animate field_tech --> cp_dc2 : "Replace cable" [color: green, desc: "At 08:20 the cable is replaced, and the charger is back in service 25 minutes later"]',
        'animate field_tech --> cp_dc2 : "Replace cable" [color: green, desc: "At 08:20 the cable is replaced, and the charger is back in service 25 minutes later"]\n  static bi ..> work_orders : "Usage"',
      ),
    ).document;

    for (const edited of [evLateStatic, evLateRevStatic]) {
      const f = analyzeFlow(edited);
      expect(f.zoneStage).toEqual(evFlow.zoneStage);
      expect(f.auxiliaryZones).toEqual(evFlow.auxiliaryZones);

      const bA = buildBlocks(evDoc, computeColumnLayout, undefined, evFlow);
      const bB = buildBlocks(edited, computeColumnLayout, undefined, f);
      const pA = initialPositions(evDoc, bA.blocks, bA.owners, computeColumnLayout, evFlow);
      const pB = initialPositions(edited, bB.blocks, bB.owners, computeColumnLayout, f);
      expect(pB).toEqual(pA);
    }

    const ultraRaw = readFileSync(
      resolve(__dirname, '../../../../../scratch/ultra-complex-architecture.dav'),
      'utf8',
    );
    const ultraBase = analyzeFlow(parse(ultraRaw).document);
    // Core multi-primary backbone zones (auth_zone, event_hub) stay primary; only obs_zone is auxiliary.
    expect([...ultraBase.auxiliaryZones]).toEqual(['obs_zone']);
    const ultraLateAuth = analyzeFlow(
      parse(`${ultraRaw}\nstep "Late" {\n  animate portal --> idp : "SSO"\n}`).document,
    );
    const ultraLateEvent = analyzeFlow(
      parse(`${ultraRaw}\nstep "Late" {\n  animate portal --> event_bus : "Event"\n}`).document,
    );
    const ultraLateStatic = analyzeFlow(
      parse(
        ultraRaw.replace(
          'static audit_mart --> dash : "監査集計"',
          'static audit_mart --> dash : "監査集計"\n  static reconciler ..> dash : "調停監視"',
        ),
      ).document,
    );
    expect(ultraLateAuth.auxiliaryZones).toEqual(ultraBase.auxiliaryZones);
    expect(ultraLateAuth.zoneStage).toEqual(ultraBase.zoneStage);
    expect(ultraLateEvent.auxiliaryZones).toEqual(ultraBase.auxiliaryZones);
    expect(ultraLateEvent.zoneStage).toEqual(ultraBase.zoneStage);
    expect(ultraLateStatic.auxiliaryZones).toEqual(ultraBase.auxiliaryZones);
    expect(ultraLateStatic.zoneStage).toEqual(ultraBase.zoneStage);

    const nestedRaw = readFileSync(
      resolve(__dirname, '../../../../../scratch/nested-zones.dav'),
      'utf8',
    );
    const nestedBase = analyzeFlow(parse(nestedRaw).document);
    const nestedLateStatic = analyzeFlow(
      parse(
        nestedRaw.replace(
          'static users --> scheduler : "手動実行"',
          'static users --> scheduler : "手動実行"\n  static report ..> logs : "バッチログ"',
        ),
      ).document,
    );
    expect(nestedLateStatic.auxiliaryZones).toEqual(nestedBase.auxiliaryZones);
    expect(nestedLateStatic.zoneStage).toEqual(nestedBase.zoneStage);
  });

  it('uses aspect ratio rather than raw width in shouldPreserveFlow and ignores isolated blocks', () => {
    const evDoc = parse(
      readFileSync(resolve(__dirname, '../../../../../scratch/ev-charging-smart-grid.dav'), 'utf8'),
    ).document;
    const evFlow = analyzeFlow(evDoc);
    const { blocks: evBlocks } = buildBlocks(evDoc, computeColumnLayout, undefined, evFlow);
    expect(shouldPreserveFlow(evBlocks, evFlow)).toBe(true);

    const ribbonLines: string[] = [];
    const ribbonLinks: string[] = [];
    for (let z = 0; z < 7; z++) {
      ribbonLines.push(`group z${z} "Z${z}" {`);
      for (let n = 0; n < 4; n++) ribbonLines.push(`  node z${z}n${n} "N${n}"`);
      ribbonLines.push('}');
      for (let n = 1; n < 4; n++) ribbonLinks.push(`  animate z${z}n${n - 1} --> z${z}n${n}`);
      if (z > 0) ribbonLinks.push(`  animate z${z - 1}n3 --> z${z}n0`);
    }
    const ribbonBase = `${ribbonLines.join('\n')}\nstep "Flow" {\n${ribbonLinks.join('\n')}\n}`;
    const ribbonDoc = parse(ribbonBase).document;
    const ribbonFlow = analyzeFlow(ribbonDoc);
    const { blocks: ribbonBlocks } = buildBlocks(
      ribbonDoc,
      computeColumnLayout,
      undefined,
      ribbonFlow,
    );
    expect(shouldPreserveFlow(ribbonBlocks, ribbonFlow)).toBe(false);

    const extraIsolated = Array.from({ length: 12 }, (_, i) => `node iso${i} "Iso ${i}"`).join(
      '\n',
    );
    const ribbonWithIso = parse(`${ribbonBase}\n${extraIsolated}`).document;
    const ribbonIsoFlow = analyzeFlow(ribbonWithIso);
    const { blocks: ribbonIsoBlocks } = buildBlocks(
      ribbonWithIso,
      computeColumnLayout,
      undefined,
      ribbonIsoFlow,
    );
    expect(shouldPreserveFlow(ribbonIsoBlocks, ribbonIsoFlow)).toBe(false);
  });

  it('places auxiliary zones deterministically by neighbor station Y-barycenter without parity flips', () => {
    const base = `
group src "Src" { node s0 "S0"; node s1 "S1"; node s2 "S2" }
group mid "Mid" { node m_top "Top"; node m_mid "Mid"; node m_bot "Bot" }
group dst "Dst" { node d0 "D0"; node d1 "D1"; node d2 "D2" }
group aux_bot "Aux Bot" { node ab "AB" }
`;
    const withSecondAux = `${base}group aux_top "Aux Top" { node at "AT" }\n`;
    const stepsBase = `
step "backbone" {
  animate s0 --> m_top : "1"
  animate s1 --> m_mid : "2"
  animate s2 --> m_bot : "3"
  animate m_top --> d0 : "4"
  animate m_mid --> d1 : "5"
  animate m_bot --> d2 : "6"
  static s2 ..> ab : "s"
  static m_bot ..> ab : "m"
  static d2 ..> ab : "d"
}
`;
    const stepsTwoAux = stepsBase.replace(
      '}',
      '  static s0 ..> at : "s"\n  static m_top ..> at : "m"\n  static d0 ..> at : "d"\n}',
    );

    const docOne = parse(`${base}\n${stepsBase}`).document;
    const flowOne = analyzeFlow(docOne);
    const builtOne = buildBlocks(docOne, computeColumnLayout, undefined, flowOne);
    const posOne = initialPositions(
      docOne,
      builtOne.blocks,
      builtOne.owners,
      computeColumnLayout,
      flowOne,
    );

    const docTwo = parse(`${withSecondAux}\n${stepsTwoAux}`).document;
    const flowTwo = analyzeFlow(docTwo);
    const builtTwo = buildBlocks(docTwo, computeColumnLayout, undefined, flowTwo);
    const posTwo = initialPositions(
      docTwo,
      builtTwo.blocks,
      builtTwo.owners,
      computeColumnLayout,
      flowTwo,
    );

    expect(flowTwo.auxiliaryZones.has('aux_top')).toBe(true);
    expect(flowTwo.auxiliaryZones.has('aux_bot')).toBe(true);

    const primaryIds = ['src', 'mid', 'dst'];
    const byId = new Map(builtTwo.blocks.map((b) => [b.id, b]));
    const minPrimaryY = Math.min(...primaryIds.map((id) => posTwo.get(id)?.y ?? 0));
    const maxPrimaryY = Math.max(
      ...primaryIds.map((id) => (posTwo.get(id)?.y ?? 0) + (byId.get(id)?.height ?? 0)),
    );
    const topPos = posTwo.get('aux_top') as { x: number; y: number };
    const botPos = posTwo.get('aux_bot') as { x: number; y: number };
    expect(topPos.y + (byId.get('aux_top')?.height ?? 0)).toBeLessThan(minPrimaryY);
    expect(botPos.y).toBeGreaterThan(maxPrimaryY);
    // Adding aux_top must never flip aux_bot's band or position.
    expect(posTwo.get('aux_bot')).toEqual(posOne.get('aux_bot'));

    // Two auxiliary blocks tied at identical coordinates must not overlap and follow alphabetical id order.
    const tiedDoc = parse(`
group src "Src" { node s0 "S0"; node s1 "S1" }
group dst "Dst" { node d0 "D0"; node d1 "D1" }
group aux_z "Aux Z" { node az "AZ" }
group aux_a "Aux A" { node aa "AA" }
step "s" {
  animate s0 --> d0 : "top"
  animate s1 --> d1 : "bot"
  static s0 ..> az : "1"
  static d0 ..> az : "2"
  static s0 ..> aa : "1"
  static d0 ..> aa : "2"
}
`).document;
    const tiedFlow = analyzeFlow(tiedDoc);
    const tiedBuilt = buildBlocks(tiedDoc, computeColumnLayout, undefined, tiedFlow);
    const tiedPos = initialPositions(
      tiedDoc,
      tiedBuilt.blocks,
      tiedBuilt.owners,
      computeColumnLayout,
      tiedFlow,
    );
    const tiedMap = new Map(tiedBuilt.blocks.map((b) => [b.id, b]));
    const rectA = {
      ...(tiedPos.get('aux_a') as { x: number; y: number }),
      width: tiedMap.get('aux_a')?.width ?? 0,
      height: tiedMap.get('aux_a')?.height ?? 0,
    };
    const rectZ = {
      ...(tiedPos.get('aux_z') as { x: number; y: number }),
      width: tiedMap.get('aux_z')?.width ?? 0,
      height: tiedMap.get('aux_z')?.height ?? 0,
    };
    expect(rectOverlaps(rectA, rectZ)).toBe(false);
    expect(rectA.x).toBeLessThan(rectZ.x);
  });

  it('partitions deg===0 blocks and keeps exact 0px drift on connected nodes in applyZonePlacement', () => {
    const connectedDsl = `
group g_a "A" {
  group g_a_inner "A Inner" { node a1 "A1" }
}
group g_b "B" { node b1 "B1" }
step "flow" {
  animate a1 --> b1 : "go"
}
`;
    const withIsolatedDsl = `
group g_iso_early "Iso Early" {
  node ie1 "IE1"
  node ie2 "IE2"
}
${connectedDsl}
node loose_iso "Loose"
group g_empty_outer "Empty Outer" {
  group g_empty_inner "Empty Inner" {}
}
step "iso_internal" {
  static ie1 --> ie2 : "internal only"
}
`;
    const docBase = parse(connectedDsl).document;
    const docIso = parse(withIsolatedDsl).document;
    const flowIso = analyzeFlow(docIso);
    const builtIso = buildBlocks(docIso, computeColumnLayout, undefined, flowIso);
    const { connected, isolated } = partitionIsolatedBlocks(
      builtIso.blocks,
      flowIso,
      builtIso.owners,
    );

    expect(connected.map((b) => b.id).sort()).toEqual(['g_a', 'g_b']);
    expect(isolated.map((b) => b.id).sort()).toEqual(['g_empty_outer', 'g_iso_early', 'loose_iso']);

    const placement: ZonePlacement = new Map([
      ['g_a', { x: 100, y: 80, flip: 0 }],
      ['g_b', { x: 460, y: 80, flip: 0 }],
    ]);
    const layoutBase = applyZonePlacement(docBase, placement, computeColumnLayout);
    const layoutIso = applyZonePlacement(docIso, placement, computeColumnLayout);

    for (const id of ['a1', 'b1']) {
      expect(layoutIso.nodes[id]).toEqual(layoutBase.nodes[id]);
    }
    for (const gid of ['g_a', 'g_a_inner', 'g_b']) {
      expect(layoutIso.groups[gid]).toEqual(layoutBase.groups[gid]);
    }

    // Isolated blocks sit deterministically in alphabetical order below connected blocks and preserve nested empty frames.
    const connectedBottom = Math.max(
      rectOf(layoutIso.groups, 'g_a').y + rectOf(layoutIso.groups, 'g_a').height,
      rectOf(layoutIso.groups, 'g_b').y + rectOf(layoutIso.groups, 'g_b').height,
    );
    const rEmpty = rectOf(layoutIso.groups, 'g_empty_outer');
    const rIsoEarly = rectOf(layoutIso.groups, 'g_iso_early');
    const rLoose = rectOf(layoutIso.nodes, 'loose_iso');
    expect(rEmpty.y).toBeGreaterThan(connectedBottom);
    expect(rIsoEarly.y).toBe(rEmpty.y);
    expect(rLoose.y).toBe(rEmpty.y);
    expect(rEmpty.x).toBeLessThan(rIsoEarly.x);
    expect(rIsoEarly.x).toBeLessThan(rLoose.x);
    expect(rectContains(rEmpty, rectOf(layoutIso.groups, 'g_empty_inner'))).toBe(true);

    // Also verify placeIsolatedBlocks directly handles empty connectedPlaced cleanly.
    const pureIso = placeIsolatedBlocks(isolated, []);
    expect(pureIso.map((p) => p.block.id)).toEqual(['g_empty_outer', 'g_iso_early', 'loose_iso']);
  });
});

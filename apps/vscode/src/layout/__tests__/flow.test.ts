import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { zoneOfNodes } from '../../model/zones';
import { computeColumnLayout } from '../columns';
import { analyzeFlow, flowPairKey } from '../flow';
import { computeLayout, pendingZoneSearch, zonesPlacedFreely } from '../index';
import { type Rect, STATION_CENTER } from '../metrics';
import { straightenNodes } from '../straightenNodes';
import { buildBlocks, shouldPreserveFlow, structureKey } from '../zoneBlocks';

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
});

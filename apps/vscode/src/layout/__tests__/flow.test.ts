import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { zoneOfNodes } from '../../model/zones';
import { computeColumnLayout } from '../columns';
import { analyzeFlow, flowPairKey, primaryCorridors } from '../flow';
import { adoptZonePlan, computeLayout, pendingZoneSearch, zonesPlacedFreely } from '../index';
import { type Rect, rectContains, rectOverlaps, STATION_CENTER } from '../metrics';
import { straightenNodes } from '../straightenNodes';
import {
  applyZonePlacement,
  type Block,
  buildBlocks,
  initialPositions,
  ownersOf,
  type Placed,
  partitionIsolatedBlocks,
  placeAuxiliaryBand,
  placeAuxiliaryBlocks,
  placeIsolatedBlocks,
  prepareMacroGrid,
  shouldPreserveFlow,
  stageColumns,
  structureKey,
  wrapStageColumns,
  type ZonePlacement,
} from '../zoneBlocks';

const centerX = (r: { x: number; width: number }) => r.x + r.width / 2;

const rectOf = (record: Readonly<Record<string, Rect>>, id: string): Rect => {
  const rect = record[id];
  if (!rect) throw new Error(`Missing layout rect for "${id}"`);
  return rect;
};

const EV_SMART_GRID_DSL = `
group g_clients "Drivers & Staff" [color: teal] {
  node driver_app "Driver App"
  node ops_console "NOC Console"
  node field_tech "Field Tech"
}
group g_sites "Charging Sites" [color: teal] {
  group g_hwy "Highway Hub" [color: teal] {
    node cp_dc1 "DC Charger 01"
    node cp_dc2 "DC Charger 02"
    node site_ems "Site EMS"
  }
}
group g_edge "Edge & Ingress" [color: purple] {
  node waf "WAF"
  node api_gw "API Gateway"
  group g_device_edge "Device Edge" [color: purple] {
    node ocpp_lb "OCPP LB"
    node mqtt_broker "MQTT"
  }
}
group g_app "App Backend" [color: blue] {
  node driver_bff "Driver BFF"
  node route_planner "Route Planner"
}
group g_cpms "CPMS" [color: blue] {
  group g_conn "Connectivity" [color: blue] {
    node ocpp_gw "OCPP GW"
    node conn_reg "Socket Reg"
  }
  group g_sessions "Sessions" [color: blue] {
    node session_svc "Session Svc"
    group g_session_store "Session Store" [color: blue] {
      node session_db "Session DB"
      node session_rep "Replica"
    }
  }
}
group g_energy "Energy Mgmt" [color: green] {
  node load_mgr "Load Manager"
  node der_ctrl "DER Controller"
}
group g_events "Event Streaming" [color: yellow] {
  node outbox_relay "CDC Relay"
  node event_bus "Event Bus"
  node anomaly_svc "Anomaly Svc"
}
group g_pricing "Pricing & Billing" [color: pink] {
  node cdr_svc "CDR Service"
  node payment_svc "Payments"
}
group g_field "Field Service" [color: orange] {
  node work_orders "Work Orders"
  node dispatch_svc "Tech Dispatch"
}
group g_ml "ML Platform" [color: green] {
  node feature_store "Feature Store"
  node model_serving "Model Serving"
}
group g_data "Data & Reporting" [color: green] {
  node dwh "Warehouse"
  node bi "BI Dashboards"
}
group g_obs "Observability" [color: red] {
  node otel "OTel"
  node metrics "Metrics"
  group g_secops "SecOps" [color: red] {
    node siem "SIEM"
  }
}

step "1. Ingress" {
  animate driver_app --> waf : "HTTPS"
  animate waf --> api_gw : "Token"
  animate api_gw --> driver_bff : "GraphQL"
  animate driver_bff --> route_planner : "Route"
  static api_gw ..> otel : "Spans"
}
step "2. Charger Boot & Session" {
  animate cp_dc1 --> ocpp_lb : "WSS"
  animate ocpp_lb --> ocpp_gw : "OCPP"
  animate ocpp_gw <-> conn_reg : "Register"
  animate ocpp_gw --> session_svc : "Start"
  animate session_svc <-> session_db : "Insert"
  static session_db --> session_rep : "WAL"
  static ocpp_gw ..> otel : "Spans"
}
step "3. Energy & Telemetry" {
  animate site_ems --> mqtt_broker : "Power"
  animate mqtt_broker --> der_ctrl : "State"
  animate der_ctrl --> load_mgr : "Headroom"
  static load_mgr ..> metrics : "kW"
}
step "4. Events & Billing" {
  animate session_svc --> cdr_svc : "Close"
  animate cdr_svc --> payment_svc : "Capture"
  animate session_db --> outbox_relay : "CDC"
  animate outbox_relay --> event_bus : "CdrCreated"
  animate event_bus --> anomaly_svc : "Stream"
  static event_bus ..> otel : "Lag"
}
step "5. Analytics & Dispatch" {
  animate payment_svc --> feature_store : "Features"
  animate feature_store --> model_serving : "Score"
  animate model_serving --> dwh : "Facts"
  animate dwh --> bi : "Dashboards"
  animate anomaly_svc --> work_orders : "Predict"
  animate work_orders --> dispatch_svc : "WO"
  static dispatch_svc ..> siem : "Audit"
}
step "6. Field Dispatch" {
  animate dispatch_svc --> field_tech : "Assign"
  animate field_tech --> cp_dc2 : "Replace cable"
}
`;

const ULTRA_COMPLEX_DSL = `
group edge_access "Clients & Edge" [color: teal] {
  node dev_user "Dev"
  node portal "Portal"
  node waf "WAF"
  node api_gw "API GW"
}
group auth_zone "Auth & Zero Trust" [color: purple] {
  node idp "IdP"
  node policy "Policy"
  node sa_broker "SA Broker"
  node token_cache "Token Cache"
  node kms "KMS"
}
group sync_runtime "Sync Runtime" [color: blue] {
  node scheduler "Scheduler"
  node sync_job "Sync Job"
  node webhook_rx "Webhook RX"
  group grant_core "Grant Core" [color: blue] {
    node access_svc "Access Svc"
    node reconciler "Reconciler"
    node dlq_worker "DLQ Worker"
  }
  node workflow "Workflow"
}
group event_hub "Event Hub" [color: purple] {
  node event_bus "Event Bus"
  node schema_reg "Schema Reg"
  node dlq "DLQ"
  node router_fn "Router"
}
group dwh_zone "DWH" [color: yellow] {
  node raw_tbl "Raw"
  node latest_view "Latest"
  group dwh_mart "Audit Mart" [color: orange] {
    node audit_mart "Audit Mart"
    node risk_score "Risk Score"
  }
}
group cache_state "State Store" [color: green] {
  node grant_db "Grant DB"
  node lock_redis "Redis"
  node outbox_relay "Outbox"
  node artifact_gcs "GCS"
}
group external_saas "External SaaS" [color: orange] {
  node gitlab "GitLab"
  node hr_idp "HR SaaS"
  node slack_bot "Slack"
}
group obs_zone "Observability" [color: teal] {
  node audit_log "Audit Log"
  node trace_col "Trace"
  node metrics_db "Metrics"
  node alert_mgr "Alert Mgr"
  node siem "SIEM"
  node dash "Dashboard"
  node sre_oncall "SRE"
}

step "1. Auth & Request" {
  animate dev_user --> portal : "HTTPS"
  animate portal --> waf : "TLS"
  animate waf --> api_gw : "Check"
  animate api_gw <-> idp : "OIDC"
  animate idp <-> token_cache : "Session" [parallel: true]
  animate api_gw <-> policy : "RBAC"
  animate api_gw --> workflow : "Submit"
  animate workflow --> slack_bot : "Notify"
  static idp --> sa_broker : "Delegate"
  static sa_broker <-> kms : "Sign"
  static api_gw ..> audit_log : "Access"
  static api_gw ..> trace_col : "Span"
}
step "2. DWH & Mart" {
  animate scheduler ..> raw_tbl : "Ingest"
  animate raw_tbl --> latest_view : "Snapshot"
  animate raw_tbl --> audit_mart : "Archive"
  animate latest_view --> risk_score : "Score"
  static policy ..> latest_view : "Attr"
}
step "3. Sync & Snapshot" {
  animate scheduler ..> sync_job : "Trigger"
  animate sync_job <-> sa_broker : "Token"
  animate sync_job --> latest_view : "Select"
  animate sync_job --> event_bus : "Synced"
  static sync_job --> gitlab : "Members"
  static sync_job ..> audit_log : "Sync Log"
  static sync_job ..> trace_col : "Span"
}
step "4. Grant & Outbox" {
  animate workflow --> access_svc : "Execute"
  animate access_svc <-> lock_redis : "Lock"
  animate access_svc --> grant_db : "Persist"
  animate grant_db --> outbox_relay : "CDC"
  animate outbox_relay --> event_bus : "Publish"
  animate hr_idp --> webhook_rx : "HR"
  animate webhook_rx --> event_bus : "Webhook" [parallel: true]
  animate event_bus --> router_fn : "Route"
  animate router_fn --> reconciler : "Reconcile"
  static event_bus <.> schema_reg : "Schema"
  static event_bus --> metrics_db : "Lag"
  static grant_db ..> artifact_gcs : "WORM"
  static access_svc ..> audit_log : "Grant Log"
}
step "5. DLQ Replay" {
  animate access_svc ..> dlq : "429"
  animate dlq --> alert_mgr : "Alert"
  animate alert_mgr --> sre_oncall : "Page"
  animate sre_oncall --> dlq_worker : "Replay"
  animate dlq_worker --> access_svc : "Retry"
}
step "6. Audit Correlation" {
  static audit_log --> siem : "Logs"
  static risk_score --> siem : "Risk"
  static audit_log --> artifact_gcs : "WORM"
  static trace_col --> dash : "Latency"
  static metrics_db --> dash : "Metrics"
  static audit_mart --> dash : "監査集計"
}
`;

const NESTED_ZONES_DSL = `
node users "Users"
group region_tokyo "Tokyo" [color: blue] {
  node edge_tokyo "LB"
  group vpc_tokyo "Prod VPC" [color: teal] {
    group az_tokyo_a "AZ-a" [color: green] {
      node web_a "Web A"
      node app_a "App A"
    }
    group az_tokyo_c "AZ-c" [color: green] {
      node web_c "Web C"
      node app_c "App C"
    }
    node db_tokyo "DB"
  }
}
group region_osaka "Osaka" [color: purple] {
  node edge_osaka "LB"
  group vpc_osaka "DR VPC" [color: teal] {
    group az_osaka_a "AZ-a" [color: green] {
      node web_o "Web O"
      node app_o "App O"
    }
    node db_osaka "Replica"
  }
}
group shared "Shared" [color: gray] {
  group observability "Obs" [color: red] {
    node metrics "Metrics"
    node logs "Logs"
  }
  group security "Sec" [color: orange] {
    node vault "Vault"
    node audit "Audit"
  }
}
group batch "Batch" [color: yellow] {
  node scheduler "Scheduler"
  node worker_1 "Worker 1"
  node worker_2 "Worker 2"
  node report "Report"
}

step "1. Tokyo" {
  animate users --> edge_tokyo : "HTTPS"
  animate edge_tokyo --> web_a : "Route"
  animate web_a --> app_a : "API"
  animate app_a <-> db_tokyo : "SQL"
  static db_tokyo ..> db_osaka : "Repl"
}
step "2. Cross-zone Shared" {
  animate app_a ..> metrics : "Metrics"
  animate app_c ..> logs : "Logs" [parallel: true]
  animate app_a <-> vault : "Secrets"
  static logs --> audit : "Archive"
}
step "3. Osaka Failover" {
  animate db_tokyo ..> db_osaka : "Failover"
  animate users ..> edge_osaka : "Switch"
  animate edge_osaka --> web_o : "Route"
  animate web_o --> app_o : "API"
  animate app_o <-> db_osaka : "SQL"
}
step "4. Intra-region" {
  animate app_c <-> db_tokyo : "SQL"
  animate web_c --> app_c : "API" [parallel: true]
  static edge_tokyo --> web_c : "Route"
}
step "5. Nightly Batch" {
  animate scheduler --> worker_1 : "Start"
  animate worker_1 --> worker_2 : "Next"
  animate worker_2 --> report : "Aggregate"
  animate report ..> db_tokyo : "Read"
  static users --> scheduler : "手動実行"
}
`;

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
    const evRaw = EV_SMART_GRID_DSL;
    const evDoc = parse(evRaw).document;
    const evFlow = analyzeFlow(evDoc);
    const evLateStatic = parse(
      evRaw.replace(
        'animate field_tech --> cp_dc2 : "Replace cable"',
        'animate field_tech --> cp_dc2 : "Replace cable"\n  static work_orders ..> bi : "MTTR report"',
      ),
    ).document;
    const evLateRevStatic = parse(
      evRaw.replace(
        'animate field_tech --> cp_dc2 : "Replace cable"',
        'animate field_tech --> cp_dc2 : "Replace cable"\n  static bi ..> work_orders : "Usage"',
      ),
    ).document;

    for (const edited of [evLateStatic, evLateRevStatic]) {
      const f = analyzeFlow(edited);
      expect(f.zoneStage).toEqual(evFlow.zoneStage);
      expect(f.auxiliaryZones).toEqual(evFlow.auxiliaryZones);

      const bA = buildBlocks(evDoc, computeColumnLayout, undefined, evFlow);
      const bB = buildBlocks(edited, computeColumnLayout, undefined, f);
      const pA = initialPositions(evDoc, bA.blocks, bA.owners, evFlow);
      const pB = initialPositions(edited, bB.blocks, bB.owners, f);
      expect(pB).toEqual(pA);
    }

    const ultraRaw = ULTRA_COMPLEX_DSL;
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

    const nestedRaw = NESTED_ZONES_DSL;
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
    const evDoc = parse(EV_SMART_GRID_DSL).document;
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
    const posOne = initialPositions(docOne, builtOne.blocks, builtOne.owners, flowOne);

    const docTwo = parse(`${withSecondAux}\n${stepsTwoAux}`).document;
    const flowTwo = analyzeFlow(docTwo);
    const builtTwo = buildBlocks(docTwo, computeColumnLayout, undefined, flowTwo);
    const posTwo = initialPositions(docTwo, builtTwo.blocks, builtTwo.owners, flowTwo);

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
    const tiedPos = initialPositions(tiedDoc, tiedBuilt.blocks, tiedBuilt.owners, tiedFlow);
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

  it('keeps cold===warm under empty desc/focus/state steps, step-index shifts, and repeat return animations', () => {
    const baseDsl = `
group g0 "G0" { node a0 "A0"; node a1 "A1" }
group g1 "G1" { node b0 "B0"; node b1 "B1" }
group g2 "G2" { node c0 "C0"; node c1 "C1" }
group g3 "G3" { node d0 "D0"; node d1 "D1" }
step "S1" {
  animate a0 --> a1
  animate a1 --> b0
  animate b0 --> b1
}
step "S2" {
  animate b1 --> c0
  animate c0 --> c1
  animate c1 --> a0
}
step "S3" {
  static a0 ..> d0
  static b0 ..> d0
  static c0 ..> d1
  animate d1 --> b0
}
`;
    const withEmptyOverview = baseDsl.replace(
      'step "S1"',
      'step "Overview" {\n  desc "Overview"\n  focus a0\n  state a0 [badge: "OK"]\n}\nstep "S1"',
    );
    const withRepeatReturn = `${baseDsl}\nstep "S4" {\n  animate a0 --> c1\n  animate c1 --> a0\n}\n`;
    const withShiftedFirstStep = baseDsl.replace(
      'step "S1"',
      'step "S0" {\n  static d0 ..> d1\n}\nstep "S1"',
    );

    const baseDoc = parse(baseDsl).document;
    const overviewDoc = parse(withEmptyOverview).document;
    const repeatDoc = parse(withRepeatReturn).document;
    const shiftedDoc = parse(withShiftedFirstStep).document;

    adoptZonePlan('', undefined);
    const coldBase = computeLayout(baseDoc);

    // Edge-free steps neither shift pairFirstStep nor invalidate structureKey.
    expect(structureKey(overviewDoc)).toBe(structureKey(baseDoc));
    adoptZonePlan('', undefined);
    const coldOverview = computeLayout(overviewDoc);
    computeLayout(baseDoc);
    expect(computeLayout(overviewDoc)).toEqual(coldOverview);
    expect(coldOverview).toEqual(coldBase);

    // Repeat animations on an already-classified 'return' pair do not push forwardEdges or drift.
    const fBase = analyzeFlow(baseDoc);
    const fRepeat = analyzeFlow(repeatDoc);
    expect(fRepeat.byPair.get(flowPairKey('a0', 'c1'))).toEqual(
      fBase.byPair.get(flowPairKey('a0', 'c1')),
    );
    expect(fRepeat.forwardEdges).toEqual(fBase.forwardEdges);
    adoptZonePlan('', undefined);
    const coldRepeat = computeLayout(repeatDoc);
    computeLayout(baseDoc);
    expect(computeLayout(repeatDoc)).toEqual(coldRepeat);
    expect(coldRepeat).toEqual(coldBase);

    // A connection-bearing step that shifts pairFirstStep invalidates structureKey so cold === warm.
    expect(structureKey(shiftedDoc)).not.toBe(structureKey(baseDoc));
    adoptZonePlan('', undefined);
    const coldShifted = computeLayout(shiftedDoc);
    computeLayout(baseDoc);
    expect(computeLayout(shiftedDoc)).toEqual(coldShifted);
  });

  it('prevents isolated internal animations and self-loops from perturbing static-only connected zones', () => {
    const baseStatic = `
group g0 "G0" { node a0; node a1; node a2 }
group g1 "G1" { node b0; node b1; node b2 }
group g2 "G2" { node c0; node c1; node c2 }
group g3 "G3" { node d0; node d1; node d2 }
step "Static" {
  static a0 --> a1
  static a1 --> a2
  static b0 --> b1
  static b1 --> b2
  static c0 --> c1
  static c1 --> c2
  static d0 --> d1
  static d1 --> d2
  static a2 --> b0
  static b2 --> c0
  static c2 --> d0
  static a0 --> d2
}
`;
    const withIsolated = `
group iso_grp "Isolated" {
  node ia
  node ib
}
node iso_self
${baseStatic}
step "Iso Anim" {
  animate ia --> ib
  animate ia --> ia
  animate iso_self --> iso_self
}
`;
    const docBase = parse(baseStatic).document;
    const docIso = parse(withIsolated).document;
    adoptZonePlan('', undefined);
    const layoutBase = computeLayout(docBase);
    adoptZonePlan('', undefined);
    const layoutIso = computeLayout(docIso);

    for (const n of docBase.nodes) {
      expect(layoutIso.nodes[n.id]).toEqual(layoutBase.nodes[n.id]);
    }
    for (const g of docBase.groups) {
      expect(layoutIso.groups[g.id]).toEqual(layoutBase.groups[g.id]);
    }
  });

  it('prevents all-auxiliary collapse on intra-zone animated / inter-zone static graphs and omits aux corridors', () => {
    const allStaticInter = parse(`
group g0 { node a0; node a1 }
group g1 { node b0 }
group g2 { node c0 }
step "S" {
  animate a0 --> a1
  static a1 --> b0
  static b0 --> c0
  static a0 --> c0
}
`).document;
    const fStaticInter = analyzeFlow(allStaticInter);
    expect(fStaticInter.auxiliaryZones.size).toBe(0);
    expect(fStaticInter.zoneStage.get('g0')).toBeLessThan(fStaticInter.zoneStage.get('g1') ?? -1);
    expect(fStaticInter.zoneStage.get('g1')).toBeLessThan(fStaticInter.zoneStage.get('g2') ?? -1);

    const lines15 = ['group g0 { node g0_0; node g0_1 }'];
    const steps15 = ['  animate g0_0 --> g0_1'];
    for (let i = 1; i < 15; i++) {
      lines15.push(`group g${i} { node g${i}_0 }`);
      steps15.push(`  static g${i - 1}_0 --> g${i}_0`);
      if (i >= 2) steps15.push(`  static g0_0 --> g${i}_0`);
    }
    const doc15 = parse(`${lines15.join('\n')}\nstep "S" {\n${steps15.join('\n')}\n}`).document;
    adoptZonePlan('', undefined);
    const lay15 = computeLayout(doc15);
    const rects15 = Object.values(lay15.groups);
    for (let i = 0; i < rects15.length; i++) {
      for (let j = i + 1; j < rects15.length; j++) {
        expect(rectOverlaps(rects15[i] as Rect, rects15[j] as Rect)).toBe(false);
      }
    }

    const auxAlertDoc = parse(`
group g0 { node a }
group g1 { node b }
group g2 { node c }
group obs { node m; node al }
step "S1" {
  animate a --> b
  animate b --> c
  static a ..> m
  static b ..> m
  static c ..> m
}
step "S2" {
  animate m --> al
  animate al --> c
}
`).document;
    const fAlert = analyzeFlow(auxAlertDoc);
    expect(fAlert.auxiliaryZones.has('obs')).toBe(true);
    const corridors = primaryCorridors(fAlert, ownersOf(auxAlertDoc));
    expect(corridors.some((c) => c.a === 'obs' || c.b === 'obs')).toBe(false);
  });

  it('prepares MacroGrid with row wrapping and splits tall static columns deterministically', () => {
    // 1. Normal animated 4-stage pipeline + auxiliary zone -> wrapped === false, rowOfBlock = 0 for primary only.
    const normalDoc = parse(`
group z0 "Z0" { node n0 }
group z1 "Z1" { node n1 }
group z2 "Z2" { node n2 }
group z3 "Z3" { node n3 }
group aux "Aux" { node ax }
step "S" {
  animate n0 --> n1
  animate n1 --> n2
  animate n2 --> n3
  static n0 ..> ax
  static n1 ..> ax
  static n2 ..> ax
  static n3 ..> ax
}
`).document;
    const normalFlow = analyzeFlow(normalDoc);
    const normalBuilt = buildBlocks(normalDoc, computeColumnLayout, undefined, normalFlow);
    const normalGrid = prepareMacroGrid(normalBuilt.blocks, normalFlow, normalBuilt.owners);
    expect(normalGrid.wrapped).toBe(false);
    expect(normalGrid.rows).toHaveLength(1);
    expect(normalGrid.rows[0]).toHaveLength(4);
    expect(normalGrid.auxiliary.map((b) => b.id)).toEqual(['aux']);
    expect(normalGrid.rowOfBlock.has('aux')).toBe(false);
    for (const id of ['z0', 'z1', 'z2', 'z3']) {
      expect(normalGrid.rowOfBlock.get(id)).toBe(0);
    }

    // 2. Ultra-wide 7-stage strip -> wrapped === true with accurate rowOfBlock per wrapped row.
    const stripLines: string[] = [];
    const stripLinks: string[] = [];
    for (let z = 0; z < 7; z++) {
      stripLines.push(`group z${z} "Z${z}" {`);
      for (let n = 0; n < 4; n++) stripLines.push(`  node z${z}n${n}`);
      stripLines.push('}');
      for (let n = 1; n < 4; n++) stripLinks.push(`  animate z${z}n${n - 1} --> z${z}n${n}`);
      if (z > 0) stripLinks.push(`  animate z${z - 1}n3 --> z${z}n0`);
    }
    const stripDoc = parse(
      `${stripLines.join('\n')}\nstep "S" {\n${stripLinks.join('\n')}\n}`,
    ).document;
    const stripFlow = analyzeFlow(stripDoc);
    const stripBuilt = buildBlocks(stripDoc, computeColumnLayout, undefined, stripFlow);
    const stripGrid = prepareMacroGrid(stripBuilt.blocks, stripFlow, stripBuilt.owners);
    expect(stripGrid.wrapped).toBe(true);
    expect(stripGrid.rows.length).toBeGreaterThanOrEqual(2);
    stripGrid.rows.forEach((rowCols, rowIdx) => {
      for (const col of rowCols) {
        for (const b of col) {
          expect(stripGrid.rowOfBlock.get(b.id)).toBe(rowIdx);
        }
      }
    });

    // 3. Static tall column splitting (`!flow.hasAnimate && col.length >= 4`):
    //    static star, static mesh, and disconnected static clusters split tall columns and stay compact.
    const starDoc = parse(`
group hub "Hub" { node h }
${Array.from({ length: 6 }, (_, i) => `group s${i} "S${i}" { node n${i} }`).join('\n')}
step "Static" {
  ${Array.from({ length: 6 }, (_, i) => `static h --> n${i}`).join('\n  ')}
}
`).document;
    const starDocReversed = parse(`
${Array.from({ length: 6 }, (_, i) => `group s${5 - i} "S${5 - i}" { node n${5 - i} }`).join('\n')}
group hub "Hub" { node h }
step "Static" {
  ${Array.from({ length: 6 }, (_, i) => `static h --> n${5 - i}`).join('\n  ')}
}
`).document;
    const starFlow = analyzeFlow(starDoc);
    const starBuilt = buildBlocks(starDoc, computeColumnLayout, undefined, starFlow);
    const starCols = stageColumns(starBuilt.blocks, starFlow).columns;
    expect(starCols.length).toBeLessThanOrEqual(2);
    expect(starCols.some((c) => c.length >= 4)).toBe(true);

    const starGrid = prepareMacroGrid(starBuilt.blocks, starFlow, starBuilt.owners);
    const starRevFlow = analyzeFlow(starDocReversed);
    const starRevBuilt = buildBlocks(starDocReversed, computeColumnLayout, undefined, starRevFlow);
    const starRevGrid = prepareMacroGrid(starRevBuilt.blocks, starRevFlow, starRevBuilt.owners);
    expect(starGrid.wrapped).toBe(true);
    expect(starGrid.rows.flat().every((col) => col.length < 4)).toBe(true);
    expect(starGrid.rows.map((r) => r.map((c) => c.map((b) => b.id)))).toEqual(
      starRevGrid.rows.map((r) => r.map((c) => c.map((b) => b.id))),
    );

    const starPos = initialPositions(starDoc, starBuilt.blocks, starBuilt.owners, starFlow);
    const starRects = starBuilt.blocks.map((b) => ({
      ...(starPos.get(b.id) as { x: number; y: number }),
      width: b.width,
      height: b.height,
    }));
    for (let i = 0; i < starRects.length; i++) {
      for (let j = i + 1; j < starRects.length; j++) {
        expect(rectOverlaps(starRects[i] as Rect, starRects[j] as Rect)).toBe(false);
      }
    }
    const starMinX = Math.min(...starRects.map((r) => r.x));
    const starMaxX = Math.max(...starRects.map((r) => r.x + r.width));
    const starMinY = Math.min(...starRects.map((r) => r.y));
    const starMaxY = Math.max(...starRects.map((r) => r.y + r.height));
    const starAspect = (starMaxX - starMinX) / Math.max(1, starMaxY - starMinY);
    expect(starAspect).toBeLessThan(3.5);
    expect(starAspect).toBeGreaterThan(0.7);

    // 4. Static 12-node mesh / disconnected cluster wraps into >= 2 rows via wrapStageColumns.
    const meshDoc = parse(`
${Array.from({ length: 12 }, (_, i) => `group m${i} "M${i}" { node u${i} }`).join('\n')}
step "Mesh" {
  ${Array.from({ length: 6 }, (_, i) => `static u${i * 2} <-> u${i * 2 + 1}`).join('\n  ')}
  static u0 <-> u2
  static u2 <-> u4
  static u6 <-> u8
  static u8 <-> u10
}
`).document;
    const meshFlow = analyzeFlow(meshDoc);
    const meshBuilt = buildBlocks(meshDoc, computeColumnLayout, undefined, meshFlow);
    const meshGrid = prepareMacroGrid(meshBuilt.blocks, meshFlow, meshBuilt.owners);
    const wrappedDirect = wrapStageColumns(
      stageColumns(meshBuilt.blocks, meshFlow).columns,
      meshFlow,
      meshBuilt.owners,
    );
    expect(meshGrid.wrapped).toBe(true);
    expect(meshGrid.rows.length).toBeGreaterThanOrEqual(2);
    expect(wrappedDirect.length).toBe(meshGrid.rows.length);

    // 5. Multi-stage static fan-out (1 -> 1 -> 10, columns.length === 3) splits tall >= 4 columns.
    const fanDoc = parse(`
group root "Root" { node r0 }
group mid "Mid" { node m0 }
${Array.from({ length: 10 }, (_, i) => `group leaf${i} "Leaf ${i}" { node l${i} }`).join('\n')}
step "Fan" {
  static r0 --> m0
  ${Array.from({ length: 10 }, (_, i) => `static m0 --> l${i}`).join('\n  ')}
}
`).document;
    const fanFlow = analyzeFlow(fanDoc);
    const fanBuilt = buildBlocks(fanDoc, computeColumnLayout, undefined, fanFlow);
    const fanCols = stageColumns(fanBuilt.blocks, fanFlow).columns;
    expect(fanCols).toHaveLength(3);
    expect(fanCols.some((c) => c.length >= 4)).toBe(true);

    const fanGrid = prepareMacroGrid(fanBuilt.blocks, fanFlow, fanBuilt.owners);
    expect(fanGrid.wrapped).toBe(true);
    const fanPackedCols = fanGrid.rows.flat();
    expect(fanPackedCols.length).toBeGreaterThan(fanCols.length);
    expect(Math.max(...fanPackedCols.map((c) => c.length))).toBeLessThan(
      Math.max(...fanCols.map((c) => c.length)),
    );
    for (const b of fanBuilt.blocks) {
      expect(fanGrid.rowOfBlock.has(b.id)).toBe(true);
    }

    const fanPos = initialPositions(fanDoc, fanBuilt.blocks, fanBuilt.owners, fanFlow);
    const fanRects = fanBuilt.blocks.map((b) => ({
      ...(fanPos.get(b.id) as { x: number; y: number }),
      width: b.width,
      height: b.height,
    }));
    const fanMinX = Math.min(...fanRects.map((r) => r.x));
    const fanMaxX = Math.max(...fanRects.map((r) => r.x + r.width));
    const fanMinY = Math.min(...fanRects.map((r) => r.y));
    const fanMaxY = Math.max(...fanRects.map((r) => r.y + r.height));
    const fanAspect = (fanMaxX - fanMinX) / Math.max(1, fanMaxY - fanMinY);
    expect(fanAspect).toBeGreaterThan(0.7);
    expect(fanAspect).toBeLessThan(4.5);

    // 6. Permutation invariance on unidirectional disconnected static clusters (2x4):
    //    reversing groups declaration order yields an identical MacroGrid.
    const clusForward = parse(`
group a0 "A0" { node an0 }
group a1 "A1" { node an1 }
group a2 "A2" { node an2 }
group a3 "A3" { node an3 }
group b0 "B0" { node bn0 }
group b1 "B1" { node bn1 }
group b2 "B2" { node bn2 }
group b3 "B3" { node bn3 }
step "Clusters" {
  static an0 --> an1
  static an1 --> an2
  static an2 --> an3
  static bn0 --> bn1
  static bn1 --> bn2
  static bn2 --> bn3
}
`).document;
    const clusReversed = parse(`
group b3 "B3" { node bn3 }
group b2 "B2" { node bn2 }
group b1 "B1" { node bn1 }
group b0 "B0" { node bn0 }
group a3 "A3" { node an3 }
group a2 "A2" { node an2 }
group a1 "A1" { node an1 }
group a0 "A0" { node an0 }
step "Clusters" {
  static bn2 --> bn3
  static bn1 --> bn2
  static bn0 --> bn1
  static an2 --> an3
  static an1 --> an2
  static an0 --> an1
}
`).document;
    const clusFwdFlow = analyzeFlow(clusForward);
    const clusFwdBuilt = buildBlocks(clusForward, computeColumnLayout, undefined, clusFwdFlow);
    const clusFwdGrid = prepareMacroGrid(clusFwdBuilt.blocks, clusFwdFlow, clusFwdBuilt.owners);

    const clusRevFlow = analyzeFlow(clusReversed);
    const clusRevBuilt = buildBlocks(clusReversed, computeColumnLayout, undefined, clusRevFlow);
    const clusRevGrid = prepareMacroGrid(clusRevBuilt.blocks, clusRevFlow, clusRevBuilt.owners);

    expect(clusFwdGrid.rows.map((r) => r.map((c) => c.map((b) => b.id)))).toEqual(
      clusRevGrid.rows.map((r) => r.map((c) => c.map((b) => b.id))),
    );
    expect([...clusFwdGrid.rowOfBlock.entries()].sort()).toEqual(
      [...clusRevGrid.rowOfBlock.entries()].sort(),
    );
  });

  it('places auxiliary blocks cleanly in both bands and right-top modes via shared placeAuxiliaryBlocks', () => {
    const doc = parse(`
group z0 "Z0" { node a0; node a1 }
group z1 "Z1" { node b0; node b1 }
group z2 "Z2" { node c0; node c1 }
group aux_band "Aux Band" { node ab0 }
group aux_right "Aux Right" { node ar0 }
step "S1" {
  animate a0 --> b0
  animate b0 --> c0
  static a0 ..> ab0
  static b0 ..> ab0
  static b1 ..> ar0
  static c1 ..> ar0
}
step "S2" {
  animate a1 --> b1
  animate b1 --> c1
}
step "S3" {
  animate ar0 --> c0
}
`).document;
    const flow = analyzeFlow(doc);
    const { blocks, owners } = buildBlocks(doc, computeColumnLayout, undefined, flow);
    const byId = new Map(blocks.map((b) => [b.id, b]));
    const { columns, auxiliary } = stageColumns(blocks, flow);
    expect(auxiliary.map((b) => b.id).sort()).toEqual(['aux_band', 'aux_right']);

    const makePrimary = (): Placed[] => [
      { block: byId.get('z0') as Block, x: 0, y: 0, flip: 0 },
      { block: byId.get('z1') as Block, x: 300, y: 0, flip: 0 },
      { block: byId.get('z2') as Block, x: 600, y: 0, flip: 0 },
    ];
    const makeAux = (): Placed[] => auxiliary.map((b) => ({ block: b, x: 0, y: 0, flip: 0 }));

    // Mode 1: bands mode with stationY
    const priBands = makePrimary();
    const auxBands = makeAux();
    const orderedBands = placeAuxiliaryBlocks(auxBands, priBands, owners, flow, {
      auxMode: 'bands',
      sideMode: 'stationY',
    });
    expect(orderedBands).toHaveLength(2);
    for (const ap of auxBands) {
      for (const pp of priBands) {
        expect(rectOverlaps({ ...ap, ...ap.block }, { ...pp, ...pp.block })).toBe(false);
      }
    }

    // Mode 2: right-top mode with rowFrac, clampMaxSource, and decayStatic
    const priRight = makePrimary();
    const auxRight = makeAux();
    const rowFracOf = new Map([
      ['z0', 0.5],
      ['z1', 0.5],
      ['z2', 0.5],
    ]);
    const orderedRight = placeAuxiliaryBlocks(auxRight, priRight, owners, flow, {
      auxMode: 'right-top',
      cols: columns,
      rowFracOf,
      sideMode: 'rowFrac',
      clampMaxSource: true,
      decayStatic: true,
    });
    expect(orderedRight).toHaveLength(2);
    const arRight = auxRight.find((p) => p.block.id === 'aux_right') as Placed;
    const z2Right = priRight.find((p) => p.block.id === 'z2') as Placed;
    expect(arRight.x).toBe(z2Right.x);
    expect(arRight.y + arRight.block.height).toBeLessThan(z2Right.y);
    const allRight = [...priRight, ...auxRight];
    for (let i = 0; i < allRight.length; i++) {
      for (let j = i + 1; j < allRight.length; j++) {
        const a = allRight[i] as Placed;
        const b = allRight[j] as Placed;
        expect(rectOverlaps({ ...a, ...a.block }, { ...b, ...b.block })).toBe(false);
      }
    }

    // Direct placeAuxiliaryBand packs items clear of primary band bounds.
    const bandEntryA: Placed = { block: byId.get('aux_band') as Block, x: 0, y: 0, flip: 0 };
    const bandEntryB: Placed = { block: byId.get('aux_right') as Block, x: 0, y: 0, flip: 0 };
    placeAuxiliaryBand(
      [
        { placed: bandEntryA, cx: 100, maxRight: Number.POSITIVE_INFINITY },
        { placed: bandEntryB, cx: 100, maxRight: Number.POSITIVE_INFINITY },
      ],
      true,
      0,
      100,
      300,
      1600,
    );
    expect(bandEntryA.y + bandEntryA.block.height).toBeLessThan(100);
    expect(bandEntryB.y + bandEntryB.block.height).toBeLessThan(100);
    expect(
      rectOverlaps({ ...bandEntryA, ...bandEntryA.block }, { ...bandEntryB, ...bandEntryB.block }),
    ).toBe(false);
  });
});

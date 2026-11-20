import { describe, expect, it } from 'vitest';
import { computeCompletions, format, parse } from '../../dsl';
import { computeLayout, type Layout, type Rect, stationRect } from '../../layout';
import { zoneMinWidth } from '../../layout/metrics';
import { ICON_META } from '../../model/icons';
import { ZONE_ICON_OFFSET, ZONE_LABEL_INSET } from '../../model/text';
import { type DavDocument, ICON_NAMES } from '../../model/types';
import { ancestorIds, parentMap } from '../../model/zones';
import { resolveView } from '../../scene';
import { ICON_SHAPES } from '../../scene/icons';
import { zoneNameArea } from '../../scene/rails';
import { collectUsedIcons } from '../icons';
import { exportSvg } from '../svg';

const PHASE3_CLOUD_DSL = `
title "AWS Cloud Phase 3 Showcase"

node users "Users" [icon: users]
node r53 "Route 53" [icon: dns]
node shield "AWS Shield" [icon: shield]

group vpc "Production VPC (10.0.0.0/16)" [color: blue] {
  node igw "Internet Gateway" [icon: router, mount: border]
  node alb "Application LB" [icon: lb]

  group az_a "Availability Zone A" [color: teal, border: dashed] {
    node nat_a "NAT Gateway A" [icon: nat]
    node app_a "Order Service" [icon: container]
    node bus "EventBridge" [icon: event]
  }

  group az_c "Availability Zone C" [color: teal, border: dashed] {
    node stream "Kinesis Stream" [icon: stream]
    node dw "Redshift" [icon: warehouse]
  }

  node vpce "VPC Endpoint" [icon: router, mount: border]
}

group managed "Managed Services" [color: gray] {
  node ecr "Amazon ECR" [icon: registry]
  node secrets "Secrets Manager" [icon: vault]
  node cw "CloudWatch" [icon: monitor]
  node trail "CloudTrail" [icon: audit]
}

step "Ingress and event pipeline" {
  animate users --> shield : "HTTPS"
  static users ..> r53 : "DNS"
  animate shield --> igw : "Origin"
  animate igw --> alb : "Forward"
  animate alb --> app_a : "Route"
  animate app_a --> bus : "OrderCreated"
  animate bus --> stream : "Ingest"
  animate stream --> dw : "Load"
  static app_a ..> nat_a : "Egress"
  static nat_a ..> igw : "Internet"
  static app_a ..> vpce : "PrivateLink"
  static vpce ..> ecr : "Pull Image"
  static vpce ..> secrets : "GetSecret"
  static vpc ..> cw : "VPC Flow Logs"
  static vpc ..> trail : "Audit Events"
}
`;

function must<T>(value: T | undefined, label: string): T {
  expect(value, label).toBeDefined();
  if (value === undefined) throw new Error(`Missing ${label}`);
  return value;
}

/** Each node and group a mounted node covers, other than the groups it stands in. */
function coveredByMounts(doc: DavDocument, layout: Layout): string[] {
  const parents = parentMap(doc.groups);
  const overlap = (a: Rect, b: Rect) =>
    Math.min(a.x + a.width, b.x + b.width) > Math.max(a.x, b.x) &&
    Math.min(a.y + a.height, b.y + b.height) > Math.max(a.y, b.y);
  return doc.nodes
    .filter((m) => m.mount === 'border')
    .flatMap((m) => {
      const rect = must(layout.nodes[m.id], m.id);
      const around = new Set(ancestorIds(parents, m.parentId));
      const nodes = doc.nodes.filter(
        (n) => n.id !== m.id && overlap(rect, must(layout.nodes[n.id], n.id)),
      );
      const groups = doc.groups.filter(
        (g) => !around.has(g.id) && overlap(rect, must(layout.groups[g.id], g.id)),
      );
      return [...nodes, ...groups].map((o) => `${m.id} covers ${o.id}`);
    });
}

describe('Phase 3 features: dashed borders, border mounts, group endpoints, new icons, and still labels', () => {
  it('parses all 9 new role icons, border: dashed, mount: border, and static group endpoints with zero diagnostics', () => {
    const parsed = parse(PHASE3_CLOUD_DSL);
    expect(parsed.diagnostics).toEqual([]);

    expect(ICON_NAMES).toEqual(
      expect.arrayContaining([
        'dns',
        'shield',
        'stream',
        'event',
        'nat',
        'registry',
        'warehouse',
        'vault',
        'audit',
      ]),
    );
    expect(parsed.document.groups.find((g) => g.id === 'az_a')?.border).toBe('dashed');
    expect(parsed.document.nodes.find((n) => n.id === 'igw')?.mount).toBe('border');
    expect(parsed.document.nodes.find((n) => n.id === 'vpce')?.mount).toBe('border');

    // Top-level mount: border warns with attribute-not-applicable and is ignored.
    const warn = parse('node orphan "Orphan" [mount: border]\nstep "s" {}');
    expect(warn.diagnostics.map((d) => d.code)).toEqual(['attribute-not-applicable']);
    expect(warn.document.nodes[0]?.mount).toBeUndefined();
  });

  it('completes border and mount attribute values cleanly', () => {
    const bText = 'group az "AZ" [border: ';
    const bRes = computeCompletions(bText, bText.length, true);
    expect(bRes?.items.map((i) => i.label)).toEqual(['solid', 'dashed']);

    const mText = 'group vpc "VPC" {\n  node igw [mount: ';
    const mRes = computeCompletions(mText, mText.length, true);
    expect(mRes?.items.map((i) => i.label)).toEqual(['border']);
  });

  it('mounts border nodes directly onto their parent group border facing external traffic', () => {
    const doc = parse(PHASE3_CLOUD_DSL).document;
    const layout = computeLayout(doc);
    const vpc = must(layout.groups.vpc, 'vpc');
    const igw = must(layout.nodes.igw, 'igw');
    const vpce = must(layout.nodes.vpce, 'vpce');

    const igwStation = stationRect(igw, 'router');
    const vpceStation = stationRect(vpce, 'router');
    const igwCx = igwStation.x + igwStation.width / 2;
    const vpceCx = vpceStation.x + vpceStation.width / 2;

    // IGW faces left (Shield), VPCE faces right (ECR / Secrets Manager).
    expect(Math.abs(igwCx - vpc.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(vpceCx - (vpc.x + vpc.width))).toBeLessThanOrEqual(1);

    // Deterministic across runs.
    expect(computeLayout(doc)).toEqual(layout);
  });

  it('keeps border-mounted nodes aligned with in-band primary neighbors instead of jogging toward static returns or out-of-band nodes', () => {
    const dsl = `
title "Border Mount Alignment"
node edge "CloudFront" [icon: cdn]
group cloud "AWS Cloud" {
  group region "Region" {
    group vpc "Production VPC" {
      node igw "Internet Gateway" [icon: router, mount: border]
      node alb "ALB" [icon: lb]
      group az_a "AZ-a" [border: dashed] {
        group app_sub_a "App A" {
          node app_a "App A" [icon: container]
        }
        group pub_sub_a "Pub A" {
          node nat_a "NAT A" [icon: nat]
        }
      }
      group az_c "AZ-c" [border: dashed] {
        group app_sub_c "App C" {
          node app_c "App C" [icon: container]
        }
        group pub_sub_c "Pub C" {
          node nat_c "NAT C" [icon: nat]
        }
      }
    }
    group data_acct "Data Account" {
      group data_vpc "Analytics VPC" {
        node tgw_attach "TGW Attachment" [icon: hub, mount: border]
        group sub "Analytics Subnet" {
          node glue "AWS Glue" [icon: logic]
        }
      }
    }
  }
}
step "Traffic" {
  animate edge --> igw : "HTTPS"
  animate igw --> alb : "Forward"
  animate alb --> app_a : "HTTP"
  animate alb --> app_c : "HTTP" [parallel: true]
  animate app_a --> tgw_attach : "ETL"
  animate tgw_attach --> glue : "Extract"
  static app_a ..> nat_a : "Egress"
  static nat_a ..> igw : "Out"
  static app_c ..> nat_c : "Egress"
  static nat_c ..> igw : "Out"
}
`;
    const doc = parse(dsl).document;
    const layout = computeLayout(doc);
    const igw = must(layout.nodes.igw, 'igw');
    const alb = must(layout.nodes.alb, 'alb');
    const edge = must(layout.nodes.edge, 'edge');
    const tgwAttach = must(layout.nodes.tgw_attach, 'tgw_attach');
    const glue = must(layout.nodes.glue, 'glue');
    // Primary chain `edge -> igw -> alb` stays horizontally straight despite `nat_a/nat_c` static returns below.
    expect(Math.abs(igw.y - alb.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(igw.y - edge.y)).toBeLessThanOrEqual(1);
    // `tgw_attach` aligns straight with `glue` instead of clamping to the top border corner.
    expect(Math.abs(tgwAttach.y - glue.y)).toBeLessThanOrEqual(1);
  });

  it('expands a parent top border upward so a top-mounted node label clears an inner subnet header', () => {
    const dsl = `
title "Top Mount Header Clearance"
node user "User" [icon: users]
group cloud "Cloud" {
  group edge "Global Edge" {
    node cdn "CloudFront" [icon: cdn]
    node waf "WAF" [icon: firewall]
  }
  group acct "Control Account" {
    group vpc "Control VPC" {
      node igw "Control IGW" [icon: router, mount: border]
      group sub "Control Services Subnet" {
        node alb "Control ALB" [icon: lb]
        node router "Tenant Router" [icon: container]
      }
    }
    group side "Auth Tier" {
      node api "Control API" [icon: api]
      node db "Registry DB" [icon: database]
      node bus "Control Bus" [icon: event]
    }
  }
}
step "Flow" {
  animate user --> waf : "HTTPS"
  animate waf --> cdn
  animate cdn --> igw : "mTLS"
  animate igw --> alb
  animate alb --> router
  animate router --> db : "Lookup"
  animate api --> db
  animate api --> bus
}
`;
    const doc = parse(dsl).document;
    const layout = computeLayout(doc);
    const igw = must(layout.nodes.igw, 'igw');
    const sub = must(layout.groups.sub, 'sub');
    const vpc = must(layout.groups.vpc, 'vpc');
    const igwStation = stationRect(igw, 'router');
    const igwCy = igwStation.y + igwStation.height / 2;

    // If mounted on the top border, `igw`'s full label box (`igw.y + igw.height`) must clear `sub.y`.
    if (Math.abs(igwCy - vpc.y) <= 1) {
      expect(igw.y + igw.height).toBeLessThanOrEqual(sub.y);
    }
  });

  it('lengthens a side that holds more mounted nodes than fit on it, keeping each on the border', () => {
    const doc = parse(`
group vpc "VPC" {
  node m1 "Gateway 1" [mount: border]
  node m2 "Gateway 2" [mount: border]
  node m3 "Gateway 3" [mount: border]
  node m4 "Gateway 4" [mount: border]
  node app "App"
}
node x "Internet"
step "s" {
  animate x --> m1
  animate x --> m2
  animate x --> m3
  animate x --> m4
  animate m1 --> app
}`).document;
    const layout = computeLayout(doc);
    const vpc = must(layout.groups.vpc, 'vpc');
    for (const id of ['m1', 'm2', 'm3', 'm4']) {
      const station = stationRect(must(layout.nodes[id], id), 'server');
      const cx = station.x + station.width / 2;
      const cy = station.y + station.height / 2;
      // Before, three of the four stood below the group, off its border.
      expect(
        Math.min(Math.abs(cx - vpc.x), Math.abs(cx - (vpc.x + vpc.width))),
      ).toBeLessThanOrEqual(1);
      expect(cy).toBeGreaterThan(vpc.y);
      expect(cy).toBeLessThan(vpc.y + vpc.height);
    }
    expect(coveredByMounts(doc, layout)).toEqual([]);
  });

  it('opens room so a mounted node covers no node or group it does not stand in', () => {
    // Before, the gateway covered the data subnet's frame and the replica beside it.
    const doc = parse(`
group vpc "Payment VPC" {
  group app_sub "Private App Subnet" {
    node engine "Payment Engine"
    node risk "Risk Orchestrator"
  }
  group data_sub "Isolated Data Subnet" {
    node db "Aurora Primary" [icon: database]
    node replica "Aurora Replica" [icon: database]
  }
  node vgw "Virtual Private GW" [icon: router, mount: border]
}
group dc "Corporate Data Center" {
  node cgw "Customer GW" [icon: router]
  node core "Core Banking"
}
step "Settle" {
  animate engine --> risk : "Score"
  animate risk --> db : "Write"
  static db ..> replica : "Replicate"
  animate engine --> vgw : "Private Route"
  animate vgw --> cgw : "Direct Connect"
  animate cgw --> core : "Post Ledger"
}`).document;
    const layout = computeLayout(doc);
    expect(coveredByMounts(doc, layout)).toEqual([]);
    const vpc = must(layout.groups.vpc, 'vpc');
    const vgw = stationRect(must(layout.nodes.vgw, 'vgw'), 'router');
    // Still on the border of its VPC, the side that faces the data center.
    expect(Math.abs(vgw.x + vgw.width / 2 - (vpc.x + vpc.width))).toBeLessThanOrEqual(1);
    expect(computeLayout(doc)).toEqual(layout);
  });

  it('routes static group-endpoint rails cleanly from the group border without entering interior nodes', () => {
    const doc = parse(PHASE3_CLOUD_DSL).document;
    const layout = computeLayout(doc);
    const view = resolveView(doc, layout, null);
    const vpc = must(layout.groups.vpc, 'vpc');

    const flowLogs = view.edges.find((e) => e.from === 'vpc' && e.to === 'cw');
    expect(flowLogs).toBeDefined();
    expect(flowLogs && 'points' in flowLogs.path).toBe(true);
    if (flowLogs && 'points' in flowLogs.path) {
      const start = must(flowLogs.path.points[0], 'start point');
      // Start point sits within 3px of one of `vpc`'s 4 border lines.
      const distToBorder = Math.min(
        Math.abs(start.x - vpc.x),
        Math.abs(start.x - (vpc.x + vpc.width)),
        Math.abs(start.y - vpc.y),
        Math.abs(start.y - (vpc.y + vpc.height)),
      );
      expect(distToBorder).toBeLessThanOrEqual(3);
    }
  });

  it('renders dashed group borders and optional edge labels on --still and --step --still SVGs', () => {
    const doc = parse(PHASE3_CLOUD_DSL).document;

    // Default still SVG has dashed AZ borders and NO edge labels.
    const defaultStill = exportSvg(doc, { animate: false });
    expect(defaultStill).toContain('stroke-dasharray="7 5"');
    expect(defaultStill).not.toContain('class="dav-edge-label"');

    // `--still --labels` draws representative overview labels including group-endpoint static labels.
    const labeledStill = exportSvg(doc, { animate: false, labels: true });
    expect(labeledStill).toContain('class="dav-edge-label"');
    expect(labeledStill).toContain('HTTPS');
    expect(labeledStill).toContain('OrderCreated');
    expect(labeledStill).toContain('VPC Flow Logs');

    // `--step 1 --still --labels` draws active animate labels alongside static labels.
    const labeledStep = exportSvg(doc, { animate: false, step: 0, labels: true });
    expect(labeledStep).toContain('HTTPS');
    expect(labeledStep).toContain('OrderCreated');
    expect(labeledStep).toContain('VPC Flow Logs');

    // Still SVG renders a visible title heading when the diagram declares a non-empty title.
    expect(defaultStill).toContain('class="dav-still-title"');
    expect(defaultStill).toContain('AWS Cloud Phase 3 Showcase');
    const untitledStill = exportSvg('node a\nnode b\nstep "S" {\n  animate a --> b\n}\n', {
      animate: false,
    });
    expect(untitledStill).not.toContain('class="dav-still-title"');
  });

  it('breaks the parent group border cleanly behind a border-mounted node label without an opaque patch', () => {
    const svg = exportSvg(PHASE3_CLOUD_DSL, { animate: false });
    expect(svg).not.toContain('dav-mount-mask');
    // `vpc` has a left-mounted `igw` whose label crosses the vertical left border.
    const borderMatch = /<path d="([^"]+)" fill="none" class="dav-group-border"/.exec(svg);
    expect(borderMatch).not.toBeNull();
    const d = borderMatch?.[1] ?? '';
    // Path must start with an absolute Move command and contain at least one gap jump (`M `).
    expect(d.startsWith('M ')).toBe(true);
    expect(d.split(' M ').length).toBeGreaterThanOrEqual(2);

    // Groups without border-mounted label intersections keep a single plain `<rect>`.
    const plain = exportSvg('group g "Plain" {\n  node a "A"\n}\nstep "S" {\n  focus a\n}\n', {
      animate: false,
    });
    expect(plain).not.toContain('dav-group-border');
  });

  it('keeps a clearly left-connected mounted gateway on the left border of a wide group', () => {
    const dsl = `
      node ext "External Peer" [icon: browser]
      group wide_vpc "Wide Production VPC (10.0.0.0/16)" [color: blue] {
        node igw "Internet Gateway" [icon: gateway, mount: border]
        node a "Stage 1"
        node b "Stage 2"
        node c "Stage 3"
        node d "Stage 4"
      }
      step "Flow" {
        animate ext --> igw : "HTTPS"
        animate igw --> a : "Route"
        animate a --> b : "Next"
        animate b --> c : "Next"
        animate c --> d : "Next"
      }
    `;
    const doc = parse(dsl).document;
    const layout = computeLayout(doc);
    const vpc = must(layout.groups.wide_vpc, 'wide_vpc');
    const igw = stationRect(must(layout.nodes.igw, 'igw'), 'gateway');
    const igwCx = igw.x + igw.width / 2;
    expect(Math.abs(igwCx - vpc.x)).toBeLessThanOrEqual(1);
  });

  it('supports optional [icon: ...] on groups, collects group icons, and preserves zero drift without icons', () => {
    const NEW_ROLE_ICONS = [
      'gateway',
      'endpoint',
      'nosql',
      'workflow',
      'pipeline',
      'alert',
      'region',
      'network',
      'account',
    ] as const;
    for (const icon of NEW_ROLE_ICONS) {
      expect(ICON_NAMES).toContain(icon);
      expect(ICON_META[icon]).toBeDefined();
      expect(ICON_SHAPES[icon]?.length).toBeGreaterThan(0);
    }

    const withIconDsl = [
      'group cloud "Cloud" [icon: cloud, color: orange] {',
      '  group net "VPC" [icon: NETWORK, color: teal, border: dashed] {',
      '    node wf "Workflow" [icon: workflow]',
      '    node db "NoSQL" [icon: nosql]',
      '  }',
      '}',
      'step "Run" {',
      '  animate wf --> db : "PutItem"',
      '}',
      '',
    ].join('\n');

    const parsed = parse(withIconDsl);
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.document.groups.find((g) => g.id === 'cloud')?.icon).toBe('cloud');
    expect(parsed.document.groups.find((g) => g.id === 'net')?.icon).toBe('network');

    // Formatting preserves group icon attributes cleanly.
    expect(format('group g "G" [icon: region, color: blue] {\n  node a\n}\nstep "S" {}\n')).toBe(
      'group g "G" [icon: region, color: blue] {\n  node a\n}\nstep "S" {}\n',
    );

    // Unknown icon on group reports unknown-icon with suggestion.
    const bad = parse('group g "G" [icon: netwrk] {\n  node a\n}\nstep "S" {}\n');
    expect(bad.diagnostics.map((d) => d.code)).toEqual(['unknown-icon']);
    expect(bad.diagnostics[0]?.args.suggestion).toBe('network');

    // Autocomplete offers icon names inside `group ... [icon: `.
    const compText = 'group vpc "VPC" [icon: net';
    const comp = computeCompletions(compText, compText.length, true);
    expect(comp?.items.map((i) => i.label)).toContain('network');

    // collectUsedIcons includes icons used solely on groups.
    const used = collectUsedIcons(parsed.document);
    expect(Object.keys(used)).toEqual(
      expect.arrayContaining(['cloud', 'network', 'workflow', 'nosql']),
    );

    // SVG renders .dav-group-icon and shifts .dav-group-label by ZONE_ICON_OFFSET.
    const layout = computeLayout(parsed.document);
    const svg = exportSvg(parsed.document, { animate: false });
    expect(svg).toContain('class="dav-group-icon"');
    const netRect = must(layout.groups.net, 'net');
    const expectedLabelX = netRect.x + ZONE_LABEL_INSET + ZONE_ICON_OFFSET;
    expect(svg).toContain(`x="${expectedLabelX}"`);

    // Narrow group expands to fit icon + label without truncation, and zoneNameArea covers the icon.
    const narrowBase = parse('group g "Production Account" {\n  node a\n}\nstep "S" {}\n').document;
    const narrowIcon = parse(
      'group g "Production Account" [icon: account] {\n  node a\n}\nstep "S" {}\n',
    ).document;
    const baseLayout = computeLayout(narrowBase);
    const iconLayout = computeLayout(narrowIcon);
    expect(must(iconLayout.groups.g, 'icon g').width).toBeGreaterThanOrEqual(
      zoneMinWidth('Production Account', true),
    );
    expect(
      zoneNameArea('Production Account', must(iconLayout.groups.g, 'icon g'), true).width,
    ).toBeGreaterThan(
      zoneNameArea('Production Account', must(baseLayout.groups.g, 'base g'), false).width,
    );

    // Zero drift: groups without `icon` keep identical layout.
    expect(computeLayout(narrowBase)).toEqual(baseLayout);
  });
});

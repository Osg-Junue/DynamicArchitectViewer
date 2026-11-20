import { describe, expect, it } from 'vitest';
import { computeCompletions, parse } from '../../dsl';
import { computeLayout, stationRect } from '../../layout';
import { ICON_NAMES } from '../../model/types';
import { resolveView } from '../../scene';
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
  });
});

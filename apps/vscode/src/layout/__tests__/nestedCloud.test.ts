import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { applyBorderMounts } from '../borderMount';
import { computeLayout, type Rect, rectContains, rectOverlaps } from '../index';
import { zoneMinWidth } from '../metrics';

/** Single-top-level AWS-style VPC with two isomorphic Availability Zones and static egress return paths. */
const SINGLE_TOP_MULTI_AZ_VPC = `
title "Multi-AZ Web Application Architecture"

node users "Shoppers" [icon: users]
node waf "AWS WAF" [icon: firewall]
node cf "Amazon CloudFront" [icon: cdn]

group vpc "Production VPC (10.0.0.0/16)" {
  node igw "Internet Gateway" [icon: router]
  node alb "Application Load Balancer" [icon: lb]

  group az1 "Availability Zone A" {
    group pub1 "Public Subnet A (10.0.1.0/24)" {
      node nat1 "NAT Gateway A" [icon: router]
    }
    group app1 "Private App Subnet A (10.0.11.0/24)" {
      node ecs1 "ECS Fargate Tasks (AZ-A)" [icon: container]
    }
    group data1 "Private Data Subnet A (10.0.21.0/24)" {
      node db1 "Aurora Primary" [icon: database]
      node cache1 "ElastiCache Primary" [icon: cache]
    }
  }

  group az2 "Availability Zone C" {
    group pub2 "Public Subnet C (10.0.2.0/24)" {
      node nat2 "NAT Gateway C" [icon: router]
    }
    group app2 "Private App Subnet C (10.0.12.0/24)" {
      node ecs2 "ECS Fargate Tasks (AZ-C)" [icon: container]
    }
    group data2 "Private Data Subnet C (10.0.22.0/24)" {
      node db2 "Aurora Replica" [icon: database]
      node cache2 "ElastiCache Replica" [icon: cache]
    }
  }

  node vpce "VPC Interface Endpoints" [icon: router]
}

node secrets "AWS Secrets Manager" [icon: auth]
node cw "Amazon CloudWatch" [icon: monitor]

step "Customer checkout" {
  focus users, waf, cf, igw, alb, ecs1, ecs2, db1, cache1, db2, cache2
  animate users --> waf : "HTTPS"
  animate waf --> cf : "Allowed"
  animate cf --> igw : "Origin"
  animate igw --> alb : "Forward"
  animate alb --> ecs1 : "AZ-A"
  animate alb --> ecs2 : "AZ-C"
  animate ecs1 --> db1 : "Write"
  animate ecs1 --> cache1 : "Read"
  animate ecs2 --> db2 : "Read"
  animate ecs2 --> cache2 : "Read"
  static db1 --> db2 : "Replication"
  static cache1 --> cache2 : "Replication"
}

step "Outbound egress and observability" {
  focus ecs1, ecs2, nat1, nat2, igw, vpce, secrets, cw
  static ecs1 --> nat1 : "Egress"
  static nat1 --> igw : "Internet"
  static ecs2 --> nat2 : "Egress"
  static nat2 --> igw : "Internet"
  static ecs1 --> vpce : "PrivateLink"
  static ecs2 --> vpce : "PrivateLink"
  static vpce --> secrets : "Secrets"
  static vpce --> cw : "Logs"
}
`;

/** Multi-account enterprise cloud with 4 top-level accounts and nested VPCs/AZs/subnets. */
const MULTI_ACCOUNT_ENTERPRISE = `
title "Enterprise Multi-Account Cloud Platform"

node branch_users "Enterprise Users" [icon: users]
node corp_ad "On-Premises Active Directory" [icon: auth]
node cgw "Customer Gateway" [icon: router]

group net_hub "Network Hub Account" {
  node dx "Direct Connect" [icon: router]
  node vpn "Site-to-Site VPN" [icon: firewall]
  node tgw "AWS Transit Gateway" [icon: router]
  node nfw "AWS Network Firewall" [icon: firewall]
}

group workloads "Core Workloads Account" {
  group workload_vpc "Workload VPC (10.10.0.0/16)" {
    node w_tgw "TGW Attachment" [icon: router]
    node w_alb "Internal ALB" [icon: lb]

    group w_az_a "Availability Zone A" {
      group w_app_a "App Subnet A (10.10.1.0/24)" {
        node order_svc "EKS Order Service" [icon: container]
        node pay_svc "EKS Payment Service" [icon: container]
      }
      group w_data_a "Data Subnet A (10.10.11.0/24)" {
        node orders_db "Aurora Orders Primary" [icon: database]
        node session_cache "Redis Primary" [icon: cache]
      }
    }

    group w_az_c "Availability Zone C" {
      group w_app_c "App Subnet C (10.10.2.0/24)" {
        node order_svc_c "EKS Order Service (C)" [icon: container]
        node pay_svc_c "EKS Payment Service (C)" [icon: container]
      }
      group w_data_c "Data Subnet C (10.10.12.0/24)" {
        node orders_db_c "Aurora Orders Replica" [icon: database]
        node session_cache_c "Redis Replica" [icon: cache]
      }
    }

    node bus "Amazon EventBridge" [icon: queue]
  }

  group partner_api "Partner API" {
    node apigw "Amazon API Gateway" [icon: api]
    node partner_fn "Partner Sync Lambda" [icon: function]
  }
}

group data_acct "Data & Analytics Account" {
  group analytics_vpc "Analytics VPC (10.20.0.0/16)" {
    node d_tgw "Data TGW Attachment" [icon: router]
    node glue "AWS Glue ETL" [icon: logic]
    node redshift "Amazon Redshift" [icon: database]
  }

  group lakehouse "Data Lakehouse" {
    node raw_s3 "Raw S3 Bucket" [icon: storage]
    node curated_s3 "Curated S3 Bucket" [icon: storage]
    node athena "Amazon Athena" [icon: search]
  }
}

group sec_acct "Security, Governance & Observability" {
  group obs "Central Observability" {
    node cw "Amazon CloudWatch" [icon: monitor]
    node xray "AWS X-Ray" [icon: monitor]
  }
  group sec_ops "Security, Identity & Secrets" {
    node kms "AWS KMS" [icon: auth]
    node secrets "AWS Secrets Manager" [icon: auth]
    node sso "IAM Identity Center" [icon: auth]
  }
}

step "Ingress and order processing" {
  focus branch_users, cgw, dx, vpn, tgw, nfw, w_tgw, w_alb, order_svc, pay_svc, order_svc_c, pay_svc_c, orders_db, session_cache, orders_db_c, session_cache_c
  animate branch_users --> cgw : "HTTPS"
  animate cgw --> dx : "Primary"
  animate cgw --> vpn : "Backup"
  animate dx --> tgw : "BGP"
  animate vpn --> tgw : "IPsec"
  animate tgw --> nfw : "Inspect"
  animate nfw --> w_tgw : "Allow"
  animate w_tgw --> w_alb : "Route"
  animate w_alb --> order_svc : "AZ-A"
  animate w_alb --> order_svc_c : "AZ-C"
  animate order_svc --> pay_svc : "Charge"
  animate order_svc_c --> pay_svc_c : "Charge"
  animate order_svc --> orders_db : "Write"
  animate pay_svc --> session_cache : "Token"
  animate order_svc_c --> orders_db_c : "Read"
  animate pay_svc_c --> session_cache_c : "Read"
  static orders_db --> orders_db_c : "Replicate"
  static session_cache --> session_cache_c : "Replicate"
}

step "Event streaming to analytics" {
  focus order_svc, bus, apigw, partner_fn, tgw, d_tgw, glue, raw_s3, curated_s3, redshift, athena
  animate order_svc --> bus : "OrderCreated"
  animate bus --> apigw : "Webhook"
  animate apigw --> partner_fn : "Invoke"
  animate bus --> d_tgw : "Cross-account"
  static tgw --> d_tgw : "Peering"
  animate d_tgw --> glue : "Ingest"
  animate glue --> raw_s3 : "Land"
  animate raw_s3 --> curated_s3 : "Transform"
  animate curated_s3 --> redshift : "Load"
  animate curated_s3 --> athena : "Query"
}

step "Security and observability" {
  focus corp_ad, sso, order_svc, pay_svc, orders_db, cw, xray, kms, secrets
  static corp_ad --> sso : "SAML"
  static order_svc --> cw : "Logs"
  static order_svc --> xray : "Traces"
  static pay_svc --> cw : "Logs"
  static pay_svc --> secrets : "API Key"
  static orders_db --> kms : "Encrypt"
}
`;

function must<T>(value: T | undefined, label: string): T {
  expect(value, label).toBeDefined();
  if (value === undefined) throw new Error(`Missing ${label}`);
  return value;
}

function assertContainmentAndDisjointSiblings(dsl: string) {
  const parsed = parse(dsl);
  expect(parsed.diagnostics).toEqual([]);
  const doc = parsed.document;
  const layout = computeLayout(doc);

  // Every node fits inside its parent group.
  for (const n of doc.nodes) {
    if (!n.parentId) continue;
    const nr = layout.nodes[n.id];
    const pr = layout.groups[n.parentId];
    expect(nr, `node ${n.id}`).toBeDefined();
    expect(pr, `parent ${n.parentId}`).toBeDefined();
    if (nr && pr) {
      expect(rectContains(pr, nr), `${n.id} inside ${n.parentId}`).toBe(true);
    }
  }

  // Every child group fits inside its parent group and does not overlap sibling groups.
  const byParent = new Map<string, Array<{ id: string; rect: Rect }>>();
  for (const g of doc.groups) {
    const gr = layout.groups[g.id];
    expect(gr, `group ${g.id}`).toBeDefined();
    if (!gr) continue;
    if (g.parentId) {
      const pr = layout.groups[g.parentId];
      expect(pr, `parent group ${g.parentId}`).toBeDefined();
      if (pr) {
        expect(rectContains(pr, gr), `${g.id} inside ${g.parentId}`).toBe(true);
      }
    }
    const key = g.parentId ?? '__root__';
    const list = byParent.get(key) ?? [];
    list.push({ id: g.id, rect: gr });
    byParent.set(key, list);
  }

  for (const siblings of byParent.values()) {
    for (let i = 0; i < siblings.length; i++) {
      for (let j = i + 1; j < siblings.length; j++) {
        const a = must(siblings[i], 'sibling a');
        const b = must(siblings[j], 'sibling b');
        expect(rectOverlaps(a.rect, b.rect), `${a.id} vs ${b.id}`).toBe(false);
      }
    }
  }

  return { doc, layout };
}

describe('nested cloud architecture layout', () => {
  it('lays out single-top multi-AZ VPC with symmetric AZs, clean egress placement, and non-truncated headers', () => {
    const { doc, layout } = assertContainmentAndDisjointSiblings(SINGLE_TOP_MULTI_AZ_VPC);

    const az1 = must(layout.groups.az1, 'az1');
    const az2 = must(layout.groups.az2, 'az2');
    expect(az1.width).toBe(az2.width);
    expect(az1.height).toBe(az2.height);
    expect(az1.x).toBe(az2.x);

    // Public subnet (NAT egress return) must not invert past the data subnet.
    const pub1 = must(layout.groups.pub1, 'pub1');
    const data1 = must(layout.groups.data1, 'data1');
    expect(pub1.x).toBeLessThan(data1.x);

    // Primary ingress flows left-to-right into VPC and AZs.
    expect(must(layout.nodes.users, 'users').x).toBeLessThan(must(layout.nodes.alb, 'alb').x);
    expect(must(layout.nodes.alb, 'alb').x).toBeLessThan(az1.x);

    // Every group is wide enough to fit its label within two wrapped lines.
    for (const g of doc.groups) {
      const gr = must(layout.groups[g.id], g.id);
      expect(gr.width, `header width for ${g.id}`).toBeGreaterThanOrEqual(zoneMinWidth(g.label));
    }

    // Deterministic across runs.
    expect(computeLayout(doc)).toEqual(layout);
  });

  it('lays out multi-account enterprise cloud with horizontal tiers, auxiliary separation, and symmetric AZs', () => {
    const t0 = performance.now();
    const { doc, layout } = assertContainmentAndDisjointSiblings(MULTI_ACCOUNT_ENTERPRISE);
    const elapsedMs = performance.now() - t0;

    expect(elapsedMs).toBeLessThan(500);

    const netHub = must(layout.groups.net_hub, 'net_hub');
    const workloads = must(layout.groups.workloads, 'workloads');
    const dataAcct = must(layout.groups.data_acct, 'data_acct');
    const secAcct = must(layout.groups.sec_acct, 'sec_acct');

    // Primary accounts progress strictly left-to-right.
    expect(netHub.x).toBeLessThan(workloads.x);
    expect(workloads.x).toBeLessThan(dataAcct.x);

    // Auxiliary Security/Observability account sits in a separate band above or below the primary row.
    const primaryMinY = Math.min(netHub.y, workloads.y, dataAcct.y);
    const primaryMaxBottom = Math.max(
      netHub.y + netHub.height,
      workloads.y + workloads.height,
      dataAcct.y + dataAcct.height,
    );
    const separatedVertically =
      secAcct.y + secAcct.height <= primaryMinY || secAcct.y >= primaryMaxBottom;
    expect(separatedVertically).toBe(true);

    // Isomorphic AZs inside Workload VPC match in size and align horizontally.
    const azA = must(layout.groups.w_az_a, 'w_az_a');
    const azC = must(layout.groups.w_az_c, 'w_az_c');
    expect(azA.width).toBe(azC.width);
    expect(azA.height).toBe(azC.height);
    expect(azA.x).toBe(azC.x);

    // Landscape aspect ratio (wider than tall).
    const allRects = [...Object.values(layout.nodes), ...Object.values(layout.groups)];
    const minX = Math.min(...allRects.map((r) => r.x));
    const maxX = Math.max(...allRects.map((r) => r.x + r.width));
    const minY = Math.min(...allRects.map((r) => r.y));
    const maxY = Math.max(...allRects.map((r) => r.y + r.height));
    expect((maxX - minX) / (maxY - minY)).toBeGreaterThan(1.3);

    // Deterministic across runs.
    expect(computeLayout(doc)).toEqual(layout);
  });

  it('causes zero drift on connected nodes when an isolated node is appended to a nested cloud', () => {
    const base = parse(SINGLE_TOP_MULTI_AZ_VPC).document;
    const withIsolated = parse(
      `${SINGLE_TOP_MULTI_AZ_VPC}\nnode standby_note "Standby Region" [icon: cloud]\n`,
    ).document;
    const baseLayout = computeLayout(base);
    const nextLayout = computeLayout(withIsolated);

    for (const n of base.nodes) {
      expect(nextLayout.nodes[n.id], `drift on ${n.id}`).toEqual(baseLayout.nodes[n.id]);
    }
    for (const g of base.groups) {
      expect(nextLayout.groups[g.id], `drift on ${g.id}`).toEqual(baseLayout.groups[g.id]);
    }
  });

  it('allows sequential sibling subnets with matching node counts to flip independently without stair-stepping', () => {
    const dsl = `
title "Sequential 2-node Subnets"
node client "Client" [icon: users]
group cloud "Cloud" {
  group vpc "VPC" {
    group az "AZ-c" [border: dashed] {
      group app_sub "App Subnet" {
        node search "Search" [icon: search]
        node inv "Inventory" [icon: container]
      }
      group data_sub "Data Subnet" {
        node db "Aurora" [icon: database]
        node cache "Redis" [icon: cache]
      }
    }
  }
}
step "Flow" {
  animate client --> inv : "API"
  animate inv --> db : "Read"
}
`;
    const { layout } = assertContainmentAndDisjointSiblings(dsl);
    const appSub = must(layout.groups.app_sub, 'app_sub');
    const dataSub = must(layout.groups.data_sub, 'data_sub');
    const inv = must(layout.nodes.inv, 'inv');
    const db = must(layout.nodes.db, 'db');

    // Stage 0 (App) and Stage 1 (Data) must not be locked as isomorphic siblings:
    // Data flips independently to level `inv -> db` while keeping both subnet boxes aligned.
    expect(appSub.y).toBe(dataSub.y);
    expect(inv.y).toBe(db.y);
  });

  it('aligns outer widths and subnet column tracks of stacked Multi-AZ siblings with asymmetric app tiers', () => {
    const dsl = `
title "Asymmetric Multi-AZ Alignment"
node client "Client" [icon: users]
group cloud "Cloud" {
  group region "Region" {
    group vpc "Workload VPC" {
      node nlb "Internal NLB" [icon: lb]
      group az_a "AZ-a" [border: dashed] {
        group app_a "App Subnet A" {
          node order "Order Service" [icon: container]
          node pay "Payment Service" [icon: container]
        }
        group data_a "Data Subnet A" {
          node db_a "Aurora Primary" [icon: database]
          node cache_a "Redis Primary" [icon: cache]
        }
      }
      group az_c "AZ-c" [border: dashed] {
        group app_c "App Subnet C" {
          node search "OpenSearch" [icon: search]
          node inv "Inventory Service" [icon: container]
        }
        group data_c "Data Subnet C" {
          node db_c "Aurora Replica" [icon: database]
          node cache_c "Redis Replica" [icon: cache]
        }
      }
    }
  }
}
step "Traffic" {
  animate client --> nlb : "HTTPS"
  animate nlb --> order : "Order"
  animate nlb --> inv : "Inventory" [parallel: true]
  animate order --> pay : "gRPC"
  animate order --> search : "Search" [parallel: true]
  animate order <-> cache_a : "Cache" [parallel: true]
  animate pay <-> db_a : "SQL"
  animate inv --> db_c : "Read" [parallel: true]
  static db_a ..> db_c : "Repl"
  static cache_a ..> cache_c : "Repl"
}
`;
    const { layout } = assertContainmentAndDisjointSiblings(dsl);
    const azA = must(layout.groups.az_a, 'az_a');
    const azC = must(layout.groups.az_c, 'az_c');
    const appA = must(layout.groups.app_a, 'app_a');
    const appC = must(layout.groups.app_c, 'app_c');
    const dataA = must(layout.groups.data_a, 'data_a');
    const dataC = must(layout.groups.data_c, 'data_c');

    expect(azA.x).toBe(azC.x);
    expect(azA.width).toBe(azC.width);
    expect(azA.height).toBe(azC.height);
    expect(appA.x).toBe(appC.x);
    expect(appA.width).toBe(appC.width);
    expect(dataA.x).toBe(dataC.x);
    expect(dataA.width).toBe(dataC.width);
  });

  it('orders same-column sibling regions by first active step and declaration order instead of ID', () => {
    const dsl = `
title "Multi-Region Step Order"
node users "Users" [icon: users]
group cloud "AWS Cloud" {
  node cdn "CloudFront" [icon: cdn]
  group primary_region "Primary Region" {
    group pri_vpc "Primary VPC" {
      node pri_api "Primary API" [icon: container]
      node pri_db "Primary DB" [icon: database]
    }
  }
  group dr_region "DR Region" {
    group dr_vpc "DR VPC" {
      node dr_api "DR API" [icon: container]
      node dr_db "DR DB" [icon: database]
    }
  }
}
step "Active primary" {
  animate users --> cdn : "HTTPS"
  animate cdn --> pri_api : "Active"
  animate pri_api --> pri_db : "R/W"
  static pri_db ..> dr_db : "Replication"
}
step "Failover to DR" {
  animate cdn ..> dr_api : "Failover"
  animate dr_api --> dr_db : "Promoted"
}
`;
    const { layout } = assertContainmentAndDisjointSiblings(dsl);
    const primary = must(layout.groups.primary_region, 'primary_region');
    const dr = must(layout.groups.dr_region, 'dr_region');
    // Step-1 / first-declared `primary_region` sits above `dr_region` even though 'dr_region' < 'primary_region'.
    expect(primary.y).toBeLessThan(dr.y);
  });

  it('packs edge-less auxiliary peer bags into a compact 2D grid and keeps static leaf sources from displacing external callers', () => {
    const bagDsl = `
title "Compact Auxiliary Peer Grid"
node user "User" [icon: users]
group cloud "Cloud" {
  group region "Region" {
    group app_acct "App Account" {
      group vpc_a "VPC A" {
        node svc_a "Service A" [icon: container]
      }
    }
    group data_acct "Data Account" {
      group vpc_b "VPC B" {
        node svc_b "Service B" [icon: database]
      }
    }
    group gov_acct "Governance Account" {
      node g1 "GuardDuty" [icon: shield]
      node g2 "KMS" [icon: key]
      node g3 "Secrets" [icon: vault]
      node g4 "CloudWatch" [icon: monitor]
      node g5 "CloudTrail" [icon: audit]
    }
  }
}
step "Main" {
  animate user --> svc_a : "HTTPS"
  animate svc_a --> svc_b : "Write"
  static vpc_a ..> g4 : "Logs"
  static vpc_b ..> g4 : "Logs"
  static vpc_b ..> g5 : "Audit"
  static g2 ..> vpc_a : "CMK"
  static g3 ..> vpc_b : "Secret"
  static g1 ..> vpc_b : "Detect"
}
`;
    const { layout: bagLayout } = assertContainmentAndDisjointSiblings(bagDsl);
    const gov = must(bagLayout.groups.gov_acct, 'gov_acct');
    // 5 peer nodes pack into a 3x2 grid (wider than tall) rather than a tall 1x5 vertical pole.
    expect(gov.width).toBeGreaterThan(gov.height);

    const staticSourceDsl = `
title "Static Leaf Source Slack"
node partner "Partner" [icon: external]
node billing "Billing" [icon: webhook]
group cloud "Cloud" {
  node api "API GW" [icon: api]
  node sqs "SQS" [icon: queue]
  node kms "KMS" [icon: key]
  node worker "Worker" [icon: function]
}
step "Flow" {
  animate partner --> api : "HTTPS"
  animate api --> sqs : "Enqueue"
  static kms ..> sqs : "Encrypt"
  animate sqs --> worker : "Consume"
  animate worker --> billing : "Callback"
}
`;
    const { layout: colLayout } = assertContainmentAndDisjointSiblings(staticSourceDsl);
    const partner = must(colLayout.nodes.partner, 'partner');
    const cloud = must(colLayout.groups.cloud, 'cloud');
    const billing = must(colLayout.nodes.billing, 'billing');
    // `kms` pulls right beside `sqs` so `partner` stays cleanly to the left of `cloud` and `billing` to its right.
    expect(partner.x + partner.width).toBeLessThanOrEqual(cloud.x);
    expect(billing.x).toBeGreaterThanOrEqual(cloud.x + cloud.width);
  });

  it('stacks leaf multi-AZ peer groups vertically, folds dead-end sidecar sinks, and reclaims vacated border-mount space', () => {
    const leafAzDsl = `
title "Leaf Multi-AZ with Cross-AZ Sync"
node user "User" [icon: users]
group cloud "AWS Cloud" {
  group vpc "App VPC" {
    node alb "ALB" [icon: lb]
    group az_a "AZ-a" {
      node app_a "App A" [icon: container]
      node cache_a "Redis A" [icon: cache]
    }
    group az_b "AZ-b" {
      node app_b "App B" [icon: container]
      node cache_b "Redis B" [icon: cache]
    }
    node bus "MSK" [icon: stream]
  }
}
step "Fan-out" {
  animate user --> alb : "HTTPS"
  animate alb --> app_a : "AZ-a"
  animate alb --> app_b : "AZ-b" [parallel: true]
  animate app_a <-> cache_a : "Read"
  animate app_b <-> cache_b : "Read"
  static cache_a ..> cache_b : "Sync"
}
step "Stream" {
  animate app_a --> bus : "Emit"
  animate bus --> app_b : "Consume"
}
`;
    const { layout: azLayout } = assertContainmentAndDisjointSiblings(leafAzDsl);
    const azA = must(azLayout.groups.az_a, 'az_a');
    const azB = must(azLayout.groups.az_b, 'az_b');
    // Parallel leaf AZs stack in the same horizontal column instead of chaining horizontally across `bus`.
    expect(azA.x).toBe(azB.x);
    expect(azA.y + azA.height).toBeLessThan(azB.y);

    const sidecarDsl = `
title "Dead-End Sidecar Folding"
node client "Client" [icon: mobile]
group onprem "On-Prem DC" {
  node cgw "CGW" [icon: router]
  node core "Core Bank" [icon: server]
}
group cloud "AWS Cloud" {
  node waf "WAF" [icon: firewall]
  group vpc "Payment VPC" {
    group pub "Public Subnet" {
      node alb "ALB" [icon: lb]
    }
    group app "Private App Subnet" {
      node pay "Pay Engine" [icon: container]
      node fraud "Fraud Check" [icon: container]
      node settle "Settler" [icon: container]
    }
    group data "Data Subnet" {
      node db "Aurora" [icon: database]
    }
  }
  group shared "ML & Audit" {
    node ml "SageMaker" [icon: ai]
    node kms "KMS" [icon: key]
    node vault "Audit S3" [icon: storage]
  }
}
step "Pay" {
  animate client --> waf : "HTTPS"
  animate waf --> alb : "Ingress"
  animate alb --> pay : "TX"
  animate pay <-> fraud : "Check"
  animate fraud <-> ml : "Score"
  animate pay <-> kms : "Encrypt"
  animate pay --> db : "Commit"
  animate pay --> settle : "Queue"
  animate settle --> cgw : "DX"
  animate cgw --> core : "Post"
  animate settle --> vault : "Proof"
}
`;
    const { layout: scLayout } = assertContainmentAndDisjointSiblings(sidecarDsl);
    const vpc = must(scLayout.groups.vpc, 'vpc');
    const shared = must(scLayout.groups.shared, 'shared');
    // Dead-end sidecar `shared` folds above/below `vpc` rather than sitting right of `vpc` and blocking `onprem`.
    const stackedVertically = shared.y >= vpc.y + vpc.height || shared.y + shared.height <= vpc.y;
    expect(stackedVertically).toBe(true);

    const borderReclaimDsl = `
title "Border Mount Vacated Margin Reclamation"
node south_caller "South Caller" [icon: users]
node east_target "East Target" [icon: server]
group vpc "Core VPC" {
  node igw "IGW" [icon: router, mount: border]
  node app "App" [icon: container]
  node db "DB" [icon: database]
}
step "Main" {
  animate south_caller --> igw : "In"
  animate igw --> app : "Forward"
  animate app --> db : "Save"
  animate db --> east_target : "Export"
}
`;
    const doc = parse(borderReclaimDsl).document;
    const base = computeLayout(doc);
    // Simulate `south_caller` positioned below `vpc` while `igw` started inside on the left of `app`:
    // `applyBorderMounts` relocates `igw` to the bottom border and reclaims the vacated left margin.
    const rVpc0 = must(base.groups.vpc, 'vpc');
    const rApp0 = must(base.nodes.app, 'app');
    const rDb0 = must(base.nodes.db, 'db');
    const shifted = applyBorderMounts(doc, {
      nodes: {
        ...base.nodes,
        south_caller: { x: rApp0.x, y: rVpc0.y + rVpc0.height + 160, width: 100, height: 90 },
        igw: { x: rApp0.x - 160, y: rApp0.y, width: 100, height: 90 },
      },
      groups: {
        ...base.groups,
        vpc: {
          x: rApp0.x - 180,
          y: rVpc0.y,
          width: rDb0.x + rDb0.width + 20 - (rApp0.x - 180),
          height: rVpc0.height,
        },
      },
    });
    const rVpc = must(shifted.groups.vpc, 'vpc');
    const rApp = must(shifted.nodes.app, 'app');
    expect(rApp.x - rVpc.x).toBeLessThanOrEqual(24);
  });

  it('stacks composite Multi-AZ peers vertically when the shared distributor sits inside AZ-A, without folding sequential pipelines', () => {
    const internalAlbDsl = `
title "Internal ALB Multi-AZ Peer Stacking"
node client "Client" [icon: users]
group cloud "AWS Cloud" {
  group vpc "Core VPC" {
    node igw "IGW" [icon: router]
    node vpce "VPC Endpoint" [icon: shield]
    group az_a "Availability Zone A" [border: dashed] {
      group pub_a "Public Subnet A" {
        node alb "ALB" [icon: lb]
      }
      group app_a "App Subnet A" {
        node app1 "App A1" [icon: container]
        node app2 "App A2" [icon: container]
      }
      group db_a "DB Subnet A" {
        node db_pri "Primary DB" [icon: database]
      }
    }
    group az_b "Availability Zone B" [border: dashed] {
      group app_b "App Subnet B" {
        node app_b1 "App B1" [icon: container]
        node app_b2 "App B2" [icon: container]
      }
      group db_b "DB Subnet B" {
        node db_sby "Standby DB" [icon: database]
      }
    }
  }
  group backup "Backup" {
    node s3 "S3" [icon: storage]
  }
}
step "Normal" {
  static db_pri ..> db_sby : "Replicate"
  animate client --> igw : "HTTPS"
  animate igw --> alb : "Ingress"
  animate alb --> app1 : "Route A"
  animate app1 --> app2 : "Order"
  animate app1 <-> db_pri : "CRUD"
  animate app2 <-> db_pri : "Commit"
  animate app1 --> vpce : "Upload"
  animate vpce --> s3 : "Store"
}
step "Failover" {
  animate alb --> app_b1 : "Failover B"
  animate app_b1 --> app_b2 : "Order B"
  animate app_b1 ..> db_sby : "Read B"
  animate app_b2 ..> db_sby : "Write B"
}
`;
    const { layout } = assertContainmentAndDisjointSiblings(internalAlbDsl);
    const azA = must(layout.groups.az_a, 'az_a');
    const azB = must(layout.groups.az_b, 'az_b');
    const vpce = must(layout.nodes.vpce, 'vpce');
    // AZ-B stacks vertically beneath AZ-A instead of sliding right beside vpce.
    expect(azB.y).toBeGreaterThanOrEqual(azA.y + azA.height);
    expect(azB.x).toBeLessThan(vpce.x);

    // Negative check: sequential composite stages (exit node -> next tier, NOT an entry fan-out)
    // must remain side-by-side even when a static link also connects them.
    const sequentialDsl = `
title "Sequential Composite Tiers"
node client "Client" [icon: users]
group cloud "Cloud" {
  group vpc "VPC" {
    group frontend "Frontend Tier" {
      group fe_in "FE Ingress" {
        node fe_web "Web" [icon: server]
      }
      group fe_out "FE BFF" {
        node fe_bff "BFF" [icon: api]
      }
    }
    group backend "Backend Tier" {
      group be_svc "BE Service" {
        node be_api "API" [icon: container]
      }
      group be_db "BE Data" {
        node be_store "Store" [icon: database]
      }
    }
  }
}
step "Main" {
  static fe_web ..> be_store : "Audit"
  animate client --> fe_web : "HTTP"
  animate fe_web --> fe_bff : "Proxy"
  animate fe_bff --> be_api : "RPC"
  animate be_api --> be_store : "Write"
}
`;
    const { layout: seqLayout } = assertContainmentAndDisjointSiblings(sequentialDsl);
    const fe = must(seqLayout.groups.frontend, 'frontend');
    const be = must(seqLayout.groups.backend, 'backend');
    expect(fe.x + fe.width).toBeLessThanOrEqual(be.x);
  });

  it('prevents a late-step nested feedback edge from pushing an earlier core stage rightward', () => {
    const feedbackDsl = `
title "Nested Feedback Cycle"
node user "User" [icon: users]
group cloud "Cloud" {
  group edge "Edge" {
    node cdn "CDN" [icon: cdn]
    node waf "WAF" [icon: firewall]
  }
  group core "Core VPC" {
    group core_a "AZ A" {
      node api "API" [icon: container]
      node db "DB" [icon: database]
    }
  }
  group events "Events" {
    node queue "Queue" [icon: queue]
    node stream "Stream" [icon: stream]
  }
  group ml "Lakehouse & ML" {
    node lake "Lake" [icon: storage]
    node model "Model" [icon: ai]
  }
}
step "1. Core" {
  animate user --> cdn : "HTTP"
  animate cdn --> waf : "Filter"
  animate waf --> api : "Route"
  animate api <-> db : "Commit"
}
step "2. Queue" {
  animate api --> queue : "Publish"
  animate queue --> api : "Consume"
}
step "3. Stream to Lake" {
  animate queue --> stream : "Emit"
  animate stream --> lake : "Land"
}
step "4. ML Feedback" {
  animate lake --> model : "Train"
  animate model ..> api : "Forecast"
}
`;
    const { layout } = assertContainmentAndDisjointSiblings(feedbackDsl);
    const edge = must(layout.groups.edge, 'edge');
    const core = must(layout.groups.core, 'core');
    const ml = must(layout.groups.ml, 'ml');
    // Core stays directly to the right of Edge, and Lakehouse/ML stays downstream (not wedged between Edge and Core).
    expect(edge.x).toBeLessThan(core.x);
    expect(core.x).toBeLessThanOrEqual(ml.x);
  });

  it('preserves declared top-to-bottom order of stacked Multi-AZ peers and keeps standby AZ out of auxiliary', () => {
    // Case 1: Active/Active where Step 1 visits AZ-B before Step 2 visits AZ-A.
    const stepBFirstDsl = `
title "AZ-B First Active-Active"
node client "Client" [icon: users]
group cloud "Cloud" {
  group vpc "VPC" {
    node alb "ALB" [icon: lb]
    group az_a "Availability Zone A" [border: dashed] {
      group priv_a "Private A" {
        node app_a "App A" [icon: container]
        node db_a "DB Pri" [icon: database]
      }
    }
    group az_b "Availability Zone B" [border: dashed] {
      group priv_b "Private B" {
        node app_b "App B" [icon: container]
        node db_b "DB Sby" [icon: database]
      }
    }
  }
}
step "Read via AZ-B" {
  static db_a ..> db_b : "Sync"
  animate client --> alb : "HTTPS"
  animate alb --> app_b : "Read"
  animate app_b --> db_b : "Select"
}
step "Write via AZ-A" {
  animate alb --> app_a : "Write"
  animate app_a --> db_a : "Insert"
}
`;
    const { layout: l1 } = assertContainmentAndDisjointSiblings(stepBFirstDsl);
    const azA1 = must(l1.groups.az_a, 'az_a');
    const azB1 = must(l1.groups.az_b, 'az_b');
    expect(azA1.y + azA1.height).toBeLessThanOrEqual(azB1.y);

    // Case 2: Active/Standby where AZ-B connects only via static standby route + replication.
    const standbyDsl = `
title "Active-Standby Multi-AZ"
node client "Client" [icon: users]
group cloud "Cloud" {
  group vpc "VPC" {
    node alb "ALB" [icon: lb]
    group az_a "Availability Zone A" [border: dashed] {
      group app_sub_a "App A" {
        node app_a "API A" [icon: container]
      }
      group db_sub_a "Data A" {
        node db_a "DB Pri" [icon: database]
        node cache_a "Cache" [icon: cache]
      }
    }
    group az_b "Availability Zone B" [border: dashed] {
      group app_sub_b "App B" {
        node app_b "API B" [icon: container]
      }
      group db_sub_b "Data B" {
        node db_b "DB Sby" [icon: database]
      }
    }
  }
}
step "Serve" {
  static alb ..> app_b : "Standby"
  static db_a ..> db_b : "Replicate"
  animate client --> alb : "HTTPS"
  animate alb --> app_a : "Active"
  animate app_a --> db_a : "SQL"
  animate app_a --> cache_a : "Cache"
  animate app_b --> db_b : "Read"
}
`;
    const { layout: l2 } = assertContainmentAndDisjointSiblings(standbyDsl);
    const azA2 = must(l2.groups.az_a, 'az_a');
    const azB2 = must(l2.groups.az_b, 'az_b');
    expect(azA2.x).toBe(azB2.x);
    expect(azA2.width).toBe(azB2.width);
    expect(azA2.y + azA2.height).toBeLessThanOrEqual(azB2.y);
  });

  it('keeps earlier-entered tiers upstream on equal-count mutual primary links and folds wide dual-entry ribbons', () => {
    // 1. Equal-count 1-vs-1 mutual primary edges between Storage (Step 1) and ML/Ops (Step 2):
    // Storage stays left of ML/Ops instead of being pushed right by a Step-3 read query.
    const mutualTieDsl = `
title "Mutual Primary Tie-Break"
group edge "Factory" {
  node sensor "Sensor" [icon: device]
}
group cloud "Cloud" {
  group ingest "Ingestion" {
    node broker "Broker" [icon: hub]
    node fn "Processor" [icon: function]
  }
  group storage "Storage" {
    node tsdb "TSDB" [icon: database]
    node lake "Lake" [icon: storage]
    node etl "ETL" [icon: logic]
  }
  group ml_ops "ML & Ops" {
    node dash "Dashboard" [icon: screen]
    node bus "EventBus" [icon: event]
    node ml "Model" [icon: ai]
  }
}
node crew "Crew" [icon: users]
step "Ingest" {
  animate sensor --> broker : "MQTT"
  animate broker --> fn : "Batch"
  animate broker --> lake : "Archive"
  animate fn --> tsdb : "Metrics"
}
step "Detect" {
  animate fn <-> ml : "Score"
  animate fn --> bus : "Alert"
  animate bus --> crew : "Page"
}
step "Query" {
  animate dash --> tsdb : "Read"
}
step "Retrain" {
  animate lake --> etl : "Prep"
  animate etl ..> ml : "Train"
}
`;
    const { layout: mLayout } = assertContainmentAndDisjointSiblings(mutualTieDsl);
    const ingest = must(mLayout.groups.ingest, 'ingest');
    const storage = must(mLayout.groups.storage, 'storage');
    const mlOps = must(mLayout.groups.ml_ops, 'ml_ops');
    expect(ingest.x).toBeLessThan(storage.x);
    expect(storage.x).toBeLessThan(mlOps.x);

    // 2. Wide 4-column nested ribbon where the trailing large VPC is also fed directly by col 0
    // and connects to external peers: fold the trailing VPC into column 1 beside the streaming tier.
    const dualEntryRibbonDsl = `
title "Dual-Entry Wide Ribbon Fold"
group onprem "On-Prem" {
  node plant "Plant" [icon: device]
  node erp "ERP" [icon: server]
  node cgw "CGW" [icon: router]
}
group cloud "Cloud" {
  group edge "Edge & IoT" {
    node cdn "CDN" [icon: cdn]
    node iot "IoT" [icon: hub]
  }
  group vpc "Production VPC" {
    node igw "IGW" [icon: router]
    node dx "DX" [icon: router]
    node vpce "VPCE" [icon: nat]
    node alb "ALB" [icon: lb]
    group az_a "AZ A" {
      group app_a "App A" {
        node api_a "API A" [icon: container]
      }
      group db_a "Data A" {
        node db_pri "DB Pri" [icon: database]
        node cache_pri "Cache" [icon: cache]
      }
    }
  }
  group stream "Streaming & ML" {
    node kin "Kinesis" [icon: stream]
    node flink "Flink" [icon: logic]
    node s3 "S3" [icon: storage]
    node glue "Glue" [icon: warehouse]
    node ml "ML" [icon: ai]
  }
  group ops "Workflows" {
    node bus "Bus" [icon: event]
    node wf "Workflow" [icon: logic]
    node q "Queue" [icon: queue]
    node sns "SNS" [icon: mail]
  }
}
node tech "Tech" [icon: mobile]
step "1. Stream" {
  animate plant --> iot : "MQTT"
  animate iot --> kin : "Rule"
  animate kin --> flink : "Window"
  animate kin --> s3 : "Archive"
  animate s3 --> glue : "Prep"
  animate glue --> ml : "Train"
}
step "2. Workflow to VPC" {
  animate flink --> bus : "Alert"
  animate bus --> wf : "Start"
  animate wf --> q : "Enqueue"
  animate wf --> sns : "Notify"
  animate sns --> tech : "Push"
  animate q --> vpce : "Poll"
  animate vpce <-> api_a : "WO"
  animate api_a --> dx : "Sync"
  animate dx <-> cgw : "DX"
  animate cgw <-> erp : "Order"
}
step "3. Direct Edge to VPC" {
  animate cdn --> igw : "API"
  animate igw --> alb : "TLS"
  animate alb --> api_a : "Route"
  animate api_a --> db_pri : "SQL"
  animate api_a --> cache_pri : "Cache"
}
`;
    const { layout: rLayout } = assertContainmentAndDisjointSiblings(dualEntryRibbonDsl);
    const edgeG = must(rLayout.groups.edge, 'edge');
    const vpcG = must(rLayout.groups.vpc, 'vpc');
    const streamG = must(rLayout.groups.stream, 'stream');
    const opsG = must(rLayout.groups.ops, 'ops');
    // VPC folds into column 1 beside Streaming (not stranded in column 3 right of Workflows).
    expect(edgeG.x).toBeLessThan(vpcG.x);
    expect(vpcG.x).toBeLessThan(opsG.x);
    const stackedVertically =
      vpcG.y + vpcG.height <= streamG.y || streamG.y + streamG.height <= vpcG.y;
    expect(stackedVertically).toBe(true);
  });
});

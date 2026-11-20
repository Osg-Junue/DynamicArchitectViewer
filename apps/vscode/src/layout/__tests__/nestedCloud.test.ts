import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
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
});

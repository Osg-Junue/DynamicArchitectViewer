import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { computeLayout, rectOverlaps, stationRect } from '../../layout';
import { calloutRect, computePacketCalloutBox } from '../callout';
import { wholeDiagramFrame } from '../framing';
import { nodeBody } from '../rails';
import { resolveView } from '../resolve';
import { type RouteEdge, type RouteGroup, type RouteNode, routeEdges } from '../route';
import { textCuts } from '../textCuts';

const makeNode = (cx: number, cy: number, areaWidth = 96): RouteNode => ({
  station: { x: cx - 22, y: cy - 22, width: 44, height: 44 },
  area: { x: cx - areaWidth / 2, y: cy - 22, width: areaWidth, height: 84 },
  badge: { x: cx - areaWidth / 2, y: cy - 55, width: areaWidth, height: 20 },
});

const makeEdge = (id: string, from: number, to: number, home: number[] = []): RouteEdge => ({
  id,
  from,
  to,
  home: new Set(home),
});

function must<T>(value: T | undefined, label: string): T {
  expect(value, label).toBeDefined();
  if (value === undefined) throw new Error(`Missing ${label}`);
  return value;
}

describe('routing border clearance, port spacing, framing, and dimmed callout avoidance', () => {
  it('avoids running routed segments parallel within < 5px of nested group borders', () => {
    const dsl = `
      title "Nested Border Clearance"
      group outer "Outer Account" {
        group mid_a "Zone A" {
          group sub_a1 "Subnet A1 (10.0.1.0/24)" {
            node a1 "Service A1" [icon: server]
          }
          group sub_a2 "Subnet A2 (10.0.2.0/24)" {
            node a2 "Service A2" [icon: server]
          }
        }
        group mid_b "Zone B" {
          group sub_b1 "Subnet B1 (10.0.3.0/24)" {
            node b1 "Database B1" [icon: database]
          }
          group sub_b2 "Subnet B2 (10.0.4.0/24)" {
            node b2 "Database B2" [icon: database]
          }
        }
      }
      step "Cross-zone traffic" {
        animate a1 --> b1 : "Primary"
        animate a1 --> b2 : "Secondary"
        animate a2 --> b1 : "Failover"
        animate a2 --> b2 : "Replica"
      }
    `;
    const doc = parse(dsl).document;
    const layout = computeLayout(doc);
    const view = resolveView(doc, layout, null);

    let borderHugs = 0;
    for (const e of view.edges) {
      if (!('points' in e.path)) continue;
      const pts = e.path.points;
      const fromNode = must(
        view.nodes.find((n) => n.id === e.from),
        e.from,
      );
      const toNode = must(
        view.nodes.find((n) => n.id === e.to),
        e.to,
      );
      const fc = stationRect(fromNode.rect, fromNode.icon);
      const tc = stationRect(toNode.rect, toNode.icon);
      const fcy = fc.y + fc.height / 2;
      const tcy = tc.y + tc.height / 2;
      const fcx = fc.x + fc.width / 2;
      const tcx = tc.x + tc.width / 2;

      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        if (!a || !b) continue;
        const horiz = Math.abs(a.y - b.y) < 0.5;
        const vert = Math.abs(a.x - b.x) < 0.5;
        for (const g of view.groups) {
          const r = g.rect;
          if (horiz) {
            if (Math.abs(a.y - fcy) < 1 || Math.abs(a.y - tcy) < 1) continue;
            const ov =
              Math.min(Math.max(a.x, b.x), r.x + r.width) - Math.max(Math.min(a.x, b.x), r.x);
            if (ov >= 20 && (Math.abs(a.y - r.y) < 5 || Math.abs(a.y - (r.y + r.height)) < 5)) {
              borderHugs++;
            }
          } else if (vert) {
            if (Math.abs(a.x - fcx) < 1 || Math.abs(a.x - tcx) < 1) continue;
            const ov =
              Math.min(Math.max(a.y, b.y), r.y + r.height) - Math.max(Math.min(a.y, b.y), r.y);
            if (ov >= 20 && (Math.abs(a.x - r.x) < 5 || Math.abs(a.x - (r.x + r.width)) < 5)) {
              borderHugs++;
            }
          }
        }
      }
    }

    expect(borderHugs).toBe(0);
  });

  it('keeps spread bundles outside parallel group borders and spaces crowded arrowheads apart', () => {
    // 3 sources entering the left side of target node 3 (walls above and below node 3 funnel
    // all 3 arrivals onto the left face so arrowhead spacing is exercised directly).
    const nodes: RouteNode[] = [
      makeNode(100, 100),
      makeNode(100, 260),
      makeNode(100, 420),
      makeNode(500, 260),
    ];
    const groups: RouteGroup[] = [{ rect: { x: 250, y: 40, width: 140, height: 460 }, depth: 0 }];
    const walls = [
      { x: 460, y: 120, width: 100, height: 80 },
      { x: 460, y: 340, width: 100, height: 80 },
    ];
    const edges = [makeEdge('e0', 0, 3, [0]), makeEdge('e1', 1, 3, [0]), makeEdge('e2', 2, 3, [0])];
    const rails = routeEdges(nodes, groups, walls, edges);

    // Collect arrival y-coordinates on the left side of node 3.
    const leftArrivals = [...rails.values()]
      .flatMap((r) => {
        const last = r.points[r.points.length - 1];
        const prev = r.points[r.points.length - 2];
        return last && prev && Math.abs(last.y - prev.y) < 0.5 && prev.x < last.x ? [last.y] : [];
      })
      .sort((a, b) => a - b);

    expect(leftArrivals.length).toBe(3);
    for (let i = 1; i < leftArrivals.length; i++) {
      expect(
        must(leftArrivals[i], 'y') - must(leftArrivals[i - 1], 'prev y'),
      ).toBeGreaterThanOrEqual(8.5);
    }

    // 4 rails leaving the bottom of node 0 into 4 targets below (walls block left/right/top
    // departures so all 4 exit the bottom face and exercise the wider bottom port span >= 9.5px).
    const fanNodes: RouteNode[] = [
      makeNode(400, 100),
      makeNode(160, 400),
      makeNode(320, 400),
      makeNode(480, 400),
      makeNode(640, 400),
    ];
    const fanWalls = [
      { x: 260, y: 20, width: 70, height: 150 },
      { x: 470, y: 20, width: 70, height: 150 },
      { x: 330, y: 20, width: 140, height: 40 },
    ];
    const fanEdges = [
      makeEdge('b1', 0, 1),
      makeEdge('b2', 0, 2),
      makeEdge('b3', 0, 3),
      makeEdge('b4', 0, 4),
    ];
    const fanRails = routeEdges(fanNodes, [], fanWalls, fanEdges);
    const bottomDepartures = [...fanRails.values()]
      .flatMap((r) => {
        const p0 = r.points[0];
        const p1 = r.points[1];
        return p0 && p1 && Math.abs(p0.x - p1.x) < 0.5 && p1.y > p0.y ? [p0.x] : [];
      })
      .sort((a, b) => a - b);

    expect(bottomDepartures.length).toBe(4);
    for (let i = 1; i < bottomDepartures.length; i++) {
      expect(
        must(bottomDepartures[i], 'x') - must(bottomDepartures[i - 1], 'prev x'),
      ).toBeGreaterThanOrEqual(9.5);
    }
  });

  it('distributes high-degree hub fan-out across multiple sides once a face fills up', () => {
    const hub = makeNode(120, 420);
    const targets = Array.from({ length: 7 }, (_, i) => makeNode(520, 60 + i * 120));
    const nodes = [hub, ...targets];
    const edges = targets.map((_, i) => makeEdge(`e${i}`, 0, i + 1));
    const rails = routeEdges(nodes, [], [], edges);

    const sidesUsed = new Map<string, number>();
    for (const r of rails.values()) {
      const a = r.points[0];
      const b = r.points[1];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const side = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : dy > 0 ? 'D' : 'U';
      sidesUsed.set(side, (sidesUsed.get(side) ?? 0) + 1);
    }

    expect(sidesUsed.size).toBeGreaterThanOrEqual(2);
    expect(Math.max(...sidesUsed.values())).toBeLessThanOrEqual(5);
  });

  it('reports zero text cuts for long subnet CIDR group labels and 2-line node labels', () => {
    const dsl = `
      title "Long Cloud Labels"
      group vpc "Production VPC (10.0.0.0/16)" {
        group pub "Public Subnet A (10.0.1.0/24)" {
          node alb "Application Load Balancer" [icon: lb, sub: "HTTPS :443"]
        }
        group priv "Private App Subnet A (10.0.11.0/24)" {
          node tgw "AWS Transit Gateway" [icon: router, sub: "Hub Router"]
        }
      }
      step "Route" {
        animate alb --> tgw : "Forward"
      }
    `;
    const doc = parse(dsl).document;
    const layout = computeLayout(doc);
    expect(textCuts(doc, layout)).toEqual([]);
  });

  it('omits extra speech-bubble headroom in overview framing while keeping badges and rails inside', () => {
    const dsl = `
      title "Tight Overview Framing"
      node a "Ingress" [icon: client]
      node b "Backend" [icon: server]
      step "Request" {
        animate a --> b : "GET /"
      }
    `;
    const doc = parse(dsl).document;
    const layout = computeLayout(doc);
    const overview = resolveView(doc, layout, null);
    const frame = wholeDiagramFrame(layout, overview).rect;
    const minContentY = Math.min(...Object.values(layout.nodes).map((r) => r.y));

    // Top margin should be SCENE_PADDING (48), not SCENE_PADDING + BUBBLE_HEADROOM (124).
    expect(minContentY - frame.y).toBeLessThan(64);
    expect(minContentY - frame.y).toBeGreaterThanOrEqual(48 - 1e-6);
  });

  it('avoids placing a step callout over a dimmed node when free space exists on the other side of the rail', () => {
    const dsl = `
      title "Dimmed Node Avoidance"
      node src "Client" [icon: client]
      node dst "Target" [icon: server]
      node bystander "Customer Gateway" [icon: router]
      step "Background link" {
        static src --> bystander : "Backup"
        static bystander --> dst : "Backup"
      }
      step "Primary call" {
        focus src, dst
        animate src --> dst : "Direct HTTPS" [desc: "Routes directly from Client to Target without covering the dimmed bystander node"]
      }
    `;
    const doc = parse(dsl).document;
    const layout = computeLayout(doc);
    // Position `bystander` directly above the midpoint of `src -> dst` so a naive callout above the rail would cover it.
    const srcR = must(layout.nodes.src, 'src');
    const dstR = must(layout.nodes.dst, 'dst');
    layout.nodes.bystander = {
      x: (srcR.x + dstR.x) / 2,
      y: Math.min(srcR.y, dstR.y) - 130,
      width: srcR.width,
      height: srcR.height,
    };

    const view = resolveView(doc, layout, 1);
    const dimmed = must(
      view.nodes.find((n) => n.id === 'bystander'),
      'bystander',
    );
    expect(dimmed.dimmed).toBe(true);

    const pkt = view.phases[0]?.[0];
    expect(pkt).toBeDefined();
    const box = pkt ? computePacketCalloutBox(pkt) : undefined;
    expect(box).toBeDefined();
    if (box) {
      const cr = calloutRect(box);
      const overlapsDimmed = nodeBody(dimmed).some((body) => rectOverlaps(cr, body));
      expect(overlapsDimmed).toBe(false);
    }
  });

  it('keeps intra-group routes inside their shared LCA container (both nested and top-level)', () => {
    const buildBody = (wrapped: boolean) => {
      const inner = `
        group pay_vpc "Payment VPC" {
          node tgw "TGW Attach" [icon: router, mount: border]
          node alb "Application LB" [icon: lb]
          group az_a "AZ-a" {
            node pay_a "Payment API A" [icon: container]
            node settle_a "Settlement A" [icon: container]
          }
          group az_b "AZ-b" {
            node pay_b "Payment API B" [icon: container]
          }
        }
        node hub "Transit Hub" [icon: hub]
        step "Route" {
          animate alb --> pay_a : "Route A"
          animate alb --> pay_b : "Route B" [parallel: true]
          animate pay_a --> tgw : "Check A"
          animate settle_a --> tgw : "Clear A"
          animate pay_b --> tgw : "Check B"
          animate tgw --> hub : "Mesh"
        }
      `;
      return wrapped
        ? `title "Nested VPC"\ngroup org "AWS Org" {\n${inner}\n}`
        : `title "Top-Level VPC"\n${inner}`;
    };

    for (const wrapped of [true, false]) {
      const doc = parse(buildBody(wrapped)).document;
      const layout = computeLayout(doc);
      const view = resolveView(doc, layout, null);
      const vpc = must(
        view.groups.find((g) => g.id === 'pay_vpc'),
        `pay_vpc (wrapped=${wrapped})`,
      ).rect;
      const intra = ['alb->pay_b', 'pay_a->tgw', 'settle_a->tgw', 'pay_b->tgw'];
      for (const pair of intra) {
        const [from, to] = pair.split('->');
        const edge = must(
          view.edges.find(
            (e) => (e.from === from && e.to === to) || (e.from === to && e.to === from),
          ),
          `${pair} (wrapped=${wrapped})`,
        );
        expect('points' in edge.path).toBe(true);
        if (!('points' in edge.path)) continue;
        for (const pt of edge.path.points) {
          expect(pt.x, `${pair} x inside vpc`).toBeGreaterThanOrEqual(vpc.x - 2);
          expect(pt.x, `${pair} x inside vpc`).toBeLessThanOrEqual(vpc.x + vpc.width + 2);
          expect(pt.y, `${pair} y inside vpc`).toBeGreaterThanOrEqual(vpc.y - 2);
          expect(pt.y, `${pair} y inside vpc`).toBeLessThanOrEqual(vpc.y + vpc.height + 2);
        }
      }
    }
  });

  it('keeps spread parallel rails clear of wide node labelArea boxes', () => {
    // Obstacle node 0 has a wide labelArea (160px wide, x: 220..380) wider than its 96px area.
    // Five vertical routes share the grid line just left of labelArea (x = 208) and spread apart;
    // none may shift right into labelArea (x >= 220).
    const obstacle: RouteNode = {
      station: { x: 278, y: 278, width: 44, height: 44 },
      area: { x: 252, y: 266, width: 96, height: 84 },
      labelArea: { x: 220, y: 322, width: 160, height: 32 },
      badge: { x: 252, y: 245, width: 96, height: 20 },
    };
    const topSources = Array.from({ length: 5 }, (_, i) => makeNode(100, 60 + i * 30));
    const botTargets = Array.from({ length: 5 }, (_, i) => makeNode(480, 420 + i * 30));
    const nodes: RouteNode[] = [obstacle, ...topSources, ...botTargets];
    // Funnel all 5 routes through the gap between x=170 and obstacle's wide labelArea (x=220).
    const walls = [
      { x: 140, y: 240, width: 30, height: 140 },
      { x: 390, y: 240, width: 160, height: 140 },
    ];
    const edges = topSources.map((_, i) => makeEdge(`r${i}`, 1 + i, 6 + i));
    const rails = routeEdges(nodes, [], walls, edges);

    const la = must(obstacle.labelArea, 'labelArea');
    for (const [id, rail] of rails) {
      for (let i = 0; i + 1 < rail.points.length; i++) {
        const a = rail.points[i];
        const b = rail.points[i + 1];
        if (!a || !b) continue;
        const minX = Math.min(a.x, b.x);
        const maxX = Math.max(a.x, b.x);
        const minY = Math.min(a.y, b.y);
        const maxY = Math.max(a.y, b.y);
        const overlapsLabel =
          maxX > la.x + 0.5 &&
          minX < la.x + la.width - 0.5 &&
          maxY > la.y + 0.5 &&
          minY < la.y + la.height - 0.5;
        expect(overlapsLabel, `${id} segment must not enter wide labelArea`).toBe(false);
      }
    }
  });

  it('avoids placing edge labels over group border lines when clear space exists along the rail', () => {
    const dsl = `
      title "Border-Clear Edge Labels"
      node client "Client" [icon: client]
      group vpc "Payment VPC" {
        node api "Payment API" [icon: api]
        node db "Ledger DB" [icon: database]
      }
      step "Flow" {
        static client --> api : "HTTPS Ingress"
        static api --> db : "Persist"
      }
    `;
    const doc = parse(dsl).document;
    const layout = computeLayout(doc);
    const view = resolveView(doc, layout, 0);
    const vpc = must(
      view.groups.find((g) => g.id === 'vpc'),
      'vpc',
    ).rect;
    const ingress = must(
      view.edges.find((e) => e.from === 'client' && e.to === 'api'),
      'client->api',
    );
    const spot = must(ingress.labelAt, 'labelAt');
    // Label should sit clearly to the left or right of vpc's left border rather than straddling x = vpc.x.
    expect(Math.abs(spot.x - vpc.x)).toBeGreaterThan(20);
  });
});

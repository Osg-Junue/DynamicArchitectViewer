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
});

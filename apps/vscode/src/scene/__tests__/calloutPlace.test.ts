import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { computeLayout, type Rect, rectContains, rectOverlaps } from '../../layout';
import { SAMPLE_TEMPLATES } from '../../samples';
import { CALLOUT_GAP } from '../callout';
import { pointAt } from '../geometry';
import {
  calloutRect,
  calmFrame,
  computePacketCalloutBox,
  framePose,
  type Packet,
  packetsOnScreen,
  resolveView,
  visibleWorld,
  wholeDiagramFrame,
} from '../index';
import { edgeLabelArea } from '../rails';
import {
  buildPacket,
  closedAreas,
  covers,
  findAll,
  nameStrips,
  nodeParts,
  overlap,
  readExample,
} from './helpers';

describe('where the callouts of a step are placed', () => {
  it('separates parallel callouts cleanly when one or both carry multi-line code blocks', () => {
    const doc = parse(
      'dav 1\nnode a\nnode b\nnode c\na --> b\na --> c\nstep "P" {\n  animate a --> b : "Write"\n  animate a --> c : "Audit" [parallel: true]\n}\n',
    ).document;
    const anim0 = doc.steps[0]?.animations[0];
    const anim1 = doc.steps[0]?.animations[1];
    if (!anim0 || !anim1) throw new Error('missing animations');
    anim0.description = 'Primary DBへ注文レコードを書き込み';
    anim0.code = {
      lang: 'json',
      title: 'Primary Write',
      body: '{\n  "orderId": "ord_01",\n  "amount": 14800\n}',
    };
    anim1.description = '監査ログへイベント送信';
    anim1.code = {
      lang: 'json',
      title: 'Audit Event',
      body: '{\n  "event": "order.created",\n  "actor": "usr_9"\n}',
    };

    const resolved = resolveView(doc, computeLayout(doc), 0);
    const phase = resolved.phases[0] ?? [];
    expect(phase).toHaveLength(2);
    const [b0, b1] = phase.map((p) => computePacketCalloutBox(p));
    expect(b0).not.toBeNull();
    expect(b1).not.toBeNull();
    if (!b0 || !b1) return;
    expect(overlap(b0, b1)).toBe(false);
  });

  it('includes tall and parallel code callouts in packetsOnScreen, calmFrame, and wholeDiagramFrame', () => {
    const doc = parse(
      'dav 1\ngroup z1 "Zone 1" { node a }\ngroup z2 "Zone 2" { node b }\na --> b\nstep "S" {\n  animate a --> b : "POST"\n  animate a --> b : "Parallel" [parallel: true]\n}\n',
    ).document;
    const tallBody = Array.from({ length: 9 }, (_, i) => `  "field_${i}": "value_${i}"`).join(
      ',\n',
    );
    for (const anim of doc.steps[0]?.animations ?? []) {
      anim.description = '長い日本語の説明文 — エッジからバックエンドへ転送 → 検証完了…';
      anim.code = { lang: 'json', title: 'Tall Payload', body: `{\n${tallBody}\n}` };
    }
    const l = computeLayout(doc);
    const v = resolveView(doc, l, 0);
    const packets = v.phases[0] ?? [];
    const callouts = packets.flatMap((p) => computePacketCalloutBox(p) ?? []).map(calloutRect);
    expect(callouts).toHaveLength(2);

    const canvas = { width: 960, height: 540 };
    const calm = calmFrame(canvas, l, packets);
    expect(calm).not.toBeNull();
    if (!calm) return;
    const calmWorld = visibleWorld(canvas, framePose(canvas, calm));
    for (const rect of callouts) {
      expect(rectContains(calmWorld, rect)).toBe(true);
    }
    expect(packetsOnScreen(l, packets, calmWorld)).toBe(true);

    // A clipped world that cuts off the top of the tall code callout triggers camera follow
    const clippedWorld: Rect = {
      ...calmWorld,
      y: (callouts[0]?.y ?? 0) + 30,
      height: calmWorld.height,
    };
    expect(packetsOnScreen(l, packets, clippedWorld)).toBe(false);

    const whole = wholeDiagramFrame(l, v);
    for (const rect of callouts) {
      expect(rectContains(whole.rect, rect)).toBe(true);
    }
  });

  it('keeps callouts off the strip a zone name moves along and off the stations of the row above', () => {
    const dsl = `dav 1
node src "Source"
group g "Z" {
  node r0 "Top Row Station" [icon: screen, sub: "Preview"]
  node r1a "Exporter" [icon: storage]
  node r1b "Output" [icon: browser]
  node far "Rightmost Station" [icon: server]
}
src --> r0
src --> r1a
r0 --> far
r1a --> r1b
step "RightHalfOverZone" {
  animate r0 --> far : "Cross" [desc: "Callout positioned over the right half of zone g far past its short title"]
}
step "Row1UnderRow0" {
  animate r1a --> r1b : "exportHtml(dsl)" [icon: key, desc: "Writes standalone HTML"] {
    code html "Standalone HTML" \`\`\`
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'">
      <script type="application/json" id="dav-data">...</script>
    \`\`\`
  }
}
`;
    const { document: doc } = parse(dsl);
    const l = computeLayout(doc);
    // Step 0: the rail runs along the top row of the zone, right under the strip its name
    // moves along. The strip is closed along its whole width, not only where the name stands.
    const rightView = resolveView(doc, l, 0);
    const rightPkt = rightView.phases[0]?.[0];
    const rightBox = rightPkt && computePacketCalloutBox(rightPkt);
    expect(rightBox).toBeDefined();
    if (rightBox) expect(covers(rightBox, closedAreas(rightView))).toBe(false);

    // Step 1: the callout of a row-1 rail covers neither the row-0 station above it nor the strip.
    const row1View = resolveView(doc, l, 1);
    const row1Pkt = row1View.phases[0]?.[0];
    const row1Box = row1Pkt && computePacketCalloutBox(row1Pkt);
    expect(row1Box).toBeDefined();
    if (row1Box) expect(covers(row1Box, closedAreas(row1View))).toBe(false);
  });

  it('moves a callout beside a steep rail instead of past both of its ends', () => {
    const doc = parse(`dav 1
group zone "Zone" {
  node hub "Hub"
  node a "A"
  node b "B"
  node c "C"
  node target "Target"
}
hub --> a
hub --> b
hub --> c
hub --> target
a --> target
step "Down" {
  animate c --> target : "Replicate"
}
`).document;
    const layout = computeLayout(doc);
    const view = resolveView(doc, layout, 0);
    const [packet] = view.phases.flat();
    const box = packet && computePacketCalloutBox(packet);
    expect(packet && box).toBeTruthy();
    if (!packet || !box) return;
    const rect = calloutRect(box);
    const mid = pointAt(packet.path, 0.5);
    const distance = Math.hypot(
      Math.max(rect.x - mid.x, 0, mid.x - (rect.x + rect.width)),
      Math.max(rect.y - mid.y, 0, mid.y - (rect.y + rect.height)),
    );
    // Near the rail, yet never on it: the packet passes between them.
    expect(distance).toBeGreaterThanOrEqual(21.9);
    expect(distance).toBeLessThan(120);
    expect(covers(box, closedAreas(view))).toBe(false);
  });

  it('keeps callouts off zone names, stations and each other across example 05, example 07, and JP/JSON/SQL stress steps', () => {
    const stressDsl = `dav 1
title "Order Pipeline Stress"
node browser "Browser" [icon: browser]
group edge "Edge" [color: teal] {
  node gw "Edge Gateway" [icon: router]
}
group app "Application" [color: blue] {
  node api "Order API" [icon: api]
  node worker "Payment Worker" [icon: function]
}
group data "Data & Events" [color: purple] {
  node db "Primary DB" [icon: database]
  node queue "Event Queue" [icon: queue]
  node cache "Redis Cache" [icon: cache]
}
browser --> gw
gw --> api
api --> db
api --> cache
api --> worker
worker --> db
worker --> queue
step "Step 1" {
  animate browser --> gw : "HTTPS" [desc: "TLS終端およびレート制限（100 req/s）を検証"]
}
step "Step 2" {
  animate gw --> api : "POST /orders" [icon: file, desc: "エッジWAFでmTLS検証（税込 ¥14,800）を実施し注文APIへ転送。冪等キーを確認…処理開始"] {
    code json "Order Request" \`\`\`
      {
        "orderId": "ord_01JCK9X7",
        "amount": 14800,
        "currency": "JPY"
      }
    \`\`\`
  }
}
step "Step 3" {
  animate api --> db : "INSERT orders" [desc: "注文レコードをトランザクション書込"] {
    code sql "Primary Write" \`\`\`
      INSERT INTO orders (id, amount, status)
      VALUES ('ord_01JCK9X7', 14800, 'PENDING');
    \`\`\`
  }
  animate api --> cache : "DEL cart:901" [parallel: true, desc: "カートキャッシュを即時無効化して二重注文を防止"]
}
step "Step 4" {
  animate worker --> db : "UPDATE status" [desc: "決済完了ステータスへ更新"] {
    code sql "Confirm Order" \`\`\`
      UPDATE orders SET status = 'CONFIRMED'
      WHERE id = 'ord_01JCK9X7';
    \`\`\`
  }
  animate worker --> queue : "OrderConfirmed" [icon: mail, parallel: true, color: purple, desc: "出荷ワーカー向け確定イベントを発行"] {
    code json "Event Payload" \`\`\`
      {
        "event": "order.confirmed",
        "orderId": "ord_01JCK9X7"
      }
    \`\`\`
  }
}
`;
    const scenarios = [
      ['example-05', readExample('05-sequence-payment-retry.dav')],
      ['example-07', readExample('07-dynamic-architect-viewer.dav')],
      ['stress-jp', stressDsl],
    ] as const;

    for (const [, dsl] of scenarios) {
      const { document: doc, diagnostics } = parse(dsl);
      expect(diagnostics).toEqual([]);
      const l = computeLayout(doc);
      doc.steps.forEach((_step, sIdx) => {
        const v = resolveView(doc, l, sIdx);
        for (const phase of v.phases) {
          const boxes = phase.flatMap((p) => computePacketCalloutBox(p) ?? []);
          // Zero parallel callout overlap
          boxes.forEach((a, i) => {
            for (const b of boxes.slice(i + 1)) {
              expect(overlap(a, b)).toBe(false);
            }
          });
          // No callout over a zone's name strip, or over a station, badge or node label.
          for (const box of boxes) expect(covers(box, closedAreas(v))).toBe(false);
        }
      });
    }

    // Example 07 Step 5 canonical 56-58 char HTML lines stay 100% intact with zero '…' truncation
    const ex07 = parse(scenarios[1][1]).document;
    const ex07View4 = resolveView(ex07, computeLayout(ex07), 4);
    const htmlPkt = ex07View4.phases[1]?.[0];
    const htmlBox = htmlPkt && computePacketCalloutBox(htmlPkt);
    expect(htmlBox?.code?.lines).toEqual([
      '<meta http-equiv="Content-Security-Policy"',
      "  content=\"default-src 'none'; script-src 'sha256-...'\">",
      '<script type="application/json" id="dav-data">...</script>',
    ]);
    if (htmlPkt && htmlBox?.code) {
      const rendered = buildPacket(htmlPkt, 0.5);
      const headEl = findAll(
        rendered,
        (e) => e.tag === 'text' && String(e.attrs.class).includes('dav-packet-code-head'),
      )[0];
      const line0El = findAll(
        rendered,
        (e) => e.tag === 'text' && String(e.attrs.class).includes('dav-packet-code-line'),
      )[0];
      const codeY = htmlBox.boxTop + htmlBox.code.offsetY;
      expect(headEl?.attrs.y).toBe(Number((codeY + 20).toFixed(2)));
      expect(line0El?.attrs.y).toBe(Number((codeY + htmlBox.code.headerHeight + 21).toFixed(2)));
    }
  });

  it('keeps the callouts of parallel flows apart: there and back, fanning out, and side by side', () => {
    // 1a. Dual-edge bidirectional parallel (a --> b + b --> a [parallel: true]) splits into above + below
    const bidiDoc = parse(`dav 1
node a "Client" [icon: browser]
node b "Order API" [icon: api]
a --> b : "POST /orders"
b --> a : "201 Created"
step "Bidi" {
  animate a --> b : "POST /orders" [desc: "Submit order payload"]
  animate b --> a : "201 Created" [parallel: true, desc: "Return created order receipt"]
}
`).document;
    const bidiView = resolveView(bidiDoc, computeLayout(bidiDoc), 0);
    const [fwdPkt, revPkt] = bidiView.phases[0] ?? [];
    const fwdBox = fwdPkt && computePacketCalloutBox(fwdPkt);
    const revBox = revPkt && computePacketCalloutBox(revPkt);
    // The request and its reply run between the same two stations: each callout has a place
    // of its own beside them.
    expect(fwdBox && revBox && rectOverlaps(calloutRect(fwdBox), calloutRect(revBox))).toBe(false);

    // 1b. Single <-> edge parallel request + response with code blocks also splits into above + below
    const sharedBidiDoc = parse(`dav 1
node client "Client" [icon: browser]
node api "Order API" [icon: api]
client <-> api : "HTTP/2"
step "BidiCode" {
  animate client --> api : "POST /orders" [desc: "Send order payload"] {
    code json "Request" \`\`\`
      { "sku": "dav-pro", "qty": 1 }
    \`\`\`
  }
  animate api --> client : "201 Created" [parallel: true, desc: "Return created order"] {
    code json "Response" \`\`\`
      { "orderId": "ord_01", "ok": true }
    \`\`\`
  }
}
`).document;
    const sharedBidiView = resolveView(sharedBidiDoc, computeLayout(sharedBidiDoc), 0);
    const [reqPkt, resPkt] = sharedBidiView.phases[0] ?? [];
    const reqBox = reqPkt && computePacketCalloutBox(reqPkt);
    const resBox = resPkt && computePacketCalloutBox(resPkt);
    expect(reqBox && resBox && rectOverlaps(calloutRect(reqBox), calloutRect(resBox))).toBe(false);

    // 2 & 3. Mixed upper+lower fan-out (Step 1) and side-by-side upper flows blocked below (Step 2)
    const stressDoc = parse(`dav 1
node browser "Browser" [icon: browser]
group edge "Edge" [color: teal] {
  node gw "Edge Gateway" [icon: router]
}
group app "Application" [color: blue] {
  node api "Order API" [icon: api]
  node worker "Payment Worker" [icon: function]
}
group data "Data & Events" [color: purple] {
  node db "Primary DB" [icon: database]
  node queue "Event Queue" [icon: queue]
  node cache "Redis Cache" [icon: cache]
}
browser --> gw : "HTTPS"
gw --> api : "HTTP/2"
api --> db : "SQL Write"
api --> cache : "Cache Op"
api --> worker : "Authorize"
worker --> queue : "Publish"
step "Fanout" {
  animate api --> db : "INSERT orders" [desc: "注文レコードをトランザクション書込"] {
    code sql "Primary Write" \`\`\`
      INSERT INTO orders (id, amount, status)
      VALUES ('ord_01JCK9X7', 14800, 'PENDING');
    \`\`\`
  }
  animate api --> cache : "DEL cart:901" [parallel: true, desc: "カートキャッシュを即時無効化して二重注文を防止"]
}
step "UpperShelf" {
  animate api --> db : "UPDATE status" [desc: "決済完了ステータスへ更新"] {
    code sql "Confirm Order" \`\`\`
      UPDATE orders SET status = 'CONFIRMED'
      WHERE id = 'ord_01JCK9X7';
    \`\`\`
  }
  animate worker --> queue : "OrderConfirmed" [icon: mail, parallel: true, color: purple, desc: "出荷ワーカー向け確定イベントを発行"] {
    code json "Event Payload" \`\`\`
      {
        "event": "order.confirmed",
        "orderId": "ord_01JCK9X7"
      }
    \`\`\`
  }
}
step "WorkerDualShelf" {
  animate worker --> db : "UPDATE status" [desc: "決済完了ステータスへ更新"] {
    code sql "Confirm Order" \`\`\`
      UPDATE orders SET status = 'CONFIRMED'
      WHERE id = 'ord_01JCK9X7';
    \`\`\`
  }
  animate worker --> queue : "OrderConfirmed" [icon: mail, parallel: true, color: purple, desc: "出荷ワーカー向け確定イベントを発行"] {
    code json "Event Payload" \`\`\`
      {
        "event": "order.confirmed",
        "orderId": "ord_01JCK9X7"
      }
    \`\`\`
  }
}
`).document;
    const stressLayout = computeLayout(stressDoc);

    const fanoutView = resolveView(stressDoc, stressLayout, 0);
    const [dbPkt, cachePkt] = fanoutView.phases[0] ?? [];
    const dbBox = dbPkt && computePacketCalloutBox(dbPkt);
    const cacheBox = cachePkt && computePacketCalloutBox(cachePkt);
    // Both rails leave the API downwards, side by side, and turn off to the right one below
    // the other. Each callout has a place beside its own rail.
    expect(dbBox && cacheBox && rectOverlaps(calloutRect(dbBox), calloutRect(cacheBox))).toBe(
      false,
    );
    const dataGroup = fanoutView.groups.find((g) => g.id === 'data');
    if (cacheBox && dataGroup) {
      const r = calloutRect(cacheBox);
      const straddlesLeft =
        r.x < dataGroup.rect.x &&
        r.x + r.width > dataGroup.rect.x &&
        r.y < dataGroup.rect.y + dataGroup.rect.height &&
        r.y + r.height > dataGroup.rect.y;
      expect(straddlesLeft).toBe(false);
    }

    for (const stepIdx of [1, 2]) {
      const shelfView = resolveView(stressDoc, stressLayout, stepIdx);
      const [up0, up1] = shelfView.phases[0] ?? [];
      const upBox0 = up0 && computePacketCalloutBox(up0);
      const upBox1 = up1 && computePacketCalloutBox(up1);
      // Each callout is beside its own rail: that matters more than a shared shelf, now that
      // no pointer joins a callout to its packet.
      expect(upBox0 && upBox1).toBeTruthy();
      if (!upBox0 || !upBox1) continue;
      const r0 = calloutRect(upBox0);
      const r1 = calloutRect(upBox1);
      const apart =
        r0.x + r0.width + CALLOUT_GAP <= r1.x ||
        r1.x + r1.width + CALLOUT_GAP <= r0.x ||
        r0.y + r0.height + CALLOUT_GAP <= r1.y ||
        r1.y + r1.height + CALLOUT_GAP <= r0.y;
      expect(apart).toBe(true);
    }
  });

  it('never covers a zone name, a node, an edge label or a rail, or sits by the wrong rail across all examples & templates', () => {
    const exampleFiles = [
      '01-infra-ha-failover.dav',
      '02-screen-flow-checkout.dav',
      '03-event-driven-async.dav',
      '04-enterprise-zero-trust-payment.dav',
      '05-sequence-payment-retry.dav',
      '06-lan-office-network.dav',
      '07-dynamic-architect-viewer.dav',
    ];
    const giantContainerDsl = `dav 1
node ext "External Client" [icon: browser]
group cloud "Enterprise VPC" [color: blue] {
  node gw "Ingress" [icon: router]
  node r0 "Service A" [icon: api]
  node r1 "Service B" [icon: server]
  node r2 "Service C" [icon: function]
  node r3 "Service D" [icon: database]
  node sink "Audit Sink" [icon: storage]
}
ext --> gw : "HTTPS"
gw --> r0
gw --> r1
gw --> r2 : "Hop"
gw --> r3
r2 --> sink
step "Giant" {
  animate ext --> gw : "Ingress Call" [desc: "Crosses outer container border cleanly"]
  animate gw --> r2 : "Hop"
}
`;
    const dsls = [
      ...exampleFiles.map(readExample),
      ...SAMPLE_TEMPLATES.map((tpl) => tpl.dsl),
      giantContainerDsl,
    ];

    const giantDoc = parse(giantContainerDsl).document;
    const giantLayout = computeLayout(giantDoc);
    const cloudRect = giantLayout.groups.cloud;
    expect(cloudRect?.height).toBeGreaterThan(468);
    const giantView = resolveView(giantDoc, giantLayout, 0);
    const internalPkt = giantView.phases[1]?.[0];
    const internalBox = internalPkt && computePacketCalloutBox(internalPkt);
    // A rail deep inside a very tall zone has room beside it: its callout stays inside.
    if (cloudRect && internalBox)
      expect(rectContains(cloudRect, calloutRect(internalBox))).toBe(true);

    for (const dsl of dsls) {
      const { document: doc } = parse(dsl);
      const l = computeLayout(doc);
      doc.steps.forEach((_step, sIdx) => {
        const v = resolveView(doc, l, sIdx);
        for (const phase of v.phases) {
          const boxes = phase
            .map((pkt) => ({ pkt, box: computePacketCalloutBox(pkt) }))
            .filter((entry): entry is { pkt: Packet; box: NonNullable<typeof entry.box> } =>
              Boolean(entry.box),
            );

          // Zero parallel callout overlap
          for (let i = 0; i < boxes.length; i++) {
            for (let j = i + 1; j < boxes.length; j++) {
              const a = boxes[i];
              const b = boxes[j];
              if (!a || !b) continue;
              const ra = calloutRect(a.box);
              const rb = calloutRect(b.box);
              const overlaps =
                ra.x < rb.x + rb.width + CALLOUT_GAP - 0.1 &&
                ra.x + ra.width + CALLOUT_GAP - 0.1 > rb.x &&
                ra.y < rb.y + rb.height + CALLOUT_GAP - 0.1 &&
                ra.y + ra.height + CALLOUT_GAP - 0.1 > rb.y;
              expect(overlaps).toBe(false);
            }
          }

          for (const { pkt, box } of boxes) {
            const r = calloutRect(box);
            const where = `step ${sIdx}: callout of ${pkt.from} > ${pkt.to}`;
            // Not over the strip a zone's name moves along, though it may lie across the
            // other borders of a zone.
            expect(covers(box, nameStrips(v)), `${where} over a zone name`).toBe(false);
            // Not over a station, a badge or a node's labels.
            expect(covers(box, nodeParts(v)), `${where} over a node`).toBe(false);
            // Not over the label of an edge of the step.
            const labels = v.edges.flatMap((e) =>
              e.label && e.labelAt ? [edgeLabelArea(e.label, e.labelAt)] : [],
            );
            expect(covers(box, labels), `${where} over an edge label`).toBe(false);

            // No rail of the step runs under the callout.
            const rails = [...v.edges.map((e) => e.path), ...phase.map((p) => p.path)];
            for (const rail of rails) {
              for (let i = 0; i <= 24; i++) {
                const p = pointAt(rail, i / 24);
                const inside =
                  p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;
                expect(inside).toBe(false);
              }
            }

            // Among the packets of a phase, the callout is nearest its own rail.
            const nearest = (path: Packet['path']): number => {
              let best = Number.POSITIVE_INFINITY;
              for (let i = 0; i <= 32; i++) {
                const p = pointAt(path, i / 32);
                best = Math.min(
                  best,
                  Math.hypot(
                    Math.max(r.x - p.x, 0, p.x - (r.x + r.width)),
                    Math.max(r.y - p.y, 0, p.y - (r.y + r.height)),
                  ),
                );
              }
              return best;
            };
            for (const other of phase) {
              if (other === pkt || !computePacketCalloutBox(other)) continue;
              expect(nearest(pkt.path)).toBeLessThan(nearest(other.path));
            }
          }
        }
      });
    }
  });
});

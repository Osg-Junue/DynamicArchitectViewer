import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { computeLayout, type Rect, rectContains, rectOverlaps } from '../../layout';
import type { CodeBlock } from '../../model/types';
import { SAMPLE_TEMPLATES } from '../../samples';
import {
  CALLOUT_CODE_HEADER_HEIGHT,
  CALLOUT_CODE_LINE_HEIGHT,
  CALLOUT_CODE_PAD_X,
  CALLOUT_CODE_RADIUS,
  CALLOUT_CODE_SIZE,
  CALLOUT_DESC_SIZE,
  CALLOUT_GAP,
  CALLOUT_LABEL_SIZE,
  CALLOUT_LINE_HEIGHT,
  CALLOUT_NUMBER_ROOM,
  CALLOUT_OUTER_PAD_X,
  CALLOUT_RADIUS,
  calloutOutline,
} from '../callout';
import { expandRect, pointAt, pointInRect, segmentIntersectsRect } from '../geometry';
import { ICON_SHAPES } from '../icons';
import {
  buildPacket as buildPacketWith,
  buildScene,
  calloutRect,
  calmFrame,
  computePacketCalloutBox,
  DEFAULT_FLOW_COLOR,
  estimateCalloutTextWidth,
  framePose,
  type Packet,
  type PacketCalloutBox,
  packetsOnScreen,
  type ResolvedView,
  resolveView,
  type VElement,
  type VNode,
  visibleWorld,
  wholeDiagramFrame,
  wrapText,
} from '../index';
import { badgeArea, edgeLabelArea, nodeBody } from '../rails';

const REPO_ROOT = resolve(__dirname, '../../../../..');
const readExample = (file: string): string =>
  readFileSync(resolve(REPO_ROOT, 'examples', file), 'utf8');

const buildPacket = (packet: Packet, t?: number) => buildPacketWith(packet, ICON_SHAPES, t);

/** The strip across the top of each zone, which its name moves along with the camera. */
const nameStrips = (view: ResolvedView): Rect[] =>
  view.groups.map((g) => ({ ...g.rect, height: 34 }));
/** What is drawn of each node: its station, its badge and its labels. */
const nodeParts = (view: ResolvedView): Rect[] =>
  view.nodes.flatMap((n) => [...nodeBody(n), ...badgeArea(n)]);
/** What no callout may cover in a view. */
const closedAreas = (view: ResolvedView): Rect[] => [...nameStrips(view), ...nodeParts(view)];
const covers = (box: PacketCalloutBox, areas: readonly Rect[]): boolean =>
  areas.some((area) => rectOverlaps(calloutRect(box), area));

function collectText(node: VNode): string[] {
  if (typeof node === 'string') return [node];
  return node.children.flatMap(collectText);
}

function collectAttrs(node: VNode): string[] {
  if (typeof node === 'string') return [];
  return [
    ...Object.entries(node.attrs).map(([k, v]) => `${k}=${v}`),
    ...node.children.flatMap(collectAttrs),
  ];
}

function findAll(node: VNode, pred: (e: VElement) => boolean): VElement[] {
  if (typeof node === 'string') return [];
  return [...(pred(node) ? [node] : []), ...node.children.flatMap((c) => findAll(c, pred))];
}

const commandsOf = (d: string): string => (d.match(/[A-Z]/g) ?? []).join(' ');

function makePacket(
  opts: { x?: number; label?: string; description?: string; code?: CodeBlock; color?: string } = {},
): Packet {
  const pt = { x: opts.x ?? 200, y: 300 };
  const pkt: Packet = {
    from: 'a',
    to: 'b',
    fromLabel: 'A',
    toLabel: 'B',
    color: opts.color ?? DEFAULT_FLOW_COLOR,
    path: { p0: pt, p1: pt, p2: pt, p3: pt },
    roundTrip: false,
    durationMs: 2000,
  };
  if (opts.label !== undefined) pkt.label = opts.label;
  if (opts.description !== undefined) pkt.description = opts.description;
  if (opts.code !== undefined) pkt.code = opts.code;
  return pkt;
}

describe('2D rectangle and segment geometry helpers', () => {
  const box: Rect = { x: 100, y: 200, width: 80, height: 40 };

  it('expands or insets rectangles symmetrically around their center', () => {
    expect(expandRect(box, 14)).toEqual({ x: 86, y: 186, width: 108, height: 68 });
    expect(expandRect(box, 0)).toEqual(box);
    expect(expandRect(box, -10)).toEqual({ x: 110, y: 210, width: 60, height: 20 });
  });

  it('tests inclusive point containment across interior, edges, corners, and exterior', () => {
    expect(pointInRect({ x: 140, y: 220 }, box)).toBe(true);
    expect(pointInRect({ x: 100, y: 200 }, box)).toBe(true);
    expect(pointInRect({ x: 180, y: 240 }, box)).toBe(true);
    expect(pointInRect({ x: 99.9, y: 220 }, box)).toBe(false);
    expect(pointInRect({ x: 180.1, y: 220 }, box)).toBe(false);
    expect(pointInRect({ x: 140, y: 199.9 }, box)).toBe(false);
    expect(pointInRect({ x: 140, y: 240.1 }, box)).toBe(false);
  });

  it('clips segments accurately via Liang–Barsky across crossing, interior, boundary, miss, and degenerate cases', () => {
    // Horizontal, vertical, and diagonal crossings
    expect(segmentIntersectsRect({ x: 50, y: 220 }, { x: 220, y: 220 }, box)).toBe(true);
    expect(segmentIntersectsRect({ x: 140, y: 150 }, { x: 140, y: 260 }, box)).toBe(true);
    expect(segmentIntersectsRect({ x: 80, y: 180 }, { x: 200, y: 260 }, box)).toBe(true);

    // Segment wholly inside or touching an edge/corner
    expect(segmentIntersectsRect({ x: 110, y: 210 }, { x: 170, y: 230 }, box)).toBe(true);
    expect(segmentIntersectsRect({ x: 100, y: 180 }, { x: 100, y: 210 }, box)).toBe(true);
    expect(segmentIntersectsRect({ x: 80, y: 220 }, { x: 120, y: 180 }, box)).toBe(true);

    // Parallel outside, collinear stopping short, and diagonal passing outside corner
    expect(segmentIntersectsRect({ x: 50, y: 190 }, { x: 220, y: 190 }, box)).toBe(false);
    expect(segmentIntersectsRect({ x: 40, y: 220 }, { x: 95, y: 220 }, box)).toBe(false);
    expect(segmentIntersectsRect({ x: 185, y: 220 }, { x: 240, y: 220 }, box)).toBe(false);
    expect(segmentIntersectsRect({ x: 80, y: 210 }, { x: 110, y: 180 }, box)).toBe(false);

    // Zero or negative dimensions never intersect
    expect(
      segmentIntersectsRect(
        { x: 90, y: 200 },
        { x: 110, y: 200 },
        { x: 100, y: 190, width: 0, height: 20 },
      ),
    ).toBe(false);
    expect(
      segmentIntersectsRect(
        { x: 100, y: 190 },
        { x: 100, y: 210 },
        { x: 90, y: 200, width: 20, height: 0 },
      ),
    ).toBe(false);
  });
});

describe('packet code callouts and overflow prevention', () => {
  it('preserves exact heights and omits .dav-packet-code when code is absent or whitespace-only', () => {
    expect({
      CALLOUT_RADIUS,
      CALLOUT_CODE_RADIUS,
      CALLOUT_OUTER_PAD_X,
      CALLOUT_LABEL_SIZE,
      CALLOUT_DESC_SIZE,
      CALLOUT_LINE_HEIGHT,
      CALLOUT_CODE_SIZE,
      CALLOUT_CODE_LINE_HEIGHT,
      CALLOUT_CODE_PAD_X,
      CALLOUT_CODE_HEADER_HEIGHT,
      CALLOUT_NUMBER_ROOM,
    }).toEqual({
      CALLOUT_RADIUS: 10,
      CALLOUT_CODE_RADIUS: 6,
      CALLOUT_OUTER_PAD_X: 16,
      CALLOUT_LABEL_SIZE: 15,
      CALLOUT_DESC_SIZE: 14,
      CALLOUT_LINE_HEIGHT: 22,
      CALLOUT_CODE_SIZE: 12.5,
      CALLOUT_CODE_LINE_HEIGHT: 19,
      CALLOUT_CODE_PAD_X: 13,
      CALLOUT_CODE_HEADER_HEIGHT: 30,
      CALLOUT_NUMBER_ROOM: 24,
    });

    const labelOnly = computePacketCalloutBox(makePacket({ label: '201 Created' }));
    expect(labelOnly).not.toBeNull();
    expect(labelOnly && labelOnly.boxBottom - labelOnly.boxTop).toBe(34);
    expect(labelOnly?.padX).toBe(13);
    expect(labelOnly?.code).toBeUndefined();

    const withDesc = computePacketCalloutBox(
      makePacket({ label: '201 Created', description: 'Line one\nLine two' }),
    );
    expect(withDesc && withDesc.boxBottom - withDesc.boxTop).toBe(42 + 2 * CALLOUT_LINE_HEIGHT);
    expect(withDesc?.padX).toBe(16);
    expect(withDesc?.code).toBeUndefined();

    const descOnly = computePacketCalloutBox(makePacket({ description: 'Only description' }));
    expect(descOnly && descOnly.boxBottom - descOnly.boxTop).toBe(21 + 1 * CALLOUT_LINE_HEIGHT);
    expect(descOnly?.code).toBeUndefined();

    const emptyCodeOnly = computePacketCalloutBox(makePacket({ code: { body: '  \r\n\t  ' } }));
    expect(emptyCodeOnly).toBeNull();

    const renderedNoCode = buildPacket(
      makePacket({ label: '201 Created', description: 'Created' }),
    );
    expect(findAll(renderedNoCode, (e) => e.attrs.class === 'dav-packet-code')).toEqual([]);
    const descEl = findAll(renderedNoCode, (e) => e.attrs.class === 'dav-packet-desc')[0];
    expect(descEl?.attrs['fill-opacity']).toBe(0.86);
  });

  it('renders a callout for a code-only packet and handles header combinations', () => {
    const codeOnly = computePacketCalloutBox(makePacket({ code: { body: '{\n  "ok": true\n}' } }));
    expect(codeOnly).not.toBeNull();
    expect(codeOnly?.code).toMatchObject({
      header: '',
      headerHeight: 0,
      lines: ['{', '  "ok": true', '}'],
      offsetY: 14,
    });

    const langAndTitle = computePacketCalloutBox(
      makePacket({
        label: 'POST /v1/orders',
        code: { lang: 'json', title: 'Order Request', body: '{"amount": 14800}' },
      }),
    );
    expect(langAndTitle?.code).toMatchObject({
      header: 'json · Order Request',
      headerHeight: 30,
      lines: ['{"amount": 14800}'],
      offsetY: 39,
    });
    expect(langAndTitle?.code?.width).toBe((langAndTitle?.halfW ?? 0) * 2 - 32);

    const langOnly = computePacketCalloutBox(
      makePacket({ code: { lang: 'sql', body: 'SELECT 1;' } }),
    );
    expect(langOnly?.code?.header).toBe('sql');
    expect(langOnly?.code?.headerHeight).toBe(30);

    const titleOnly = computePacketCalloutBox(
      makePacket({ code: { title: 'Payload', body: 'ok' } }),
    );
    expect(titleOnly?.code?.header).toBe('Payload');
    expect(titleOnly?.code?.headerHeight).toBe(30);
  });

  it('normalizes CRLF/tabs, caps code at 10 lines, and truncates overlong code lines', () => {
    const twelveLines = Array.from({ length: 12 }, (_, i) => `\t"k${i}": ${i}`).join('\r\n');
    const longLine = `"payload": "${'x'.repeat(120)}"`;
    const box = computePacketCalloutBox(
      makePacket({
        code: { lang: 'json', body: `{\r\n${twelveLines}\r\n}` },
      }),
    );
    expect(box?.code?.lines).toHaveLength(10);
    expect(box?.code?.lines[1]).toBe('  "k0": 0');
    expect(box?.code?.lines[9]).toBe('…');
    expect(box?.code?.height).toBe(30 + 10 * CALLOUT_CODE_LINE_HEIGHT + 14);

    const wide = computePacketCalloutBox(makePacket({ code: { body: longLine } }));
    const fittedLine = wide?.code?.lines[0] ?? '';
    expect(fittedLine.endsWith('…')).toBe(true);
    expect(estimateCalloutTextWidth(fittedLine, CALLOUT_CODE_SIZE, 'mono')).toBeLessThanOrEqual(
      440,
    );
  });

  it('estimates Unicode symbols/CJK conservatively so Japanese + symbol descriptions never overflow', () => {
    for (const sym of ['—', '…', '→', '●', '①', '¥']) {
      expect(estimateCalloutTextWidth(sym, 13, 'normal')).toBeGreaterThanOrEqual(13 * 1.04);
    }
    const jpDesc =
      'エッジWAFでmTLS検証 → Primary DBへ書込 — 決済金額 ¥14,800 を確定し ①監査ログへ記録…さらにレプリカへ非同期転送を実施';
    const box = computePacketCalloutBox(
      makePacket({
        label: '201 Created — 注文確定 → ¥14,800',
        description: jpDesc,
        code: {
          lang: 'json',
          title: 'Order Response',
          body: '{\n  "orderId": "ord_01J9X",\n  "amount": 14800,\n  "paid": true\n}',
        },
      }),
    );
    expect(box).not.toBeNull();
    if (!box) return;
    const innerW = box.halfW * 2 - box.padX * 2;
    for (const line of box.descLines) {
      expect(estimateCalloutTextWidth(line, CALLOUT_DESC_SIZE, 'normal')).toBeLessThanOrEqual(384);
      expect(estimateCalloutTextWidth(line, CALLOUT_DESC_SIZE, 'normal')).toBeLessThan(innerW);
    }
    expect(box.boxTop + (box.code?.offsetY ?? 0) + (box.code?.height ?? 0) + 14).toBe(
      box.boxBottom,
    );
  });

  it('builds .dav-packet-code with xml:space="preserve", exact indentation, token tspans, and zero Copy button', () => {
    const body = '{\n  "orderId": "ord-123",\n  "amount": -42,\n  "ok": true\n}';
    const pkt = makePacket({
      label: '201 Created',
      color: 'green',
      code: { lang: 'json', title: 'Response', body },
    });
    const vnode = buildPacket(pkt, 0.5);
    const codeGroups = findAll(vnode, (e) => e.attrs.class === 'dav-packet-code');
    expect(codeGroups).toHaveLength(1);

    const codeGroup = codeGroups[0];
    expect(codeGroup?.children[0]).toMatchObject({
      tag: 'rect',
      attrs: { rx: 6, class: 'dav-packet-code-box', fill: 'var(--dav-code-bg)' },
    });

    const headText = findAll(
      vnode,
      (e) => e.tag === 'text' && String(e.attrs.class).includes('dav-packet-code-head'),
    )[0];
    expect(headText?.attrs['xml:space']).toBe('preserve');
    expect(collectText(headText ?? '')).toEqual(['{ } ', 'json · Response']);
    const braceSpan = headText?.children[0];
    expect(typeof braceSpan !== 'string' ? braceSpan?.attrs.fill : undefined).toBe(
      'var(--dav-c-green)',
    );

    const lineEls = findAll(vnode, (e) => String(e.attrs.class).includes('dav-packet-code-line'));
    expect(lineEls).toHaveLength(5);
    for (const el of lineEls) {
      expect(el.attrs['xml:space']).toBe('preserve');
    }
    expect(lineEls.map((el) => collectText(el).join(''))).toEqual(body.split('\n'));

    // Never renders any Copy button, foreignObject, or click handler
    const allAttrs = collectAttrs(vnode).join('|');
    const allTexts = collectText(vnode).join('|');
    expect(allTexts.toLowerCase()).not.toContain('copy');
    expect(allAttrs).not.toMatch(/on\w+=/i);
    expect(findAll(vnode, (e) => e.tag === 'button' || e.tag === 'foreignObject')).toEqual([]);
  });

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
    const overlaps =
      b0.cx - b0.halfW < b1.cx + b1.halfW &&
      b0.cx + b0.halfW > b1.cx - b1.halfW &&
      b0.boxTop < b1.boxBottom &&
      b0.boxBottom > b1.boxTop;
    expect(overlaps).toBe(false);
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

  it('enforces kinsoku line wrapping rules and eliminates 2-3 char trailing orphans', () => {
    const fixedMeasure = (s: string) => [...s].length * 10;
    // Opening brackets attach forward (no dangling '（' or '(' at line end)
    const openWrapped = wrapText('注文処理（税込計算）を実行', 10, 55, 4, {
      measure: fixedMeasure,
      trimBeforeEllipsis: true,
    });
    for (const line of openWrapped) {
      expect(line).not.toMatch(/[([{（「『【〈《〔]$/);
      expect(line).not.toMatch(/^[)\]}）」』】〉》〕。、，．・：；！？…‥ーっッ]/);
    }

    // ASCII '(' after Latin identifier before CJK also avoids dangling '(' at line end
    const asciiOpenWrapped = wrapText('WAF(検証)を実行。次の処理…開始！', 10, 50, 5, {
      measure: fixedMeasure,
      trimBeforeEllipsis: true,
    });
    for (const line of asciiOpenWrapped) {
      expect(line).not.toMatch(/[([{（「]$/);
      expect(line).not.toMatch(/^[)\]}）」。…！]/);
    }

    // Anti-orphan balancing: 27 CJK chars (~368px > 340px) balances into two near-equal lines instead of 24+3
    const orphanCandidate = '注文確定イベントを発行し非同期ワーカーにて出荷開始処理';
    const balanced = computePacketCalloutBox(makePacket({ description: orphanCandidate }));
    expect(balanced?.descLines).toHaveLength(2);
    expect([...(balanced?.descLines[1] ?? '')].length).toBeGreaterThanOrEqual(8);
  });

  it('scales tall code cards toward Golden Ratio φ and co-sizes desc with wide code blocks', () => {
    const phi = (1 + Math.sqrt(5)) / 2;
    const tallBody = Array.from({ length: 8 }, (_, i) => `  "line_${i}": ${i}`).join(',\n');
    const tallCard = computePacketCalloutBox(
      makePacket({
        label: 'Tall',
        code: { lang: 'json', body: `{\n${tallBody}\n}` },
      }),
    );
    expect(tallCard).not.toBeNull();
    if (!tallCard) return;
    const tallH = tallCard.boxBottom - tallCard.boxTop;
    const tallW = tallCard.halfW * 2;
    const expectedPhiFloor = Math.min(368, Math.max(220, Math.round(tallH * phi)));
    expect(tallW).toBeGreaterThanOrEqual(expectedPhiFloor);

    // Wide single-line code widens descMaxW so medium description wraps cleanly to match code width
    const wideCodeDesc = '認証済みペイロードを検証してプライマリデータベースへトランザクション書込';
    const withoutCode = computePacketCalloutBox(makePacket({ description: wideCodeDesc }));
    const withWideCode = computePacketCalloutBox(
      makePacket({
        description: wideCodeDesc,
        code: {
          lang: 'sql',
          body: 'INSERT INTO customer_orders (order_id, tenant_id, total_jpy) VALUES ($1, $2, 14800);',
        },
      }),
    );
    expect(withoutCode && withWideCode).toBeTruthy();
    if (!withoutCode || !withWideCode) return;
    const maxLineW = (lines: string[]) =>
      Math.max(...lines.map((l) => estimateCalloutTextWidth(l, CALLOUT_DESC_SIZE, 'normal')));
    expect(maxLineW(withWideCode.descLines)).toBeGreaterThanOrEqual(
      maxLineW(withoutCode.descLines),
    );
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

  it('draws the callout as a closed box that does not depend on where the packet is', () => {
    const p0 = { x: 120, y: 320 };
    const p3 = { x: 420, y: 320 };
    const packet: Packet = {
      from: 'a',
      to: 'b',
      fromLabel: 'A',
      toLabel: 'B',
      label: 'POST /orders',
      description: 'Payload check',
      color: DEFAULT_FLOW_COLOR,
      path: { p0, p1: { x: 200, y: 320 }, p2: { x: 340, y: 320 }, p3 },
      roundTrip: false,
      durationMs: 2000,
    };
    const box = computePacketCalloutBox(packet);
    expect(box).not.toBeNull();
    if (!box) return;

    // A rounded rectangle: no pointer reaches for the packet.
    expect(commandsOf(calloutOutline(box))).toBe('M H Q V Q H Q V Q Z');
    const bubbleAt = (t: number) =>
      findAll(buildPacket(packet, t), (e) => e.attrs.class === 'dav-packet-bubble')[0]?.attrs.d;
    expect(bubbleAt(0)).toBe(calloutOutline(box));
    expect(bubbleAt(0.5)).toBe(bubbleAt(0));
    expect(bubbleAt(1)).toBe(bubbleAt(0));
    // Only the marker moves.
    const dotAt = (t: number) =>
      findAll(buildPacket(packet, t), (e) => e.attrs.class === 'dav-packet-dot')[0]?.attrs
        .transform;
    expect(dotAt(1)).not.toBe(dotAt(0));
  });

  it('numbers a callout like its stop on the rail, with a letter for packets of one phase', () => {
    const doc = parse(`dav 1
node a
node b
node c
a --> b
a --> c
step "One phase" {
  animate a --> b : "Only"
}
step "Three packets" {
  animate a --> b : "First"
  animate a --> b : "Second"
  animate a --> c : "Third" [parallel: true]
}
`).document;
    const layout = computeLayout(doc);
    const numberOf = (packet: Packet): string | undefined => {
      const el = findAll(buildPacket(packet), (e) => e.attrs.class === 'dav-packet-number')[0];
      return el ? collectText(el)[0] : undefined;
    };

    // A step with one phase draws no stops, so its callout carries no number either.
    const [only] = resolveView(doc, layout, 0).phases.flat();
    expect(only?.stopLabel).toBeUndefined();
    expect(only && numberOf(only)).toBeUndefined();
    expect(only && computePacketCalloutBox(only)?.numberRoom).toBe(0);

    const view = resolveView(doc, layout, 1);
    expect(view.phases.flat().map((p) => p.stopLabel)).toEqual(['1', '2a', '2b']);
    expect(view.phases.flat().map(numberOf)).toEqual(['1', '2a', '2b']);
    const stops = findAll(buildScene(view, ICON_SHAPES), (e) => e.attrs.class === 'dav-stop').map(
      (stop) => collectText(stop)[0],
    );
    expect(stops).toEqual(['1', '2a', '2b']);

    // The number takes room on the left; the content keeps its width.
    const [first] = view.phases.flat();
    if (!first) return;
    const numbered = computePacketCalloutBox(first);
    const { stopLabel: _dropped, ...unnumbered } = first;
    const plain = computePacketCalloutBox(unnumbered);
    expect(numbered?.numberRoom).toBe(CALLOUT_NUMBER_ROOM);
    expect(numbered && plain && (numbered.halfW - plain.halfW) * 2).toBe(CALLOUT_NUMBER_ROOM);
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
              const clash =
                a.cx - a.halfW < b.cx + b.halfW &&
                a.cx + a.halfW > b.cx - b.halfW &&
                a.boxTop < b.boxBottom &&
                a.boxBottom > b.boxTop;
              expect(clash).toBe(false);
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
      expect(line0El?.attrs.y).toBe(Number((codeY + htmlBox.code.headerHeight + 22).toFixed(2)));
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

import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { computeLayout } from '../../layout';
import {
  CALLOUT_CODE_HEADER_HEIGHT,
  CALLOUT_CODE_LINE_HEIGHT,
  CALLOUT_CODE_PAD_X,
  CALLOUT_CODE_RADIUS,
  CALLOUT_CODE_SIZE,
  CALLOUT_DESC_SIZE,
  CALLOUT_LABEL_SIZE,
  CALLOUT_LINE_HEIGHT,
  CALLOUT_NUMBER_ROOM,
  CALLOUT_OUTER_PAD_X,
  CALLOUT_RADIUS,
  calloutOutline,
} from '../callout';
import { ICON_SHAPES } from '../icons';
import {
  buildScene,
  computePacketCalloutBox,
  DEFAULT_FLOW_COLOR,
  type Packet,
  resolveView,
  textWidth,
  wrapText,
} from '../index';
import { buildPacket, collectAttrs, collectText, commandsOf, findAll, makePacket } from './helpers';

describe('the card of a callout: its text, its code and its size', () => {
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
      CALLOUT_NUMBER_ROOM: 28,
    });

    const labelOnly = computePacketCalloutBox(makePacket({ label: '201 Created' }));
    expect(labelOnly).not.toBeNull();
    expect(labelOnly && labelOnly.boxBottom - labelOnly.boxTop).toBe(36);
    expect(labelOnly?.padX).toBe(14);
    expect(labelOnly?.code).toBeUndefined();

    const withDesc = computePacketCalloutBox(
      makePacket({ label: '201 Created', description: 'Line one\nLine two' }),
    );
    expect(withDesc && withDesc.boxBottom - withDesc.boxTop).toBe(50 + 2 * CALLOUT_LINE_HEIGHT);
    expect(withDesc?.padX).toBe(16);
    expect(withDesc?.code).toBeUndefined();

    const descOnly = computePacketCalloutBox(makePacket({ description: 'Only description' }));
    expect(descOnly && descOnly.boxBottom - descOnly.boxTop).toBe(22 + 1 * CALLOUT_LINE_HEIGHT);
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
      offsetY: 16,
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
      offsetY: 42,
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
    expect(box?.code?.height).toBe(30 + 10 * CALLOUT_CODE_LINE_HEIGHT + 17);

    const wide = computePacketCalloutBox(makePacket({ code: { body: longLine } }));
    const fittedLine = wide?.code?.lines[0] ?? '';
    expect(fittedLine.endsWith('…')).toBe(true);
    expect(textWidth(fittedLine, CALLOUT_CODE_SIZE, 'mono')).toBeLessThanOrEqual(440);
  });

  it('counts signs and CJK as a full em, so that a Japanese description never overflows', () => {
    for (const sym of ['—', '…', '→', '●', '①', '¥']) {
      expect(textWidth(sym, 13, 'normal')).toBeGreaterThanOrEqual(13);
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
      expect(textWidth(line, CALLOUT_DESC_SIZE, 'normal')).toBeLessThanOrEqual(414);
      expect(textWidth(line, CALLOUT_DESC_SIZE, 'normal')).toBeLessThan(innerW);
    }
    expect(box.boxTop + (box.code?.offsetY ?? 0) + (box.code?.height ?? 0) + 16).toBe(
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

  it('enforces kinsoku line wrapping rules and eliminates 2-3 char trailing orphans', () => {
    // Opening brackets attach forward (no dangling '（' or '(' at line end)
    const openWrapped = wrapText('注文処理（税込計算）を実行', 10, 55, 4);
    for (const line of openWrapped) {
      expect(line).not.toMatch(/[([{（「『【〈《〔]$/);
      expect(line).not.toMatch(/^[)\]}）」』】〉》〕。、，．・：；！？…‥ーっッ]/);
    }

    // ASCII '(' after Latin identifier before CJK also avoids dangling '(' at line end
    const asciiOpenWrapped = wrapText('WAF(検証)を実行。次の処理…開始！', 10, 50, 5);
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
      Math.max(...lines.map((l) => textWidth(l, CALLOUT_DESC_SIZE, 'normal')));
    expect(maxLineW(withWideCode.descLines)).toBeGreaterThanOrEqual(
      maxLineW(withoutCode.descLines),
    );
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
});

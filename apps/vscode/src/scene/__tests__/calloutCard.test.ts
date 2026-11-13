import { afterEach, describe, expect, it } from 'vitest';
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
  measureCalloutsWith,
  type Packet,
  resolveView,
  textWidth,
  wrapText,
} from '../index';
import { buildPacket, collectAttrs, collectText, commandsOf, findAll, makePacket } from './helpers';

describe('the card of a callout: its text, its code and its size', () => {
  // One test hands in a measurement of its own; the rest go by the estimate.
  afterEach(() => measureCalloutsWith(null));

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

    // A description that fits on one line gets one: a callout widens for it.
    const oneLine = '注文確定イベントを発行し非同期ワーカーにて出荷開始処理';
    expect(computePacketCalloutBox(makePacket({ description: oneLine }))?.descLines).toEqual([
      oneLine,
    ]);
    // One too long for that is evened out into two, not left as a long line and a few characters.
    const twoLines = `${oneLine}を行い、完了を顧客へ通知する`;
    const balanced = computePacketCalloutBox(makePacket({ description: twoLines }));
    expect(balanced?.descLines).toHaveLength(2);
    expect([...(balanced?.descLines[1] ?? '')].length).toBeGreaterThanOrEqual(12);
  });

  it('makes a callout as wide as what it holds, and shapes a description beside code', () => {
    const maxLineW = (lines: string[]) =>
      Math.max(...lines.map((l) => textWidth(l, CALLOUT_DESC_SIZE, 'normal')));

    // Tall code does not widen a callout: it is as wide as its code, down to a least width.
    const tallBody = Array.from({ length: 8 }, (_, i) => `  "line_${i}": ${i}`).join(',\n');
    const tallCard = computePacketCalloutBox(
      makePacket({
        label: 'Tall',
        code: { lang: 'json', body: `{\n${tallBody}\n}` },
      }),
    );
    expect(tallCard).not.toBeNull();
    if (!tallCard) return;
    const widestCode = Math.max(
      ...(tallCard.code?.lines ?? []).map((l) => textWidth(l, CALLOUT_CODE_SIZE, 'mono')),
    );
    expect(tallCard.halfW * 2).toBe(
      Math.max(180, Math.ceil(widestCode + 4 + CALLOUT_CODE_PAD_X * 2 + CALLOUT_OUTER_PAD_X * 2)),
    );
    expect(tallCard.halfW * 2).toBeLessThan(tallCard.boxBottom - tallCard.boxTop);

    // Beside code, a description takes the number of lines that brings the callout nearest
    // the golden ratio, and the callout is no wider than those lines: none ends early.
    const beside = computePacketCalloutBox(
      makePacket({
        label: 'dblclick [data-id]',
        description:
          'Double-clicking a node looks up its SourceMap span and posts revealRange to the editor',
        code: {
          lang: 'json',
          title: 'WebviewToHostMessage',
          body: '{\n  "type": "revealRange",\n  "from": 128,\n  "to": 162\n}',
        },
      }),
    );
    expect(beside?.descLines).toEqual([
      'Double-clicking a node looks up its SourceMap',
      'span and posts revealRange to the editor',
    ]);
    expect(beside && beside.halfW * 2).toBe(
      Math.ceil(maxLineW(beside?.descLines ?? []) + 2 + CALLOUT_OUTER_PAD_X * 2),
    );

    // Where the code sets the width, a description takes as few lines as fit there, evened
    // out, and a word in katakana is not broken.
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
    expect(maxLineW(withWideCode.descLines)).toBeGreaterThanOrEqual(
      maxLineW(withoutCode.descLines),
    );
    expect(withWideCode.descLines).toHaveLength(2);
    for (const word of ['ペイロード', 'プライマリデータベース', 'トランザクション']) {
      expect(withWideCode.descLines.some((line) => line.includes(word))).toBe(true);
    }
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

  it('is as wide as its text when the text is measured, not estimated', () => {
    const text = {
      label: 'INSERT INTO orders',
      description: 'The order transaction commits on the primary in AZ-a',
    };
    const estimated = computePacketCalloutBox(makePacket(text));

    // What a browser hands in: here, a font in which every character is 0.4 em wide.
    const calls: string[] = [];
    measureCalloutsWith((t, size, style = 'normal') => {
      calls.push(style);
      return [...t].length * 0.4 * size;
    });
    const measured = computePacketCalloutBox(makePacket(text));
    expect(measured?.descLines).toEqual([text.description]);
    expect(measured && measured.halfW * 2).toBe(
      Math.ceil(text.description.length * 0.4 * CALLOUT_DESC_SIZE + 2 + CALLOUT_OUTER_PAD_X * 2),
    );
    expect(measured && estimated && measured.halfW).toBeLessThan(estimated?.halfW ?? 0);
    // The heading by its weight, the description by its own.
    expect(new Set(calls)).toEqual(new Set(['bold', 'normal']));

    // A wider font breaks the same description in two: the measurement decides, not the count.
    measureCalloutsWith((t, size) => [...t].length * 0.8 * size);
    expect(computePacketCalloutBox(makePacket(text))?.descLines).toHaveLength(2);

    measureCalloutsWith(null);
    expect(computePacketCalloutBox(makePacket(text))).toEqual(estimated);
  });

  it('breaks Japanese between phrases, not inside a word', () => {
    // Ten characters to a line: each break falls after a particle or a comma, and neither
    // テーブル nor 一意制約 is cut.
    expect(
      wrapText(
        '出勤時刻を打刻テーブルへ書き込み、同じ日の打刻が二重に登録されないよう一意制約で守る',
        14,
        140,
        6,
      ),
    ).toEqual([
      '出勤時刻を打刻',
      'テーブルへ書き込み、',
      '同じ日の打刻が二重に',
      '登録されないよう',
      '一意制約で守る',
    ]);
    // One kana between two kanji ends a phrase when it is a particle, as in 在庫を引き; in
    // 引き当て and 受け取り it is part of the word.
    expect(wrapText('在庫を引き当て、荷物を受け取り次第に確認', 14, 98, 6)).toEqual([
      '在庫を',
      '引き当て、',
      '荷物を',
      '受け取り次第に',
      '確認',
    ]);
    // A run with nothing to break at is still broken, so that it cannot outgrow a line.
    const run = wrapText('あ'.repeat(30), 14, 140, 6);
    expect(run.length).toBeGreaterThan(2);
    expect(run.join('')).toBe('あ'.repeat(30));
  });

  it('fills the lines of a description, and leaves no word or two alone on the last', () => {
    // A description that fits on one line is not broken, though the callout is then wider
    // than its code.
    const short = computePacketCalloutBox(
      makePacket({
        label: 'INSERT INTO orders',
        description: 'The order transaction commits on the primary in AZ-a',
        code: {
          lang: 'sql',
          body: "INSERT INTO orders (id, total_cents, status)\nVALUES ('ord_01JCK9X7', 14800, 'COMMITTED');",
        },
      }),
    );
    expect(short?.descLines).toEqual(['The order transaction commits on the primary in AZ-a']);

    // Code wider than any line of the description: the lines take that width. Filled to it,
    // the last line would be 記録する alone, so the line above gives up phrases until the
    // last is a quarter of the width; the lines are not shortened further to even them out.
    const box = computePacketCalloutBox(
      makePacket({
        label: '在庫を引き当てる',
        description: '注文を確定する前に、在庫サービスへ引き当てを依頼し、結果を台帳へ記録する',
        code: {
          lang: 'sql',
          body: 'INSERT INTO stock_reservations (order_id, sku, quantity, reserved_at) VALUES ($1, $2, $3, now());',
        },
      }),
    );
    expect(box?.descLines).toEqual([
      '注文を確定する前に、在庫サービスへ引き当てを依頼し、',
      '結果を台帳へ記録する',
    ]);

    // Where the description sets the width, its lines are evenly long and the callout no wider.
    const alone = computePacketCalloutBox(
      makePacket({
        description:
          'Double-clicking a node looks up its SourceMap span and posts revealRange to the editor',
      }),
    );
    const widths = (alone?.descLines ?? []).map((l) => textWidth(l, CALLOUT_DESC_SIZE));
    expect(widths).toHaveLength(2);
    expect(Math.min(...widths) / Math.max(...widths)).toBeGreaterThan(0.8);
    expect(alone && alone.halfW * 2).toBe(Math.ceil(Math.max(...widths) + 2 + 32));
  });

  it('starts the heading after the number, and what follows under the number', () => {
    const texts = (packet: Packet, cls: string) =>
      findAll(buildPacket(packet), (e) => e.attrs.class === cls).map((e) => Number(e.attrs.x));
    const left = (packet: Packet): number => {
      const box = computePacketCalloutBox(packet);
      return box ? box.cx - box.halfW + box.padX : Number.NaN;
    };
    const code = { lang: 'sql', body: 'SELECT 1;' };

    // With a heading: only the heading is moved in, so no room is lost below the number.
    const headed = { ...makePacket({ label: 'Query', description: 'Reads one row', code }) };
    headed.stopLabel = '2';
    expect(computePacketCalloutBox(headed)?.bodyIndent).toBe(0);
    expect(texts(headed, 'dav-packet-label')).toEqual([left(headed) + CALLOUT_NUMBER_ROOM]);
    expect(texts(headed, 'dav-packet-desc')).toEqual([left(headed)]);
    const headedBox = findAll(buildPacket(headed), (e) => e.attrs.class === 'dav-packet-code-box');
    expect(headedBox[0]?.attrs.x).toBe(left(headed));

    // Without one: the number stands before the first line, and every line starts after it.
    const bare = { ...makePacket({ description: 'Reads one row', code }) };
    bare.stopLabel = '2';
    expect(computePacketCalloutBox(bare)?.bodyIndent).toBe(CALLOUT_NUMBER_ROOM);
    expect(texts(bare, 'dav-packet-desc')).toEqual([left(bare) + CALLOUT_NUMBER_ROOM]);
  });
});

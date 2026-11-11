import { describe, expect, it } from 'vitest';
import { highlightCodeLine } from '../codeHighlight';
import { THEME_COLOR, type VNode } from '../index';

type TokenRun = { kind: 'plain'; text: string } | { kind: 'span'; fill: string; text: string };

function toRuns(nodes: readonly VNode[]): TokenRun[] {
  return nodes.map((node) => {
    if (typeof node === 'string') {
      return { kind: 'plain', text: node };
    }
    expect(node.tag).toBe('tspan');
    return {
      kind: 'span',
      fill: String(node.attrs.fill),
      text: node.children.map((c) => (typeof c === 'string' ? c : '')).join(''),
    };
  });
}

function textOf(nodes: readonly VNode[]): string {
  return nodes
    .map((node) =>
      typeof node === 'string'
        ? node
        : node.children.map((c) => (typeof c === 'string' ? c : '')).join(''),
    )
    .join('');
}

describe('highlightCodeLine', () => {
  it('highlights JSON keys, strings, numbers, keywords, and punctuation', () => {
    const keyString = '  "orderId": "ord-123",';
    expect(textOf(highlightCodeLine(keyString))).toBe(keyString);
    expect(toRuns(highlightCodeLine(keyString))).toEqual([
      { kind: 'plain', text: '  ' },
      { kind: 'span', fill: THEME_COLOR.codeKey, text: '"orderId"' },
      { kind: 'span', fill: THEME_COLOR.codePunc, text: ':' },
      { kind: 'plain', text: ' ' },
      { kind: 'span', fill: THEME_COLOR.codeStr, text: '"ord-123"' },
      { kind: 'span', fill: THEME_COLOR.codePunc, text: ',' },
    ]);

    const scalars = '{"count": -42, "rate": 3.14e-2, "ok": true, "err": false, "meta": null}';
    expect(textOf(highlightCodeLine(scalars))).toBe(scalars);
    expect(toRuns(highlightCodeLine(scalars))).toEqual([
      { kind: 'span', fill: THEME_COLOR.codePunc, text: '{' },
      { kind: 'span', fill: THEME_COLOR.codeKey, text: '"count"' },
      { kind: 'span', fill: THEME_COLOR.codePunc, text: ':' },
      { kind: 'plain', text: ' ' },
      { kind: 'span', fill: THEME_COLOR.codeNum, text: '-42' },
      { kind: 'span', fill: THEME_COLOR.codePunc, text: ',' },
      { kind: 'plain', text: ' ' },
      { kind: 'span', fill: THEME_COLOR.codeKey, text: '"rate"' },
      { kind: 'span', fill: THEME_COLOR.codePunc, text: ':' },
      { kind: 'plain', text: ' ' },
      { kind: 'span', fill: THEME_COLOR.codeNum, text: '3.14e-2' },
      { kind: 'span', fill: THEME_COLOR.codePunc, text: ',' },
      { kind: 'plain', text: ' ' },
      { kind: 'span', fill: THEME_COLOR.codeKey, text: '"ok"' },
      { kind: 'span', fill: THEME_COLOR.codePunc, text: ':' },
      { kind: 'plain', text: ' ' },
      { kind: 'span', fill: THEME_COLOR.codeKw, text: 'true' },
      { kind: 'span', fill: THEME_COLOR.codePunc, text: ',' },
      { kind: 'plain', text: ' ' },
      { kind: 'span', fill: THEME_COLOR.codeKey, text: '"err"' },
      { kind: 'span', fill: THEME_COLOR.codePunc, text: ':' },
      { kind: 'plain', text: ' ' },
      { kind: 'span', fill: THEME_COLOR.codeKw, text: 'false' },
      { kind: 'span', fill: THEME_COLOR.codePunc, text: ',' },
      { kind: 'plain', text: ' ' },
      { kind: 'span', fill: THEME_COLOR.codeKey, text: '"meta"' },
      { kind: 'span', fill: THEME_COLOR.codePunc, text: ':' },
      { kind: 'plain', text: ' ' },
      { kind: 'span', fill: THEME_COLOR.codeKw, text: 'null' },
      { kind: 'span', fill: THEME_COLOR.codePunc, text: '}' },
    ]);
  });

  it('highlights escaped quotes, single-quoted strings, and ellipsis-truncated strings', () => {
    const escaped = '"msg": "say \\"hi\\""';
    expect(toRuns(highlightCodeLine(escaped))).toEqual([
      { kind: 'span', fill: THEME_COLOR.codeKey, text: '"msg"' },
      { kind: 'span', fill: THEME_COLOR.codePunc, text: ':' },
      { kind: 'plain', text: ' ' },
      { kind: 'span', fill: THEME_COLOR.codeStr, text: '"say \\"hi\\""' },
    ]);

    const truncatedDouble = '  "payload": "very long value…';
    expect(toRuns(highlightCodeLine(truncatedDouble))).toEqual([
      { kind: 'plain', text: '  ' },
      { kind: 'span', fill: THEME_COLOR.codeKey, text: '"payload"' },
      { kind: 'span', fill: THEME_COLOR.codePunc, text: ':' },
      { kind: 'plain', text: ' ' },
      { kind: 'span', fill: THEME_COLOR.codeStr, text: '"very long value…' },
    ]);

    const truncatedSingle = "'single…";
    expect(toRuns(highlightCodeLine(truncatedSingle))).toEqual([
      { kind: 'span', fill: THEME_COLOR.codeStr, text: "'single…" },
    ]);
  });

  it('highlights SQL, HTTP, and status keywords without splitting identifiers', () => {
    const sql =
      'BEGIN; INSERT INTO orders VALUES (1) RETURNING id; SELECT id FROM orders WHERE ok = true AND n = 2 OR n = 3 LIMIT 1; UPDATE t SET x = 1; COMMIT; ROLLBACK;';
    const runs = toRuns(highlightCodeLine(sql));
    expect(textOf(highlightCodeLine(sql))).toBe(sql);

    const kwTokens = runs
      .filter((r): r is Extract<TokenRun, { kind: 'span' }> => r.kind === 'span')
      .filter((r) => r.fill === THEME_COLOR.codeKw)
      .map((r) => r.text);
    expect(kwTokens).toEqual([
      'BEGIN',
      'INSERT',
      'INTO',
      'VALUES',
      'RETURNING',
      'SELECT',
      'FROM',
      'WHERE',
      'true',
      'AND',
      'OR',
      'LIMIT',
      'UPDATE',
      'SET',
      'COMMIT',
      'ROLLBACK',
    ]);

    const http = 'POST /v1/orders HTTP/1.1 -> OK undefined ERR';
    const httpKw = toRuns(highlightCodeLine(http))
      .filter((r): r is Extract<TokenRun, { kind: 'span' }> => r.kind === 'span')
      .filter((r) => r.fill === THEME_COLOR.codeKw)
      .map((r) => r.text);
    expect(httpKw).toEqual(['POST', 'HTTP/1.1', 'OK', 'undefined', 'ERR']);
    // `/v1/orders` keeps `v1` as plain text rather than highlighting `1` as a standalone number.
    expect(toRuns(highlightCodeLine('POST /v1/orders'))).toEqual([
      { kind: 'span', fill: THEME_COLOR.codeKw, text: 'POST' },
      { kind: 'plain', text: ' /v1/orders' },
    ]);
  });

  it('highlights // and # comments while ignoring # inside strings or non-comment tokens', () => {
    expect(toRuns(highlightCodeLine('const x = 1 // trailing comment'))).toEqual([
      { kind: 'plain', text: 'const x = ' },
      { kind: 'span', fill: THEME_COLOR.codeNum, text: '1' },
      { kind: 'plain', text: ' ' },
      { kind: 'span', fill: THEME_COLOR.codePunc, text: '// trailing comment' },
    ]);

    expect(toRuns(highlightCodeLine('  # YAML comment'))).toEqual([
      { kind: 'plain', text: '  ' },
      { kind: 'span', fill: THEME_COLOR.codePunc, text: '# YAML comment' },
    ]);

    expect(toRuns(highlightCodeLine('timeout: 30 # inline note'))).toEqual([
      { kind: 'span', fill: THEME_COLOR.codeKey, text: 'timeout' },
      { kind: 'span', fill: THEME_COLOR.codePunc, text: ':' },
      { kind: 'plain', text: ' ' },
      { kind: 'span', fill: THEME_COLOR.codeNum, text: '30' },
      { kind: 'plain', text: ' ' },
      { kind: 'span', fill: THEME_COLOR.codePunc, text: '# inline note' },
    ]);

    expect(toRuns(highlightCodeLine('#'))).toEqual([
      { kind: 'span', fill: THEME_COLOR.codePunc, text: '#' },
    ]);

    // `#anchor` without following whitespace and `#` inside quotes are not comments.
    expect(toRuns(highlightCodeLine('ref #anchor'))).toEqual([
      { kind: 'plain', text: 'ref #anchor' },
    ]);
    expect(toRuns(highlightCodeLine('"#not-a-comment"'))).toEqual([
      { kind: 'span', fill: THEME_COLOR.codeStr, text: '"#not-a-comment"' },
    ]);
  });

  it('highlights unquoted keys but skips URL schemes and reserved keywords before colons', () => {
    expect(toRuns(highlightCodeLine('  content-type.v2: "application/json"'))).toEqual([
      { kind: 'plain', text: '  ' },
      { kind: 'span', fill: THEME_COLOR.codeKey, text: 'content-type.v2' },
      { kind: 'span', fill: THEME_COLOR.codePunc, text: ':' },
      { kind: 'plain', text: ' ' },
      { kind: 'span', fill: THEME_COLOR.codeStr, text: '"application/json"' },
    ]);

    // `http://...` has `:/`, so `http` is not treated as an unquoted key.
    const urlRuns = toRuns(highlightCodeLine('http://example.com'));
    expect(urlRuns[0]).toEqual({ kind: 'plain', text: 'http' });

    // Keywords followed by `:` stay highlighted as keywords rather than unquoted keys.
    expect(toRuns(highlightCodeLine('GET: 200'))).toEqual([
      { kind: 'span', fill: THEME_COLOR.codeKw, text: 'GET' },
      { kind: 'span', fill: THEME_COLOR.codePunc, text: ':' },
      { kind: 'plain', text: ' ' },
      { kind: 'span', fill: THEME_COLOR.codeNum, text: '200' },
    ]);
  });
});

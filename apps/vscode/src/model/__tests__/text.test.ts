import { describe, expect, it } from 'vitest';
import {
  EDGE_LABEL_FONT_SIZE,
  estimateTextWidth,
  isWide,
  lineAtOffset,
  normalizeCodeIndent,
  pushToMap,
} from '../text';
import type { DavLocale } from '../types';

describe('isWide and estimateTextWidth', () => {
  it('classifies ASCII/Latin as narrow and CJK/Hangul/full-width/emoji as wide', () => {
    expect(isWide('')).toBe(false);
    expect(isWide('A')).toBe(false);
    expect(isWide('é')).toBe(false);
    expect(isWide('ᄀ')).toBe(true); // U+1100 Hangul Jamo
    expect(isWide('あ')).toBe(true); // Hiragana
    expect(isWide('漢')).toBe(true); // CJK Unified Ideograph
    expect(isWide('한')).toBe(true); // Hangul Syllable
    expect(isWide('Ａ')).toBe(true); // Fullwidth Latin
    expect(isWide('🚀')).toBe(true); // Supplementary plane emoji
  });

  it('computes deterministic em-scaled widths across narrow and wide code points', () => {
    expect(estimateTextWidth('', EDGE_LABEL_FONT_SIZE)).toBe(0);
    expect(estimateTextWidth('abc', 10)).toBeCloseTo(3 * 0.58 * 10, 6);
    expect(estimateTextWidth('日本語', 10)).toBeCloseTo(3 * 1 * 10, 6);
    expect(estimateTextWidth('A漢🚀', 12)).toBeCloseTo((0.58 + 1 + 1) * 12, 6);
  });
});

describe('normalizeCodeIndent', () => {
  it('trims single-line input and normalizes tabs in default fence mode', () => {
    expect(normalizeCodeIndent('  SELECT 1;  ')).toBe('SELECT 1;');
    expect(normalizeCodeIndent('\tconst x = 1;\t')).toBe('const x = 1;');
    expect(normalizeCodeIndent('   \t  ')).toBe('');
  });

  it('drops at most one leading and one trailing blank line in default fence mode', () => {
    const raw = '\n\n    const a = 1;   \n      \n      return a;\n\n';
    expect(normalizeCodeIndent(raw)).toBe('\nconst a = 1;\n\n  return a;\n');
  });

  it('normalizes CRLF, CR, and tabs while stripping common indentation', () => {
    const raw = '\r\n\t\tif (ok) {\r\n\t\t\tcommit();\t \r\t\t}\r\n';
    expect(normalizeCodeIndent(raw)).toBe('if (ok) {\n  commit();\n}');
  });

  it('returns empty string for blank multi-line fences and preserves zero-indent blocks', () => {
    expect(normalizeCodeIndent('\n   \n')).toBe('');
    expect(normalizeCodeIndent('\nalpha\n  beta\n')).toBe('alpha\n  beta');
  });

  it('strips all leading and trailing blank lines when stripAllOuterBlankLines is true', () => {
    const raw = '\n\r\n   \n    SELECT id, amount  \n  \t \n      FROM orders;\t\n\n   \n';
    expect(normalizeCodeIndent(raw, { stripAllOuterBlankLines: true })).toBe(
      'SELECT id, amount\n\n  FROM orders;',
    );
  });

  it('handles single-line and all-whitespace inputs when stripAllOuterBlankLines is true', () => {
    expect(normalizeCodeIndent('    POST /v1/orders   ', { stripAllOuterBlankLines: true })).toBe(
      'POST /v1/orders',
    );
    expect(normalizeCodeIndent('   ', { stripAllOuterBlankLines: true })).toBe('');
    expect(normalizeCodeIndent('\n  \t\r\n   \n', { stripAllOuterBlankLines: true })).toBe('');
  });
});

describe('lineAtOffset', () => {
  it('returns 1-based line numbers and clamps out-of-range offsets', () => {
    const text = 'dav 1\nnode a\nnode b';
    expect(lineAtOffset(text, -10)).toBe(1);
    expect(lineAtOffset(text, 0)).toBe(1);
    expect(lineAtOffset(text, 5)).toBe(1); // at first '\n'
    expect(lineAtOffset(text, 6)).toBe(2); // right after first '\n'
    expect(lineAtOffset(text, 12)).toBe(2); // at second '\n'
    expect(lineAtOffset(text, 13)).toBe(3); // 'n' of 'node b'
    expect(lineAtOffset(text, 999)).toBe(3);
    expect(lineAtOffset(text, Number.POSITIVE_INFINITY)).toBe(3);
    expect(lineAtOffset(text, Number.NEGATIVE_INFINITY)).toBe(1);
    expect(lineAtOffset(text, Number.NaN)).toBe(1);
    expect(lineAtOffset('', 0)).toBe(1);
    expect(lineAtOffset('', 5)).toBe(1);
  });
});

describe('pushToMap and DavLocale', () => {
  it('appends to existing buckets in place without reallocating', () => {
    const map = new Map<DavLocale, number[]>();
    pushToMap(map, 'ja', 1);
    const jaBucket = map.get('ja');
    expect(jaBucket).toEqual([1]);

    pushToMap(map, 'ja', 2);
    pushToMap(map, 'en', 10);

    expect(map.get('ja')).toBe(jaBucket);
    expect(map.get('ja')).toEqual([1, 2]);
    expect(map.get('en')).toEqual([10]);
  });
});

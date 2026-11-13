import { describe, expect, it } from 'vitest';
import { isWide, lineAtOffset, normalizeCodeIndent, pushToMap, textWidth } from '../text';
import type { DavLocale } from '../types';

describe('isWide and textWidth', () => {
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

  it('gives each kind of character a width, by the style the text is set in', () => {
    expect(textWidth('', 11)).toBe(0);
    expect(textWidth('abc', 10)).toBeCloseTo(3 * 0.6 * 10, 6);
    expect(textWidth('abc', 10, 'bold')).toBeCloseTo(3 * 0.65 * 10, 6);
    // A capital is wider than a small letter, and W, M, @ and % are the widest.
    expect(textWidth('aBW', 10)).toBeCloseTo((0.6 + 0.68 + 0.88) * 10, 6);
    expect(textWidth('aBW', 10, 'bold')).toBeCloseTo((0.65 + 0.72 + 0.92) * 10, 6);
    expect(textWidth('aBW', 10, 'mono')).toBeCloseTo(3 * 0.605 * 10, 6);
  });

  it('takes a CJK character, and the signs set like one, to be one em in every style', () => {
    for (const style of ['normal', 'bold', 'mono'] as const) {
      expect(textWidth('日本語', 10, style)).toBeCloseTo(30, 6);
      for (const sign of ['—', '…', '→', '●', '①', '¥', '、']) {
        expect(textWidth(sign, 10, style)).toBeCloseTo(10, 6);
      }
      // An emoji is wider than its em.
      expect(textWidth('🚀', 10, style)).toBeCloseTo(14, 6);
    }
  });

  it('does not take a text all in capitals to be as narrow as the same in small letters', () => {
    // In Segoe UI Bold, DOWN is 3.29 em wide: a flat 0.58 em a letter gave 2.32.
    expect(textWidth('DOWN', 1, 'bold')).toBeGreaterThan(3);
    expect(textWidth('DOWN', 1, 'bold')).toBeGreaterThan(textWidth('down', 1, 'bold') * 1.15);
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

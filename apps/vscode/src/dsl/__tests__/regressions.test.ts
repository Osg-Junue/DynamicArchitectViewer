import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../layout';
import { ICON_NAMES } from '../../model/types';
import { computeCompletions, parse } from '../index';

const labels = (text: string) =>
  computeCompletions(text, text.length, true)?.items.map((i) => i.label);

describe('duplicate IDs keep the model a tree', () => {
  it('lays out a group nested in a group with the same ID', () => {
    const { document, diagnostics } = parse(
      'group a "A" {\n  group a "B" {\n    node x\n  }\n}\nstep "s" {}',
    );
    expect(diagnostics.map((d) => d.code)).toEqual(['duplicate-id']);
    expect(document.groups.map((g) => g.label)).toEqual(['A']);
    expect(document.nodes[0]?.parentId).toBe('a');
    const layout = computeLayout(document);
    expect(layout.nodes.x).toBeDefined();
    expect(layout.groups.a).toBeDefined();
  });

  it('lays out an empty self-nested group', () => {
    const { document } = parse('group a {\n  group a {}\n}\nstep "s" {}');
    expect(computeLayout(document).groups.a).toBeDefined();
  });

  it('moves members of a duplicate group up when the ID belongs to a node', () => {
    const { document } = parse('node a\ngroup a {\n  node x\n}\nstep "s" {}');
    expect(document.groups).toEqual([]);
    expect(document.nodes.find((n) => n.id === 'x')?.parentId).toBeUndefined();
    expect(computeLayout(document).nodes.x).toBeDefined();
  });

  it('keeps only the first node declaration', () => {
    const { document } = parse('node a "first"\nnode a "second"\nstep "s" {}');
    expect(document.nodes.map((n) => n.label)).toEqual(['first']);
  });
});

describe('IDs named after Object.prototype members', () => {
  it('serializes a __proto__ node', () => {
    const { document } = parse('node __proto__\nnode b\nstep "s" {\n  animate __proto__ --> b\n}');
    const layout = computeLayout(document);
    expect(Object.keys(layout.nodes).sort()).toEqual(['__proto__', 'b']);
    const restored = JSON.parse(JSON.stringify(layout)) as typeof layout;
    expect(Object.keys(restored.nodes).sort()).toEqual(['__proto__', 'b']);
  });

  it('creates the frame of a group named constructor', () => {
    const { document } = parse('group constructor {\n  node x\n}\nstep "s" {}');
    expect(Object.keys(computeLayout(document).groups)).toEqual(['constructor']);
  });

  it('reports attributes named after prototype members as unknown', () => {
    const { diagnostics } = parse('node a [constructor: 1, __proto__: 2]\nstep "s" {}');
    expect(diagnostics.map((d) => d.code)).toEqual(['unknown-attribute', 'unknown-attribute']);
  });
});

describe('color values', () => {
  it('accepts color names', () => {
    const { document, diagnostics } = parse('node a [color: yellow]\nstep "s" {}');
    expect(diagnostics).toEqual([]);
    expect(document.nodes[0]?.color).toBe('yellow');
  });

  it('rejects hex colors without suggesting a name', () => {
    const [diagnostic] = parse('node a [color: #ef4444]\nstep "s" {}').diagnostics;
    expect(diagnostic?.code).toBe('invalid-color');
    expect(diagnostic?.args.suggestion).toBe('');
  });

  it('accepts none only in a state', () => {
    const inState = parse('node a\nstep "s" {\n  state a [color: None]\n}');
    expect(inState.diagnostics).toEqual([]);
    expect(inState.document.steps[0]?.states[0]?.color).toBe('none');
    expect(parse('node a [color: none]\nstep "s" {}').diagnostics.map((d) => d.code)).toEqual([
      'invalid-color',
    ]);
  });

  it('offers none when completing a color in a state only', () => {
    expect(labels('node a\nstep "s" {\n  state a [color: ')).toContain('none');
    expect(labels('node a [color: ')).not.toContain('none');
  });

  it('treats color names case-insensitively', () => {
    const { document, diagnostics } = parse(
      'node a [color: Red]\nnode b [color: YELLOW]\nstep "s" {}',
    );
    expect(diagnostics).toEqual([]);
    expect(document.nodes.map((n) => n.color)).toEqual(['red', 'yellow']);
  });

  it('suggests the closest color name', () => {
    const [diagnostic] = parse('node a [color: yelow]\nstep "s" {}').diagnostics;
    expect(diagnostic?.code).toBe('invalid-color');
    expect(diagnostic?.args.suggestion).toBe('yellow');
  });

  it('completes color names', () => {
    expect(labels('node a [color: ')).toContain('yellow');
  });
});

describe('icon values', () => {
  it('treats icon names case-insensitively and supports the new icons', () => {
    const { document, diagnostics } = parse(
      'node a [icon: Auth]\nnode b [icon: AI]\nnode c [icon: sheet]\nnode d [icon: webhook]\nnode e [icon: payment]\nnode f [icon: chat]\nstep "s" {}',
    );
    expect(diagnostics).toEqual([]);
    expect(document.nodes.map((n) => n.icon)).toEqual([
      'auth',
      'ai',
      'sheet',
      'webhook',
      'payment',
      'chat',
    ]);
  });

  it('includes descriptive details in icon completions', () => {
    const res = computeCompletions('node a [icon: ', 14, true);
    const sheetItem = res?.items.find((i) => i.label === 'sheet');
    expect(sheetItem?.detail).toContain('Spreadsheet');
    expect(res?.items).toHaveLength(ICON_NAMES.length);
  });

  it.each([
    ['ja', 'ノード定義', 'スプレッドシート'],
    ['en', 'Node definition', 'Spreadsheet'],
  ] as const)('writes every completion detail in %s', (locale, keyword, icon) => {
    const top = computeCompletions('', 0, true, locale);
    expect(top?.items.find((i) => i.label === 'node')?.detail).toContain(keyword);
    const icons = computeCompletions('node a [icon: ', 14, true, locale);
    expect(icons?.items.find((i) => i.label === 'sheet')?.detail).toContain(icon);
    const details = [...(top?.items ?? []), ...(icons?.items ?? [])].map((i) => i.detail ?? '');
    const japanese = /[぀-ヿ一-鿿]/;
    if (locale === 'en') expect(details.filter((d) => japanese.test(d))).toEqual([]);
  });

  it('highlights exactly the built-in icons', () => {
    const grammar = readFileSync(
      resolve(__dirname, '../../../syntaxes/dav.tmLanguage.json'),
      'utf8',
    );
    expect(/\(\?i:(server[^)]*)\)/.exec(grammar)?.[1]?.split('|')).toEqual([...ICON_NAMES]);
  });

  it('accepts an icon on animate and leaves it unset by default', () => {
    const { document, diagnostics } = parse(
      'node a\nnode b\nstep "s" {\n  animate a --> b [icon: KEY]\n  animate a --> b\n}',
    );
    expect(diagnostics).toEqual([]);
    expect(document.steps[0]?.animations[0]?.icon).toBe('key');
    expect(document.steps[0]?.animations[1]).not.toHaveProperty('icon');
  });

  it('rejects an unknown icon on animate and suggests the closest name', () => {
    const [diagnostic] = parse(
      'node a\nnode b\nstep "s" {\n  animate a --> b [icon: mial]\n}',
    ).diagnostics;
    expect(diagnostic?.code).toBe('unknown-icon');
    expect(diagnostic?.args.suggestion).toBe('mail');
  });

  it('does not falsely suggest 2-char icons for unrelated short words', () => {
    const [d1] = parse('node a [icon: bar]\nstep "s" {}').diagnostics;
    expect(d1?.code).toBe('unknown-icon');
    expect(d1?.args.suggestion).toBe('');

    const [d2] = parse('node a [icon: aii]\nstep "s" {}').diagnostics;
    expect(d2?.code).toBe('unknown-icon');
    expect(d2?.args.suggestion).toBe('ai');
  });
});

describe('arrows', () => {
  it('accepts all four three-character arrows in animate and static', () => {
    const { document, diagnostics } = parse(
      'node a\nnode b\nstep "s" {\n  animate a --> b\n  animate a <-> b\n  animate a ..> b\n  animate a <.> b\n  static a --> b\n  static a <-> b\n  static a ..> b\n  static a <.> b\n}',
    );
    expect(diagnostics).toEqual([]);
    expect(document.steps[0]?.animations.map((a) => [a.style, a.direction])).toEqual([
      ['solid', 'forward'],
      ['solid', 'bidirectional'],
      ['dashed', 'forward'],
      ['dashed', 'bidirectional'],
    ]);
    expect(document.steps[0]?.statics.map((s) => [s.style, s.direction])).toEqual([
      ['solid', 'forward'],
      ['solid', 'bidirectional'],
      ['dashed', 'forward'],
      ['dashed', 'bidirectional'],
    ]);
  });

  it.each(['<-->', '-.->', '<-.->'])('rejects the old arrow %s', (arrow) => {
    const codes = parse(`node a\nnode b\nstep "s" {\n  animate a ${arrow} b\n}`).diagnostics.map(
      (d) => d.code,
    );
    expect(codes).toContain('syntax-error');
  });
});

describe('computeCompletions context', () => {
  it('offers nothing inside strings', () => {
    expect(labels('title "Hello ')).toBeUndefined();
    expect(labels('node a [sub: "the state of ')).toBeUndefined();
    expect(labels('title "say \\" more ')).toBeUndefined();
  });

  it('offers nothing inside comments', () => {
    expect(labels('// note ')).toBeUndefined();
    expect(labels('node a // note ')).toBeUndefined();
  });

  it('still completes after a closed string', () => {
    expect(labels('node a "A" [')).toContain('icon');
  });

  it('limits attribute keys to the statement kind', () => {
    expect(labels('group g [')).toEqual(['color', 'border']);
    expect(labels('step "s" {\n  static a ..> b [')).toEqual(['color']);
    expect(labels('step "s" {\n  animate a --> b [')?.sort()).toEqual([
      'code',
      'color',
      'desc',
      'icon',
      'parallel',
    ]);
  });

  it('completes icon names inside animate attributes', () => {
    expect(labels('step "s" {\n  animate a --> b [icon: ')).toContain('mail');
  });

  it('highlights contextual code blocks and code: attribute without reserving code globally', () => {
    const raw = readFileSync(resolve(__dirname, '../../../syntaxes/dav.tmLanguage.json'), 'utf8');
    const grammar = JSON.parse(raw) as {
      repository: Record<
        string,
        { begin?: string; end?: string; patterns?: Array<{ match?: string }> }
      >;
    };
    const kwMatch = grammar.repository.keywords?.patterns?.[0]?.match ?? '';
    expect(new RegExp(kwMatch).test('node')).toBe(true);
    expect(new RegExp(kwMatch).test('static')).toBe(true);
    expect(new RegExp(kwMatch).test('dav')).toBe(false);
    expect(new RegExp(kwMatch).test('code')).toBe(false);

    expect(grammar.repository['code-fences']?.begin).toBe('```');
    expect(grammar.repository['code-fences']?.end).toBe('```');

    const codeStmtRe = new RegExp(grammar.repository['code-statement']?.patterns?.[0]?.match ?? '');
    expect(codeStmtRe.test('    code json "Order" ```')).toBe(true);
    expect(codeStmtRe.test('    code ```')).toBe(true);
    expect(codeStmtRe.test('    code "{}"')).toBe(true);
    expect(codeStmtRe.test('  animate a --> b { code json "{}" }')).toBe(true);
    expect(codeStmtRe.test('node code "Code"')).toBe(false);
    expect(codeStmtRe.test('code --> api')).toBe(false);

    const attrPatterns = grammar.repository.attributes?.patterns ?? [];
    const attrRe = new RegExp(attrPatterns[attrPatterns.length - 1]?.match ?? '');
    expect(attrRe.test('code: "{}"')).toBe(true);
  });
});

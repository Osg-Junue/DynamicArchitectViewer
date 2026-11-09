import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../layout';
import { computeCompletions, parse } from '../index';

const labels = (text: string) =>
  computeCompletions(text, text.length, true)?.items.map((i) => i.label);

describe('duplicate IDs keep the model a tree', () => {
  it('lays out a group nested in a group with the same ID', () => {
    const { document, diagnostics } = parse(
      'dav 1\ngroup a "A" {\n  group a "B" {\n    node x\n  }\n}',
    );
    expect(diagnostics.map((d) => d.code)).toEqual(['duplicate-id']);
    expect(document.groups.map((g) => g.label)).toEqual(['A']);
    expect(document.nodes[0]?.parentId).toBe('a');
    const layout = computeLayout(document);
    expect(layout.nodes.x).toBeDefined();
    expect(layout.groups.a).toBeDefined();
  });

  it('lays out an empty self-nested group', () => {
    const { document } = parse('dav 1\ngroup a {\n  group a {}\n}');
    expect(computeLayout(document).groups.a).toBeDefined();
  });

  it('moves members of a duplicate group up when the ID belongs to a node', () => {
    const { document } = parse('dav 1\nnode a\ngroup a {\n  node x\n}');
    expect(document.groups).toEqual([]);
    expect(document.nodes.find((n) => n.id === 'x')?.parentId).toBeUndefined();
    expect(computeLayout(document).nodes.x).toBeDefined();
  });

  it('keeps only the first node declaration', () => {
    const { document } = parse('dav 1\nnode a "first"\nnode a "second"');
    expect(document.nodes.map((n) => n.label)).toEqual(['first']);
  });
});

describe('IDs named after Object.prototype members', () => {
  it('serializes a __proto__ node', () => {
    const { document } = parse('dav 1\nnode __proto__\nnode b\n__proto__ --> b');
    const layout = computeLayout(document);
    expect(Object.keys(layout.nodes).sort()).toEqual(['__proto__', 'b']);
    const restored = JSON.parse(JSON.stringify(layout)) as typeof layout;
    expect(Object.keys(restored.nodes).sort()).toEqual(['__proto__', 'b']);
  });

  it('creates the frame of a group named constructor', () => {
    const { document } = parse('dav 1\ngroup constructor {\n  node x\n}');
    expect(Object.keys(computeLayout(document).groups)).toEqual(['constructor']);
  });

  it('reports attributes named after prototype members as unknown', () => {
    const { diagnostics } = parse('dav 1\nnode a [constructor: 1, __proto__: 2]');
    expect(diagnostics.map((d) => d.code)).toEqual(['unknown-attribute', 'unknown-attribute']);
  });
});

describe('color values', () => {
  it('accepts color names', () => {
    const { document, diagnostics } = parse('dav 1\nnode a [color: yellow]');
    expect(diagnostics).toEqual([]);
    expect(document.nodes[0]?.color).toBe('yellow');
  });

  it('rejects hex colors without suggesting a name', () => {
    const [diagnostic] = parse('dav 1\nnode a [color: #ef4444]').diagnostics;
    expect(diagnostic?.code).toBe('invalid-color');
    expect(diagnostic?.args.suggestion).toBe('');
  });

  it('accepts none only in a state', () => {
    const inState = parse('dav 1\nnode a\nstep "s" {\n  state a [color: None]\n}');
    expect(inState.diagnostics).toEqual([]);
    expect(inState.document.steps[0]?.states[0]?.color).toBe('none');
    expect(parse('dav 1\nnode a [color: none]').diagnostics.map((d) => d.code)).toEqual([
      'invalid-color',
    ]);
  });

  it('offers none when completing a color in a state only', () => {
    expect(labels('dav 1\nnode a\nstep "s" {\n  state a [color: ')).toContain('none');
    expect(labels('dav 1\nnode a [color: ')).not.toContain('none');
  });

  it('treats color names case-insensitively', () => {
    const { document, diagnostics } = parse('dav 1\nnode a [color: Red]\nnode b [color: YELLOW]');
    expect(diagnostics).toEqual([]);
    expect(document.nodes.map((n) => n.color)).toEqual(['red', 'yellow']);
  });

  it('suggests the closest color name', () => {
    const [diagnostic] = parse('dav 1\nnode a [color: yelow]').diagnostics;
    expect(diagnostic?.code).toBe('invalid-color');
    expect(diagnostic?.args.suggestion).toBe('yellow');
  });

  it('completes color names', () => {
    expect(labels('dav 1\nnode a [color: ')).toContain('yellow');
  });
});

describe('icon values', () => {
  it('treats icon names case-insensitively and supports the new icons', () => {
    const { document, diagnostics } = parse(
      'dav 1\nnode a [icon: Auth]\nnode b [icon: AI]\nnode c [icon: sheet]\nnode d [icon: webhook]\nnode e [icon: payment]\nnode f [icon: chat]',
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
    const res = computeCompletions('dav 1\nnode a [icon: ', 20, true);
    const sheetItem = res?.items.find((i) => i.label === 'sheet');
    expect(sheetItem?.detail).toContain('Spreadsheet');
    expect(res?.items).toHaveLength(38);
  });

  it.each([
    ['ja', 'ノード定義', 'スプレッドシート'],
    ['en', 'Node definition', 'Spreadsheet'],
  ] as const)('writes every completion detail in %s', (locale, keyword, icon) => {
    const top = computeCompletions('dav 1\n', 6, true, locale);
    expect(top?.items.find((i) => i.label === 'node')?.detail).toContain(keyword);
    const icons = computeCompletions('dav 1\nnode a [icon: ', 20, true, locale);
    expect(icons?.items.find((i) => i.label === 'sheet')?.detail).toContain(icon);
    const details = [...(top?.items ?? []), ...(icons?.items ?? [])].map((i) => i.detail ?? '');
    const japanese = /[぀-ヿ一-鿿]/;
    if (locale === 'en') expect(details.filter((d) => japanese.test(d))).toEqual([]);
  });

  it('does not falsely suggest 2-char icons for unrelated short words', () => {
    const [d1] = parse('dav 1\nnode a [icon: bar]').diagnostics;
    expect(d1?.code).toBe('unknown-icon');
    expect(d1?.args.suggestion).toBe('');

    const [d2] = parse('dav 1\nnode a [icon: aii]').diagnostics;
    expect(d2?.code).toBe('unknown-icon');
    expect(d2?.args.suggestion).toBe('ai');
  });
});

describe('arrows', () => {
  it('accepts the four three-character edge arrows', () => {
    const { document, diagnostics } = parse(
      'dav 1\nnode a\nnode b\na --> b [id: e1]\na <-> b [id: e2]\na ..> b [id: e3]\na <.> b [id: e4]',
    );
    expect(diagnostics).toEqual([]);
    expect(document.edges.map((e) => [e.style, e.direction])).toEqual([
      ['solid', 'forward'],
      ['solid', 'bidirectional'],
      ['dashed', 'forward'],
      ['dashed', 'bidirectional'],
    ]);
  });

  it.each(['<-->', '-.->', '<-.->'])('rejects the old arrow %s', (arrow) => {
    const codes = parse(`dav 1\nnode a\nnode b\na ${arrow} b`).diagnostics.map((d) => d.code);
    expect(codes).toContain('syntax-error');
  });

  it.each([
    ['..>', '-->'],
    ['<.>', '<->'],
  ])('rejects %s in animate and suggests %s', (arrow, suggestion) => {
    const { diagnostics } = parse(`dav 1\nnode a\nnode b\nstep "s" {\n  animate a ${arrow} b\n}`);
    expect(diagnostics.map((d) => d.code)).toEqual(['invalid-animate-arrow']);
    expect(diagnostics[0]?.args.suggestion).toBe(suggestion);
  });
});

describe('computeCompletions context', () => {
  it('offers nothing inside strings', () => {
    expect(labels('dav 1\ntitle "Hello ')).toBeUndefined();
    expect(labels('dav 1\nnode a [sub: "the state of ')).toBeUndefined();
    expect(labels('dav 1\ntitle "say \\" more ')).toBeUndefined();
  });

  it('offers nothing inside comments', () => {
    expect(labels('dav 1\n// note ')).toBeUndefined();
    expect(labels('dav 1\nnode a // note ')).toBeUndefined();
  });

  it('still completes after a closed string', () => {
    expect(labels('dav 1\nnode a "A" [')).toContain('icon');
  });

  it('limits attribute keys to the statement kind', () => {
    expect(labels('dav 1\ngroup g [')).toEqual(['color']);
    expect(labels('dav 1\na --> b [')?.sort()).toEqual(['color', 'id', 'visible']);
    expect(labels('dav 1\na <.> b [')?.sort()).toEqual(['color', 'id', 'visible']);
    expect(labels('step "s" {\n  animate a --> b [')?.sort()).toEqual([
      'color',
      'desc',
      'parallel',
    ]);
  });
});

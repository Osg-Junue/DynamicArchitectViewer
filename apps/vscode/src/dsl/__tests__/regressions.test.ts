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

  it.each([
    ['#1e3a8a', 'blue'],
    ['#ef4444', 'red'],
    ['#f59e0b', 'yellow'],
    ['#10b981', 'green'],
    ['#fff', 'gray'],
  ])('rejects %s and suggests %s', (hex, name) => {
    const [diagnostic] = parse(`dav 1\nnode a [color: ${hex}]`).diagnostics;
    expect(diagnostic?.code).toBe('invalid-color');
    expect(diagnostic?.args.suggestion).toBe(name);
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
    expect(labels('dav 1\na <-.-> b [')?.sort()).toEqual(['color', 'id', 'visible']);
    expect(labels('step "s" {\n  animate a --> b [')?.sort()).toEqual([
      'color',
      'desc',
      'parallel',
    ]);
  });
});

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

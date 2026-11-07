import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addEdge,
  addGroup,
  addNode,
  addStep,
  applyChanges,
  format,
  parse,
  removeElement,
  renameId,
  setAttribute,
  setPlacement,
} from '../index';

const ICONS = ['server', 'database', 'cache', 'screen', 'user'] as const;

const labelArb = fc.string({ maxLength: 12 });

type Op =
  | { kind: 'node'; label: string | undefined; icon: (typeof ICONS)[number]; inGroup: number }
  | { kind: 'group'; label: string | undefined; inGroup: number }
  | { kind: 'edge'; a: number; b: number; dashed: boolean; label: string | undefined }
  | { kind: 'pos'; target: number; x: number; y: number }
  | { kind: 'sub'; target: number; value: string | undefined }
  | { kind: 'step'; title: string; focus: number }
  | { kind: 'remove'; target: number }
  | { kind: 'rename'; target: number };

const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.record({
    kind: fc.constant('node' as const),
    label: fc.option(labelArb, { nil: undefined }),
    icon: fc.constantFrom(...ICONS),
    inGroup: fc.nat(10),
  }),
  fc.record({
    kind: fc.constant('group' as const),
    label: fc.option(labelArb, { nil: undefined }),
    inGroup: fc.nat(10),
  }),
  fc.record({
    kind: fc.constant('edge' as const),
    a: fc.nat(20),
    b: fc.nat(20),
    dashed: fc.boolean(),
    label: fc.option(labelArb, { nil: undefined }),
  }),
  fc.record({
    kind: fc.constant('pos' as const),
    target: fc.nat(20),
    x: fc.integer({ min: -500, max: 2000 }),
    y: fc.integer({ min: -500, max: 2000 }),
  }),
  fc.record({
    kind: fc.constant('sub' as const),
    target: fc.nat(20),
    value: fc.option(labelArb, { nil: undefined }),
  }),
  fc.record({ kind: fc.constant('step' as const), title: labelArb, focus: fc.nat(20) }),
  fc.record({ kind: fc.constant('remove' as const), target: fc.nat(20) }),
  fc.record({ kind: fc.constant('rename' as const), target: fc.nat(20) }),
);

/** Builds a document by applying random edits; every intermediate state must be valid. */
function build(ops: Op[]): string {
  let text = '// generated\ndav 1\ntitle "Generated"\n';
  let counter = 0;
  const fresh = (prefix: string) => `${prefix}${counter++}`;

  for (const op of ops) {
    const doc = parse(text).document;
    const nodeIds = doc.nodes.map((n) => n.id);
    const groupIds = doc.groups.map((g) => g.id);
    const all = [...nodeIds, ...groupIds];
    const pick = <T>(list: T[], i: number): T | undefined =>
      list.length > 0 ? list[i % list.length] : undefined;

    let changes: ReturnType<typeof addNode> = [];
    switch (op.kind) {
      case 'node': {
        const parentId = op.inGroup % 2 === 0 ? pick(groupIds, op.inGroup) : undefined;
        changes = addNode(text, {
          id: fresh('n'),
          ...(op.label !== undefined ? { label: op.label } : {}),
          attrs: { icon: op.icon },
          ...(parentId ? { parentId } : {}),
        });
        break;
      }
      case 'group': {
        const parentId = op.inGroup % 2 === 0 ? pick(groupIds, op.inGroup) : undefined;
        changes = addGroup(text, {
          id: fresh('g'),
          ...(op.label !== undefined ? { label: op.label } : {}),
          ...(parentId ? { parentId } : {}),
        });
        break;
      }
      case 'edge': {
        const from = pick(nodeIds, op.a);
        const to = pick(nodeIds, op.b);
        if (!from || !to) continue;
        const exists = doc.edges.some((e) => e.id === `${from}->${to}`);
        changes = addEdge(text, {
          from,
          to,
          arrow: op.dashed ? '-.->' : '-->',
          ...(op.label !== undefined ? { label: op.label } : {}),
          ...(exists ? { attrs: { id: fresh('e') } } : {}),
        });
        break;
      }
      case 'pos': {
        const id = pick(all, op.target);
        if (!id) continue;
        changes = setPlacement(text, id, { pos: { x: op.x, y: op.y } });
        break;
      }
      case 'sub': {
        const id = pick(nodeIds, op.target);
        if (!id) continue;
        changes = setAttribute(text, id, 'sub', op.value);
        break;
      }
      case 'step': {
        const focus = pick(all, op.focus);
        changes = addStep(text, {
          title: op.title,
          statements: focus ? [{ kind: 'focus', ids: [focus] }] : [],
        });
        break;
      }
      case 'remove': {
        const id = pick(all, op.target);
        if (!id) continue;
        changes = removeElement(text, id);
        break;
      }
      case 'rename': {
        const id = pick(all, op.target);
        if (!id) continue;
        changes = renameId(text, id, fresh('r'));
        break;
      }
    }
    text = applyChanges(text, changes);
    const { diagnostics } = parse(text);
    if (diagnostics.length > 0) {
      throw new Error(
        `Invalid after ${JSON.stringify(op)}:\n${text}\n${JSON.stringify(diagnostics)}`,
      );
    }
  }
  return text;
}

describe('property: edit API', () => {
  it('every edit sequence yields a valid document that keeps comments', () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 30 }), (ops) => {
        const text = build(ops);
        expect(text.startsWith('// generated\n')).toBe(true);
      }),
      { numRuns: 300 },
    );
  });

  it('format is idempotent and semantics-preserving on generated documents', () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 30 }), (ops) => {
        const text = build(ops);
        const once = format(text);
        expect(format(once)).toBe(once);
        expect(parse(once).document).toEqual(parse(text).document);
      }),
      { numRuns: 200 },
    );
  });

  it('labels round-trip through escaping', () => {
    fc.assert(
      fc.property(fc.string(), (label) => {
        const text = applyChanges('dav 1\n', addNode('dav 1\n', { id: 'a', label }));
        const { document, diagnostics } = parse(text);
        expect(diagnostics).toEqual([]);
        expect(document.nodes[0]?.label).toBe(label);
      }),
      { numRuns: 300 },
    );
  });
});

describe('fuzz: arbitrary input never throws', () => {
  const fragments = [
    'dav 1',
    'node',
    'group',
    'step',
    'focus',
    'state',
    'animate',
    'desc',
    'title',
    'a',
    'b',
    '"x"',
    '"',
    '\\',
    '-->',
    '-.->',
    '<-->',
    '[',
    ']',
    '{',
    '}',
    ':',
    ',',
    '@pos(1, 2)',
    '@size(',
    '#fff',
    'icon: server',
    'true',
    '// c',
    '\n',
    ' ',
  ];
  const tokenSoup = fc
    .array(fc.constantFrom(...fragments), { maxLength: 60 })
    .map((parts) => parts.join(' '));

  it('parse and format survive token soup', () => {
    fc.assert(
      fc.property(tokenSoup, (text) => {
        parse(text);
        const formatted = format(text);
        if (formatted !== text) {
          expect(parse(formatted).document).toEqual(parse(text).document);
        }
      }),
      { numRuns: 1000 },
    );
  });

  it('parse survives arbitrary unicode', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 200 }), (text) => {
        parse(text);
        format(text);
      }),
      { numRuns: 500 },
    );
  });
});

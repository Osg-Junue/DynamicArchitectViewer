import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ICON_NAMES } from '../../model/types';
import { format, parse } from '../index';
import { ARROW_TOKENS } from '../schema';

/** Encodes a value as a DSL string literal. */
function quoteString(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
  return `"${escaped}"`;
}

const ICONS = ICON_NAMES;
const ARROWS = ARROW_TOKENS;

// Weighted toward the characters that need escaping, which plain strings almost never contain.
const labelUnit = fc.constantFrom('a', 'Z', ' ', '"', '\\', '\n', '\t', 'あ', '#', '/');
const labelArb = fc.string({ unit: labelUnit, maxLength: 12 });

interface GenGroup {
  name: string;
  nodes: Array<{
    name: string;
    icon: (typeof ICONS)[number];
    sub: string | undefined;
  }>;
}

interface GenSpec {
  title: string;
  groups: GenGroup[];
  rootNodes: Array<{
    name: string;
    icon: (typeof ICONS)[number];
    sub: string | undefined;
  }>;
  edges: Array<{
    a: number;
    b: number;
    arrow: (typeof ARROWS)[number];
    label: string | undefined;
  }>;
  steps: Array<{
    title: string;
    desc: string | undefined;
    focusIdx: number;
    stateIdx: number;
    animFrom: number;
    animTo: number;
    codeKind: 'none' | 'attr' | 'string' | 'fence';
    codeLang: string | undefined;
    codeTitle: string | undefined;
    codeBody: string;
  }>;
}

const codeUnit = fc.constantFrom('a', '1', ' ', '{', '}', ':', '"', '\\', '\n', '\t', '`', 'あ');
const codeBodyArb = fc
  .string({ unit: codeUnit, maxLength: 24 })
  .filter((s) => !s.includes('```') && !s.startsWith('`') && !s.endsWith('`'));

const nodeSpecArb = fc.record({
  name: labelArb,
  icon: fc.constantFrom(...ICONS),
  sub: fc.option(labelArb, { nil: undefined }),
});

const specArb: fc.Arbitrary<GenSpec> = fc.record({
  title: labelArb,
  groups: fc.array(
    fc.record({
      name: labelArb,
      nodes: fc.array(nodeSpecArb, { minLength: 1, maxLength: 3 }),
    }),
    { maxLength: 3 },
  ),
  rootNodes: fc.array(nodeSpecArb, { minLength: 1, maxLength: 4 }),
  edges: fc.array(
    fc.record({
      a: fc.nat(20),
      b: fc.nat(20),
      arrow: fc.constantFrom(...ARROWS),
      label: fc.option(labelArb, { nil: undefined }),
    }),
    { maxLength: 6 },
  ),
  steps: fc.array(
    fc.record({
      title: labelArb,
      desc: fc.option(labelArb, { nil: undefined }),
      focusIdx: fc.nat(20),
      stateIdx: fc.nat(20),
      animFrom: fc.nat(20),
      animTo: fc.nat(20),
      codeKind: fc.constantFrom('none', 'attr', 'string', 'fence'),
      codeLang: fc.option(fc.constantFrom('json', 'sql', 'http', 'code'), { nil: undefined }),
      codeTitle: fc.option(labelArb, { nil: undefined }),
      codeBody: codeBodyArb,
    }),
    { maxLength: 3 },
  ),
});

function buildDsl(spec: GenSpec): string {
  const lines: string[] = ['// generated', 'dav 1', `title ${quoteString(spec.title)}`, ''];
  const nodeIds: string[] = [];
  let nCounter = 0;

  spec.groups.forEach((g, gi) => {
    const gid = `g${gi}`;
    lines.push(`group ${gid} ${quoteString(g.name)} {`);
    for (const n of g.nodes) {
      const nid = `n${nCounter++}`;
      nodeIds.push(nid);
      const attrs = [`icon: ${n.icon}`];
      if (n.sub !== undefined) attrs.push(`sub: ${quoteString(n.sub)}`);
      lines.push(`  node ${nid} ${quoteString(n.name)} [${attrs.join(', ')}]`);
    }
    lines.push('}');
  });

  for (const n of spec.rootNodes) {
    const nid = `n${nCounter++}`;
    nodeIds.push(nid);
    const attrs = [`icon: ${n.icon}`];
    if (n.sub !== undefined) attrs.push(`sub: ${quoteString(n.sub)}`);
    lines.push(`node ${nid} ${quoteString(n.name)} [${attrs.join(', ')}]`);
  }

  if (nodeIds.length > 0) {
    const seenPairs = new Set<string>();
    spec.edges.forEach((e, ei) => {
      const from = nodeIds[e.a % nodeIds.length] ?? 'n0';
      const to = nodeIds[e.b % nodeIds.length] ?? 'n0';
      const pairKey = `${from}->${to}`;
      const explicit = seenPairs.has(pairKey) ? ` [id: e${ei}]` : '';
      seenPairs.add(pairKey);
      const lbl = e.label !== undefined ? ` : ${quoteString(e.label)}` : '';
      // A self-loop cannot be bidirectional.
      const oneWay = e.arrow === '<->' ? '-->' : e.arrow === '<.>' ? '..>' : e.arrow;
      lines.push(`${from} ${from === to ? oneWay : e.arrow} ${to}${lbl}${explicit}`);
    });

    for (const s of spec.steps) {
      const focusTarget = nodeIds[s.focusIdx % nodeIds.length] ?? 'n0';
      const stateTarget = nodeIds[s.stateIdx % nodeIds.length] ?? 'n0';
      const animFrom = nodeIds[s.animFrom % nodeIds.length] ?? 'n0';
      const animTo = nodeIds[s.animTo % nodeIds.length] ?? 'n0';
      lines.push(`step ${quoteString(s.title)} {`);
      if (s.desc !== undefined) lines.push(`  desc ${quoteString(s.desc)}`);
      lines.push(`  focus ${focusTarget}`);
      lines.push(`  state ${stateTarget} [color: blue]`);
      if (s.codeKind === 'attr') {
        lines.push(`  animate ${animFrom} --> ${animTo} [code: ${quoteString(s.codeBody)}]`);
      } else if (s.codeKind === 'string') {
        const lang = s.codeLang ? ` ${s.codeLang}` : '';
        lines.push(`  animate ${animFrom} --> ${animTo} {`);
        lines.push(`    code${lang} ${quoteString(s.codeBody)}`);
        lines.push('  }');
      } else if (s.codeKind === 'fence') {
        const lang = s.codeLang ? ` ${s.codeLang}` : '';
        const title = s.codeTitle !== undefined ? ` ${quoteString(s.codeTitle)}` : '';
        lines.push(`  animate ${animFrom} --> ${animTo} {`);
        lines.push(`    code${lang}${title} \`\`\``);
        for (const bodyLine of s.codeBody.split('\n')) {
          lines.push(`      ${bodyLine}`);
        }
        lines.push('    ```');
        lines.push('  }');
      }
      lines.push('}');
    }
  }

  return `${lines.join('\n')}\n`;
}

describe('property: DSL parse & format', () => {
  it('format is idempotent and semantics-preserving on generated documents', () => {
    fc.assert(
      fc.property(specArb, (spec) => {
        const text = buildDsl(spec);
        const parsed = parse(text);
        expect(parsed.diagnostics).toEqual([]);
        const once = format(text);
        expect(format(once)).toBe(once);
        expect(parse(once).document).toEqual(parsed.document);
      }),
      { numRuns: 200 },
    );
  });

  it('labels round-trip through escaping', () => {
    fc.assert(
      fc.property(fc.string({ unit: labelUnit }), (label) => {
        const text = `dav 1\nnode a ${quoteString(label)}\n`;
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
    'code',
    'json',
    'title',
    'a',
    'b',
    '"x"',
    '"',
    '```',
    '`',
    '\\',
    '-->',
    '..>',
    '<->',
    '[',
    ']',
    '{',
    '}',
    ':',
    ',',
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

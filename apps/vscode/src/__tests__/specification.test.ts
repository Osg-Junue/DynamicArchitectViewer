import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { format, formatDiagnostic, parse } from '../dsl';
import { DIAGNOSTIC_CODES } from '../dsl/diagnostics';
import {
  ARROW_TOKENS,
  ATTRIBUTE_SCHEMA,
  type AttrOwner,
  type AttrType,
  STATE_ATTRIBUTES_BY_TARGET,
} from '../dsl/schema';
import { computeLayout } from '../layout';
import { COLOR_NAMES, ICON_NAMES, KEYWORD_NAMES } from '../model/types';
import { resolveView } from '../scene';

/**
 * docs/specification.md is the reference an agent writes from, so what it enumerates has to be
 * what the language has: no word, attribute or diagnostic missing, and none that is not there.
 */
const ROOT = resolve(__dirname, '../../../..');
const spec = readFileSync(join(ROOT, 'docs/specification.md'), 'utf8').replace(/\r\n/g, '\n');

const inlineCode = (text: string) => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? '');

/** A section, from its heading to the next heading of the same level or a higher one. */
function section(heading: string): string {
  const match = new RegExp(`^(#+) ${heading.replace(/[.*+?^${}()|[\]\\`]/g, '\\$&')}$`, 'm').exec(
    spec,
  );
  expect(match, heading).not.toBeNull();
  const level = match?.[1]?.length ?? 2;
  const rest = spec.slice((match?.index ?? 0) + (match?.[0].length ?? 0));
  const next = new RegExp(`^#{1,${level}} `, 'm').exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

/** The body rows of the tables of a text, as their cells. */
function rows(text: string): string[][] {
  return text
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.startsWith('| :--'))
    .map((line) =>
      line
        .slice(2, -2)
        .split(' | ')
        .map((cell) => cell.trim()),
    );
}

/** The rows of a section's tables whose first cell is code, keyed by that code. */
function codeRows(text: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const row of rows(text)) {
    const [first = '', ...rest] = row;
    const code = /^`([^`]+)`$/.exec(first)?.[1];
    if (code !== undefined) out.set(code, rest);
  }
  return out;
}

const TYPE_NAMES: Record<AttrType, string> = {
  string: 'string',
  bool: 'boolean',
  color: 'color',
  stateColor: 'color, or `none`',
  icon: 'icon',
  ident: 'identifier',
};

describe('docs/specification.md', () => {
  it('names exactly the keywords', () => {
    const keyword = rows(section('Lexical structure')).find(([name]) => name === 'Keyword');
    expect(inlineCode(keyword?.[1] ?? '')).toEqual([...KEYWORD_NAMES]);
  });

  it('names exactly the colors, and `none` for state', () => {
    const color = rows(section('Attributes')).find(([name]) => name === 'color');
    expect(inlineCode(color?.[1] ?? '')).toEqual([...COLOR_NAMES, 'state', 'none']);
  });

  it('names exactly the icons', () => {
    const icons = section('`node`')
      .split('\n')
      .filter((line) => line.startsWith('- **'))
      .flatMap(inlineCode);
    expect(icons).toEqual([...ICON_NAMES]);
    expect(section('`node`')).toContain(`The ${ICON_NAMES.length} icons`);
  });

  it.each([
    ['node', '`node`'],
    ['group', '`group`'],
    ['edge', 'Edges'],
    ['animate', '`animate`'],
  ] as const)('gives %s exactly its attributes, with their types', (owner: AttrOwner, heading) => {
    const attributes = codeRows(section(heading));
    const schema = ATTRIBUTE_SCHEMA[owner];
    // The rows of attributes, and not those of arrows, which the same sections have.
    const written = [...attributes.keys()].filter((name) => /^[a-z]+$/.test(name));
    expect(written).toEqual(Object.keys(schema));
    for (const [name, type] of Object.entries(schema)) {
      expect(attributes.get(name)?.[0], name).toBe(TYPE_NAMES[type]);
    }
  });

  it('gives state exactly its attributes, and says where each applies', () => {
    const attributes = codeRows(section('`state`'));
    expect([...attributes.keys()]).toEqual(Object.keys(ATTRIBUTE_SCHEMA.state));
    for (const [name, [type = '', ...cells]] of attributes) {
      expect(type, name).toBe(TYPE_NAMES[ATTRIBUTE_SCHEMA.state[name] as AttrType]);
      const kinds = ['node', 'group', 'edge'] as const;
      kinds.forEach((kind, i) => {
        expect(cells[i] !== 'Not applicable', `${name} on a ${kind}`).toBe(
          STATE_ATTRIBUTES_BY_TARGET[kind].has(name),
        );
      });
    }
  });

  it('gives exactly the arrows of an edge', () => {
    const arrows = [...codeRows(section('Edges')).keys()].filter((code) =>
      ARROW_TOKENS.includes(code as never),
    );
    expect(arrows).toEqual([...ARROW_TOKENS]);
  });

  it('lists exactly the diagnostics', () => {
    const listed = [...codeRows(section('Diagnostics')).keys()];
    expect([...listed].sort()).toEqual([...DIAGNOSTIC_CODES].sort());
  });

  it('has examples that are valid syntax', () => {
    const examples = [...spec.matchAll(/^(`{3,4})dav\n([\s\S]*?)^\1$/gm)].map((m) => m[2] ?? '');
    expect(examples.length).toBeGreaterThan(0);
    for (const example of examples) {
      const text = example.startsWith('dav ') ? example : `dav 1\n${example}`;
      const syntax = parse(text).diagnostics.filter((d) =>
        ['syntax-error', 'unexpected-eof', 'invalid-escape'].includes(d.code),
      );
      expect(syntax, example).toEqual([]);
    }
  });
});

/** What the specification says the language does, beyond its lists. */
describe('the language as docs/specification.md describes it', () => {
  const codes = (text: string) => parse(text).diagnostics.map((d) => d.code);
  const head = 'dav 1\n';

  it('reads tokens as the lexical structure says', () => {
    const multi = parse(`${head}node a\n  "Label"\n  [icon: api]\n`);
    expect(multi.diagnostics).toEqual([]);
    expect(multi.document.nodes[0]).toMatchObject({ label: 'Label', icon: 'api' });
    expect(codes(`${head}node\u3000a\nnode Node\nnode code\nnode _x9\n`)).toEqual([]);
    expect(codes(`${head}node a [icon: api,]\n`)).toEqual([]);
    expect(codes(`// c\n${head}node a\n`)).toEqual([]);
    expect(codes(`${head}node a "x\\q"\n`)).toEqual(['invalid-escape']);
    // What Unicode counts as whitespace is whitespace; the zero-width space and U+FEFF are not.
    expect(codes(`${head}node\u00a0a\u2028node\u205fb\n`)).toEqual([]);
    expect(codes(`${head}node\u200ba\n`)).toContain('syntax-error');
    expect(codes(`${head}node\ufeffa\n`)).toContain('syntax-error');
    expect(codes(`${head}node a\n\ufeff`)).toEqual(['syntax-error']);
  });

  it('reports what the grammar does not allow', () => {
    expect(codes(`node a\n${head}`)).toContain('missing-header');
    expect(codes('dav 1.0\n')).toEqual(['unsupported-version']);
    expect(codes('dav 01\n')).toEqual(['unsupported-version']);
    expect(codes(`${head}node a [sub: "x"] [visible: true]\n`)).toContain('syntax-error');
    expect(codes(`${head}node a\nnode b\na --> b "L"\n`)).toContain('syntax-error');
    expect(codes(`${head}node a : "L"\n`)).toContain('syntax-error');
    expect(codes(`${head}node a [icon: api`)).toEqual(['unexpected-eof']);
    expect(codes(`${head}node a\nnode b\na -->`)).toEqual(['unexpected-eof']);
  });

  it('checks attribute values as the attributes section says', () => {
    expect(codes(`${head}node a [sub: #fff]\n`)).toEqual(['invalid-attribute-value']);
    expect(codes(`${head}node a [color: #fff]\n`)).toEqual(['invalid-color']);
    expect(codes(`${head}node a [color: none]\n`)).toEqual(['invalid-color']);
    expect(codes(`${head}node a [visible: 1]\n`)).toEqual(['invalid-attribute-value']);
    expect(codes(`${head}node a [color: BLUE, icon: API]\n`)).toEqual([]);
    expect(codes(`${head}node a [desc: "x"]\n`)).toEqual(['unknown-attribute']);
    const twice = parse(`${head}node a [sub: "1", sub: "2"]\n`);
    expect(twice.diagnostics.map((d) => d.code)).toEqual(['duplicate-attribute']);
    expect(twice.document.nodes[0]?.sub).toBe('2');
    // An attribute the statement does not take is not counted as given twice.
    expect(codes(`${head}node a [foo: 1, foo: 2]\n`)).toEqual([
      'unknown-attribute',
      'unknown-attribute',
    ]);
    // Within two letters of a name, or one for a name of three letters or fewer.
    const [near] = parse(`${head}node a [icon: databse]\n`).diagnostics;
    expect(near && formatDiagnostic(near)).toContain('did you mean "database"');
    const [far] = parse(`${head}node a [color: rde]\n`).diagnostics;
    expect(far && formatDiagnostic(far)).not.toContain('did you mean');
  });

  it('counts declarations in the order of the file', () => {
    const later = parse(`${head}node a\nnode b\na --> b [id: x]\nnode x\n`);
    expect(later.diagnostics.map((d) => d.code)).toEqual(['duplicate-id']);
    expect(later.document.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    const edge = parse(`${head}node a\nnode b\na --> b [id: a]\n`);
    expect(edge.diagnostics.map((d) => d.code)).toEqual(['duplicate-id']);
    expect(edge.document.edges).toHaveLength(1);
    const moved = parse(`${head}group x {}\ngroup g {\n  group x {\n    node n\n  }\n}\n`);
    expect(moved.document.nodes[0]?.parentId).toBe('g');
  });

  it('treats edges as the edges section says', () => {
    expect(codes(`${head}node a\nnode b\na <-> b\na --> b\n`)).toEqual(['duplicate-edge']);
    const styles = parse(`${head}node a\nnode b\na --> b\na ..> b\n`);
    expect(styles.diagnostics.map((d) => d.code)).toEqual(['duplicate-edge']);
    expect(styles.document.edges).toHaveLength(2);
    expect(codes(`${head}node a\nnode b\nb <-> a\na --> b\n`)).toEqual([]);
    expect(codes(`${head}node a\na <-> a\n`)).toEqual(['invalid-self-arrow']);
    expect(codes(`${head}node a\na <.> a\n`)).toEqual(['invalid-self-arrow']);
    expect(codes(`${head}group g {}\nnode a\na --> g\n`)).toEqual(['reference-kind-mismatch']);
    expect(codes(`${head}node a\na --> ghost\n`)).toEqual(['undefined-reference']);
  });

  it('reads animate and code as their sections say', () => {
    // Code of whitespace only, as the language counts it, is empty; U+FEFF is not whitespace.
    const codeOf = (second: string) =>
      parse(
        `${head}node a\nnode b\na --> b\nstep "s" {\n  animate a --> b {\n    code "x"\n    code "${second}"\n  }\n}\n`,
      ).document.steps[0]?.animations[0]?.code?.body;
    expect(codeOf('\u0085\u3000')).toBe('x');
    expect(codeOf('\ufeff')).toBe('\ufeff');
    const step = (body: string) => `${head}node a\nnode b\nstep "s" {\n${body}}\n`;
    expect(codes(step('  animate a ..> b\n'))).toEqual(['invalid-animate-arrow']);
    expect(codes(step('  animate a <-> a\n'))).toEqual(['invalid-self-arrow']);
    expect(codes(step('  animate a <.> a\n'))).toEqual(['invalid-animate-arrow']);
    const animation = (body: string) => parse(step(body)).document.steps[0]?.animations[0];
    expect(
      animation('  animate a --> b [desc: "one"] {\n    desc "two"\n    desc "three"\n  }\n')
        ?.description,
    ).toBe('one\ntwo\nthree');
    // The text of a fence starts right after the opening backticks.
    expect(
      animation('  animate a --> b {\n    code ```json\n      { "a": 1 }\n    ```\n  }\n')?.code
        ?.body,
    ).toBe('json\n      { "a": 1 }');
    const repeated = parse(
      step('  animate a --> b [code: "first"] {\n    code "second"\n    code "  "\n  }\n'),
    );
    expect(repeated.diagnostics.map((d) => d.code)).toEqual(['duplicate-code', 'duplicate-code']);
    expect(repeated.document.steps[0]?.animations[0]?.code?.body).toBe('second');
    expect(parse(step('  desc "one"\n  desc "two"\n')).document.steps[0]?.description).toBe(
      'one\ntwo',
    );
  });

  it('shows a step as "What a step shows" says', () => {
    const text = `${head}node a\nnode b [visible: false, badge: "OLD"]\nnode c\na --> b\nc <-> a\nstep "s1" {\n  state b [badge: ""]\n}\nstep "s2" {\n  animate a --> b [color: red]\n  animate b --> a [parallel: true]\n  animate a --> c\n}\n`;
    const { document } = parse(text);
    const layout = computeLayout(document);
    expect(resolveView(document, layout, 0).nodes.map((n) => n.id)).not.toContain('b');
    const second = resolveView(document, layout, 1);
    // Hidden, but a packet of the step ends at it; its declared badge was removed in step 1.
    const b = second.nodes.find((n) => n.id === 'b');
    expect(b).toBeDefined();
    expect(b?.badge).toBeUndefined();
    // A one-way edge is followed only its own way; a two-way edge either way.
    expect(second.phases.flat().map((p) => [p.from, p.to, p.edgeId ?? null, p.stopLabel])).toEqual([
      ['a', 'b', 'a->b', '1a'],
      ['b', 'a', null, '1b'],
      ['a', 'c', 'c->a', '2'],
    ]);
    const overview = resolveView(document, layout, null);
    expect(overview.nodes.every((n) => !n.dimmed)).toBe(true);
    expect(overview.phases).toEqual([]);
  });

  it('keeps a hiding state from emphasizing, even on a group', () => {
    const text = `${head}group g {\n  node a\n}\nnode b\nstep "s" {\n  state g [color: red, visible: false]\n}\n`;
    const { document } = parse(text);
    const view = resolveView(document, computeLayout(document), 0);
    expect(view.nodes.some((n) => n.dimmed)).toBe(false);
  });

  it('gives a line the color of the first packet that runs on it in a phase', () => {
    const text = `${head}node a\nnode b\na <-> b\nstep "s" {\n  animate a --> b [color: red]\n  animate b --> a [color: blue, parallel: true]\n}\n`;
    const { document } = parse(text);
    const view = resolveView(document, computeLayout(document), 0);
    const [first] = view.phases.flat();
    expect(view.edges[0]?.flowColor).toBe(first?.color);
  });

  it('takes about twice as long for a round trip as for a one-way packet', () => {
    const text = `${head}node a\nnode b\na <-> b\nstep "s" {\n  animate a --> b\n}\nstep "t" {\n  animate a <-> b\n}\n`;
    const { document } = parse(text);
    const layout = computeLayout(document);
    const [oneWay = 0] = resolveView(document, layout, 0).phaseDurations;
    const [roundTrip = 0] = resolveView(document, layout, 1).phaseDurations;
    expect(roundTrip).toBeGreaterThan(oneWay * 1.5);
  });

  it('holds to the edge cases the reviews found', () => {
    // A lone \r is whitespace, so a comment runs on past it.
    expect(parse('dav 1\r// c\rnode a\r').document.nodes).toEqual([]);
    // A string that is not read is not checked.
    expect(codes(`${head}node a [foo: "\\q"]\n`)).toEqual(['unknown-attribute']);
    const [none] = parse(`${head}node a\nstep "s" {\n  state a [color: non]\n}\n`).diagnostics;
    expect(none && formatDiagnostic(none)).not.toContain('did you mean');
    expect(codes(`dav "1"\nnode a\n`)).toEqual(['syntax-error']);
    expect(
      codes(`${head}node a\nnode b\nstep "s" {\n  animate a --> b [code: "q", code: "r"]\n}\n`),
    ).toEqual(['duplicate-attribute']);
    expect(parse(`${head}node b ""\n`).document.nodes[0]?.label).toBe('');
    // A comment before the { of an animate keeps the statement and its body as written.
    const kept = `${head}node a\nnode b\nstep "s" {\n  animate a --> b : "x" // c\n  {   desc "d" }\n}\n`;
    expect(format(kept)).toBe(kept);
  });

  it('formats as the formatting section says', () => {
    expect(format(`${head}node a [icon: api,]\n\n\n\nnode b\n`)).toBe(
      `${head}node a [icon: api]\n\nnode b\n`,
    );
    expect(format(`${head}node a\nnode b\nstep "s" {\n  animate a --> b {\n  }\n}\n`)).toBe(
      `${head}node a\nnode b\nstep "s" {\n  animate a --> b\n}\n`,
    );
    expect(format(`${head}group g {\n}\n`)).toBe(`${head}group g {}\n`);
    expect(format('dav 1\r\nnode a\nnode b\n')).toBe('dav 1\r\nnode a\r\nnode b\r\n');
    const broken = `${head}node a [icon: api`;
    expect(format(broken)).toBe(broken);
  });
});

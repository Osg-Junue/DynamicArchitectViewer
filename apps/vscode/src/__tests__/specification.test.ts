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
  border: 'border',
  mount: 'mount',
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
    ['animate', '`animate`'],
    ['static', '`static`'],
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
      const kinds = ['node', 'group'] as const;
      kinds.forEach((kind, i) => {
        expect(cells[i] !== 'Not applicable', `${name} on a ${kind}`).toBe(
          STATE_ATTRIBUTES_BY_TARGET[kind].has(name),
        );
      });
    }
  });

  it('gives exactly the arrows of animate and static', () => {
    for (const heading of ['`animate`', '`static`']) {
      const arrows = [...codeRows(section(heading)).keys()].filter((code) =>
        ARROW_TOKENS.includes(code as never),
      );
      expect(arrows, heading).toEqual([...ARROW_TOKENS]);
    }
  });

  it('lists exactly the diagnostics', () => {
    const listed = [...codeRows(section('Diagnostics')).keys()];
    expect([...listed].sort()).toEqual([...DIAGNOSTIC_CODES].sort());
  });

  it('has examples that are valid syntax', () => {
    const examples = [...spec.matchAll(/^(`{3,4})dav\n([\s\S]*?)^\1$/gm)].map((m) => m[2] ?? '');
    expect(examples.length).toBeGreaterThan(0);
    for (const example of examples) {
      const trimmed = example.trim();
      const text = trimmed.startsWith('static ')
        ? `step "S" {\n${example}\n}\n`
        : example.includes('step ')
          ? example
          : `${example.trimEnd()}\nstep "S" {}\n`;
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
  const foot = '\nstep "S" {}\n';

  it('reads tokens as the lexical structure says', () => {
    const multi = parse(`node a\n  "Label"\n  [icon: api]${foot}`);
    expect(multi.diagnostics).toEqual([]);
    expect(multi.document.nodes[0]).toMatchObject({ label: 'Label', icon: 'api' });
    expect(codes(`node\u3000a\nnode Node\nnode code\nnode _x9${foot}`)).toEqual([]);
    expect(codes(`node a [icon: api,]${foot}`)).toEqual([]);
    expect(codes(`// c\nnode a${foot}`)).toEqual([]);
    expect(codes(`node a "x\\q"${foot}`)).toEqual(['invalid-escape']);
    // What Unicode counts as whitespace is whitespace; the zero-width space and U+FEFF are not.
    expect(codes(`node\u00a0a\u2028node\u205fb${foot}`)).toEqual([]);
    expect(codes(`node\u200ba${foot}`)).toContain('syntax-error');
    expect(codes(`node\ufeffa${foot}`)).toContain('syntax-error');
    expect(codes(`node a${foot}\ufeff`)).toEqual(['syntax-error']);
  });

  it('reports what the grammar does not allow', () => {
    expect(codes('node a\n')).toEqual(['missing-step']);
    expect(codes(`dav 1\nnode a${foot}`)).toContain('syntax-error');
    expect(codes(`node a [sub: "x"] [visible: true]${foot}`)).toContain('syntax-error');
    expect(codes(`node a\nnode b\na --> b : "L"${foot}`)).toContain('syntax-error');
    expect(codes(`node a : "L"${foot}`)).toContain('syntax-error');
    expect(codes('node a [icon: api')).toContain('unexpected-eof');
  });

  it('checks attribute values as the attributes section says', () => {
    expect(codes(`node a [sub: #fff]${foot}`)).toEqual(['invalid-attribute-value']);
    expect(codes(`node a [color: #fff]${foot}`)).toEqual(['invalid-color']);
    expect(codes(`node a [color: none]${foot}`)).toEqual(['invalid-color']);
    expect(codes(`node a [visible: 1]${foot}`)).toEqual(['invalid-attribute-value']);
    expect(codes(`node a [color: BLUE, icon: API]${foot}`)).toEqual([]);
    expect(codes(`node a [desc: "x"]${foot}`)).toEqual(['unknown-attribute']);
    const twice = parse(`node a [sub: "1", sub: "2"]${foot}`);
    expect(twice.diagnostics.map((d) => d.code)).toEqual(['duplicate-attribute']);
    expect(twice.document.nodes[0]?.sub).toBe('2');
    // An attribute the statement does not take is not counted as given twice.
    expect(codes(`node a [foo: 1, foo: 2]${foot}`)).toEqual([
      'unknown-attribute',
      'unknown-attribute',
    ]);
    // Within two letters of a name, or one for a name of three letters or fewer.
    const [near] = parse(`node a [icon: databse]${foot}`).diagnostics;
    expect(near && formatDiagnostic(near)).toContain('did you mean "database"');
    const [far] = parse(`node a [color: rde]${foot}`).diagnostics;
    expect(far && formatDiagnostic(far)).not.toContain('did you mean');
  });

  it('counts declarations in the order of the file', () => {
    const moved = parse(`group x {}\ngroup g {\n  group x {\n    node n\n  }\n}${foot}`);
    expect(moved.diagnostics.map((d) => d.code)).toEqual(['duplicate-id']);
    expect(moved.document.nodes[0]?.parentId).toBe('g');
  });

  it('checks animate and static references and self-loops', () => {
    const step = (body: string) => `group g {}\nnode a\nnode b\nstep "s" {\n${body}}\n`;
    expect(codes(step('  animate a ..> b\n'))).toEqual([]);
    expect(codes(step('  animate a <.> b\n'))).toEqual([]);
    expect(codes(step('  static a ..> b : "Repl"\n'))).toEqual([]);
    expect(codes(step('  animate a <-> a\n'))).toEqual(['invalid-self-arrow']);
    expect(codes(step('  animate a <.> a\n'))).toEqual(['invalid-self-arrow']);
    expect(codes(step('  static a <-> a\n'))).toEqual(['invalid-self-arrow']);
    expect(codes(step('  static a <.> a\n'))).toEqual(['invalid-self-arrow']);
    expect(codes(step('  animate a --> g\n'))).toEqual(['reference-kind-mismatch']);
    expect(codes(step('  static a --> g\n'))).toEqual([]);
    expect(codes(step('  animate a --> ghost\n'))).toEqual(['undefined-reference']);
    expect(codes(step('  static a --> ghost\n'))).toEqual(['undefined-reference']);
  });

  it('reads animate and code as their sections say', () => {
    // Code of whitespace only, as the language counts it, is empty; U+FEFF is not whitespace.
    const codeOf = (second: string) =>
      parse(
        `node a\nnode b\nstep "s" {\n  animate a --> b {\n    code "x"\n    code "${second}"\n  }\n}\n`,
      ).document.steps[0]?.animations[0]?.code?.body;
    expect(codeOf('\u0085\u3000')).toBe('x');
    expect(codeOf('\ufeff')).toBe('\ufeff');
    const step = (body: string) => `node a\nnode b\nstep "s" {\n${body}}\n`;
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

  it('shows self-contained steps as "What a step shows" says', () => {
    const text = `node a\nnode b [visible: false, badge: "OLD"]\nnode c\nstep "s1" {\n  state b [badge: ""]\n}\nstep "s2" {\n  animate a --> b [color: red]\n  animate b --> a [parallel: true]\n  animate a --> c\n}\n`;
    const { document } = parse(text);
    const layout = computeLayout(document);
    expect(resolveView(document, layout, 0).nodes.map((n) => n.id)).not.toContain('b');
    const second = resolveView(document, layout, 1);
    // Step 2 is self-contained: step 1's state does NOT carry over, so b keeps its declared badge.
    const b = second.nodes.find((n) => n.id === 'b');
    expect(b).toBeDefined();
    expect(b?.badge).toBe('OLD');
    expect(second.phases.flat().map((p) => [p.from, p.to, p.stopLabel])).toEqual([
      ['a', 'b', '1a'],
      ['b', 'a', '1b'],
      ['a', 'c', '2'],
    ]);
    const overview = resolveView(document, layout, null);
    expect(overview.nodes.every((n) => !n.dimmed)).toBe(true);
    expect(overview.phases).toEqual([]);
  });

  it('keeps a hiding state from emphasizing, even on a group', () => {
    const text = `group g {\n  node a\n}\nnode b\nstep "s" {\n  state g [color: red, visible: false]\n}\n`;
    const { document } = parse(text);
    const view = resolveView(document, computeLayout(document), 0);
    expect(view.nodes.some((n) => n.dimmed)).toBe(false);
  });

  it('gives a line the color of the first packet that runs on it in a phase', () => {
    const text = `node a\nnode b\nstep "s" {\n  animate a --> b [color: red]\n  animate b --> a [color: blue, parallel: true]\n}\n`;
    const { document } = parse(text);
    const view = resolveView(document, computeLayout(document), 0);
    const [first] = view.phases.flat();
    expect(view.edges[0]?.flowColor).toBe(first?.color);
  });

  it('takes about twice as long for a round trip as for a one-way packet', () => {
    const text = `node a\nnode b\nstep "s" {\n  animate a --> b\n}\nstep "t" {\n  animate a <-> b\n}\n`;
    const { document } = parse(text);
    const layout = computeLayout(document);
    const [oneWay = 0] = resolveView(document, layout, 0).phaseDurations;
    const [roundTrip = 0] = resolveView(document, layout, 1).phaseDurations;
    expect(roundTrip).toBeGreaterThan(oneWay * 1.5);
  });

  it('holds to the edge cases the reviews found', () => {
    // A lone \r is whitespace, so a comment runs on past it.
    expect(parse('// c\rnode a\rstep "s" {}\r').document.nodes).toEqual([]);
    // A string that is not read is not checked.
    expect(codes(`node a [foo: "\\q"]${foot}`)).toEqual(['unknown-attribute']);
    const [none] = parse(`node a\nstep "s" {\n  state a [color: non]\n}\n`).diagnostics;
    expect(none && formatDiagnostic(none)).not.toContain('did you mean');
    expect(
      codes(`node a\nnode b\nstep "s" {\n  animate a --> b [code: "q", code: "r"]\n}\n`),
    ).toEqual(['duplicate-attribute']);
    expect(parse(`node b ""${foot}`).document.nodes[0]?.label).toBe('');
    // A comment before the { of an animate keeps the statement and its body as written.
    const kept = `node a\nnode b\nstep "s" {\n  animate a --> b : "x" // c\n  {   desc "d" }\n}\n`;
    expect(format(kept)).toBe(kept);
  });

  it('formats as the formatting section says', () => {
    expect(format(`node a [icon: api,]\n\n\n\nnode b${foot}`)).toBe(
      `node a [icon: api]\n\nnode b\nstep "S" {}\n`,
    );
    expect(format('node a\nnode b\nstep "s" {\n  animate a --> b {\n  }\n}\n')).toBe(
      'node a\nnode b\nstep "s" {\n  animate a --> b\n}\n',
    );
    expect(format(`group g {\n}${foot}`)).toBe(`group g {}\nstep "S" {}\n`);
    expect(format('node a\r\nnode b\nstep "s" {}\n')).toBe('node a\r\nnode b\r\nstep "s" {}\r\n');
    const broken = 'node a [icon: api';
    expect(format(broken)).toBe(broken);
  });
});

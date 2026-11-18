import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { format, parse } from '../../dsl';
import { computeLayout, zonesPlacedFreely } from '../../layout';
import { zoneOfNodes } from '../../model/zones';
import { SAMPLE_TEMPLATES } from '../../samples';
import { anchorsOf } from '../carriedDocs';
import { layoutMap } from '../layoutMap';
import { crossingsByZone, layoutReport, leftLinks, NOTE_CODES } from '../layoutReport';
import { HINT_CODES, reviewDetail } from '../review';
import { specificationForSkill, withSpecification } from '../specificationText';

const ROOT = resolve(__dirname, '../../../../..');
const WRITING = join(ROOT, 'skills/dav-diagrams');
const READING = join(ROOT, 'skills/dav-reading');
const COMMAND_LINE = join(ROOT, 'skills/dav-cli');
const CHECKER = join(WRITING, 'scripts/dav-check.mjs');
const OUTLINER = join(READING, 'scripts/dav-outline.mjs');
/** The command the `dav-cli` skill has an agent fetch from npm, as this repository builds it. */
const DAV = join(ROOT, 'apps/cli/dist/dav.mjs');
const skill = readFileSync(join(WRITING, 'SKILL.md'), 'utf8');
const reading = readFileSync(join(READING, 'SKILL.md'), 'utf8');
const commandLine = readFileSync(join(COMMAND_LINE, 'SKILL.md'), 'utf8');

const inlineCode = (text: string) => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]);

function section(heading: string): string {
  const start = skill.indexOf(`\n### ${heading}\n`);
  expect(start).toBeGreaterThan(-1);
  return skill.slice(start, skill.indexOf('\n#', start + 1));
}

/** The `.dav` examples of a document: fenced with three backticks, or four around a code fence. */
const davExamples = (text: string): string[] =>
  [...text.matchAll(/^(`{3,4})dav\n([\s\S]*?)^\1$/gm)].map((m) => m[2] ?? '');

const dir = mkdtempSync(join(tmpdir(), 'dav-skill-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
let count = 0;
const fileWith = (text: string) => {
  const file = join(dir, `${count++}.dav`);
  writeFileSync(file, text);
  return file;
};
const run = (script: string, ...args: string[]) => {
  const { status, stdout, stderr } = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
  });
  return { status, stdout, stderr };
};

describe.each([
  ['dav-diagrams', WRITING, skill],
  ['dav-reading', READING, reading],
  ['dav-cli', COMMAND_LINE, commandLine],
])('%s/SKILL.md', (name, skillDir, text) => {
  it('has frontmatter that meets the Agent Skills specification', () => {
    const description = /^description: (.+)$/m.exec(text)?.[1] ?? '';

    expect(text.startsWith('---\n')).toBe(true);
    expect(/^name: (.+)$/m.exec(text)?.[1]).toBe(name);
    expect(description.length).toBeGreaterThan(0);
    expect(description.length).toBeLessThanOrEqual(1024);
    // A plain YAML scalar ends at ": ", which would truncate the description.
    expect(description).not.toContain(': ');
  });

  it('stays within the recommended length', () => {
    expect(text.split('\n').length).toBeLessThan(500);
  });

  it('links only to files that exist', () => {
    for (const [, target] of text.matchAll(/\]\(((?:references|scripts|assets)\/[^)]+)\)/g)) {
      expect(() => readFileSync(join(skillDir, target ?? ''))).not.toThrow();
    }
    for (const [, script] of text.matchAll(/<skill-dir>\/(scripts\/[\w.-]+)/g)) {
      expect(() => readFileSync(join(skillDir, script ?? ''))).not.toThrow();
    }
  });
});

describe('the references of dav-diagrams', () => {
  const references = join(WRITING, 'references');

  it('leave out the exact rules of the layout guide, which are for contributors', () => {
    const guide = readFileSync(join(references, 'layout.md'), 'utf8');
    expect(guide).not.toContain('\n## Exact rules');
    expect(guide).toContain('\n## Recipes');
  });

  it('link only to headings they carry, or to the repository', () => {
    for (const name of readdirSync(references)) {
      const text = readFileSync(join(references, name), 'utf8');
      for (const [, doc, anchor] of text.matchAll(/\]\((?:([\w-]+\.md))?#([\w-]+)\)/g)) {
        const target = readFileSync(join(references, doc ?? name), 'utf8');
        expect([...anchorsOf(target)], `${name}: ${doc ?? ''}#${anchor}`).toContain(anchor);
      }
    }
  });
});

describe('references/checker.md', () => {
  /** The codes in the table of a section, in their order. */
  const codesUnder = (text: string, heading: string): string[] => {
    const start = text.indexOf(`\n## ${heading}\n`);
    expect(start).toBeGreaterThan(-1);
    const part = text.slice(start, text.indexOf('\n## ', start + 1));
    return [...part.matchAll(/^\| `([a-z-]+)` \|/gm)].map((m) => m[1] ?? '');
  };

  it.each([
    ['dav-diagrams', WRITING],
    ['dav-cli', COMMAND_LINE],
  ])('explains in %s every hint and every note the checker gives, and no other', (_, dir) => {
    const reference = readFileSync(join(dir, 'references/checker.md'), 'utf8');
    expect(codesUnder(reference, 'Hints')).toEqual([...HINT_CODES]);
    expect(codesUnder(reference, 'Notes')).toEqual([...NOTE_CODES]);
  });
});

describe('links between zones that point left', () => {
  it('names a link between two zones, or a zone and a node, whose end stands to the left', () => {
    const { document } = parse(
      'dav 1\ngroup l "L" {\n  node a\n  node c\n}\ngroup r "R" {\n  node b\n}\nnode x\na --> b\nb --> x\nx <-> a\na --> c\n',
    );
    const at = (x: number) => ({ x, y: 0, width: 176, height: 118 });
    // a --> c points left too, but inside one zone, where the columns come from the edges.
    expect(leftLinks(document, { nodes: { a: at(400), b: at(0), c: at(0), x: at(800) } })).toEqual([
      'a --> b, from "L" into "R"',
      'x <-> a, into "L"',
    ]);
  });

  const fixtures = join(ROOT, 'apps/vscode/src/scene/__tests__/fixtures');
  it.each(readdirSync(fixtures).sort())('%s: are told as the map tells them', (file) => {
    const { document } = parse(readFileSync(join(fixtures, file), 'utf8'));
    const { summary, notes } = layoutReport(document);
    const free = zonesPlacedFreely(document);
    expect(summary).toContainEqual(
      expect.stringMatching(`^layout: zones ${free ? 'placed freely' : 'in shared columns'}, `),
    );
    // The lines of the map for connections that run left, between two pieces of the layout.
    const zoneOf = zoneOfNodes(document);
    const piece = (id: string) => zoneOf.get(id) ?? id;
    const left = layoutMap(document).flatMap((line) => {
      const [, from = '', arrow, to = ''] =
        /^(\w+) (\S+) (\w+): (?:left|up and left|down and left)\b/.exec(line) ?? [];
      return arrow && piece(from) !== piece(to) ? [`${from} ${arrow} ${to}`] : [];
    });
    const note = notes.find((n) => n.code === 'left-links')?.message ?? '';
    if (!free || left.length === 0) {
      expect(note).toBe('');
      return;
    }
    expect(note).toMatch(
      left.length === 1
        ? /^One connection between zones points left/
        : new RegExp(`^${left.length} connections between zones point left`),
    );
    for (const named of left.slice(0, 5)) expect(note).toContain(`${named}, `);
  });
});

describe('crossings by zone', () => {
  const { document } = parse(
    'dav 1\ngroup l "L" {\n  node a\n  node b\n}\ngroup r "R" {\n  node c\n  node d\n}\nnode x\n',
  );
  // Only the ends of a connection decide its kind; where it is drawn does not matter here.
  const link = (from: string, to: string) => ({ from, to, ax: 0, ay: 0, bx: 0, by: 0 });

  it('counts each crossing once, by the zones that each of its two connections joins', () => {
    expect(
      crossingsByZone(document, [
        [link('a', 'c'), link('b', 'd')],
        [link('a', 'b'), link('c', 'x')],
        [link('c', 'x'), link('a', 'b')],
        [link('a', 'c'), link('b', 'x')],
      ]),
    ).toEqual([
      // A connection inside a zone is named by the zone, one between two by both, and a node
      // outside every zone by its ID. The zones come in the order of the file.
      { zones: '"L" × "R"–x', count: 2 },
      { zones: '"L"–"R" × "L"–"R"', count: 1 },
      { zones: '"L"–"R" × "L"–x', count: 1 },
    ]);
  });
});

describe('dav-diagrams/SKILL.md', () => {
  it('carries the rules of the specification as they are, not retold', () => {
    // docs/specification.md is checked against the language; SKILL.md has to be its copy.
    const specification = readFileSync(join(ROOT, 'docs/specification.md'), 'utf8');
    const carried = readdirSync(join(WRITING, 'references'));
    const rules = specificationForSkill(specification, carried);
    expect(withSpecification(skill, rules)).toBe(skill);
    expect(rules).toContain('Keywords are lowercase and reserved');
    expect(rules).not.toMatch(/^`{3,4}dav$/m);
  });

  it('has only examples that compile cleanly and are as detailed as it asks for', () => {
    const examples = davExamples(skill);
    expect(examples.length).toBeGreaterThan(0);
    for (const dsl of examples) {
      const { document, diagnostics } = parse(dsl);
      expect(diagnostics).toEqual([]);
      expect(reviewDetail(document)).toEqual([]);
    }
  });

  it('names only example files that exist', () => {
    for (const name of inlineCode(skill).filter((code) => code?.endsWith('.dav'))) {
      if (/^\d/.test(name ?? '')) {
        expect(readdirSync(join(WRITING, 'assets/examples'))).toContain(name);
      }
    }
  });

  it('promises no more room for a text than the text has', () => {
    // The table under "Text that fits", as sentences of the lengths it gives.
    const rows = [
      ...section('Text that fits').matchAll(/^\| (.+?) \| (\d+)[^|]*\| (\d+)[^|]*\|$/gm),
    ];
    const size = (label: string, column: 2 | 3) => {
      const row = rows.find((r) => r[1] === label);
      expect(row, label).toBeDefined();
      return Number(row?.[column]);
    };
    const latin =
      'The order service checks stock and reserves the items before it charges the card, then confirms the order to the customer by mail and by a push notice. ';
    const japanese =
      '注文サービスは在庫を確認して引き当てたあと決済を実行し顧客へメールと通知で結果を伝えますその後出荷指示を倉庫へ送ります';
    const places: Array<[string, (text: string) => string]> = [
      ['Node label', (t) => `dav 1\nnode a "${t}" [sub: "x"]\n`],
      ['Node `sub`', (t) => `dav 1\nnode a "A" [sub: "${t}"]\n`],
      ['`badge`', (t) => `dav 1\nnode a "A" [sub: "x", badge: "${t}"]\n`],
      ['Edge label', (t) => `dav 1\nnode a\nnode b\na --> b : "${t}"\n`],
      [
        '`animate` label',
        (t) => `dav 1\nnode a\nnode b\na --> b : "x"\nstep "S" {\n  animate a --> b : "${t}"\n}\n`,
      ],
      [
        '`animate` `desc`',
        (t) =>
          `dav 1\nnode a\nnode b\na --> b : "x"\nstep "S" {\n  animate a --> b : "x" [desc: "${t}"]\n}\n`,
      ],
    ];
    for (const [label, build] of places) {
      for (const [source, column] of [
        [latin, 2],
        [japanese, 3],
      ] as const) {
        const text = source.repeat(3).slice(0, size(label, column)).trim();
        const cuts = reviewDetail(parse(build(text)).document).filter((h) => h.code === 'text-cut');
        expect(cuts, `${label}: "${text}"`).toEqual([]);
      }
    }
  });

  it('ships only examples that are as detailed as it asks for', () => {
    const examples = readdirSync(join(WRITING, 'assets/examples'));
    expect(examples.length).toBeGreaterThan(0);
    for (const name of examples) {
      const { status, stdout } = run(CHECKER, '--detail', join(WRITING, 'assets/examples', name));
      expect(status, stdout).toBe(0);
    }
  });
});

describe('dav-reading/SKILL.md', () => {
  it('shows the outline as the script prints it', () => {
    // Its excerpts are taken from the outline of the reference example of the writing skill.
    const [example] = davExamples(skill);
    const outline = run(OUTLINER, fileWith(example ?? '')).stdout.split('\n');
    const excerpts = [...reading.matchAll(/^```\n([\s\S]*?)^```$/gm)].map((m) => m[1] ?? '');
    expect(excerpts.length).toBeGreaterThanOrEqual(3);
    for (const line of excerpts.join('\n').split('\n')) {
      if (line.trim()) expect(outline, line).toContain(line);
    }
  });
});

describe('dav-cli/SKILL.md', () => {
  const PACKAGE = 'dynamic-architect-viewer-cli';
  const { version } = JSON.parse(readFileSync(join(ROOT, 'apps/cli/package.json'), 'utf8')) as {
    version: string;
  };
  const COMMANDS = ['export', 'check', 'format', 'outline'];
  /** The command lines of its `bash` blocks, as the arguments of `dav`, without their comments. */
  const examples = [...commandLine.matchAll(/^ *```bash\n([\s\S]*?)^ *```$/gm)]
    .flatMap((m) => (m[1] ?? '').split('\n'))
    .map((line) => line.replace(/\s+#.*$/, '').trim())
    .filter((line) => line.startsWith(`npx ${PACKAGE}@`) && !line.includes('<command>'))
    .map((line) => line.split(/\s+/).slice(2));

  /** A project as the examples take it to be: diagrams in `docs` and in `diagrams`. */
  const project = () => {
    const root = mkdtempSync(join(dir, 'project-'));
    const dsl = format(readFileSync(join(ROOT, 'examples/02-screen-flow-checkout.dav'), 'utf8'));
    for (const file of ['docs/checkout.dav', 'docs/orders.dav', 'diagrams/login.dav']) {
      mkdirSync(join(root, file, '..'), { recursive: true });
      writeFileSync(join(root, file), dsl);
    }
    return root;
  };
  const dav = (cwd: string, ...args: string[]) => {
    const { status, stdout, stderr } = spawnSync(process.execPath, [DAV, ...args], {
      cwd,
      encoding: 'utf8',
    });
    // The command names files as the system does; the skill writes them with a slash.
    return { status, said: `${stdout}${stderr}`.replaceAll('\\', '/') };
  };

  it('gives the version of the package wherever it has the package run', () => {
    const versions = [...commandLine.matchAll(new RegExp(`${PACKAGE}@([^\\s\`]+)`, 'g'))];

    expect(versions.length).toBeGreaterThan(0);
    for (const [, named] of versions) expect(named).toBe(version);
    expect(commandLine).not.toMatch(new RegExp(`npx ${PACKAGE}(?!@)`));
  });

  it('names only the commands and options the command has', () => {
    const help = [[], ...COMMANDS.map((command) => [command])]
      .map((command) => dav(dir, ...command, '--help').said)
      .join('\n');
    const known = new Set(help.match(/--[a-z][a-z-]*/g));
    const named = new Set(commandLine.match(/--[a-z][a-z-]*/g));

    expect(named.size).toBeGreaterThan(0);
    expect([...named].filter((option) => !known.has(option))).toEqual([]);
    for (const command of COMMANDS) expect(commandLine).toContain(`| \`${command} <file.dav>`);
    for (const [command] of examples) expect(COMMANDS).toContain(command);
  });

  it('carries the manual of the package, which names only the options the command has', () => {
    const manual = readFileSync(join(COMMAND_LINE, 'references/manual.md'), 'utf8');
    const readme = readFileSync(join(ROOT, 'apps/cli/README.md'), 'utf8');
    const help = [[], ...COMMANDS.map((command) => [command])]
      .map((command) => dav(dir, ...command, '--help').said)
      .join('\n');
    const known = new Set(help.match(/--[a-z][a-z-]*/g));
    // The options of `npm install` are not the command's.
    const ofTheCommand = manual.split('\n').filter((line) => !line.includes('npm install'));
    const named = new Set(ofTheCommand.join('\n').match(/--[a-z][a-z-]*/g));

    // The README of the package, with no link left that would lead out of the skill.
    expect(manual.split('\n').length).toBe(readme.split('\n').length);
    expect(manual).not.toMatch(/\]\((?!https?:|#)/);
    for (const command of COMMANDS) expect(manual).toContain(`## \`dav ${command}\``);
    expect([...named].filter((option) => !known.has(option))).toEqual([]);
  });

  it('has only examples that run', () => {
    const root = project();

    expect(examples.length).toBeGreaterThan(5);
    for (const args of examples) {
      const { status, said } = dav(root, ...args);
      expect(status, `dav ${args.join(' ')}\n${said}`).toBe(0);
    }
  });

  it('shows the lines of export --check as the command prints them', () => {
    const root = project();
    const check = () => dav(root, 'export', '--check', 'docs/checkout.dav');
    const line = (state: string) => `docs/checkout.svg: ${state}`;
    for (const state of ['up to date', 'out of date; ', 'missing; ']) {
      expect(commandLine).toContain(line(state));
    }

    expect(check()).toMatchObject({ status: 1, said: expect.stringContaining(line('missing; ')) });
    expect(dav(root, 'export', 'docs/checkout.dav').said).toMatch(/^docs\/checkout\.svg: \d+ KB$/m);
    expect(check()).toMatchObject({ status: 0, said: expect.stringContaining(line('up to date')) });
    expect(dav(root, 'export', '--check', '--camera', 'whole', 'docs/checkout.dav').said).toContain(
      line('out of date; '),
    );
  });
});

describe('dav-check', () => {
  const check = (...args: string[]) => run(CHECKER, ...args);

  it.each(SAMPLE_TEMPLATES.map((s) => [s.id, s.dsl] as const))(
    'accepts the sample %s',
    (_id, dsl) => {
      expect(check(fileWith(dsl)).status).toBe(0);
    },
  );

  it('reports diagnostics with their position, and exits with 1', () => {
    const file = fileWith('dav 1\nnode a\na --> missing\n');
    const { status, stdout } = check(file);
    expect(status).toBe(1);
    expect(stdout).toContain(`${file}:3:7: error undefined-reference: "missing" is not defined`);
  });

  it('fails on a warning', () => {
    expect(check(fileWith('dav 1\ntitle "a"\ntitle "b"\n')).status).toBe(1);
  });

  it('ignores a byte order mark', () => {
    expect(check(fileWith('﻿dav 1\nnode a\n')).status).toBe(0);
  });

  it('formats the file only with --write', () => {
    const text = 'dav 1\nnode   a\n';
    const file = fileWith(text);

    check(file);
    expect(readFileSync(file, 'utf8')).toBe(text);

    expect(check('--write', file).status).toBe(0);
    expect(readFileSync(file, 'utf8')).not.toBe(text);
    expect(parse(readFileSync(file, 'utf8')).diagnostics).toEqual([]);
  });

  it('leaves a file with a syntax error unchanged', () => {
    const text = 'dav 1\nnode   a [\n';
    const file = fileWith(text);

    expect(check('--write', file).status).toBe(1);
    expect(readFileSync(file, 'utf8')).toBe(text);
  });

  it.each([[[]], [['--bogus', 'a.dav']], [[join(dir, 'missing.dav')]]])(
    'exits with 2 for bad usage: %j',
    (args) => {
      expect(check(...args).status).toBe(2);
    },
  );

  describe('--detail', () => {
    const bare =
      'dav 1\nnode a\nnode b\na --> b\nstep "S" {\n  animate a --> b\n  animate b --> a\n  animate a --> b\n}\n';

    it('passes a bare diagram without it, and reports what is missing with it', () => {
      const file = fileWith(bare);
      expect(check(file).status).toBe(0);

      const { status, stdout } = check('--detail', file);
      expect(status).toBe(1);
      const codes = [...stdout.matchAll(/: hint ([\w-]+):/g)].map((m) => m[1]);
      expect(new Set(codes)).toEqual(
        new Set([
          'edge-without-label',
          'step-without-desc',
          'animate-without-label',
          'animate-without-desc',
          'animate-without-edge',
          'no-code',
        ]),
      );
      expect(stdout).not.toContain(': ok');
    });

    it('says which way a packet without an edge can go instead', () => {
      const hintFor = (edges: string, packet: string) => {
        const dsl = `dav 1\nnode browser\nnode web\nnode api\nnode mail\n${edges}\nstep "S" {\n  desc "d"\n  animate ${packet} : "x" [desc: "d"]\n}\n`;
        const { stdout } = check('--detail', fileWith(dsl));
        return stdout.split('\n').find((line) => line.includes('hint animate-without-edge')) ?? '';
      };
      const chain = 'browser --> web : "a"\nweb --> api : "b"';
      const twoWay = 'browser <-> web : "a"\nweb <-> api : "b"';

      // The request skips a node: the hops are spelled out.
      expect(hintFor(chain, 'browser --> api')).toContain(
        'by way of web: send animate browser --> web, then animate web --> api instead.',
      );
      // The reply rides two-way edges back through the same node.
      expect(hintFor(twoWay, 'api --> browser')).toContain(
        'send animate api --> web, then animate web --> browser instead.',
      );
      // One-way edges do not carry a reply: they are named, with what to make of them.
      expect(hintFor(chain, 'api --> web')).toContain(
        'The edge web --> api runs the other way: make it <->',
      );
      expect(hintFor(chain, 'api --> browser')).toContain(
        '(web --> api, browser --> web): make each of those edges <->, then send animate api --> web, then animate web --> browser instead.',
      );
      // Nothing joins the two.
      expect(hintFor(chain, 'api --> mail')).toContain(
        'No edges join the two. If the code shows that they talk to each other directly, declare api --> mail : "..."',
      );
      // A packet that rides an edge is not reported.
      expect(hintFor(chain, 'browser --> web')).toBe('');
    });

    describe('the layout', () => {
      const good = (body: string) =>
        `dav 1\n${body}\nstep "S" {\n  desc "d"\n  animate a --> b : "x" [desc: "d"] {\n    code text "x"\n  }\n}\n`;
      const lines = (dsl: string) => check('--detail', fileWith(dsl));

      it('is described for a file that compiles, and does not fail the check', () => {
        const { status, stdout } = lines(
          good('node a "A"\nnode b "B"\nnode c "C"\na --> b : "x"\nb --> c : "y"'),
        );
        expect(stdout).toMatch(
          /: layout: \d+ x \d+ \(\d+\.\d : 1\), 3 columns x 1 rows of nodes, 0 crossings/,
        );
        expect(stdout).not.toContain(': note ');
        expect(stdout).toContain(': ok (3 nodes, 2 edges, 1 steps)');
        expect(status).toBe(0);
      });

      it('lists the zones with the columns and rows their nodes take', () => {
        const { stdout } = lines(
          good(
            'group g "Front" {\n  node a "A"\n  node b "B"\n}\ngroup h "Back" {\n  node c "C"\n}\na --> b : "x"\nb --> c : "y"',
          ),
        );
        expect(stdout).toContain(
          'layout: zones in shared columns, as columns x rows of nodes: "Front" 2 x 1, "Back" 1 x 1',
        );
      });

      it('notes a zone whose nodes are stacked, and a diagram much taller than wide', () => {
        const stores = ['s1', 's2', 's3', 's4', 's5']
          .map((id) => `  node ${id} "${id}"`)
          .join('\n');
        const { status, stdout } = lines(
          good(`node a "A"\nnode b "B"\na --> b : "x"\ngroup data "Data stores" {\n${stores}\n}`),
        );
        expect(stdout).toContain(
          'note stacked-zone: Zone "Data stores" stacks its 5 nodes in one column',
        );
        expect(stdout).toContain('note tall-diagram: The diagram is');
        // Notes are for judgment: the file is still in order.
        expect(stdout).toContain(': ok (');
        expect(status).toBe(0);
      });

      it('notes connections that cross', () => {
        // Two columns of two, joined crosswise; b and d have nothing that could reorder them.
        const { stdout } = lines(
          good(
            'node a "A"\nnode c "C"\nnode b "B"\nnode d "D"\na --> b : "x"\na --> d : "y"\nc --> b : "z"\nc --> d : "w"',
          ),
        );
        const crossings = Number(/, (\d+) crossings?/.exec(stdout)?.[1]);
        expect(stdout.includes('note crossings:')).toBe(crossings > 0);
        // A crossing is named by the two connections that cross.
        if (crossings > 0)
          expect(stdout).toMatch(/note crossings: .*: \w+ --> \w+ and \w+ --> \w+/);
        // Without zones, there is nothing to count them by.
        expect(stdout).not.toContain('crossings by the zones');
      });

      it('names the connections that cross as they are written', () => {
        // a and c share a column and b and d the next, each linked both ways to both.
        const { stdout } = lines(
          good(
            'node a "A"\nnode c "C"\nnode b "B"\nnode d "D"\na <-> b : "x"\na <-> d : "y"\nc <-> b : "z"\nc <-> d : "w"',
          ),
        );
        expect(stdout).toContain('note crossings: One pair of connections crosses');
        expect(stdout).toContain(': a <-> d and c <-> b.');
      });

      it('gives the crossings by the zones that the two connections join', () => {
        // Inside one zone, a and c share a column and b and d the next, each linked to both.
        const { stdout } = lines(
          good(
            'group z "Z" {\n  node a "A"\n  node c "C"\n  node b "B"\n  node d "D"\n}\na --> b : "x"\na --> d : "y"\nc --> b : "z"\nc --> d : "w"',
          ),
        );
        expect(stdout).toContain(
          ': layout: crossings by the zones the two connections join, "A" for one inside a zone and "A"–"B" for one between two: "Z" × "Z" 1\n',
        );
      });

      it('notes an edge left out of a loop, with the loop and where its far end stands', () => {
        // The search comes into the loop b, c, a from x: a, declared before b, ends up last.
        const { status, stdout } = lines(
          good(
            'node x "X"\nnode a "A"\nnode b "B"\nnode c "C"\nx --> b : "v"\na --> b : "w"\nb --> c : "y"\nc --> a : "z"',
          ),
        );
        expect(stdout).toContain(
          'note back-edge: a --> b points back, so it does not count for the columns: it closes the loop b → c → a. The layout came into the loop at b, from x, and set it out from left to right in that order: a stands at its far end, in column 4, with b in column 2. To start the loop at another of its nodes, and so stand that node on the left, declare it before x.',
        );
        // A note is for judgment: the file is still in order.
        expect(status).toBe(0);
      });

      it('leaves out a request and its response laid out as the guide says', () => {
        const pair = 'node a "A"\nnode b "B"\na --> b : "request"\nb --> a : "response"';
        expect(lines(good(pair)).stdout).not.toContain('note back-edge');
        // Reached first at the node declared later, the pair stands the other way round.
        expect(lines(good(`node x "X"\n${pair}\nx --> b : "v"`)).stdout).toContain(
          'note back-edge: a --> b points back, so it does not count for the columns: it closes the loop b → a. The layout came into the loop at b, from x,',
        );
      });

      it('is left out while the file does not compile, and without --detail', () => {
        expect(lines('dav 1\nnode a\na --> missing\n').stdout).not.toContain('layout:');
        expect(check(fileWith(good('node a "A"\nnode b "B"\na --> b : "x"'))).stdout).not.toContain(
          'layout:',
        );
      });
    });

    it('reports a text that is drawn cut off', () => {
      const long = 'A very long label that cannot fit under a station';
      const { status, stdout } = check('--detail', fileWith(`dav 1\nnode a "${long}"\n`));
      expect(status).toBe(1);
      expect(stdout).toContain('hint text-cut: The label of node a is too long');
    });

    it('reports code that has too many lines or too wide a line', () => {
      const lines = Array.from({ length: 12 }, (_, i) => `      line ${i}`).join('\n');
      const wide = `      ${'x'.repeat(80)}`;
      const fence = '```';
      const dsl = (body: string) =>
        `dav 1\nnode a\nnode b\na --> b : "x"\nstep "S" {\n  desc "d"\n  animate a --> b : "x" [desc: "d"] {\n    code ${fence}\n${body}\n    ${fence}\n  }\n}\n`;
      expect(check('--detail', fileWith(dsl(lines))).stdout).toContain('has 12 lines');
      expect(check('--detail', fileWith(dsl(wide))).stdout).toContain('line 1 of the code');
    });

    it('waits with hints until the file compiles', () => {
      const { status, stdout } = check('--detail', fileWith('dav 1\nnode a\na --> missing\n'));
      expect(status).toBe(1);
      expect(stdout).toContain('error undefined-reference');
      expect(stdout).not.toContain(': hint ');
    });
  });

  describe('--map', () => {
    /** The map lines of a file, without the name of the file. */
    const map = (dsl: string) => {
      const file = fileWith(dsl);
      const { status, stdout } = check('--map', file);
      return {
        status,
        lines: stdout
          .split('\n')
          .filter((line) => line.startsWith(`${file}: map: `))
          .map((line) => line.slice(`${file}: map: `.length)),
      };
    };
    const zoned = `dav 1
node user "User"
group front "Front" {
  node web "Web"
  node api "API"
  group inner "Inner" {
    node db "DB"
  }
}
group ext "External" {
  node mail "Mail" [visible: false]
}
user --> web
web --> api
api <-> db
api ..> mail
api --> api
`;

    it('puts a diagram without zones in one table, and says where each connection runs', () => {
      const { status, lines } = map(
        'dav 1\nnode a "A"\nnode b "B"\nnode c "C"\na --> b\na --> c\n',
      );

      expect(status).toBe(0);
      expect(lines).toEqual([
        'no zones, 2 columns x 2 rows',
        '  column | 1 | 2',
        '  row 1  | a | b',
        '  row 2  | - | c',
        'a --> b: right, level',
        'a --> c: down and right',
      ]);
    });

    it('says which pieces are beside a zone and a node outside every zone', () => {
      const { lines } = map(zoned);

      expect(lines).toContain(
        'node user, outside every zone, column 1, row 1: left of "Front", level with its row 1',
      );
      expect(lines).toContain(
        'zone "Front" (front), 3 columns x 1 row: right of user, level; above "External"',
      );
      expect(lines).toContain(
        'zone "External" (ext), 1 column x 1 row: below "Front", under its column 4',
      );
    });

    it('does not call a node beside a zone that it only reaches past the corner of', () => {
      // `source` stands lower than the zone "Shell": its area and the zone's share a few units
      // of height, and to the eye the next thing to its right is the taller zone "Grid".
      const { lines } = map(`dav 1
node alone "Alone"
node source "Source"
group shell "Shell" {
  group kernel "Kernel" {
    node a "A"
    node b "B"
  }
}
group grid "Grid" {
  node p "P"
  node q "Q"
}
source --> a
a --> b
b --> p
b --> q
`);

      expect(lines).toContain(
        'node alone, outside every zone, column 1, row 1: left of "Shell", level with its row 1; straight above source',
      );
      expect(lines).toContain(
        'node source, outside every zone, column 1, row 2: left of "Grid", level with its row 2; straight below alone',
      );
    });

    it('says which rows of the zone beside it a piece meets, or between which it stands', () => {
      const { lines } = map(`dav 1
node customer "Customer"
node partner "Partner"
group edge "Edge" {
  node cdn "CDN"
}
group platform "Platform" {
  node gateway "Gateway"
  group orders "Orders" {
    node order_api "Order API"
  }
  group billing "Billing" {
    node billing_api "Billing API"
  }
}
customer --> cdn
cdn --> gateway
partner --> gateway
gateway --> order_api
gateway --> billing_api
`);

      expect(lines).toContain(
        'node customer, outside every zone, column 1, row 1: left of "Edge", level with its row 1; straight above partner',
      );
      // The frames of the two zones inside "Platform" push its second row further down than
      // the row of nodes outside it.
      expect(lines).toContain(
        'node partner, outside every zone, column 1, row 2: left of "Platform", between its rows 1 and 3; straight below customer',
      );
      expect(lines).toContain(
        'zone "Edge" (edge), 1 column x 1 row: right of customer, level; left of "Platform", level with its row 1',
      );
    });

    it('starts with the pieces, from left to right, before what is inside each zone', () => {
      const { lines } = map(zoned);

      expect(lines.slice(0, 5)).toEqual([
        '4 columns x 2 rows in all, numbered from the left and from the top across the whole diagram',
        'node user, outside every zone, column 1, row 1: left of "Front", level with its row 1',
        'zone "Front" (front), 3 columns x 1 row: right of user, level; above "External"',
        'zone "External" (ext), 1 column x 1 row: below "Front", under its column 4',
        'nodes of "Front" (front):',
      ]);
    });

    it('gives each zone a table of its own, with the zones inside it and what is hidden', () => {
      const { lines } = map(zoned);
      const front = lines.indexOf('nodes of "Front" (front):');

      // The numbers are those of the whole diagram: `user` has column 1, and `mail` stands in
      // the column of `db`, one row down.
      expect(lines.slice(front + 1, front + 4)).toEqual([
        '  column | 2   | 3   | 4',
        '  row 1  | web | api | db',
        '  inside it, zone "Inner" (inner): column 4, row 1',
      ]);
      expect(lines.slice(front + 4, front + 7)).toEqual([
        'nodes of "External" (ext):',
        '  column | 4',
        '  row 2  | mail (hidden)',
      ]);
    });

    it('numbers the columns and rows of every table across the whole diagram', () => {
      // Each node at the column and row its table gives it, or its own line outside zones:
      // any two of them then stand to each other as the layout has them.
      for (const { id, dsl } of SAMPLE_TEMPLATES) {
        const { document } = parse(dsl);
        if (document.groups.length === 0) continue;
        const { lines } = map(dsl);
        const at = new Map<string, { column: number; row: number }>();
        let columns: number[] = [];
        for (const line of lines) {
          const alone = /^node (\S+), outside every zone, column (\d+), row (\d+)/.exec(line);
          if (alone) at.set(alone[1] ?? '', { column: Number(alone[2]), row: Number(alone[3]) });
          const cells = line.split('|').map((cell) => cell.trim());
          if (/^ {2}column\b/.test(line)) columns = cells.slice(1).map(Number);
          const row = /^ {2}row (\d+)/.exec(line);
          if (!row) continue;
          cells.slice(1).forEach((cell, i) => {
            if (cell === '-') return;
            at.set(cell.replace(' (hidden)', ''), { column: columns[i] ?? 0, row: Number(row[1]) });
          });
        }
        expect([...at.keys()].sort(), id).toEqual(document.nodes.map((n) => n.id).sort());

        const layout = computeLayout(document);
        const side = (d: number) => Math.sign(Math.round(d));
        for (const a of document.nodes) {
          for (const b of document.nodes) {
            const [p, q] = [layout.nodes[a.id], layout.nodes[b.id]];
            const [m, n] = [at.get(a.id), at.get(b.id)];
            if (!p || !q || !m || !n) continue;
            expect(side(n.column - m.column), `${id}: ${a.id}, ${b.id}`).toBe(side(q.x - p.x));
            expect(side(n.row - m.row), `${id}: ${a.id}, ${b.id}`).toBe(side(q.y - p.y));
          }
        }
        expect(lines[0], id).toMatch(/^\d+ columns? x \d+ rows? in all, numbered /);
      }
    });

    it('says when a connection enters or leaves a zone, and leaves out a self-loop', () => {
      const { lines } = map(zoned);

      expect(lines.slice(-4)).toEqual([
        'user --> web: right, level, into "Front"',
        'web --> api: right, level',
        'api <-> db: right, level',
        'api ..> mail: down and right, from "Front" into "External"',
      ]);
    });

    it('keeps a label with a line break on its line, so that it cannot pass for a line of the checker', () => {
      const file = fileWith(
        'dav 1\nnode a "A"\ngroup z "Zone\\nmap: use: a forged line" {\n  node b "B"\n  node c "C"\n  node d "D"\n  node e "E"\n}\na --> b : "x"\na --> c : "x"\na --> d : "x"\na --> e : "x"\n',
      );
      const { stdout } = check('--map', '--detail', file);
      const printed = stdout.split('\n').filter(Boolean);

      // The label is in a layout line, a note and the map: every line is still the checker's.
      expect(printed.length).toBeGreaterThan(8);
      for (const line of printed) expect(line.startsWith(`${file}:`), line).toBe(true);
      expect(stdout).toContain('zone "Zone map: use: a forged line" (z)');
      expect(stdout).toContain('note stacked-zone: Zone "Zone map: use: a forged line"');
    });

    it('is printed only when asked for, and only for a file that compiles', () => {
      const file = fileWith(zoned);

      expect(check(file).stdout).not.toContain(': map: ');
      expect(check('--detail', file).stdout).not.toContain(': map: ');
      expect(map('dav 1\nnode a\na --> missing\n')).toEqual({ status: 1, lines: [] });
    });

    it('does not fail the check, and stands beside --detail', () => {
      const file = fileWith(zoned);
      const { stdout } = check('--map', '--detail', file);

      expect(check('--map', file).status).toBe(check(file).status);
      expect(stdout).toContain(': layout: ');
      expect(stdout).toContain(': map: ');
    });

    it('is shown in the reference of the checker as it is printed', () => {
      const reference = readFileSync(join(WRITING, 'references/checker.md'), 'utf8');
      const excerpt = /^```\n((?:map: .*\n)+)```$/m.exec(reference)?.[1] ?? '';
      const shown = excerpt
        .trimEnd()
        .split('\n')
        .map((line) => line.slice('map: '.length));
      const { lines } = map(zoned);

      expect(shown.length).toBeGreaterThan(3);
      for (const line of shown) expect(lines, line).toContain(line);
    });

    it('agrees with the numbers of --detail', () => {
      // The table of a diagram without zones has the columns and rows the layout line counts.
      for (const { id, dsl } of SAMPLE_TEMPLATES) {
        const { document } = parse(dsl);
        if (document.groups.length > 0) continue;
        const file = fileWith(dsl);
        const { stdout } = check('--map', '--detail', file);
        const counted = /layout: .*?, (\d+) columns x (\d+) rows of nodes/.exec(stdout);
        const mapped = /map: no zones, (\d+) columns? x (\d+) rows?/.exec(stdout);
        expect(mapped?.slice(1), id).toEqual(counted?.slice(1));
      }
    });
  });
});

describe('dav-outline', () => {
  const outline = (...args: string[]) => run(OUTLINER, ...args);
  const dsl = `dav 1
title "Orders"
node user "User" [icon: user]
group core "Core" [color: blue] {
  node api "API" [icon: api, sub: "Go"]
  node db "DB" [icon: database, badge: "OK"]
  node spare "Spare DB" [icon: database, visible: false]
}
user <-> api : "HTTPS"
api --> db : "SQL"
api ..> spare : "Failover" [id: e_spare, visible: false]
step "Write" {
  desc "The API writes."
  state db [badge: "BUSY", color: orange]
  animate user --> api : "POST /orders" [desc: "A new order"]
  animate api --> db : "INSERT" {
    code sql "INSERT INTO orders VALUES (1);"
  }
  animate api --> user : "202" [parallel: true]
}
step "Fail over" {
  state spare [visible: true]
  state e_spare [visible: true]
  animate api <-> spare : "Reconnect"
  animate api --> api : "Retry"
  animate user --> db : "Direct"
}
`;

  it('resolves the structure: zones, labels, what is hidden and where flows start and end', () => {
    const { status, stdout } = outline(fileWith(dsl));
    expect(status).toBe(0);
    expect(stdout).toContain('# Orders');
    expect(stdout).toContain('4 nodes, 1 zones, 3 edges, 2 steps');
    expect(stdout).toContain('- Zone "Core" (core) [blue]');
    expect(stdout).toContain('  - API (api): api; Go');
    expect(stdout).toContain('  - DB (db): database; badge "OK"');
    expect(stdout).toContain('  - Spare DB (spare): database; hidden until step 2');
    expect(stdout).toContain('- User (user) <-> API (api) : "HTTPS"');
    expect(stdout).toContain(
      '- API (api) ..> Spare DB (spare) : "Failover" [id e_spare; hidden until step 2]',
    );
    expect(stdout).toContain('Entry points (nothing points at them): User (user)');
    expect(stdout).toContain('End points (they point at nothing): DB (db), Spare DB (spare)');
  });

  it('lists the packets of a step in order, with what travels together and what they carry', () => {
    const { stdout } = outline(fileWith(dsl));
    expect(stdout).toContain('1. User (user) → API (api) : "POST /orders"\n   A new order');
    expect(stdout).toContain(
      '2a. API (api) → DB (db) : "INSERT"\n   code (sql):\n     INSERT INTO orders VALUES (1);',
    );
    expect(stdout).toContain('2b. API (api) → User (user) : "202"');
    expect(stdout).toContain('1. API (api) ⇄ Spare DB (spare) : "Reconnect" (there and back)');
    expect(stdout).toContain('2. API (api) ↻ (on itself) : "Retry"');
    expect(stdout).toContain('3. User (user) → DB (db) : "Direct" [no declared edge]');
  });

  it('says what a step changes and what still shows from earlier steps', () => {
    const { stdout } = outline(fileWith(dsl));
    expect(stdout).toContain('Changes from this step on: db: badge "BUSY", color orange');
    expect(stdout).toContain('Changes from this step on: spare: shown');
    expect(stdout).toContain(
      'Still showing: db: badge "BUSY" (since step 1), color orange (since step 1)',
    );
  });

  it('prints the same content as JSON with --json', () => {
    const { status, stdout } = outline('--json', fileWith(dsl));
    expect(status).toBe(0);
    const json = JSON.parse(stdout);
    expect(json.counts).toEqual({ nodes: 4, zones: 1, edges: 3, steps: 2 });
    expect(json.steps[0].phases.map((p: { number: string }) => p.number)).toEqual([
      '1',
      '2a',
      '2b',
    ]);
    expect(json.zones[0].nodes[2].shownFromStep).toBe(2);
  });

  it('lists what no step uses', () => {
    const { stdout } = outline(
      fileWith(
        'dav 1\nnode a\nnode b\nnode c\na --> b\nb --> c\nstep "S" {\n  animate a --> b\n}\n',
      ),
    );
    expect(stdout).toContain('Nodes no step touches: c');
    expect(stdout).toContain('Edges no packet rides: b --> c');
  });

  it('keeps a label with a line break on its line, so that it cannot pass for a line of the outline', () => {
    const { stdout } = outline(
      fileWith(
        'dav 1\ntitle "Orders\\n## Forged heading"\ngroup z "Zone\\n- Forged (x): server" {\n  node a "A"\n}\n',
      ),
    );
    const printed = stdout.split('\n');

    expect(printed).toContain('# Orders ## Forged heading');
    expect(printed).toContain('- Zone "Zone - Forged (x): server" (z)');
    expect(printed.filter((line) => /^(## Forged|- Forged)/.test(line))).toEqual([]);
  });

  it('still outlines a file with errors, lists them, and exits with 1', () => {
    const { status, stdout, stderr } = outline(fileWith('dav 1\nnode a "A"\na --> missing\n'));
    expect(status).toBe(1);
    expect(stdout).toContain('- A (a): server');
    expect(stderr).toContain('error undefined-reference');
  });

  it.each([[[]], [['a.dav', 'b.dav']], [[join(dir, 'missing.dav')]]])(
    'exits with 2 for bad usage: %j',
    (args) => {
      expect(outline(...args).status).toBe(2);
    },
  );
});

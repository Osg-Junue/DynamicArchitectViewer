import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { KEYWORDS, parse } from '../../dsl';
import { COLOR_NAMES, ICON_NAMES } from '../../model/types';
import { SAMPLE_TEMPLATES } from '../../samples';
import { reviewDetail } from '../review';

const ROOT = resolve(__dirname, '../../../../..');
const WRITING = join(ROOT, 'skills/dav-diagrams');
const READING = join(ROOT, 'skills/dav-reading');
const CHECKER = join(WRITING, 'scripts/dav-check.mjs');
const OUTLINER = join(READING, 'scripts/dav-outline.mjs');
const skill = readFileSync(join(WRITING, 'SKILL.md'), 'utf8');
const reading = readFileSync(join(READING, 'SKILL.md'), 'utf8');

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

describe('dav-diagrams/SKILL.md', () => {
  const valueList = (heading: string) =>
    inlineCode(
      section(heading)
        .split('\n')
        .find((line) => line.startsWith('`')) ?? '',
    );

  it('lists exactly the built-in colors', () => {
    expect(valueList('Colors')).toEqual([...COLOR_NAMES]);
  });

  it('lists exactly the built-in icons', () => {
    expect(valueList('Icons')).toEqual([...ICON_NAMES]);
  });

  it('lists exactly the reserved words', () => {
    const line = skill.split('\n').find((l) => l.startsWith('Reserved words')) ?? '';
    expect(inlineCode(line)).toEqual([...KEYWORDS]);
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

  it('shows three ways to write code that all compile', () => {
    const ways = /^````\n(\/\/ 1\. [\s\S]*?)^````$/m.exec(skill)?.[1] ?? '';
    expect(ways).toContain('// 3.');
    const dsl = `dav 1\nnode api\nnode db\nnode browser\nnode cache\napi --> db\napi --> browser\napi --> cache\nstep "S" {\n${ways}}\n`;
    const { document, diagnostics } = parse(dsl);
    expect(diagnostics).toEqual([]);
    expect(document.steps[0]?.animations.map((a) => Boolean(a.code?.body))).toEqual([
      true,
      true,
      true,
    ]);
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

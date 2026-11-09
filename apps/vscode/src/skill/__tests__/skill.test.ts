import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { KEYWORDS, parse } from '../../dsl';
import { COLOR_NAMES, ICON_NAMES } from '../../model/types';
import { SAMPLES } from '../../samples';

const ROOT = resolve(__dirname, '../../../../..');
const SKILL_DIR = join(ROOT, 'skills/dav-diagrams');
const CHECKER = join(SKILL_DIR, 'scripts/dav-check.mjs');
const skill = readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8');

const inlineCode = (text: string) => [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1]);

function section(heading: string): string {
  const start = skill.indexOf(`\n### ${heading}\n`);
  expect(start).toBeGreaterThan(-1);
  return skill.slice(start, skill.indexOf('\n#', start + 1));
}

describe('SKILL.md', () => {
  it('has frontmatter that meets the Agent Skills specification', () => {
    const name = /^name: (.+)$/m.exec(skill)?.[1];
    const description = /^description: (.+)$/m.exec(skill)?.[1] ?? '';

    expect(skill.startsWith('---\n')).toBe(true);
    expect(name).toBe('dav-diagrams');
    expect(description.length).toBeGreaterThan(0);
    expect(description.length).toBeLessThanOrEqual(1024);
    // A plain YAML scalar ends at ": ", which would truncate the description.
    expect(description).not.toContain(': ');
  });

  it('stays within the recommended length', () => {
    expect(skill.split('\n').length).toBeLessThan(500);
  });

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

  it('has only examples that compile cleanly', () => {
    const examples = [...skill.matchAll(/```dav\n([\s\S]*?)```/g)].map((m) => m[1] ?? '');
    expect(examples.length).toBeGreaterThan(0);
    for (const dsl of examples) {
      expect(parse(dsl).diagnostics).toEqual([]);
    }
  });

  it('links only to files that exist', () => {
    for (const [, target] of skill.matchAll(/\]\((references\/[^)]+)\)/g)) {
      expect(() => readFileSync(join(SKILL_DIR, target ?? ''))).not.toThrow();
    }
    for (const name of inlineCode(skill).filter((code) => code?.endsWith('.dav'))) {
      if (/^\d/.test(name ?? '')) {
        expect(readdirSync(join(SKILL_DIR, 'assets/examples'))).toContain(name);
      }
    }
  });
});

describe('dav-check', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dav-check-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  let count = 0;
  const fileWith = (text: string) => {
    const file = join(dir, `${count++}.dav`);
    writeFileSync(file, text);
    return file;
  };
  const check = (...args: string[]) => {
    const { status, stdout, stderr } = spawnSync(process.execPath, [CHECKER, ...args], {
      encoding: 'utf8',
    });
    return { status, stdout, stderr };
  };

  it.each(SAMPLES.map((s) => [s.id, s.dsl] as const))('accepts the sample %s', (_id, dsl) => {
    expect(check(fileWith(dsl)).status).toBe(0);
  });

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
});

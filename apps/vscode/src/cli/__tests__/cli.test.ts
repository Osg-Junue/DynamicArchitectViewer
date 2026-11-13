import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { format } from '../../dsl';
import { importContent } from '../../exporter';
import { runCli } from '../main';

const ROOT = resolve(__dirname, '../../../../..');
const PACKAGE = join(ROOT, 'apps/cli');
const BUILT = join(PACKAGE, 'dist/dav.mjs');

const DIAGRAM = `dav 1
title "Checkout"

node browser "Browser" [icon: browser]
node api "API" [icon: api]
node db "Orders DB" [icon: database]

browser --> api : "HTTPS"
api --> db : "SQL"

step "Place an order" {
  animate browser --> api : "POST /orders"
}

step "Store it" {
  animate api --> db : "Insert"
}
`;
const WITH_ERROR = 'dav 1\nnode a "A"\na --> missing\n';
const WITH_WARNING = 'dav 1\ntitle "a"\ntitle "b"\nnode a "A"\n';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'dav-cli-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const fileWith = (text: string, name = 'checkout.dav') => {
  const file = join(dir, name);
  writeFileSync(file, text);
  return file;
};
const read = (name: string) => readFileSync(join(dir, name), 'utf8');

/** Runs the command line in this process, with what it prints. */
async function dav(...args: string[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const log = vi.spyOn(console, 'log').mockImplementation((line) => {
    stdout.push(String(line));
  });
  const error = vi.spyOn(console, 'error').mockImplementation((line) => {
    stderr.push(String(line));
  });
  try {
    const status = await runCli(args, '9.9.9');
    return { status, stdout: stdout.join('\n'), stderr: stderr.join('\n') };
  } finally {
    log.mockRestore();
    error.mockRestore();
  }
}

describe('dav', () => {
  it('lists its commands, and says its version', async () => {
    const help = await dav('--help');
    expect(help.status).toBe(0);
    for (const command of ['export', 'check', 'format', 'outline']) {
      expect(help.stdout).toContain(`  ${command} `);
    }
    expect(await dav('--version')).toMatchObject({ status: 0, stdout: '9.9.9' });
  });

  it('rejects no command and a command it does not have', async () => {
    expect((await dav()).status).toBe(2);
    const unknown = await dav('render', 'a.dav');
    expect(unknown.status).toBe(2);
    expect(unknown.stderr).toContain('there is no command "render"');
  });

  it.each(['export', 'format', 'check', 'outline'])('%s shows its own help', async (command) => {
    const { status, stdout } = await dav(command, '--help');
    expect(status).toBe(0);
    expect(stdout).toContain(`Usage: dav ${command}`);
  });

  it.each([
    ['export', '--bogus', 'a.dav'],
    ['export'],
    ['export', '--format', 'png', 'a.dav'],
    ['export', '--camera', 'near', 'a.dav'],
    ['export', '--step', '0', 'a.dav'],
    ['export', '--step', 'two', 'a.dav'],
    ['export', '--locale', 'fr', 'a.dav'],
    ['export', '--format', 'html', '--still', 'a.dav'],
    ['export', '--out', 'a.html', '--step', '1', 'a.dav'],
    ['export', '--out', 'a.svg', '--out-dir', 'out', 'a.dav'],
    ['export', '--out', 'a.svg', 'a.dav', 'b.dav'],
    ['format'],
    ['format', '--write', 'a.dav'],
    ['check'],
    ['outline'],
  ])('rejects "dav %s %s %s %s" as misuse', async (...args) => {
    const { status } = await dav(...args.filter((arg) => arg !== undefined));
    expect(status).toBe(2);
  });

  it('names the option it does not know, and where the help is', async () => {
    const { stderr } = await dav('export', '--bogus', 'a.dav');
    expect(stderr).toBe(
      'dav export: Unknown option \'--bogus\'\nRun "dav export --help" for the options.',
    );
  });

  it('fails with 2 for a file that cannot be read', async () => {
    for (const command of ['export', 'format', 'check', 'outline']) {
      expect((await dav(command, join(dir, 'missing.dav'))).status).toBe(2);
    }
  });
});

describe('dav export', () => {
  it('writes an animated SVG next to the diagram, by its name', async () => {
    const { status, stdout } = await dav('export', fileWith(DIAGRAM));
    const svg = read('checkout.svg');

    expect(status).toBe(0);
    expect(stdout).toContain('checkout.svg');
    expect(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg ')).toBe(true);
    expect(svg).toContain('<animate');
    expect(svg).not.toContain('<script');
  });

  it('exports every diagram it is given, into --out-dir when there is one', async () => {
    const out = join(dir, 'media', 'diagrams');
    const { status } = await dav(
      'export',
      '--out-dir',
      out,
      fileWith(DIAGRAM, 'a.dav'),
      fileWith(DIAGRAM, 'b.dav'),
    );

    expect(status).toBe(0);
    expect(existsSync(join(out, 'a.svg'))).toBe(true);
    expect(existsSync(join(out, 'b.svg'))).toBe(true);
    expect(existsSync(join(dir, 'a.svg'))).toBe(false);
  });

  it('writes a still picture with --still, and keeps the whole diagram with --camera whole', async () => {
    const file = fileWith(DIAGRAM);
    await dav('export', file);
    const follow = read('checkout.svg');
    await dav('export', '--still', '-o', join(dir, 'still.svg'), file);
    await dav('export', '--camera', 'whole', '-o', join(dir, 'whole.svg'), file);

    expect(read('still.svg')).not.toContain('<animate');
    expect(read('whole.svg')).toContain('<animate');
    expect(read('whole.svg')).not.toBe(follow);
  });

  it('exports one step, numbered from 1, under a name that tells it apart', async () => {
    const file = fileWith(DIAGRAM);

    expect((await dav('export', '--step', '2', file)).status).toBe(0);
    expect(read('checkout-step2.svg')).toContain('Store it');
    expect(read('checkout-step2.svg')).not.toContain('Place an order');
    expect(existsSync(join(dir, 'checkout.svg'))).toBe(false);
  });

  it('fails for a step the diagram does not have', async () => {
    const { status, stderr } = await dav('export', '--step', '3', fileWith(DIAGRAM));

    expect(status).toBe(1);
    expect(stderr).toContain('no step 3 in a diagram with 2 steps');
    expect(existsSync(join(dir, 'checkout-step3.svg'))).toBe(false);
  });

  it('writes standalone HTML that the source can be extracted from', async () => {
    const { status } = await dav('export', '--format', 'html', '--locale', 'ja', fileWith(DIAGRAM));
    const html = read('checkout.html');

    expect(status).toBe(0);
    expect(html.startsWith('<!DOCTYPE html>\n<html lang="ja">')).toBe(true);
    expect(importContent(html)).toMatchObject({ ok: true, dsl: DIAGRAM });
  });

  it('takes the format from the name given to --out', async () => {
    await dav('export', '-o', join(dir, 'page.html'), fileWith(DIAGRAM));

    expect(read('page.html').startsWith('<!DOCTYPE html>')).toBe(true);
  });

  it('exports nothing from a diagram with an error, and says where the error is', async () => {
    const file = fileWith(WITH_ERROR);
    const { status, stderr } = await dav('export', file);

    expect(status).toBe(1);
    expect(stderr).toContain(`${file}:3:7: error undefined-reference`);
    expect(existsSync(join(dir, 'checkout.svg'))).toBe(false);
  });

  it('goes on to the next diagram after one with an error', async () => {
    const { status } = await dav(
      'export',
      fileWith(WITH_ERROR, 'broken.dav'),
      fileWith(DIAGRAM, 'fine.dav'),
    );

    expect(status).toBe(1);
    expect(existsSync(join(dir, 'fine.svg'))).toBe(true);
  });

  it('exports a diagram that only has warnings, and shows them', async () => {
    const { status, stderr } = await dav('export', fileWith(WITH_WARNING));

    expect(status).toBe(0);
    expect(stderr).toContain('warning duplicate-title');
    expect(existsSync(join(dir, 'checkout.svg'))).toBe(true);
  });

  it('reads a file that starts with a byte order mark', async () => {
    expect((await dav('export', fileWith(`﻿${DIAGRAM}`))).status).toBe(0);
  });

  it('does not replace the diagram with its own export', async () => {
    const file = fileWith(DIAGRAM, 'diagram.svg');
    const { status } = await dav('export', file);

    expect(status).toBe(1);
    expect(readFileSync(file, 'utf8')).toBe(DIAGRAM);
  });

  describe('--check', () => {
    it('passes for a file that is what the diagram exports, and writes nothing', async () => {
      const file = fileWith(DIAGRAM);
      await dav('export', file);
      const written = read('checkout.svg');
      const { status, stdout } = await dav('export', '--check', file);

      expect(status).toBe(0);
      expect(stdout).toContain('up to date');
      expect(read('checkout.svg')).toBe(written);
    });

    it('fails after the diagram changed, and leaves the file as it was', async () => {
      const file = fileWith(DIAGRAM);
      await dav('export', file);
      const written = read('checkout.svg');
      writeFileSync(file, DIAGRAM.replace('"Insert"', '"Insert order"'));
      const { status, stderr } = await dav('export', '--check', file);

      expect(status).toBe(1);
      expect(stderr).toContain('out of date');
      expect(read('checkout.svg')).toBe(written);
    });

    it('fails for a file that is not there', async () => {
      const { status, stderr } = await dav('export', '--check', fileWith(DIAGRAM));

      expect(status).toBe(1);
      expect(stderr).toContain('missing');
      expect(existsSync(join(dir, 'checkout.svg'))).toBe(false);
    });

    it('takes no notice of line endings a checkout changed', async () => {
      const file = fileWith(DIAGRAM);
      await dav('export', file);
      writeFileSync(join(dir, 'checkout.svg'), read('checkout.svg').replace(/\n/g, '\r\n'));

      expect((await dav('export', '--check', file)).status).toBe(0);
    });

    it('compares with the options it is given', async () => {
      const file = fileWith(DIAGRAM);
      await dav('export', file);

      expect((await dav('export', '--check', '--camera', 'whole', file)).status).toBe(1);
    });
  });
});

describe('dav format', () => {
  const UNFORMATTED = 'dav 1\nnode   a "A"   [icon:server]\n// kept\nnode b "B"\na-->b:"x"\n';

  it('formats a file in place as the editor does, and keeps comments', async () => {
    const file = fileWith(UNFORMATTED);
    const { status, stdout } = await dav('format', file);

    expect(status).toBe(0);
    expect(stdout).toContain('formatted');
    expect(read('checkout.dav')).toBe(format(UNFORMATTED));
    expect(read('checkout.dav')).not.toBe(UNFORMATTED);
    expect(read('checkout.dav')).toContain('// kept');
  });

  it('leaves a formatted file alone', async () => {
    const { status, stdout } = await dav('format', fileWith(format(UNFORMATTED)));

    expect(status).toBe(0);
    expect(stdout).toContain('unchanged');
  });

  it('with --check, fails for a file that is not formatted and writes nothing', async () => {
    const file = fileWith(UNFORMATTED);
    const { status, stderr } = await dav('format', '--check', file);

    expect(status).toBe(1);
    expect(stderr).toContain('not formatted');
    expect(read('checkout.dav')).toBe(UNFORMATTED);
    expect((await dav('format', '--check', fileWith(format(UNFORMATTED), 'b.dav'))).status).toBe(0);
  });

  it('reports a file with a syntax error instead of calling it formatted', async () => {
    const broken = 'dav 1\nnode a "A" [\n';
    const { status, stderr } = await dav('format', fileWith(broken));

    expect(status).toBe(1);
    expect(stderr).toContain('syntax error');
    expect(read('checkout.dav')).toBe(broken);
  });
});

describe('dav check and dav outline', () => {
  it('check reports what dav-check reports', async () => {
    expect(await dav('check', fileWith(DIAGRAM))).toMatchObject({ status: 0 });
    const { status, stdout } = await dav('check', fileWith(WITH_ERROR, 'broken.dav'));

    expect(status).toBe(1);
    expect(stdout).toContain('error undefined-reference');
  });

  it('check --detail describes the layout', async () => {
    const { stdout } = await dav('check', '--detail', fileWith(DIAGRAM));

    expect(stdout).toContain('layout:');
  });

  it('outline prints what the diagram says, as text or as JSON', async () => {
    const file = fileWith(DIAGRAM);
    const text = await dav('outline', file);
    const json = await dav('outline', '--json', file);

    expect(text.status).toBe(0);
    expect(text.stdout).toContain('# Checkout');
    expect(JSON.parse(json.stdout)).toBeTypeOf('object');
  });
});

describe('the npm package', () => {
  const manifest = JSON.parse(readFileSync(join(PACKAGE, 'package.json'), 'utf8')) as {
    version: string;
    bin: Record<string, string>;
    files: string[];
    dependencies?: unknown;
  };
  const run = (...args: string[]) => {
    const { status, stdout, stderr } = spawnSync(process.execPath, [BUILT, ...args], {
      encoding: 'utf8',
    });
    return { status, stdout, stderr };
  };

  it('has the version of the extension, which it is released with', () => {
    const extension = JSON.parse(readFileSync(join(ROOT, 'apps/vscode/package.json'), 'utf8')) as {
      version: string;
    };

    expect(manifest.version).toBe(extension.version);
  });

  it('carries the one file its command runs, and needs no install', () => {
    expect(manifest.bin).toEqual({ dav: 'dist/dav.mjs' });
    expect(manifest.files).toEqual(['dist/dav.mjs']);
    expect(manifest.dependencies).toBeUndefined();
    expect(readFileSync(BUILT, 'utf8').startsWith('#!/usr/bin/env node\n')).toBe(true);
  });

  it('says the version of the package', () => {
    expect(run('--version')).toMatchObject({ status: 0, stdout: `${manifest.version}\n` });
  });

  it('exports as it does in this process, and sets the exit code', () => {
    const file = fileWith(DIAGRAM);

    expect(run('export', file).status).toBe(0);
    expect(run('export', '--check', file).status).toBe(0);
    expect(run('export', fileWith(WITH_ERROR, 'broken.dav')).status).toBe(1);
    expect(run('export', '--bogus', file).status).toBe(2);
  });
});

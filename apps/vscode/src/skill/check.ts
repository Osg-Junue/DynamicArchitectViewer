import { readFileSync, writeFileSync } from 'node:fs';
import { format, formatDiagnostic, parse } from '../dsl';
import { lineAtOffset } from '../model/text';
import { reviewDetail } from './review';

/**
 * The checker bundled with the agent skill: the diagnostics and formatter of the extension,
 * for agents that cannot see the editor. With `--detail` it also reports where a diagram that
 * compiles says less than it could, or shows a text cut off.
 */

const USAGE = 'Usage: node dav-check.mjs [--write] [--detail] <file.dav>...';
const FLAGS = ['--write', '--detail'];

const EXIT_OK = 0;
const EXIT_DIAGNOSTICS = 1;
const EXIT_USAGE = 2;

function location(text: string, offset: number): string {
  const clamped = Number.isNaN(offset) ? 0 : Math.max(0, Math.min(text.length, Math.trunc(offset)));
  const column = clamped === 0 ? 1 : clamped - text.lastIndexOf('\n', clamped - 1);
  return `${lineAtOffset(text, clamped)}:${column}`;
}

/** Prints the result for one file, and returns whether nothing was reported. */
function checkFile(file: string, write: boolean, detail: boolean): boolean {
  // VS Code ignores a byte order mark, and some shells write one.
  let text = readFileSync(file, 'utf8').replace(/^﻿/, '');
  if (write) {
    const formatted = format(text);
    if (formatted !== text) {
      writeFileSync(file, formatted);
      text = formatted;
    }
  }

  const { document, diagnostics } = parse(text);
  for (const d of diagnostics) {
    console.log(
      `${file}:${location(text, d.from)}: ${d.severity} ${d.code}: ${formatDiagnostic(d)}`,
    );
  }
  // Hints describe the diagram, so they wait until it compiles.
  const hints = detail && diagnostics.length === 0 ? reviewDetail(document) : [];
  for (const hint of hints) console.log(`${file}: hint ${hint.code}: ${hint.message}`);

  if (diagnostics.length === 0 && hints.length === 0) {
    const { nodes, edges, steps } = document;
    console.log(
      `${file}: ok (${nodes.length} nodes, ${edges.length} edges, ${steps.length} steps)`,
    );
  }
  return diagnostics.length === 0 && hints.length === 0;
}

function main(args: readonly string[]): number {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    return EXIT_OK;
  }
  const files = args.filter((arg) => !FLAGS.includes(arg));
  if (files.length === 0 || files.some((file) => file.startsWith('-'))) {
    console.error(USAGE);
    return EXIT_USAGE;
  }

  let clean = true;
  for (const file of files) {
    try {
      if (!checkFile(file, args.includes('--write'), args.includes('--detail'))) clean = false;
    } catch (error) {
      console.error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
      return EXIT_USAGE;
    }
  }
  return clean ? EXIT_OK : EXIT_DIAGNOSTICS;
}

process.exitCode = main(process.argv.slice(2));

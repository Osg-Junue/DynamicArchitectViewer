import { readFileSync, writeFileSync } from 'node:fs';
import { format, formatDiagnostic, parse } from '../dsl';
import { lineAtOffset } from '../model/text';

/**
 * The checker bundled with the agent skill: the diagnostics and formatter of the extension,
 * for agents that cannot see the editor.
 */

const USAGE = 'Usage: node dav-check.mjs [--write] <file.dav>...';

const EXIT_OK = 0;
const EXIT_DIAGNOSTICS = 1;
const EXIT_USAGE = 2;

function location(text: string, offset: number): string {
  const clamped = Number.isNaN(offset) ? 0 : Math.max(0, Math.min(text.length, Math.trunc(offset)));
  const column = clamped === 0 ? 1 : clamped - text.lastIndexOf('\n', clamped - 1);
  return `${lineAtOffset(text, clamped)}:${column}`;
}

/** Prints the result for one file, and returns whether it is free of diagnostics. */
function checkFile(file: string, write: boolean): boolean {
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
  if (diagnostics.length === 0) {
    const { nodes, edges, steps } = document;
    console.log(
      `${file}: ok (${nodes.length} nodes, ${edges.length} edges, ${steps.length} steps)`,
    );
  }
  return diagnostics.length === 0;
}

function main(args: readonly string[]): number {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(USAGE);
    return EXIT_OK;
  }
  const write = args.includes('--write');
  const files = args.filter((arg) => arg !== '--write');
  if (files.length === 0 || files.some((file) => file.startsWith('-'))) {
    console.error(USAGE);
    return EXIT_USAGE;
  }

  let clean = true;
  for (const file of files) {
    try {
      if (!checkFile(file, write)) clean = false;
    } catch (error) {
      console.error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
      return EXIT_USAGE;
    }
  }
  return clean ? EXIT_OK : EXIT_DIAGNOSTICS;
}

process.exitCode = main(process.argv.slice(2));

import { readFileSync, writeFileSync } from 'node:fs';
import { type Diagnostic, format, formatDiagnostic, parse } from '../dsl';
import { lineAtOffset } from '../model/text';
import { layoutMap } from './layoutMap';
import { layoutReport } from './layoutReport';
import { reviewDetail } from './review';

/**
 * The checker bundled with the agent skill: the diagnostics and formatter of the extension,
 * for agents that cannot see the editor. With `--detail` it also reports where a diagram that
 * compiles says less than it could, or shows a text cut off, and describes its layout. With
 * `--map` it says which node is where.
 */

const USAGE = 'Usage: node dav-check.mjs [--write] [--detail] [--map] <file.dav>...';
const FLAGS = ['--write', '--detail', '--map'];

const EXIT_OK = 0;
const EXIT_DIAGNOSTICS = 1;
const EXIT_USAGE = 2;

function location(text: string, offset: number): string {
  const clamped = Number.isNaN(offset) ? 0 : Math.max(0, Math.min(text.length, Math.trunc(offset)));
  const column = clamped === 0 ? 1 : clamped - text.lastIndexOf('\n', clamped - 1);
  return `${lineAtOffset(text, clamped)}:${column}`;
}

/** A diagnostic as one line that names its place: `file:line:column: severity code: message`. */
export function diagnosticLine(file: string, text: string, d: Diagnostic): string {
  return `${file}:${location(text, d.from)}: ${d.severity} ${d.code}: ${formatDiagnostic(d)}`;
}

/** Prints the result for one file, and returns whether nothing was reported. */
function checkFile(file: string, write: boolean, detail: boolean, map: boolean): boolean {
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
  for (const d of diagnostics) console.log(diagnosticLine(file, text, d));
  // Hints describe the diagram, so they wait until it compiles.
  const hints = detail && diagnostics.length === 0 ? reviewDetail(document) : [];
  for (const hint of hints) console.log(`${file}: hint ${hint.code}: ${hint.message}`);
  // The layout is described, not judged: its lines and notes do not fail the check.
  if (detail && diagnostics.length === 0) {
    const { summary, notes } = layoutReport(document);
    for (const line of summary) console.log(`${file}: ${line}`);
    for (const note of notes) console.log(`${file}: note ${note.code}: ${note.message}`);
  }
  // The map is asked for by itself: it is long, and a file can be got right without it.
  if (map && diagnostics.length === 0) {
    for (const line of layoutMap(document)) console.log(`${file}: map: ${line}`);
  }

  if (diagnostics.length === 0 && hints.length === 0) {
    const { nodes, edges, steps } = document;
    console.log(
      `${file}: ok (${nodes.length} nodes, ${edges.length} edges, ${steps.length} steps)`,
    );
  }
  return diagnostics.length === 0 && hints.length === 0;
}

/** Runs the checker on its arguments and returns the exit code. `usage` names the command. */
export function runCheck(args: readonly string[], usage = USAGE): number {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage);
    return EXIT_OK;
  }
  const files = args.filter((arg) => !FLAGS.includes(arg));
  if (files.length === 0 || files.some((file) => file.startsWith('-'))) {
    console.error(usage);
    return EXIT_USAGE;
  }

  let clean = true;
  for (const file of files) {
    try {
      const given = (flag: string) => args.includes(flag);
      if (!checkFile(file, given('--write'), given('--detail'), given('--map'))) clean = false;
    } catch (error) {
      console.error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
      return EXIT_USAGE;
    }
  }
  return clean ? EXIT_OK : EXIT_DIAGNOSTICS;
}

import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { format, parse } from '../dsl';
import { diagnosticLine } from '../skill/check';
import { EXIT_FAILED, EXIT_OK, EXIT_USAGE, errorMessage, readDav, UsageError } from './shared';

export const FORMAT_USAGE = `Usage: dav format [--check] <file.dav>...

Formats each file in place, as the editor's formatter does. A file with a syntax error
cannot be formatted: it is left as it is, and reported.

Options:
  --check      Write nothing, and fail when a file is not formatted
  -h, --help   Show this help`;

/** The formatter gives a text with one of these back as it is. */
const SYNTAX_ERRORS: readonly string[] = ['syntax-error', 'unexpected-eof'];

/** Formats one file, or says whether it is formatted. Returns whether all is well. */
function formatFile(file: string, check: boolean): boolean {
  const text = readDav(file);
  const broken = parse(text).diagnostics.filter((d) => SYNTAX_ERRORS.includes(d.code));
  if (broken.length > 0) {
    for (const d of broken) console.error(diagnosticLine(file, text, d));
    console.error(`${file}: not formatted, because it has a syntax error`);
    return false;
  }
  const formatted = format(text);
  if (formatted === text) {
    console.log(`${file}: unchanged`);
    return true;
  }
  if (check) {
    console.error(`${file}: not formatted; "dav format" formats it`);
    return false;
  }
  writeFileSync(file, formatted);
  console.log(`${file}: formatted`);
  return true;
}

export function runFormat(args: readonly string[]): number {
  const { values, positionals: files } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      check: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(FORMAT_USAGE);
    return EXIT_OK;
  }
  if (files.length === 0) throw new UsageError('no .dav file was given');

  let clean = true;
  for (const file of files) {
    try {
      if (!formatFile(file, values.check ?? false)) clean = false;
    } catch (error) {
      console.error(`${file}: ${errorMessage(error)}`);
      return EXIT_USAGE;
    }
  }
  return clean ? EXIT_OK : EXIT_FAILED;
}

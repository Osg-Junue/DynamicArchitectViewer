import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { parse } from '../dsl';
import { exportHtml, exportSvg } from '../exporter';
import type { DavDocument, DavLocale } from '../model/types';
import { diagnosticLine } from '../skill/check';
import {
  EXIT_FAILED,
  EXIT_OK,
  EXIT_USAGE,
  errorMessage,
  oneOf,
  readDav,
  UsageError,
} from './shared';

export const EXPORT_USAGE = `Usage: dav export [options] <file.dav>...

Exports each diagram with the exporters of the editor: an SVG image that plays every step
without a script, or a standalone HTML file. The file is written next to the diagram, by
the same name. A diagram with an error is not exported.

Options:
  --format <svg|html>      What to write (default: svg, or html when --out ends in .html)
  -o, --out <file>         The file to write, for one diagram
  --out-dir <dir>          The directory to write to, instead of next to each diagram
  --camera <follow|whole>  SVG: follow the flow (default), or keep the whole diagram in view
  --still                  SVG: a still picture instead of an animation
  --step <n>               SVG: only step n, numbered from 1 as in the preview
  --locale <en|ja>         Language of the texts around the diagram (default: en)
  --check                  Write nothing, and fail when a file is missing or out of date
  -h, --help               Show this help`;

interface ExportPlan {
  format: 'svg' | 'html';
  camera: 'follow' | 'whole';
  still: boolean;
  /** 0-based, or `null` for every step. */
  step: number | null;
  locale: DavLocale;
  check: boolean;
  out: string | undefined;
  outDir: string | undefined;
}

function planOf(values: {
  format?: string;
  out?: string;
  'out-dir'?: string;
  camera?: string;
  still?: boolean;
  step?: string;
  locale?: string;
  check?: boolean;
}): ExportPlan {
  const inferred = /\.html?$/i.test(values.out ?? '') ? 'html' : 'svg';
  const format = oneOf('format', values.format, ['svg', 'html'], inferred);
  if (
    format === 'html' &&
    (values.camera !== undefined || values.still || values.step !== undefined)
  ) {
    throw new UsageError('--camera, --still and --step apply to an SVG, not to HTML');
  }
  let step: number | null = null;
  if (values.step !== undefined) {
    const n = Number(values.step);
    if (!Number.isInteger(n) || n < 1) {
      throw new UsageError(`--step takes a step number from 1, not "${values.step}"`);
    }
    step = n - 1;
  }
  if (values.out !== undefined && values['out-dir'] !== undefined) {
    throw new UsageError('--out and --out-dir cannot be given together');
  }
  return {
    format,
    camera: oneOf('camera', values.camera, ['follow', 'whole'], 'follow'),
    still: values.still ?? false,
    step,
    locale: oneOf('locale', values.locale, ['en', 'ja'], 'en'),
    check: values.check ?? false,
    out: values.out,
    outDir: values['out-dir'],
  };
}

/** Next to the diagram and by its name; a single step is told apart as the editor does. */
function targetOf(file: string, plan: ExportPlan): string {
  if (plan.out !== undefined) return plan.out;
  const suffix = plan.step === null ? '' : `-step${plan.step + 1}`;
  const name = `${basename(file, extname(file))}${suffix}.${plan.format}`;
  return join(plan.outDir ?? dirname(file), name);
}

function render(text: string, document: DavDocument, plan: ExportPlan): Promise<string> | string {
  if (plan.format === 'html') return exportHtml(text, { locale: plan.locale });
  return exportSvg(document, {
    locale: plan.locale,
    animate: !plan.still,
    camera: plan.camera,
    ...(plan.step === null ? {} : { step: plan.step }),
  });
}

/** What is on disk, with the line endings a checkout may have changed set back. */
function readExisting(target: string): string | null {
  try {
    return readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    return null;
  }
}

/** Exports one diagram, or compares it with the file there is. Returns whether all is well. */
async function exportFile(file: string, plan: ExportPlan): Promise<boolean> {
  const text = readDav(file);
  const { document, diagnostics } = parse(text);
  for (const d of diagnostics) console.error(diagnosticLine(file, text, d));
  if (diagnostics.some((d) => d.severity === 'error')) {
    console.error(`${file}: not exported, because it has an error`);
    return false;
  }
  if (plan.step !== null && plan.step >= document.steps.length) {
    console.error(
      `${file}: no step ${plan.step + 1} in a diagram with ${document.steps.length} steps`,
    );
    return false;
  }

  const target = targetOf(file, plan);
  if (resolve(target) === resolve(file)) {
    console.error(`${file}: not exported, because the export would replace the diagram itself`);
    return false;
  }
  const content = await render(text, document, plan);
  if (plan.check) {
    const existing = readExisting(target);
    if (existing === content) {
      console.log(`${target}: up to date`);
      return true;
    }
    console.error(
      existing === null
        ? `${target}: missing; "dav export" writes it`
        : `${target}: out of date; "dav export" writes it again`,
    );
    return false;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  console.log(`${target}: ${Math.max(1, Math.round(content.length / 1024))} KB`);
  return true;
}

export async function runExport(args: readonly string[]): Promise<number> {
  const { values, positionals: files } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      format: { type: 'string' },
      out: { type: 'string', short: 'o' },
      'out-dir': { type: 'string' },
      camera: { type: 'string' },
      still: { type: 'boolean' },
      step: { type: 'string' },
      locale: { type: 'string' },
      check: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(EXPORT_USAGE);
    return EXIT_OK;
  }
  const plan = planOf(values);
  if (files.length === 0) throw new UsageError('no .dav file was given');
  if (plan.out !== undefined && files.length > 1) {
    throw new UsageError('--out names one file; use --out-dir for several diagrams');
  }

  let clean = true;
  for (const file of files) {
    try {
      if (!(await exportFile(file, plan))) clean = false;
    } catch (error) {
      console.error(`${file}: ${errorMessage(error)}`);
      return EXIT_USAGE;
    }
  }
  return clean ? EXIT_OK : EXIT_FAILED;
}

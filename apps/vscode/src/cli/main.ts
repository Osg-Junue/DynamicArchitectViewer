import { runCheck } from '../skill/check';
import { runOutline } from '../skill/outline';
import { runExport } from './export';
import { runFormat } from './format';
import { EXIT_OK, EXIT_USAGE, errorMessage, UsageError } from './shared';

/**
 * The `dav` command: what the extension does with a `.dav` file, without the editor. It is for
 * a terminal and for CI, where the SVG in a README can be written again, or checked to be the
 * one its diagram exports.
 */

export const USAGE = `Usage: dav <command> [options] <file.dav>...

Commands:
  export    Export diagrams as SVG images or standalone HTML files
  check     Report what the editor reports; --detail adds hints and describes the layout
  format    Format files in place
  outline   Print what a diagram says, with every reference resolved

Options:
  -h, --help      Show this help; after a command, the help of that command
  -v, --version   Show the version`;

const COMMANDS: Readonly<Record<string, (args: readonly string[]) => number | Promise<number>>> = {
  export: runExport,
  check: (args) => runCheck(args, 'Usage: dav check [--write] [--detail] <file.dav>...'),
  format: runFormat,
  outline: (args) => runOutline(args, 'Usage: dav outline [--json] <file.dav>'),
};

/** An option the command does not have, or a value that is missing, as `node:util` reports it. */
function isOptionError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code.startsWith('ERR_PARSE_ARGS_')
  );
}

/** Runs the command line and returns the exit code: 0, 1 when something is reported, 2 for misuse. */
export async function runCli(args: readonly string[], version: string): Promise<number> {
  const [name, ...rest] = args;
  if (name === '--help' || name === '-h') {
    console.log(USAGE);
    return EXIT_OK;
  }
  if (name === '--version' || name === '-v') {
    console.log(version);
    return EXIT_OK;
  }
  const command = name === undefined ? undefined : COMMANDS[name];
  if (!command) {
    if (name !== undefined) console.error(`dav: there is no command "${name}"`);
    console.error(USAGE);
    return EXIT_USAGE;
  }
  try {
    return await command(rest);
  } catch (error) {
    if (!(error instanceof UsageError) && !isOptionError(error)) throw error;
    // `node:util` goes on to explain how to pass a file whose name starts with a dash.
    const [said = ''] = errorMessage(error).split('. ');
    console.error(`dav ${name}: ${said.replace(/\.$/, '')}`);
    console.error(`Run "dav ${name} --help" for the options.`);
    return EXIT_USAGE;
  }
}

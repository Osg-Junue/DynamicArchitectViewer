import { runCheck } from '../skill/check';
import { runOutline } from '../skill/outline';
import { runExport } from './export';
import { runFormat } from './format';
import { EXIT_OK, EXIT_USAGE, errorMessage, expandFiles, UsageError } from './shared';

/**
 * The `dav` command: what the extension does with a `.dav` file, without the editor. It is for
 * a terminal and for CI, where the SVG in a README can be written again, or checked to be the
 * one its diagram exports.
 */

export const USAGE = `Usage: dav <command> [options] <file.dav>...

Commands:
  export    Export diagrams as SVG images or standalone HTML files
  check     Report what the editor reports; --detail adds hints and describes the layout,
            --map says which node is where
  format    Format files in place
  outline   Print what a diagram says, with every reference resolved

Options:
  -h, --help      Show this help; after a command, the help of that command
  -v, --version   Show the version`;

const CHECK_USAGE = 'Usage: dav check [--write] [--detail] [--map] <file.dav>...';

export const CHECK_HELP = `${CHECK_USAGE}

Reports the errors and warnings of each file, as the editor shows them: one line for each,
with its line and column. Fails when a file has an error, a warning or a hint.

Options:
  --write      Format each file in place before it is checked
  --detail     For a file without errors and warnings, also give hints, where the diagram
               says too little or a text is too long to be shown in full, and describe
               the layout: its size, and the columns and rows the nodes take
  --map        For such a file, also say which node is where, in words and small tables
  -h, --help   Show this help`;

const OUTLINE_USAGE = 'Usage: dav outline [--json] <file.dav>';

export const OUTLINE_HELP = `${OUTLINE_USAGE}

Prints what one diagram says, as Markdown: its zones and nodes, its connections, and the
packets of each step in the order they travel, with every reference resolved. A file with
an error is outlined as far as it could be read, and the command fails.

Options:
  --json       Print the outline as JSON
  -h, --help   Show this help`;

/** A command of the skill scripts, which answer `--help` with their usage line alone. */
function withHelp(
  help: string,
  run: (args: string[]) => number,
): (args: readonly string[]) => number {
  return (args) => {
    if (args.includes('--help') || args.includes('-h')) {
      console.log(help);
      return EXIT_OK;
    }
    return run(expandFiles(args));
  };
}

const COMMANDS: Readonly<Record<string, (args: readonly string[]) => number | Promise<number>>> = {
  export: runExport,
  check: withHelp(CHECK_HELP, (files) => runCheck(files, CHECK_USAGE)),
  format: runFormat,
  outline: withHelp(OUTLINE_HELP, (files) => runOutline(files, OUTLINE_USAGE)),
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
  // Only its own entries: `constructor` and the like are found on every object.
  const command = name !== undefined && Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : undefined;
  if (!command) {
    // The version is said with what is missing: a later version may have it.
    if (name !== undefined) {
      console.error(`dav: there is no command "${name}" in version ${version}`);
    }
    console.error(USAGE);
    return EXIT_USAGE;
  }
  try {
    return await command(rest);
  } catch (error) {
    if (!(error instanceof UsageError) && !isOptionError(error)) throw error;
    // `node:util` goes on to explain how to pass a file whose name starts with a dash. A
    // message of this command is one sentence, and may name a file with ". " in its path.
    const message = errorMessage(error);
    const said = error instanceof UsageError ? message : (message.split('. ')[0] ?? message);
    console.error(`dav ${name}: ${said.replace(/\.$/, '')}`);
    console.error(`Run "dav ${name} --help" for the options of version ${version}.`);
    return EXIT_USAGE;
  }
}

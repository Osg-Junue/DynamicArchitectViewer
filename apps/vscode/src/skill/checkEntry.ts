import { runCheck } from './check';

/** The script of the `dav-diagrams` skill, `dav-check.mjs`. */
process.exitCode = runCheck(process.argv.slice(2));

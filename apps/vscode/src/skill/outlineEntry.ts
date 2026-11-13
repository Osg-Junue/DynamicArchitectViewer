import { runOutline } from './outline';

/** The script of the `dav-reading` skill, `dav-outline.mjs`. */
process.exitCode = runOutline(process.argv.slice(2));

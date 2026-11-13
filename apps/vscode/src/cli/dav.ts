import { runCli } from './main';

/** Set by the build to the version of the npm package. */
declare const __DAV_VERSION__: string;

/** The file the `dav` command of the npm package runs. */
process.exitCode = await runCli(process.argv.slice(2), __DAV_VERSION__);

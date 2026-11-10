// Which version the scripts render. Default: the PV (Japanese screen, as recorded; captions in the
// language given on the command line). With --docs: English screen and diagram, no captions, for the
// README and docs animations.
export const DOCS = process.argv.includes('--docs');
/** Language of the VS Code chrome, the preview and the strings typed or picked in it. */
export const UI = DOCS ? 'en' : 'ja';
export const DAV = DOCS ? 'architecture-en.dav' : 'architecture.dav';
export const HIGHLIGHT = DOCS ? 'highlighted-en.json' : 'highlighted.json';
export const CAPTIONS = !DOCS;
/** File suffix of a rendered cut: the caption language, or "docs". */
export const suffix = (lang) => (DOCS ? 'docs' : lang);
/** Command-line arguments without flags. */
export const ARGS = process.argv.slice(2).filter((a) => !a.startsWith('--'));

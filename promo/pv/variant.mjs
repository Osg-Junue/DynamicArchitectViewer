// Which version capture.mjs renders: node capture.mjs <cuts> <ja|en> [--docs]
//   ja      Japanese screen and diagram (recordings/jp_take5.mp4), Japanese captions
//   en      English screen and diagram (recordings/en_take5.mp4), English captions
//   --docs  English screen and diagram, no captions, for the README and docs animations
/** Command-line arguments without flags. */
export const ARGS = process.argv.slice(2).filter((a) => !a.startsWith('--'));
export const DOCS = process.argv.includes('--docs');
/** Language of the VS Code chrome, the preview and the strings typed or picked in it. */
export const UI = DOCS || ARGS[1] === 'en' ? 'en' : 'ja';
/** The diagram Claude Code generated in the take of that language, unedited. */
export const DAV = UI === 'en' ? 'architecture-en.dav' : 'architecture.dav';
export const HIGHLIGHT = UI === 'en' ? 'highlighted-en.json' : 'highlighted.json';
/** Which steps the cuts use: `follow` sends packets far apart (cut 7), `retry` shows the retries (cut 6). */
export const STEPS = UI === 'en' ? { follow: 5, retry: 7 } : { follow: 4, retry: 8 };
export const CAPTIONS = !DOCS;
/** File suffix of a rendered cut: the language, or "docs". */
export const suffix = (lang) => (DOCS ? 'docs' : lang);

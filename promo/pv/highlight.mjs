// Highlights the diagrams with the extension's real TextMate grammar and VS Code's Dark+ theme.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHighlighter } from 'shiki';

const here = import.meta.dirname;
const grammar = JSON.parse(
  readFileSync(resolve(here, '../../apps/vscode/syntaxes/dav.tmLanguage.json'), 'utf8'),
);

const highlighter = await createHighlighter({
  themes: ['dark-plus'],
  langs: [{ ...grammar, name: 'dav' }],
});
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// With arguments, highlights those files instead: node highlight.mjs <in.dav> <out.json> [...]
// (paths from this folder; promo/pv1 uses this for its own diagrams).
const args = process.argv.slice(2);
const pairs = [];
for (let i = 0; i + 1 < args.length; i += 2) pairs.push([args[i], args[i + 1]]);
for (const [dav, out] of pairs.length > 0
  ? pairs
  : [
      ['architecture.dav', 'highlighted.json'],
      ['architecture-en.dav', 'highlighted-en.json'],
    ]) {
  const source = readFileSync(resolve(here, dav), 'utf8');
  const lines = highlighter.codeToTokensBase(source, { lang: 'dav', theme: 'dark-plus' });
  const html = lines.map((tokens) =>
    tokens.map((t) => `<span style="color:${t.color}">${esc(t.content)}</span>`).join(''),
  );
  writeFileSync(resolve(here, out), JSON.stringify(html));
  console.log(`${out}: ${html.length} lines`);
}

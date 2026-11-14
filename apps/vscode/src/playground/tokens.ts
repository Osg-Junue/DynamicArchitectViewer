import type { editor, languages } from 'monaco-editor/editor';
import { ATTRIBUTE_SCHEMA, KEYWORDS } from '../dsl';
import { ARROW_TOKENS } from '../dsl/schema';

const IDENT = '[A-Za-z_][A-Za-z0-9_]*';
/** The arrows of the language, as the alternatives of a regular expression. */
const ARROWS = ARROW_TOKENS.map((arrow) => arrow.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
/** What may follow `code`: a language or nothing, then the text. */
const CODE_TEXT = '(?=\\s*(?:"|```))';

/** The attributes of every statement; `named` keeps those whose value is a name of the language. */
function attributes(named: boolean): string {
  const names = Object.values(ATTRIBUTE_SCHEMA).flatMap((attrs) =>
    Object.entries(attrs)
      .filter(([, type]) => !named || type === 'color' || type === 'stateColor' || type === 'icon')
      .map(([name]) => name),
  );
  return [...new Set(names)].join('|');
}

/**
 * Colors the text in Monaco, which reads no TextMate grammar: the rules of
 * `syntaxes/dav.tmLanguage.json` as a Monarch tokenizer, with the words taken from the schema of
 * the language. A value after `color:` or `icon:` is colored whatever it is; a wrong one is
 * underlined by its diagnostic.
 */
export const DAV_TOKENS: languages.IMonarchLanguage = {
  defaultToken: '',
  keywords: [...KEYWORDS],
  tokenizer: {
    root: [
      [/\/\/.*$/, 'comment'],
      [/```/, { token: 'string.fence', next: '@fence' }],
      [
        new RegExp(`\\b(${attributes(true)})(\\s*)(:)(\\s*)(${IDENT})`),
        ['attribute.name', '', 'delimiter', '', 'constant.named'],
      ],
      [new RegExp(`\\b(${attributes(false)})(\\s*)(:)`), ['attribute.name', '', 'delimiter']],
      // `code` is a word of the language only where a statement starts: on its line, or after `{`.
      [new RegExp(`^(\\s*)(code)(\\s+)(${IDENT})${CODE_TEXT}`), ['', 'keyword', '', 'type']],
      [new RegExp(`^(\\s*)(code)${CODE_TEXT}`), ['', 'keyword']],
      [
        new RegExp(`(\\{)(\\s*)(code)(\\s+)(${IDENT})${CODE_TEXT}`),
        ['@brackets', '', 'keyword', '', 'type'],
      ],
      [new RegExp(`(\\{)(\\s*)(code)${CODE_TEXT}`), ['@brackets', '', 'keyword']],
      [/\b(?:true|false)\b/, 'constant.language'],
      [new RegExp(ARROWS), 'operator'],
      [/-?\b\d+(?:\.\d+)?\b/, 'number'],
      // A string ends with its line, closed or not.
      [/"(?:[^"\\]|\\.)*$/, 'string'],
      [/"/, { token: 'string', next: '@string' }],
      [new RegExp(IDENT), { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
      [/[{}[\]()]/, '@brackets'],
      [/[,:]/, 'delimiter'],
    ],
    string: [
      [/\\[\\"nt]/, 'string.escape'],
      [/"/, { token: 'string', next: '@pop' }],
      [/\\$/, { token: 'string', next: '@pop' }],
      [/[^\\"]+/, 'string'],
      [/\\/, 'string'],
    ],
    fence: [
      [/```/, { token: 'string.fence', next: '@pop' }],
      [/[^`]+/, 'string.raw'],
      [/`/, 'string.raw'],
    ],
  },
};

type TokenColors = Record<string, string>;

/** The colors Dark+ and Light+ give the scopes of the TextMate grammar. */
const DARK: TokenColors = {
  keyword: 'C586C0',
  'attribute.name': '9CDCFE',
  identifier: '9CDCFE',
  'constant.language': '569CD6',
  'constant.named': '4FC1FF',
  type: '4EC9B0',
  'string.escape': 'D7BA7D',
};
const LIGHT: TokenColors = {
  keyword: 'AF00DB',
  'attribute.name': '001080',
  identifier: '001080',
  'constant.language': '0000FF',
  'constant.named': '0070C1',
  type: '267F99',
  'string.escape': 'EE0000',
};

function theme(base: 'vs' | 'vs-dark', colors: TokenColors, background: string) {
  return {
    base,
    inherit: true,
    rules: Object.entries(colors).map(([token, foreground]) => ({ token, foreground })),
    // The background of the page (`--raw-bg` in scene.css), so that the two panes are one surface.
    colors: { 'editor.background': background },
  } satisfies editor.IStandaloneThemeData;
}

export const DAV_THEMES = {
  'dav-light': theme('vs', LIGHT, '#f8f7f2'),
  'dav-dark': theme('vs-dark', DARK, '#191b1e'),
};

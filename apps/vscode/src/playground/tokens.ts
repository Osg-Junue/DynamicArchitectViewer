import type { editor, languages } from 'monaco-editor/editor';
import { KEYWORDS } from '../dsl';

/**
 * Colors the text in Monaco, which reads no TextMate grammar: the rules of
 * `syntaxes/dav.tmLanguage.json` as a Monarch tokenizer. A value after `color:` or `icon:` is
 * colored whatever it is; a wrong one is underlined by its diagnostic.
 */
export const DAV_TOKENS: languages.IMonarchLanguage = {
  defaultToken: '',
  keywords: [...KEYWORDS],
  tokenizer: {
    root: [
      [/\/\/.*$/, 'comment'],
      [/```/, { token: 'string.fence', next: '@fence' }],
      [/\b(color|icon)(\s*)(:)/, ['attribute.name', '', { token: 'delimiter', next: '@named' }]],
      [/\b(sub|badge|visible|parallel|desc|code|id)(\s*)(:)/, ['attribute.name', '', 'delimiter']],
      [/\b(code)(\s+)([A-Za-z_][A-Za-z0-9_]*)(?=\s*(?:"|```))/, ['keyword', '', 'type']],
      [/\b(?:true|false)\b/, 'constant.language'],
      [/<->|<\.>|-->|\.\.>/, 'operator'],
      [/-?\b\d+(?:\.\d+)?\b/, 'number'],
      // A string ends with its line, closed or not.
      [/"(?:[^"\\]|\\.)*$/, 'string'],
      [/"/, { token: 'string', next: '@string' }],
      [/[A-Za-z_][A-Za-z0-9_]*/, { cases: { '@keywords': 'keyword', '@default': 'identifier' } }],
      [/[{}[\]()]/, '@brackets'],
      [/[,:]/, 'delimiter'],
    ],
    named: [
      [/\s+/, ''],
      [/[A-Za-z_][A-Za-z0-9_]*/, { token: 'constant.named', next: '@pop' }],
      ['', { token: '', next: '@pop' }],
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

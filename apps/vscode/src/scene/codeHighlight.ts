import { THEME_COLOR } from './paint';
import { h, type VNode } from './vnode';

const KEYWORD_WORDS = [
  'true',
  'false',
  'null',
  'undefined',
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
  'SELECT',
  'INSERT',
  'UPDATE',
  'FROM',
  'WHERE',
  'INTO',
  'VALUES',
  'RETURNING',
  'SET',
  'AND',
  'OR',
  'LIMIT',
  'BEGIN',
  'COMMIT',
  'ROLLBACK',
  'OK',
  'ERR',
] as const;

const CODE_KEYWORDS = new Set<string>(KEYWORD_WORDS);

const CODE_TOKEN_RE = new RegExp(
  [
    String.raw`(\/\/.*$|(?<=^\s*|\s)#(?:\s.*|$))`,
    String.raw`("(?:\\.|[^"\\])*(?:"|…))`,
    String.raw`('(?:\\.|[^'\\])*(?:'|…))`,
    String.raw`\b(${KEYWORD_WORDS.join('|')}|HTTP\/\d(?:\.\d)?)\b`,
    String.raw`((?<![\w.-])-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)`,
    String.raw`([{}[\](),:;]+)`,
  ].join('|'),
  'g',
);

/** Tokenizes a single code line into themed `<tspan>` runs and plain text strings. */
export function highlightCodeLine(line: string): VNode[] {
  const out: VNode[] = [];
  const pushPlain = (text: string) => {
    if (!text) return;
    const prev = out[out.length - 1];
    if (typeof prev === 'string') out[out.length - 1] = prev + text;
    else out.push(text);
  };

  let start = 0;
  const unquotedKey = /^(\s*)([A-Za-z_][\w.-]*)(?=\s*:(?!\/))/.exec(line);
  if (unquotedKey) {
    const [, indent = '', key = ''] = unquotedKey;
    if (!CODE_KEYWORDS.has(key)) {
      pushPlain(indent);
      out.push(h('tspan', { fill: THEME_COLOR.codeKey }, key));
      start = indent.length + key.length;
    }
  }

  CODE_TOKEN_RE.lastIndex = start;
  for (let m = CODE_TOKEN_RE.exec(line); m !== null; m = CODE_TOKEN_RE.exec(line)) {
    if (m.index > start) pushPlain(line.slice(start, m.index));
    const token = m[0];
    let fill: string;
    if (m[1] !== undefined) {
      fill = THEME_COLOR.codePunc;
    } else if (m[2] !== undefined) {
      const after = line.slice(m.index + token.length);
      fill = /^\s*:/.test(after) ? THEME_COLOR.codeKey : THEME_COLOR.codeStr;
    } else if (m[3] !== undefined) {
      fill = THEME_COLOR.codeStr;
    } else if (m[4] !== undefined) {
      fill = THEME_COLOR.codeKw;
    } else if (m[5] !== undefined) {
      fill = THEME_COLOR.codeNum;
    } else {
      fill = THEME_COLOR.codePunc;
    }
    out.push(h('tspan', { fill }, token));
    start = m.index + token.length;
  }
  if (start < line.length) pushPlain(line.slice(start));
  return out;
}

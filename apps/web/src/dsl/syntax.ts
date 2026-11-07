import type { SyntaxNode, Tree } from '@lezer/common';
import { parser } from './grammar/dav.grammar';

/** Parses DSL text into a Lezer syntax tree (never throws; errors become ⚠ nodes). */
export function parseTree(text: string): Tree {
  return parser.parse(text);
}

/** All direct children, including comments and literal tokens. */
export function childNodes(node: SyntaxNode): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  for (let c = node.firstChild; c; c = c.nextSibling) out.push(c);
  return out;
}

export function sliceOf(text: string, node: { from: number; to: number }): string {
  return text.slice(node.from, node.to);
}

export interface InvalidEscape {
  /** Offset of the backslash relative to the start of the raw string token. */
  offset: number;
  sequence: string;
}

/** Decodes a raw `"..."` token. Unknown escapes are kept literally and reported. */
export function unescapeString(raw: string): { value: string; invalid: InvalidEscape[] } {
  const invalid: InvalidEscape[] = [];
  const closed = raw.length >= 2 && raw.endsWith('"');
  const body = raw.slice(1, closed ? -1 : undefined);
  let value = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch !== '\\') {
      value += ch;
      continue;
    }
    const next = body[i + 1];
    switch (next) {
      case '"':
        value += '"';
        break;
      case '\\':
        value += '\\';
        break;
      case 'n':
        value += '\n';
        break;
      case 't':
        value += '\t';
        break;
      default:
        invalid.push({ offset: i + 1, sequence: `\\${next ?? ''}` });
        value += `\\${next ?? ''}`;
    }
    i++;
  }
  return { value, invalid };
}

/** Encodes a value as a DSL string literal. */
export function quoteString(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
  return `"${escaped}"`;
}

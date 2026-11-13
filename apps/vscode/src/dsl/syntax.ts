import type { SyntaxNode, Tree } from '@lezer/common';
import { normalizeCodeIndent } from '../model/text';
import { parser } from './grammar/dav.grammar';

const VALUE_NODE_NAMES = new Set(['String', 'Number', 'Color', 'Identifier', 'Boolean']);

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

/** The value child of an `Attribute` node, ignoring `AttrName`, `:`, and comments. */
export function attributeValueNode(attr: SyntaxNode): SyntaxNode | null {
  for (let c = attr.firstChild; c; c = c.nextSibling) {
    if (VALUE_NODE_NAMES.has(c.name)) return c;
  }
  return null;
}

export function sliceOf(text: string, node: { from: number; to: number }): string {
  return text.slice(node.from, node.to);
}

interface InvalidEscape {
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

/** Decodes and dedents a raw triple-backtick ``` ... ``` token. */
export function unescapeCodeFence(raw: string): string {
  const hasOpen = raw.startsWith('```');
  const closed = raw.length >= (hasOpen ? 6 : 3) && raw.endsWith('```');
  return normalizeCodeIndent(raw.slice(hasOpen ? 3 : 0, closed ? -3 : undefined));
}

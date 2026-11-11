import type { VNode } from '../scene/vnode';

/** Element and attribute names that a scene builds; anything else is a bug, not input. */
const NAME = /^[A-Za-z][\w:-]*$/;

/** Characters that XML 1.0 does not allow anywhere in a document. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: these are the characters to remove.
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

function escapeText(s: string): string {
  return s
    .replace(INVALID_XML, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, '&quot;');
}

/**
 * Serializes a scene to XML. User-provided strings only ever reach text and attribute values,
 * which are escaped, so a label cannot add markup to the file.
 */
export function toXml(node: VNode): string {
  if (typeof node === 'string') return escapeText(node);
  if (!NAME.test(node.tag)) throw new Error(`Invalid element name: ${node.tag}`);
  let out = `<${node.tag}`;
  for (const [name, value] of Object.entries(node.attrs)) {
    if (!NAME.test(name)) throw new Error(`Invalid attribute name: ${name}`);
    out += ` ${name}="${escapeAttr(String(value))}"`;
  }
  if (node.children.length === 0) return `${out}/>`;
  return `${out}>${node.children.map(toXml).join('')}</${node.tag}>`;
}

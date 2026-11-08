import type { VElement, VNode } from '../scene/vnode';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Renders a scene VNode into SVG DOM using only safe DOM APIs (no innerHTML). */
export function renderSvg(node: VNode): Node {
  if (typeof node === 'string') return document.createTextNode(node);
  const el = document.createElementNS(SVG_NS, node.tag);
  setAttributes(el, node);
  for (const child of node.children) el.appendChild(renderSvg(child));
  return el;
}

function setAttributes(el: Element, node: VElement): void {
  for (const [name, value] of Object.entries(node.attrs)) el.setAttribute(name, String(value));
}

export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  ...children: Node[]
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, String(value));
  for (const child of children) el.appendChild(child);
  return el;
}

type HtmlChild = Node | string | null | undefined | false;

/** Small HTML element helper. Text is always inserted as text nodes. */
export function html<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | undefined> = {},
  ...children: HtmlChild[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    el.setAttribute(name, value === true ? '' : value);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

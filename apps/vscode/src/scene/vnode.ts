/** Minimal, DOM-free description of SVG/HTML elements. Rendered by the runtime (DOM) or React. */
export interface VElement {
  tag: string;
  attrs: Record<string, string | number>;
  children: VNode[];
  /** Optional stable key (element ID) for renderers that diff. */
  key?: string;
}

export type VNode = VElement | string;

type Child = VNode | null | undefined | false;

export function h(
  tag: string,
  attrs: Record<string, string | number | undefined> = {},
  ...children: Child[]
): VElement {
  const clean: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) clean[k] = v;
  return {
    tag,
    attrs: clean,
    children: children.filter((c): c is VNode => c !== null && c !== undefined && c !== false),
  };
}

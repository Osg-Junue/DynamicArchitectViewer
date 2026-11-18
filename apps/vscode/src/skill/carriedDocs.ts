/** What the skill build keeps of the documents it carries into the references of a skill. */

/**
 * The part of a document that the skills leave out, from a heading to the end: what only
 * contributors need. A link into it leads to the repository instead.
 */
export const LEFT_OUT: Readonly<Record<string, string>> = { 'layout.md': '## Exact rules' };

/** A link to a heading: `](#anchor)` in the same document, or `](name.md#anchor)` in another. */
export const HEADING_LINK = /\]\((?:([\w-]+\.md))?#([\w-]+)\)/g;

/** A document as the skills keep it: without the part they leave out. */
export function keptText(name: string, text: string): string {
  const heading = LEFT_OUT[name];
  if (heading === undefined) return text;
  const at = text.indexOf(`\n${heading}\n`);
  if (at < 0) throw new Error(`${name} has no "${heading}" to leave out`);
  return text.slice(0, at + 1);
}

/** The anchors of the headings of a Markdown text, as GitHub makes them. */
export function anchorsOf(text: string): Set<string> {
  return new Set(
    [...text.matchAll(/^#{1,6} (.+)$/gm)].map(([, title = '']) =>
      title
        .toLowerCase()
        .replace(/[^\p{L}\p{N} _-]/gu, '')
        .replace(/ /g, '-'),
    ),
  );
}

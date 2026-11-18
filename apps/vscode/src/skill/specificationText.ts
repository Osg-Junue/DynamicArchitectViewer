/**
 * The language specification as the writing skill carries it in its SKILL.md: the rules of
 * docs/specification.md, so that an agent reads them exactly as they are, not retold.
 */

/** The lines of SKILL.md that enclose the specification. The skill build writes what is between. */
export const SPECIFICATION_BEGIN =
  '<!-- The language specification, written from docs/specification.md by the skill build. Do not edit it here. -->';
export const SPECIFICATION_END = '<!-- End of the language specification. -->';

/** The sections that are rules of the language, from the first to the one before this. */
const FIRST = '## Lexical structure';
const AFTER_LAST = '## Compatibility';

/**
 * The rules of the specification for SKILL.md: from "Lexical structure" up to "Compatibility",
 * each heading one level down so that they sit under a heading of SKILL.md, without the `.dav`
 * examples, which the skill's own reference example covers, and with links to the documents the
 * skill carries in `references/`.
 */
export function specificationForSkill(specification: string, carried: readonly string[]): string {
  const text = specification.replace(/\r\n/g, '\n');
  const start = text.indexOf(`\n${FIRST}\n`);
  const end = text.indexOf(`\n${AFTER_LAST}\n`);
  if (start < 0 || end < start) throw new Error('The specification has lost a section it needs');
  const rules = text
    .slice(start + 1, end)
    // A `.dav` example, fenced with three backticks or with four around a code fence.
    .replace(/^(`{3,4})dav\n[\s\S]*?^\1\n\n?/gm, '')
    .replace(/^(#{2,5}) /gm, '#$1 ')
    .replace(/\]\(([\w-]+\.md)(#[\w-]+)?\)/g, (link, file: string, anchor = '') =>
      carried.includes(file) ? `](references/${file}${anchor})` : link,
    );
  return `${rules.trimEnd()}\n`;
}

/** SKILL.md with the specification written between its two marker lines. */
export function withSpecification(skill: string, rules: string): string {
  const begin = skill.indexOf(`${SPECIFICATION_BEGIN}\n`);
  const end = skill.indexOf(`${SPECIFICATION_END}\n`);
  if (begin < 0 || end < begin)
    throw new Error('SKILL.md has lost the lines that enclose the specification');
  return `${skill.slice(0, begin + SPECIFICATION_BEGIN.length + 1)}\n${rules}\n${skill.slice(end)}`;
}

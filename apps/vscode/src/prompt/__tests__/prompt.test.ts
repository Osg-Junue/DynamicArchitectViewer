import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { KEYWORDS, parse } from '../../dsl';
import { ICON_NAMES } from '../../model/types';
import { buildAiPrompt, PROMPT_EXAMPLE_DSL, TEXT_BUDGET } from '../index';

describe('AI prompt template (M4)', () => {
  it('embeds a valid DSL v1 example with zero diagnostics', () => {
    const result = parse(PROMPT_EXAMPLE_DSL);
    expect(result.diagnostics).toEqual([]);
    expect(result.document.nodes.length).toBeGreaterThanOrEqual(4);
    expect(result.document.steps.length).toBe(2);
  });

  it('lists every supported icon in both Japanese and English prompts', () => {
    const ja = buildAiPrompt({ locale: 'ja' });
    const en = buildAiPrompt({ locale: 'en' });

    const list = ICON_NAMES.join(', ');
    expect(ja).toContain(list);
    expect(en).toContain(list);
  });

  it.each(['ja', 'en'] as const)('names every reserved word in the %s prompt', (locale) => {
    const prompt = buildAiPrompt({ locale });
    for (const word of KEYWORDS) expect(prompt).toContain(`\`${word}\``);
  });

  it.each(['ja', 'en'] as const)('documents animate code blocks in the %s prompt', (locale) => {
    const prompt = buildAiPrompt({ locale });
    expect(PROMPT_EXAMPLE_DSL).toContain('code json "Order Request"');
    expect(prompt).toContain('code json "Order Request"');
    expect(prompt).toContain('duplicate-code');
    expect(prompt).toContain('node code');
    expect(prompt).toContain('````dav');
  });

  it('includes current DSL only when requested', () => {
    const sample = 'dav 1\ntitle "Custom Diagram"\nnode a "A"';
    expect(
      buildAiPrompt({ locale: 'ja', currentDsl: sample, includeCurrentDsl: false }),
    ).not.toContain('Custom Diagram');
    expect(buildAiPrompt({ locale: 'ja', currentDsl: sample, includeCurrentDsl: true })).toContain(
      'Custom Diagram',
    );
  });

  it.each(['ja', 'en'] as const)('asks for detail in the %s prompt', (locale) => {
    const prompt = buildAiPrompt({ locale });
    for (const word of ['`sub`', '`desc`', '`code`', '`badge`', '`<->`']) {
      expect(prompt).toContain(word);
    }
    for (const [, latin, wide] of TEXT_BUDGET) {
      expect(prompt).toMatch(new RegExp(`${latin} ?[(（]${wide}[)）]`));
    }
  });

  it('gives the text sizes of the dav-diagrams skill, which are measured', () => {
    const skill = readFileSync(
      resolve(__dirname, '../../../../../skills/dav-diagrams/SKILL.md'),
      'utf8',
    );
    const table = skill.slice(skill.indexOf('### Text that fits'));
    const rows = table
      .split(/\r?\n/)
      .filter((line) => /^\| .*\d/.test(line))
      .slice(0, TEXT_BUDGET.length)
      .map((line) => line.split('|').map((cell) => cell.trim()));
    expect(rows).toHaveLength(TEXT_BUDGET.length);
    // The first number of a cell is the size, except for code, which gives its lines first.
    const sizeIn = (cell: string | undefined) =>
      cell?.match(/\d+/g)?.at(cell.includes('lines of') ? 1 : 0);
    TEXT_BUDGET.forEach(([, latin, wide], i) => {
      expect(sizeIn(rows[i]?.[2])).toBe(latin);
      expect(sizeIn(rows[i]?.[3])).toBe(wide);
    });
  });

  it('shows an example that is as detailed as the prompt asks for', () => {
    const { document } = parse(PROMPT_EXAMPLE_DSL);
    expect(document.nodes.every((n) => n.sub && n.icon)).toBe(true);
    expect(document.edges.every((e) => e.label)).toBe(true);
    expect(document.steps.every((s) => s.description.trim())).toBe(true);
    const packets = document.steps.flatMap((s) => s.animations);
    expect(packets.every((a) => a.label && a.description?.trim())).toBe(true);
    expect(packets.some((a) => a.code?.body.trim())).toBe(true);
    for (const a of packets) {
      expect(document.edges.some((e) => e.from === a.from && e.to === a.to)).toBe(true);
    }
  });
});

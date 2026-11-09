import { describe, expect, it } from 'vitest';
import { KEYWORDS, parse } from '../../dsl';
import { ICON_NAMES } from '../../model/types';
import { buildAiPrompt, PROMPT_EXAMPLE_DSL } from '../index';

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

    for (const icon of ICON_NAMES) {
      expect(ja).toContain(icon);
      expect(en).toContain(icon);
    }
  });

  it.each(['ja', 'en'] as const)('names every reserved word in the %s prompt', (locale) => {
    const prompt = buildAiPrompt({ locale });
    for (const word of KEYWORDS) expect(prompt).toContain(`\`${word}\``);
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
});

import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { computeLayout } from '../../layout';
import { resolveView } from '../../scene';
import { mapStepLines } from '../docs/code';
import { ALL_EXAMPLE_DOCUMENTS, DIAGNOSTIC_EXAMPLES, NO_EDGE_DSL } from '../docs/snippets';

describe('documentation examples', () => {
  it.each(ALL_EXAMPLE_DOCUMENTS)('compile cleanly: %s', (dsl) => {
    expect(parse(dsl).diagnostics).toEqual([]);
  });

  it.each(ALL_EXAMPLE_DOCUMENTS)('map phases to source lines: %s', (dsl) => {
    const { document } = parse(dsl);
    const layout = computeLayout(document);
    const mapped = mapStepLines(dsl);
    const lines = dsl.split('\n');
    expect(mapped).toHaveLength(document.steps.length);
    mapped.forEach((step, stepIndex) => {
      const { phases } = resolveView(document, layout, stepIndex);
      const statements = step.phases.map(
        (phase) => phase.filter((line) => /^\s*animate /.test(lines[line] ?? '')).length,
      );
      expect(statements).toEqual(phases.map((p) => p.length));
      expect(lines[step.from]).toMatch(/^step /);
    });
  });

  // NO_EDGE_DSL exists to show a packet without an edge.
  it.each(ALL_EXAMPLE_DOCUMENTS.filter((dsl) => dsl !== NO_EDGE_DSL))(
    'run packets along declared edges: %s',
    (dsl) => {
      const { document } = parse(dsl);
      for (const { from, to } of document.steps.flatMap((step) => step.animations)) {
        const rides = document.edges.some(
          (e) =>
            (e.from === from && e.to === to) ||
            (e.direction === 'bidirectional' && e.from === to && e.to === from),
        );
        expect(rides, `${from} --> ${to}`).toBe(true);
      }
    },
  );
});

describe('diagnostic examples', () => {
  it.each(Object.entries(DIAGNOSTIC_EXAMPLES))('%s is produced by its example', (code, dsl) => {
    expect(parse(dsl).diagnostics.map((d) => d.code)).toContain(code);
  });
});

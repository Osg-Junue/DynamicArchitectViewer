import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LARGE_DIAGRAMS, readExample } from './helpers';
import { type Quality, qualityOf } from './quality';

describe('how readable an overview is', () => {
  /**
   * What each diagram measures now. A change to the layout, the routing or the labels may make
   * a diagram easier to read, and its numbers are then moved with it; it may not make one
   * harder to read unnoticed. `rightward` and `aspect` are the least a diagram may have, the
   * others the most.
   *
   * The zones of the larger diagrams are placed by a search that a small change sends another
   * way, so their numbers move both ways with any change to it. What a change is worth shows
   * in all of them together, not in one.
   */
  // biome-ignore format: one diagram to a line, so that the numbers can be compared down a column.
  const BUDGET: Record<string, Quality> = {
    '01-infra-ha-failover.dav': { winding: 0, crossings: 0, sharedCrossings: 0, jogs: 0, rightward: 1, coveredLabels: 0, aspect: 5.04 },
    '02-screen-flow-checkout.dav': { winding: 0, crossings: 0, sharedCrossings: 0, jogs: 0, rightward: 1, coveredLabels: 0, aspect: 2.99 },
    '03-event-driven-async.dav': { winding: 0, crossings: 0, sharedCrossings: 0, jogs: 0, rightward: 1, coveredLabels: 0, aspect: 6.29 },
    '04-enterprise-zero-trust-payment.dav': { winding: 0, crossings: 0, sharedCrossings: 1, jogs: 0, rightward: 1, coveredLabels: 0, aspect: 4.1 },
    '05-sequence-payment-retry.dav': { winding: 0, crossings: 0, sharedCrossings: 0, jogs: 0, rightward: 0.4, coveredLabels: 0, aspect: 2.16 },
    '06-lan-office-network.dav': { winding: 0, crossings: 0, sharedCrossings: 0, jogs: 0, rightward: 1, coveredLabels: 0, aspect: 5.56 },
    '07-dynamic-architect-viewer.dav': { winding: 0, crossings: 0, sharedCrossings: 0, jogs: 0, rightward: 0.4, coveredLabels: 0, aspect: 2.3 },
    '01-ec-microservices.dav': { winding: 0, crossings: 4, sharedCrossings: 0, jogs: 0, rightward: 0.47, coveredLabels: 0, aspect: 1.65 },
    '02-data-pipeline.dav': { winding: 1, crossings: 5, sharedCrossings: 0, jogs: 1, rightward: 0.5, coveredLabels: 0, aspect: 1.64 },
    '03-hub-spoke-network.dav': { winding: 0, crossings: 1, sharedCrossings: 0, jogs: 0, rightward: 0.71, coveredLabels: 0, aspect: 2.85 },
    '04-event-bus.dav': { winding: 4, crossings: 5, sharedCrossings: 2, jogs: 0, rightward: 0.42, coveredLabels: 0, aspect: 1.25 },
    '05-multi-region.dav': { winding: 1, crossings: 9, sharedCrossings: 0, jogs: 1, rightward: 0.53, coveredLabels: 0, aspect: 1.92 },
    '06-cicd-feedback.dav': { winding: 0, crossings: 0, sharedCrossings: 0, jogs: 0, rightward: 0.1, coveredLabels: 0, aspect: 2.67 },
    '07-zero-trust-nested.dav': { winding: 1, crossings: 10, sharedCrossings: 5, jogs: 0, rightward: 0.39, coveredLabels: 0, aspect: 1.77 },
    '08-iot-edge-cloud.dav': { winding: 2, crossings: 5, sharedCrossings: 1, jogs: 0, rightward: 0.43, coveredLabels: 0, aspect: 1.66 },
    '09-dense-mesh.dav': { winding: 0, crossings: 36, sharedCrossings: 4, jogs: 0, rightward: 0.56, coveredLabels: 1, aspect: 1.58 },
    '10-bank-unbalanced.dav': { winding: 2, crossings: 2, sharedCrossings: 4, jogs: 0, rightward: 0.63, coveredLabels: 1, aspect: 1.54 },
  };
  const examples = readdirSync(resolve(__dirname, '../../../../../examples')).sort();
  const diagrams = [
    ...examples.map((file) => [file, readExample(file)] as const),
    ...LARGE_DIAGRAMS,
  ];

  it('has a budget for every diagram', () => {
    expect(diagrams.map(([id]) => id).sort()).toEqual(Object.keys(BUDGET).sort());
  });

  it.each(diagrams)('%s: is no harder to read than its budget allows', (id, dsl) => {
    const budget = BUDGET[id] as Quality;
    const now = qualityOf(dsl);
    expect(now.winding, 'rails that turn three times or more').toBeLessThanOrEqual(budget.winding);
    expect(now.crossings, 'crossings as drawn').toBeLessThanOrEqual(budget.crossings);
    expect(now.sharedCrossings, 'crossings of rails that share a station').toBeLessThanOrEqual(
      budget.sharedCrossings,
    );
    expect(now.jogs, 'rails between zones that step aside').toBeLessThanOrEqual(budget.jogs);
    expect(now.coveredLabels, 'labels written over something').toBeLessThanOrEqual(
      budget.coveredLabels,
    );
    expect(now.rightward, 'links between zones that point right').toBeGreaterThanOrEqual(
      budget.rightward,
    );
    expect(now.aspect, 'width to height').toBeGreaterThanOrEqual(budget.aspect);
  });

  it('draws none of the large diagrams taller than wide', () => {
    // Four of them were, before an upright link between zones cost more than a level one:
    // their flows ran from the bottom of the picture to its top.
    for (const [id, dsl] of LARGE_DIAGRAMS) expect(qualityOf(dsl).aspect, id).toBeGreaterThan(1);
  });
});

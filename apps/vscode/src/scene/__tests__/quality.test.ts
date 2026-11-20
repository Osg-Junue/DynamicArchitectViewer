import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LARGE_DIAGRAMS, readExample } from './helpers';
import { type Quality, qualityOf } from './quality';

describe('how readable a diagram is in v2', () => {
  /**
   * Regression budgets across all four v2 readability pillars. A layout, routing, or label change
   * that improves readability may tighten these numbers; one that degrades backbone direction,
   * layer separation, step playback health, or local geometry fails immediately.
   *
   * `primaryRightward`, `rightward`, and `aspect` are lower bounds (with `aspect` also capped
   * against extreme ribbons); all other fields are upper bounds.
   */
  // biome-ignore format: one diagram to a line, so that the numbers can be compared down a column.
  const BUDGET: Record<string, Quality> = {
    '01-infra-ha-failover.dav': { primaryRightward: 1, layerIntrusions: 0, primaryCrossings: 0, primaryWinding: 0, stepCalloutCollisions: 0, stepCoveredLabels: 0, winding: 0, crossings: 0, sharedCrossings: 0, jogs: 0, rightward: 1, coveredLabels: 0, aspect: 2.5 },
    '02-screen-flow-checkout.dav': { primaryRightward: 1, layerIntrusions: 0, primaryCrossings: 0, primaryWinding: 0, stepCalloutCollisions: 0, stepCoveredLabels: 0, winding: 0, crossings: 0, sharedCrossings: 0, jogs: 1, rightward: 1, coveredLabels: 0, aspect: 2.5 },
    '03-event-driven-async.dav': { primaryRightward: 1, layerIntrusions: 0, primaryCrossings: 0, primaryWinding: 0, stepCalloutCollisions: 0, stepCoveredLabels: 0, winding: 0, crossings: 0, sharedCrossings: 0, jogs: 0, rightward: 1, coveredLabels: 0, aspect: 2.5 },
    '04-enterprise-zero-trust-payment.dav': { primaryRightward: 1, layerIntrusions: 0, primaryCrossings: 0, primaryWinding: 0, stepCalloutCollisions: 0, stepCoveredLabels: 0, winding: 0, crossings: 2, sharedCrossings: 1, jogs: 1, rightward: 0.86, coveredLabels: 0, aspect: 2.5 },
    '05-sequence-payment-retry.dav': { primaryRightward: 1, layerIntrusions: 0, primaryCrossings: 0, primaryWinding: 0, stepCalloutCollisions: 0, stepCoveredLabels: 0, winding: 0, crossings: 0, sharedCrossings: 0, jogs: 0, rightward: 0.67, coveredLabels: 0, aspect: 2.19 },
    '06-lan-office-network.dav': { primaryRightward: 1, layerIntrusions: 0, primaryCrossings: 0, primaryWinding: 0, stepCalloutCollisions: 0, stepCoveredLabels: 0, winding: 0, crossings: 0, sharedCrossings: 0, jogs: 1, rightward: 1, coveredLabels: 0, aspect: 2.5 },
    '07-dynamic-architect-viewer.dav': { primaryRightward: 1, layerIntrusions: 0, primaryCrossings: 0, primaryWinding: 0, stepCalloutCollisions: 0, stepCoveredLabels: 0, winding: 0, crossings: 0, sharedCrossings: 0, jogs: 0, rightward: 0.4, coveredLabels: 0, aspect: 2.3 },
    '01-ec-microservices.dav': { primaryRightward: 1, layerIntrusions: 0, primaryCrossings: 0, primaryWinding: 0, stepCalloutCollisions: 0, stepCoveredLabels: 0, winding: 1, crossings: 1, sharedCrossings: 0, jogs: 1, rightward: 0.93, coveredLabels: 0, aspect: 1.78 },
    '02-data-pipeline.dav': { primaryRightward: 1, layerIntrusions: 0, primaryCrossings: 0, primaryWinding: 0, stepCalloutCollisions: 0, stepCoveredLabels: 0, winding: 1, crossings: 5, sharedCrossings: 0, jogs: 1, rightward: 0.72, coveredLabels: 0, aspect: 1.93 },
    '03-hub-spoke-network.dav': { primaryRightward: 1, layerIntrusions: 0, primaryCrossings: 0, primaryWinding: 1, stepCalloutCollisions: 0, stepCoveredLabels: 0, winding: 1, crossings: 0, sharedCrossings: 0, jogs: 0, rightward: 0.71, coveredLabels: 0, aspect: 1.75 },
    '04-event-bus.dav': { primaryRightward: 1, layerIntrusions: 0, primaryCrossings: 0, primaryWinding: 1, stepCalloutCollisions: 0, stepCoveredLabels: 0, winding: 4, crossings: 6, sharedCrossings: 1, jogs: 1, rightward: 0.7, coveredLabels: 0, aspect: 1.25 },
    '05-multi-region.dav': { primaryRightward: 1, layerIntrusions: 1, primaryCrossings: 5, primaryWinding: 1, stepCalloutCollisions: 0, stepCoveredLabels: 0, winding: 2, crossings: 17, sharedCrossings: 0, jogs: 2, rightward: 0.59, coveredLabels: 0, aspect: 1.43 },
    '06-cicd-feedback.dav': { primaryRightward: 1, layerIntrusions: 0, primaryCrossings: 0, primaryWinding: 0, stepCalloutCollisions: 0, stepCoveredLabels: 0, winding: 0, crossings: 1, sharedCrossings: 1, jogs: 1, rightward: 0.5, coveredLabels: 0, aspect: 2.5 },
    '07-zero-trust-nested.dav': { primaryRightward: 1, layerIntrusions: 0, primaryCrossings: 0, primaryWinding: 2, stepCalloutCollisions: 0, stepCoveredLabels: 0, winding: 4, crossings: 8, sharedCrossings: 3, jogs: 1, rightward: 0.5, coveredLabels: 0, aspect: 2.5 },
    '08-iot-edge-cloud.dav': { primaryRightward: 1, layerIntrusions: 0, primaryCrossings: 0, primaryWinding: 0, stepCalloutCollisions: 0, stepCoveredLabels: 0, winding: 1, crossings: 1, sharedCrossings: 0, jogs: 0, rightward: 0.71, coveredLabels: 0, aspect: 2.28 },
    '09-dense-mesh.dav': { primaryRightward: 1, layerIntrusions: 0, primaryCrossings: 6, primaryWinding: 5, stepCalloutCollisions: 0, stepCoveredLabels: 0, winding: 6, crossings: 31, sharedCrossings: 11, jogs: 1, rightward: 0.63, coveredLabels: 0, aspect: 1.61 },
    '10-bank-unbalanced.dav': { primaryRightward: 1, layerIntrusions: 0, primaryCrossings: 3, primaryWinding: 3, stepCalloutCollisions: 1, stepCoveredLabels: 0, winding: 3, crossings: 3, sharedCrossings: 7, jogs: 1, rightward: 0.88, coveredLabels: 0, aspect: 2.5 },
  };
  const MAX_ASPECT = 6.5;

  const examples = readdirSync(resolve(__dirname, '../../../../../examples')).sort();
  const diagrams = [
    ...examples.map((file) => [file, readExample(file)] as const),
    ...LARGE_DIAGRAMS,
  ];

  it('has a budget for every diagram', () => {
    expect(diagrams.map(([id]) => id).sort()).toEqual(Object.keys(BUDGET).sort());
  });

  it.each(diagrams)('%s: meets all four readability pillar budgets', (id, dsl) => {
    const budget = BUDGET[id] as Quality;
    const now = qualityOf(dsl);

    // Pillar 1: Backbone fidelity
    expect(now.primaryRightward, 'inter-zone primary links pointing right').toBeGreaterThanOrEqual(
      budget.primaryRightward,
    );
    expect(
      now.layerIntrusions,
      'zones intruding between connected primary layers',
    ).toBeLessThanOrEqual(budget.layerIntrusions);

    // Pillar 2: Primary hierarchy
    expect(now.primaryCrossings, 'crossings between primary rails').toBeLessThanOrEqual(
      budget.primaryCrossings,
    );
    expect(now.primaryWinding, 'primary rails turning three times or more').toBeLessThanOrEqual(
      budget.primaryWinding,
    );
    expect(now.primaryCrossings).toBeLessThanOrEqual(now.crossings);
    expect(now.primaryWinding).toBeLessThanOrEqual(now.winding);

    // Pillar 3: Step playback health
    expect(now.stepCalloutCollisions, 'overlapping callouts in a step phase').toBeLessThanOrEqual(
      budget.stepCalloutCollisions,
    );
    expect(
      now.stepCoveredLabels,
      'step static labels covered by rails or labels',
    ).toBeLessThanOrEqual(budget.stepCoveredLabels);

    // Pillar 4: Local overview geometry
    expect(now.winding, 'rails that turn three times or more').toBeLessThanOrEqual(budget.winding);
    expect(now.crossings, 'crossings as drawn').toBeLessThanOrEqual(budget.crossings);
    expect(now.sharedCrossings, 'crossings of rails that share a station').toBeLessThanOrEqual(
      budget.sharedCrossings,
    );
    expect(now.jogs, 'rails between zones that step aside').toBeLessThanOrEqual(budget.jogs);
    expect(now.coveredLabels, 'overview labels written over something').toBeLessThanOrEqual(
      budget.coveredLabels,
    );
    expect(now.rightward, 'links between zones that point right').toBeGreaterThanOrEqual(
      budget.rightward,
    );
    expect(now.aspect, 'width to height minimum').toBeGreaterThanOrEqual(budget.aspect);
    expect(now.aspect, 'width to height maximum').toBeLessThanOrEqual(MAX_ASPECT);
  });

  it('draws none of the large diagrams taller than wide', () => {
    for (const [id, dsl] of LARGE_DIAGRAMS) expect(qualityOf(dsl).aspect, id).toBeGreaterThan(1);
  });

  it('excludes return and static links from primaryRightward and primaryCrossings', () => {
    const dsl = `
group g1 "Upstream" {
  node a "A"
  node b "B"
}
group g2 "Midstream" {
  node c "C"
  node d "D"
}
group g3 "Downstream" {
  node e "E"
  node f "F"
}
step "Forward" {
  static a ..> f : "Telemetry"
  static b ..> e : "Config"
  animate a --> c : "Req 1"
  animate b --> d : "Req 2" [parallel: true]
  animate c --> e : "Next 1"
  animate d --> f : "Next 2" [parallel: true]
  animate e --> a : "Callback"
}
`;
    const q = qualityOf(dsl);
    expect(q.primaryRightward).toBe(1);
    expect(q.primaryCrossings).toBe(0);
    expect(q.layerIntrusions).toBe(0);
    expect(q.stepCoveredLabels).toBe(0);
    expect(q.coveredLabels).toBe(0);
    expect(q.rightward).toBeLessThan(1);
  });

  it('allows sequential callouts on the same rail without flagging phase collisions', () => {
    const dsl = `
node a "A"
node b "B"
step "Ping-Pong" {
  animate a --> b : "Send" [desc: "First phase message"]
  animate b --> a : "Reply" [desc: "Second phase reply"]
}
`;
    const q = qualityOf(dsl);
    expect(q.stepCalloutCollisions).toBe(0);
    expect(q.primaryRightward).toBe(1);
  });
});

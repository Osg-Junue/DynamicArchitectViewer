import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { adoptZonePlan, computeLayout, pendingZoneSearch } from '../../layout';
import type { DavDocument } from '../../model/types';
import { ZonePlanner } from '../zonePlanner';
import { FakeWorker } from './fakeWorker';

const REPO = resolve(__dirname, '../../../../..');
/** A diagram with links long enough that its zones are searched for a better place. */
const SEARCHED = readFileSync(resolve(REPO, 'promo/pv/architecture-en.dav'), 'utf8');
const searched = (extra = ''): DavDocument => parse(`${SEARCHED}\n${extra}`).document;
const plain = parse('dav 1\nnode a "A"\nnode b "B"\na --> b : "x"').document;

const setup = () => {
  const worker = new FakeWorker();
  let made = 0;
  const planner = new ZonePlanner(() => {
    made++;
    return worker;
  });
  return { worker, planner, made: () => made };
};

describe('ZonePlanner', () => {
  // The layout remembers its last plan; each test starts without one.
  beforeEach(() => adoptZonePlan('', undefined));

  it('uses a diagram that needs a search, or the tests below prove nothing', () => {
    expect(pendingZoneSearch(searched())).toBeDefined();
    expect(pendingZoneSearch(plain)).toBeUndefined();
  });

  it('answers at once, without a worker, when the layout needs no search', () => {
    const { planner, made } = setup();
    let ready = 0;
    planner.whenPlanned(plain, () => ready++);
    expect(ready).toBe(1);
    expect(made()).toBe(0);
  });

  it('answers after the worker has searched, with the layout a search here gives', () => {
    const doc = searched();
    const expected = computeLayout(doc);
    adoptZonePlan('', undefined);

    const { planner, worker } = setup();
    let ready = 0;
    planner.whenPlanned(doc, () => ready++);
    expect(worker.posted).toHaveLength(1);
    expect(ready).toBe(0);
    // Nothing was searched on this thread meanwhile.
    expect(pendingZoneSearch(doc)).toBeDefined();

    worker.answer();
    expect(ready).toBe(1);
    expect(pendingZoneSearch(doc)).toBeUndefined();
    expect(computeLayout(doc)).toEqual(expected);
  });

  it('drops a diagram that was replaced while the worker was busy', () => {
    const first = searched('node extra_a "A"');
    const second = searched('node extra_b "B"');
    const third = searched('node extra_c "C"');
    const { planner, worker } = setup();
    const called: string[] = [];
    planner.whenPlanned(first, () => called.push('first'));
    planner.whenPlanned(second, () => called.push('second'));
    planner.whenPlanned(third, () => called.push('third'));
    // The worker cannot be interrupted, so the latest waits for it; the one between is gone.
    expect(worker.posted).toHaveLength(1);

    worker.answer();
    expect(called).toEqual([]);
    expect(worker.posted).toHaveLength(2);
    expect(worker.posted[1]?.key).toBe(pendingZoneSearch(third)?.key);

    worker.answer();
    expect(called).toEqual(['third']);
    expect(pendingZoneSearch(third)).toBeUndefined();
  });

  it('does not let an answer nobody waits for replace the plan in use', () => {
    const { planner, worker } = setup();
    const called: string[] = [];
    planner.whenPlanned(searched('node extra_d "D"'), () => called.push('searched'));
    planner.whenPlanned(plain, () => called.push('plain'));
    expect(called).toEqual(['plain']);

    const before = pendingZoneSearch(searched('node extra_d "D"'));
    worker.answer();
    expect(called).toEqual(['plain']);
    expect(pendingZoneSearch(searched('node extra_d "D"'))).toEqual(before);
  });

  it('answers an edit that keeps the structure with the search already under way', () => {
    const { planner, worker } = setup();
    const called: string[] = [];
    planner.whenPlanned(searched('node extra_e "E"'), () => called.push('old'));
    planner.whenPlanned(searched('node extra_e "Renamed"'), () => called.push('new'));
    expect(worker.posted).toHaveLength(1);
    worker.answer();
    expect(called).toEqual(['new']);
  });

  it('calls nothing back after cancel', () => {
    const doc = searched('node extra_f "F"');
    const { planner, worker } = setup();
    let ready = 0;
    planner.whenPlanned(doc, () => ready++);
    planner.cancel();
    worker.answer();
    expect(ready).toBe(0);
    expect(pendingZoneSearch(doc)).toBeDefined();
  });

  it('searches here when no worker can be made', () => {
    const doc = searched('node extra_g "G"');
    const planner = new ZonePlanner(() => {
      throw new Error('no workers here');
    });
    let ready = 0;
    planner.whenPlanned(doc, () => ready++);
    expect(ready).toBe(1);
    expect(pendingZoneSearch(doc)).toBeUndefined();
  });

  it('searches here, and stops using the worker, when the worker fails', () => {
    const doc = searched('node extra_h "H"');
    const { planner, worker, made } = setup();
    let ready = 0;
    planner.whenPlanned(doc, () => ready++);
    expect(ready).toBe(0);
    worker.onerror?.(new Error('blocked'));
    expect(ready).toBe(1);
    expect(worker.terminated).toBe(true);
    expect(pendingZoneSearch(doc)).toBeUndefined();

    planner.whenPlanned(searched('node extra_i "I"'), () => ready++);
    expect(ready).toBe(2);
    expect(made()).toBe(1);
    expect(worker.posted).toHaveLength(1);
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse } from '../../dsl';
import { adoptZonePlan, computeLayout, pendingZoneSearch, ZONE_SEARCH_SEEDS } from '../../layout';
import type { DavDocument } from '../../model/types';
import { REST_MS, SETTLE_MS, SPREAD_FROM_LINKS, ZonePlanner } from '../zonePlanner';
import { FakeWorker } from './fakeWorker';
import { largeDiagram } from './largeDiagram';

const REPO = resolve(__dirname, '../../../../..');
/** A diagram with links long enough that its zones are searched for a better place. */
const SEARCHED = readFileSync(resolve(REPO, 'promo/pv/architecture-en.dav'), 'utf8');
const searched = (extra = ''): DavDocument => parse(`${SEARCHED}\n${extra}`).document;
const plain = parse('dav 1\nnode a "A"\nnode b "B"\na --> b : "x"').document;

const setup = () => {
  const worker = new FakeWorker();
  let made = 0;
  // One core: the search is never spread, whatever the machine the tests run on.
  const planner = new ZonePlanner(() => {
    made++;
    return worker;
  }, 1);
  return { worker, planner, made: () => made };
};

describe('ZonePlanner', () => {
  // The layout remembers its last plan; each test starts without one.
  beforeEach(() => adoptZonePlan('', undefined));

  it('uses a diagram that needs a search, or the tests below prove nothing', () => {
    // A small one, which a single worker searches whole whatever the machine.
    expect(pendingZoneSearch(searched())?.links).toBeLessThan(SPREAD_FROM_LINKS);
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
    }, 1);
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

describe('ZonePlanner, on a diagram large enough to spread its search', () => {
  const large = (extra = ''): DavDocument => parse(largeDiagram(extra)).document;
  /**
   * A planner on a machine with that many cores, and every worker it has made. The workers
   * search only where a test looks at the layout: a search of this diagram takes half a second.
   */
  const setup = (cores = 4, searches = false) => {
    const workers: FakeWorker[] = [];
    const planner = new ZonePlanner(() => {
      const worker = new FakeWorker(searches);
      workers.push(worker);
      return worker;
    }, cores);
    return { planner, workers };
  };
  const seedsOf = (workers: readonly FakeWorker[]) =>
    workers.flatMap((worker) => worker.posted.map((request) => request.seed));
  /** Lets the workers answer, the last one first, until none has anything left to do. */
  const answerAll = (workers: readonly FakeWorker[]) => {
    for (let busy = workers.filter((w) => w.busy); busy.length > 0; ) {
      busy.at(-1)?.answer();
      busy = workers.filter((w) => w.busy);
    }
  };

  beforeEach(() => {
    adoptZonePlan('', undefined);
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('uses a diagram with enough links between its zones, or the tests below prove nothing', () => {
    expect(pendingZoneSearch(large())?.links).toBeGreaterThanOrEqual(SPREAD_FROM_LINKS);
  });

  it('gives every seed to a worker of its own, and answers as one search here does', () => {
    const doc = large();
    const expected = computeLayout(doc);
    adoptZonePlan('', undefined);

    const { planner, workers } = setup(4, true);
    let ready = 0;
    planner.whenPlanned(doc, () => ready++, true);
    // Four cores: one is left to the page, three workers search.
    expect(workers).toHaveLength(3);
    expect(seedsOf(workers)).toEqual(ZONE_SEARCH_SEEDS.slice(0, 3));

    answerAll(workers);
    expect(ready).toBe(1);
    expect([...seedsOf(workers)].sort()).toEqual([...ZONE_SEARCH_SEEDS].sort());
    expect(pendingZoneSearch(doc)).toBeUndefined();
    expect(computeLayout(doc)).toEqual(expected);
  });

  it('waits for the text to stay as it is, unless nothing is on screen', () => {
    const { planner, workers } = setup();
    const called: string[] = [];
    planner.whenPlanned(large('node extra_a'), () => called.push('first'));
    vi.advanceTimersByTime(SETTLE_MS - 1);
    planner.whenPlanned(large('node extra_b'), () => called.push('second'));
    vi.advanceTimersByTime(SETTLE_MS - 1);
    // Typing has started no search at all.
    expect(workers).toHaveLength(0);

    vi.advanceTimersByTime(1);
    expect(workers).toHaveLength(3);
    expect(workers[0]?.posted[0]?.key).toBe(pendingZoneSearch(large('node extra_b'))?.key);
    answerAll(workers);
    expect(called).toEqual(['second']);
  });

  it('stops a search that a newer diagram has made pointless', () => {
    const { planner, workers } = setup();
    const called: string[] = [];
    planner.whenPlanned(large('node extra_c'), () => called.push('first'), true);
    workers[0]?.answer();
    planner.whenPlanned(large('node extra_d'), () => called.push('second'), true);
    // All three were at the first search; its answers would have come to nothing.
    expect(workers.slice(0, 3).map((w) => w.terminated)).toEqual([true, true, true]);
    expect(workers).toHaveLength(6);

    answerAll(workers);
    expect(called).toEqual(['second']);
  });

  it('answers an edit that keeps the structure with the search already under way', () => {
    const { planner, workers } = setup();
    const called: string[] = [];
    planner.whenPlanned(large('node extra_e "E"'), () => called.push('old'), true);
    planner.whenPlanned(large('node extra_e "Renamed"'), () => called.push('new'));
    expect(workers).toHaveLength(3);
    answerAll(workers);
    expect(called).toEqual(['new']);
    expect(workers.some((w) => w.terminated)).toBe(false);
  });

  it('calls nothing back after cancel, and starts no search that was waiting', () => {
    const { planner, workers } = setup();
    let ready = 0;
    planner.whenPlanned(large('node extra_f'), () => ready++);
    planner.cancel();
    vi.advanceTimersByTime(SETTLE_MS);
    expect(workers).toHaveLength(0);

    planner.whenPlanned(large('node extra_f'), () => ready++, true);
    planner.cancel();
    expect(workers.map((w) => w.terminated)).toEqual([true, true, true]);
    expect(ready).toBe(0);
  });

  it('ends the workers it made for the search some time after it, but for one', () => {
    const { planner, workers } = setup();
    planner.whenPlanned(large('node extra_g'), () => {}, true);
    answerAll(workers);
    vi.advanceTimersByTime(REST_MS - 1);
    expect(workers.some((w) => w.terminated)).toBe(false);
    vi.advanceTimersByTime(1);
    expect(workers.map((w) => w.terminated)).toEqual([false, true, true]);

    // The next such search makes them again.
    planner.whenPlanned(large('node extra_h'), () => {}, true);
    expect(workers).toHaveLength(5);
  });

  it('searches whole in the one worker where there are no cores to spread over', () => {
    const { planner, workers } = setup(2);
    let ready = 0;
    planner.whenPlanned(large('node extra_i'), () => ready++);
    expect(workers).toHaveLength(1);
    expect(seedsOf(workers)).toEqual([undefined]);
    workers[0]?.answer();
    expect(ready).toBe(1);
  });

  it('searches here, and stops using workers, when one of them fails', () => {
    const doc = large('node extra_j');
    const { planner, workers } = setup();
    let ready = 0;
    planner.whenPlanned(doc, () => ready++, true);
    workers[1]?.onerror?.(new Error('blocked'));
    expect(ready).toBe(1);
    expect(workers.map((w) => w.terminated)).toEqual([true, true, true]);
    // The others are ended and no longer heard: failing too, they start nothing again.
    for (const worker of workers) worker.onerror?.(new Error('blocked'));
    answerAll(workers);
    expect(ready).toBe(1);
    expect(pendingZoneSearch(doc)).toBeUndefined();

    planner.whenPlanned(searched('node extra_k "K"'), () => ready++);
    expect(ready).toBe(2);
    expect(workers).toHaveLength(3);
  });
  describe('the life of its workers', () => {
    const alive = (workers: readonly FakeWorker[]) => workers.filter((w) => !w.terminated);

    it('ends every worker and every timer when it is disposed of during a search', () => {
      const { planner, workers } = setup();
      let ready = 0;
      planner.whenPlanned(large('node life_a'), () => ready++, true);
      planner.dispose();
      expect(alive(workers)).toEqual([]);
      expect(vi.getTimerCount()).toBe(0);
      for (const worker of workers) worker.answer();
      expect(ready).toBe(0);
    });

    it('starts no search that was waiting when it is disposed of', () => {
      const { planner, workers } = setup();
      planner.whenPlanned(large('node life_b'), () => {});
      planner.dispose();
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(SETTLE_MS + REST_MS);
      expect(workers).toHaveLength(0);
    });

    it('searches here what is planned after it was disposed of, the same diagram too', () => {
      const doc = searched('node life_c "C"');
      const { planner, workers } = setup();
      let ready = 0;
      planner.whenPlanned(doc, () => ready++);
      planner.dispose();
      // The worker that was at this very diagram is gone: its answer must not be waited for.
      planner.whenPlanned(doc, () => ready++);
      expect(ready).toBe(1);
      expect(workers).toHaveLength(1);
      expect(pendingZoneSearch(doc)).toBeUndefined();
    });

    it('searches here, when its time comes, what was waiting as the workers failed', () => {
      const doc = large('node life_d');
      const { planner, workers } = setup();
      let ready = 0;
      planner.whenPlanned(searched('node life_d "D"'), () => ready++);
      workers[0]?.answer();
      expect(ready).toBe(1);

      planner.whenPlanned(doc, () => ready++);
      workers[0]?.onerror?.(new Error('blocked'));
      expect(ready).toBe(1);
      vi.advanceTimersByTime(SETTLE_MS);
      expect(ready).toBe(2);
      expect(workers).toHaveLength(1);
      expect(pendingZoneSearch(doc)).toBeUndefined();
    });

    it('gives up on workers without calling back when one fails with nothing to do', () => {
      const { planner, workers } = setup();
      let ready = 0;
      planner.whenPlanned(large('node life_e'), () => ready++, true);
      answerAll(workers);
      workers[2]?.onerror?.(new Error('blocked'));
      expect(ready).toBe(1);
      expect(alive(workers)).toEqual([]);
    });

    it('lets the first worker join a search that started while it was at another', () => {
      const { planner, workers } = setup();
      const called: string[] = [];
      planner.whenPlanned(searched('node life_f "F"'), () => called.push('small'));
      planner.cancel();
      planner.whenPlanned(large('node life_f'), () => called.push('large'), true);
      // The first cannot leave what it is at; the two made beside it start on the seeds.
      expect(workers).toHaveLength(3);
      expect(seedsOf(workers)).toEqual([undefined, ...ZONE_SEARCH_SEEDS.slice(0, 2)]);

      workers[0]?.answer();
      expect(called).toEqual([]);
      expect(workers[0]?.posted.at(-1)?.seed).toBe(ZONE_SEARCH_SEEDS[2]);
      answerAll(workers);
      expect(called).toEqual(['large']);
      expect(seedsOf(workers).filter((seed) => seed !== undefined)).toHaveLength(6);
    });

    it('gives every seed to the first worker where no other can be made', () => {
      const workers: FakeWorker[] = [];
      const planner = new ZonePlanner(() => {
        if (workers.length > 0) throw new Error('no more workers');
        const worker = new FakeWorker(false);
        workers.push(worker);
        return worker;
      }, 4);
      let ready = 0;
      planner.whenPlanned(large('node life_g'), () => ready++, true);
      expect(seedsOf(workers)).toEqual(ZONE_SEARCH_SEEDS.slice(0, 1));
      answerAll(workers);
      expect(ready).toBe(1);
      expect(seedsOf(workers)).toEqual(ZONE_SEARCH_SEEDS);
    });

    it('ends the workers of a search for a diagram that takes one worker, and keeps that one', () => {
      const { planner, workers } = setup();
      const called: string[] = [];
      planner.whenPlanned(large('node life_h'), () => called.push('large'), true);
      planner.whenPlanned(searched('node life_h "H"'), () => called.push('small'));
      expect(workers.map((w) => w.terminated)).toEqual([true, true, true, false]);
      expect(seedsOf(workers.slice(3))).toEqual([undefined]);

      workers[3]?.answer();
      expect(called).toEqual(['small']);
      vi.advanceTimersByTime(REST_MS);
      expect(workers[3]?.terminated).toBe(false);
    });

    it('takes no answer of a search it has stopped, for the same diagram either', () => {
      const doc = large('node life_i');
      const { planner, workers } = setup();
      let ready = 0;
      planner.whenPlanned(doc, () => ready++, true);
      planner.cancel();
      planner.whenPlanned(doc, () => ready++, true);
      const stopped = workers.slice(0, 3);
      expect(alive(stopped)).toEqual([]);
      // What they found is for this very diagram, and still must not count.
      for (const worker of stopped) worker.answer();
      expect(ready).toBe(0);
      expect(pendingZoneSearch(doc)).toBeDefined();

      answerAll(workers);
      expect(ready).toBe(1);
    });

    it('does not hear a worker fail that it has ended', () => {
      const { planner, workers } = setup();
      let ready = 0;
      planner.whenPlanned(large('node life_s'), () => {}, true);
      planner.whenPlanned(large('node life_t'), () => ready++, true);
      // Ended with the first search. An error of it now would end the workers of the second.
      workers[0]?.onerror?.(new Error('late'));
      expect(alive(workers)).toHaveLength(3);
      expect(ready).toBe(0);
      answerAll(workers);
      expect(ready).toBe(1);
    });

    it('stops only the workers that were still searching', () => {
      // Eight cores: six workers, one seed each.
      const { planner, workers } = setup(8);
      planner.whenPlanned(large('node life_j'), () => {}, true);
      expect(workers).toHaveLength(6);
      for (const worker of workers.slice(0, 3)) worker.answer();

      const next = large('node life_k');
      planner.whenPlanned(next, () => {}, true);
      expect(workers.slice(0, 6).map((w) => w.terminated)).toEqual([
        false,
        false,
        false,
        true,
        true,
        true,
      ]);
      expect(workers).toHaveLength(9);
      const key = pendingZoneSearch(next)?.key;
      expect(alive(workers).map((w) => w.busy && w.posted.at(-1)?.key === key)).toEqual(
        Array(6).fill(true),
      );
    });

    it('keeps no more workers and timers, however often the diagram changes', () => {
      const { planner, workers } = setup();
      for (let i = 0; i < 20; i++) {
        planner.whenPlanned(large(`node life_l${i}`), () => {}, i % 2 === 0);
        vi.advanceTimersByTime(i % 3 === 0 ? SETTLE_MS : 10);
        expect(alive(workers).length).toBeLessThanOrEqual(3);
        // One for the workers to rest, and one for a search that waits for the text to settle.
        expect(vi.getTimerCount()).toBeLessThanOrEqual(2);
      }
      planner.dispose();
      expect(alive(workers)).toEqual([]);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('ends no worker that a later search is using, or is about to use', () => {
      const { planner, workers } = setup();
      planner.whenPlanned(large('node life_m'), () => {}, true);
      answerAll(workers);
      vi.advanceTimersByTime(REST_MS - 1);
      planner.whenPlanned(large('node life_n'), () => {}, true);
      vi.advanceTimersByTime(REST_MS);
      expect(alive(workers)).toHaveLength(3);
      answerAll(workers);

      // The time to rest runs out while the next search waits for the text to settle.
      vi.advanceTimersByTime(REST_MS - 1);
      let ready = 0;
      planner.whenPlanned(large('node life_o'), () => ready++);
      vi.advanceTimersByTime(SETTLE_MS);
      expect(workers).toHaveLength(3);
      expect(alive(workers)).toHaveLength(3);
      answerAll(workers);
      expect(ready).toBe(1);

      vi.advanceTimersByTime(REST_MS);
      expect(workers.map((w) => w.terminated)).toEqual([false, true, true]);
    });

    it('ends the workers that were idle too, some time after a search was stopped', () => {
      const { planner, workers } = setup(8);
      planner.whenPlanned(large('node life_p'), () => {}, true);
      for (const worker of workers.slice(0, 3)) worker.answer();
      planner.cancel();
      expect(alive(workers)).toHaveLength(3);
      vi.advanceTimersByTime(REST_MS);
      expect(workers.map((w) => w.terminated)).toEqual([false, true, true, true, true, true]);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('goes on waiting for the text to settle through an edit that keeps the structure', () => {
      const { planner, workers } = setup();
      const called: string[] = [];
      planner.whenPlanned(large('node life_q "Q"'), () => called.push('old'));
      vi.advanceTimersByTime(SETTLE_MS - 50);
      planner.whenPlanned(large('node life_q "Renamed"'), () => called.push('new'));
      vi.advanceTimersByTime(50);
      expect(workers).toHaveLength(3);
      answerAll(workers);
      expect(called).toEqual(['new']);
    });

    it('drops a search that was waiting, for a diagram that needs none', () => {
      const { planner, workers } = setup();
      const called: string[] = [];
      planner.whenPlanned(large('node life_r'), () => called.push('large'));
      planner.whenPlanned(plain, () => called.push('plain'));
      expect(called).toEqual(['plain']);
      vi.advanceTimersByTime(SETTLE_MS);
      expect(workers).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});

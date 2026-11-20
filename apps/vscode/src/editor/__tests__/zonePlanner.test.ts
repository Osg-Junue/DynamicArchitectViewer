import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse } from '../../dsl';
import { adoptZonePlan, computeLayout, pendingZoneSearch, type ZonePlacement } from '../../layout';
import type { DavDocument } from '../../model/types';
import { SETTLE_MS, ZonePlanner } from '../zonePlanner';
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
    // A small one, which starts immediately without waiting for typing to settle.
    expect(pendingZoneSearch(searched())?.links).toBeLessThan(50);
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

  it('rejects a stale worker result whose key does not match the running job', () => {
    const doc = searched('node extra_stale "S"');
    const { planner, worker } = setup();
    let ready = 0;
    planner.whenPlanned(doc, () => ready++);
    expect(worker.posted).toHaveLength(1);

    worker.onmessage?.({
      data: {
        key: 'stale-old-key',
        placement: new Map([['__bogus__', { x: 1, y: 2, flip: 0 }]]),
      },
    });
    expect(ready).toBe(0);
    expect(pendingZoneSearch(doc)).toBeDefined();
  });

  it('zoneSearch.worker entrypoint computes and posts placement matching computeLayout', async () => {
    const doc = searched('node worker_entry "W"');
    const expected = computeLayout(doc);
    adoptZonePlan('', undefined);

    const search = pendingZoneSearch(doc);
    expect(search).toBeDefined();
    if (!search) return;

    let handler: ((event: MessageEvent) => void) | undefined;
    const posted: unknown[] = [];
    vi.stubGlobal('addEventListener', (type: string, cb: (event: MessageEvent) => void) => {
      if (type === 'message') handler = cb;
    });
    vi.stubGlobal('postMessage', (msg: unknown) => {
      posted.push(msg);
    });
    try {
      vi.resetModules();
      await import('../zoneSearch.worker');
      expect(handler).toBeDefined();
      handler?.({ data: search } as MessageEvent);
      expect(posted).toHaveLength(1);
      const result = posted[0] as { key: string; placement: ZonePlacement | undefined };
      expect(result.key).toBe(search.key);
      adoptZonePlan(result.key, result.placement);
      expect(computeLayout(doc)).toEqual(expected);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('ZonePlanner, on a large diagram', { timeout: 15_000 }, () => {
  const large = (extra = ''): DavDocument => parse(largeDiagram(extra)).document;
  const setupLarge = (searches = false) => {
    const workers: FakeWorker[] = [];
    const planner = new ZonePlanner(() => {
      const worker = new FakeWorker(searches);
      workers.push(worker);
      return worker;
    });
    return { planner, workers };
  };
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

  it('uses a diagram with >= 50 links between zones', () => {
    expect(pendingZoneSearch(large())?.links).toBeGreaterThanOrEqual(50);
  });

  it('runs a large diagram in a single worker and matches computeLayout', () => {
    const doc = large();
    const expected = computeLayout(doc);
    adoptZonePlan('', undefined);

    const { planner, workers } = setupLarge(true);
    let ready = 0;
    planner.whenPlanned(doc, () => ready++, true);
    expect(workers).toHaveLength(1);

    answerAll(workers);
    expect(ready).toBe(1);
    expect(pendingZoneSearch(doc)).toBeUndefined();
    expect(computeLayout(doc)).toEqual(expected);
  });

  it('waits for the text to stay as it is, unless nothing is on screen', () => {
    const { planner, workers } = setupLarge();
    const called: string[] = [];
    planner.whenPlanned(large('node extra_a'), () => called.push('first'));
    vi.advanceTimersByTime(SETTLE_MS - 1);
    planner.whenPlanned(large('node extra_b'), () => called.push('second'));
    vi.advanceTimersByTime(SETTLE_MS - 1);
    // Typing has started no search at all.
    expect(workers).toHaveLength(0);

    vi.advanceTimersByTime(1);
    expect(workers).toHaveLength(1);
    expect(workers[0]?.posted[0]?.key).toBe(pendingZoneSearch(large('node extra_b'))?.key);
    answerAll(workers);
    expect(called).toEqual(['second']);
  });

  it('queues the latest large search behind a busy worker and drops intermediate results', () => {
    const { planner, workers } = setupLarge();
    const called: string[] = [];
    planner.whenPlanned(large('node extra_c'), () => called.push('first'), true);
    planner.whenPlanned(large('node extra_d'), () => called.push('second'), true);
    expect(workers).toHaveLength(1);
    expect(workers[0]?.terminated).toBe(false);

    answerAll(workers);
    expect(called).toEqual(['second']);
  });

  it('answers an edit that keeps the structure with the search already under way', () => {
    const { planner, workers } = setupLarge();
    const called: string[] = [];
    planner.whenPlanned(large('node extra_e "E"'), () => called.push('old'), true);
    planner.whenPlanned(large('node extra_e "Renamed"'), () => called.push('new'));
    expect(workers).toHaveLength(1);
    answerAll(workers);
    expect(called).toEqual(['new']);
    expect(workers.some((w) => w.terminated)).toBe(false);
  });

  it('calls nothing back after cancel, and starts no search that was waiting', () => {
    const { planner, workers } = setupLarge();
    let ready = 0;
    planner.whenPlanned(large('node extra_f'), () => ready++);
    planner.cancel();
    vi.advanceTimersByTime(SETTLE_MS);
    expect(workers).toHaveLength(0);

    planner.whenPlanned(large('node extra_f'), () => ready++, true);
    planner.cancel();
    workers[0]?.answer();
    expect(ready).toBe(0);
  });

  it('searches here, and stops using the worker, when the worker fails on a large diagram', () => {
    const doc = large('node extra_j');
    const { planner, workers } = setupLarge();
    let ready = 0;
    planner.whenPlanned(doc, () => ready++, true);
    workers[0]?.onerror?.(new Error('blocked'));
    expect(ready).toBe(1);
    expect(workers[0]?.terminated).toBe(true);
    expect(pendingZoneSearch(doc)).toBeUndefined();

    planner.whenPlanned(searched('node extra_k "K"'), () => ready++);
    expect(ready).toBe(2);
    expect(workers).toHaveLength(1);
  });

  describe('the life of its worker', () => {
    const alive = (workers: readonly FakeWorker[]) => workers.filter((w) => !w.terminated);

    it('ends the worker and every timer when it is disposed of during a search', () => {
      const { planner, workers } = setupLarge();
      let ready = 0;
      planner.whenPlanned(large('node life_a'), () => ready++, true);
      planner.dispose();
      expect(alive(workers)).toEqual([]);
      expect(vi.getTimerCount()).toBe(0);
      for (const worker of workers) worker.answer();
      expect(ready).toBe(0);
    });

    it('starts no search that was waiting when it is disposed of', () => {
      const { planner, workers } = setupLarge();
      planner.whenPlanned(large('node life_b'), () => {});
      planner.dispose();
      expect(vi.getTimerCount()).toBe(0);
      vi.advanceTimersByTime(SETTLE_MS);
      expect(workers).toHaveLength(0);
    });

    it('searches here what is planned after it was disposed of, the same diagram too', () => {
      const doc = searched('node life_c "C"');
      const { planner, workers } = setupLarge();
      let ready = 0;
      planner.whenPlanned(doc, () => ready++);
      planner.dispose();
      // The worker that was at this very diagram is gone: its answer must not be waited for.
      planner.whenPlanned(doc, () => ready++);
      expect(ready).toBe(1);
      expect(workers).toHaveLength(1);
      expect(pendingZoneSearch(doc)).toBeUndefined();
    });

    it('searches here, when its time comes, what was waiting as the worker failed', () => {
      const doc = large('node life_d');
      const { planner, workers } = setupLarge();
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

    it('ignores stale answers after cancel', () => {
      const first = large('node life_i1');
      const second = large('node life_i2');
      const { planner, workers } = setupLarge();
      let ready = 0;
      planner.whenPlanned(first, () => ready++, true);
      planner.cancel();
      planner.whenPlanned(second, () => ready++, true);
      // First answer is for the cancelled first job; second is for the queued second job.
      workers[0]?.answer();
      expect(ready).toBe(0);
      expect(pendingZoneSearch(second)).toBeDefined();

      answerAll(workers);
      expect(ready).toBe(1);
    });

    it('keeps at most one alive worker and one timer, however often the diagram changes', () => {
      const { planner, workers } = setupLarge();
      for (let i = 0; i < 20; i++) {
        planner.whenPlanned(large(`node life_l${i}`), () => {}, i % 2 === 0);
        vi.advanceTimersByTime(i % 3 === 0 ? SETTLE_MS : 10);
        expect(alive(workers).length).toBeLessThanOrEqual(1);
        expect(vi.getTimerCount()).toBeLessThanOrEqual(1);
      }
      planner.dispose();
      expect(alive(workers)).toEqual([]);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('goes on waiting for the text to settle through an edit that keeps the structure', () => {
      const { planner, workers } = setupLarge();
      const called: string[] = [];
      planner.whenPlanned(large('node life_q "Q"'), () => called.push('old'));
      vi.advanceTimersByTime(SETTLE_MS - 50);
      planner.whenPlanned(large('node life_q "Renamed"'), () => called.push('new'));
      vi.advanceTimersByTime(50);
      expect(workers).toHaveLength(1);
      answerAll(workers);
      expect(called).toEqual(['new']);
    });

    it('drops a search that was waiting, for a diagram that needs none', () => {
      const { planner, workers } = setupLarge();
      const called: string[] = [];
      planner.whenPlanned(large('node life_r'), () => called.push('large'));
      planner.whenPlanned(plain, () => called.push('plain'));
      expect(called).toEqual(['plain']);
      vi.advanceTimersByTime(SETTLE_MS);
      expect(workers).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('starts immediately when urgent=true matches a settling job with the same structureKey', () => {
      const { planner, workers } = setupLarge();
      const called: string[] = [];
      planner.whenPlanned(large('node life_u "U1"'), () => called.push('first'), false);
      expect(workers).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(1);

      planner.whenPlanned(large('node life_u "U2"'), () => called.push('urgent'), true);
      expect(workers).toHaveLength(1);
      expect(vi.getTimerCount()).toBe(0);

      answerAll(workers);
      expect(called).toEqual(['urgent']);
      vi.advanceTimersByTime(SETTLE_MS);
      expect(workers[0]?.posted).toHaveLength(1);
    });
  });
});

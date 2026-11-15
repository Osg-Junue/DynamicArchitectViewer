import {
  adoptZonePlan,
  pendingZoneSearch,
  pickSeedSearch,
  type SeedSearch,
  searchZones,
  ZONE_SEARCH_SEEDS,
  type ZoneSearch,
} from '../layout';
import type { DavDocument } from '../model/types';
import type { ZoneSearchRequest, ZoneSearchResult } from './zoneSearch.worker';

/** The part of a `Worker` the planner uses, so that a test can stand in for it. */
export interface SearchWorker {
  postMessage(request: ZoneSearchRequest): void;
  onmessage: ((event: { data: ZoneSearchResult }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  terminate(): void;
}

/**
 * From this many links between zones on, the seeds of a search run side by side. A diagram of
 * a hundred nodes has about 40 and is searched in under 200 ms; one of three hundred has 120
 * and takes over a second in one worker.
 */
export const SPREAD_FROM_LINKS = 50;
/** How long the text has to stay as it is before such a search starts, while a diagram is shown. */
export const SETTLE_MS = 200;
/** How long the workers made for such a search are kept after the last one. */
export const REST_MS = 30_000;

interface Job {
  search: ZoneSearch;
  /** `null` once nobody waits for the answer any more. */
  ready: (() => void) | null;
}

/** A search whose seeds run side by side, each in a worker of its own. */
interface Spread {
  job: Job;
  /** Seeds no worker has been given yet. */
  waiting: number[];
  found: Map<number, SeedSearch>;
  busy: Set<SearchWorker>;
}

/**
 * Keeps the search for where the zones go off the main thread. On a diagram of a hundred nodes
 * it takes about 200 ms and on three hundred over a second, and it runs again
 * whenever the structure changes, which while typing an ID is every keystroke.
 *
 * `whenPlanned` calls back once `computeLayout` answers for the diagram without searching: at
 * once for most diagrams and most edits, and otherwise after a worker has searched. Only the
 * latest diagram matters: an earlier one that is still waiting is dropped, and never called back.
 * Without a worker the search runs here, as it did before.
 *
 * A search of a large diagram (`SPREAD_FROM_LINKS`) is spread over several workers, one seed
 * each, and comes to the same answer in a fraction of the time. It costs the processor as much
 * as before, all at once, so it is kept to when it is wanted:
 * - with nothing on screen it starts at once; with a diagram shown, only when the text has
 *   stayed as it is for `SETTLE_MS`, so typing starts none;
 * - one that a newer diagram has made pointless is stopped, by ending its workers;
 * - the workers made for it end `REST_MS` after the last such search. One stays, as before.
 */
export class ZonePlanner {
  readonly #createWorker: () => SearchWorker;
  /** How many workers a spread search may use; below two there is no point in spreading. */
  readonly #spreadOver: number;
  /** `null` once a worker could not be made or failed: the search then stays on this thread. */
  #worker: SearchWorker | null | undefined;
  /** Workers beside that one, made for a spread search. They are busy only during one. */
  #extras: SearchWorker[] = [];
  /** What the worker is searching whole. It cannot be interrupted, only ignored. */
  #running: Job | null = null;
  #next: Job | null = null;
  #spread: Spread | null = null;
  /** A spread search that waits for the text to settle. */
  #settling: { job: Job; timer: ReturnType<typeof setTimeout> } | null = null;
  #rest: ReturnType<typeof setTimeout> | undefined;

  /** `cores` is how many the machine has: one is left to the page. */
  constructor(
    createWorker: () => SearchWorker,
    cores: number = globalThis.navigator?.hardwareConcurrency ?? 1,
  ) {
    this.#createWorker = createWorker;
    this.#spreadOver = Math.min(ZONE_SEARCH_SEEDS.length, cores - 1);
  }

  /** `urgent` when nothing is on screen until this diagram is: its search then starts at once. */
  whenPlanned(doc: DavDocument, ready: () => void, urgent = false): void {
    const search = pendingZoneSearch(doc);
    // An edit that left the structure alone: the search under way answers this one too.
    const same = search ? this.#underWay(search.key) : null;
    this.#drop(same);
    if (!search) {
      ready();
      return;
    }
    if (same) {
      same.ready = ready;
      return;
    }
    const job: Job = { search, ready };
    if (this.#spreads(search)) {
      if (urgent) this.#spreadOut(job);
      else {
        const timer = setTimeout(() => {
          this.#settling = null;
          this.#spreadOut(job);
        }, SETTLE_MS);
        this.#settling = { job, timer };
      }
      return;
    }
    const worker = this.#workerOrNull();
    if (!worker) this.#searchHere(job);
    else if (this.#running) this.#next = job;
    else this.#start(worker, job);
  }

  /** Drops what has not been answered yet; `ready` is not called for it. */
  cancel(): void {
    this.#drop(null);
  }

  /** Ends every worker for good. A diagram that is planned after this is searched here. */
  dispose(): void {
    this.cancel();
    clearTimeout(this.#rest);
    this.#endAll();
    // What the first worker was at went with it: nothing may wait for that answer again.
    this.#running = null;
  }

  #spreads(search: ZoneSearch): boolean {
    return this.#worker !== null && this.#spreadOver >= 2 && search.links >= SPREAD_FROM_LINKS;
  }

  #underWay(key: string): Job | null {
    for (const job of [this.#running, this.#spread?.job, this.#settling?.job]) {
      if (job?.search.key === key) return job;
    }
    return null;
  }

  /** Gives up everything not answered yet, but for the search `keep` if it is among it. */
  #drop(keep: Job | null): void {
    this.#next = null;
    if (this.#running && this.#running !== keep) this.#running.ready = null;
    if (this.#settling && this.#settling.job !== keep) {
      clearTimeout(this.#settling.timer);
      this.#settling = null;
    }
    if (this.#spread && this.#spread.job !== keep) this.#stopSpread(this.#spread);
  }

  #make(): SearchWorker {
    const worker = this.#createWorker();
    worker.onmessage = (event) => this.#answered(worker, event.data);
    // For instance under a content security policy that does not allow workers.
    worker.onerror = () => this.#giveUpOnWorkers();
    return worker;
  }

  /** Ends a worker, which must not be heard of again: an error of it would end the others too. */
  #end(worker: SearchWorker): void {
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
  }

  /** Ends every worker, and has no other made. */
  #endAll(): void {
    for (const worker of [this.#worker, ...this.#extras]) {
      if (worker) this.#end(worker);
    }
    this.#worker = null;
    this.#extras = [];
  }

  #workerOrNull(): SearchWorker | null {
    if (this.#worker === undefined) {
      try {
        this.#worker = this.#make();
      } catch {
        this.#worker = null;
      }
    }
    return this.#worker;
  }

  #start(worker: SearchWorker, job: Job): void {
    this.#running = job;
    worker.postMessage(job.search);
  }

  #answered(worker: SearchWorker, result: ZoneSearchResult): void {
    if (result.seed === undefined) this.#finish(result);
    else this.#found(worker, result.seed, result);
  }

  #finish(result: ZoneSearchResult): void {
    const job = this.#running;
    const next = this.#next;
    this.#running = null;
    this.#next = null;
    if (next && this.#worker) this.#start(this.#worker, next);
    // It was at a search that had been dropped when a spread one started: now it can join in.
    else if (this.#spread && this.#worker) this.#giveSeed(this.#spread, this.#worker);
    // The layout remembers one plan: one that nobody waits for would push out the one in use.
    if (!job?.ready || job.search.key !== result.key) return;
    adoptZonePlan(result.key, result.placement);
    job.ready();
  }

  /** The workers that are free for a spread search, made up to the number it may use. */
  #free(first: SearchWorker): SearchWorker[] {
    try {
      while (1 + this.#extras.length < this.#spreadOver) this.#extras.push(this.#make());
    } catch {
      // Fewer workers than wanted: the search is spread over those there are.
    }
    // The first may still be at a search that was dropped, which it cannot leave. It takes
    // seeds once it has answered (see `#finish`): all of them, if no other worker could be made.
    return this.#running ? [...this.#extras] : [first, ...this.#extras];
  }

  #spreadOut(job: Job): void {
    const first = this.#workerOrNull();
    if (!first) {
      this.#searchHere(job);
      return;
    }
    clearTimeout(this.#rest);
    const spread: Spread = {
      job,
      waiting: [...ZONE_SEARCH_SEEDS],
      found: new Map(),
      busy: new Set(),
    };
    this.#spread = spread;
    for (const worker of this.#free(first)) this.#giveSeed(spread, worker);
  }

  #giveSeed(spread: Spread, worker: SearchWorker): void {
    const seed = spread.waiting.shift();
    if (seed === undefined) return;
    spread.busy.add(worker);
    worker.postMessage({ ...spread.job.search, seed });
  }

  #found(worker: SearchWorker, seed: number, result: ZoneSearchResult): void {
    const spread = this.#spread;
    if (!spread?.busy.has(worker) || result.key !== spread.job.search.key) return;
    spread.busy.delete(worker);
    spread.found.set(seed, {
      score: result.score ?? Number.POSITIVE_INFINITY,
      placement: result.placement,
    });
    this.#giveSeed(spread, worker);
    if (spread.busy.size > 0) return;
    this.#spread = null;
    this.#restLater();
    adoptZonePlan(result.key, pickSeedSearch(spread.found));
    spread.job.ready?.();
  }

  /** Ends the workers that are at the search: nothing else stops them. New ones are made when needed. */
  #stopSpread(spread: Spread): void {
    for (const worker of spread.busy) {
      this.#end(worker);
      if (worker === this.#worker) this.#worker = undefined;
    }
    this.#extras = this.#extras.filter((worker) => !spread.busy.has(worker));
    this.#spread = null;
    this.#restLater();
  }

  #restLater(): void {
    clearTimeout(this.#rest);
    this.#rest = setTimeout(() => {
      // A search that waits for the text to settle is about to use them.
      if (this.#settling) {
        this.#restLater();
        return;
      }
      for (const worker of this.#extras) this.#end(worker);
      this.#extras = [];
    }, REST_MS);
  }

  #giveUpOnWorkers(): void {
    this.#endAll();
    // A search that waits for the text to settle finds no worker when its time comes.
    const job = [this.#spread?.job, this.#next, this.#running].find((j) => j?.ready);
    this.#spread = null;
    this.#running = null;
    this.#next = null;
    if (job) this.#searchHere(job);
  }

  #searchHere(job: Job): void {
    adoptZonePlan(job.search.key, searchZones(job.search.doc));
    job.ready?.();
  }
}

import { adoptZonePlan, pendingZoneSearch, searchZones, type ZoneSearch } from '../layout';
import type { DavDocument } from '../model/types';
import type { ZoneSearchResult } from './zoneSearch.worker';

/** The part of a `Worker` the planner uses, so that a test can stand in for it. */
export interface SearchWorker {
  postMessage(search: ZoneSearch): void;
  onmessage: ((event: { data: ZoneSearchResult }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  terminate(): void;
}

interface Job {
  search: ZoneSearch;
  /** `null` once nobody waits for the answer any more. */
  ready: (() => void) | null;
}

/**
 * Keeps the search for where the zones go off the main thread. On a diagram of a hundred nodes
 * it takes about 150 ms and on three hundred over a second, and it runs again whenever the
 * structure changes, which while typing an ID is every keystroke.
 *
 * `whenPlanned` calls back once `computeLayout` answers for the diagram without searching: at
 * once for most diagrams and most edits, and otherwise after the worker has searched. Only the
 * latest diagram matters: an earlier one that is still waiting is dropped, and never called back.
 * Without a worker the search runs here, as it did before.
 */
export class ZonePlanner {
  readonly #createWorker: () => SearchWorker;
  /** `null` once a worker could not be made or failed: the search then stays on this thread. */
  #worker: SearchWorker | null | undefined;
  /** What the worker is searching. It cannot be interrupted, only ignored. */
  #running: Job | null = null;
  #next: Job | null = null;

  constructor(createWorker: () => SearchWorker) {
    this.#createWorker = createWorker;
  }

  whenPlanned(doc: DavDocument, ready: () => void): void {
    this.cancel();
    const search = pendingZoneSearch(doc);
    if (!search) {
      ready();
      return;
    }
    if (this.#running?.search.key === search.key) {
      // An edit that left the structure alone: the search under way answers this one too.
      this.#running.ready = ready;
      return;
    }
    const job: Job = { search, ready };
    const worker = this.#workerOrNull();
    if (!worker) this.#searchHere(job);
    else if (this.#running) this.#next = job;
    else this.#start(worker, job);
  }

  /** Drops what has not been answered yet; `ready` is not called for it. */
  cancel(): void {
    this.#next = null;
    if (this.#running) this.#running.ready = null;
  }

  dispose(): void {
    this.cancel();
    this.#worker?.terminate();
    this.#worker = null;
  }

  #workerOrNull(): SearchWorker | null {
    if (this.#worker === undefined) {
      try {
        const worker = this.#createWorker();
        worker.onmessage = (event) => this.#finish(event.data);
        // For instance under a content security policy that does not allow workers.
        worker.onerror = () => this.#giveUpOnWorker();
        this.#worker = worker;
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

  #finish(result: ZoneSearchResult): void {
    const job = this.#running;
    const next = this.#next;
    this.#running = null;
    this.#next = null;
    if (next && this.#worker) this.#start(this.#worker, next);
    // The layout remembers one plan: one that nobody waits for would push out the one in use.
    if (!job?.ready || job.search.key !== result.key) return;
    adoptZonePlan(result.key, result.placement);
    job.ready();
  }

  #giveUpOnWorker(): void {
    this.#worker?.terminate();
    this.#worker = null;
    const job = this.#next ?? this.#running;
    this.#running = null;
    this.#next = null;
    if (job?.ready) this.#searchHere(job);
  }

  #searchHere(job: Job): void {
    adoptZonePlan(job.search.key, searchZones(job.search.doc));
    job.ready?.();
  }
}

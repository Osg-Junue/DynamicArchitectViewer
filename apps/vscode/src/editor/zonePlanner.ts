import { adoptZonePlan, pendingZoneSearch, searchZones, type ZoneSearch } from '../layout';
import type { DavDocument } from '../model/types';
import type { ZoneSearchRequest, ZoneSearchResult } from './zoneSearch.worker';

/** The part of a `Worker` the planner uses, so that a test can stand in for it. */
export interface SearchWorker {
  postMessage(request: ZoneSearchRequest): void;
  onmessage: ((event: { data: ZoneSearchResult }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  terminate(): void;
}

/** From this many links between zones on, a non-urgent search waits for typing to settle. */
const SETTLE_FROM_LINKS = 50;
/** How long the text has to stay as it is before a large non-urgent search starts, while a diagram is shown. */
export const SETTLE_MS = 200;

interface Job {
  search: ZoneSearch;
  /** `null` once nobody waits for the answer any more. */
  ready: (() => void) | null;
}

/**
 * Keeps the search for where the zones go off the main thread in a single background worker.
 *
 * `whenPlanned` calls back once `computeLayout` answers for the diagram without searching: at
 * once for `<= 1` top-level group or cached diagrams, and otherwise after the worker has
 * searched. Only the latest diagram matters: an earlier one that is still waiting is dropped,
 * and never called back. Without a worker the search runs here, as it did before.
 *
 * For large diagrams (`links >= 50`), non-urgent edits wait `SETTLE_MS` so typing does not
 * queue unnecessary searches, while urgent initial opens start immediately.
 */
export class ZonePlanner {
  readonly #createWorker: () => SearchWorker;
  /** `null` once a worker could not be made or failed: the search then stays on this thread. */
  #worker: SearchWorker | null | undefined;
  /** What the worker is currently searching. It cannot be interrupted, only ignored. */
  #running: Job | null = null;
  #next: Job | null = null;
  /** A large non-urgent search waiting for the text to settle. */
  #settling: { job: Job; timer: ReturnType<typeof setTimeout> } | null = null;

  constructor(createWorker: () => SearchWorker) {
    this.#createWorker = createWorker;
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
      if (urgent && this.#settling?.job === same) {
        clearTimeout(this.#settling.timer);
        this.#settling = null;
        this.#enqueue(same);
      }
      return;
    }
    const job: Job = { search, ready };
    if (!urgent && search.links >= SETTLE_FROM_LINKS && this.#worker !== null) {
      const timer = setTimeout(() => {
        this.#settling = null;
        this.#enqueue(job);
      }, SETTLE_MS);
      this.#settling = { job, timer };
      return;
    }
    this.#enqueue(job);
  }

  /** Drops what has not been answered yet; `ready` is not called for it. */
  cancel(): void {
    this.#drop(null);
  }

  /** Ends the worker for good. A diagram that is planned after this is searched here. */
  dispose(): void {
    this.cancel();
    if (this.#worker) this.#end(this.#worker);
    this.#worker = null;
    // What the worker was at went with it: nothing may wait for that answer again.
    this.#running = null;
  }

  #underWay(key: string): Job | null {
    for (const job of [this.#running, this.#settling?.job]) {
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
  }

  #enqueue(job: Job): void {
    const worker = this.#workerOrNull();
    if (!worker) this.#searchHere(job);
    else if (this.#running) this.#next = job;
    else this.#start(worker, job);
  }

  #make(): SearchWorker {
    const worker = this.#createWorker();
    worker.onmessage = (event) => this.#finish(event.data);
    // For instance under a content security policy that does not allow workers.
    worker.onerror = () => this.#giveUpOnWorkers();
    return worker;
  }

  #end(worker: SearchWorker): void {
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
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

  #giveUpOnWorkers(): void {
    if (this.#worker) this.#end(this.#worker);
    this.#worker = null;
    // A search that waits for the text to settle finds no worker when its time comes.
    const job = [this.#next, this.#running].find((j) => j?.ready);
    this.#running = null;
    this.#next = null;
    if (job) this.#searchHere(job);
  }

  #searchHere(job: Job): void {
    adoptZonePlan(job.search.key, searchZones(job.search.doc));
    job.ready?.();
  }
}

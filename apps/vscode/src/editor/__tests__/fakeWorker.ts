import { searchZones } from '../../layout';
import type { SearchWorker } from '../zonePlanner';
import type { ZoneSearchRequest } from '../zoneSearch.worker';

/** A search worker that answers when the test says so. */
export class FakeWorker implements SearchWorker {
  onmessage: SearchWorker['onmessage'] = null;
  onerror: SearchWorker['onerror'] = null;
  posted: ZoneSearchRequest[] = [];
  /** How many of `posted` have been answered. */
  answered = 0;
  terminated = false;
  readonly #searches: boolean;

  /** Without `searches` it answers that the zones stay, at once: for tests of who is asked what. */
  constructor(searches = true) {
    this.#searches = searches;
  }

  postMessage(request: ZoneSearchRequest): void {
    this.posted.push(request);
  }

  /** Whether the worker was asked for something it has not answered. */
  get busy(): boolean {
    return !this.terminated && this.answered < this.posted.length;
  }

  /** Answers the request posted last, as the real worker does. */
  answer(): void {
    const request = this.posted.at(-1);
    if (!request) throw new Error('nothing was posted');
    this.answered = this.posted.length;
    const { key, doc } = request;
    this.onmessage?.({
      data: { key, placement: this.#searches ? searchZones(doc) : undefined },
    });
  }

  terminate(): void {
    this.terminated = true;
  }
}

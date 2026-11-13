import { searchZones, type ZoneSearch } from '../../layout';
import type { SearchWorker } from '../zonePlanner';

/** A search worker that answers when the test says so. */
export class FakeWorker implements SearchWorker {
  onmessage: SearchWorker['onmessage'] = null;
  onerror: SearchWorker['onerror'] = null;
  posted: ZoneSearch[] = [];
  terminated = false;

  postMessage(search: ZoneSearch): void {
    this.posted.push(search);
  }

  /** Answers the search posted last, as the real worker does. */
  answer(): void {
    const search = this.posted.at(-1);
    if (!search) throw new Error('nothing was posted');
    this.onmessage?.({ data: { key: search.key, placement: searchZones(search.doc) } });
  }

  terminate(): void {
    this.terminated = true;
  }
}

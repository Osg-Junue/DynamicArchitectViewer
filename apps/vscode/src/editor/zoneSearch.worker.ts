import { searchZones, searchZonesFrom, type ZonePlacement, type ZoneSearch } from '../layout';

/** What the worker is asked for: the whole search, or with `seed` the part that one seed does. */
export type ZoneSearchRequest = ZoneSearch & { seed?: number };

/** What the worker answers: the search it was given, by its key, and where the zones go. */
export interface ZoneSearchResult {
  key: string;
  placement: ZonePlacement | undefined;
  /** For the part of one seed: which seed, and how good what it found is. */
  seed?: number;
  score?: number;
}

// The search is the one part of the layout that takes long enough to stall the preview.
addEventListener('message', (event: MessageEvent<ZoneSearchRequest>) => {
  const { key, doc, seed } = event.data;
  const result: ZoneSearchResult =
    seed === undefined
      ? { key, placement: searchZones(doc) }
      : { key, seed, ...searchZonesFrom(doc, seed) };
  (postMessage as (message: ZoneSearchResult) => void)(result);
});

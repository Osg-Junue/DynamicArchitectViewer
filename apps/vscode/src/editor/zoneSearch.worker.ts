import { searchZones, type ZonePlacement, type ZoneSearch } from '../layout';

/** What the worker answers: the search it was given, by its key, and where the zones go. */
export interface ZoneSearchResult {
  key: string;
  placement: ZonePlacement | undefined;
}

// The search is the one part of the layout that takes long enough to stall the preview.
addEventListener('message', (event: MessageEvent<ZoneSearch>) => {
  const { key, doc } = event.data;
  const result: ZoneSearchResult = { key, placement: searchZones(doc) };
  (postMessage as (message: ZoneSearchResult) => void)(result);
});

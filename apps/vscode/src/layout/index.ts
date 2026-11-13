import type { DavDocument } from '../model/types';
import { computeColumnLayout } from './columns';
import { countCrossings } from './links';
import type { Layout } from './metrics';
import {
  applyZonePlacement,
  hasZonesToPlace,
  LONG_LINK,
  longLinkExcess,
  searchZonePlacement,
  structureKey,
  withoutLabels,
  type ZonePlacement,
} from './zoned';

export { countCrossings } from './links';
export {
  type Layout,
  NODE_SIZE,
  type Rect,
  rectContains,
  rectOverlaps,
  STATION_SIZE,
  stationRect,
  WINDOW_SIZE,
} from './metrics';
export type { ZonePlacement } from './zoned';

/**
 * Computes automatic positions and sizes for every node and group.
 *
 * - Nodes are placed left-to-right by longest-path rank over the edges (cycles are broken),
 *   ordered within a column by the barycenter of their predecessors.
 * - Sibling groups and ungrouped columns whose rank spans do not overlap are placed
 *   side-by-side horizontally; overlapping spans stack into vertical bands.
 * - Every group wraps its descendants (plus header and padding).
 * - The vertical order is then refined by barycenter sweeps. A result is kept only if it has
 *   fewer crossings, or as many with shorter rails, so refinement never makes a diagram worse.
 *
 * When that leaves links too long, placing the zones freely is tried as well, and kept only
 * if it shortens them by more than the crossings it adds are worth (see `searchZones`).
 */
export function computeLayout(doc: DavDocument): Layout {
  const search = pendingZoneSearch(doc);
  if (search) adoptZonePlan(search.key, searchZones(search.doc));
  const placement = hasZonesToPlace(doc) ? zonePlan?.placement : undefined;
  return placement
    ? applyZonePlacement(doc, placement, computeColumnLayout)
    : computeColumnLayout(doc);
}

/** The last answer: most edits do not change the structure the placement depends on. */
let zonePlan: { key: string; placement: ZonePlacement | undefined } | undefined;

/** A search for where to place the zones of a diagram, to hand to `searchZones`. */
export interface ZoneSearch {
  key: string;
  /**
   * The diagram without labels, so that the layout stays a function of the file alone while
   * typing a label cannot rearrange anything.
   */
  doc: DavDocument;
}

/**
 * The search `computeLayout` would have to run for this diagram before it can answer, which
 * takes a noticeable moment on a large one; `undefined` when it answers at once. A caller that
 * must not wait runs `searchZones` elsewhere and hands the result to `adoptZonePlan`.
 */
export function pendingZoneSearch(doc: DavDocument): ZoneSearch | undefined {
  if (!hasZonesToPlace(doc)) return undefined;
  const key = structureKey(doc);
  if (zonePlan?.key === key) return undefined;
  const bare = withoutLabels(doc);
  // Most diagrams have no link long enough to move a zone for, and that is quick to see.
  if (longLinkExcess(bare, computeColumnLayout(bare)) > 0) return { key, doc: bare };
  zonePlan = { key, placement: undefined };
  return undefined;
}

export function adoptZonePlan(key: string, placement: ZonePlacement | undefined): void {
  zonePlan = { key, placement };
}

/** Decides whether and where to move the zones of a diagram that has links too long. */
export function searchZones(doc: DavDocument): ZonePlacement | undefined {
  const columns = computeColumnLayout(doc);
  const placement = searchZonePlacement(doc, computeColumnLayout);
  const zoned = applyZonePlacement(doc, placement, computeColumnLayout);
  // A crossing is worth one link that is a whole comfortable length too long: placing the
  // zones freely may add one where it saves more than that, and not otherwise.
  const burden = (layout: Layout): number =>
    longLinkExcess(doc, layout) + countCrossings(doc, layout) * LONG_LINK;
  return burden(zoned) < burden(columns) ? placement : undefined;
}

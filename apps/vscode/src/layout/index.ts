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
 * if it shortens them by more than the crossings it adds are worth (see `planZones`).
 */
export function computeLayout(doc: DavDocument): Layout {
  if (!hasZonesToPlace(doc)) return computeColumnLayout(doc);
  // The search takes a noticeable moment; most edits do not change the structure.
  const key = structureKey(doc);
  if (zonePlan?.key !== key) zonePlan = { key, placement: planZones(withoutLabels(doc)) };
  const { placement } = zonePlan;
  return placement
    ? applyZonePlacement(doc, placement, computeColumnLayout)
    : computeColumnLayout(doc);
}

let zonePlan: { key: string; placement: ZonePlacement | undefined } | undefined;

/**
 * Decides whether and where to move the zones. Given a diagram without labels, so that the
 * layout stays a function of the file alone while typing a label cannot rearrange anything.
 */
function planZones(doc: DavDocument): ZonePlacement | undefined {
  const columns = computeColumnLayout(doc);
  const excess = longLinkExcess(doc, columns);
  if (excess === 0) return undefined;
  const placement = searchZonePlacement(doc, computeColumnLayout);
  const zoned = applyZonePlacement(doc, placement, computeColumnLayout);
  // A crossing is worth one link that is a whole comfortable length too long: placing the
  // zones freely may add one where it saves more than that, and not otherwise.
  const burden = (layout: Layout): number =>
    longLinkExcess(doc, layout) + countCrossings(doc, layout) * LONG_LINK;
  return burden(zoned) < burden(columns) ? placement : undefined;
}

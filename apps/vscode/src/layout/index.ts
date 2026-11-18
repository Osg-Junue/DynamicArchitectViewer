import { synthesizedConnections } from '../model/connections';
import type { DavDocument } from '../model/types';
import { topLevelGroups } from '../model/zones';
import { computeColumnLayout } from './columns';
import { countCrossings } from './links';
import type { Layout } from './metrics';
import { type BackEdge, computeRanks } from './ranks';
import { straightenNodes } from './straightenNodes';
import {
  applyZonePlacement,
  bestOfSeeds,
  hasZonesToPlace,
  LONG_LINK,
  linksBetweenZones,
  longLinkExcess,
  ownersOf,
  SEEDS,
  searchZonePlacement,
  searchZonePlacementFrom,
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
export type { BackEdge } from './ranks';
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
 * - Last, a node that stands a little off a node it is linked to moves inside its frame to
 *   stand level with it, or straight above it (see `straightenNodes`).
 *
 * When that leaves links too long or links that cross, placing the zones freely is tried as
 * well, and kept only if the long links and crossings it leaves weigh less (see `searchZones`).
 */
export function computeLayout(doc: DavDocument): Layout {
  const placement = zonePlacementOf(doc);
  const placed = placement
    ? applyZonePlacement(doc, placement, computeColumnLayout)
    : computeColumnLayout(doc);
  return straightenNodes(doc, placed);
}

/** Whether `computeLayout` places the zones of a diagram freely, rather than in shared columns. */
export function zonesPlacedFreely(doc: DavDocument): boolean {
  return zonePlacementOf(doc) !== undefined;
}

/** Where the zones are placed freely, searched for first if need be; `undefined` in columns. */
function zonePlacementOf(doc: DavDocument): ZonePlacement | undefined {
  const search = pendingZoneSearch(doc);
  if (search) adoptZonePlan(search.key, searchZones(search.doc));
  return hasZonesToPlace(doc) ? zonePlan?.placement : undefined;
}

/**
 * The edges that set no column because each closes a loop, in the arrangement `computeLayout`
 * draws. In columns, they are those of the whole diagram. Where the zones are placed freely,
 * each zone is laid out on its own and a link between zones sets no column at all, so they are
 * those of the loops inside each zone.
 */
export function backEdgesOf(doc: DavDocument): BackEdge[] {
  const ids = doc.nodes.map((n) => n.id);
  // Ranks leave out an edge with an end outside the nodes they are given.
  const edges = synthesizedConnections(doc).map((e): readonly [string, string] => [e.from, e.to]);
  if (!zonePlacementOf(doc)) return computeRanks(ids, edges).back;
  const owners = ownersOf(doc);
  return topLevelGroups(doc.groups).flatMap(
    (zone) =>
      computeRanks(
        ids.filter((id) => owners.get(id) === zone.id),
        edges,
      ).back,
  );
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
  /** How many links run between zones: the time the search takes grows with them. */
  links: number;
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
  const columns = computeColumnLayout(bare);
  // Most diagrams have no link long enough to move a zone for and no crossing to take out,
  // and that is quick to see. A diagram whose zones are linked across one another can have
  // short links and still cross where its zones stand in shared columns.
  if (longLinkExcess(bare, columns) > 0 || countCrossings(bare, columns) > 0) {
    return { key, doc: bare, links: linksBetweenZones(bare) };
  }
  zonePlan = { key, placement: undefined };
  return undefined;
}

export function adoptZonePlan(key: string, placement: ZonePlacement | undefined): void {
  zonePlan = { key, placement };
}

/** Decides whether and where to move the zones of a diagram that has links too long or crossing. */
export function searchZones(doc: DavDocument): ZonePlacement | undefined {
  return ifWorthMoving(doc, searchZonePlacement(doc, computeColumnLayout));
}

/** The seeds `searchZones` runs, which `searchZonesFrom` takes one at a time. */
export const ZONE_SEARCH_SEEDS = SEEDS;

/** What one seed of the search found: where the zones go, if at all, and how good that is. */
export interface SeedSearch {
  /** The lower, the better. */
  score: number;
  placement: ZonePlacement | undefined;
}

/**
 * The part of `searchZones` that one seed does, for a caller that runs the seeds side by side
 * and takes the answer of them all from `pickSeedSearch`.
 */
export function searchZonesFrom(doc: DavDocument, seed: number): SeedSearch {
  const { score, placement } = searchZonePlacementFrom(doc, computeColumnLayout, seed);
  return { score, placement: ifWorthMoving(doc, placement) };
}

/** What `searchZones` answers, from what `searchZonesFrom` found for every seed. */
export function pickSeedSearch(found: ReadonlyMap<number, SeedSearch>): ZonePlacement | undefined {
  return bestOfSeeds(found)?.placement;
}

function ifWorthMoving(doc: DavDocument, placement: ZonePlacement): ZonePlacement | undefined {
  const columns = computeColumnLayout(doc);
  const zoned = applyZonePlacement(doc, placement, computeColumnLayout);
  // A crossing is worth one link that is a whole comfortable length too long: placing the
  // zones freely may add one where it saves more than that, and not otherwise.
  const burden = (layout: Layout): number =>
    longLinkExcess(doc, layout) + countCrossings(doc, layout) * LONG_LINK;
  return burden(zoned) < burden(columns) ? placement : undefined;
}

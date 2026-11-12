import { type Rect, rectOverlaps } from '../layout';
import {
  type CalloutPlacement,
  calloutRect,
  type PacketCalloutBox,
  placeCalloutBox,
} from './callout';
import {
  CALLOUT_GAP,
  CALLOUT_LABEL_CLEARANCE,
  type MeasuredCalloutCard,
  measureCalloutCard,
} from './calloutMeasure';
import { expandRect, type Point, pointAt, pointInRect, segmentIntersectsRect } from './geometry';
import type { Packet } from './resolve';

/** Past the clash limit, because landing exactly on it would depend on rounding. */
const CALLOUT_SHIFT_SLACK = 1;
const PARALLEL_SHELF_TOLERANCE = 48;

const POCKET_MIN_MAX_SHIFT = 200;
const SHIFT_COST_WEIGHT = 0.65;
const OFF_CARD_SHIFT_WEIGHT = 2.5;
const LEADER_CROSSING_PENALTY = 120;
const GROUP_TRAVERSAL_PENALTY = 240;
const DIMMED_OVERLAP_PENALTY = 240;
const RAIL_OVERLAP_PENALTY = 500;
const RAIL_CLEARANCE_PAD = 14;
const DEFAULT_BELOW_BIAS = 40;
const PREFER_BELOW_ABOVE_BIAS = 14;
const CLASH_PENALTY = 1_000_000;
const RAIL_SAMPLE_TS = [0, 0.25, 0.5, 0.75, 1] as const;

function countRailOverlaps(box: PacketCalloutBox, otherRailSamples: readonly Point[]): number {
  if (otherRailSamples.length === 0) return 0;
  const padded = expandRect(calloutRect(box), RAIL_CLEARANCE_PAD);
  let hits = 0;
  for (const sample of otherRailSamples) {
    if (pointInRect(sample, padded)) hits++;
  }
  return hits;
}

function countDimmedOverlaps(packet: Packet, box: PacketCalloutBox): number {
  const areas = packet.dimmedNodeAreas;
  if (!areas || areas.length === 0) return 0;
  const rect = calloutRect(box);
  let hits = 0;
  for (const area of areas) {
    if (rectOverlaps(rect, area)) hits++;
  }
  return hits;
}

function scoreCallout(
  packet: Packet,
  box: PacketCalloutBox,
  mid: Point,
  otherRailSamples: readonly Point[],
): number {
  const anchorY = box.placement === 'above' ? box.boxBottom : box.boxTop;
  const verticalDist = Math.abs(anchorY - mid.y);
  const horizOffset = Math.abs(box.cx - mid.x);
  const offCardExcess = Math.max(0, horizOffset - box.halfW);
  const shiftCost = horizOffset * SHIFT_COST_WEIGHT + offCardExcess * OFF_CARD_SHIFT_WEIGHT;

  const anchor: Point = { x: box.cx, y: anchorY };
  let crossingCost = 0;
  if (packet.otherNodeCores !== undefined) {
    const p20 = pointAt(packet.path, 0.2);
    const p80 = pointAt(packet.path, 0.8);
    for (const core of packet.otherNodeCores) {
      if (
        segmentIntersectsRect(anchor, mid, core) ||
        segmentIntersectsRect(anchor, p20, core) ||
        segmentIntersectsRect(anchor, p80, core)
      ) {
        crossingCost += LEADER_CROSSING_PENALTY;
      }
    }
  } else {
    for (const core of packet.nodeCores ?? []) {
      if (segmentIntersectsRect(anchor, mid, core)) {
        crossingCost += LEADER_CROSSING_PENALTY;
      }
    }
  }

  let groupTraversals = 0;
  const minSegY = Math.min(anchorY, mid.y);
  const maxSegY = Math.max(anchorY, mid.y);
  for (const g of packet.groupRects ?? []) {
    const innerTop = g.y + 34;
    const innerBottom = g.y + g.height - 16;
    if (innerBottom <= innerTop || minSegY >= innerTop || maxSegY <= innerBottom) continue;
    const isMultiRowOrDetached =
      g.height > 220 || Math.max(g.y - minSegY, maxSegY - (g.y + g.height)) > 36;
    if (!isMultiRowOrDetached) continue;
    const body: Rect = {
      x: g.x - 12,
      y: innerTop,
      width: g.width + 24,
      height: innerBottom - innerTop,
    };
    if (segmentIntersectsRect(anchor, mid, body)) {
      groupTraversals++;
    }
  }

  const dimmedBodyOverlaps = countDimmedOverlaps(packet, box);
  const railOverlaps = countRailOverlaps(box, otherRailSamples);

  const placementBias =
    box.placement === 'below'
      ? packet.preferBelow
        ? 0
        : DEFAULT_BELOW_BIAS
      : packet.preferBelow
        ? PREFER_BELOW_ABOVE_BIAS
        : 0;

  return (
    verticalDist +
    shiftCost +
    crossingCost +
    groupTraversals * GROUP_TRAVERSAL_PENALTY +
    dimmedBodyOverlaps * DIMMED_OVERLAP_PENALTY +
    railOverlaps * RAIL_OVERLAP_PENALTY +
    placementBias
  );
}

function setPacketShift(packet: Packet, shift: number): void {
  if (Math.abs(shift) > 1e-6) packet.calloutShift = shift;
  else delete packet.calloutShift;
}

function applyCalloutChoice(packet: Packet, placement: CalloutPlacement, shift: number): void {
  if (packet.clearBottom !== undefined || placement === 'below') {
    packet.calloutPlacement = placement;
  } else {
    delete packet.calloutPlacement;
  }
  delete packet.calloutBottom;
  delete packet.calloutTop;
  setPacketShift(packet, shift);
}

interface SoloCandidate {
  placement: CalloutPlacement;
  shift: number;
  box: PacketCalloutBox;
  score: number;
}

function bestPocketCandidate(
  packet: Packet,
  card: MeasuredCalloutCard,
  placement: CalloutPlacement,
  mid: Point,
  otherRailSamples: readonly Point[],
): SoloCandidate {
  const maxPocketShift = Math.max(POCKET_MIN_MAX_SHIFT, card.halfW + 24);
  const shifts: number[] = [0];
  for (const area of packet.labelAreas) {
    const overlapsHoriz = mid.x - card.halfW < area.x + area.width && mid.x + card.halfW > area.x;
    if (!overlapsHoriz) continue;
    const leftShift = area.x - CALLOUT_LABEL_CLEARANCE - card.halfW - mid.x;
    if (Math.abs(leftShift) <= maxPocketShift) shifts.push(leftShift);
    const rightShift = area.x + area.width + CALLOUT_LABEL_CLEARANCE + card.halfW - mid.x;
    if (Math.abs(rightShift) <= maxPocketShift) shifts.push(rightShift);
  }

  packet.calloutPlacement = placement;
  delete packet.calloutBottom;
  delete packet.calloutTop;

  let best: SoloCandidate | undefined;
  for (const shift of shifts) {
    setPacketShift(packet, shift);
    const box = placeCalloutBox(packet, card, mid);
    const score = scoreCallout(packet, box, mid, otherRailSamples);
    if (
      !best ||
      score < best.score - 1e-6 ||
      (Math.abs(score - best.score) <= 1e-6 && Math.abs(shift) < Math.abs(best.shift))
    ) {
      best = { placement, shift, box, score };
    }
  }

  delete packet.calloutShift;
  if (!best) {
    const fallbackBox = placeCalloutBox(packet, card, mid);
    return {
      placement,
      shift: 0,
      box: fallbackBox,
      score: scoreCallout(packet, fallbackBox, mid, otherRailSamples),
    };
  }
  return best;
}

const verticallyOverlaps = (a: PacketCalloutBox, b: PacketCalloutBox): boolean =>
  a.boxTop < b.boxBottom + CALLOUT_GAP && a.boxBottom + CALLOUT_GAP > b.boxTop;

const calloutsClash = (a: PacketCalloutBox, b: PacketCalloutBox): boolean =>
  a.cx - a.halfW < b.cx + b.halfW + CALLOUT_GAP &&
  a.cx + a.halfW + CALLOUT_GAP > b.cx - b.halfW &&
  verticallyOverlaps(a, b);

interface CalloutEntry {
  packet: Packet;
  card: MeasuredCalloutCard;
  index: number;
  mid: Point;
  midX: number;
  tieX: number;
  otherRailSamples: Point[];
  soloAbove: SoloCandidate;
  soloBelow?: SoloCandidate;
  soloShift: number;
  box: PacketCalloutBox;
}

interface PavaBlock {
  members: CalloutEntry[];
  offsets: number[];
  leftCx: number;
  leftEdge: number;
  rightEdge: number;
}

function partitionVerticalClusters(entries: readonly CalloutEntry[]): CalloutEntry[][] {
  const visited = new Set<number>();
  const clusters: CalloutEntry[][] = [];
  for (let i = 0; i < entries.length; i++) {
    if (visited.has(i)) continue;
    const queue = [i];
    visited.add(i);
    const indices: number[] = [];
    while (queue.length > 0) {
      const cur = queue.shift();
      if (cur === undefined) continue;
      indices.push(cur);
      const curEntry = entries[cur];
      if (!curEntry) continue;
      for (let j = 0; j < entries.length; j++) {
        if (visited.has(j)) continue;
        const otherEntry = entries[j];
        if (otherEntry && verticallyOverlaps(curEntry.box, otherEntry.box)) {
          visited.add(j);
          queue.push(j);
        }
      }
    }
    indices.sort((a, b) => a - b);
    clusters.push(indices.flatMap((idx) => entries[idx] ?? []));
  }
  return clusters;
}

function buildPavaBlock(members: CalloutEntry[]): PavaBlock {
  const first = members[0];
  const last = members[members.length - 1];
  if (!first || !last) {
    return { members: [], offsets: [], leftCx: 0, leftEdge: 0, rightEdge: 0 };
  }
  if (members.length === 1) {
    const leftCx = first.midX + first.soloShift;
    return {
      members,
      offsets: [0],
      leftCx,
      leftEdge: leftCx - first.box.halfW,
      rightEdge: leftCx + first.box.halfW,
    };
  }
  const sep = CALLOUT_GAP + CALLOUT_SHIFT_SLACK;
  const offsets: number[] = [0];
  for (let i = 1; i < members.length; i++) {
    const prev = members[i - 1];
    const cur = members[i];
    const prevOff = offsets[i - 1] ?? 0;
    offsets.push(prevOff + (prev?.box.halfW ?? 0) + sep + (cur?.box.halfW ?? 0));
  }
  let sumDiff = 0;
  for (let i = 0; i < members.length; i++) {
    sumDiff += (members[i]?.midX ?? 0) - (offsets[i] ?? 0);
  }
  const leftCx = sumDiff / members.length;
  const lastOffset = offsets[offsets.length - 1] ?? 0;
  return {
    members,
    offsets,
    leftCx,
    leftEdge: leftCx - first.box.halfW,
    rightEdge: leftCx + lastOffset + last.box.halfW,
  };
}

function solvePavaCluster(cluster: readonly CalloutEntry[]): PavaBlock[] {
  const sep = CALLOUT_GAP + CALLOUT_SHIFT_SLACK;
  const stack: PavaBlock[] = [];
  for (const entry of cluster) {
    stack.push(buildPavaBlock([entry]));
    while (stack.length >= 2) {
      const right = stack[stack.length - 1];
      const left = stack[stack.length - 2];
      if (!left || !right || left.rightEdge + sep <= right.leftEdge) break;
      stack.pop();
      stack.pop();
      stack.push(buildPavaBlock([...left.members, ...right.members]));
    }
  }
  return stack;
}

function countClashes(entries: readonly CalloutEntry[]): number {
  let count = 0;
  for (let i = 0; i < entries.length; i++) {
    const a = entries[i];
    if (!a) continue;
    for (let j = i + 1; j < entries.length; j++) {
      const b = entries[j];
      if (b && calloutsClash(a.box, b.box)) count++;
    }
  }
  return count;
}

function separateSubsetByPava(subset: readonly CalloutEntry[]): void {
  if (subset.length < 2) return;
  for (let pass = 0; pass < 3; pass++) {
    const clusters = partitionVerticalClusters(subset);
    for (const cluster of clusters) {
      if (cluster.length < 2) continue;
      for (const block of solvePavaCluster(cluster)) {
        block.members.forEach((entry, i) => {
          const shift = block.leftCx + (block.offsets[i] ?? 0) - entry.midX;
          setPacketShift(entry.packet, shift);
        });
      }
    }
    for (const entry of subset) {
      entry.box = placeCalloutBox(entry.packet, entry.card, entry.mid);
    }
    if (countClashes(subset) === 0) break;
  }
}

function enumeratePlacementAssignments(entries: readonly CalloutEntry[]): CalloutPlacement[][] {
  if (entries.length > 5) {
    return [
      entries.map((e) =>
        e.soloBelow && e.soloBelow.score < e.soloAbove.score ? 'below' : 'above',
      ),
    ];
  }
  const results: CalloutPlacement[][] = [[]];
  for (const entry of entries) {
    const options: readonly CalloutPlacement[] = entry.soloBelow ? ['above', 'below'] : ['above'];
    const next: CalloutPlacement[][] = [];
    for (const prefix of results) {
      for (const opt of options) {
        next.push([...prefix, opt]);
      }
    }
    results.splice(0, results.length, ...next);
  }
  return results;
}

function sumShelfOverlaps(shelfGroup: readonly CalloutEntry[]): {
  railHits: number;
  dimmedHits: number;
} {
  let railHits = 0;
  let dimmedHits = 0;
  for (const e of shelfGroup) {
    railHits += countRailOverlaps(e.box, e.otherRailSamples);
    dimmedHits += countDimmedOverlaps(e.packet, e.box);
  }
  return { railHits, dimmedHits };
}

function alignShelf(allEntries: readonly CalloutEntry[], placement: CalloutPlacement): void {
  const isAbove = placement === 'above';
  const edgeOf = (entry: CalloutEntry): number =>
    isAbove ? entry.box.boxBottom : entry.box.boxTop;
  const sideEntries = allEntries.filter((e) => e.box.placement === placement);

  for (const cluster of partitionVerticalClusters(sideEntries)) {
    if (cluster.length < 2) continue;
    const shelfY = isAbove ? Math.min(...cluster.map(edgeOf)) : Math.max(...cluster.map(edgeOf));
    const shelfGroup = cluster.filter(
      (e) => (isAbove ? edgeOf(e) - shelfY : shelfY - edgeOf(e)) <= PARALLEL_SHELF_TOLERANCE,
    );
    if (shelfGroup.length < 2 || shelfGroup.every((e) => edgeOf(e) === shelfY)) {
      continue;
    }

    const prev = sumShelfOverlaps(shelfGroup);
    const prevBoxes = new Map(shelfGroup.map((e) => [e, e.box]));
    for (const entry of shelfGroup) {
      if (isAbove) entry.packet.calloutBottom = shelfY;
      else entry.packet.calloutTop = shelfY;
      entry.box = placeCalloutBox(entry.packet, entry.card, entry.mid);
    }

    const next = sumShelfOverlaps(shelfGroup);
    if (
      countClashes(allEntries) > 0 ||
      next.railHits > prev.railHits ||
      next.dimmedHits > prev.dimmedHits
    ) {
      for (const entry of shelfGroup) {
        if (isAbove) delete entry.packet.calloutBottom;
        else delete entry.packet.calloutTop;
        const saved = prevBoxes.get(entry);
        if (saved) entry.box = saved;
      }
    }
  }
}

/**
 * Optimizes placement (`'above'` vs `'below'`), obstacle-side pocket nudges, symmetric
 * `mid.x`-ordered PAVA separation, and shared shelf alignment for all callouts in a phase.
 */
export function separatePhaseCallouts(phase: readonly Packet[]): void {
  for (const packet of phase) {
    delete packet.calloutShift;
    delete packet.calloutPlacement;
    delete packet.calloutBottom;
    delete packet.calloutTop;
  }
  if (phase.length === 0) return;

  const railSamplesByIndex = phase.map((packet) =>
    RAIL_SAMPLE_TS.map((t) => pointAt(packet.path, t)),
  );

  const entries: CalloutEntry[] = [];
  phase.forEach((packet, index) => {
    const card = measureCalloutCard(packet);
    if (!card) return;
    const mid = pointAt(packet.path, 0.5);
    const otherRailSamples = railSamplesByIndex.flatMap((samples, j) =>
      j === index ? [] : samples,
    );
    const soloAbove = bestPocketCandidate(packet, card, 'above', mid, otherRailSamples);
    const soloBelow =
      packet.clearBottom !== undefined
        ? bestPocketCandidate(packet, card, 'below', mid, otherRailSamples)
        : undefined;
    delete packet.calloutPlacement;
    delete packet.calloutShift;
    const entry: CalloutEntry = {
      packet,
      card,
      index,
      mid,
      midX: mid.x,
      tieX: packet.path.p0.x + packet.path.p3.x,
      otherRailSamples,
      soloAbove,
      soloShift: soloAbove.shift,
      box: soloAbove.box,
    };
    if (soloBelow) entry.soloBelow = soloBelow;
    entries.push(entry);
  });

  if (entries.length === 0) return;

  if (entries.length === 1) {
    const only = entries[0];
    if (!only) return;
    const best =
      only.soloBelow && only.soloBelow.score < only.soloAbove.score - 1e-6
        ? only.soloBelow
        : only.soloAbove;
    applyCalloutChoice(only.packet, best.placement, best.shift);
    return;
  }

  entries.sort((a, b) => a.midX - b.midX || a.tieX - b.tieX || a.index - b.index);

  const assignments = enumeratePlacementAssignments(entries);
  let bestCost = Number.POSITIVE_INFINITY;
  let bestState:
    | ReadonlyArray<{ placement: CalloutPlacement; shift: number; box: PacketCalloutBox }>
    | undefined;

  for (const assignment of assignments) {
    entries.forEach((entry, i) => {
      const placement = assignment[i] ?? 'above';
      const solo =
        placement === 'below' && entry.soloBelow !== undefined ? entry.soloBelow : entry.soloAbove;
      entry.packet.calloutPlacement = placement;
      delete entry.packet.calloutBottom;
      delete entry.packet.calloutTop;
      entry.soloShift = solo.shift;
      setPacketShift(entry.packet, solo.shift);
      entry.box = solo.box;
    });

    const aboveSubset = entries.filter((e) => e.packet.calloutPlacement === 'above');
    const belowSubset = entries.filter((e) => e.packet.calloutPlacement === 'below');
    separateSubsetByPava(aboveSubset);
    separateSubsetByPava(belowSubset);

    if (countClashes(entries) > 0) {
      for (const entry of entries) {
        entry.soloShift = entry.packet.calloutShift ?? 0;
      }
      separateSubsetByPava(entries);
    }

    const totalScore = entries.reduce(
      (sum, e) => sum + scoreCallout(e.packet, e.box, e.mid, e.otherRailSamples),
      0,
    );
    const cost = totalScore + countClashes(entries) * CLASH_PENALTY;
    if (cost < bestCost - 1e-6) {
      bestCost = cost;
      bestState = entries.map((e) => ({
        placement: e.packet.calloutPlacement ?? 'above',
        shift: e.packet.calloutShift ?? 0,
        box: e.box,
      }));
    }
  }

  if (bestState) {
    entries.forEach((entry, i) => {
      const saved = bestState[i];
      if (!saved) return;
      applyCalloutChoice(entry.packet, saved.placement, saved.shift);
      entry.box = saved.box;
    });
  }

  alignShelf(entries, 'above');
  alignShelf(entries, 'below');
}

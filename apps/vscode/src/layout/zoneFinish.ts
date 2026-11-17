import { flippedY, HORIZONTAL_CLEARANCE, type Placed, VERTICAL_CLEARANCE } from './zoneBlocks';
import {
  type BlockLink,
  evaluateMove,
  extent,
  isClear,
  linkCost,
  refreshSegments,
  refreshTouchingSegments,
  runsThrough,
} from './zoneCost';

/** Sizes of the steps a zone takes towards its neighbors, largest first. */
const TIGHTEN_STEPS = [128, 64, 32, 16, 8, 4];
const COMPACT_ROUNDS = 4;
const COMPACT_MIN_SHIFT = 8;
const ALIGN_REACH = 140;
const ALIGN_TOLERANCE = 30;
/** How far a zone moves to make a link straight, and how much cost one straight link is worth. */
const STRAIGHTEN_REACH = 120;
export const STRAIGHT_WORTH = 120;

/** What moving along an axis reads and keeps clear of; `across` is the other axis. */
const AXES = {
  x: {
    across: 'y',
    size: 'width',
    acrossSize: 'height',
    clearance: HORIZONTAL_CLEARANCE,
    acrossClearance: VERTICAL_CLEARANCE,
  },
  y: {
    across: 'x',
    size: 'height',
    acrossSize: 'width',
    clearance: VERTICAL_CLEARANCE,
    acrossClearance: HORIZONTAL_CLEARANCE,
  },
} as const;
type Axis = keyof typeof AXES;

function alignmentCandidates(a: Placed, b: Placed): Array<{ x: number; y: number }> {
  return [
    { x: a.x, y: b.y },
    { x: a.x, y: b.y + b.block.height - a.block.height },
    { x: a.x, y: b.y + (b.block.height - a.block.height) / 2 },
    { x: b.x, y: a.y },
  ];
}

/** Lines up zone edges where that barely costs anything, so that the result reads as tidy. */
export function alignEdges(links: readonly BlockLink[], placed: readonly Placed[]): void {
  let current = linkCost(links, placed);
  let base = current;
  const tryAlign = (a: Placed, to: { x: number; y: number }) => {
    const prevX = a.x;
    const prevY = a.y;
    const moved = to.x !== prevX || to.y !== prevY;
    if (!moved || Math.abs(to.x - prevX) > ALIGN_REACH || Math.abs(to.y - prevY) > ALIGN_REACH) {
      return;
    }
    const change = evaluateMove(links, placed, a, to.x, to.y, a.flip);
    if (Number.isNaN(change)) return;
    if (current + change <= base + ALIGN_TOLERANCE) {
      current += change;
      base = Math.min(base, current);
    } else {
      a.x = prevX;
      a.y = prevY;
      refreshTouchingSegments(links, a, undefined);
    }
  };
  for (let round = 0; round < 3; round++) {
    for (const a of placed) {
      for (const b of placed) {
        if (a === b) continue;
        for (const to of alignmentCandidates(a, b)) tryAlign(a, to);
      }
    }
  }
}

/**
 * Slides each zone towards the zones it is linked to, for as long as that lowers the cost
 * and keeps the clearances. The search leaves a zone wherever a random move last helped;
 * this closes the gaps it left, so that linked neighbors end up one clearance apart.
 */
export function tighten(links: readonly BlockLink[], placed: readonly Placed[]): void {
  for (let round = 0; round < 10; round++) {
    let moved = false;
    for (const a of placed) {
      // Where its links would have no length at all.
      let sumX = 0;
      let sumY = 0;
      let count = 0;
      for (const l of links) {
        if (l.source === a) {
          sumX += l.bx - l.sourceX;
          sumY += l.by - l.sourceY[a.flip];
          count++;
        } else if (l.target === a) {
          sumX += l.ax - l.targetX;
          sumY += l.ay - l.targetY[a.flip];
          count++;
        }
      }
      if (count === 0) continue;
      const target = { x: sumX / count, y: sumY / count };
      for (const axis of ['x', 'y'] as const) {
        for (const step of TIGHTEN_STEPS) {
          for (;;) {
            const toGo = target[axis] - a[axis];
            if (Math.abs(toGo) < step) break;
            const before = a[axis];
            const next = before + Math.sign(toGo) * step;
            const change = evaluateMove(
              links,
              placed,
              a,
              axis === 'x' ? next : a.x,
              axis === 'y' ? next : a.y,
              a.flip,
            );
            if (Number.isNaN(change)) break;
            if (change < 0) {
              moved = true;
            } else {
              a[axis] = before;
              refreshTouchingSegments(links, a, undefined);
              break;
            }
          }
        }
      }
    }
    if (!moved) break;
  }
}

/** How far `a` can move back along the axis before it is too close to `b`, which stays. */
function roomBefore(a: Placed, b: Placed, axis: Axis): number {
  const { across, size, acrossSize, clearance, acrossClearance } = AXES[axis];
  const apart =
    a[across] >= b[across] + b.block[acrossSize] + acrossClearance ||
    b[across] >= a[across] + a.block[acrossSize] + acrossClearance;
  // A zone that is already before the other only moves further away from it.
  if (apart || a[axis] + a.block[size] <= b[axis]) return Number.POSITIVE_INFINITY;
  return a[axis] - (b[axis] + b.block[size]) - clearance;
}

/**
 * Moves the zones of `far` at once towards those of `near`, which stay, by the move that lowers
 * the cost most: see `compact`. Tells whether they moved.
 */
function moveTogether(
  links: readonly BlockLink[],
  placed: readonly Placed[],
  near: readonly Placed[],
  far: readonly Placed[],
  axis: Axis,
  aside: boolean,
): boolean {
  const { across, acrossSize, acrossClearance } = AXES[axis];
  const home = far.map((p) => ({ x: p.x, y: p.y }));
  const put = (along: number, step: number) => {
    far.forEach((p, i) => {
      const at = home[i] as { x: number; y: number };
      p[axis] = at[axis] - along;
      p[across] = at[across] + step;
    });
  };
  const outer = extent(placed);
  const fits = () => {
    const { width, height } = extent(placed);
    return width <= outer.width && height <= outer.height;
  };
  let best = { cost: linkCost(links, placed), along: 0, step: 0 };
  /** Tries the moves that start with that step aside, and tells what stops the part. */
  const slide = (step: number): { stopped: Placed; stopper: Placed } | undefined => {
    put(0, step);
    if (step !== 0 && !far.every((p) => isClear(p, placed))) return undefined;
    let room = Number.POSITIVE_INFINITY;
    let stop: { stopped: Placed; stopper: Placed } | undefined;
    for (const stopped of far) {
      for (const stopper of near) {
        const r = roomBefore(stopped, stopper, axis);
        if (r < room) {
          room = r;
          stop = { stopped, stopper };
        }
      }
    }
    // With nothing ahead, the part would only drift along the rest of the diagram.
    if (!stop) return undefined;
    for (let along = room; along >= COMPACT_MIN_SHIFT; along /= 2) {
      put(along, step);
      if (step !== 0 && !fits()) continue;
      const cost = linkCost(links, placed);
      if (cost < best.cost) {
        best = { cost, along, step };
        break;
      }
    }
    return stop;
  };
  const stop = slide(0);
  if (stop && aside) {
    const { stopped, stopper } = stop;
    const from = (home[far.indexOf(stopped)] as { x: number; y: number })[across];
    slide(stopper[across] + stopper.block[acrossSize] + acrossClearance - from);
    slide(stopper[across] - acrossClearance - stopped.block[acrossSize] - from);
  }
  put(best.along, best.step);
  return best.along !== 0;
}

/**
 * Closes the room that nothing but links run through. The search and the sliding move one
 * zone at a time, and a zone that several links hold on one side does not leave them for a
 * single link on the other: two parts of a diagram then stay apart, however long the links
 * between them. Here everything past a line moves at once, as far as the clearances allow or
 * a part of that, when it lowers the cost.
 *
 * The part often has room to go further if it first steps aside, past the zone that stops it,
 * to either side of that zone. With `aside`, both are tried as well, and the move that lowers
 * the cost most is taken. A step aside must leave the diagram no wider and no higher. Height is
 * free to the search while the canvas has room for it, and a part that may step out of the
 * diagram does so at every zone in its way: the zones then run down a diagonal, with two
 * corners left empty.
 */
export function compact(
  links: readonly BlockLink[],
  placed: readonly Placed[],
  aside: boolean,
): void {
  for (let round = 0; round < COMPACT_ROUNDS; round++) {
    let moved = false;
    for (const axis of ['x', 'y'] as const) {
      const ordered = [...placed].sort((a, b) => a[axis] - b[axis]);
      for (let cut = 1; cut < ordered.length; cut++) {
        const near = ordered.slice(0, cut);
        if (moveTogether(links, placed, near, ordered.slice(cut), axis, aside)) moved = true;
      }
    }
    if (!moved) break;
  }
  refreshSegments(links);
}

/**
 * The stations at the ends of the link are level, or one is straight above the other, and
 * nothing stands between them: a rail can join them in one straight line.
 */
function isStraight(l: BlockLink, placed: readonly Placed[]): boolean {
  if (Math.abs(l.ay - l.by) >= 0.5 && Math.abs(l.ax - l.bx) >= 0.5) return false;
  for (const p of placed) {
    if (p !== l.source && p !== l.target) {
      if (runsThrough(l, p)) return false;
      continue;
    }
    for (const [id, r] of p.block.nodes) {
      if (id === l.from || id === l.to) continue;
      const x = p.x + r.x;
      const y = p.y + (p.flip ? flippedY(p.block, r, id) : r.y);
      if (l.maxX > x && l.minX < x + r.width && l.maxY > y && l.minY < y + r.height) return false;
    }
  }
  return true;
}

export function straightLinks(
  links: readonly BlockLink[],
  placed: readonly Placed[],
  a?: Placed,
): number {
  let count = 0;
  for (const l of links) {
    if ((!a || l.source === a || l.target === a) && isStraight(l, placed)) count++;
  }
  return count;
}

/**
 * Moves zones the little it takes to put the two stations of a link level, or one straight above
 * the other. The search and the sliding leave them a few units apart, which a rail has to make
 * up with a bend. A zone takes the move that straightens the most of its links, as long as the
 * rest of the cost rises by less than those links are worth.
 */
export function straighten(links: readonly BlockLink[], placed: readonly Placed[]): void {
  refreshSegments(links);
  for (let round = 0; round < 4; round++) {
    let moved = false;
    for (const a of placed) {
      const homeX = a.x;
      const homeY = a.y;
      const before = straightLinks(links, placed, a);
      const moves: Array<{ x: number; y: number }> = [];
      for (const l of links) {
        if (l.source !== a && l.target !== a) continue;
        const towards = l.source === a ? 1 : -1;
        const dx = (l.bx - l.ax) * towards;
        const dy = (l.by - l.ay) * towards;
        if (dy !== 0 && Math.abs(dy) <= STRAIGHTEN_REACH) moves.push({ x: homeX, y: homeY + dy });
        if (dx !== 0 && Math.abs(dx) <= STRAIGHTEN_REACH) moves.push({ x: homeX + dx, y: homeY });
      }
      let best: { x: number; y: number; gain: number; reach: number } | undefined;
      for (const to of moves) {
        const change = evaluateMove(links, placed, a, to.x, to.y, a.flip);
        if (Number.isNaN(change)) continue;
        const gain = straightLinks(links, placed, a) - before;
        const reach = Math.abs(to.x - homeX) + Math.abs(to.y - homeY);
        if (
          gain > 0 &&
          change <= gain * STRAIGHT_WORTH &&
          (!best || gain > best.gain || (gain === best.gain && reach < best.reach))
        ) {
          best = { ...to, gain, reach };
        }
        a.x = homeX;
        a.y = homeY;
        refreshTouchingSegments(links, a, undefined);
      }
      if (best) {
        a.x = best.x;
        a.y = best.y;
        refreshTouchingSegments(links, a, undefined);
        moved = true;
      }
    }
    if (!moved) break;
  }
}

import { HORIZONTAL_CLEARANCE, type Placed, VERTICAL_CLEARANCE } from './zoneBlocks';
import {
  type BlockLink,
  CHOSEN_STRAIGHT_WORTH,
  estimateRoutingDefects,
  evaluateMove,
  extent,
  type FlowContext,
  isClear,
  linkCost,
  refreshSegments,
  refreshTouchingSegments,
  STRAIGHT_WORTH,
  straightLinks,
  wallDetourCount,
} from './zoneScore';

export { CHOSEN_STRAIGHT_WORTH, STRAIGHT_WORTH, straightLinks };

/** Sizes of the steps a zone takes towards its neighbors, largest first. */
const TIGHTEN_STEPS = [128, 64, 32, 16, 8, 4];
const COMPACT_ROUNDS = 4;
const COMPACT_MIN_SHIFT = 8;
const ALIGN_REACH = 140;
const ALIGN_TOLERANCE = 30;
const STAGE_GAP = 98;
/** How far a zone moves to make a link straight. */
const STRAIGHTEN_REACH = 120;

type Axis = 'x' | 'y';

function axisSpec(axis: Axis, horizontalClearance: number, verticalClearance = VERTICAL_CLEARANCE) {
  return axis === 'x'
    ? {
        across: 'y' as const,
        size: 'width' as const,
        acrossSize: 'height' as const,
        clearance: horizontalClearance,
        acrossClearance: verticalClearance,
      }
    : {
        across: 'x' as const,
        size: 'height' as const,
        acrossSize: 'width' as const,
        clearance: verticalClearance,
        acrossClearance: horizontalClearance,
      };
}

function alignmentCandidates(a: Placed, b: Placed): Array<{ x: number; y: number }> {
  return [
    { x: a.x, y: b.y },
    { x: a.x, y: b.y + b.block.height - a.block.height },
    { x: a.x, y: b.y + (b.block.height - a.block.height) / 2 },
    { x: b.x, y: a.y },
  ];
}

/** Lines up zone edges where that barely costs anything, so that the result reads as tidy. */
export function alignEdges(
  links: readonly BlockLink[],
  placed: readonly Placed[],
  ctx?: FlowContext,
  horizontalClearance = HORIZONTAL_CLEARANCE,
  verticalClearance = VERTICAL_CLEARANCE,
): void {
  let current = linkCost(links, placed, ctx);
  let base = current;
  const linked = new Set<string>();
  for (const l of links) {
    linked.add(`${l.source.block.id}\0${l.target.block.id}`);
    linked.add(`${l.target.block.id}\0${l.source.block.id}`);
  }
  const tryAlign = (a: Placed, to: { x: number; y: number }, tol: number) => {
    const prevX = a.x;
    const prevY = a.y;
    const moved = to.x !== prevX || to.y !== prevY;
    if (!moved || Math.abs(to.x - prevX) > ALIGN_REACH || Math.abs(to.y - prevY) > ALIGN_REACH) {
      return;
    }
    const wallsBefore = ctx?.preserveFlow ? wallDetourCount(links, placed, ctx) : 0;
    const change = evaluateMove(
      links,
      placed,
      a,
      to.x,
      to.y,
      a.flip,
      undefined,
      0,
      0,
      0,
      ctx,
      horizontalClearance,
      verticalClearance,
    );
    if (Number.isNaN(change)) return;
    const wallsOk = !ctx?.preserveFlow || wallDetourCount(links, placed, ctx) <= wallsBefore;
    if (wallsOk && current + change <= base + tol) {
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
        const tol =
          !ctx?.preserveFlow || linked.has(`${a.block.id}\0${b.block.id}`) ? ALIGN_TOLERANCE : 0;
        for (const to of alignmentCandidates(a, b)) tryAlign(a, to, tol);
      }
    }
  }
}

/**
 * Slides each zone towards the zones it is linked to, for as long as that lowers the cost
 * and keeps the clearances, closing gaps so that linked neighbors end up one clearance apart.
 */
export function tighten(
  links: readonly BlockLink[],
  placed: readonly Placed[],
  ctx?: FlowContext,
  horizontalClearance = HORIZONTAL_CLEARANCE,
  verticalClearance = VERTICAL_CLEARANCE,
): void {
  refreshSegments(links);
  const pullWeight = (l: BlockLink, moverId: string): number => {
    if (l.role === 'primary') return 1;
    if (l.role === 'return') return 0.08;
    return l.auxTouch && ctx?.auxiliaryZones.has(moverId) ? 0.8 : 0.05;
  };
  for (let round = 0; round < 10; round++) {
    let moved = false;
    for (const a of placed) {
      // Where its links would have no length at all, weighted so return/static links don't drag primary layers.
      let sumX = 0;
      let sumY = 0;
      let wTotal = 0;
      for (const l of links) {
        const w = pullWeight(l, a.block.id);
        if (l.source === a) {
          sumX += (l.bx - l.sourceX) * w;
          sumY += (l.by - l.sourceY[a.flip]) * w;
          wTotal += w;
        } else if (l.target === a) {
          sumX += (l.ax - l.targetX) * w;
          sumY += (l.ay - l.targetY[a.flip]) * w;
          wTotal += w;
        }
      }
      if (wTotal === 0) continue;
      const target = { x: sumX / wTotal, y: sumY / wTotal };
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
              undefined,
              0,
              0,
              0,
              ctx,
              horizontalClearance,
              verticalClearance,
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
function roomBefore(
  a: Placed,
  b: Placed,
  axis: Axis,
  horizontalClearance: number,
  verticalClearance: number,
): number {
  const { across, size, acrossSize, clearance, acrossClearance } = axisSpec(
    axis,
    horizontalClearance,
    verticalClearance,
  );
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
  ctx: FlowContext | undefined,
  horizontalClearance: number,
  verticalClearance: number,
): boolean {
  const { across, acrossSize, acrossClearance } = axisSpec(
    axis,
    horizontalClearance,
    verticalClearance,
  );
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
  let best = { cost: linkCost(links, placed, ctx), along: 0, step: 0 };
  /** Tries the moves that start with that step aside, and tells what stops the part. */
  const slide = (step: number): { stopped: Placed; stopper: Placed } | undefined => {
    put(0, step);
    if (
      step !== 0 &&
      !far.every((p) => isClear(p, placed, horizontalClearance, verticalClearance))
    ) {
      return undefined;
    }
    let room = Number.POSITIVE_INFINITY;
    let stop: { stopped: Placed; stopper: Placed } | undefined;
    for (const stopped of far) {
      for (const stopper of near) {
        const r = roomBefore(stopped, stopper, axis, horizontalClearance, verticalClearance);
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
      const cost = linkCost(links, placed, ctx);
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

export function compact(
  links: readonly BlockLink[],
  placed: readonly Placed[],
  aside: boolean,
  ctx?: FlowContext,
  horizontalClearance = HORIZONTAL_CLEARANCE,
  verticalClearance = VERTICAL_CLEARANCE,
): void {
  for (let round = 0; round < COMPACT_ROUNDS; round++) {
    let moved = false;
    for (const axis of ['x', 'y'] as const) {
      const ordered = [...placed].sort((a, b) => a[axis] - b[axis]);
      for (let cut = 1; cut < ordered.length; cut++) {
        const near = ordered.slice(0, cut);
        if (
          moveTogether(
            links,
            placed,
            near,
            ordered.slice(cut),
            axis,
            aside,
            ctx,
            horizontalClearance,
            verticalClearance,
          )
        ) {
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
  refreshSegments(links);
}

/**
 * Restores `STAGE_GAP` horizontal breathing room across clean vertical stage separators
 * (where no block straddles the cut, preserving 100% of vertical link alignments).
 */
export function restoreStageBreathingRoom(
  placed: Placed[],
  ctx?: FlowContext,
  targetGap = STAGE_GAP,
  firstCutOnly = false,
): void {
  if (placed.length < 2) return;
  const primary =
    ctx?.preserveFlow && ctx.auxiliaryZones.size > 0
      ? placed.filter((p) => !ctx.auxiliaryZones.has(p.block.id))
      : placed;
  if (primary.length < 2) return;
  const ordered = [...primary].sort((a, b) => a.x - b.x || a.y - b.y);
  let maxRight = Number.NEGATIVE_INFINITY;
  for (let k = 1; k < ordered.length; k++) {
    const prev = ordered[k - 1];
    if (prev) maxRight = Math.max(maxRight, prev.x + prev.block.width);
    const next = ordered[k];
    if (!next) continue;
    const gap = next.x - maxRight;
    if (gap >= HORIZONTAL_CLEARANCE - 1 && gap < targetGap) {
      const cutX = (maxRight + next.x) / 2;
      const push = targetGap - gap;
      for (let j = k; j < ordered.length; j++) {
        const q = ordered[j];
        if (q) q.x += push;
      }
      if (primary !== placed) {
        for (const a of placed) {
          if (ctx?.auxiliaryZones.has(a.block.id) && a.x + a.block.width / 2 >= cutX) {
            a.x += push;
          }
        }
      }
      maxRight += push;
      if (firstCutOnly) return;
    }
  }
}

/**
 * Small vertical offset (`3px`, well within the `44px` station face so `l` stays a 0-turn
 * horizontal rail) when `l.to` sits above another row in `l.target` and also sends a return
 * rail into a lower row of `l.source`: aligns `l.target`'s inter-row gap above the next row's
 * badge room with `l.source`'s internal horizontal corridor.
 */
function corridorReturnBiasY(l: BlockLink, links: readonly BlockLink[]): number {
  if (l.role !== 'primary' || l.ax >= l.bx) return 0;
  const tf = l.targetFree[l.target.flip] ?? 0;
  if ((tf & 4) !== 0) return 0;
  const uLocalY = l.sourceY[l.source.flip];
  for (const ret of links) {
    if (
      ret.role === 'return' &&
      ret.from === l.to &&
      ret.target === l.source &&
      ret.targetY[l.source.flip] > uLocalY + 40
    ) {
      return 3;
    }
  }
  return 0;
}

/**
 * Moves zones the little it takes to put the two stations of a link level, or one straight above
 * the other. The search and the sliding leave them a few units apart, which a rail has to make
 * up with a bend. A zone takes the move that straightens the most of its links, as long as the
 * rest of the cost rises by less than those links are worth, at `worth` each.
 */
export function straighten(
  links: readonly BlockLink[],
  placed: readonly Placed[],
  worth = STRAIGHT_WORTH,
  ctx?: FlowContext,
  horizontalClearance = HORIZONTAL_CLEARANCE,
  verticalClearance = VERTICAL_CLEARANCE,
): void {
  refreshSegments(links);
  for (let round = 0; round < 4; round++) {
    let moved = false;
    for (const a of placed) {
      const homeX = a.x;
      const homeY = a.y;
      const before = straightLinks(links, placed, a);
      const alignedPrimaryFor = (p: Placed, q?: Placed): number => {
        let cnt = 0;
        for (const pl of links) {
          const b = corridorReturnBiasY(pl, links);
          if (
            b > 0 &&
            (pl.source === p ||
              pl.target === p ||
              (q !== undefined && (pl.source === q || pl.target === q))) &&
            Math.abs(pl.by - (pl.ay + b)) < 0.5
          ) {
            cnt++;
          }
        }
        return cnt;
      };
      const beforeBias = alignedPrimaryFor(a);
      const wallsBefore = wallDetourCount(links, placed, ctx);
      const moves: Array<{ x: number; y: number; primaryY?: boolean }> = [];
      for (const l of links) {
        if (l.source !== a && l.target !== a) continue;
        const towards = l.source === a ? 1 : -1;
        const dx = (l.bx - l.ax) * towards;
        const bias = corridorReturnBiasY(l, links);
        const dy = (l.by - (l.ay + bias)) * towards;
        if (dy !== 0 && Math.abs(dy) <= STRAIGHTEN_REACH) {
          moves.push({ x: homeX, y: homeY + dy, primaryY: l.role === 'primary' });
        }
        if (dx !== 0 && Math.abs(dx) <= STRAIGHTEN_REACH) moves.push({ x: homeX + dx, y: homeY });
      }
      let best:
        | {
            x: number;
            y: number;
            partner?: Placed;
            px: number;
            py: number;
            third?: Placed;
            ty?: number;
            gain: number;
            reach: number;
          }
        | undefined;
      for (const to of moves) {
        const dxMove = to.x - homeX;
        const dyMove = to.y - homeY;
        const reach = Math.abs(dxMove) + Math.abs(dyMove);
        const change = evaluateMove(
          links,
          placed,
          a,
          to.x,
          to.y,
          a.flip,
          undefined,
          0,
          0,
          0,
          ctx,
          horizontalClearance,
          verticalClearance,
        );
        if (!Number.isNaN(change)) {
          const straightGain = straightLinks(links, placed, a) - before;
          const biasGain = alignedPrimaryFor(a) - beforeBias;
          const gain = Math.max(straightGain, straightGain >= 0 ? biasGain : 0);
          if (
            gain > 0 &&
            change <= gain * worth &&
            wallDetourCount(links, placed, ctx) <= wallsBefore &&
            (!best || gain > best.gain || (gain === best.gain && reach < best.reach))
          ) {
            best = { x: to.x, y: to.y, px: 0, py: 0, gain, reach };
          }
          a.x = homeX;
          a.y = homeY;
          refreshTouchingSegments(links, a, undefined);
        } else if (ctx?.preserveFlow && reach <= 36 && !ctx.auxiliaryZones.has(a.block.id)) {
          // If a single block sits directly beneath/beside `a`, try nudging `(a, blocker)` together.
          a.x = to.x;
          a.y = to.y;
          const blockers = placed.filter(
            (b) =>
              b !== a &&
              a.x < b.x + b.block.width + horizontalClearance &&
              b.x < a.x + a.block.width + horizontalClearance &&
              a.y < b.y + b.block.height + verticalClearance &&
              b.y < a.y + a.block.height + verticalClearance,
          );
          a.x = homeX;
          a.y = homeY;
          const aux = blockers[0];
          if (
            blockers.length === 1 &&
            aux &&
            (ctx.auxiliaryZones.has(aux.block.id) ||
              (dyMove > 0 && aux.y >= homeY + a.block.height))
          ) {
            const prevAuxX = aux.x;
            const prevAuxY = aux.y;
            const beforePair = straightLinks(links, placed, a, aux);
            const beforePairBias = alignedPrimaryFor(a, aux);
            const pairChange = evaluateMove(
              links,
              placed,
              a,
              to.x,
              to.y,
              a.flip,
              aux,
              prevAuxX + dxMove,
              prevAuxY + dyMove,
              aux.flip,
              ctx,
              horizontalClearance,
              verticalClearance,
            );
            if (!Number.isNaN(pairChange)) {
              const straightGain = straightLinks(links, placed, a, aux) - beforePair;
              const biasGain = alignedPrimaryFor(a, aux) - beforePairBias;
              const gain = Math.max(straightGain, straightGain >= 0 ? biasGain : 0);
              if (
                gain > 0 &&
                pairChange <= gain * worth &&
                wallDetourCount(links, placed, ctx) <= wallsBefore &&
                (!best || gain > best.gain || (gain === best.gain && reach < best.reach))
              ) {
                best = {
                  x: to.x,
                  y: to.y,
                  partner: aux,
                  px: prevAuxX + dxMove,
                  py: prevAuxY + dyMove,
                  gain,
                  reach,
                };
              }
              a.x = homeX;
              a.y = homeY;
              aux.x = prevAuxX;
              aux.y = prevAuxY;
              refreshTouchingSegments(links, a, aux);
            }
          }
        }

        // Small-delta coupled primary shift (`<= 28px`): straighten a primary link on `a` while
        // moving an already straight-linked downstream neighbor `partner` vertically in lockstep.
        if (
          ctx?.preserveFlow &&
          to.primaryY &&
          Math.abs(dyMove) > 0 &&
          Math.abs(dyMove) <= 28 &&
          dxMove === 0
        ) {
          const hasVerticalLink = (p: Placed): boolean =>
            links.some(
              (vl) => (vl.source === p || vl.target === p) && Math.abs(vl.ax - vl.bx) < 0.5,
            );
          if (!a.block.flippable || hasVerticalLink(a)) continue;
          const partners = new Set<Placed>();
          for (const sl of links) {
            if (sl.role !== 'primary' || Math.abs(sl.ay - sl.by) >= 0.5) continue;
            if (
              sl.source === a &&
              sl.target.x > a.x &&
              sl.target.block.flippable &&
              !ctx.auxiliaryZones.has(sl.target.block.id) &&
              !hasVerticalLink(sl.target)
            ) {
              partners.add(sl.target);
            }
          }
          const alignedPrimaryCount = () => {
            let cnt = 0;
            for (const pl of links) {
              if (
                pl.role === 'primary' &&
                (pl.source === a ||
                  pl.target === a ||
                  partners.has(pl.source) ||
                  partners.has(pl.target)) &&
                Math.abs(pl.by - (pl.ay + corridorReturnBiasY(pl, links))) < 0.5
              ) {
                cnt++;
              }
            }
            return cnt;
          };
          for (const partner of partners) {
            const prevPX = partner.x;
            const prevPY = partner.y;
            const beforePair = straightLinks(links, placed, a, partner);
            const beforePrimaryLevel = alignedPrimaryCount();
            const pairChange = evaluateMove(
              links,
              placed,
              a,
              to.x,
              to.y,
              a.flip,
              partner,
              prevPX,
              prevPY + dyMove,
              partner.flip,
              ctx,
              horizontalClearance,
              verticalClearance,
            );
            if (!Number.isNaN(pairChange)) {
              const straightGain = straightLinks(links, placed, a, partner) - beforePair;
              const levelGain = alignedPrimaryCount() - beforePrimaryLevel;
              const gain = Math.max(straightGain, straightGain >= 0 ? levelGain : 0);
              if (
                gain > 0 &&
                pairChange <= gain * worth &&
                wallDetourCount(links, placed, ctx) <= wallsBefore &&
                (!best || gain > best.gain || (gain === best.gain && reach < best.reach))
              ) {
                best = {
                  x: to.x,
                  y: to.y,
                  partner,
                  px: prevPX,
                  py: prevPY + dyMove,
                  gain,
                  reach,
                };
              }
              a.x = homeX;
              a.y = homeY;
              partner.x = prevPX;
              partner.y = prevPY;
              refreshTouchingSegments(links, a, partner);
            } else if (dyMove > 0) {
              // If a single block directly below `a` blocks `(a, partner)` from stepping down,
              // check shifting all three together by `dyMove`.
              a.y = to.y;
              partner.y = prevPY + dyMove;
              const blockers = placed.filter(
                (b) =>
                  b !== a &&
                  b !== partner &&
                  ((a.x < b.x + b.block.width + horizontalClearance &&
                    b.x < a.x + a.block.width + horizontalClearance &&
                    a.y < b.y + b.block.height + verticalClearance &&
                    b.y < a.y + a.block.height + verticalClearance) ||
                    (partner.x < b.x + b.block.width + horizontalClearance &&
                      b.x < partner.x + partner.block.width + horizontalClearance &&
                      partner.y < b.y + b.block.height + verticalClearance &&
                      b.y < partner.y + partner.block.height + verticalClearance)),
              );
              a.y = homeY;
              partner.y = prevPY;
              const third = blockers[0];
              if (blockers.length === 1 && third && third.y >= homeY + a.block.height) {
                const prevTY = third.y;
                const costBefore = linkCost(links, placed, ctx);
                const straightBefore = straightLinks(links, placed);
                const levelBefore = alignedPrimaryCount();
                a.y = to.y;
                partner.y = prevPY + dyMove;
                third.y = prevTY + dyMove;
                const allClear =
                  isClear(a, placed, horizontalClearance, verticalClearance) &&
                  isClear(partner, placed, horizontalClearance, verticalClearance) &&
                  isClear(third, placed, horizontalClearance, verticalClearance);
                if (allClear) {
                  refreshSegments(links);
                  const straightGain = straightLinks(links, placed) - straightBefore;
                  const levelGain = alignedPrimaryCount() - levelBefore;
                  const gain = Math.max(straightGain, straightGain >= 0 ? levelGain : 0);
                  const delta = linkCost(links, placed, ctx) - costBefore;
                  if (
                    gain > 0 &&
                    delta <= gain * worth &&
                    wallDetourCount(links, placed, ctx) <= wallsBefore &&
                    (!best || gain > best.gain || (gain === best.gain && reach < best.reach))
                  ) {
                    best = {
                      x: to.x,
                      y: to.y,
                      partner,
                      px: prevPX,
                      py: prevPY + dyMove,
                      third,
                      ty: prevTY + dyMove,
                      gain,
                      reach,
                    };
                  }
                }
                a.y = homeY;
                partner.y = prevPY;
                third.y = prevTY;
                refreshSegments(links);
              }
            }
          }
        }
      }
      if (best) {
        a.x = best.x;
        a.y = best.y;
        if (best.partner) {
          best.partner.x = best.px;
          best.partner.y = best.py;
        }
        if (best.third && best.ty !== undefined) {
          best.third.y = best.ty;
          refreshSegments(links);
        } else {
          refreshTouchingSegments(links, a, best.partner);
        }
        moved = true;
      }
    }
    if (!moved) break;
  }
}

/**
 * Eliminates residual short orthogonal S-jogs (`0.5..120px` offset across separated facing ports)
 * when `isStraight` conservatively rejected alignment due to sibling-row bounding boxes.
 */
export function eliminateShortJogs(
  links: readonly BlockLink[],
  placed: readonly Placed[],
  worth = 420,
  ctx?: FlowContext,
  horizontalClearance = HORIZONTAL_CLEARANCE,
): void {
  refreshSegments(links);
  for (let round = 0; round < 2; round++) {
    let moved = false;
    for (const a of placed) {
      const homeX = a.x;
      const homeY = a.y;
      const before = estimateRoutingDefects(links, placed, true);
      if (before.jogs === 0) return;
      const wallsBefore = wallDetourCount(links, placed, ctx);
      let best: { x: number; y: number; drop: number; reach: number } | undefined;
      for (const l of links) {
        if (l.source !== a && l.target !== a) continue;
        const towards = l.source === a ? 1 : -1;
        const dx = (l.bx - l.ax) * towards;
        const dy = (l.by - l.ay) * towards;
        const candidates: Array<{ x: number; y: number }> = [];
        if (Math.abs(dy) >= 0.5 && Math.abs(dy) <= 120) {
          candidates.push({ x: homeX, y: homeY + dy });
        }
        if (Math.abs(dx) >= 0.5 && Math.abs(dx) <= 120) {
          candidates.push({ x: homeX + dx, y: homeY });
        }
        for (const to of candidates) {
          const reach = Math.abs(to.x - homeX) + Math.abs(to.y - homeY);
          const change = evaluateMove(
            links,
            placed,
            a,
            to.x,
            to.y,
            a.flip,
            undefined,
            0,
            0,
            0,
            ctx,
            horizontalClearance,
          );
          if (Number.isNaN(change)) continue;
          const after = estimateRoutingDefects(links, placed, true);
          const drop = before.jogs - after.jogs;
          if (
            drop > 0 &&
            after.orthoPrimaryCrossings <= before.orthoPrimaryCrossings &&
            after.sharedCrossings <= before.sharedCrossings &&
            wallDetourCount(links, placed, ctx) <= wallsBefore &&
            change <= drop * worth &&
            (!best || drop > best.drop || (drop === best.drop && reach < best.reach))
          ) {
            best = { x: to.x, y: to.y, drop, reach };
          }
          a.x = homeX;
          a.y = homeY;
          refreshTouchingSegments(links, a, undefined);
        }
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

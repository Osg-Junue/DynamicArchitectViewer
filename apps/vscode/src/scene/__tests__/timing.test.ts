import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { computeLayout } from '../../layout';
import { railEnds } from '../geometry';
import { packetPosition, packetShare, resolveView, zoneMoves } from '../index';
import type { Packet } from '../resolve';
import { pacePhase, paceView, pacingZoom } from '../timing';

function diagram(size: number, zones: number): string {
  const lines = ['dav 1'];
  for (let z = 0; z < zones; z++) {
    lines.push(`group z${z} "Zone ${z}" {`);
    for (let n = 0; n < size; n++) lines.push(`  node z${z}n${n} "Node ${n}"`);
    lines.push('}');
    for (let n = 1; n < size; n++) lines.push(`z${z}n${n - 1} --> z${z}n${n}`);
  }
  lines.push('step "Hop" {');
  lines.push('  animate z0n0 --> z0n1');
  lines.push('  animate z0n1 <-> z0n2');
  lines.push('  animate z1n0 --> z1n1');
  lines.push('  animate z2n0 --> z2n1 [parallel: true]');
  lines.push('  animate z3n0 --> z3n1 [parallel: true]');
  lines.push('}');
  return lines.join('\n');
}

describe('packet timing', () => {
  const { document } = parse(diagram(6, 8));
  const view = resolveView(document, computeLayout(document), 0);

  it('gives every phase its own duration', () => {
    expect(view.phaseDurations).toHaveLength(view.phases.length);
    for (const ms of view.phaseDurations) {
      expect(ms).toBeGreaterThanOrEqual(1000);
    }
  });

  it('takes longer on a very long line rather than exceeding the top speed', () => {
    const packet = (roundTrip: boolean) => {
      const at = (x: number) => ({ x, y: 0 });
      const path = { p0: at(0), p1: at(1000), p2: at(3000), p3: at(4000) };
      return { path, roundTrip, durationMs: 0 } as Packet;
    };
    const oneWay = pacePhase([packet(false)]);
    expect(4000 / (oneWay / 1000)).toBeLessThanOrEqual(320.1);
    const roundTrip = pacePhase([packet(true)]);
    expect(8000 / (roundTrip / 1000)).toBeLessThanOrEqual(320.1);
    const crowded = pacePhase([packet(false), packet(false), packet(false)]);
    expect(crowded).toBeGreaterThan(oneWay);
  });

  it('keeps the top speed on screen at any zoom', () => {
    const at = (x: number) => ({ x, y: 0 });
    const packet = () =>
      ({
        path: { p0: at(0), p1: at(1000), p2: at(3000), p3: at(4000) },
        roundTrip: false,
        durationMs: 0,
      }) as Packet;
    const near = pacePhase([packet()], 2);
    expect((4000 * 2) / (near / 1000)).toBeLessThanOrEqual(320.1);
    expect(near).toBeGreaterThan(pacePhase([packet()], 1));
    // Far away the line is short on screen, so it stops at the minimum.
    expect(pacePhase([packet()], 0.05)).toBe(1000);
  });

  it('slows packets by half as much as a closer view enlarges them', () => {
    // Four times as large: twice as long, so twice as fast on screen.
    expect(pacingZoom(1, 4)).toBe(2);
    expect(pacingZoom(0.5, 2)).toBe(1);
    // A view further out, or the camera's own, leaves the pace as it is.
    expect(pacingZoom(1, 0.25)).toBe(1);
    expect(pacingZoom(1.2, 1.2)).toBe(1.2);
    expect(pacingZoom(1.2, 0)).toBe(1.2);
  });

  it('times the phases from a given one on, each at its own zoom', () => {
    const { document } = parse(diagram(6, 8));
    const paced = resolveView(document, computeLayout(document), 0);
    const before = [...paced.phaseDurations];
    paceView(paced, [10, 10], 1);
    expect(paced.phaseDurations[0]).toBe(before[0]);
    expect(paced.phaseDurations[1]).toBeGreaterThan(before[1] ?? 0);
    expect(paced.phaseDurations[2]).toBeGreaterThan(before[2] ?? 0);
    expect(paced.phaseDurations[3]).toBe(before[3]);
  });

  it('gives a round trip a minimum for each leg and the turn', () => {
    expect(view.phases[1]?.[0]?.durationMs).toBeGreaterThanOrEqual(1750);
  });

  it('times a phase by its slowest packet', () => {
    const parallel = view.phases[2] ?? [];
    expect(parallel).toHaveLength(3);
    expect(view.phaseDurations[2]).toBe(Math.max(...parallel.map((p) => p.durationMs)));
  });

  it('slows packets that move at the same time', () => {
    const lone = view.phases[0]?.[0];
    const crowded = view.phases[2]?.[0];
    const speed = (p: typeof lone) => (p ? 1 / p.durationMs : 0);
    expect(speed(crowded)).toBeLessThanOrEqual(speed(lone));
  });

  it('keeps one speed for most of the way, starting faster than it stops', () => {
    const packet = { roundTrip: false, durationMs: 1000 } as Packet;
    const share = (t: number) => packetShare(packet, t);
    // In hundredths of its time, as a multiple of its average speed.
    const speeds = Array.from(
      { length: 100 },
      (_, i) => (share((i + 1) / 100) - share(i / 100)) * 100,
    );
    // Never more than 1.3 times the average, where a sine ease reaches 1.57 times.
    expect(Math.max(...speeds)).toBeLessThanOrEqual(1.3);
    expect(speeds.filter((speed) => speed > 1.28)).toHaveLength(55);
    // It has gone further a tenth of its time in than it has left to go a tenth before the end.
    expect(share(0.1)).toBeGreaterThan(1 - share(0.9));
  });

  it('brings a round trip back the way it went out', () => {
    const packet = view.phases[1]?.[0];
    if (!packet) throw new Error('missing packet');
    const rest = 150 / packet.durationMs;
    const leg = (1 - rest) / 2;
    const out = packetShare(packet, leg * 0.2);
    const back = 1 - packetShare(packet, leg + rest + leg * 0.2);
    expect(back).toBeCloseTo(out, 6);
  });

  it('rests a round trip at the far end and brings it back', () => {
    const packet = view.phases[1]?.[0];
    if (!packet) throw new Error('missing packet');
    const { start, end } = railEnds(packet.path);
    expect(packetPosition(packet, 0)).toEqual(start);
    expect(packetPosition(packet, 0.5)).toEqual(end);
    expect(packetPosition(packet, 0.52)).toEqual(end);
    expect(packetPosition(packet, 1)).toEqual(start);
  });
});

describe('zone moves', () => {
  const moves = (dsl: string) => {
    const { document } = parse(`dav 1\n${dsl}`);
    const view = resolveView(document, computeLayout(document), 0);
    return zoneMoves(view, view.phases.flat()).map(([from, to]) => [from.label, to.label]);
  };

  it('names the zones a packet moves between, once per pair', () => {
    expect(
      moves(`group a "A" { node a1 }
group b "B" { node b1 }
step "s" {
  animate a1 --> b1
  animate a1 --> b1
}`),
    ).toEqual([['A', 'B']]);
  });

  it('uses the top-level zone of a nested node', () => {
    expect(
      moves(`group a "A" { group inner "Inner" { node a1 } }
group b "B" { node b1 }
step "s" { animate a1 --> b1 }`),
    ).toEqual([['A', 'B']]);
  });

  it('names a node outside any zone', () => {
    expect(
      moves(`node loose "Loose"
group b "B" { node b1 }
step "s" { animate loose --> b1 }`),
    ).toEqual([['Loose', 'B']]);
  });

  it('skips a move with no zone at either end', () => {
    expect(moves('node x\nnode y\nstep "s" { animate x --> y }')).toEqual([]);
  });
});

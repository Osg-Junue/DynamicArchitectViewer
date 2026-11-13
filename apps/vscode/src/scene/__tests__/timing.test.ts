import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { computeLayout } from '../../layout';
import { railEnds } from '../geometry';
import { packetPosition, resolveView, zoneMoves } from '../index';
import type { Packet } from '../resolve';
import { pacePhase } from '../timing';

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
      expect(ms).toBeGreaterThanOrEqual(1300);
    }
  });

  it('takes longer on a very long line rather than exceeding the top speed', () => {
    const packet = (roundTrip: boolean) => {
      const at = (x: number) => ({ x, y: 0 });
      const path = { p0: at(0), p1: at(1000), p2: at(3000), p3: at(4000) };
      return { path, roundTrip, durationMs: 0 } as Packet;
    };
    const oneWay = pacePhase([packet(false)]);
    expect(4000 / (oneWay / 1000)).toBeLessThanOrEqual(260.1);
    const roundTrip = pacePhase([packet(true)]);
    expect(8000 / (roundTrip / 1000)).toBeLessThanOrEqual(260 * 0.75 + 0.1);
    const crowded = pacePhase([packet(false), packet(false), packet(false)]);
    expect(crowded).toBeGreaterThan(oneWay);
  });

  it('gives a round trip a minimum for each leg and the turn', () => {
    expect(view.phases[1]?.[0]?.durationMs).toBeGreaterThanOrEqual(2380);
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

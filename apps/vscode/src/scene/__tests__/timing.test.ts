import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { computeLayout } from '../../layout';
import { packetPosition, resolveView } from '../index';

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
  const large = parse(diagram(6, 8)).document;
  const view = resolveView(large, computeLayout(large), 0);

  it('gives every phase of a large diagram its own duration', () => {
    const durations = view.phaseDurations as number[];
    expect(durations).toHaveLength(view.phases.length);
    for (const ms of durations) {
      expect(ms).toBeGreaterThanOrEqual(900);
      expect(ms).toBeLessThanOrEqual(5000);
    }
  });

  it('gives a round trip a minimum for each leg and the turn', () => {
    expect(view.phases[1]?.[0]?.durationMs).toBeGreaterThanOrEqual(2380);
  });

  it('times a phase by its slowest packet', () => {
    const parallel = view.phases[2] ?? [];
    expect(parallel).toHaveLength(3);
    expect(view.phaseDurations?.[2]).toBe(Math.max(...parallel.map((p) => p.durationMs as number)));
  });

  it('slows packets that move at the same time', () => {
    const lone = view.phases[0]?.[0];
    const crowded = view.phases[2]?.[0];
    const speed = (p: typeof lone) => (p ? 1 / (p.durationMs as number) : 0);
    expect(speed(crowded)).toBeLessThanOrEqual(speed(lone));
  });

  it('rests a round trip at the far end and brings it back', () => {
    const packet = view.phases[1]?.[0];
    if (!packet) throw new Error('missing packet');
    expect(packetPosition(packet, 0)).toEqual(packet.path.p0);
    expect(packetPosition(packet, 0.5)).toEqual(packet.path.p3);
    expect(packetPosition(packet, 0.52)).toEqual(packet.path.p3);
    expect(packetPosition(packet, 1)).toEqual(packet.path.p0);
  });

  it('leaves small diagrams on the fixed phase length', () => {
    const small = parse(diagram(2, 4)).document;
    const smallView = resolveView(small, computeLayout(small), 0);
    expect(smallView.phaseDurations).toBeUndefined();
    expect(smallView.phases[0]?.[0]?.durationMs).toBeUndefined();
  });
});

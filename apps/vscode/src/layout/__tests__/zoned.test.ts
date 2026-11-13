import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { computeLayout, countCrossings, type Rect, rectContains, rectOverlaps } from '../index';
import { STATION_CENTER } from '../metrics';

/** Zones of `size` chained nodes in a row, with links from the first zone to all the others. */
function bigDiagram(size = 6, zones = 8): string {
  const lines = ['dav 1'];
  for (let z = 0; z < zones; z++) {
    lines.push(`group z${z} "Zone ${z}" {`);
    for (let n = 0; n < size; n++) lines.push(`  node z${z}n${n} "Node ${n}"`);
    lines.push('}');
    for (let n = 1; n < size; n++) lines.push(`z${z}n${n - 1} --> z${z}n${n}`);
    if (z > 0) lines.push(`z${z - 1}n${size - 1} <-> z${z}n0`);
    if (z > 1) lines.push(`z0n0 --> z${z}n${size - 1}`);
  }
  lines.push('step "Hop" {');
  lines.push('  animate z0n0 --> z0n1 : "short"');
  lines.push('  animate z0n1 <-> z0n2 : "there and back"');
  lines.push('  animate z1n0 --> z1n1');
  lines.push('  animate z2n0 --> z2n1 [parallel: true]');
  lines.push('  animate z3n0 --> z3n1 [parallel: true]');
  lines.push('}');
  return lines.join('\n');
}

describe('zoned placement', () => {
  const { document } = parse(bigDiagram());
  const layout = computeLayout(document);

  it('moves zones off the shared columns when links are too long', () => {
    const columns = new Set(Object.values(layout.nodes).map((n) => n.x));
    expect(columns.size).toBeLessThan(document.nodes.length);
  });

  it('fills the canvas instead of stretching into a strip', () => {
    const rects = Object.values(layout.groups);
    const width = Math.max(...rects.map((r) => r.x + r.width)) - Math.min(...rects.map((r) => r.x));
    const height =
      Math.max(...rects.map((r) => r.y + r.height)) - Math.min(...rects.map((r) => r.y));
    // The column layout of this diagram is 60 times as wide as it is high. How close to the
    // canvas's own 1.6 the zones come is a balance against the length of their links.
    expect(width / height).toBeLessThan(3.5);
    expect(width / height).toBeGreaterThan(1);
  });

  it.each([
    [4, 3],
    [4, 9],
    [6, 5],
    [8, 9],
    [10, 7],
  ])('frees %i zones of %i nodes from the strip their columns make', (zones, size) => {
    // In columns, each of these is a single row without crossings, dozens of times wider
    // than high. Freeing the zones costs a crossing or two and is worth it.
    const doc = parse(bigDiagram(size, zones)).document;
    const placed = computeLayout(doc);
    const rects = Object.values(placed.groups);
    const width = Math.max(...rects.map((r) => r.x + r.width)) - Math.min(...rects.map((r) => r.x));
    const height =
      Math.max(...rects.map((r) => r.y + r.height)) - Math.min(...rects.map((r) => r.y));
    expect(width / height).toBeLessThan(5);
    expect(countCrossings(doc, placed)).toBeLessThanOrEqual(2);
  });

  it('leaves no zone further from the others than its clearance asks for', () => {
    // Every zone of this diagram is linked to another, so each is pulled next to one.
    const rects = Object.values(layout.groups);
    const gapTo = (a: Rect, b: Rect): number =>
      Math.hypot(
        Math.max(0, a.x - (b.x + b.width), b.x - (a.x + a.width)),
        Math.max(0, a.y - (b.y + b.height), b.y - (a.y + a.height)),
      );
    for (const a of rects) {
      const nearest = Math.min(...rects.filter((b) => b !== a).map((b) => gapTo(a, b)));
      // 60 across and 34 down are the clearances; a diagonal neighbor is a little further.
      expect(nearest).toBeLessThanOrEqual(70);
      expect(nearest).toBeGreaterThanOrEqual(34);
    }
  });

  it('puts the stations of linked zones level or straight above each other where it can', () => {
    const station = (id: string) => {
      const r = layout.nodes[id] as Rect;
      return { x: r.x + r.width / 2, y: r.y + STATION_CENTER };
    };
    const zoneOf = new Map(document.nodes.map((n) => [n.id, n.parentId]));
    const between = document.edges.filter((e) => zoneOf.get(e.from) !== zoneOf.get(e.to));
    const straight = between.filter((e) => {
      const a = station(e.from);
      const b = station(e.to);
      return Math.abs(a.x - b.x) < 0.5 || Math.abs(a.y - b.y) < 0.5;
    });
    // Zones are rigid and most have several links, so only some of the 13 can be straight:
    // 5 are. Without the search's pull towards facing stations and the final move, 1 is;
    // with the final move alone, 3.
    expect(between).toHaveLength(13);
    expect(straight.length).toBeGreaterThanOrEqual(4);
  });

  it('keeps shared columns when no link is too long', () => {
    const { document: compact } = parse(`dav 1
group a { node a1
node a2 }
group b { node b1
node b2 }
a1 --> a2
b1 --> b2`);
    const { nodes } = computeLayout(compact);
    expect(nodes.a1?.x).toBe(nodes.b1?.x);
    expect(nodes.a2?.x).toBe(nodes.b2?.x);
  });

  it('gives the same layout every time', () => {
    // Laying out another diagram first, so that this is computed again and not remembered.
    computeLayout(parse(bigDiagram(7)).document);
    expect(computeLayout(parse(bigDiagram()).document)).toEqual(layout);
  });

  describe('edge labels', () => {
    const LONG = 'A label long enough to widen the gap between two columns';
    const labeled = (label: string) =>
      parse(`${bigDiagram().replace('z1n0 --> z1n1', `z1n0 --> z1n1 : "${label}"`)}`).document;

    it('leaves everything in place for a label that fits the gap', () => {
      expect(computeLayout(labeled('short'))).toEqual(layout);
    });

    it('moves zones aside for a label that widens its zone, without overlapping', () => {
      const widened = computeLayout(labeled(LONG));
      expect(widened.groups.z1?.width).toBeGreaterThan(layout.groups.z1?.width as number);
      const rects = Object.values(widened.groups);
      rects.forEach((a, i) => {
        for (const b of rects.slice(i + 1)) expect(rectOverlaps(a, b)).toBe(false);
      });
    });

    it('gives the same layout whether the label was typed or was already in the file', () => {
      computeLayout(document);
      const typed = computeLayout(labeled(LONG));
      computeLayout(parse(bigDiagram(7)).document);
      expect(computeLayout(labeled(LONG))).toEqual(typed);
    });
  });

  it('keeps nodes apart and inside their own zone', () => {
    const ids = Object.keys(layout.nodes);
    expect(ids).toHaveLength(document.nodes.length);
    ids.forEach((a, i) => {
      for (const b of ids.slice(i + 1)) {
        expect(rectOverlaps(layout.nodes[a] as Rect, layout.nodes[b] as Rect)).toBe(false);
      }
    });
    for (const n of document.nodes) {
      expect(
        rectContains(layout.groups[n.parentId as string] as Rect, layout.nodes[n.id] as Rect),
      ).toBe(true);
    }
  });

  it('never overlaps two zones', () => {
    const rects = Object.values(layout.groups);
    rects.forEach((a, i) => {
      for (const b of rects.slice(i + 1)) expect(rectOverlaps(a, b)).toBe(false);
    });
  });

  it('wraps nested groups and places zone-less nodes', () => {
    const source = `${bigDiagram()}
group outer "Outer" {
  group inner "Inner" {
    node deep "Deep"
  }
}
node loose "Loose"
z0n0 --> deep
deep --> loose`;
    const doc = parse(source).document;
    const result = computeLayout(doc);
    expect(rectContains(result.groups.inner as Rect, result.nodes.deep as Rect)).toBe(true);
    expect(rectContains(result.groups.outer as Rect, result.groups.inner as Rect)).toBe(true);
    expect(result.nodes.loose).toBeDefined();
    expect(result.groups.loose).toBeUndefined();
  });
});

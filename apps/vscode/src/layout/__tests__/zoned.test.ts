import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { computeLayout, type Rect } from '../index';

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

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

describe('zoned placement', () => {
  const { document } = parse(bigDiagram());
  const layout = computeLayout(document);

  it('moves zones off the shared columns when links are too long', () => {
    const columns = new Set(Object.values(layout.nodes).map((n) => n.x));
    expect(columns.size).toBeLessThan(document.nodes.length);
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
        for (const b of rects.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
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
        expect(overlaps(layout.nodes[a] as Rect, layout.nodes[b] as Rect)).toBe(false);
      }
    });
    for (const n of document.nodes) {
      expect(
        contains(layout.groups[n.parentId as string] as Rect, layout.nodes[n.id] as Rect),
      ).toBe(true);
    }
  });

  it('never overlaps two zones', () => {
    const rects = Object.values(layout.groups);
    rects.forEach((a, i) => {
      for (const b of rects.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
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
    expect(contains(result.groups.inner as Rect, result.nodes.deep as Rect)).toBe(true);
    expect(contains(result.groups.outer as Rect, result.groups.inner as Rect)).toBe(true);
    expect(result.nodes.loose).toBeDefined();
    expect(result.groups.loose).toBeUndefined();
  });
});

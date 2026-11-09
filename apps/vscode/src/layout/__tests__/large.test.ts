import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import { computeLayout, isLargeDiagram, type Rect } from '../index';

/** Eight zones of `size` chained nodes, each zone feeding the next from its last node. */
function bigDiagram(size = 6, zones = 8): string {
  const lines = ['dav 1'];
  for (let z = 0; z < zones; z++) {
    lines.push(`group z${z} "Zone ${z}" {`);
    for (let n = 0; n < size; n++) lines.push(`  node z${z}n${n} "Node ${n}"`);
    lines.push('}');
    for (let n = 1; n < size; n++) lines.push(`z${z}n${n - 1} --> z${z}n${n}`);
    if (z > 0) lines.push(`z${z - 1}n${size - 1} <-> z${z}n0`);
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

describe('large diagrams', () => {
  const { document } = parse(bigDiagram());
  const layout = computeLayout(document);

  it('only applies from a certain size', () => {
    expect(isLargeDiagram(document)).toBe(true);
    expect(isLargeDiagram(parse(bigDiagram(2, 4)).document)).toBe(false);
  });

  it('gives the same layout every time', () => {
    // Laying out another diagram first, so that this is computed again and not remembered.
    computeLayout(parse(bigDiagram(7)).document);
    expect(computeLayout(parse(bigDiagram()).document)).toEqual(layout);
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

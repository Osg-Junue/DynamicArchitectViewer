import { describe, expect, it } from 'vitest';
import { parse } from '../../dsl';
import type { Layout, Rect } from '../metrics';
import { straightenNodes } from '../straightenNodes';

/** A node of the usual size whose station is at (`x`, `y`). */
const node = (x: number, y: number): Rect => ({ x: x - 88, y: y - 50, width: 176, height: 118 });

describe('straightening single nodes', () => {
  it('moves a node inside its group to stand level with the node it is linked to', () => {
    const { document } = parse(`group g {
  node a
  node b
}
step "S" {
  static a --> b
}`);
    const layout: Layout = {
      nodes: { a: node(150, 120), b: node(450, 150) },
      groups: { g: { x: 0, y: 0, width: 600, height: 400 } },
    };
    const { nodes } = straightenNodes(document, layout);
    // The first node takes the move: the second stays.
    expect(nodes.a).toEqual(node(150, 150));
    expect(nodes.b).toEqual(layout.nodes.b);
  });

  it('leaves both nodes where their frame and another node are in the way', () => {
    const { document } = parse(`group g {
  node a
  node c
  node b
}
step "S" {
  static a --> b
}`);
    // `a` would have to go up into `c`, `b` down out of the frame.
    const layout: Layout = {
      nodes: { a: node(150, 250), c: node(150, 90), b: node(450, 220) },
      groups: { g: { x: 0, y: 0, width: 600, height: 300 } },
    };
    expect(straightenNodes(document, layout).nodes).toEqual(layout.nodes);
  });

  it('moves a node together with the one it stands level with, so that both links stay straight', () => {
    const { document } = parse(`group g {
  node a
  node b
  node e
  node f
}
step "S" {
  static a --> b
  static e --> a
}`);
    // `e` is level with `a`. `b` stands at the bottom of the frame, with `f` just above it.
    const layout: Layout = {
      nodes: { e: node(450, 250), a: node(750, 250), b: node(1050, 280), f: node(1050, 120) },
      groups: { g: { x: 0, y: 0, width: 1200, height: 364 } },
    };
    const { nodes } = straightenNodes(document, layout);
    expect(nodes.a).toEqual(node(750, 280));
    expect(nodes.e).toEqual(node(450, 280));
    expect(nodes.b).toEqual(layout.nodes.b);
  });

  it('does not bend one link of a node to straighten another', () => {
    const { document } = parse(`group g {
  node a
  node b
  node e
  node f
  node k
}
step "S" {
  static a --> b
  static e --> a
  static k --> e
}`);
    // As above, but `e` is level with `k` too: one of the three links would have to bend.
    const layout: Layout = {
      nodes: {
        k: node(150, 250),
        e: node(450, 250),
        a: node(750, 250),
        b: node(1050, 280),
        f: node(1050, 120),
      },
      groups: { g: { x: 0, y: 0, width: 1200, height: 364 } },
    };
    expect(straightenNodes(document, layout).nodes).toEqual(layout.nodes);
  });

  it('does not move a node where that makes its links cross another', () => {
    // Narrow nodes, so that the upright link can run close by. Bringing `a` down to `b` puts
    // their link across it; `b` cannot come up, its link would run through `c`.
    const narrow = (x: number, y: number): Rect => ({ x: x - 5, y: y - 50, width: 10, height: 55 });
    const nodes = {
      a: narrow(128, 150),
      b: narrow(1088, 180),
      c: narrow(300, 170),
      d: narrow(300, 400),
    };
    const crossed = parse(`node a
node b
node c
node d
step "S" {
  static a --> b
  static c --> d
}`).document;
    expect(straightenNodes(crossed, { nodes, groups: {} }).nodes).toEqual(nodes);
    // Without the upright link, `a` comes down.
    const alone = parse(`node a
node b
node c
node d
step "S" {
  static a --> b
}`).document;
    expect(straightenNodes(alone, { nodes, groups: {} }).nodes.a).toEqual(narrow(128, 180));
  });
});

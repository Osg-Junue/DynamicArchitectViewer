// What a step leaves open to its callouts: what resolveView hands the placer, caught on its way.
import { describe, expect, it, vi } from 'vitest';
import { parse } from '../../dsl';
import { computeLayout, type Rect } from '../../layout';
import { stationRect } from '../../layout/metrics';
import { type CalloutSurroundings, placePhaseCallouts } from '../calloutPlace';
import { resolveView } from '../index';
import { badgeArea, nodeBody, zoneNameArea } from '../rails';

vi.mock('../calloutPlace', async (original) => {
  const actual = await original<typeof import('../calloutPlace')>();
  return { ...actual, placePhaseCallouts: vi.fn(actual.placePhaseCallouts) };
});

const DSL = `dav 1
group front "Front" {
  node a "A"
  node b "B"
}
group back "Back" {
  node c "C" [badge: "OLD"]
}
a --> b : "call"
b --> c : "sync"
step "Call" {
  animate a --> b : "call"
}
`;

const center = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
const inside = (r: Rect, p: { x: number; y: number }) =>
  p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;

function surroundings() {
  const doc = parse(DSL).document;
  const placer = vi.mocked(placePhaseCallouts);
  placer.mockClear();
  const view = resolveView(doc, computeLayout(doc), 0);
  const around = placer.mock.calls[0]?.[1] as CalloutSurroundings | undefined;
  if (!around) throw new Error('the placer was not called');
  const node = (id: string) => {
    const n = view.nodes.find((m) => m.id === id);
    if (!n) throw new Error(`no node ${id}`);
    return n;
  };
  const zone = (id: string) => {
    const g = view.groups.find((m) => m.id === id);
    if (!g) throw new Error(`no zone ${id}`);
    return g;
  };
  return { around, node, zone };
}

describe('what a step leaves open to its callouts', () => {
  it('opens a dimmed node but its badge, and keeps a node the step is about closed', () => {
    const { around, node } = surroundings();
    const c = node('c');
    const a = node('a');
    expect(c.dimmed).toBe(true);
    expect(a.dimmed).toBe(false);
    const closedAt = (p: { x: number; y: number }) => around.closed.some((r) => inside(r, p));
    const costlyAt = (p: { x: number; y: number }) => around.cells.some((r) => inside(r, p));

    // The dimmed node: its icon and its name are open, and cost nothing to cover.
    for (const part of nodeBody(c)) {
      expect(closedAt(center(part))).toBe(false);
      expect(costlyAt(center(part))).toBe(false);
    }
    expect(costlyAt(center(stationRect(c.rect, c.icon)))).toBe(false);
    // Its badge is not.
    const badge = badgeArea(c)[0];
    if (!badge) throw new Error('no badge');
    expect(closedAt(center(badge))).toBe(true);
    // A node the step is about stays closed, icon and name.
    for (const part of nodeBody(a)) expect(closedAt(center(part))).toBe(true);
  });

  it('counts the border of a zone the step is about, not of a dimmed one', () => {
    const { around, zone } = surroundings();
    const front = zone('front');
    const back = zone('back');
    expect(front.dimmed).toBe(false);
    expect(back.dimmed).toBe(true);
    expect(around.zones).toContainEqual(front.rect);
    expect(around.zones).not.toContainEqual(back.rect);
  });

  it('closes the name of a zone, not the rest of the strip it is written in', () => {
    const { around, zone } = surroundings();
    const front = zone('front');
    const name = zoneNameArea(front.label, front.rect);
    const closedAt = (p: { x: number; y: number }) => around.closed.some((r) => inside(r, p));
    expect(closedAt(center(name))).toBe(true);
    // Level with the name, past its end, the strip is open.
    const past = { x: name.x + name.width + 40, y: center(name).y };
    expect(past.x).toBeLessThan(front.rect.x + front.rect.width);
    expect(closedAt(past)).toBe(false);
  });
});

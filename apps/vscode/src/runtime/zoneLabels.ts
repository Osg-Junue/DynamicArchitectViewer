import type { Rect } from '../layout';
import type { DavGroup } from '../model/types';
import { estimateTextWidth, type ResolvedView, ZONE_LABEL } from '../scene';
import { clear, svg } from './dom';

/** Room kept below a name that has followed the camera to the bottom of its zone. */
const BOTTOM_GAP = 6;

interface ZoneLabel {
  el: SVGTextElement;
  rect: Rect;
  width: number;
  /** The enclosing zone's name, which this one has to stay below. */
  parent: ZoneLabel | undefined;
  /** Where the name currently sits. */
  baseline: number;
  /** What was last written, to skip a write that changes nothing on every camera frame. */
  hidden: boolean;
}

/**
 * Keeps the zone names on screen. They follow the camera, so they live in a layer outside the
 * scene, which depends only on the step.
 */
export class ZoneLabels {
  readonly layer = svg('g');
  #labels: ZoneLabel[] = [];

  /** Takes the names out of a freshly drawn scene. */
  collect(scene: SVGGElement, view: ResolvedView, groups: readonly DavGroup[]): void {
    const rects = new Map(view.groups.map((g) => [g.id, g.rect]));
    const parents = new Map(groups.map((g) => [g.id, g.parentId]));
    const labels = new Map<string, ZoneLabel>();
    clear(this.layer);
    // Groups come parents first, so that a name's parent is always known and placed before it.
    for (const el of Array.from(scene.querySelectorAll<SVGTextElement>('.dav-group-label'))) {
      const holder = el.closest('[data-id]');
      const id = holder?.getAttribute('data-id') ?? '';
      const rect = rects.get(id);
      if (!holder || !rect) continue;
      this.layer.append(holder);
      const parentId = parents.get(id);
      labels.set(id, {
        el,
        rect,
        width: estimateTextWidth(el.textContent ?? '', ZONE_LABEL.size),
        parent: parentId === undefined ? undefined : labels.get(parentId),
        baseline: 0,
        hidden: false,
      });
    }
    this.#labels = [...labels.values()];
  }

  /** Keeps each name in view, as far as it still fits inside its own zone. */
  follow(world: Rect): void {
    for (const label of this.#labels) {
      const { el, rect } = label;
      const left = Math.max(rect.x, world.x);
      const top = Math.max(rect.y, world.y);
      const right = Math.min(rect.x + rect.width, world.x + world.width);
      const bottom = Math.min(rect.y + rect.height, world.y + world.height);
      const lowest = rect.y + rect.height - BOTTOM_GAP;
      // A nested zone's name stays below its nearest shown ancestor's, which follows the camera too.
      let ancestor = label.parent;
      while (ancestor?.hidden) ancestor = ancestor.parent;
      const belowParent = ancestor
        ? ancestor.baseline + ZONE_LABEL.height
        : Number.NEGATIVE_INFINITY;
      const hidden = right <= left || bottom <= top || belowParent > lowest;
      if (hidden !== label.hidden) {
        label.hidden = hidden;
        if (hidden) el.setAttribute('visibility', 'hidden');
        else el.removeAttribute('visibility');
      }
      if (hidden) continue;
      const lastX = Math.max(
        rect.x + ZONE_LABEL.inset,
        rect.x + rect.width - label.width - ZONE_LABEL.endGap,
      );
      el.setAttribute('x', Math.min(left + ZONE_LABEL.inset, lastX).toFixed(1));
      label.baseline = Math.max(Math.min(top + ZONE_LABEL.baseline, lowest), belowParent);
      el.setAttribute('y', label.baseline.toFixed(1));
    }
  }
}

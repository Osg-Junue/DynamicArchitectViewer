import type { Rect } from '../layout';
import type { DavGroup } from '../model/types';
import { parentMap } from '../model/zones';
import {
  placeZoneLabels,
  type ResolvedView,
  textWidth,
  ZONE_LABEL,
  type ZoneLabelEntry,
} from '../scene';
import { clear, svg } from './dom';

interface ZoneLabel extends ZoneLabelEntry {
  el: SVGTextElement;
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
    const parents = parentMap(groups);
    const indices = new Map<string, number>();
    const labels: ZoneLabel[] = [];
    clear(this.layer);
    // Groups come parents first, so that a name's parent is always known and placed before it.
    for (const el of Array.from(scene.querySelectorAll<SVGTextElement>('.dav-group-label'))) {
      const holder = el.closest('[data-id]');
      const id = holder?.getAttribute('data-id') ?? '';
      const rect = rects.get(id);
      if (!holder || !rect) continue;
      this.layer.append(holder);
      const parentId = parents.get(id);
      indices.set(id, labels.length);
      labels.push({
        el,
        rect,
        width: textWidth(el.textContent ?? '', ZONE_LABEL.size),
        parentIndex: parentId === undefined ? -1 : (indices.get(parentId) ?? -1),
        hidden: false,
      });
    }
    this.#labels = labels;
  }

  /** Keeps each name in view, as far as it still fits inside its own zone. */
  follow(world: Rect): void {
    const placed = placeZoneLabels(this.#labels, world);
    this.#labels.forEach((label, i) => {
      const pos = placed[i];
      if (!pos) return;
      if (pos.hidden !== label.hidden) {
        label.hidden = pos.hidden;
        if (pos.hidden) label.el.setAttribute('visibility', 'hidden');
        else label.el.removeAttribute('visibility');
      }
      if (pos.hidden) return;
      label.el.setAttribute('x', pos.x.toFixed(1));
      label.el.setAttribute('y', pos.y.toFixed(1));
    });
  }
}

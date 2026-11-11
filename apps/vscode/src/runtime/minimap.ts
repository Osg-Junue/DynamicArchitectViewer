import type { Layout, Rect } from '../layout';
import type { DavDocument } from '../model/types';
import { MINIMAP_ZONE_ATTRS, minimapZones, type ResolvedView } from '../scene';
import { clear, svg } from './dom';

/** A small picture of the top-level zones and of what the camera shows. */
export class Minimap {
  readonly element: SVGSVGElement;
  #on = false;
  #hasZones = false;
  #zones = new Map<string, SVGRectElement>();
  #camera: SVGRectElement | null = null;

  constructor(onPick: (x: number, y: number) => void) {
    this.element = svg('svg', {
      class: 'dav-minimap',
      'aria-hidden': 'true',
      'data-testid': 'minimap',
    });
    this.#syncHidden();
    this.element.addEventListener('click', (e) => {
      const matrix = this.element.getScreenCTM();
      if (!matrix) return;
      const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
      onPick(point.x, point.y);
    });
  }

  #syncHidden(): void {
    this.element.toggleAttribute('hidden', !this.#on || !this.#hasZones);
  }

  /** Returns whether the minimap is now on. */
  toggle(): boolean {
    this.#on = !this.#on;
    this.#syncHidden();
    return this.#on;
  }

  setDiagram(doc: DavDocument, layout: Layout): void {
    clear(this.element);
    this.#zones = new Map();
    this.#camera = null;
    this.#hasZones = doc.groups.length > 0;
    this.#syncHidden();
    if (!this.#hasZones) return;

    const { zones, bounds: b } = minimapZones(doc, layout);
    this.element.setAttribute('viewBox', `${b.x} ${b.y} ${b.width} ${b.height}`);
    for (const zone of zones) {
      const { x, y, width, height } = zone.rect;
      const rect = svg('rect', {
        x,
        y,
        width,
        height,
        rx: MINIMAP_ZONE_ATTRS.rx,
        fill: zone.fill,
        'fill-opacity': MINIMAP_ZONE_ATTRS['fill-opacity'],
      });
      this.#zones.set(zone.id, rect);
      this.element.append(rect);
    }
    this.#camera = svg('rect', { class: 'dav-minimap-view' });
    this.element.append(this.#camera);
  }

  /** Shows only the zones the current step is about, at their usual places. */
  showStep(view: ResolvedView): void {
    for (const group of view.groups) {
      const rect = this.#zones.get(group.id);
      if (!rect) continue;
      if (group.dimmed) rect.setAttribute('visibility', 'hidden');
      else rect.removeAttribute('visibility');
    }
  }

  setCamera(world: Rect): void {
    if (!this.#on || !this.#camera) return;
    this.#camera.setAttribute('x', world.x.toFixed(1));
    this.#camera.setAttribute('y', world.y.toFixed(1));
    this.#camera.setAttribute('width', world.width.toFixed(1));
    this.#camera.setAttribute('height', world.height.toFixed(1));
  }
}

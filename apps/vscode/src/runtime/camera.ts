import type { Rect } from '../layout';

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;
/** Time constant of the easing towards the target, in milliseconds. */
const EASE_MS = 160;

interface Pose {
  zoom: number;
  panX: number;
  panY: number;
}

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** Where the diagram is on the canvas, and how it eases towards a new place. */
export class Camera {
  #pose: Pose = { zoom: 1, panX: 0, panY: 0 };
  #target: Pose | null = null;
  /** Kept until the next resize: the size is needed on every camera frame. */
  #cachedSize: { width: number; height: number } | null = null;

  readonly #canvas: SVGSVGElement;
  readonly #world: SVGGElement;
  readonly #reducedMotion: boolean;
  readonly #onMove: () => void;
  /** Called when the camera starts easing, so that someone drives `advance`. */
  readonly #onStartEasing: () => void;

  constructor(
    canvas: SVGSVGElement,
    world: SVGGElement,
    reducedMotion: boolean,
    onMove: () => void,
    onStartEasing: () => void,
  ) {
    this.#canvas = canvas;
    this.#world = world;
    this.#reducedMotion = reducedMotion;
    this.#onMove = onMove;
    this.#onStartEasing = onStartEasing;
  }

  get zoom(): number {
    return this.#pose.zoom;
  }

  get isEasing(): boolean {
    return this.#target !== null;
  }

  invalidateSize(): void {
    this.#cachedSize = null;
  }

  #viewSize(): { width: number; height: number } {
    if (this.#cachedSize) return this.#cachedSize;
    const { width, height } = this.#canvas.getBoundingClientRect();
    const size = { width, height };
    // Without a ResizeObserver, nothing would tell that the cached size went stale.
    if (width > 0 && height > 0 && typeof ResizeObserver !== 'undefined') {
      this.#cachedSize = size;
    }
    return size;
  }

  /** The zoom at which a rectangle exactly fits the canvas; unbounded while it has no size. */
  fitZoom(b: Rect): number {
    const { width, height } = this.#viewSize();
    if (width === 0 || height === 0) return Number.POSITIVE_INFINITY;
    return Math.min(width / b.width, height / b.height);
  }

  /** The part of the diagram on screen now, in diagram coordinates. */
  visibleWorld(): Rect | null {
    return this.#worldSeenFrom(this.#pose);
  }

  /** The part of the diagram that will be on screen once the camera has arrived. */
  destinationWorld(): Rect | null {
    return this.#worldSeenFrom(this.#target ?? this.#pose);
  }

  #worldSeenFrom(pose: Pose): Rect | null {
    const { width, height } = this.#viewSize();
    if (width === 0 || height === 0) return null;
    return {
      x: -pose.panX / pose.zoom,
      y: -pose.panY / pose.zoom,
      width: width / pose.zoom,
      height: height / pose.zoom,
    };
  }

  clientToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const box = this.#canvas.getBoundingClientRect();
    return {
      x: (clientX - box.left - this.#pose.panX) / this.#pose.zoom,
      y: (clientY - box.top - this.#pose.panY) / this.#pose.zoom,
    };
  }

  /** Frames a rectangle, zooming in no further than `maxAutoZoom`. */
  frame(b: Rect, maxAutoZoom: number, smooth: boolean): void {
    const box = this.#viewSize();
    if (box.width === 0 || box.height === 0) return;
    const zoom = clampZoom(Math.min(this.fitZoom(b), maxAutoZoom));
    const pose = {
      zoom,
      panX: (box.width - b.width * zoom) / 2 - b.x * zoom,
      panY: (box.height - b.height * zoom) / 2 - b.y * zoom,
    };
    if (!smooth || this.#reducedMotion) {
      this.#target = null;
      this.#pose = pose;
      this.#apply();
      return;
    }
    this.#target = pose;
    this.#onStartEasing();
  }

  /** Eases to a view centered on a diagram position. */
  centerOn(x: number, y: number): void {
    const { width, height } = this.#viewSize();
    const { zoom } = this.#pose;
    this.#target = { zoom, panX: width / 2 - x * zoom, panY: height / 2 - y * zoom };
    this.#onStartEasing();
  }

  panBy(dx: number, dy: number): void {
    this.#target = null;
    this.#pose = { ...this.#pose, panX: this.#pose.panX + dx, panY: this.#pose.panY + dy };
    this.#apply();
  }

  /** Zooms around a point of the canvas; by default, around its center. */
  zoomBy(factor: number, cx?: number, cy?: number): void {
    this.#target = null;
    const box = this.#canvas.getBoundingClientRect();
    const x = cx ?? box.width / 2;
    const y = cy ?? box.height / 2;
    const { zoom, panX, panY } = this.#pose;
    const next = clampZoom(zoom * factor);
    const k = next / zoom;
    this.#pose = { zoom: next, panX: x - (x - panX) * k, panY: y - (y - panY) * k };
    this.#apply();
  }

  /** Moves one frame closer to the target. */
  advance(elapsedMs: number): void {
    const target = this.#target;
    if (!target) return;
    const alpha = 1 - Math.exp(-elapsedMs / EASE_MS);
    const { zoom, panX, panY } = this.#pose;
    this.#pose = {
      zoom: zoom + (target.zoom - zoom) * alpha,
      panX: panX + (target.panX - panX) * alpha,
      panY: panY + (target.panY - panY) * alpha,
    };
    if (
      Math.abs(target.zoom - this.#pose.zoom) < 0.002 &&
      Math.abs(target.panX - this.#pose.panX) < 0.5 &&
      Math.abs(target.panY - this.#pose.panY) < 0.5
    ) {
      this.#pose = target;
      this.#target = null;
    }
    this.#apply();
  }

  #apply(): void {
    const { zoom, panX, panY } = this.#pose;
    this.#world.setAttribute(
      'transform',
      `translate(${panX.toFixed(1)} ${panY.toFixed(1)}) scale(${zoom.toFixed(4)})`,
    );
    this.#onMove();
  }
}

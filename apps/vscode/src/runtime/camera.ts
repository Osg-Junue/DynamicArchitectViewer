import type { Rect } from '../layout';
import { clampZoom, type Frame, framePose, type Pose, type Size, visibleWorld } from '../scene';

/** Time constant of the easing towards the target, in milliseconds. */
const EASE_MS = 160;

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

  #viewSize(): Size {
    if (this.#cachedSize) return this.#cachedSize;
    const { width, height } = this.#canvas.getBoundingClientRect();
    const size = { width, height };
    // Without a ResizeObserver, nothing would tell that the cached size went stale.
    if (width > 0 && height > 0 && typeof ResizeObserver !== 'undefined') {
      this.#cachedSize = size;
    }
    return size;
  }

  get viewSize(): Size {
    return this.#viewSize();
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
    const size = this.#viewSize();
    if (size.width === 0 || size.height === 0) return null;
    return visibleWorld(size, pose);
  }

  /** Frames a rectangle, zooming in no further than the frame allows. */
  frame(frame: Frame, smooth: boolean): void {
    const box = this.#viewSize();
    if (box.width === 0 || box.height === 0) return;
    const pose = framePose(box, frame);
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
    let x = cx;
    let y = cy;
    if (x === undefined || y === undefined) {
      const box = this.#canvas.getBoundingClientRect();
      x ??= box.width / 2;
      y ??= box.height / 2;
    }
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

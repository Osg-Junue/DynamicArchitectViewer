import type { Layout, Rect } from '../layout';
import type { DavDocument } from '../model/types';
import {
  boundsOf,
  buildDefs,
  buildPacket,
  buildScene,
  computePacketCalloutBox,
  type Packet,
  type PacketCalloutBox,
  packetBubblePath,
  packetPosition,
  type ResolvedView,
  resolveView,
} from '../scene';
import { clear, html, renderSvg, svg } from './dom';
import { VIEWER_STRINGS, type ViewerLocale, type ViewerStrings } from './i18n';

export interface PlayerData {
  document: DavDocument;
  layout: Layout;
  dsl?: string;
}

export interface PlayerOptions {
  locale?: ViewerLocale;
  /** Start playing automatically (ignored when the user prefers reduced motion). */
  autoplay?: boolean;
  /** Initial playback speed multiplier (default: 1). */
  speed?: number;
  /** Initial step index (`null` for overview; defaults to 0 when steps exist). */
  initialStep?: number | null;
  /** Listen to keyboard events on the whole window instead of the player root only. */
  globalKeyboard?: boolean;
  /** Optional external toolbar container to mount the playback controls into. */
  playbackSlot?: HTMLElement;
  /** Notified whenever the active step index changes. */
  onStepChange?: (stepIndex: number | null) => void;
}

const PHASE_MS = 2000;
const HOLD_MS = 1800;
const SPEEDS = [0.5, 1, 1.5, 2] as const;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;

/**
 * Self-contained diagram player used both by the exported HTML and the webview app.
 * Renders with DOM APIs only (CSP-friendly, no innerHTML, no inline styles).
 */
export class Player {
  private data: PlayerData;
  private readonly strings: ViewerStrings;
  private readonly reducedMotion: boolean;

  private stepIndex: number | null;
  private playing: boolean;
  private speed = 1;
  private view!: ResolvedView;

  private phase = 0;
  private elapsed = 0;
  private lastFrame = 0;
  private frame = 0;
  private packetEls: Array<{
    packet: Packet;
    box: PacketCalloutBox | null;
    dotEl: SVGGElement | null;
    bubbleEl: SVGPathElement | null;
  }> = [];

  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private userMoved = false;
  private followAnim = false;
  private cameraTarget: { zoom: number; panX: number; panY: number } | null = null;

  private readonly root: HTMLElement;
  private readonly playbackBar: HTMLElement;
  private readonly svgEl: SVGSVGElement;
  private readonly world: SVGGElement;
  private readonly sceneLayer: SVGGElement;
  private readonly packetLayer: SVGGElement;
  private readonly titleEl: HTMLElement;
  private readonly stepTitleEl: HTMLElement;
  private readonly stepDescEl: HTMLElement;
  private readonly stepSelect: HTMLSelectElement;
  private readonly playBtn: HTMLButtonElement;
  private readonly speedSelect: HTMLSelectElement;
  private readonly zoomLabel: HTMLElement;
  private readonly followBtn: HTMLButtonElement;
  private readonly onStepChange?: ((stepIndex: number | null) => void) | undefined;
  private readonly cleanups: Array<() => void> = [];

  constructor(container: HTMLElement, data: PlayerData, options: PlayerOptions = {}) {
    this.data = data;
    this.onStepChange = options.onStepChange;
    this.strings = VIEWER_STRINGS.en;
    this.reducedMotion =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasSteps = data.document.steps.length > 0;
    this.stepIndex =
      options.initialStep !== undefined
        ? hasSteps && options.initialStep !== null
          ? Math.max(0, Math.min(options.initialStep, data.document.steps.length - 1))
          : null
        : hasSteps
          ? 0
          : null;
    this.playing = hasSteps && (options.autoplay ?? true) && !this.reducedMotion;
    if (options.speed !== undefined && SPEEDS.includes(options.speed as (typeof SPEEDS)[number])) {
      this.speed = options.speed;
    }

    const s = this.strings;
    this.svgEl = svg('svg', { class: 'dav-canvas', role: 'img' });
    this.world = svg('g', { class: 'dav-world' });
    this.sceneLayer = svg('g');
    this.packetLayer = svg('g', { class: 'dav-layer-packets' });
    this.svgEl.append(renderSvg(buildDefs()), this.world);
    this.world.append(this.sceneLayer, this.packetLayer);

    this.titleEl = html('h1', { class: 'dav-title' });
    this.zoomLabel = html('span', { class: 'dav-zoom-label', 'aria-live': 'polite' });
    this.stepTitleEl = html('div', { class: 'dav-step-title' });
    this.stepDescEl = html('div', { class: 'dav-step-desc' });

    this.stepSelect = html('select', {
      class: 'dav-btn dav-step-select',
      'aria-label': 'Step',
      title: 'Select step',
      'data-testid': 'select-step',
    });
    this.stepSelect.addEventListener('change', () => {
      const val = this.stepSelect.value;
      this.showStep(val === 'overview' ? null : Number(val));
    });

    this.playBtn = this.button(
      s.play,
      s.play,
      () => this.togglePlay(),
      'dav-btn dav-btn-primary dav-btn-play',
    );
    this.playBtn.dataset.testid = 'btn-play';

    this.speedSelect = html('select', {
      class: 'dav-btn dav-speed-select',
      'aria-label': s.speed,
      title: s.speed,
      'data-testid': 'select-speed',
    });
    for (const v of SPEEDS) {
      this.speedSelect.append(
        html('option', { value: String(v), selected: v === this.speed }, `${v}x`),
      );
    }
    this.speedSelect.addEventListener('change', () => {
      this.speed = Number(this.speedSelect.value) || 1;
    });

    this.playbackBar = html(
      'div',
      {
        class: 'dav-playback-bar',
        role: 'toolbar',
        'aria-label': s.speed,
        'data-testid': 'playback-toolbar',
      },
      this.stepSelect,
      html('span', { class: 'dav-toolbar-sep', 'aria-hidden': 'true' }),
      this.playBtn,
      html('span', { class: 'dav-toolbar-sep', 'aria-hidden': 'true' }),
      this.speedSelect,
    );

    if (options.playbackSlot) {
      clear(options.playbackSlot);
      options.playbackSlot.append(this.playbackBar);
    }

    const fitBtn = html(
      'button',
      {
        class: 'dav-btn dav-btn-icon',
        type: 'button',
        title: s.fit,
        'aria-label': s.fit,
        'data-testid': 'btn-zoom-fit',
      },
      svg(
        'svg',
        {
          width: 15,
          height: 15,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': 2.2,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'aria-hidden': 'true',
        },
        svg('path', { d: 'M8 3H5a2 2 0 0 0-2 2v3' }),
        svg('path', { d: 'M21 8V5a2 2 0 0 0-2-2h-3' }),
        svg('path', { d: 'M3 16v3a2 2 0 0 0 2 2h3' }),
        svg('path', { d: 'M16 21h3a2 2 0 0 0 2-2v-3' }),
      ),
    );
    fitBtn.addEventListener('click', () => {
      if (this.followAnim) {
        this.followAnim = false;
        this.followBtn.setAttribute('aria-pressed', 'false');
      }
      this.fit(true);
    });

    this.followBtn = html(
      'button',
      {
        class: 'dav-btn dav-btn-icon dav-btn-follow',
        type: 'button',
        title: s.followAnim,
        'aria-label': s.followAnim,
        'aria-pressed': 'false',
        'data-testid': 'btn-follow-anim',
      },
      svg(
        'svg',
        {
          width: 15,
          height: 15,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': 2.2,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'aria-hidden': 'true',
        },
        svg('circle', { cx: 12, cy: 12, r: 7 }),
        svg('circle', { cx: 12, cy: 12, r: 2 }),
        svg('path', { d: 'M12 2v3' }),
        svg('path', { d: 'M12 19v3' }),
        svg('path', { d: 'M2 12h3' }),
        svg('path', { d: 'M19 12h3' }),
      ),
    );
    this.followBtn.addEventListener('click', () => this.toggleFollowAnim());

    const zoomOverlay = html(
      'div',
      {
        class: 'dav-zoom-group',
        role: 'group',
        'aria-label': 'Zoom controls',
        'data-testid': 'canvas-zoom-controls',
      },
      this.button('−', s.zoomOut, () => this.zoomBy(1 / 1.2)),
      this.zoomLabel,
      this.button('+', s.zoomIn, () => this.zoomBy(1.2)),
      html('span', { class: 'dav-toolbar-sep', 'aria-hidden': 'true' }),
      fitBtn,
      this.followBtn,
    );

    const viewport = html('main', { class: 'dav-viewport' }, this.svgEl, zoomOverlay);
    this.root = html(
      'div',
      { class: 'dav-app', tabindex: '0' },
      html(
        'header',
        { class: 'dav-topbar' },
        html(
          'div',
          { class: 'dav-topbar-main' },
          this.titleEl,
          !options.playbackSlot && this.playbackBar,
          html('div', { class: 'dav-hint' }, s.hint),
        ),
        html(
          'div',
          { class: 'dav-dock', 'data-testid': 'top-step-dock' },
          html(
            'div',
            { class: 'dav-step-info', 'aria-live': 'polite' },
            this.stepTitleEl,
            this.stepDescEl,
          ),
        ),
      ),
      viewport,
    );
    container.append(this.root);

    this.bindPointer(viewport);
    this.bindKeyboard(options.globalKeyboard ? window : this.root);
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        if (this.followAnim) this.focusCurrentPhase(false);
        else if (!this.userMoved) this.fit(false);
      });
      ro.observe(viewport);
      this.cleanups.push(() => ro.disconnect());
    }

    this.renderChrome();
    this.showStep(this.stepIndex);
    this.fit(false);
  }

  /** Replaces the diagram (e.g. after an edit) while keeping the current step if possible. */
  update(data: PlayerData): void {
    this.data = data;
    const count = data.document.steps.length;
    if (count === 0 && this.playing) {
      this.playing = false;
    }
    const index =
      this.stepIndex === null ? null : count === 0 ? null : Math.min(this.stepIndex, count - 1);
    this.renderChrome();
    this.showStep(index, { keepPhase: true });
    if (this.followAnim) this.focusCurrentPhase(false);
    else if (!this.userMoved) this.fit(false);
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    for (const c of this.cleanups) c();
    this.playbackBar.remove();
    this.root.remove();
  }

  goTo(index: number | null): void {
    this.showStep(index);
  }

  getSvgElement(): SVGSVGElement {
    return this.svgEl;
  }

  getWorldElement(): SVGGElement {
    return this.world;
  }

  getView(): ResolvedView {
    return this.view;
  }

  getStepIndex(): number | null {
    return this.stepIndex;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getSpeed(): number {
    return this.speed;
  }

  clientToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const box = this.svgEl.getBoundingClientRect();
    return {
      x: (clientX - box.left - this.panX) / this.zoom,
      y: (clientY - box.top - this.panY) / this.zoom,
    };
  }

  next(): void {
    const count = this.data.document.steps.length;
    if (count === 0) return;
    this.showStep(this.stepIndex === null ? 0 : (this.stepIndex + 1) % count);
  }

  prev(): void {
    const count = this.data.document.steps.length;
    if (count === 0) return;
    if (this.stepIndex === null || this.stepIndex === 0) this.showStep(null);
    else this.showStep(this.stepIndex - 1);
  }

  togglePlay(): void {
    if (this.data.document.steps.length === 0) return;
    this.playing = !this.playing;
    if (this.playing && this.stepIndex === null) this.showStep(0);
    this.updatePlayButton();
    this.ensureLoop();
  }

  toggleFollowAnim(): void {
    this.followAnim = !this.followAnim;
    this.followBtn.setAttribute('aria-pressed', String(this.followAnim));
    if (this.followAnim) {
      this.userMoved = false;
      this.focusCurrentPhase(false);
    } else {
      this.fit(true);
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private renderChrome(): void {
    const { document: doc } = this.data;
    this.titleEl.textContent = doc.title;
    this.svgEl.setAttribute('aria-label', doc.title);
    const noSteps = doc.steps.length === 0;
    this.playBtn.disabled = noSteps;
    this.speedSelect.disabled = noSteps;
    clear(this.stepSelect);
    this.stepSelect.append(html('option', { value: 'overview' }, this.strings.overview));
    doc.steps.forEach((step, i) => {
      this.stepSelect.append(html('option', { value: String(i) }, `${i + 1}. ${step.title}`));
    });
  }

  private showStep(index: number | null, opts: { keepPhase?: boolean } = {}): void {
    this.view = resolveView(this.data.document, this.data.layout, index);
    this.stepIndex = this.view.stepIndex;
    clear(this.sceneLayer);
    this.sceneLayer.append(renderSvg(buildScene(this.view)));
    if (!opts.keepPhase || this.phase >= this.view.phases.length) {
      this.phase = 0;
      this.elapsed = 0;
    }
    this.renderPackets();
    this.updateDock();
    this.ensureLoop();
    this.onStepChange?.(this.stepIndex);
  }

  private renderPackets(): void {
    clear(this.packetLayer);
    this.packetEls = [];
    const phases = this.view.phases;
    if (phases.length === 0) {
      if (this.followAnim) this.focusCurrentPhase(true);
      return;
    }

    if (this.reducedMotion) {
      // Static: every packet of the step, parked at the middle of its path.
      for (const packet of phases.flat()) this.addPacket(packet, 0.5);
      if (this.followAnim) this.focusCurrentPhase(false);
      return;
    }
    for (const packet of phases[this.phase] ?? []) this.addPacket(packet, 0);
    if (this.followAnim) this.focusCurrentPhase(true);
  }

  private addPacket(packet: Packet, t: number): void {
    const el = renderSvg(buildPacket(packet, t)) as SVGGElement;
    this.packetLayer.append(el);
    const dotEl = el.querySelector('.dav-packet-dot') as SVGGElement | null;
    const bubbleEl = el.querySelector('.dav-packet-bubble') as SVGPathElement | null;
    const entry = { packet, box: computePacketCalloutBox(packet), dotEl, bubbleEl };
    this.packetEls.push(entry);
    this.placePacket(entry, t);
  }

  private placePacket(
    entry: {
      packet: Packet;
      box: PacketCalloutBox | null;
      dotEl: SVGGElement | null;
      bubbleEl: SVGPathElement | null;
    },
    t: number,
  ): void {
    const p = packetPosition(entry.packet, t);
    entry.dotEl?.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    if (entry.bubbleEl && entry.box) {
      entry.bubbleEl.setAttribute('d', packetBubblePath(entry.box, p));
    }
  }

  private updateDock(): void {
    const s = this.strings;
    const { steps } = this.data.document;
    if (this.view.stepIndex === null) {
      this.stepTitleEl.textContent = s.overview;
      this.stepDescEl.textContent = s.overviewHint;
      this.stepSelect.value = 'overview';
    } else {
      this.stepTitleEl.textContent = `${s.stepLabel(this.view.stepIndex + 1, steps.length)} — ${this.view.stepTitle ?? ''}`;
      this.stepDescEl.textContent = this.view.description ?? '';
      this.stepSelect.value = String(this.view.stepIndex);
    }

    this.updatePlayButton();
  }

  private updatePlayButton(): void {
    const action = this.playing ? this.strings.pause : this.strings.play;
    clear(this.playBtn);
    if (this.playing) {
      this.playBtn.append(
        svg(
          'svg',
          {
            width: 15,
            height: 15,
            viewBox: '0 0 24 24',
            fill: 'currentColor',
            'aria-hidden': 'true',
          },
          svg('rect', { x: 6, y: 5, width: 4, height: 14, rx: 1 }),
          svg('rect', { x: 14, y: 5, width: 4, height: 14, rx: 1 }),
        ),
      );
    } else {
      this.playBtn.append(
        svg(
          'svg',
          {
            width: 16,
            height: 16,
            viewBox: '0 0 24 24',
            fill: 'currentColor',
            'aria-hidden': 'true',
          },
          svg('polygon', { points: '2 5 12 12 2 19 2 5' }),
          svg('polygon', { points: '12 5 22 12 12 19 12 5' }),
        ),
      );
    }
    this.playBtn.title = action;
    this.playBtn.setAttribute('aria-label', action);
    this.playBtn.setAttribute('aria-pressed', String(this.playing));
  }

  // ---------------------------------------------------------------------------
  // Animation loop
  // ---------------------------------------------------------------------------

  private ensureLoop(): void {
    const animating =
      !this.reducedMotion && (this.view.phases.length > 0 || this.cameraTarget !== null);
    if (!animating && !this.playing) return;
    if (this.frame) return;
    this.lastFrame = performance.now();
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }

  private tick(now: number): void {
    this.frame = 0;
    const rawDt = Math.min(100, now - this.lastFrame);
    const dt = rawDt * this.speed;
    this.lastFrame = now;
    this.elapsed += dt;

    if (this.cameraTarget) {
      const alpha = 1 - Math.exp(-rawDt / 160);
      this.zoom += (this.cameraTarget.zoom - this.zoom) * alpha;
      this.panX += (this.cameraTarget.panX - this.panX) * alpha;
      this.panY += (this.cameraTarget.panY - this.panY) * alpha;
      if (
        Math.abs(this.cameraTarget.zoom - this.zoom) < 0.002 &&
        Math.abs(this.cameraTarget.panX - this.panX) < 0.5 &&
        Math.abs(this.cameraTarget.panY - this.panY) < 0.5
      ) {
        this.zoom = this.cameraTarget.zoom;
        this.panX = this.cameraTarget.panX;
        this.panY = this.cameraTarget.panY;
        this.cameraTarget = null;
      }
      this.applyTransform();
    }

    const phases = this.reducedMotion ? [] : this.view.phases;
    if (this.phase < phases.length) {
      const t = Math.min(1, this.elapsed / PHASE_MS);
      for (const entry of this.packetEls) this.placePacket(entry, t);
      if (this.elapsed >= PHASE_MS) {
        this.phase++;
        this.elapsed = 0;
        if (this.phase < phases.length) {
          this.renderPackets();
        }
      }
    } else if (this.elapsed >= HOLD_MS) {
      if (this.playing) {
        this.next();
        return;
      }
      // Paused: replay the current step's packets.
      this.phase = 0;
      this.elapsed = 0;
      this.renderPackets();
    }

    if (this.playing || phases.length > 0 || this.cameraTarget !== null) {
      this.frame = requestAnimationFrame((t) => this.tick(t));
    }
  }

  // ---------------------------------------------------------------------------
  // Pan & zoom
  // ---------------------------------------------------------------------------

  private focusCurrentPhase(smooth: boolean): void {
    const box = this.svgEl.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;

    const phases = this.view.phases;
    const packets =
      phases.length === 0
        ? []
        : this.reducedMotion
          ? phases.flat()
          : (phases[Math.min(this.phase, phases.length - 1)] ?? []);

    if (packets.length === 0) {
      const { nodes, groups } = this.data.layout;
      const b = boundsOf([...Object.values(nodes), ...Object.values(groups)]);
      this.setCameraTarget(b, 1.25, smooth);
      return;
    }

    const rects: Rect[] = [];
    const { nodes } = this.data.layout;
    for (const pkt of packets) {
      const fromRect = nodes[pkt.from];
      const toRect = nodes[pkt.to];
      if (fromRect) rects.push(fromRect);
      if (toRect) rects.push(toRect);
      const callout = computePacketCalloutBox(pkt);
      if (callout) {
        rects.push({
          x: callout.cx - callout.halfW,
          y: callout.boxTop,
          width: callout.halfW * 2,
          height: callout.boxBottom - callout.boxTop,
        });
      }
      const xs = [pkt.path.p0.x, pkt.path.p1.x, pkt.path.p2.x, pkt.path.p3.x];
      const ys = [pkt.path.p0.y, pkt.path.p1.y, pkt.path.p2.y, pkt.path.p3.y];
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      rects.push({
        x: minX,
        y: minY,
        width: Math.max(...xs) - minX,
        height: Math.max(...ys) - minY,
      });
    }

    const pad = 56;
    const minX = Math.min(...rects.map((r) => r.x)) - pad;
    const minY = Math.min(...rects.map((r) => r.y)) - pad;
    const maxX = Math.max(...rects.map((r) => r.x + r.width)) + pad;
    const maxY = Math.max(...rects.map((r) => r.y + r.height)) + pad;
    const targetBounds: Rect = {
      x: minX,
      y: minY,
      width: Math.max(200, maxX - minX),
      height: Math.max(160, maxY - minY),
    };
    this.setCameraTarget(targetBounds, 1.65, smooth);
  }

  private setCameraTarget(b: Rect, maxAutoZoom: number, smooth: boolean): void {
    const box = this.svgEl.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    const zoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, Math.min(box.width / b.width, box.height / b.height, maxAutoZoom)),
    );
    const panX = (box.width - b.width * zoom) / 2 - b.x * zoom;
    const panY = (box.height - b.height * zoom) / 2 - b.y * zoom;

    if (!smooth || this.reducedMotion) {
      this.cameraTarget = null;
      this.zoom = zoom;
      this.panX = panX;
      this.panY = panY;
      this.applyTransform();
      return;
    }
    this.cameraTarget = { zoom, panX, panY };
    this.ensureLoop();
  }

  private fit(user: boolean): void {
    if (user) this.userMoved = false;
    this.cameraTarget = null;
    const box = this.svgEl.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    const { nodes, groups } = this.data.layout;
    const b = boundsOf([...Object.values(nodes), ...Object.values(groups)]);
    const zoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, Math.min(box.width / b.width, box.height / b.height, 1.25)),
    );
    this.zoom = zoom;
    this.panX = (box.width - b.width * zoom) / 2 - b.x * zoom;
    this.panY = (box.height - b.height * zoom) / 2 - b.y * zoom;
    this.applyTransform();
  }

  private zoomBy(factor: number, cx?: number, cy?: number): void {
    this.cameraTarget = null;
    const box = this.svgEl.getBoundingClientRect();
    const x = cx ?? box.width / 2;
    const y = cy ?? box.height / 2;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom * factor));
    const k = next / this.zoom;
    this.panX = x - (x - this.panX) * k;
    this.panY = y - (y - this.panY) * k;
    this.zoom = next;
    this.userMoved = true;
    this.applyTransform();
  }

  private applyTransform(): void {
    this.world.setAttribute(
      'transform',
      `translate(${this.panX.toFixed(1)} ${this.panY.toFixed(1)}) scale(${this.zoom.toFixed(4)})`,
    );
    this.zoomLabel.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  private bindPointer(viewport: HTMLElement): void {
    let drag: { id: number; x: number; y: number; captured: boolean } | null = null;
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || e.defaultPrevented) return;
      if ((e.target as Element | null)?.closest('.dav-zoom-group')) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, captured: false };
    };
    const move = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.captured) {
        if (Math.hypot(dx, dy) < 3) return;
        drag.captured = true;
        viewport.setPointerCapture(e.pointerId);
        viewport.classList.add('dav-dragging');
      }
      this.cameraTarget = null;
      this.panX += dx;
      this.panY += dy;
      drag.x = e.clientX;
      drag.y = e.clientY;
      this.userMoved = true;
      this.applyTransform();
    };
    const up = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId) return;
      if (drag.captured && viewport.hasPointerCapture(e.pointerId)) {
        viewport.releasePointerCapture(e.pointerId);
      }
      drag = null;
      viewport.classList.remove('dav-dragging');
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const box = this.svgEl.getBoundingClientRect();
      this.zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX - box.left, e.clientY - box.top);
    };
    viewport.addEventListener('pointerdown', down);
    viewport.addEventListener('pointermove', move);
    viewport.addEventListener('pointerup', up);
    viewport.addEventListener('pointercancel', up);
    viewport.addEventListener('wheel', wheel, { passive: false });
  }

  private bindKeyboard(target: Window | HTMLElement): void {
    const onKey = (e: Event) => {
      if (!this.root.isConnected) return;
      const ke = e as KeyboardEvent;
      const targetEl = ke.target as HTMLElement | null;
      const tag = targetEl?.tagName;
      if (
        ke.defaultPrevented ||
        ke.ctrlKey ||
        ke.metaKey ||
        ke.altKey ||
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        targetEl?.isContentEditable ||
        document.querySelector('dialog[open]') !== null
      ) {
        return;
      }
      if (ke.key === 'ArrowRight') this.next();
      else if (ke.key === 'ArrowLeft') this.prev();
      else if (ke.key === ' ' && tag !== 'BUTTON') this.togglePlay();
      else if (ke.key === 'Home') this.showStep(null);
      else return;
      ke.preventDefault();
    };
    target.addEventListener('keydown', onKey);
    this.cleanups.push(() => target.removeEventListener('keydown', onKey));
    if (target !== window && !this.root.contains(this.playbackBar)) {
      this.playbackBar.addEventListener('keydown', onKey);
      this.cleanups.push(() => this.playbackBar.removeEventListener('keydown', onKey));
    }
  }

  private button(
    label: string,
    title: string,
    onClick: () => void,
    className = 'dav-btn',
  ): HTMLButtonElement {
    const btn = html(
      'button',
      { class: className, type: 'button', title, 'aria-label': title },
      label,
    );
    btn.addEventListener('click', onClick);
    return btn;
  }
}

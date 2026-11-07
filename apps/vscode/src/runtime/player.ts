import type { Layout } from '../layout';
import type { DavDocument } from '../model/types';
import {
  boundsOf,
  buildDefs,
  buildPacket,
  buildScene,
  type Packet,
  packetPosition,
  type ResolvedView,
  resolveView,
} from '../scene';
import { clear, html, renderSvg, svg } from './dom';
import { detectLocale, VIEWER_STRINGS, type ViewerLocale, type ViewerStrings } from './i18n';

export interface PlayerData {
  document: DavDocument;
  layout: Layout;
  /** Embedded DSL source, shown in the "DSL" dialog when present. */
  dsl?: string;
}

export interface PlayerOptions {
  locale?: ViewerLocale;
  /** Start playing automatically (ignored when the user prefers reduced motion). */
  autoplay?: boolean;
  /** Listen to keyboard events on the whole window instead of the player root only. */
  globalKeyboard?: boolean;
  /** Notified whenever the active step index changes. */
  onStepChange?: (stepIndex: number | null) => void;
}

const PHASE_MS = 1500;
const HOLD_MS = 1600;
const SPEEDS = [0.5, 1, 1.5, 2] as const;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;

/**
 * Self-contained diagram player used both by the exported HTML and the web app.
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
  private packetEls: Array<{ packet: Packet; el: SVGGElement }> = [];

  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private userMoved = false;

  private readonly root: HTMLElement;
  private readonly svgEl: SVGSVGElement;
  private readonly world: SVGGElement;
  private readonly sceneLayer: SVGGElement;
  private readonly packetLayer: SVGGElement;
  private readonly titleEl: HTMLElement;
  private readonly stepTitleEl: HTMLElement;
  private readonly stepDescEl: HTMLElement;
  private readonly pillsEl: HTMLElement;
  private readonly playBtn: HTMLButtonElement;
  private readonly zoomLabel: HTMLElement;
  private readonly sourceBtn: HTMLButtonElement;
  private readonly dialog: HTMLDialogElement;
  private readonly sourcePre: HTMLElement;
  private readonly onStepChange?: ((stepIndex: number | null) => void) | undefined;
  private readonly cleanups: Array<() => void> = [];

  constructor(container: HTMLElement, data: PlayerData, options: PlayerOptions = {}) {
    this.data = data;
    this.onStepChange = options.onStepChange;
    this.strings = VIEWER_STRINGS[options.locale ?? detectLocale()];
    this.reducedMotion =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.stepIndex = data.document.steps.length > 0 ? 0 : null;
    this.playing = (options.autoplay ?? true) && !this.reducedMotion;

    const s = this.strings;
    this.svgEl = svg('svg', { class: 'dav-canvas', role: 'img' });
    this.world = svg('g', { class: 'dav-world' });
    this.sceneLayer = svg('g');
    this.packetLayer = svg('g', { class: 'dav-layer-packets' });
    this.svgEl.append(renderSvg(buildDefs()), this.world);
    this.world.append(this.sceneLayer, this.packetLayer);

    this.titleEl = html('h1', { class: 'dav-title' });
    this.zoomLabel = html('span', { class: 'dav-zoom-label', 'aria-live': 'polite' });
    this.sourceBtn = this.button(s.source, s.sourceTitle, () => this.openSource());
    this.stepTitleEl = html('div', { class: 'dav-step-title' });
    this.stepDescEl = html('div', { class: 'dav-step-desc' });
    this.pillsEl = html('div', { class: 'dav-pills', role: 'tablist' });
    this.playBtn = this.button(s.play, s.play, () => this.togglePlay(), 'dav-btn dav-btn-primary');

    const speedSelect = html('select', { class: 'dav-btn', 'aria-label': s.speed, title: s.speed });
    for (const v of SPEEDS) {
      speedSelect.append(html('option', { value: String(v), selected: v === 1 }, `${v}x`));
    }
    speedSelect.addEventListener('change', () => {
      this.speed = Number(speedSelect.value) || 1;
    });

    this.sourcePre = html('pre', { class: 'dav-source' });
    const copyBtn = this.button(
      s.copy,
      s.copy,
      () => this.copySource(copyBtn),
      'dav-btn dav-btn-primary',
    );
    this.dialog = html(
      'dialog',
      { class: 'dav-dialog', 'aria-label': s.sourceTitle },
      html(
        'div',
        { class: 'dav-dialog-header' },
        html('span', {}, s.sourceTitle),
        html(
          'div',
          { class: 'dav-row' },
          copyBtn,
          this.button(s.close, s.close, () => this.dialog.close()),
        ),
      ),
      this.sourcePre,
    );

    const viewport = html('main', { class: 'dav-viewport' }, this.svgEl);
    this.root = html(
      'div',
      { class: 'dav-app', tabindex: '0' },
      html(
        'header',
        { class: 'dav-topbar' },
        this.titleEl,
        html(
          'div',
          { class: 'dav-row' },
          this.button('−', s.zoomOut, () => this.zoomBy(1 / 1.2)),
          this.zoomLabel,
          this.button('+', s.zoomIn, () => this.zoomBy(1.2)),
          this.button(s.fit, s.fit, () => this.fit(true)),
          this.sourceBtn,
        ),
      ),
      viewport,
      html(
        'footer',
        { class: 'dav-dock' },
        html(
          'div',
          { class: 'dav-step-info', 'aria-live': 'polite' },
          this.stepTitleEl,
          this.stepDescEl,
        ),
        html(
          'div',
          { class: 'dav-controls' },
          html(
            'div',
            { class: 'dav-row' },
            this.button(`◀ ${s.prev}`, s.prev, () => this.prev()),
            this.playBtn,
            this.button(`${s.next} ▶`, s.next, () => this.next()),
            speedSelect,
          ),
          this.pillsEl,
          html('div', { class: 'dav-hint' }, s.hint),
        ),
      ),
      this.dialog,
    );
    container.append(this.root);

    this.bindPointer(viewport);
    this.bindKeyboard(options.globalKeyboard ? window : this.root);
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        if (!this.userMoved) this.fit(false);
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
    const index =
      this.stepIndex === null ? null : count === 0 ? null : Math.min(this.stepIndex, count - 1);
    this.renderChrome();
    this.showStep(index, { keepPhase: true });
    if (!this.userMoved) this.fit(false);
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    for (const c of this.cleanups) c();
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
    this.playing = !this.playing;
    if (this.playing && this.stepIndex === null) this.showStep(0);
    this.updatePlayButton();
    this.ensureLoop();
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private renderChrome(): void {
    const { document: doc, dsl } = this.data;
    this.titleEl.textContent = doc.title;
    this.svgEl.setAttribute('aria-label', doc.title);
    this.sourceBtn.hidden = dsl === undefined;
    clear(this.pillsEl);
    this.pillsEl.append(this.pill(this.strings.overview, null));
    doc.steps.forEach((step, i) => {
      this.pillsEl.append(this.pill(`${i + 1}. ${step.title}`, i));
    });
  }

  private pill(label: string, index: number | null): HTMLButtonElement {
    const btn = html('button', { class: 'dav-pill', type: 'button', role: 'tab' }, label);
    btn.dataset.index = index === null ? 'overview' : String(index);
    btn.addEventListener('click', () => this.showStep(index));
    return btn;
  }

  private showStep(index: number | null, opts: { keepPhase?: boolean } = {}): void {
    this.stepIndex = index;
    this.view = resolveView(this.data.document, this.data.layout, index);
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
    if (phases.length === 0) return;

    if (this.reducedMotion) {
      // Static: every packet of the step, parked at the middle of its path.
      for (const packet of phases.flat()) this.addPacket(packet, 0.5);
      return;
    }
    for (const packet of phases[this.phase] ?? []) this.addPacket(packet, 0);
  }

  private addPacket(packet: Packet, t: number): void {
    const el = renderSvg(buildPacket(packet)) as SVGGElement;
    this.packetLayer.append(el);
    this.packetEls.push({ packet, el });
    this.placePacket(el, packet, t);
  }

  private placePacket(el: SVGGElement, packet: Packet, t: number): void {
    const p = packetPosition(packet, t);
    el.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
  }

  private updateDock(): void {
    const s = this.strings;
    const { steps } = this.data.document;
    if (this.view.stepIndex === null) {
      this.stepTitleEl.textContent = s.overview;
      this.stepDescEl.textContent = s.overviewHint;
    } else {
      this.stepTitleEl.textContent = `${s.stepLabel(this.view.stepIndex + 1, steps.length)} — ${this.view.stepTitle ?? ''}`;
      this.stepDescEl.textContent = this.view.description ?? '';
    }
    for (const pill of Array.from(this.pillsEl.children) as HTMLElement[]) {
      const key = this.view.stepIndex === null ? 'overview' : String(this.view.stepIndex);
      const active = pill.dataset.index === key;
      pill.classList.toggle('dav-active', active);
      pill.setAttribute('aria-selected', String(active));
    }
    this.updatePlayButton();
  }

  private updatePlayButton(): void {
    const label = this.playing ? `❚❚ ${this.strings.pause}` : `▶ ${this.strings.play}`;
    this.playBtn.textContent = label;
    this.playBtn.setAttribute('aria-pressed', String(this.playing));
  }

  // ---------------------------------------------------------------------------
  // Animation loop
  // ---------------------------------------------------------------------------

  private ensureLoop(): void {
    const animating = !this.reducedMotion && this.view.phases.length > 0;
    if (!animating && !this.playing) return;
    if (this.frame) return;
    this.lastFrame = performance.now();
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }

  private tick(now: number): void {
    this.frame = 0;
    const dt = Math.min(100, now - this.lastFrame) * this.speed;
    this.lastFrame = now;
    this.elapsed += dt;

    const phases = this.reducedMotion ? [] : this.view.phases;
    if (this.phase < phases.length) {
      const t = Math.min(1, this.elapsed / PHASE_MS);
      for (const { el, packet } of this.packetEls) this.placePacket(el, packet, t);
      if (this.elapsed >= PHASE_MS) {
        this.phase++;
        this.elapsed = 0;
        if (this.phase < phases.length) this.renderPackets();
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

    if (this.playing || phases.length > 0) {
      this.frame = requestAnimationFrame((t) => this.tick(t));
    }
  }

  // ---------------------------------------------------------------------------
  // Pan & zoom
  // ---------------------------------------------------------------------------

  private fit(user: boolean): void {
    if (user) this.userMoved = false;
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
    let drag: { id: number; x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || e.defaultPrevented) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      viewport.setPointerCapture(e.pointerId);
      viewport.classList.add('dav-dragging');
    };
    const move = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId) return;
      this.panX += e.clientX - drag.x;
      this.panY += e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      this.userMoved = true;
      this.applyTransform();
    };
    const up = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId) return;
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
      const ke = e as KeyboardEvent;
      const tag = (ke.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || this.dialog.open) return;
      if (ke.key === 'ArrowRight') this.next();
      else if (ke.key === 'ArrowLeft') this.prev();
      else if (ke.key === ' ' && tag !== 'BUTTON') this.togglePlay();
      else if (ke.key === 'Home') this.showStep(null);
      else return;
      ke.preventDefault();
    };
    target.addEventListener('keydown', onKey);
    this.cleanups.push(() => target.removeEventListener('keydown', onKey));
  }

  // ---------------------------------------------------------------------------
  // DSL source dialog
  // ---------------------------------------------------------------------------

  private openSource(): void {
    this.sourcePre.textContent = this.data.dsl ?? '';
    this.dialog.showModal();
  }

  private async copySource(btn: HTMLButtonElement): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.data.dsl ?? '');
      btn.textContent = this.strings.copied;
      setTimeout(() => {
        btn.textContent = this.strings.copy;
      }, 1500);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(this.sourcePre);
      const sel = getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
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

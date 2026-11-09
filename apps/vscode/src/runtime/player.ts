import { isLargeDiagram, type Layout, type Rect } from '../layout';
import type { DavDocument } from '../model/types';
import {
  activeLabelFill,
  boundsOf,
  buildDefs,
  buildPacket,
  buildScene,
  calloutRect,
  computePacketCalloutBox,
  flowColors,
  type IconShapes,
  type Packet,
  type PacketCalloutBox,
  PHASE_MS,
  packetBubblePath,
  packetPosition,
  paint,
  type ResolvedGroup,
  type ResolvedView,
  resolveView,
} from '../scene';
import { clear, html, renderSvg, svg } from './dom';
import { VIEWER_STRINGS, type ViewerLocale, type ViewerStrings } from './i18n';

export interface PlayerData {
  document: DavDocument;
  layout: Layout;
  icons: IconShapes;
  dsl?: string;
}

export interface PlayerOptions {
  locale?: ViewerLocale;
  /**
   * Start playing automatically: `true` runs through all steps, `'step'` repeats the current one.
   * Ignored when the user prefers reduced motion.
   */
  autoplay?: boolean | 'step';
  /** Initial playback speed multiplier (default: 1). */
  speed?: number;
  /** Initial step index (`null` for overview; defaults to 0 when steps exist). */
  initialStep?: number | null;
  /** Listen to keyboard events on the whole window instead of the player root only. */
  globalKeyboard?: boolean;
  /** Optional external toolbar container to mount the playback controls into. */
  playbackSlot?: HTMLElement;
  /** Notified whenever the displayed step or animation phase changes. */
  onPhaseChange?: (view: ResolvedView, phase: number) => void;
  /** Always frame the whole diagram instead of each step's focus. */
  fixedFrame?: boolean;
}

export { PHASE_MS };
/** Pause after a step's last phase at 1x. */
export const HOLD_MS = 1800;
export const SPEEDS = [0.5, 1, 1.5, 2] as const;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;
const MAX_FIT_ZOOM = 1.4;
/** Room kept around what a large diagram's camera shows. */
const CALM_FRAME_PAD = 120;
/** A large diagram's camera shows whole zones unless that would shrink them below this zoom. */
const MIN_ZONE_FRAME_ZOOM = 0.6;
const MAX_CALM_ZOOM = 1.25;
/** How close to the screen's edge a moving packet may get before the camera follows. */
const CALM_EDGE_MARGIN = 40;
/** The moving-zones line sits along the top of the canvas; zone names stay below it. */
const ZONE_HUD_BAND = 34;
const ZONE_LABEL_SIZE = 12;
const MAX_HUD_PAIRS = 3;
const MINIMAP_PAD = 40;

interface PacketEntry {
  packet: Packet;
  box: PacketCalloutBox | null;
  dotEl: SVGGElement | null;
  bubbleEl: SVGPathElement | null;
}

/**
 * Self-contained diagram player used both by the exported HTML and the webview app.
 * Renders with DOM APIs only (CSP-friendly: no innerHTML, no style attributes; CSSOM only).
 */
export class Player {
  #data: PlayerData;
  readonly #strings: ViewerStrings;
  readonly #reducedMotion: boolean;

  #stepIndex: number | null;
  #playMode: 'node' | 'step' | 'all';
  #speed = 1;
  #view!: ResolvedView;

  #phase = 0;
  /** The reader turned animation off. */
  #motionOff = false;
  /** Playback is frozen in place and resumes from the same position. */
  #paused = false;
  /** While stopped: `phase` was picked by clicking a node and shows its packets. */
  #pinned = false;
  #elapsed = 0;
  #lastFrame = 0;
  #frame = 0;
  #packetEls: PacketEntry[] = [];

  #zoom = 1;
  #panX = 0;
  #panY = 0;
  #userMoved = false;
  #followAnim = false;
  #cameraTarget: { zoom: number; panX: number; panY: number } | null = null;
  /** Large diagrams pace packets by distance and guide the reader between zones. */
  #large = false;
  /** The reader asked for the whole diagram; the camera stays until the next step. */
  #holdFrame = false;
  #zoneOfNode = new Map<string, string>();
  #zoneLabels: Array<{ el: SVGTextElement; rect: Rect }> = [];
  #miniView: SVGRectElement | null = null;

  readonly #root: HTMLElement;
  readonly #viewportEl: HTMLElement;
  readonly #zoneHud: HTMLElement;
  readonly #minimap: SVGSVGElement;
  readonly #playbackBar: HTMLElement;
  readonly #svgEl: SVGSVGElement;
  readonly #world: SVGGElement;
  readonly #sceneLayer: SVGGElement;
  readonly #packetLayer: SVGGElement;
  readonly #titleEl: HTMLElement;
  readonly #stepTitleEl: HTMLElement;
  readonly #stepDescEl: HTMLElement;
  readonly #timelineEl: HTMLElement;
  #tickFills: HTMLElement[] = [];
  readonly #stepSelect: HTMLSelectElement;
  readonly #playBtn: HTMLButtonElement;
  readonly #playAllBtn: HTMLButtonElement;
  readonly #motionBtn: HTMLButtonElement;
  readonly #speedSelect: HTMLSelectElement;
  readonly #zoomLabel: HTMLElement;
  readonly #followBtn: HTMLButtonElement;
  readonly #onPhaseChange: ((view: ResolvedView, phase: number) => void) | undefined;
  readonly #fixedFrame: boolean;
  readonly #cleanups: Array<() => void> = [];

  constructor(container: HTMLElement, data: PlayerData, options: PlayerOptions = {}) {
    this.#data = data;
    this.#onPhaseChange = options.onPhaseChange;
    this.#fixedFrame = options.fixedFrame ?? false;
    this.#strings = VIEWER_STRINGS[options.locale ?? 'en'];
    this.#reducedMotion =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasSteps = data.document.steps.length > 0;
    this.#stepIndex =
      options.initialStep !== undefined
        ? hasSteps && options.initialStep !== null
          ? Math.max(0, Math.min(options.initialStep, data.document.steps.length - 1))
          : null
        : hasSteps
          ? 0
          : null;
    this.#playMode =
      !hasSteps || !options.autoplay || this.#reducedMotion
        ? 'node'
        : options.autoplay === 'step'
          ? 'step'
          : 'all';
    if (options.speed !== undefined && SPEEDS.includes(options.speed as (typeof SPEEDS)[number])) {
      this.#speed = options.speed;
    }

    const s = this.#strings;
    this.#svgEl = svg('svg', { class: 'dav-canvas', role: 'img' });
    this.#world = svg('g', { class: 'dav-world' });
    this.#sceneLayer = svg('g');
    this.#packetLayer = svg('g', { class: 'dav-layer-packets' });
    this.#svgEl.append(renderSvg(buildDefs()), this.#world);
    this.#world.append(this.#sceneLayer, this.#packetLayer);

    this.#titleEl = html('h1', { class: 'dav-title' });
    this.#zoomLabel = html('span', { class: 'dav-zoom-label', 'aria-live': 'polite' });
    this.#stepTitleEl = html('div', { class: 'dav-step-title' });
    this.#stepDescEl = html('div', { class: 'dav-step-desc' });
    this.#timelineEl = html('div', {
      class: 'dav-timeline',
      role: 'group',
      'aria-label': s.steps,
      'data-testid': 'step-timeline',
    });

    this.#stepSelect = html('select', {
      class: 'dav-btn dav-step-select',
      'aria-label': s.step,
      title: s.selectStep,
      'data-testid': 'select-step',
    });
    this.#stepSelect.addEventListener('change', () => {
      const val = this.#stepSelect.value;
      this.#showStep(val === 'overview' ? null : Number(val));
    });

    this.#playBtn = this.#button(
      s.play,
      s.play,
      () => this.togglePlay(),
      'dav-btn dav-btn-primary dav-btn-play',
    );
    this.#playBtn.dataset.testid = 'btn-play';

    this.#playAllBtn = this.#button(
      s.playAll,
      s.playAll,
      () => this.togglePlayAll(),
      'dav-btn dav-btn-primary dav-btn-play dav-btn-play-all',
    );
    this.#playAllBtn.dataset.testid = 'btn-play-all';

    this.#motionBtn = html(
      'button',
      { class: 'dav-btn dav-btn-icon', type: 'button', 'data-testid': 'btn-motion' },
      svg(
        'svg',
        {
          width: 15,
          height: 15,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': 1.75,
          'stroke-linecap': 'round',
          'aria-hidden': 'true',
        },
        svg('path', { d: 'M2 12h20' }),
        svg('circle', { cx: 12, cy: 12, r: 4, fill: 'currentColor' }),
      ),
    );
    this.#motionBtn.addEventListener('click', () => this.toggleMotion());

    this.#speedSelect = html('select', {
      class: 'dav-btn dav-speed-select',
      'aria-label': s.speed,
      title: s.speed,
      'data-testid': 'select-speed',
    });
    for (const v of SPEEDS) {
      this.#speedSelect.append(
        html('option', { value: String(v), selected: v === this.#speed }, `${v}x`),
      );
    }
    this.#speedSelect.addEventListener('change', () => {
      this.#speed = Number(this.#speedSelect.value) || 1;
    });

    this.#playbackBar = html(
      'div',
      {
        class: 'dav-playback-bar',
        role: 'toolbar',
        'aria-label': s.playback,
        'data-testid': 'playback-toolbar',
      },
      this.#stepSelect,
      html('span', { class: 'dav-toolbar-sep', 'aria-hidden': 'true' }),
      this.#playBtn,
      this.#playAllBtn,
      this.#motionBtn,
      html('span', { class: 'dav-toolbar-sep', 'aria-hidden': 'true' }),
      this.#speedSelect,
    );

    if (options.playbackSlot) {
      clear(options.playbackSlot);
      options.playbackSlot.append(this.#playbackBar);
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
          'stroke-width': 1.75,
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
      if (this.#followAnim) {
        this.#followAnim = false;
        this.#followBtn.setAttribute('aria-pressed', 'false');
      }
      this.#holdFrame = true;
      this.#fit();
    });

    this.#followBtn = html(
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
          'stroke-width': 1.75,
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
    this.#followBtn.addEventListener('click', () => this.toggleFollowAnim());

    const zoomOverlay = html(
      'div',
      {
        class: 'dav-zoom-group',
        role: 'group',
        'aria-label': s.zoomControls,
        'data-testid': 'canvas-zoom-controls',
      },
      this.#button('−', s.zoomOut, () => this.#zoomBy(1 / 1.2)),
      this.#zoomLabel,
      this.#button('+', s.zoomIn, () => this.#zoomBy(1.2)),
      html('span', { class: 'dav-toolbar-sep', 'aria-hidden': 'true' }),
      fitBtn,
      this.#followBtn,
    );

    this.#zoneHud = html('div', {
      class: 'dav-zone-hud',
      'aria-hidden': 'true',
      'data-testid': 'zone-hud',
    });
    this.#zoneHud.hidden = true;
    this.#minimap = svg('svg', {
      class: 'dav-minimap',
      'aria-hidden': 'true',
      'data-testid': 'minimap',
    });
    this.#minimap.setAttribute('hidden', '');
    this.#minimap.addEventListener('click', (e) => this.#panToMinimapPoint(e));

    const viewport = html(
      'main',
      { class: 'dav-viewport' },
      this.#svgEl,
      this.#titleEl,
      this.#zoneHud,
      this.#minimap,
      zoomOverlay,
    );
    this.#viewportEl = viewport;
    this.#root = html(
      'div',
      { class: 'dav-app', tabindex: '0' },
      html(
        'header',
        { class: 'dav-topbar' },
        !options.playbackSlot && html('div', { class: 'dav-topbar-main' }, this.#playbackBar),
        html(
          'div',
          { class: 'dav-dock', 'data-testid': 'top-step-dock' },
          html(
            'div',
            { class: 'dav-step-info', 'aria-live': 'polite' },
            this.#stepTitleEl,
            this.#stepDescEl,
          ),
          this.#timelineEl,
        ),
      ),
      viewport,
    );
    container.append(this.#root);

    this.#bindPointer(viewport);
    this.#bindKeyboard(options.globalKeyboard ? window : this.#root);
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        if (this.#followAnim) this.#focusCurrentPhase(false);
        else if (!this.#userMoved) this.#frameStep(false);
      });
      ro.observe(viewport);
      this.#cleanups.push(() => ro.disconnect());
    }

    this.#syncScale();
    this.#renderChrome();
    this.#updateMotionButton();
    this.#showStep(this.#stepIndex);
    this.#frameStep(false);
  }

  /** Replaces the diagram (e.g. after an edit) while keeping the current step if possible. */
  update(data: PlayerData): void {
    this.#data = data;
    const count = data.document.steps.length;
    if (count === 0 && this.#playMode !== 'node') {
      this.#playMode = 'node';
    }
    const index =
      this.#stepIndex === null ? null : count === 0 ? null : Math.min(this.#stepIndex, count - 1);
    this.#syncScale();
    this.#renderChrome();
    this.#showStep(index, { keepPhase: true });
    if (this.#followAnim) this.#focusCurrentPhase(false);
    else if (!this.#userMoved) this.#frameStep(false);
  }

  destroy(): void {
    cancelAnimationFrame(this.#frame);
    for (const c of this.#cleanups) c();
    this.#playbackBar.remove();
    this.#root.remove();
  }

  goTo(index: number | null): void {
    this.#showStep(index);
  }

  getSvgElement(): SVGSVGElement {
    return this.#svgEl;
  }

  getWorldElement(): SVGGElement {
    return this.#world;
  }

  getView(): ResolvedView {
    return this.#view;
  }

  getStepIndex(): number | null {
    return this.#stepIndex;
  }

  isPlaying(): boolean {
    return this.#isAllRunning() || this.#isStepRunning();
  }

  #isAllRunning(): boolean {
    return this.#playMode === 'all' && !this.#paused;
  }

  /** "Play step" only runs while the current view has something to play. */
  #isStepRunning(): boolean {
    return (
      this.#playMode === 'step' &&
      !this.#paused &&
      !this.#isStopped() &&
      this.#view.phases.length > 0
    );
  }

  getSpeed(): number {
    return this.#speed;
  }

  clientToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const box = this.#svgEl.getBoundingClientRect();
    return {
      x: (clientX - box.left - this.#panX) / this.#zoom,
      y: (clientY - box.top - this.#panY) / this.#zoom,
    };
  }

  next(): void {
    const count = this.#data.document.steps.length;
    if (count === 0) return;
    this.#showStep(this.#stepIndex === null ? 0 : (this.#stepIndex + 1) % count);
  }

  prev(): void {
    const count = this.#data.document.steps.length;
    if (count === 0) return;
    if (this.#stepIndex === null || this.#stepIndex === 0) this.#showStep(null);
    else this.#showStep(this.#stepIndex - 1);
  }

  /** Turns animation off (a still view of the step) or back on. */
  toggleMotion(): void {
    this.#setMotionOff(!this.#motionOff);
    this.#paused = false;
    this.#playMode = 'node';
    this.#phase = 0;
    this.#elapsed = 0;
    this.#renderPackets();
    this.#updatePlayButton();
    this.#updateStepProgress();
    this.#ensureLoop();
  }

  #setMotionOff(off: boolean): void {
    this.#motionOff = off;
    this.#pinned = false;
    this.#updateMotionButton();
  }

  #updateMotionButton(): void {
    const off = this.#isStopped();
    const action = off ? this.#strings.startMotion : this.#strings.stopMotion;
    this.#motionBtn.title = action;
    this.#motionBtn.setAttribute('aria-label', action);
    this.#motionBtn.setAttribute('aria-pressed', String(off));
  }

  #isStopped(): boolean {
    return this.#motionOff || this.#reducedMotion;
  }

  togglePlay(): void {
    this.#togglePlayback('step');
  }

  togglePlayAll(): void {
    this.#togglePlayback('all');
  }

  /** Starts a playback mode, freezes it in place if it is running, or resumes it if frozen. */
  #togglePlayback(mode: 'step' | 'all'): void {
    if (this.#data.document.steps.length === 0) return;
    this.#setMotionOff(false);
    const running = mode === 'step' ? this.#isStepRunning() : this.#isAllRunning();
    if (running) {
      this.#paused = true;
    } else if (this.#paused) {
      this.#paused = false;
      this.#playMode = mode;
    } else {
      this.#playMode = mode;
      if (this.#stepIndex === null) {
        this.#showStep(0);
      } else {
        this.#phase = 0;
        this.#elapsed = 0;
        this.#renderPackets();
      }
    }
    this.#updatePlayButton();
    this.#ensureLoop();
  }

  selectNodeAnimation(nodeId: string): void {
    const phases = this.#view.phases;
    if (phases.length === 0) return;
    let matching = phases
      .map((pkts, idx) => (pkts.some((p) => p.from === nodeId) ? idx : -1))
      .filter((idx) => idx >= 0);
    if (matching.length === 0) {
      matching = phases
        .map((pkts, idx) => (pkts.some((p) => p.to === nodeId) ? idx : -1))
        .filter((idx) => idx >= 0);
    }
    if (matching.length === 0) return;

    const currentPos = matching.indexOf(this.#phase);
    if (this.#isStopped()) {
      // Each click shows the node's next phase; past the last one the still view returns.
      const picked = this.#pinned && currentPos >= 0 ? matching[currentPos + 1] : matching[0];
      if (picked !== undefined) {
        this.selectPhase(picked);
      } else {
        this.#pinned = false;
        this.#phase = 0;
        this.#renderPackets();
      }
      return;
    }
    const nextPhase =
      this.#playMode === 'node' && currentPos >= 0
        ? (matching[(currentPos + 1) % matching.length] ?? matching[0] ?? 0)
        : (matching[0] ?? 0);

    this.selectPhase(nextPhase);
  }

  /** Shows one phase: repeating it, or parked on its rail while animation is stopped. */
  selectPhase(index: number): void {
    if (!this.#view.phases[index]) return;
    this.#phase = index;
    this.#paused = false;
    if (this.#isStopped()) {
      this.#pinned = true;
      this.#renderPackets();
      return;
    }
    this.#playMode = 'node';
    this.#elapsed = 0;
    this.#renderPackets();
    this.#updatePlayButton();
    this.#ensureLoop();
  }

  toggleFollowAnim(): void {
    this.#followAnim = !this.#followAnim;
    this.#followBtn.setAttribute('aria-pressed', String(this.#followAnim));
    if (this.#followAnim) {
      this.#userMoved = false;
      this.#focusCurrentPhase(false);
    } else {
      this.#fit();
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  #renderChrome(): void {
    const { document: doc } = this.#data;
    this.#titleEl.textContent = doc.title;
    this.#svgEl.setAttribute('aria-label', doc.title || this.#strings.diagram);
    const noSteps = doc.steps.length === 0;
    this.#playBtn.disabled = noSteps;
    this.#playAllBtn.disabled = noSteps;
    this.#motionBtn.disabled = noSteps || this.#reducedMotion;
    this.#speedSelect.disabled = noSteps;
    clear(this.#stepSelect);
    this.#stepSelect.append(html('option', { value: 'overview' }, this.#strings.overview));
    doc.steps.forEach((step, i) => {
      this.#stepSelect.append(html('option', { value: String(i) }, `${i + 1}. ${step.title}`));
    });

    clear(this.#timelineEl);
    this.#timelineEl.hidden = noSteps;
    this.#tickFills = doc.steps.map(() =>
      html('span', { class: 'dav-tick-fill', 'aria-hidden': 'true' }),
    );
    doc.steps.forEach((step, i) => {
      const tick = html(
        'button',
        {
          type: 'button',
          class: 'dav-tick',
          title: step.title,
          'aria-label': `${i + 1}. ${step.title}`,
        },
        String(i + 1).padStart(2, '0'),
        this.#tickFills[i],
      );
      tick.addEventListener('click', () => this.#showStep(i));
      this.#timelineEl.append(tick);
    });
  }

  /** Recomputes what depends on the diagram's size, after a new document arrived. */
  #syncScale(): void {
    const { document: doc, layout } = this.#data;
    this.#large = isLargeDiagram(doc);
    this.#viewportEl.classList.toggle('dav-large', this.#large);
    this.#zoneOfNode = new Map();
    clear(this.#minimap);
    this.#miniView = null;
    if (!this.#large) {
      this.#minimap.setAttribute('hidden', '');
      return;
    }
    const zoneOfGroup = new Map<string, string>();
    for (const g of doc.groups) {
      zoneOfGroup.set(
        g.id,
        g.parentId === undefined ? g.id : (zoneOfGroup.get(g.parentId) ?? g.id),
      );
    }
    for (const n of doc.nodes) {
      const zone = n.parentId === undefined ? undefined : zoneOfGroup.get(n.parentId);
      if (zone !== undefined) this.#zoneOfNode.set(n.id, zone);
    }

    const zones = doc.groups.filter((g) => g.parentId === undefined);
    const rects = zones.flatMap((g) => layout.groups[g.id] ?? []);
    const b = boundsOf(rects, MINIMAP_PAD, 0);
    this.#minimap.removeAttribute('hidden');
    this.#minimap.setAttribute('viewBox', `${b.x} ${b.y} ${b.width} ${b.height}`);
    for (const zone of zones) {
      const r = layout.groups[zone.id];
      if (!r) continue;
      const color = zone.color ? paint(zone.color) : 'var(--dav-border-strong)';
      this.#minimap.append(
        svg('rect', {
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          rx: 16,
          fill: `color-mix(in srgb, ${color} 55%, transparent)`,
        }),
      );
    }
    this.#miniView = svg('rect', { class: 'dav-minimap-view' });
    this.#minimap.append(this.#miniView);
  }

  #panToMinimapPoint(e: MouseEvent): void {
    const matrix = this.#minimap.getScreenCTM();
    if (!matrix) return;
    const world = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
    const box = this.#svgEl.getBoundingClientRect();
    this.#userMoved = true;
    this.#cameraTarget = {
      zoom: this.#zoom,
      panX: box.width / 2 - world.x * this.#zoom,
      panY: box.height / 2 - world.y * this.#zoom,
    };
    this.#ensureLoop();
  }

  #showStep(index: number | null, opts: { keepPhase?: boolean } = {}): void {
    this.#view = resolveView(this.#data.document, this.#data.layout, index);
    this.#stepIndex = this.#view.stepIndex;
    clear(this.#sceneLayer);
    this.#sceneLayer.append(renderSvg(buildScene(this.#view, this.#data.icons)));
    this.#collectZoneLabels();
    if (!opts.keepPhase) this.#holdFrame = false;
    if (!opts.keepPhase || this.#phase >= this.#view.phases.length) {
      this.#phase = 0;
      this.#elapsed = 0;
      this.#pinned = false;
    }
    this.#renderPackets();
    this.#updateDock();
    if (!opts.keepPhase && !this.#followAnim && !this.#userMoved) this.#frameStep(true);
    this.#ensureLoop();
  }

  #renderPackets(): void {
    clear(this.#packetLayer);
    this.#packetEls = [];
    const stopped = this.#isStopped();
    this.#onPhaseChange?.(this.#view, stopped && !this.#pinned ? -1 : this.#phase);
    const phases = this.#view.phases;
    if (phases.length === 0) {
      if (this.#followAnim) this.#focusCurrentPhase(true);
      this.#updateZoneHud();
      return;
    }

    if (!stopped) {
      for (const packet of phases[this.#phase] ?? []) {
        this.#addPacket(packet, this.#packetProgress(packet));
      }
    } else if (this.#pinned) {
      // A picked phase is parked at the middle of its path.
      for (const packet of phases[this.#phase] ?? []) {
        this.#addPacket(packet, packet.roundTrip ? 0.25 : 0.5);
      }
    }
    this.#syncPhaseHighlights();
    if (this.#followAnim) this.#focusCurrentPhase(!stopped);
    else if (this.#large && !stopped && !this.#userMoved && !this.#holdFrame && !this.#fixedFrame) {
      this.#calmFocus(true, false);
    }
    this.#updateZoneHud();
  }

  #phaseMs(index: number): number {
    return this.#view.phaseDurations?.[index] ?? PHASE_MS;
  }

  #packetProgress(packet: Packet): number {
    return Math.min(1, this.#elapsed / (packet.durationMs ?? PHASE_MS));
  }

  #placePackets(): void {
    for (const entry of this.#packetEls) {
      this.#placePacket(entry, this.#packetProgress(entry.packet));
    }
  }

  /** Says which zones the current phase moves between, and outlines them. */
  #updateZoneHud(): void {
    for (const el of Array.from(this.#sceneLayer.querySelectorAll('.dav-group.is-zone-active'))) {
      el.classList.remove('is-zone-active');
      el.querySelector<SVGRectElement>('rect')?.style.removeProperty('stroke');
    }
    clear(this.#zoneHud);
    const phases = this.#view.phases;
    const packets = phases[Math.min(this.#phase, phases.length - 1)] ?? [];
    const showing = this.#large && packets.length > 0 && (!this.#isStopped() || this.#pinned);
    this.#zoneHud.hidden = !showing;
    this.#viewportEl.classList.toggle('has-zone-hud', showing);
    if (!showing) return;

    const groupById = new Map(this.#view.groups.map((g) => [g.id, g]));
    const zoneOf = (nodeId: string) => {
      const id = this.#zoneOfNode.get(nodeId);
      return id === undefined ? undefined : groupById.get(id);
    };
    const pairs = new Map<string, readonly [ResolvedGroup, ResolvedGroup]>();
    for (const p of packets) {
      const from = zoneOf(p.from);
      const to = zoneOf(p.to);
      if (from && to) pairs.set(`${from.id}\u0000${to.id}`, [from, to]);
    }
    const colorOf = (g: ResolvedGroup) => (g.color ? paint(g.color) : 'var(--dav-border-strong)');
    const name = (g: ResolvedGroup, departing: boolean) => {
      const dot = html('i', { class: 'dav-zone-dot' });
      dot.style.setProperty('background', colorOf(g));
      return html(
        'span',
        { class: departing ? 'dav-zone-name is-from' : 'dav-zone-name' },
        dot,
        g.label,
      );
    };
    const ms = this.#phaseMs(this.#phase) / this.#speed;
    for (const [from, to] of Array.from(pairs.values()).slice(0, MAX_HUD_PAIRS)) {
      const pair = html('span', { class: 'dav-zone-pair' });
      if (from === to) {
        pair.append(
          name(from, false),
          html('span', { class: 'dav-zone-inside' }, this.#strings.zoneInside),
        );
      } else {
        const progress = html('i');
        progress.style.setProperty('background', colorOf(to));
        progress.style.setProperty('animation-duration', `${ms.toFixed(0)}ms`);
        pair.append(
          name(from, true),
          html('span', { class: 'dav-zone-line' }, progress),
          name(to, false),
        );
      }
      this.#zoneHud.append(pair);
    }
    if (pairs.size > MAX_HUD_PAIRS) {
      this.#zoneHud.append(
        html('span', { class: 'dav-zone-inside' }, `+${pairs.size - MAX_HUD_PAIRS}`),
      );
    }

    const active = new Set(Array.from(pairs.values()).flat());
    for (const el of Array.from(this.#sceneLayer.querySelectorAll('.dav-group'))) {
      const group = groupById.get(el.getAttribute('data-id') ?? '');
      const rect = el.querySelector<SVGRectElement>('rect');
      if (!group || !rect || !active.has(group)) continue;
      el.classList.add('is-zone-active');
      rect.style.setProperty('stroke', colorOf(group));
    }
  }

  #collectZoneLabels(): void {
    const rects = new Map(this.#view.groups.map((g) => [g.id, g.rect]));
    this.#zoneLabels = !this.#large
      ? []
      : Array.from(this.#sceneLayer.querySelectorAll<SVGTextElement>('.dav-group-label')).flatMap(
          (el) => {
            const rect = rects.get(el.closest('[data-id]')?.getAttribute('data-id') ?? '');
            return rect ? [{ el, rect }] : [];
          },
        );
    this.#updateCameraOverlays();
  }

  /** The part of the diagram the camera shows, in diagram coordinates. */
  #visibleWorld(camera: { zoom: number; panX: number; panY: number }): Rect | null {
    const box = this.#svgEl.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return null;
    return {
      x: -camera.panX / camera.zoom,
      y: -camera.panY / camera.zoom,
      width: box.width / camera.zoom,
      height: box.height / camera.zoom,
    };
  }

  /** Keeps zone names legible and on screen, and the minimap on the camera. */
  #updateCameraOverlays(): void {
    if (!this.#large) return;
    const world = this.#visibleWorld({ zoom: this.#zoom, panX: this.#panX, panY: this.#panY });
    if (!world) return;
    const unit = 1 / this.#zoom;
    for (const { el, rect } of this.#zoneLabels) {
      const left = Math.max(rect.x, world.x);
      const top = Math.max(rect.y, world.y + ZONE_HUD_BAND * unit);
      const right = Math.min(rect.x + rect.width, world.x + world.width);
      const bottom = Math.min(rect.y + rect.height, world.y + world.height);
      if (right <= left || bottom <= top) {
        el.setAttribute('visibility', 'hidden');
        continue;
      }
      const size = ZONE_LABEL_SIZE * unit;
      el.removeAttribute('visibility');
      el.setAttribute('font-size', size.toFixed(2));
      el.setAttribute('x', (left + 8 * unit).toFixed(1));
      el.setAttribute('y', Math.min(top + size * 1.6, rect.y + rect.height - 4 * unit).toFixed(1));
      el.style.setProperty('stroke-width', `${(3 * unit).toFixed(2)}px`);
    }
    if (this.#miniView) {
      this.#miniView.setAttribute('x', world.x.toFixed(1));
      this.#miniView.setAttribute('y', world.y.toFixed(1));
      this.#miniView.setAttribute('width', world.width.toFixed(1));
      this.#miniView.setAttribute('height', world.height.toFixed(1));
    }
  }

  /**
   * A large diagram's camera: it moves only when the next packets would leave the screen,
   * and then frames their whole zones, so that the reader keeps their bearings.
   */
  #calmFocus(smooth: boolean, force: boolean): void {
    const phases = this.#view.phases;
    const packets = phases[Math.min(this.#phase, phases.length - 1)] ?? [];
    const { nodes, groups } = this.#data.layout;
    const spots = packets
      .flatMap((p) => [nodes[p.from], nodes[p.to]])
      .filter((r) => r !== undefined);
    if (spots.length === 0) return;

    const box = this.#svgEl.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    if (!force) {
      const world = this.#visibleWorld(
        this.#cameraTarget ?? { zoom: this.#zoom, panX: this.#panX, panY: this.#panY },
      );
      const need = boundsOf(spots, CALM_EDGE_MARGIN, 0);
      if (
        world &&
        need.x >= world.x &&
        need.y >= world.y &&
        need.x + need.width <= world.x + world.width &&
        need.y + need.height <= world.y + world.height
      ) {
        return;
      }
    }
    const zoneRects = packets
      .flatMap((p) => [this.#zoneOfNode.get(p.from), this.#zoneOfNode.get(p.to)])
      .flatMap((id) => (id !== undefined && groups[id] ? [groups[id]] : []));
    const zones = boundsOf(zoneRects.length > 0 ? zoneRects : spots, CALM_FRAME_PAD, 0);
    const zoomed = Math.min(box.width / zones.width, box.height / zones.height);
    const target = zoomed >= MIN_ZONE_FRAME_ZOOM ? zones : boundsOf(spots, CALM_FRAME_PAD, 0);
    this.#setCameraTarget(target, MAX_CALM_ZOOM, smooth);
  }

  /**
   * Shows the `.dav-flow` rail overlay only on the edges of the current animation phase,
   * or on every edge of the step while animation is stopped.
   */
  #syncPhaseHighlights(): void {
    const phases = this.#view.phases;
    if (phases.length === 0) return;
    const stopped = this.#isStopped();
    const running = phases[Math.min(this.#phase, phases.length - 1)] ?? [];
    // A phase picked while stopped goes first, so that its colors win on shared edges.
    const activeEdges = flowColors(
      stopped ? [...(this.#pinned ? running : []), ...phases.flat()] : running,
    );
    for (const flow of Array.from(this.#sceneLayer.querySelectorAll<SVGElement>('.dav-flow'))) {
      const color = activeEdges.get(flow.getAttribute('data-edge') ?? '');
      if (color === undefined) {
        flow.setAttribute('hidden', '');
      } else {
        flow.removeAttribute('hidden');
        flow.setAttribute('stroke', paint(color));
      }
    }
    for (const label of Array.from(this.#sceneLayer.querySelectorAll('.dav-edge-label text'))) {
      const color = activeEdges.get(label.getAttribute('data-edge') ?? '');
      label.setAttribute('fill', color === undefined ? 'var(--dav-fg)' : activeLabelFill(color));
      label.setAttribute('font-weight', color === undefined ? '400' : '700');
    }
    const currentPhase =
      stopped && !this.#pinned ? null : String(Math.min(this.#phase, phases.length - 1));
    for (const stop of Array.from(this.#sceneLayer.querySelectorAll('.dav-stop'))) {
      const current = stop.getAttribute('data-phase') === currentPhase;
      stop.classList.toggle('is-current', current);
      const fill = current ? stop.getAttribute('data-active-fill') : null;
      const text = current ? stop.getAttribute('data-active-text') : null;
      stop.querySelector('circle')?.setAttribute('fill', fill ?? 'var(--dav-fg)');
      stop.querySelector('text')?.setAttribute('fill', text ?? 'var(--dav-bg)');
    }
  }

  #addPacket(packet: Packet, t: number): void {
    const el = renderSvg(buildPacket(packet, this.#data.icons, t)) as SVGGElement;
    this.#packetLayer.append(el);
    const dotEl = el.querySelector('.dav-packet-dot') as SVGGElement | null;
    const bubbleEl = el.querySelector('.dav-packet-bubble') as SVGPathElement | null;
    const entry = { packet, box: computePacketCalloutBox(packet), dotEl, bubbleEl };
    this.#packetEls.push(entry);
    this.#placePacket(entry, t);
  }

  #placePacket(entry: PacketEntry, t: number): void {
    const p = packetPosition(entry.packet, t);
    entry.dotEl?.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    if (entry.bubbleEl && entry.box) {
      entry.bubbleEl.setAttribute('d', packetBubblePath(entry.box, p));
    }
  }

  #updateDock(): void {
    const s = this.#strings;
    const { steps } = this.#data.document;
    if (this.#view.stepIndex === null) {
      this.#stepTitleEl.textContent = s.overview;
      this.#stepDescEl.textContent = s.overviewHint;
      this.#stepSelect.value = 'overview';
    } else {
      clear(this.#stepTitleEl);
      this.#stepTitleEl.append(
        html('span', { class: 'dav-step-no' }, s.stepLabel(this.#view.stepIndex + 1, steps.length)),
        this.#view.stepTitle ?? '',
      );
      this.#stepDescEl.textContent = this.#view.description ?? '';
      this.#stepSelect.value = String(this.#view.stepIndex);
    }

    const current = this.#view.stepIndex;
    Array.from(this.#timelineEl.children).forEach((tick, i) => {
      tick.classList.toggle('is-current', i === current);
      tick.classList.toggle('is-past', current !== null && i < current);
      if (i === current) tick.setAttribute('aria-current', 'step');
      else tick.removeAttribute('aria-current');
    });
    this.#tickFills.forEach((fill, i) => {
      fill.style.transform = current !== null && i < current ? 'scaleX(1)' : 'scaleX(0)';
    });
    this.#updateStepProgress();

    this.#updatePlayButton();
  }

  /** Fills the current step's ruler graduation in proportion to its animation phases. */
  #updateStepProgress(): void {
    const fill = this.#stepIndex === null ? undefined : this.#tickFills[this.#stepIndex];
    if (!fill) return;
    const durations = this.#view.phases.map((_, i) => this.#phaseMs(i));
    const total = durations.reduce((sum, ms) => sum + ms, 0);
    const done =
      durations.slice(0, this.#phase).reduce((sum, ms) => sum + ms, 0) +
      Math.min(this.#elapsed, durations[this.#phase] ?? 0);
    const progress = total === 0 || this.#isStopped() ? 1 : Math.min(1, done / total);
    fill.style.transform = `scaleX(${progress.toFixed(3)})`;
  }

  #updatePlayButton(): void {
    this.#zoneHud.classList.toggle('is-paused', this.#paused);
    const stepPlaying = this.#isStepRunning();
    const stepAction = stepPlaying ? this.#strings.pause : this.#strings.play;
    clear(this.#playBtn);
    if (stepPlaying) {
      this.#playBtn.append(
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
      this.#playBtn.append(
        svg(
          'svg',
          {
            width: 15,
            height: 15,
            viewBox: '0 0 24 24',
            fill: 'currentColor',
            'aria-hidden': 'true',
          },
          svg('polygon', { points: '6 4 20 12 6 20 6 4' }),
        ),
      );
    }
    this.#playBtn.title = stepAction;
    this.#playBtn.setAttribute('aria-label', stepAction);
    this.#playBtn.setAttribute('aria-pressed', String(stepPlaying));

    const allPlaying = this.#isAllRunning();
    const allAction = allPlaying ? this.#strings.pause : this.#strings.playAll;
    clear(this.#playAllBtn);
    if (allPlaying) {
      this.#playAllBtn.append(
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
      this.#playAllBtn.append(
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
    this.#playAllBtn.title = allAction;
    this.#playAllBtn.setAttribute('aria-label', allAction);
    this.#playAllBtn.setAttribute('aria-pressed', String(allPlaying));
  }

  // ---------------------------------------------------------------------------
  // Animation loop
  // ---------------------------------------------------------------------------

  #ensureLoop(): void {
    const animating =
      this.#cameraTarget !== null ||
      (!this.#paused && !this.#isStopped() && this.#view.phases.length > 0);
    if (!animating && (this.#playMode === 'node' || this.#paused)) return;
    if (this.#frame) return;
    this.#lastFrame = performance.now();
    this.#frame = requestAnimationFrame((t) => this.#tick(t));
  }

  #tick(now: number): void {
    this.#frame = 0;
    const rawDt = Math.min(100, now - this.#lastFrame);
    const dt = rawDt * this.#speed;
    this.#lastFrame = now;
    if (!this.#paused) this.#elapsed += dt;

    if (this.#cameraTarget) {
      const alpha = 1 - Math.exp(-rawDt / 160);
      this.#zoom += (this.#cameraTarget.zoom - this.#zoom) * alpha;
      this.#panX += (this.#cameraTarget.panX - this.#panX) * alpha;
      this.#panY += (this.#cameraTarget.panY - this.#panY) * alpha;
      if (
        Math.abs(this.#cameraTarget.zoom - this.#zoom) < 0.002 &&
        Math.abs(this.#cameraTarget.panX - this.#panX) < 0.5 &&
        Math.abs(this.#cameraTarget.panY - this.#panY) < 0.5
      ) {
        this.#zoom = this.#cameraTarget.zoom;
        this.#panX = this.#cameraTarget.panX;
        this.#panY = this.#cameraTarget.panY;
        this.#cameraTarget = null;
      }
      this.#applyTransform();
    }

    if (this.#paused) {
      if (this.#cameraTarget !== null) this.#frame = requestAnimationFrame((t) => this.#tick(t));
      return;
    }

    const phases = this.#isStopped() ? [] : this.#view.phases;
    if (this.#playMode === 'node') {
      if (phases.length > 0) {
        this.#placePackets();
        if (this.#elapsed >= this.#phaseMs(this.#phase) + 400) {
          this.#elapsed = 0;
          for (const entry of this.#packetEls) this.#placePacket(entry, 0);
        }
      }
    } else if (this.#phase < phases.length) {
      this.#placePackets();
      if (this.#elapsed >= this.#phaseMs(this.#phase)) {
        this.#phase++;
        this.#elapsed = 0;
        if (this.#phase < phases.length) {
          this.#renderPackets();
        }
      }
    } else if (this.#elapsed >= HOLD_MS) {
      if (this.#playMode === 'all') {
        this.next();
        return;
      }
      // 'step' mode: replay all phases of the current step from the beginning.
      this.#phase = 0;
      this.#elapsed = 0;
      this.#renderPackets();
    }

    this.#updateStepProgress();

    // A step with no phases has nothing to time unless the player must move on from it.
    // Rendering a phase may already have scheduled the next frame through the camera.
    if (
      !this.#frame &&
      (this.#playMode === 'all' || phases.length > 0 || this.#cameraTarget !== null)
    ) {
      this.#frame = requestAnimationFrame((t) => this.#tick(t));
    }
  }

  // ---------------------------------------------------------------------------
  // Pan & zoom
  // ---------------------------------------------------------------------------

  #focusCurrentPhase(smooth: boolean): void {
    const box = this.#svgEl.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;

    const phases = this.#view.phases;
    const packets =
      phases.length === 0
        ? []
        : this.#isStopped() && !this.#pinned
          ? phases.flat()
          : (phases[Math.min(this.#phase, phases.length - 1)] ?? []);

    if (packets.length === 0) {
      const { nodes, groups } = this.#data.layout;
      const b = boundsOf([...Object.values(nodes), ...Object.values(groups)]);
      this.#setCameraTarget(b, 1.25, smooth);
      return;
    }

    const rects: Rect[] = [];
    const { nodes } = this.#data.layout;
    for (const pkt of packets) {
      const fromRect = nodes[pkt.from];
      const toRect = nodes[pkt.to];
      if (fromRect) rects.push(fromRect);
      if (toRect) rects.push(toRect);
      const callout = computePacketCalloutBox(pkt);
      if (callout) rects.push(calloutRect(callout));
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
    this.#setCameraTarget(targetBounds, 1.65, smooth);
  }

  #setCameraTarget(b: Rect, maxAutoZoom: number, smooth: boolean): void {
    const box = this.#svgEl.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    const zoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, Math.min(box.width / b.width, box.height / b.height, maxAutoZoom)),
    );
    const panX = (box.width - b.width * zoom) / 2 - b.x * zoom;
    const panY = (box.height - b.height * zoom) / 2 - b.y * zoom;

    if (!smooth || this.#reducedMotion) {
      this.#cameraTarget = null;
      this.#zoom = zoom;
      this.#panX = panX;
      this.#panY = panY;
      this.#applyTransform();
      return;
    }
    this.#cameraTarget = { zoom, panX, panY };
    this.#ensureLoop();
  }

  /** Shows the whole diagram and hands the camera back to automatic framing. */
  #fit(): void {
    this.#userMoved = false;
    this.#setCameraTarget(this.#wholeDiagramBounds(), MAX_FIT_ZOOM, false);
  }

  #wholeDiagramBounds(): Rect {
    const { nodes, groups } = this.#data.layout;
    // A callout moved aside can reach past the diagram.
    const movedCallouts = this.#view.phases
      .flat()
      .filter((packet) => packet.calloutShift !== undefined)
      .flatMap((packet) => computePacketCalloutBox(packet) ?? [])
      .map(calloutRect);
    return boundsOf([...Object.values(nodes), ...Object.values(groups), ...movedCallouts]);
  }

  /**
   * Frames what the current step is about, so text stays legible on wide diagrams.
   * Steps without a focus (and the overview) show the whole diagram.
   */
  #frameStep(smooth: boolean): void {
    if (
      this.#large &&
      !this.#fixedFrame &&
      !this.#holdFrame &&
      !this.#isStopped() &&
      this.#view.phases.length > 0
    ) {
      this.#calmFocus(smooth, true);
      return;
    }
    const rects = this.#view.nodes.filter((n) => n.focused).map((n) => n.rect);
    if (rects.length === 0 || this.#fixedFrame) {
      this.#setCameraTarget(this.#wholeDiagramBounds(), MAX_FIT_ZOOM, smooth);
      return;
    }
    for (const packet of this.#view.phases.flat()) {
      const callout = computePacketCalloutBox(packet);
      if (callout) rects.push(calloutRect(callout));
    }
    this.#setCameraTarget(boundsOf(rects), MAX_FIT_ZOOM, smooth);
  }

  #zoomBy(factor: number, cx?: number, cy?: number): void {
    this.#cameraTarget = null;
    const box = this.#svgEl.getBoundingClientRect();
    const x = cx ?? box.width / 2;
    const y = cy ?? box.height / 2;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.#zoom * factor));
    const k = next / this.#zoom;
    this.#panX = x - (x - this.#panX) * k;
    this.#panY = y - (y - this.#panY) * k;
    this.#zoom = next;
    this.#userMoved = true;
    this.#applyTransform();
  }

  #applyTransform(): void {
    this.#world.setAttribute(
      'transform',
      `translate(${this.#panX.toFixed(1)} ${this.#panY.toFixed(1)}) scale(${this.#zoom.toFixed(4)})`,
    );
    this.#zoomLabel.textContent = `${Math.round(this.#zoom * 100)}%`;
    this.#updateCameraOverlays();
  }

  #bindPointer(viewport: HTMLElement): void {
    let drag: { id: number; x: number; y: number; captured: boolean } | null = null;
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || e.defaultPrevented) return;
      if ((e.target as Element | null)?.closest('.dav-zoom-group, .dav-minimap')) return;
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
      this.#cameraTarget = null;
      this.#panX += dx;
      this.#panY += dy;
      drag.x = e.clientX;
      drag.y = e.clientY;
      this.#userMoved = true;
      this.#applyTransform();
    };
    const up = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId) return;
      const wasDragged = drag.captured;
      if (drag.captured && viewport.hasPointerCapture(e.pointerId)) {
        viewport.releasePointerCapture(e.pointerId);
      }
      drag = null;
      viewport.classList.remove('dav-dragging');
      if (!wasDragged && e.type === 'pointerup') {
        const nodeEl = (e.target as Element | null)?.closest('.dav-node');
        const nodeId = nodeEl?.getAttribute('data-id');
        if (nodeId) this.selectNodeAnimation(nodeId);
      }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const box = this.#svgEl.getBoundingClientRect();
      this.#zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX - box.left, e.clientY - box.top);
    };
    viewport.addEventListener('pointerdown', down);
    viewport.addEventListener('pointermove', move);
    viewport.addEventListener('pointerup', up);
    viewport.addEventListener('pointercancel', up);
    viewport.addEventListener('wheel', wheel, { passive: false });
  }

  #bindKeyboard(target: Window | HTMLElement): void {
    const onKey = (e: Event) => {
      if (!this.#root.isConnected) return;
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
      else if (ke.key === 'Home') this.#showStep(null);
      else return;
      ke.preventDefault();
    };
    target.addEventListener('keydown', onKey);
    this.#cleanups.push(() => target.removeEventListener('keydown', onKey));
    if (target !== window && !this.#root.contains(this.#playbackBar)) {
      this.#playbackBar.addEventListener('keydown', onKey);
      this.#cleanups.push(() => this.#playbackBar.removeEventListener('keydown', onKey));
    }
  }

  #button(
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

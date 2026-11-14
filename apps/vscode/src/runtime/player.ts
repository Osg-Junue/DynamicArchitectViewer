import type { Layout } from '../layout';
import type { DavDocument } from '../model/types';
import {
  buildDefs,
  buildScene,
  calmFrame,
  clamp,
  followFrame,
  HOLD_MS,
  type IconShapes,
  measureCalloutsWith,
  type Packet,
  PHASE_MS,
  packetsOnScreen,
  type ResolvedView,
  resolveView,
  stepFrame,
  wholeDiagramFrame,
  zoneMoves,
} from '../scene';
import { Camera } from './camera';
import {
  type Controls,
  createControls,
  isPlaybackSpeed,
  type PlayMode,
  SPEEDS,
  setButtonPressed,
  showPlayback,
} from './controls';
import { StepDock } from './dock';
import { clear, html, renderSvg, svg } from './dom';
import { VIEWER_STRINGS, type ViewerLocale, type ViewerStrings } from './i18n';
import { bindKeyboard, bindPointer, trackInputModality } from './input';
import { browserTextMeasure } from './measure';
import { Minimap } from './minimap';
import { PacketLayer } from './packets';
import {
  collectSceneTargets,
  outlineZones,
  type SceneTargets,
  syncPhaseHighlights,
} from './sceneHighlights';
import { renderZoneHud } from './zoneHud';
import { ZoneLabels } from './zoneLabels';

export { HOLD_MS, SPEEDS };

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

function phasesWhere(phases: readonly Packet[][], pred: (p: Packet) => boolean): number[] {
  return phases.flatMap((pkts, idx) => (pkts.some(pred) ? [idx] : []));
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
  /** What the play button and Space play, chosen in the menu beside the button. */
  #mode: PlayMode;
  #speed = 1;
  #view: ResolvedView;

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
  #targets: SceneTargets = { groups: [], flows: [], edgeLabels: [], stops: [] };

  readonly #camera: Camera;
  #userMoved = false;
  #followAnim = false;
  /** The reader asked for the whole diagram; the camera stays until the next step. */
  #holdFrame = false;

  readonly #root: HTMLElement;
  readonly #zoneHud: HTMLElement;
  readonly #minimap: Minimap;
  readonly #zoneLabels = new ZoneLabels();
  readonly #packets = new PacketLayer();
  readonly #dock: StepDock;
  readonly #controls: Controls;
  readonly #svgEl: SVGSVGElement;
  readonly #world: SVGGElement;
  readonly #sceneLayer: SVGGElement;
  readonly #titleEl: HTMLElement;
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
    const initialStep =
      options.initialStep !== undefined
        ? hasSteps && options.initialStep !== null
          ? clamp(options.initialStep, 0, data.document.steps.length - 1)
          : null
        : hasSteps
          ? 0
          : null;
    // In a browser the callouts are sized by the text as it is drawn, not by an estimate.
    measureCalloutsWith(browserTextMeasure());
    this.#view = resolveView(data.document, data.layout, initialStep);
    this.#stepIndex = this.#view.stepIndex;
    this.#playMode =
      !hasSteps || !options.autoplay || this.#reducedMotion
        ? 'node'
        : options.autoplay === 'step'
          ? 'step'
          : 'all';
    // The play button plays the current step unless the page asked to run through all of them.
    this.#mode = options.autoplay === true ? 'all' : 'step';
    if (options.speed !== undefined && isPlaybackSpeed(options.speed)) {
      this.#speed = options.speed;
    }

    const s = this.#strings;
    this.#svgEl = svg('svg', { class: 'dav-canvas', role: 'img' });
    this.#world = svg('g', { class: 'dav-world' });
    this.#sceneLayer = svg('g');
    this.#svgEl.append(renderSvg(buildDefs()), this.#world);
    this.#world.append(this.#sceneLayer, this.#zoneLabels.layer, this.#packets.layer);
    this.#camera = new Camera(
      this.#svgEl,
      this.#world,
      this.#reducedMotion,
      () => this.#onCameraMove(),
      () => this.#ensureLoop(),
    );

    this.#titleEl = html('h1', { class: 'dav-title' });
    this.#dock = new StepDock(s, (index) => this.#showStep(index));
    this.#controls = createControls(s, this.#speed, {
      selectStep: (index) => this.#showStep(index),
      prev: () => this.prev(),
      next: () => this.next(),
      togglePlayback: () => this.#togglePlayback(this.#mode),
      playIn: (mode) => this.#playIn(mode),
      toggleMotion: () => this.toggleMotion(),
      setSpeed: (speed) => {
        this.#speed = speed;
      },
      zoomBy: (factor) => this.#zoomBy(factor),
      fit: () => this.#showWholeDiagram(),
      toggleFollow: () => this.toggleFollowAnim(),
      toggleMinimap: () => this.toggleMinimap(),
    });
    const { playbackBar, zoomGroup } = this.#controls;
    this.#controls.stepHead.append(this.#dock.info);

    if (options.playbackSlot) {
      clear(options.playbackSlot);
      options.playbackSlot.append(playbackBar);
    }

    this.#zoneHud = html('div', {
      class: 'dav-zone-hud',
      'aria-hidden': 'true',
      'data-testid': 'zone-hud',
    });
    this.#zoneHud.hidden = true;
    this.#minimap = new Minimap((x, y) => this.#panTo(x, y));

    const viewport = html(
      'main',
      { class: 'dav-viewport' },
      this.#svgEl,
      this.#zoneHud,
      this.#titleEl,
      this.#minimap.element,
      zoomGroup,
    );
    this.#root = html(
      'div',
      { class: 'dav-app', tabindex: '0' },
      html(
        'header',
        { class: 'dav-topbar' },
        !options.playbackSlot && html('div', { class: 'dav-topbar-main' }, playbackBar),
        this.#dock.element,
      ),
      viewport,
    );
    container.append(this.#root);

    bindPointer(viewport, this.#svgEl, {
      panBy: (dx, dy) => {
        this.#camera.panBy(dx, dy);
        this.#userMoved = true;
      },
      zoomAt: (factor, x, y) => this.#zoomBy(factor, x, y),
      selectNode: (nodeId) => this.selectNodeAnimation(nodeId),
    });
    trackInputModality();
    this.#cleanups.push(
      bindKeyboard(options.globalKeyboard ? window : this.#root, this.#root, playbackBar, {
        next: () => this.next(),
        prev: () => this.prev(),
        togglePlay: () => this.#togglePlayback(this.#mode),
        showOverview: () => this.#showStep(null),
      }),
    );
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        this.#camera.invalidateSize();
        this.#reframe();
      });
      ro.observe(viewport);
      this.#cleanups.push(() => ro.disconnect());
    }

    this.#syncZones();
    this.#renderChrome();
    this.#updateMotionButton();
    this.#applyView(this.#view);
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
    this.#syncZones();
    this.#renderChrome();
    this.#showStep(index, { keepPhase: true });
    this.#reframe();
  }

  destroy(): void {
    cancelAnimationFrame(this.#frame);
    this.#controls.closeMenus();
    for (const c of this.#cleanups) c();
    this.#controls.playbackBar.remove();
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
    setButtonPressed(
      this.#controls.motionBtn,
      off,
      off ? this.#strings.startMotion : this.#strings.stopMotion,
    );
  }

  #isStopped(): boolean {
    return this.#motionOff || this.#reducedMotion;
  }

  /**
   * Plays a mode chosen in the menu, which the play button then keeps. A playback under way
   * carries on from where it is in the new mode; a paused one resumes.
   */
  #playIn(mode: PlayMode): void {
    this.#mode = mode;
    if (this.isPlaying()) {
      this.#playMode = mode;
      this.#updatePlayButton();
      this.#ensureLoop();
    } else {
      this.#togglePlayback(mode);
    }
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
    let matching = phasesWhere(phases, (p) => p.from === nodeId);
    if (matching.length === 0) matching = phasesWhere(phases, (p) => p.to === nodeId);
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

  toggleMinimap(): void {
    setButtonPressed(this.#controls.minimapBtn, this.#minimap.toggle());
    this.#updateCameraOverlays();
  }

  toggleFollowAnim(): void {
    this.#followAnim = !this.#followAnim;
    setButtonPressed(this.#controls.followBtn, this.#followAnim);
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
    this.#controls.playBtn.disabled = noSteps;
    this.#controls.playModeBtn.disabled = noSteps;
    this.#controls.motionBtn.disabled = noSteps || this.#reducedMotion;
    this.#controls.speedSelect.disabled = noSteps;
    clear(this.#controls.stepSelect);
    this.#controls.stepSelect.append(html('option', { value: 'overview' }, this.#strings.overview));
    doc.steps.forEach((step, i) => {
      this.#controls.stepSelect.append(
        html('option', { value: String(i) }, `${i + 1}. ${step.title}`),
      );
    });
    this.#dock.setSteps(doc.steps);
  }

  /** Recomputes what depends on the diagram's zones, after a new document arrived. */
  #syncZones(): void {
    const { document: doc, layout } = this.#data;
    const hasZones = doc.groups.length > 0;
    this.#controls.minimapBtn.hidden = !hasZones;
    // The moves float over the canvas, so that it never resizes during playback.
    this.#zoneHud.hidden = !hasZones;
    this.#minimap.setDiagram(doc, layout);
  }

  #panTo(x: number, y: number): void {
    this.#userMoved = true;
    this.#camera.centerOn(x, y);
  }

  #showStep(index: number | null, opts: { keepPhase?: boolean } = {}): void {
    this.#applyView(resolveView(this.#data.document, this.#data.layout, index), opts);
  }

  #applyView(view: ResolvedView, opts: { keepPhase?: boolean } = {}): void {
    this.#view = view;
    this.#stepIndex = view.stepIndex;
    clear(this.#sceneLayer);
    this.#sceneLayer.append(renderSvg(buildScene(this.#view, this.#data.icons)));
    this.#zoneLabels.collect(this.#sceneLayer, this.#view, this.#data.document.groups);
    this.#targets = collectSceneTargets(this.#sceneLayer);
    this.#updateCameraOverlays();
    this.#minimap.showStep(this.#view);
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
    this.#packets.clear();
    const stopped = this.#isStopped();
    this.#onPhaseChange?.(this.#view, stopped && !this.#pinned ? -1 : this.#phase);
    const phases = this.#view.phases;
    if (phases.length === 0) {
      if (this.#followAnim) this.#focusCurrentPhase(true);
      this.#updateZoneHud();
      return;
    }

    const active = phases[this.#phase] ?? [];
    if (!stopped) {
      this.#packets.render(active, this.#data.icons, (packet) =>
        Math.min(1, this.#elapsed / packet.durationMs),
      );
    } else if (this.#pinned) {
      // A picked phase is parked at the middle of its path.
      this.#packets.render(active, this.#data.icons, (packet) => (packet.roundTrip ? 0.25 : 0.5));
    }
    syncPhaseHighlights(this.#targets, phases, this.#phase, stopped, this.#pinned);
    if (this.#followAnim) this.#focusCurrentPhase(!stopped);
    else if (
      !stopped &&
      !this.#userMoved &&
      !this.#holdFrame &&
      !this.#fixedFrame &&
      !this.#packetsOnScreen()
    ) {
      this.#calmFocus(true);
    }
    this.#updateZoneHud();
  }

  #currentPackets(): Packet[] {
    const phases = this.#view.phases;
    return phases[Math.min(this.#phase, phases.length - 1)] ?? [];
  }

  #phaseMs(index: number): number {
    return this.#view.phaseDurations[index] ?? PHASE_MS;
  }

  /** Says which zones the current phase moves between, and outlines them. */
  #updateZoneHud(): void {
    clear(this.#zoneHud);
    const packets = this.#currentPackets();
    if (packets.length === 0 || (this.#isStopped() && !this.#pinned)) {
      outlineZones(this.#targets, []);
      return;
    }
    const moves = zoneMoves(this.#view, packets);
    const ms = this.#phaseMs(this.#phase) / this.#speed;
    renderZoneHud(this.#zoneHud, moves, ms);
    outlineZones(this.#targets, moves);
  }

  /** Keeps zone names and the minimap on the camera. */
  #updateCameraOverlays(): void {
    const world = this.#camera.visibleWorld();
    if (!world) return;
    this.#zoneLabels.follow(world);
    this.#minimap.setCamera(world);
  }

  /** Whether the camera, where it is heading, already shows the current phase. */
  #packetsOnScreen(): boolean {
    const world = this.#camera.destinationWorld();
    return !world || packetsOnScreen(this.#data.layout, this.#currentPackets(), world);
  }

  /** Frames the whole zones of the current phase, so that the reader keeps their bearings. */
  #calmFocus(smooth: boolean): void {
    const frame = calmFrame(this.#camera.viewSize, this.#data.layout, this.#currentPackets());
    if (frame) this.#camera.frame(frame, smooth);
  }

  #updateDock(): void {
    this.#controls.stepSelect.value =
      this.#view.stepIndex === null ? 'overview' : String(this.#view.stepIndex);
    this.#dock.showStep(this.#view, this.#data.document.steps.length);
    this.#updateStepProgress();
    this.#updatePlayButton();
  }

  /** Fills the current step's ruler graduation in proportion to its animation phases. */
  #updateStepProgress(): void {
    this.#dock.updateProgress(
      this.#stepIndex,
      this.#view.phaseDurations,
      this.#phase,
      this.#elapsed,
      this.#isStopped(),
    );
  }

  #updatePlayButton(): void {
    this.#zoneHud.classList.toggle('is-paused', this.#paused);
    showPlayback(this.#controls, this.#strings, this.#mode, this.isPlaying());
  }

  // ---------------------------------------------------------------------------
  // Animation loop
  // ---------------------------------------------------------------------------

  #ensureLoop(): void {
    const animating =
      this.#camera.isEasing ||
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

    this.#camera.advance(rawDt);

    if (this.#paused) {
      if (this.#camera.isEasing) this.#frame = requestAnimationFrame((t) => this.#tick(t));
      return;
    }

    const phases = this.#isStopped() ? [] : this.#view.phases;
    if (this.#playMode === 'node') {
      if (phases.length > 0) {
        this.#packets.place(this.#elapsed);
        if (this.#elapsed >= this.#phaseMs(this.#phase) + 400) {
          this.#elapsed = 0;
          this.#packets.reset();
        }
      }
    } else if (this.#phase < phases.length) {
      this.#packets.place(this.#elapsed);
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
    if (!this.#frame && (this.#playMode === 'all' || phases.length > 0 || this.#camera.isEasing)) {
      this.#frame = requestAnimationFrame((t) => this.#tick(t));
    }
  }

  // ---------------------------------------------------------------------------
  // Pan & zoom
  // ---------------------------------------------------------------------------

  #reframe(): void {
    if (this.#followAnim) this.#focusCurrentPhase(false);
    else if (!this.#userMoved) this.#frameStep(false);
  }

  #focusCurrentPhase(smooth: boolean): void {
    const phases = this.#view.phases;
    const packets =
      phases.length === 0
        ? []
        : this.#isStopped() && !this.#pinned
          ? phases.flat()
          : this.#currentPackets();
    this.#camera.frame(followFrame(this.#data.layout, packets), smooth);
  }

  /** Shows the whole diagram and hands the camera back to automatic framing. */
  #fit(): void {
    this.#userMoved = false;
    this.#camera.frame(wholeDiagramFrame(this.#data.layout, this.#view), false);
  }

  /** The fit button: stops following, and keeps the whole diagram until the next step. */
  #showWholeDiagram(): void {
    if (this.#followAnim) {
      this.#followAnim = false;
      setButtonPressed(this.#controls.followBtn, false);
    }
    this.#holdFrame = true;
    this.#fit();
  }

  #onCameraMove(): void {
    this.#controls.zoomLabel.textContent = `${Math.round(this.#camera.zoom * 100)}%`;
    this.#updateCameraOverlays();
  }

  /** Frames what the current step is about (see `stepFrame`). */
  #frameStep(smooth: boolean): void {
    const follow = !this.#holdFrame && !this.#isStopped() && this.#view.phases.length > 0;
    const frame = stepFrame(this.#camera.viewSize, this.#data.layout, this.#view, {
      fixed: this.#fixedFrame,
      ...(follow ? { follow: this.#currentPackets() } : {}),
    });
    this.#camera.frame(frame, smooth);
  }

  #zoomBy(factor: number, cx?: number, cy?: number): void {
    this.#camera.zoomBy(factor, cx, cy);
    this.#userMoved = true;
  }
}

import type { Layout, Rect } from '../layout';
import type { DavDocument } from '../model/types';
import {
  activeLabelFill,
  type Bezier,
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
  type ResolvedView,
  resolveView,
  type ZoneMove,
  zoneColor,
  zoneMoves,
} from '../scene';
import { Camera } from './camera';
import { CONTROL_ICONS } from './controlIcons';
import { type Controls, createControls, SPEEDS, showPlayState } from './controls';
import { clear, html, renderSvg, svg } from './dom';
import { VIEWER_STRINGS, type ViewerLocale, type ViewerStrings } from './i18n';
import { Minimap } from './minimap';
import { renderZoneHud } from './zoneHud';
import { ZoneLabels } from './zoneLabels';

export { SPEEDS };

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

/** Pause after a step's last phase at 1x. */
export const HOLD_MS = 1800;
const MAX_FIT_ZOOM = 1.4;
/** Room kept around what the camera shows while it follows packets from zone to zone. */
const CALM_FRAME_PAD = 120;
/** Below this zoom, text stops being comfortable to read. */
const MIN_ZONE_FRAME_ZOOM = 0.6;
const MAX_CALM_ZOOM = 1.25;
/** How close to the screen's edge a moving packet may get before the camera follows. */
const CALM_EDGE_MARGIN = 40;
/** Room kept around what the camera shows while it follows every phase. */
const FOLLOW_PAD = 56;
const FOLLOW_MIN_SIZE = { width: 200, height: 160 };
const MAX_FOLLOW_ZOOM = 1.65;

interface PacketEntry {
  packet: Packet;
  box: PacketCalloutBox | null;
  dotEl: SVGGElement | null;
  bubbleEl: SVGPathElement | null;
}

/** The box around a curve's control points. */
function controlBox({ p0, p1, p2, p3 }: Bezier): Rect {
  const xs = [p0.x, p1.x, p2.x, p3.x];
  const ys = [p0.y, p1.y, p2.y, p3.y];
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
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

  readonly #camera: Camera;
  #userMoved = false;
  #followAnim = false;
  /** The reader asked for the whole diagram; the camera stays until the next step. */
  #holdFrame = false;

  readonly #root: HTMLElement;
  readonly #zoneHud: HTMLElement;
  readonly #minimap: Minimap;
  readonly #zoneLabels = new ZoneLabels();
  readonly #controls: Controls;
  readonly #svgEl: SVGSVGElement;
  readonly #world: SVGGElement;
  readonly #sceneLayer: SVGGElement;
  readonly #packetLayer: SVGGElement;
  readonly #titleEl: HTMLElement;
  readonly #stepTitleEl: HTMLElement;
  readonly #stepDescEl: HTMLElement;
  readonly #timelineEl: HTMLElement;
  #tickFills: HTMLElement[] = [];
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
    this.#world.append(this.#sceneLayer, this.#zoneLabels.layer, this.#packetLayer);
    this.#camera = new Camera(
      this.#svgEl,
      this.#world,
      this.#reducedMotion,
      () => this.#onCameraMove(),
      () => this.#ensureLoop(),
    );

    this.#titleEl = html('h1', { class: 'dav-title' });
    this.#stepTitleEl = html('div', { class: 'dav-step-title' });
    this.#stepDescEl = html('div', { class: 'dav-step-desc' });
    this.#timelineEl = html('div', {
      class: 'dav-timeline',
      role: 'group',
      'aria-label': s.steps,
      'data-testid': 'step-timeline',
    });
    this.#controls = createControls(s, this.#speed, {
      selectStep: (index) => this.#showStep(index),
      togglePlay: () => this.togglePlay(),
      togglePlayAll: () => this.togglePlayAll(),
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
      this.#zoneHud,
      viewport,
    );
    container.append(this.#root);

    this.#bindPointer(viewport);
    this.#bindKeyboard(options.globalKeyboard ? window : this.#root);
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => {
        this.#camera.invalidateSize();
        if (this.#followAnim) this.#focusCurrentPhase(false);
        else if (!this.#userMoved) this.#frameStep(false);
      });
      ro.observe(viewport);
      this.#cleanups.push(() => ro.disconnect());
    }

    this.#syncZones();
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
    this.#syncZones();
    this.#renderChrome();
    this.#showStep(index, { keepPhase: true });
    if (this.#followAnim) this.#focusCurrentPhase(false);
    else if (!this.#userMoved) this.#frameStep(false);
  }

  destroy(): void {
    cancelAnimationFrame(this.#frame);
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

  getSpeed(): number {
    return this.#speed;
  }

  clientToWorld(clientX: number, clientY: number): { x: number; y: number } {
    return this.#camera.clientToWorld(clientX, clientY);
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
    this.#controls.motionBtn.title = action;
    this.#controls.motionBtn.setAttribute('aria-label', action);
    this.#controls.motionBtn.setAttribute('aria-pressed', String(off));
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

  toggleMinimap(): void {
    this.#controls.minimapBtn.setAttribute('aria-pressed', String(this.#minimap.toggle()));
    this.#updateCameraOverlays();
  }

  toggleFollowAnim(): void {
    this.#followAnim = !this.#followAnim;
    this.#controls.followBtn.setAttribute('aria-pressed', String(this.#followAnim));
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
    this.#controls.playAllBtn.disabled = noSteps;
    this.#controls.motionBtn.disabled = noSteps || this.#reducedMotion;
    this.#controls.speedSelect.disabled = noSteps;
    clear(this.#controls.stepSelect);
    this.#controls.stepSelect.append(html('option', { value: 'overview' }, this.#strings.overview));
    doc.steps.forEach((step, i) => {
      this.#controls.stepSelect.append(
        html('option', { value: String(i) }, `${i + 1}. ${step.title}`),
      );
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

  /** Recomputes what depends on the diagram's zones, after a new document arrived. */
  #syncZones(): void {
    const { document: doc, layout } = this.#data;
    const hasZones = doc.groups.length > 0;
    this.#controls.minimapBtn.hidden = !hasZones;
    // The strip stays while the zones change, so that the canvas never resizes during playback.
    this.#zoneHud.hidden = !hasZones;
    this.#minimap.setDiagram(doc, layout);
  }

  #panTo(x: number, y: number): void {
    this.#userMoved = true;
    this.#camera.centerOn(x, y);
  }

  #showStep(index: number | null, opts: { keepPhase?: boolean } = {}): void {
    this.#view = resolveView(this.#data.document, this.#data.layout, index);
    this.#stepIndex = this.#view.stepIndex;
    clear(this.#sceneLayer);
    this.#sceneLayer.append(renderSvg(buildScene(this.#view, this.#data.icons)));
    this.#zoneLabels.collect(this.#sceneLayer, this.#view, this.#data.document.groups);
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

  #packetProgress(packet: Packet): number {
    return Math.min(1, this.#elapsed / packet.durationMs);
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
    const packets = this.#currentPackets();
    if (packets.length === 0 || (this.#isStopped() && !this.#pinned)) return;
    const moves = zoneMoves(this.#view, packets);
    const ms = this.#phaseMs(this.#phase) / this.#speed;
    renderZoneHud(this.#zoneHud, moves, ms, this.#strings.zoneInside);
    this.#outlineZones(moves);
  }

  #outlineZones(moves: readonly ZoneMove[]): void {
    const active = new Map(moves.flat().map((place) => [place.id, place]));
    for (const el of Array.from(this.#sceneLayer.querySelectorAll('.dav-group'))) {
      const zone = active.get(el.getAttribute('data-id') ?? '');
      const rect = el.querySelector<SVGRectElement>('rect');
      if (!zone || !rect) continue;
      el.classList.add('is-zone-active');
      rect.style.setProperty('stroke', zoneColor(zone.color));
    }
  }

  /** Keeps zone names and the minimap on the camera. */
  #updateCameraOverlays(): void {
    const world = this.#camera.visibleWorld();
    if (!world) return;
    this.#zoneLabels.follow(world);
    this.#minimap.setCamera(world);
  }

  /** The rectangles of the nodes the current phase moves between. */
  #phaseSpots(): Rect[] {
    const { nodes } = this.#data.layout;
    return this.#currentPackets()
      .flatMap((p) => [nodes[p.from], nodes[p.to]])
      .filter((r) => r !== undefined);
  }

  /** Whether the camera, where it is heading, already shows the current phase. */
  #packetsOnScreen(): boolean {
    const spots = this.#phaseSpots();
    const world = this.#camera.destinationWorld();
    if (spots.length === 0 || !world) return true;
    const need = boundsOf(spots, CALM_EDGE_MARGIN, 0);
    return (
      need.x >= world.x &&
      need.y >= world.y &&
      need.x + need.width <= world.x + world.width &&
      need.y + need.height <= world.y + world.height
    );
  }

  /** Frames the whole zones of the current phase, so that the reader keeps their bearings. */
  #calmFocus(smooth: boolean): void {
    const spots = this.#phaseSpots();
    if (spots.length === 0) return;
    const { groups } = this.#data.layout;
    const zoneRects = this.#currentPackets()
      .flatMap((p) => [p.fromZone, p.toZone])
      .flatMap((id) => (id !== undefined && groups[id] ? [groups[id]] : []));
    const zones = boundsOf(zoneRects.length > 0 ? zoneRects : spots, CALM_FRAME_PAD, 0);
    const target =
      this.#camera.fitZoom(zones) >= MIN_ZONE_FRAME_ZOOM
        ? zones
        : boundsOf(spots, CALM_FRAME_PAD, 0);
    this.#camera.frame(target, MAX_CALM_ZOOM, smooth);
  }

  /**
   * Shows the `.dav-flow` rail overlay only on the edges of the current animation phase,
   * or on every edge of the step while animation is stopped.
   */
  #syncPhaseHighlights(): void {
    const phases = this.#view.phases;
    if (phases.length === 0) return;
    const stopped = this.#isStopped();
    const running = this.#currentPackets();
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
      this.#controls.stepSelect.value = 'overview';
    } else {
      clear(this.#stepTitleEl);
      this.#stepTitleEl.append(
        html('span', { class: 'dav-step-no' }, s.stepLabel(this.#view.stepIndex + 1, steps.length)),
        this.#view.stepTitle ?? '',
      );
      this.#stepDescEl.textContent = this.#view.description ?? '';
      this.#controls.stepSelect.value = String(this.#view.stepIndex);
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
    const durations = this.#view.phaseDurations;
    const total = durations.reduce((sum, ms) => sum + ms, 0);
    const done =
      durations.slice(0, this.#phase).reduce((sum, ms) => sum + ms, 0) +
      Math.min(this.#elapsed, durations[this.#phase] ?? 0);
    const progress = total === 0 || this.#isStopped() ? 1 : Math.min(1, done / total);
    fill.style.transform = `scaleX(${progress.toFixed(3)})`;
  }

  #updatePlayButton(): void {
    this.#zoneHud.classList.toggle('is-paused', this.#paused);
    const { playBtn, playAllBtn } = this.#controls;
    const s = this.#strings;
    showPlayState(playBtn, this.#isStepRunning(), CONTROL_ICONS.play, s.play, s.pause);
    showPlayState(playAllBtn, this.#isAllRunning(), CONTROL_ICONS.playAll, s.playAll, s.pause);
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
    if (!this.#frame && (this.#playMode === 'all' || phases.length > 0 || this.#camera.isEasing)) {
      this.#frame = requestAnimationFrame((t) => this.#tick(t));
    }
  }

  // ---------------------------------------------------------------------------
  // Pan & zoom
  // ---------------------------------------------------------------------------

  #focusCurrentPhase(smooth: boolean): void {
    const phases = this.#view.phases;
    const packets =
      phases.length === 0
        ? []
        : this.#isStopped() && !this.#pinned
          ? phases.flat()
          : this.#currentPackets();

    const { nodes, groups } = this.#data.layout;
    if (packets.length === 0) {
      const whole = boundsOf([...Object.values(nodes), ...Object.values(groups)]);
      this.#camera.frame(whole, MAX_CALM_ZOOM, smooth);
      return;
    }

    const rects = packets.flatMap((packet) => [
      ...[nodes[packet.from], nodes[packet.to]].filter((r) => r !== undefined),
      ...[computePacketCalloutBox(packet)].flatMap((box) => (box ? [calloutRect(box)] : [])),
      controlBox(packet.path),
    ]);
    const b = boundsOf(rects, FOLLOW_PAD, 0);
    this.#camera.frame(
      {
        ...b,
        width: Math.max(FOLLOW_MIN_SIZE.width, b.width),
        height: Math.max(FOLLOW_MIN_SIZE.height, b.height),
      },
      MAX_FOLLOW_ZOOM,
      smooth,
    );
  }

  /** Shows the whole diagram and hands the camera back to automatic framing. */
  #fit(): void {
    this.#userMoved = false;
    this.#camera.frame(this.#wholeDiagramBounds(), MAX_FIT_ZOOM, false);
  }

  /** The fit button: stops following, and keeps the whole diagram until the next step. */
  #showWholeDiagram(): void {
    if (this.#followAnim) {
      this.#followAnim = false;
      this.#controls.followBtn.setAttribute('aria-pressed', 'false');
    }
    this.#holdFrame = true;
    this.#fit();
  }

  #onCameraMove(): void {
    this.#controls.zoomLabel.textContent = `${Math.round(this.#camera.zoom * 100)}%`;
    this.#updateCameraOverlays();
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
    const rects = this.#view.nodes.filter((n) => n.focused).map((n) => n.rect);
    if (rects.length === 0 || this.#fixedFrame) {
      this.#camera.frame(this.#wholeDiagramBounds(), MAX_FIT_ZOOM, smooth);
      return;
    }
    for (const packet of this.#view.phases.flat()) {
      const callout = computePacketCalloutBox(packet);
      if (callout) rects.push(calloutRect(callout));
    }
    const bounds = boundsOf(rects);
    const legible = this.#camera.fitZoom(bounds) >= MIN_ZONE_FRAME_ZOOM;
    // A step too spread out to read at once is followed instead, zone by zone.
    if (!legible && !this.#holdFrame && !this.#isStopped() && this.#view.phases.length > 0) {
      this.#calmFocus(smooth);
      return;
    }
    this.#camera.frame(bounds, MAX_FIT_ZOOM, smooth);
  }

  #zoomBy(factor: number, cx?: number, cy?: number): void {
    this.#camera.zoomBy(factor, cx, cy);
    this.#userMoved = true;
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
      this.#camera.panBy(dx, dy);
      drag.x = e.clientX;
      drag.y = e.clientY;
      this.#userMoved = true;
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
    if (target !== window && !this.#root.contains(this.#controls.playbackBar)) {
      this.#controls.playbackBar.addEventListener('keydown', onKey);
      this.#cleanups.push(() => this.#controls.playbackBar.removeEventListener('keydown', onKey));
    }
  }
}

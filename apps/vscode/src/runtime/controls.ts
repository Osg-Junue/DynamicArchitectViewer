import { CONTROL_ICONS, type ControlIcon, controlIcon } from './controlIcons';
import { clear, html } from './dom';
import type { ViewerStrings } from './i18n';

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export function isPlaybackSpeed(value: number): value is (typeof SPEEDS)[number] {
  return SPEEDS.some((s) => s === value);
}

const ZOOM_STEP = 1.2;

/** What the play button plays: the current step again and again, or every step in turn. */
export type PlayMode = 'step' | 'all';

export interface ControlActions {
  selectStep(index: number | null): void;
  prev(): void;
  next(): void;
  togglePlayback(): void;
  /** Plays a mode at once, and keeps it as what the play button plays. */
  playIn(mode: PlayMode): void;
  toggleMotion(): void;
  setSpeed(speed: number): void;
  zoomBy(factor: number): void;
  fit(): void;
  toggleFollow(): void;
  toggleMinimap(): void;
}

export interface Controls {
  playbackBar: HTMLElement;
  /** Holds the step's title (a dropdown of the steps); the dock adds the description. */
  stepHead: HTMLElement;
  zoomGroup: HTMLElement;
  stepSelect: HTMLSelectElement;
  playBtn: HTMLButtonElement;
  playModeBtn: HTMLButtonElement;
  modeItems: Record<PlayMode, HTMLButtonElement>;
  motionBtn: HTMLButtonElement;
  speedSelect: HTMLSelectElement;
  zoomLabel: HTMLElement;
  followBtn: HTMLButtonElement;
  minimapBtn: HTMLButtonElement;
  closeMenus(): void;
}

const separator = () => html('span', { class: 'dav-toolbar-sep', 'aria-hidden': 'true' });

function iconButton(
  icon: ControlIcon,
  attrs: Record<string, string>,
  onClick: () => void,
  className = 'dav-btn dav-btn-icon',
): HTMLButtonElement {
  const btn = html('button', { class: className, type: 'button', ...attrs }, controlIcon(icon));
  btn.addEventListener('click', onClick);
  return btn;
}

const labelled = (title: string, testId: string) => ({
  title,
  'aria-label': title,
  'data-testid': testId,
});

interface SplitPlay {
  element: HTMLElement;
  playBtn: HTMLButtonElement;
  playModeBtn: HTMLButtonElement;
  modeItems: Record<PlayMode, HTMLButtonElement>;
  close(focusToggle: boolean): void;
}

/**
 * The play button with an arrow beside it, as in Visual Studio: the button plays the last mode
 * played, and a choice in the arrow's menu plays that mode at once and becomes the button's.
 */
function createSplitPlay(s: ViewerStrings, on: ControlActions): SplitPlay {
  const playBtn = html('button', {
    type: 'button',
    class: 'dav-btn dav-split-main',
    'data-testid': 'btn-play',
  });
  playBtn.addEventListener('click', on.togglePlayback);

  const item = (mode: PlayMode, label: string) => {
    const btn = html(
      'button',
      {
        type: 'button',
        role: 'menuitem',
        class: 'dav-btn dav-menu-item',
        tabindex: '-1',
        'data-testid': `play-mode-${mode}`,
      },
      label,
    );
    btn.addEventListener('click', () => {
      on.playIn(mode);
      close(true);
    });
    return btn;
  };
  const modeItems = { step: item('step', s.play), all: item('all', s.playAll) };
  const items = [modeItems.step, modeItems.all];
  const menu = html(
    'div',
    { class: 'dav-menu', role: 'menu', 'aria-label': s.playMode },
    modeItems.step,
    modeItems.all,
  );
  menu.hidden = true;

  const playModeBtn = iconButton(
    CONTROL_ICONS.caret,
    { ...labelled(s.playMode, 'btn-play-mode'), 'aria-haspopup': 'menu', 'aria-expanded': 'false' },
    () => (menu.hidden ? open() : close(false)),
    'dav-btn dav-btn-icon dav-split-toggle',
  );
  const element = html('div', { class: 'dav-split' }, playBtn, playModeBtn, menu);

  let onOutside: ((e: PointerEvent) => void) | null = null;
  function open(): void {
    menu.hidden = false;
    playModeBtn.setAttribute('aria-expanded', 'true');
    modeItems.step.focus();
    onOutside = (e) => {
      if (!(e.target instanceof Node && element.contains(e.target))) close(false);
    };
    document.addEventListener('pointerdown', onOutside, true);
  }
  function close(focusToggle: boolean): void {
    if (menu.hidden) return;
    menu.hidden = true;
    playModeBtn.setAttribute('aria-expanded', 'false');
    if (onOutside) document.removeEventListener('pointerdown', onOutside, true);
    onOutside = null;
    if (focusToggle) playModeBtn.focus();
  }
  // Handled keys are marked as handled, so that the player's step keys leave them alone.
  menu.addEventListener('keydown', (e) => {
    const at = items.indexOf(e.target as HTMLButtonElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const step = e.key === 'ArrowDown' ? 1 : -1;
      items[(at + step + items.length) % items.length]?.focus();
    } else if (e.key === 'Home') items[0]?.focus();
    else if (e.key === 'End') items[items.length - 1]?.focus();
    else if (e.key === 'Escape') close(true);
    else if (e.key === 'Tab') {
      close(false);
      return;
    } else if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
  });
  playModeBtn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && menu.hidden && !playModeBtn.disabled) {
      e.preventDefault();
      open();
    }
  });

  return { element, playBtn, playModeBtn, modeItems, close };
}

/** Builds the playback toolbar and the zoom buttons. */
export function createControls(s: ViewerStrings, speed: number, on: ControlActions): Controls {
  const prevBtn = iconButton(CONTROL_ICONS.prev, labelled(s.prevStep, 'btn-prev-step'), on.prev);
  const nextBtn = iconButton(CONTROL_ICONS.next, labelled(s.nextStep, 'btn-next-step'), on.next);

  // The step's title is itself the list of steps.
  const stepSelect = html('select', {
    class: 'dav-btn dav-step-select',
    'aria-label': s.step,
    title: s.selectStep,
    'data-testid': 'select-step',
  });
  stepSelect.addEventListener('change', () => {
    on.selectStep(stepSelect.value === 'overview' ? null : Number(stepSelect.value));
  });
  const stepHead = html(
    'div',
    { class: 'dav-step-head' },
    html(
      'span',
      { class: 'dav-step-pick' },
      stepSelect,
      html(
        'span',
        { class: 'dav-step-caret', 'aria-hidden': 'true' },
        controlIcon(CONTROL_ICONS.caret),
      ),
    ),
  );

  const split = createSplitPlay(s, on);
  const motionBtn = iconButton(
    CONTROL_ICONS.stop,
    { 'data-testid': 'btn-motion' },
    on.toggleMotion,
  );

  const speedSelect = html('select', {
    class: 'dav-btn dav-speed-select',
    'aria-label': s.speed,
    title: s.speed,
    'data-testid': 'select-speed',
  });
  for (const v of SPEEDS) {
    speedSelect.append(html('option', { value: String(v), selected: v === speed }, `${v}x`));
  }
  speedSelect.addEventListener('change', () => on.setSpeed(Number(speedSelect.value) || 1));

  const playbackBar = html(
    'div',
    {
      class: 'dav-playback-bar',
      role: 'toolbar',
      'aria-label': s.playback,
      'data-testid': 'playback-toolbar',
    },
    html('span', { class: 'dav-step-nav' }, prevBtn, nextBtn),
    stepHead,
    html('span', { class: 'dav-play-group' }, split.element, motionBtn, speedSelect),
  );

  const zoomLabel = html('span', { class: 'dav-zoom-label', 'aria-live': 'polite' });
  const followBtn = iconButton(
    CONTROL_ICONS.follow,
    { ...labelled(s.followAnim, 'btn-follow-anim'), 'aria-pressed': 'false' },
    on.toggleFollow,
    'dav-btn dav-btn-icon dav-btn-follow',
  );
  const minimapBtn = iconButton(
    CONTROL_ICONS.minimap,
    { ...labelled(s.minimap, 'btn-minimap'), 'aria-pressed': 'false' },
    on.toggleMinimap,
  );
  const zoomGroup = html(
    'div',
    {
      class: 'dav-zoom-group',
      role: 'group',
      'aria-label': s.zoomControls,
      'data-testid': 'canvas-zoom-controls',
    },
    iconButton(CONTROL_ICONS.zoomOut, labelled(s.zoomOut, 'btn-zoom-out'), () =>
      on.zoomBy(1 / ZOOM_STEP),
    ),
    zoomLabel,
    iconButton(CONTROL_ICONS.zoomIn, labelled(s.zoomIn, 'btn-zoom-in'), () => on.zoomBy(ZOOM_STEP)),
    separator(),
    iconButton(CONTROL_ICONS.fit, labelled(s.fit, 'btn-zoom-fit'), on.fit),
    followBtn,
    minimapBtn,
  );

  return {
    playbackBar,
    stepHead,
    zoomGroup,
    stepSelect,
    playBtn: split.playBtn,
    playModeBtn: split.playModeBtn,
    modeItems: split.modeItems,
    motionBtn,
    speedSelect,
    zoomLabel,
    followBtn,
    minimapBtn,
    closeMenus: () => split.close(false),
  };
}

export function setButtonPressed(
  button: HTMLButtonElement,
  pressed: boolean,
  label?: string,
): void {
  if (label !== undefined) {
    button.title = label;
    button.setAttribute('aria-label', label);
  }
  button.setAttribute('aria-pressed', String(pressed));
}

/** Names the mode the play button plays, and offers to pause while something plays. */
export function showPlayback(
  c: Controls,
  s: ViewerStrings,
  mode: PlayMode,
  playing: boolean,
): void {
  clear(c.playBtn);
  c.playBtn.append(controlIcon(playing ? CONTROL_ICONS.pause : CONTROL_ICONS.play));
  setButtonPressed(c.playBtn, playing, playing ? s.pause : mode === 'all' ? s.playAll : s.play);
}

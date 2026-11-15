import { CONTROL_ICONS, type ControlIcon, controlIcon } from './controlIcons';
import { clear, html } from './dom';
import type { ViewerStrings } from './i18n';
import { Menu, type MenuItem } from './menu';

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
  /** Plays a mode at once; the play button itself keeps playing the current step. */
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
  /** The step's title, which opens the list of steps. */
  stepBtn: HTMLButtonElement;
  stepMenu: Menu;
  playBtn: HTMLButtonElement;
  playModeBtn: HTMLButtonElement;
  motionBtn: HTMLButtonElement;
  speedBtn: HTMLButtonElement;
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

/**
 * A button that opens a menu, with the caret every dropdown of the bar shows. Given every label
 * it can show, it holds them all in one place and shows the current one, so that it is as wide
 * as the widest in the font it is drawn in and does not change size with the choice.
 */
function dropButton(
  className: string,
  attrs: Record<string, string>,
  labels: readonly MenuItem[] = [],
): HTMLButtonElement {
  return html(
    'button',
    { type: 'button', class: `dav-btn dav-drop ${className}`, ...attrs },
    html(
      'span',
      { class: 'dav-drop-text' },
      ...labels.map(({ value, label }) => html('span', { 'data-value': value }, label)),
    ),
    controlIcon(CONTROL_ICONS.caret),
  );
}

/** Shows a dropdown's current value on its button and in its list. */
export function showChoice(
  button: HTMLButtonElement,
  menu: Menu,
  label: string,
  value: string,
): void {
  const text = button.querySelector('.dav-drop-text');
  const labels = text ? [...text.children] : [];
  if (labels.length > 0) {
    for (const el of labels) el.classList.toggle('is-on', el.getAttribute('data-value') === value);
  } else if (text) {
    text.textContent = label;
  }
  menu.setChecked(value);
}

interface SplitPlay {
  element: HTMLElement;
  playBtn: HTMLButtonElement;
  playModeBtn: HTMLButtonElement;
  menu: Menu;
}

/**
 * The play button with an arrow beside it, as in Visual Studio: the button plays the current step,
 * and a choice in the arrow's menu plays that mode at once.
 */
function createSplitPlay(s: ViewerStrings, on: ControlActions): SplitPlay {
  const playBtn = html('button', {
    type: 'button',
    class: 'dav-btn dav-split-main',
    'data-testid': 'btn-play',
  });
  playBtn.addEventListener('click', on.togglePlayback);
  const playModeBtn = html(
    'button',
    {
      type: 'button',
      class: 'dav-btn dav-split-toggle',
      ...labelled(s.playMode, 'btn-play-mode'),
    },
    controlIcon(CONTROL_ICONS.caret),
  );
  const element = html('div', { class: 'dav-split' }, playBtn, playModeBtn);
  const menu = new Menu(playModeBtn, element, {
    label: s.playMode,
    testIdPrefix: 'play-mode',
    align: 'end',
    choice: false,
    onChoose: (mode) => on.playIn(mode === 'all' ? 'all' : 'step'),
  });
  menu.setItems([
    { value: 'step', label: s.play },
    { value: 'all', label: s.playAll },
  ]);
  return { element, playBtn, playModeBtn, menu };
}

/** Builds the playback toolbar and the zoom buttons. */
export function createControls(s: ViewerStrings, speed: number, on: ControlActions): Controls {
  const prevBtn = iconButton(CONTROL_ICONS.prev, labelled(s.prevStep, 'btn-prev-step'), on.prev);
  const nextBtn = iconButton(CONTROL_ICONS.next, labelled(s.nextStep, 'btn-next-step'), on.next);

  // The step's title is itself the list of steps.
  const stepBtn = dropButton('dav-step-select', {
    title: s.selectStep,
    'data-testid': 'select-step',
  });
  const stepPick = html('span', { class: 'dav-pick' }, stepBtn);
  const stepMenu = new Menu(stepBtn, stepPick, {
    label: s.steps,
    testIdPrefix: 'step-option',
    align: 'start',
    choice: true,
    onChoose: (value) => on.selectStep(value === 'overview' ? null : Number(value)),
  });
  const stepHead = html('div', { class: 'dav-step-head' }, stepPick);

  const split = createSplitPlay(s, on);
  const motionBtn = iconButton(
    CONTROL_ICONS.stop,
    { 'data-testid': 'btn-motion' },
    on.toggleMotion,
  );

  const speedItems = SPEEDS.map((v) => ({ value: String(v), label: `${v}x` }));
  const speedBtn = dropButton(
    'dav-speed-select',
    { title: s.speed, 'data-testid': 'select-speed' },
    speedItems,
  );
  const speedPick = html('span', { class: 'dav-pick' }, speedBtn);
  const speedMenu: Menu = new Menu(speedBtn, speedPick, {
    label: s.speed,
    testIdPrefix: 'speed',
    align: 'end',
    choice: true,
    onChoose: (value) => {
      showChoice(speedBtn, speedMenu, `${value}x`, value);
      on.setSpeed(Number(value) || 1);
    },
  });
  speedMenu.setItems(speedItems);
  showChoice(speedBtn, speedMenu, `${speed}x`, String(speed));

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
    html('span', { class: 'dav-play-group' }, split.element, motionBtn, speedPick),
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
    stepBtn,
    stepMenu,
    playBtn: split.playBtn,
    playModeBtn: split.playModeBtn,
    motionBtn,
    speedBtn,
    zoomLabel,
    followBtn,
    minimapBtn,
    closeMenus: () => {
      for (const menu of [stepMenu, split.menu, speedMenu]) menu.close(false);
    },
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

/** The play button plays the current step, and offers to pause while anything plays. */
export function showPlayback(c: Controls, s: ViewerStrings, playing: boolean): void {
  clear(c.playBtn);
  c.playBtn.append(controlIcon(playing ? CONTROL_ICONS.pause : CONTROL_ICONS.play));
  setButtonPressed(c.playBtn, playing, playing ? s.pause : s.play);
}

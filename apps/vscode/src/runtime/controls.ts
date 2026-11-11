import { CONTROL_ICONS, type ControlIcon, controlIcon } from './controlIcons';
import { clear, html } from './dom';
import type { ViewerStrings } from './i18n';

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export function isPlaybackSpeed(value: number): value is (typeof SPEEDS)[number] {
  return SPEEDS.some((s) => s === value);
}

const ZOOM_STEP = 1.2;

export interface ControlActions {
  selectStep(index: number | null): void;
  togglePlay(): void;
  togglePlayAll(): void;
  toggleMotion(): void;
  setSpeed(speed: number): void;
  zoomBy(factor: number): void;
  fit(): void;
  toggleFollow(): void;
  toggleMinimap(): void;
}

export interface Controls {
  playbackBar: HTMLElement;
  zoomGroup: HTMLElement;
  stepSelect: HTMLSelectElement;
  playBtn: HTMLButtonElement;
  playAllBtn: HTMLButtonElement;
  motionBtn: HTMLButtonElement;
  speedSelect: HTMLSelectElement;
  zoomLabel: HTMLElement;
  followBtn: HTMLButtonElement;
  minimapBtn: HTMLButtonElement;
}

const separator = () => html('span', { class: 'dav-toolbar-sep', 'aria-hidden': 'true' });

function textButton(
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

/** Builds the playback toolbar and the zoom buttons. */
export function createControls(s: ViewerStrings, speed: number, on: ControlActions): Controls {
  const stepSelect = html('select', {
    class: 'dav-btn dav-step-select',
    'aria-label': s.step,
    title: s.selectStep,
    'data-testid': 'select-step',
  });
  stepSelect.addEventListener('change', () => {
    on.selectStep(stepSelect.value === 'overview' ? null : Number(stepSelect.value));
  });

  const playBtn = textButton(s.play, s.play, on.togglePlay, 'dav-btn dav-btn-primary dav-btn-play');
  playBtn.dataset.testid = 'btn-play';
  const playAllBtn = textButton(
    s.playAll,
    s.playAll,
    on.togglePlayAll,
    'dav-btn dav-btn-primary dav-btn-play dav-btn-play-all',
  );
  playAllBtn.dataset.testid = 'btn-play-all';
  const motionBtn = iconButton(
    CONTROL_ICONS.motion,
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
    stepSelect,
    separator(),
    playBtn,
    playAllBtn,
    motionBtn,
    separator(),
    speedSelect,
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
    textButton('−', s.zoomOut, () => on.zoomBy(1 / ZOOM_STEP)),
    zoomLabel,
    textButton('+', s.zoomIn, () => on.zoomBy(ZOOM_STEP)),
    separator(),
    iconButton(CONTROL_ICONS.fit, labelled(s.fit, 'btn-zoom-fit'), on.fit),
    followBtn,
    minimapBtn,
  );

  return {
    playbackBar,
    zoomGroup,
    stepSelect,
    playBtn,
    playAllBtn,
    motionBtn,
    speedSelect,
    zoomLabel,
    followBtn,
    minimapBtn,
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

/** Makes a play button offer to pause while its mode is running. */
export function showPlayState(
  button: HTMLButtonElement,
  playing: boolean,
  icon: ControlIcon,
  playLabel: string,
  pauseLabel: string,
): void {
  clear(button);
  button.append(controlIcon(playing ? CONTROL_ICONS.pause : icon));
  setButtonPressed(button, playing, playing ? pauseLabel : playLabel);
}

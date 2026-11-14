import type { DavLocale } from '../model/types';

export type ViewerLocale = DavLocale;

export interface ViewerStrings {
  overview: string;
  overviewHint: string;
  play: string;
  playAll: string;
  /** The menu beside the play button. */
  playMode: string;
  prevStep: string;
  nextStep: string;
  pause: string;
  stopMotion: string;
  startMotion: string;
  speed: string;
  zoomIn: string;
  zoomOut: string;
  fit: string;
  followAnim: string;
  minimap: string;
  steps: string;
  step: string;
  selectStep: string;
  playback: string;
  zoomControls: string;
  diagram: string;
  stepLabel: (n: number, total: number) => string;
}

export const VIEWER_STRINGS: Record<ViewerLocale, ViewerStrings> = {
  ja: {
    overview: '全体図',
    overviewHint: 'ステップを選ぶか再生（← / → / Space）すると、流れを確認できます。',
    play: 'このステップを再生',
    playAll: 'すべてのステップを再生',
    playMode: '再生する範囲',
    prevStep: '前のステップ',
    nextStep: '次のステップ',
    pause: '一時停止',
    stopMotion: 'アニメーションを止める',
    startMotion: 'アニメーションを動かす',
    speed: '再生速度',
    zoomIn: '拡大',
    zoomOut: '縮小',
    fit: '全体を表示',
    followAnim: 'アニメーションに追従',
    minimap: 'ミニマップ',
    steps: 'ステップ一覧',
    step: 'ステップ',
    selectStep: 'ステップを選択',
    playback: '再生',
    zoomControls: 'ズーム操作',
    diagram: '図',
    stepLabel: (n, total) => `ステップ ${n} / ${total}`,
  },
  en: {
    overview: 'Overview',
    overviewHint: 'Select a step or press play (← / → / Space) to watch the flow.',
    play: 'Play this step',
    playAll: 'Play all steps',
    playMode: 'What to play',
    prevStep: 'Previous step',
    nextStep: 'Next step',
    pause: 'Pause',
    stopMotion: 'Stop animation',
    startMotion: 'Start animation',
    speed: 'Playback speed',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fit: 'Fit',
    followAnim: 'Focus on active animation',
    minimap: 'Minimap',
    steps: 'Steps',
    step: 'Step',
    selectStep: 'Select step',
    playback: 'Playback',
    zoomControls: 'Zoom controls',
    diagram: 'Diagram',
    stepLabel: (n, total) => `Step ${n} / ${total}`,
  },
};

/** The UI language of the page, which the extension host writes into `<html lang>`. */
export function detectLocale(): ViewerLocale {
  return document.documentElement.lang.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

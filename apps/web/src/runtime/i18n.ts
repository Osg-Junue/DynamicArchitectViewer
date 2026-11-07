export type ViewerLocale = 'ja' | 'en';

export interface ViewerStrings {
  overview: string;
  overviewHint: string;
  prev: string;
  next: string;
  play: string;
  pause: string;
  speed: string;
  zoomIn: string;
  zoomOut: string;
  fit: string;
  source: string;
  sourceTitle: string;
  copy: string;
  copied: string;
  close: string;
  hint: string;
  stepLabel: (n: number, total: number) => string;
}

export const VIEWER_STRINGS: Record<ViewerLocale, ViewerStrings> = {
  ja: {
    overview: '全体図',
    overviewHint: 'ステップを選ぶか再生ボタン（← / → / Space）でデータの流れを再生できます。',
    prev: '前へ',
    next: '次へ',
    play: '再生',
    pause: '一時停止',
    speed: '再生速度',
    zoomIn: '拡大',
    zoomOut: '縮小',
    fit: '全体表示',
    source: 'DSL',
    sourceTitle: '埋め込み DSL ソース（このファイルはエディタで再編集できます）',
    copy: 'コピー',
    copied: 'コピーしました',
    close: '閉じる',
    hint: 'ドラッグ: 移動 / ホイール: ズーム / ← → Space',
    stepLabel: (n, total) => `ステップ ${n} / ${total}`,
  },
  en: {
    overview: 'Overview',
    overviewHint: 'Select a step or press play (← / → / Space) to watch the flow.',
    prev: 'Previous',
    next: 'Next',
    play: 'Play',
    pause: 'Pause',
    speed: 'Playback speed',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fit: 'Fit',
    source: 'DSL',
    sourceTitle: 'Embedded DSL source (this file can be re-opened in the editor)',
    copy: 'Copy',
    copied: 'Copied',
    close: 'Close',
    hint: 'Drag: pan / Wheel: zoom / ← → Space',
    stepLabel: (n, total) => `Step ${n} / ${total}`,
  },
};

export function detectLocale(preferred?: string): ViewerLocale {
  const lang = preferred ?? (typeof navigator !== 'undefined' ? navigator.language : 'en');
  return lang.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

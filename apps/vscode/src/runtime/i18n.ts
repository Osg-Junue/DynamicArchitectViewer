export type ViewerLocale = 'ja' | 'en';

export interface ViewerStrings {
  overview: string;
  overviewHint: string;
  play: string;
  pause: string;
  speed: string;
  zoomIn: string;
  zoomOut: string;
  fit: string;
  followAnim: string;
  stepLabel: (n: number, total: number) => string;
}

export const VIEWER_STRINGS: Record<ViewerLocale, ViewerStrings> = {
  ja: {
    overview: 'Overview',
    overviewHint: 'Select a step or press play (← / → / Space) to watch the flow.',
    play: 'Play',
    pause: 'Pause',
    speed: 'Playback speed',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fit: 'Fit',
    followAnim: 'Focus on active animation',
    stepLabel: (n, total) => `Step ${n} / ${total}`,
  },
  en: {
    overview: 'Overview',
    overviewHint: 'Select a step or press play (← / → / Space) to watch the flow.',
    play: 'Play',
    pause: 'Pause',
    speed: 'Playback speed',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fit: 'Fit',
    followAnim: 'Focus on active animation',
    stepLabel: (n, total) => `Step ${n} / ${total}`,
  },
};

export function detectLocale(): ViewerLocale {
  return 'en';
}

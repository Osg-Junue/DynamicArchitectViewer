import type { IconName } from '../model/types';

type Shape = readonly [tag: string, attrs: Readonly<Record<string, string | number>>];

/** 24×24 stroke icons (Lucide-style geometry). */
export const ICON_SHAPES: Record<IconName, readonly Shape[]> = {
  server: [
    ['rect', { x: 2, y: 3, width: 20, height: 7, rx: 2 }],
    ['rect', { x: 2, y: 14, width: 20, height: 7, rx: 2 }],
    ['circle', { cx: 6, cy: 6.5, r: 1 }],
    ['circle', { cx: 6, cy: 17.5, r: 1 }],
    ['line', { x1: 10, y1: 6.5, x2: 18, y2: 6.5 }],
    ['line', { x1: 10, y1: 17.5, x2: 18, y2: 17.5 }],
  ],
  container: [
    [
      'path',
      {
        d: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
      },
    ],
    ['polyline', { points: '3.27 6.96 12 12.01 20.73 6.96' }],
    ['line', { x1: 12, y1: 22.08, x2: 12, y2: 12 }],
  ],
  function: [['polygon', { points: '13 2 3 14 12 14 11 22 21 10 12 10 13 2' }]],
  runtime: [
    ['path', { d: 'M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h1' }],
    ['path', { d: 'M16 3h1a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-1' }],
    ['polygon', { points: '10 9 15 12 10 15 10 9' }],
  ],
  database: [
    ['ellipse', { cx: 12, cy: 5, rx: 9, ry: 3 }],
    ['path', { d: 'M21 12c0 1.66-4 3-9 3s-9-1.34-9-3' }],
    ['path', { d: 'M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5' }],
  ],
  cache: [
    ['polygon', { points: '12 2 2 7 12 12 22 7 12 2' }],
    ['polyline', { points: '2 17 12 22 22 17' }],
    ['polyline', { points: '2 12 12 17 22 12' }],
  ],
  queue: [
    ['rect', { x: 2, y: 6, width: 20, height: 12, rx: 2 }],
    ['line', { x1: 7, y1: 10, x2: 7, y2: 14 }],
    ['line', { x1: 12, y1: 10, x2: 12, y2: 14 }],
    ['line', { x1: 17, y1: 10, x2: 17, y2: 14 }],
  ],
  storage: [
    ['path', { d: 'M4 4h16l-2 16H6L4 4z' }],
    ['path', { d: 'M2 4h20' }],
    ['path', { d: 'M9 9h6' }],
  ],
  lb: [
    ['circle', { cx: 5, cy: 12, r: 3 }],
    ['circle', { cx: 19, cy: 6, r: 2.5 }],
    ['circle', { cx: 19, cy: 12, r: 2.5 }],
    ['circle', { cx: 19, cy: 18, r: 2.5 }],
    ['path', { d: 'M8 12h8.5' }],
    ['path', { d: 'M8 11l8.5-5' }],
    ['path', { d: 'M8 13l8.5 5' }],
  ],
  firewall: [
    ['path', { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' }],
    ['path', { d: 'M9 12l2 2 4-4' }],
  ],
  cdn: [
    ['circle', { cx: 12, cy: 12, r: 10 }],
    ['line', { x1: 2, y1: 12, x2: 22, y2: 12 }],
    [
      'path',
      {
        d: 'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
      },
    ],
  ],
  cloud: [['path', { d: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z' }]],
  building: [
    ['rect', { x: 5, y: 2, width: 14, height: 20, rx: 2 }],
    ['line', { x1: 9.5, y1: 7, x2: 9.51, y2: 7 }],
    ['line', { x1: 14.5, y1: 7, x2: 14.51, y2: 7 }],
    ['line', { x1: 9.5, y1: 12, x2: 9.51, y2: 12 }],
    ['line', { x1: 14.5, y1: 12, x2: 14.51, y2: 12 }],
    ['path', { d: 'M10 22v-5h4v5' }],
  ],
  router: [
    ['rect', { x: 3, y: 13, width: 18, height: 7, rx: 2 }],
    ['line', { x1: 7, y1: 16.5, x2: 7.01, y2: 16.5 }],
    ['line', { x1: 11, y1: 16.5, x2: 11.01, y2: 16.5 }],
    ['path', { d: 'M12 13V4' }],
    ['polyline', { points: '9 7 12 4 15 7' }],
  ],
  hub: [
    ['circle', { cx: 12, cy: 12, r: 3 }],
    ['circle', { cx: 4.5, cy: 4.5, r: 2 }],
    ['circle', { cx: 19.5, cy: 4.5, r: 2 }],
    ['circle', { cx: 4.5, cy: 19.5, r: 2 }],
    ['circle', { cx: 19.5, cy: 19.5, r: 2 }],
    ['line', { x1: 6, y1: 6, x2: 9.9, y2: 9.9 }],
    ['line', { x1: 18, y1: 6, x2: 14.1, y2: 9.9 }],
    ['line', { x1: 6, y1: 18, x2: 9.9, y2: 14.1 }],
    ['line', { x1: 18, y1: 18, x2: 14.1, y2: 14.1 }],
  ],
  wifi: [
    ['path', { d: 'M2 8.82a15 15 0 0 1 20 0' }],
    ['path', { d: 'M5 12.86a10 10 0 0 1 14 0' }],
    ['path', { d: 'M8.5 16.43a5 5 0 0 1 7 0' }],
    ['line', { x1: 12, y1: 20, x2: 12.01, y2: 20 }],
  ],
  external: [
    ['path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }],
    ['polyline', { points: '15 3 21 3 21 9' }],
    ['line', { x1: 10, y1: 14, x2: 21, y2: 3 }],
  ],
  auth: [
    ['rect', { x: 4, y: 11, width: 16, height: 10, rx: 2 }],
    ['path', { d: 'M8 11V7a4 4 0 0 1 8 0v4' }],
    ['circle', { cx: 12, cy: 16, r: 1 }],
  ],
  ai: [
    [
      'path',
      {
        d: 'M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z',
      },
    ],
    ['path', { d: 'M19 3v4' }],
    ['path', { d: 'M21 5h-4' }],
  ],
  api: [
    ['path', { d: 'M1.5 17 5 7l3.5 10' }],
    ['path', { d: 'M2.7 13.5h4.6' }],
    ['path', { d: 'M11 17V7h3.2a3 3 0 0 1 0 6H11' }],
    ['path', { d: 'M20.5 7v10' }],
  ],
  mail: [
    ['rect', { x: 2, y: 4, width: 20, height: 16, rx: 2 }],
    ['path', { d: 'm22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7' }],
  ],
  monitor: [['polyline', { points: '22 12 18 12 15 21 9 3 6 12 2 12' }]],
  schedule: [
    ['circle', { cx: 12, cy: 12, r: 9 }],
    ['polyline', { points: '12 7 12 12 15.5 14' }],
  ],
  search: [
    ['circle', { cx: 11, cy: 11, r: 7 }],
    ['line', { x1: 20, y1: 20, x2: 16, y2: 16 }],
  ],
  logic: [
    ['circle', { cx: 12, cy: 12, r: 3 }],
    ['circle', { cx: 12, cy: 12, r: 7 }],
    ['line', { x1: 12, y1: 2, x2: 12, y2: 5 }],
    ['line', { x1: 12, y1: 19, x2: 12, y2: 22 }],
    ['line', { x1: 2, y1: 12, x2: 5, y2: 12 }],
    ['line', { x1: 19, y1: 12, x2: 22, y2: 12 }],
    ['line', { x1: 4.9, y1: 4.9, x2: 7, y2: 7 }],
    ['line', { x1: 17, y1: 17, x2: 19.1, y2: 19.1 }],
    ['line', { x1: 19.1, y1: 4.9, x2: 17, y2: 7 }],
    ['line', { x1: 7, y1: 17, x2: 4.9, y2: 19.1 }],
  ],
  webhook: [
    ['path', { d: 'M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2' }],
    ['path', { d: 'm6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06' }],
    ['path', { d: 'm12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8' }],
  ],
  payment: [
    ['rect', { x: 2, y: 5, width: 20, height: 14, rx: 2 }],
    ['line', { x1: 2, y1: 10, x2: 22, y2: 10 }],
    ['line', { x1: 6, y1: 15, x2: 10, y2: 15 }],
  ],
  key: [
    ['circle', { cx: 7.5, cy: 15.5, r: 4.5 }],
    ['path', { d: 'm10.7 12.3 9.3-9.3' }],
    ['path', { d: 'm16 7 3 3' }],
    ['path', { d: 'm19 4 2 2' }],
  ],
  screen: [
    ['rect', { x: 2, y: 3, width: 20, height: 18, rx: 2 }],
    ['line', { x1: 2, y1: 8, x2: 22, y2: 8 }],
    ['rect', { x: 5, y: 11, width: 6, height: 7, rx: 1 }],
    ['line', { x1: 14, y1: 12, x2: 19, y2: 12 }],
    ['line', { x1: 14, y1: 15, x2: 18, y2: 15 }],
  ],
  modal: [
    ['rect', { x: 4, y: 5, width: 16, height: 14, rx: 2 }],
    ['line', { x1: 4, y1: 9, x2: 20, y2: 9 }],
    ['rect', { x: 8, y: 13, width: 8, height: 3, rx: 1 }],
  ],
  browser: [
    ['path', { d: 'M21 11V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6' }],
    ['line', { x1: 3, y1: 8, x2: 21, y2: 8 }],
    ['line', { x1: 6.5, y1: 5.5, x2: 6.51, y2: 5.5 }],
    ['line', { x1: 10, y1: 5.5, x2: 10.01, y2: 5.5 }],
    ['polygon', { points: '13 13 22 16.5 18 18 16.5 22 13 13' }],
  ],
  desktop: [
    ['rect', { x: 2, y: 3, width: 20, height: 14, rx: 2 }],
    ['line', { x1: 8, y1: 21, x2: 16, y2: 21 }],
    ['line', { x1: 12, y1: 17, x2: 12, y2: 21 }],
  ],
  mobile: [
    ['rect', { x: 6, y: 2, width: 12, height: 20, rx: 2 }],
    ['line', { x1: 12, y1: 18, x2: 12.01, y2: 18 }],
  ],
  terminal: [
    ['rect', { x: 2, y: 4, width: 20, height: 16, rx: 2 }],
    ['polyline', { points: '6 9 10 12 6 15' }],
    ['line', { x1: 12, y1: 15, x2: 17, y2: 15 }],
  ],
  device: [
    ['rect', { x: 6, y: 6, width: 12, height: 12, rx: 2 }],
    ['rect', { x: 9, y: 9, width: 6, height: 6, rx: 1 }],
    ['line', { x1: 9, y1: 2, x2: 9, y2: 6 }],
    ['line', { x1: 15, y1: 2, x2: 15, y2: 6 }],
    ['line', { x1: 9, y1: 18, x2: 9, y2: 22 }],
    ['line', { x1: 15, y1: 18, x2: 15, y2: 22 }],
    ['line', { x1: 2, y1: 9, x2: 6, y2: 9 }],
    ['line', { x1: 2, y1: 15, x2: 6, y2: 15 }],
    ['line', { x1: 18, y1: 9, x2: 22, y2: 9 }],
    ['line', { x1: 18, y1: 15, x2: 22, y2: 15 }],
  ],
  printer: [
    ['path', { d: 'M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2' }],
    ['path', { d: 'M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6' }],
    ['rect', { x: 6, y: 14, width: 12, height: 8, rx: 1 }],
  ],
  chat: [
    ['path', { d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' }],
    ['line', { x1: 8, y1: 9, x2: 16, y2: 9 }],
    ['line', { x1: 8, y1: 13, x2: 13, y2: 13 }],
  ],
  sheet: [
    ['rect', { x: 3, y: 3, width: 18, height: 18, rx: 2 }],
    ['line', { x1: 3, y1: 9, x2: 21, y2: 9 }],
    ['line', { x1: 3, y1: 15, x2: 21, y2: 15 }],
    ['line', { x1: 9, y1: 9, x2: 9, y2: 21 }],
    ['line', { x1: 15, y1: 9, x2: 15, y2: 21 }],
  ],
  file: [
    ['path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }],
    ['polyline', { points: '14 2 14 8 20 8' }],
    ['line', { x1: 8, y1: 13, x2: 16, y2: 13 }],
    ['line', { x1: 8, y1: 17, x2: 13, y2: 17 }],
  ],
  user: [
    ['path', { d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' }],
    ['circle', { cx: 12, cy: 7, r: 4 }],
  ],
  users: [
    ['path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }],
    ['circle', { cx: 9, cy: 7, r: 4 }],
    ['path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87' }],
    ['path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' }],
  ],
  bot: [
    ['rect', { x: 3, y: 8, width: 18, height: 12, rx: 2 }],
    ['path', { d: 'M12 8V4H8' }],
    ['circle', { cx: 9, cy: 14, r: 1 }],
    ['circle', { cx: 15, cy: 14, r: 1 }],
  ],
};

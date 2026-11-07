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
  router: [
    ['rect', { x: 3, y: 13, width: 18, height: 7, rx: 2 }],
    ['line', { x1: 7, y1: 16.5, x2: 7.01, y2: 16.5 }],
    ['line', { x1: 11, y1: 16.5, x2: 11.01, y2: 16.5 }],
    ['path', { d: 'M12 13V4' }],
    ['polyline', { points: '9 7 12 4 15 7' }],
  ],
  external: [
    ['path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }],
    ['polyline', { points: '15 3 21 3 21 9' }],
    ['line', { x1: 10, y1: 14, x2: 21, y2: 3 }],
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
    ['rect', { x: 2, y: 3, width: 20, height: 14, rx: 2 }],
    ['line', { x1: 8, y1: 21, x2: 16, y2: 21 }],
    ['line', { x1: 12, y1: 17, x2: 12, y2: 21 }],
  ],
  mobile: [
    ['rect', { x: 6, y: 2, width: 12, height: 20, rx: 2 }],
    ['line', { x1: 12, y1: 18, x2: 12.01, y2: 18 }],
  ],
  user: [
    ['path', { d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' }],
    ['circle', { cx: 12, cy: 7, r: 4 }],
  ],
};

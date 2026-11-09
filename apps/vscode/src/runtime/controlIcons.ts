import { svg } from './dom';

type Shape = readonly [
  tag: 'path' | 'circle' | 'rect' | 'polygon',
  attrs: Record<string, string | number>,
];

export interface ControlIcon {
  shapes: readonly Shape[];
  filled: boolean;
  size: number;
}

const line = (...shapes: Shape[]): ControlIcon => ({ shapes, filled: false, size: 15 });
const solid = (...shapes: Shape[]): ControlIcon => ({ shapes, filled: true, size: 15 });

/** The 24×24 artwork of the toolbar buttons. */
export const CONTROL_ICONS = {
  motion: line(
    ['path', { d: 'M2 12h20' }],
    ['circle', { cx: 12, cy: 12, r: 4, fill: 'currentColor' }],
  ),
  fit: line(
    ['path', { d: 'M8 3H5a2 2 0 0 0-2 2v3' }],
    ['path', { d: 'M21 8V5a2 2 0 0 0-2-2h-3' }],
    ['path', { d: 'M3 16v3a2 2 0 0 0 2 2h3' }],
    ['path', { d: 'M16 21h3a2 2 0 0 0 2-2v-3' }],
  ),
  follow: line(
    ['circle', { cx: 12, cy: 12, r: 7 }],
    ['circle', { cx: 12, cy: 12, r: 2 }],
    ['path', { d: 'M12 2v3' }],
    ['path', { d: 'M12 19v3' }],
    ['path', { d: 'M2 12h3' }],
    ['path', { d: 'M19 12h3' }],
  ),
  minimap: line(
    ['rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }],
    ['rect', { x: 11, y: 11, width: 7, height: 6, rx: 1 }],
  ),
  docs: {
    ...line(
      ['path', { d: 'M4 3h11l5 5v13H4z' }],
      ['path', { d: 'M14 3v6h6' }],
      ['path', { d: 'M8 9h3' }],
      ['path', { d: 'M8 13h8' }],
      ['path', { d: 'M8 17h8' }],
    ),
    size: 16,
  },
  pause: solid(
    ['rect', { x: 6, y: 5, width: 4, height: 14, rx: 1 }],
    ['rect', { x: 14, y: 5, width: 4, height: 14, rx: 1 }],
  ),
  play: solid(['polygon', { points: '6 4 20 12 6 20 6 4' }]),
  playAll: {
    ...solid(
      ['polygon', { points: '2 5 12 12 2 19 2 5' }],
      ['polygon', { points: '12 5 22 12 12 19 12 5' }],
    ),
    size: 16,
  },
} as const satisfies Record<string, ControlIcon>;

const LINE_STYLE = {
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 1.75,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
};

export function controlIcon({ shapes, filled, size }: ControlIcon): SVGSVGElement {
  return svg(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      'aria-hidden': 'true',
      ...(filled ? { fill: 'currentColor' } : LINE_STYLE),
    },
    ...shapes.map(([tag, attrs]) => svg(tag, attrs)),
  );
}

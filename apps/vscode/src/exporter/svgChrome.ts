import type { Layout, Rect } from '../layout';
import type { DavDocument } from '../model/types';
import { VIEWER_STRINGS, type ViewerLocale } from '../runtime/i18n';
import {
  estimateTextWidth,
  fitText,
  h,
  MAX_ZONE_MOVES,
  MINIMAP_ZONE_ATTRS,
  type MinimapZone,
  minimapZones,
  type Size,
  THEME_COLOR,
  type VElement,
  type ZoneMove,
  zoneColor,
  zoneMoves,
} from '../scene';
import { wrapText } from '../scene/text';
import { WIDTH } from './svgCamera';
import {
  type Clock,
  type Interval,
  num,
  pushAll,
  roundRect,
  type StepSlot,
  viewBoxOf,
} from './svgClock';

export const PAD_X = 16;
export const TIMELINE_HEIGHT = 20;
export const ZONE_STRIP_HEIGHT = 36;
const MINIMAP_MAX = { width: 180, height: 64 } as const;

const TITLE_SIZE = 14;
const DESC_SIZE = 13;
const DESC_LINE = 19;
const STEP_NO_SIZE = 11.5;

/** The step's number, title and description; `aside` keeps room on the right for the minimap. */
export function header(
  steps: readonly StepSlot[],
  stepCount: number,
  locale: ViewerLocale,
  clock: Clock,
  aside: Size | null,
): { el: VElement; height: number } {
  const strings = VIEWER_STRINGS[locale];
  const right = WIDTH - PAD_X - (aside ? aside.width + PAD_X : 0);
  const room = right - PAD_X;
  const descs = steps.map((step) => wrapText(step.view.description ?? '', DESC_SIZE, room, 2));
  const descLines = Math.max(0, ...descs.map((lines) => lines.length));
  const titleY = 12 + TITLE_SIZE + 2;
  const height = Math.max(
    titleY + descLines * DESC_LINE + 12,
    aside ? Math.ceil(aside.height) + 16 : 0,
  );
  const el = h('g', {}, h('rect', { x: 0, y: 0, width: WIDTH, height, fill: THEME_COLOR.bg }));
  steps.forEach((step, i) => {
    const stepNo = strings.stepLabel(step.index + 1, stepCount);
    const titleX = PAD_X + estimateTextWidth(stepNo, STEP_NO_SIZE) + 10;
    el.children.push(
      clock.showDuring(
        h(
          'g',
          {},
          h(
            'text',
            {
              x: PAD_X,
              y: titleY,
              class: 'dav-mono',
              'font-size': STEP_NO_SIZE,
              fill: THEME_COLOR.muted,
            },
            stepNo,
          ),
          h(
            'text',
            {
              x: titleX,
              y: titleY,
              'font-size': TITLE_SIZE,
              'font-weight': 700,
              fill: THEME_COLOR.fg,
            },
            fitText(step.view.stepTitle ?? '', TITLE_SIZE, right - titleX),
          ),
          ...(descs[i] ?? []).map((line, k) =>
            h(
              'text',
              {
                x: PAD_X,
                y: titleY + (k + 1) * DESC_LINE,
                'font-size': DESC_SIZE,
                fill: THEME_COLOR.fg,
              },
              line,
            ),
          ),
        ),
        [[step.start, step.end]],
      ),
    );
  });
  return { el, height };
}

/** The step ruler: one graduation per step, filling up as its phases play. */
export function timeline(
  steps: readonly StepSlot[],
  top: number,
  clock: Clock,
  total: number,
): VElement {
  const width = WIDTH / steps.length;
  const el = h(
    'g',
    {},
    h('rect', { x: 0, y: top, width: WIDTH, height: TIMELINE_HEIGHT, fill: THEME_COLOR.bg }),
    h('path', { d: `M 0 ${top} H ${WIDTH}`, stroke: THEME_COLOR.border }),
    h('path', { d: `M 0 ${top + TIMELINE_HEIGHT} H ${WIDTH}`, stroke: THEME_COLOR.border }),
  );
  steps.forEach((step, i) => {
    const x = i * width;
    const fillY = top + TIMELINE_HEIGHT - 3;
    if (i > 0) {
      el.children.push(
        h('path', {
          d: `M ${num(x)} ${top} V ${top + TIMELINE_HEIGHT}`,
          stroke: THEME_COLOR.border,
        }),
      );
    }
    const hasPhases = step.start < step.phasesEnd;
    el.children.push(
      h(
        'text',
        {
          x: num(x + 5),
          y: top + 14,
          class: 'dav-mono',
          'font-size': 10.5,
          fill: THEME_COLOR.muted,
        },
        String(i + 1).padStart(2, '0'),
      ),
      clock.showDuring(
        h('rect', {
          x: num(x),
          y: fillY,
          width: num(width),
          height: 3,
          fill: THEME_COLOR.borderStrong,
        }),
        [[step.end, total]],
      ),
      clock.showDuring(
        pushAll(
          h('rect', {
            x: num(x),
            y: fillY,
            width: hasPhases ? 0 : num(width),
            height: 3,
            fill: THEME_COLOR.accent,
          }),
          hasPhases
            ? clock.track('width', [
                [step.start, '0'],
                [step.phasesEnd, num(width)],
              ])
            : null,
        ),
        [[step.start, step.end]],
      ),
    );
  });
  return el;
}

const ZONE_SIZE = 14;
const ZONE_LINE = 72;
const ZONE_PAIR_GAP = 10;
const ZONE_MOVE_GAP = 24;
const ZONE_NAME_MAX = 220;

/**
 * A zone's name after a dot of its color. Names are anchored at the end that touches the line,
 * so that an estimated text width only moves the whole strip, never the gaps.
 */
function zoneName(
  place: ZoneMove[number],
  x: number,
  y: number,
  anchor: 'start' | 'end',
  fill: string,
  suffix?: string,
): VElement {
  return h(
    'text',
    { x: num(x), y, 'text-anchor': anchor, 'font-size': ZONE_SIZE, 'font-weight': 600, fill },
    h('tspan', { fill: zoneColor(place.color) }, '● '),
    fitText(place.label, ZONE_SIZE, ZONE_NAME_MAX),
    suffix ? h('tspan', { fill: THEME_COLOR.muted, 'font-weight': 400 }, ` ${suffix}`) : null,
  );
}

/** Names the zones of the running phase, as the strip above the preview's canvas does. */
export function zoneStrip(
  steps: readonly StepSlot[],
  top: number,
  locale: ViewerLocale,
  clock: Clock,
): VElement | null {
  const inside = VIEWER_STRINGS[locale].zoneInside;
  const y = top + ZONE_STRIP_HEIGHT / 2 + 5;
  const lineY = top + ZONE_STRIP_HEIGHT / 2 - 1;
  const el = h(
    'g',
    {},
    h('rect', { x: 0, y: top, width: WIDTH, height: ZONE_STRIP_HEIGHT, fill: THEME_COLOR.bg }),
  );
  const nameWidth = (place: ZoneMove[number]) =>
    estimateTextWidth(`● ${fitText(place.label, ZONE_SIZE, ZONE_NAME_MAX)}`, ZONE_SIZE);

  for (const step of steps) {
    for (const phase of step.phases) {
      const allMoves = zoneMoves(step.view, phase.packets);
      const moves = allMoves.slice(0, MAX_ZONE_MOVES);
      if (moves.length === 0) continue;
      const widths = moves.map(([from, to]) =>
        from === to
          ? nameWidth(from) + estimateTextWidth(` ${inside}`, ZONE_SIZE)
          : nameWidth(from) + ZONE_PAIR_GAP * 2 + ZONE_LINE + nameWidth(to),
      );
      const total = widths.reduce((sum, w) => sum + w, 0) + ZONE_MOVE_GAP * (moves.length - 1);
      let x = Math.max(PAD_X, (WIDTH - total) / 2);
      const parts: VElement[] = [];
      moves.forEach(([from, to], i) => {
        if (from === to) {
          parts.push(zoneName(from, x, y, 'start', THEME_COLOR.fg, inside));
        } else {
          const lineX = x + nameWidth(from) + ZONE_PAIR_GAP;
          parts.push(
            zoneName(from, lineX - ZONE_PAIR_GAP, y, 'end', THEME_COLOR.muted),
            h('rect', {
              x: num(lineX),
              y: lineY,
              width: ZONE_LINE,
              height: 2,
              fill: THEME_COLOR.borderStrong,
            }),
            pushAll(
              h('rect', {
                x: num(lineX),
                y: lineY,
                width: 0,
                height: 2,
                fill: zoneColor(to.color),
              }),
              clock.track('width', [
                [phase.start, '0'],
                [phase.start + phase.durationMs, String(ZONE_LINE)],
              ]),
            ),
            zoneName(to, lineX + ZONE_LINE + ZONE_PAIR_GAP, y, 'start', THEME_COLOR.fg),
          );
        }
        x += (widths[i] ?? 0) + ZONE_MOVE_GAP;
      });
      const more = allMoves.length - MAX_ZONE_MOVES;
      if (more > 0) {
        parts.push(
          h('text', { x: num(x), y, 'font-size': ZONE_SIZE, fill: THEME_COLOR.muted }, `+${more}`),
        );
      }
      el.children.push(clock.showDuring(h('g', {}, ...parts), [[phase.start, phase.end]]));
    }
  }
  return el.children.length > 1 ? el : null;
}

export interface MinimapFrame {
  zones: MinimapZone[];
  bounds: Rect;
  size: Size;
}

/** The top-level zones and the size they get in the minimap; `null` without zones. */
export function minimapFrame(doc: DavDocument, layout: Layout): MinimapFrame | null {
  const { zones, bounds } = minimapZones(doc, layout);
  if (zones.length === 0) return null;
  const scale = Math.min(MINIMAP_MAX.width / bounds.width, MINIMAP_MAX.height / bounds.height);
  return { zones, bounds, size: { width: bounds.width * scale, height: bounds.height * scale } };
}

/**
 * The zones each step is about and the part the camera shows. It sits beside the step's text
 * rather than over the canvas, where it would hide part of the diagram.
 */
export function minimap(
  { zones, bounds, size }: MinimapFrame,
  steps: readonly StepSlot[],
  at: { x: number; y: number },
  camera: Array<[number, Rect]>,
  clock: Clock,
): VElement {
  const inner = h('svg', {
    x: num(at.x),
    y: num(at.y),
    width: num(size.width),
    height: num(size.height),
    viewBox: viewBoxOf(bounds),
  });
  for (const zone of zones) {
    const shown = steps
      .filter((step) => !step.view.groups.find((g) => g.id === zone.id)?.dimmed)
      .map((step): Interval => [step.start, step.end]);
    inner.children.push(
      clock.showDuring(
        h('rect', {
          ...roundRect(zone.rect),
          rx: MINIMAP_ZONE_ATTRS.rx,
          fill: zone.fill,
          'fill-opacity': MINIMAP_ZONE_ATTRS['fill-opacity'],
        }),
        shown,
      ),
    );
  }
  const first = camera[0]?.[1];
  if (first) {
    const view = h('rect', { ...roundRect(first), class: 'dav-minimap-view' });
    for (const attr of ['x', 'y', 'width', 'height'] as const) {
      pushAll(
        view,
        clock.track(
          attr,
          camera.map(([t, r]) => [t, num(r[attr])]),
          { eased: true },
        ),
      );
    }
    inner.children.push(view);
  }
  return h(
    'g',
    {},
    h('rect', {
      x: num(at.x - 0.5),
      y: num(at.y - 0.5),
      width: num(size.width + 1),
      height: num(size.height + 1),
      rx: 3,
      fill: THEME_COLOR.panel,
      stroke: THEME_COLOR.border,
    }),
    inner,
  );
}

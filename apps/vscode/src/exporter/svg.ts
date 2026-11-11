import { parse } from '../dsl';
import { computeLayout, type Layout, type Rect } from '../layout';
import type { DavDocument } from '../model/types';
import type { ViewerLocale } from '../runtime/i18n';
import sceneStyles from '../runtime/scene.css?raw';
import {
  buildDefs,
  buildScene,
  h,
  type Pose,
  resolveView,
  type Size,
  THEME_COLOR,
  type VElement,
  type VNode,
  visibleWorld,
  wholeDiagramFrame,
} from '../scene';
import { ICON_SHAPES } from '../scene/icons';
import {
  CANVAS_HEIGHT,
  cameraKeys,
  planCamera,
  WIDTH,
  wholeAcrossSteps,
  wholeCanvas,
  wholePose,
} from './svgCamera';
import {
  header,
  minimap,
  minimapFrame,
  PAD_X,
  TIMELINE_HEIGHT,
  timeline,
  ZONE_STRIP_HEIGHT,
  zoneStrip,
} from './svgChrome';
import { Clock, num, pushAll, roundRect, type StepSlot, schedule, viewBoxOf } from './svgClock';
import { animatedPacket, animateHighlights, stillHighlights, zoneLabelLayer } from './svgScene';
import { toXml } from './xml';

export { planCamera } from './svgCamera';
export { type PhaseSlot, type StepSlot, schedule } from './svgClock';

export interface SvgExportOptions {
  locale?: ViewerLocale;
  /**
   * `true` (default) plays every step in a loop, with the camera following the flow as in the
   * preview. `false`, or a diagram without steps, gives a still picture of the whole diagram.
   */
  animate?: boolean;
  /**
   * Where an animated SVG looks. `'follow'` (default) moves like the preview's camera: closer on
   * each step, and on to the zones a phase moves between. `'whole'` keeps the whole diagram in
   * view, on a canvas of its proportions, and only the flows move.
   */
  camera?: 'follow' | 'whole';
  /**
   * Exports only this step (0-based), keeping its number in the diagram. Animated, it repeats the
   * step's phases, as "Play step" does; still, it frames the whole diagram while showing the
   * step's state and lit flows as the preview does with animation stopped. Every step by default.
   */
  step?: number;
}

/**
 * The animated SVG is meant for places that show images but run no script, such as a README on
 * GitHub or GitLab. Everything moves with SMIL, which works in `<img>`, and the whole file is one
 * loop: every animation lasts the length of the playback and repeats.
 */

const SVG_STYLES = sceneStyles
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .replace(/var\(\s*--vscode-[\w-]+,\s*((?:[^()]+|\([^()]*\))+)\)/g, '$1')
  .replace(/\s*([{};,])\s*/g, '$1')
  .replace(/([;{])(--?[\w-]+)\s*:\s*/g, '$1$2:')
  .replace(/;}/g, '}')
  .replace(/:root\b/g, '.dav-svg')
  .trim();

/** Generates an SVG file that needs no script and makes no external request. */
export function exportSvg(source: string | DavDocument, options: SvgExportOptions = {}): string {
  const document = typeof source === 'string' ? parse(source).document : source;
  const layout = computeLayout(document);
  const locale = options.locale ?? 'en';
  const { step } = options;
  if (step !== undefined) {
    if (!Number.isInteger(step) || step < 0 || step >= document.steps.length) {
      throw new RangeError(`No step ${step} in a diagram with ${document.steps.length} steps`);
    }
    return options.animate === false
      ? stepStillSvg(document, layout, step, locale)
      : animatedSvg(document, layout, locale, options.camera ?? 'follow', step);
  }
  return options.animate === false || document.steps.length === 0
    ? stillSvg(document, layout)
    : animatedSvg(document, layout, locale, options.camera ?? 'follow');
}

function svgDocument(
  size: Size,
  viewBox: string,
  title: string,
  description: string | undefined,
  children: VNode[],
): string {
  const resolvedTitle = title || 'DynamicArchitectViewer';
  const root = h(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      class: 'dav-svg',
      width: num(size.width),
      height: num(size.height),
      viewBox,
      role: 'img',
      'aria-label': resolvedTitle,
      'aria-describedby': description ? 'dav-desc' : undefined,
    },
    h('title', {}, resolvedTitle),
    description ? h('desc', { id: 'dav-desc' }, description) : null,
    h('style', {}, SVG_STYLES),
    ...children,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n${toXml(root)}\n`;
}

function sheetSvg(
  height: number,
  title: string,
  description: string,
  children: Array<VElement | null>,
): string {
  return svgDocument({ width: WIDTH, height }, `0 0 ${WIDTH} ${num(height)}`, title, description, [
    h('rect', { x: 0, y: 0, width: WIDTH, height, fill: THEME_COLOR.bg }),
    ...children.filter((c): c is VElement => c !== null),
  ]);
}

function worldSvg(top: number, height: number, world: Rect, ...children: VElement[]): VElement {
  return h(
    'svg',
    {
      x: 0,
      y: top,
      width: WIDTH,
      height,
      viewBox: viewBoxOf(world),
      preserveAspectRatio: 'xMidYMid meet',
    },
    buildDefs(),
    ...children,
  );
}

const headerDivider = (top: number): VElement =>
  h('path', { d: `M 0 ${top + 0.5} H ${WIDTH}`, stroke: THEME_COLOR.border });

const stepDescLine = (index: number, title: string | undefined): string =>
  title ? `${index + 1}. ${title}` : `${index + 1}`;

function stillSvg(doc: DavDocument, layout: Layout): string {
  const view = resolveView(doc, layout, null);
  const { rect } = wholeDiagramFrame(layout, view);
  return svgDocument(rect, viewBoxOf(rect), doc.title, undefined, [
    h('rect', { ...roundRect(rect), fill: THEME_COLOR.bg }),
    buildDefs(),
    buildScene(view, ICON_SHAPES),
  ]);
}

/** One step as a still picture of the whole diagram, under the step's number and text. */
function stepStillSvg(doc: DavDocument, layout: Layout, index: number, locale: ViewerLocale) {
  const view = resolveView(doc, layout, index);
  const { rect } = wholeDiagramFrame(layout, view);
  const canvas = wholeCanvas(rect);
  const slot: StepSlot = { index, view, start: 0, phasesEnd: 0, end: 1, phases: [] };
  // A clock whose one moment is the whole file: nothing in it changes, so nothing animates.
  const head = header([slot], doc.steps.length, locale, new Clock(1), null);
  const scene = buildScene(view, ICON_SHAPES);
  stillHighlights(scene, view);
  const world = worldSvg(
    head.height + 1,
    canvas.height,
    visibleWorld(canvas, wholePose(canvas, rect)),
    scene,
  );
  return sheetSvg(
    head.height + 1 + canvas.height,
    doc.title,
    stepDescLine(index, doc.steps[index]?.title),
    [world, head.el, headerDivider(head.height)],
  );
}

function animatedSvg(
  doc: DavDocument,
  layout: Layout,
  locale: ViewerLocale,
  cameraMode: 'follow' | 'whole',
  only?: number,
): string {
  const { steps, total } = schedule(doc, layout, only);
  const clock = new Clock(total);
  const wholeRect = wholeAcrossSteps(doc, layout, steps);
  const canvas: Size =
    cameraMode === 'whole' ? wholeCanvas(wholeRect) : { width: WIDTH, height: CANVAS_HEIGHT };

  const events: Array<[number, Pose]> =
    cameraMode === 'whole'
      ? [[0, wholePose(canvas, wholeRect)]]
      : planCamera(canvas, layout, steps);
  const camera = cameraKeys(events, total).map(([t, pose]): [number, Rect] => [
    t,
    visibleWorld(canvas, pose),
  ]);
  const whole = wholeRect;
  const start = events[0]?.[1];
  const startWorld = start ? visibleWorld(canvas, start) : whole;
  // The minimap only helps when the camera ever shows less than the whole diagram.
  const zoomedIn = camera.some(
    ([, r]) =>
      r.x > whole.x + 1 ||
      r.y > whole.y + 1 ||
      r.x + r.width < whole.x + whole.width - 1 ||
      r.y + r.height < whole.y + whole.height - 1,
  );
  const mapFrame = cameraMode === 'follow' && zoomedIn ? minimapFrame(doc, layout) : null;

  const head = header(steps, doc.steps.length, locale, clock, mapFrame?.size ?? null);
  const timelineTop = head.height;
  // One step has nothing to rule; a line separates the header from what follows.
  const zoneTop = timelineTop + (only === undefined ? TIMELINE_HEIGHT : 1);
  const strip = doc.groups.length > 0 ? zoneStrip(steps, zoneTop, locale, clock) : null;
  const canvasTop = zoneTop + (strip ? ZONE_STRIP_HEIGHT : 0);
  const canvasBottom = canvasTop + canvas.height;

  const world = worldSvg(canvasTop, canvas.height, startWorld);
  pushAll(
    world,
    clock.track(
      'viewBox',
      camera.map(([t, r]) => [t, viewBoxOf(r)]),
      { eased: true },
    ),
  );
  for (const step of steps) {
    const scene = buildScene(step.view, ICON_SHAPES, { groupLabels: false });
    animateHighlights(scene, step, clock);
    world.children.push(clock.showDuring(h('g', {}, scene), [[step.start, step.end]]));
  }
  pushAll(world, zoneLabelLayer(doc, layout, steps, camera, startWorld, clock, total));
  const packets = h('g', { class: 'dav-layer-packets' });
  for (const step of steps) {
    for (const phase of step.phases) {
      packets.children.push(
        clock.showDuring(
          h('g', {}, ...phase.packets.map((packet) => animatedPacket(packet, phase, clock))),
          [[phase.start, phase.end]],
        ),
      );
    }
  }
  world.children.push(packets);

  const map =
    mapFrame &&
    minimap(
      mapFrame,
      steps,
      {
        x: WIDTH - PAD_X - mapFrame.size.width,
        y: (head.height - mapFrame.size.height) / 2,
      },
      camera,
      clock,
    );

  const description = steps
    .map((step) => stepDescLine(step.index, doc.steps[step.index]?.title))
    .join('\n');
  return sheetSvg(canvasBottom, doc.title, description, [
    world,
    head.el,
    only === undefined ? timeline(steps, timelineTop, clock, total) : headerDivider(timelineTop),
    strip,
    map,
  ]);
}

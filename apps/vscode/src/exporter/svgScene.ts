import type { Layout, Rect } from '../layout';
import { pushToMap } from '../model/text';
import type { DavDocument } from '../model/types';
import { idPair } from '../model/zones';
import {
  activeLabelFill,
  buildPacket,
  computePacketCalloutBox,
  dimClass,
  estimateTextWidth,
  fitText,
  flowColors,
  h,
  type IconShapes,
  type Packet,
  packetBubblePath,
  packetPosition,
  paint,
  placeZoneLabels,
  type ResolvedView,
  THEME_COLOR,
  type VElement,
  ZONE_LABEL,
  type ZoneLabelEntry,
  zoneColor,
  zoneLabelRoom,
  zoneMoves,
} from '../scene';
import { cameraSamples } from './svgCamera';
import {
  type Clock,
  childWithClass,
  complement,
  type Interval,
  intersect,
  isElement,
  layer,
  mergeIntervals,
  num,
  type PhaseSlot,
  pushAll,
  roundRect,
  SAMPLE_MS,
  type StepSlot,
  withAttrs,
} from './svgClock';

const activeLabelAttrs = (color: string) => ({
  fill: activeLabelFill(color),
  'font-weight': 700,
});

/**
 * Does over time what the preview's player does for the running phase: shows its flows, bolds its
 * rail labels, lights its numbered stop and outlines the zones it moves between.
 */
export function animateHighlights(scene: VElement, step: StepSlot, clock: Clock): void {
  const { phases, view } = step;
  if (phases.length === 0) return;
  const colors = phases.map((phase) => flowColors(phase.packets));
  const span: Interval = [step.start, step.end];
  const during = (phase: PhaseSlot): Interval => [phase.start, phase.end];
  const edgeIntervalsByColor = (edgeId: string): Map<string, Interval[]> => {
    const byColor = new Map<string, Interval[]>();
    phases.forEach((phase, j) => {
      const color = colors[j]?.get(edgeId);
      if (color !== undefined) pushToMap(byColor, color, during(phase));
    });
    return byColor;
  };

  const flows = layer(scene, 'dav-layer-flows');
  if (flows) {
    flows.children = flows.children.flatMap((flow) => {
      if (!isElement(flow)) return [];
      const byColor = edgeIntervalsByColor(String(flow.attrs['data-edge']));
      return [...byColor].map(([color, intervals]) =>
        clock.showDuring(withAttrs(flow, { stroke: paint(color) }), intervals),
      );
    });
  }

  for (const label of layer(scene, 'dav-layer-labels')?.children ?? []) {
    const text = isElement(label) ? label.children[0] : undefined;
    if (!isElement(label) || !isElement(text) || text.attrs['data-edge'] === undefined) continue;
    const byColor = edgeIntervalsByColor(String(text.attrs['data-edge']));
    label.children = [
      clock.showDuring(withAttrs(text, {}), complement([...byColor.values()].flat(), span)),
      ...[...byColor].map(([color, intervals]) =>
        clock.showDuring(withAttrs(text, activeLabelAttrs(color)), intervals),
      ),
    ];
  }

  const stops = layer(scene, 'dav-layer-stops');
  if (stops) {
    stops.children = stops.children.flatMap((stop) => {
      if (!isElement(stop)) return [];
      const phase = phases[Number(stop.attrs['data-phase'])];
      if (!phase) return [stop];
      const current = withAttrs(stop, { class: 'dav-stop is-current' });
      current.children = current.children.map((child) => {
        if (!isElement(child)) return child;
        if (child.tag === 'circle') {
          return withAttrs(child, { fill: String(stop.attrs['data-active-fill']), r: 14 });
        }
        return withAttrs(child, { fill: String(stop.attrs['data-active-text']) });
      });
      return [
        clock.showDuring(withAttrs(stop, {}), complement([during(phase)], span)),
        clock.showDuring(current, [during(phase)]),
      ];
    });
  }

  const groups = layer(scene, 'dav-layer-groups');
  if (groups) {
    const rects = new Map(view.groups.map((g) => [g.id, g.rect]));
    const outlines = new Map<string, { rect: Rect; color: string; intervals: Interval[] }>();
    for (const phase of phases) {
      for (const place of zoneMoves(view, phase.packets).flat()) {
        const rect = rects.get(place.id);
        if (!rect) continue;
        const color = zoneColor(place.color);
        const key = idPair(place.id, color);
        const outline = outlines.get(key) ?? { rect, color, intervals: [] };
        if (!outline.intervals.some(([a]) => a === phase.start)) {
          outline.intervals.push(during(phase));
        }
        outlines.set(key, outline);
      }
    }
    for (const { rect, color, intervals } of outlines.values()) {
      groups.children.push(
        clock.showDuring(
          h('rect', {
            ...roundRect(rect),
            rx: 14,
            fill: 'none',
            stroke: color,
            'stroke-width': 1.75,
            'vector-effect': 'non-scaling-stroke',
          }),
          intervals,
        ),
      );
    }
  }
}

/**
 * Draws a step as the preview does with animation stopped: every flow of the step lit in its
 * color, with its rail labels emphasized and its numbered stops at rest.
 */
export function stillHighlights(scene: VElement, view: ResolvedView): void {
  const colors = flowColors(view.phases.flat());
  const flows = layer(scene, 'dav-layer-flows');
  if (flows) {
    flows.children = flows.children.flatMap((flow) => {
      if (!isElement(flow)) return [];
      const color = colors.get(String(flow.attrs['data-edge']));
      return color === undefined ? [] : [withAttrs(flow, { stroke: paint(color) })];
    });
  }
  for (const label of layer(scene, 'dav-layer-labels')?.children ?? []) {
    const text = isElement(label) ? label.children[0] : undefined;
    if (!isElement(label) || !isElement(text)) continue;
    const color = colors.get(String(text.attrs['data-edge']));
    if (color === undefined) continue;
    label.children = [withAttrs(text, activeLabelAttrs(color))];
  }
}

function packetTimes(durationMs: number): number[] {
  const count = Math.max(2, Math.ceil(durationMs / SAMPLE_MS));
  return Array.from({ length: count + 1 }, (_, i) => (durationMs * i) / count);
}

/** A packet riding its rail during its phase; it waits at the end once it arrives. */
export function animatedPacket(
  packet: Packet,
  phase: PhaseSlot,
  clock: Clock,
  icons: IconShapes,
): VElement {
  const el = buildPacket(packet, icons, 0);
  const times = packetTimes(packet.durationMs);
  const points = times.map((ms) => packetPosition(packet, ms / packet.durationMs));
  const dot = childWithClass(el, 'dav-packet-dot');
  if (dot) {
    pushAll(
      dot,
      clock.track(
        'transform',
        times.map((ms, i) => [
          phase.start + ms,
          `${num(points[i]?.x ?? 0)},${num(points[i]?.y ?? 0)}`,
        ]),
        { translate: true },
      ),
    );
  }
  const bubble = childWithClass(el, 'dav-packet-bubble');
  const box = computePacketCalloutBox(packet);
  if (bubble && box) {
    pushAll(
      bubble,
      clock.track(
        'd',
        times.map((ms, i) => [
          phase.start + ms,
          packetBubblePath(box, points[i] ?? { x: 0, y: 0 }, packet.icon ? 21 : 13),
        ]),
      ),
    );
  }
  return el;
}

/**
 * Keeps zone names inside the visible `viewBox` as the camera moves, matching `ZoneLabels.follow`
 * in the preview. Drawn in one layer above the step scenes so station nodes never cover a sliding
 * zone name.
 */
export function zoneLabelLayer(
  doc: DavDocument,
  layout: Layout,
  steps: readonly StepSlot[],
  camera: ReadonlyArray<readonly [number, Rect]>,
  startWorld: Rect,
  clock: Clock,
  total: number,
): VElement | null {
  const indices = new Map<string, number>();
  const zones: Array<ZoneLabelEntry & { id: string; text: string }> = [];
  for (const g of doc.groups) {
    const rect = layout.groups[g.id];
    if (!rect) continue;
    const text = fitText(g.label, ZONE_LABEL.size, zoneLabelRoom(rect.width));
    indices.set(g.id, zones.length);
    zones.push({
      id: g.id,
      text,
      rect,
      width: estimateTextWidth(text, ZONE_LABEL.size),
      parentIndex: g.parentId === undefined ? -1 : (indices.get(g.parentId) ?? -1),
    });
  }
  if (zones.length === 0) return null;

  const samples = cameraSamples(camera, startWorld, total);
  const placements = samples.map(([, w]) => placeZoneLabels(zones, w));
  const out = h('g', { class: 'dav-layer-zone-labels' });

  zones.forEach((zone, i) => {
    const coords = samples.map((_, s) => {
      const p = placements[s]?.[i];
      return p && !p.hidden ? { x: p.x, y: p.y } : undefined;
    });

    const visible = mergeIntervals(
      samples
        .slice(0, -1)
        .flatMap(([a], s): Interval[] =>
          coords[s] && coords[s + 1] ? [[a, samples[s + 1]?.[0] ?? total]] : [],
        ),
    );
    if (visible.length === 0) return;

    const coordAt = (t: number): { x: number; y: number } => {
      for (let s = 0; s < samples.length - 1; s++) {
        const t0 = samples[s]?.[0] ?? 0;
        const t1 = samples[s + 1]?.[0] ?? total;
        const c0 = coords[s];
        const c1 = coords[s + 1];
        if (!c0 || !c1 || t < t0 || t > t1) continue;
        if (t <= t0) return c0;
        if (t >= t1) return c1;
        const u = (t - t0) / (t1 - t0);
        return { x: c0.x + (c1.x - c0.x) * u, y: c0.y + (c1.y - c0.y) * u };
      }
      return { x: zone.rect.x + ZONE_LABEL.inset, y: zone.rect.y + ZONE_LABEL.baseline };
    };

    const stepIntervals = (dimmed: boolean): Interval[] =>
      mergeIntervals(
        steps
          .filter(
            (step) => Boolean(step.view.groups.find((g) => g.id === zone.id)?.dimmed) === dimmed,
          )
          .map((step): Interval => [step.start, step.end]),
      );

    for (const dimmed of [false, true]) {
      const intervals = intersect(visible, stepIntervals(dimmed));
      if (intervals.length === 0) continue;
      const points: Array<[number, { x: number; y: number }]> = [];
      for (const [a, b] of intervals) {
        points.push([a, coordAt(a)]);
        for (let s = 0; s < samples.length; s++) {
          const t = samples[s]?.[0] ?? 0;
          const c = coords[s];
          if (c && t > a && t < b) points.push([t, c]);
        }
        points.push([b, coordAt(b)]);
      }
      const start = points[0]?.[1];
      if (!start) continue;
      const textEl = pushAll(
        h(
          'text',
          {
            x: num(start.x),
            y: num(start.y),
            class: 'dav-group-label',
            'font-size': ZONE_LABEL.size,
            fill: THEME_COLOR.fg,
          },
          zone.text,
        ),
        clock.track(
          'x',
          points.map(([t, p]) => [t, num(p.x)]),
        ),
        clock.track(
          'y',
          points.map(([t, p]) => [t, num(p.y)]),
        ),
      );
      out.children.push(
        clock.showDuring(
          h('g', { class: dimClass('dav-group', dimmed), 'data-id': zone.id }, textEl),
          intervals,
        ),
      );
    }
  });
  return out.children.length > 0 ? out : null;
}

import type { Rect } from '../layout';
import { pushToMap } from '../model/text';
import { idPair } from '../model/zones';
import {
  activeLabelFill,
  buildPacket,
  cornerShares,
  flowColors,
  h,
  type IconShapes,
  type Packet,
  packetPosition,
  packetShare,
  paint,
  type ResolvedView,
  type VElement,
  zoneColor,
  zoneMoves,
} from '../scene';
import {
  type Clock,
  childWithClass,
  complement,
  type Interval,
  isElement,
  layer,
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

/**
 * The times at which a packet's position is written down: at even intervals, and whenever it
 * starts, is half way round or leaves a corner of its rail. Between two times the packet moves
 * in a straight line, so without the corners it would cut across them.
 */
function packetTimes(packet: Packet): number[] {
  const { durationMs } = packet;
  const count = Math.max(2, Math.ceil(durationMs / SAMPLE_MS));
  const corners = cornerShares(packet.path);
  const times: number[] = [];
  for (let i = 0; i <= count; i++) {
    const from = i / count;
    times.push(durationMs * from);
    if (i === count || corners.length === 0) continue;
    const to = (i + 1) / count;
    const a = packetShare(packet, from);
    const b = packetShare(packet, to);
    const passed = corners
      .filter((share) => share > Math.min(a, b) && share < Math.max(a, b))
      .sort((p, q) => (a < b ? p - q : q - p));
    for (const share of passed) {
      // The packet only goes one way within an interval: close in on the moment it is there.
      let low = from;
      let high = to;
      for (let k = 0; k < 20; k++) {
        const mid = (low + high) / 2;
        if (packetShare(packet, mid) < share === a < b) low = mid;
        else high = mid;
      }
      times.push(durationMs * ((low + high) / 2));
    }
  }
  return times;
}

/** A packet riding its rail during its phase; it waits at the end once it arrives. */
export function animatedPacket(
  packet: Packet,
  phase: PhaseSlot,
  clock: Clock,
  icons: IconShapes,
): VElement {
  const el = buildPacket(packet, icons, 0);
  const times = packetTimes(packet);
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
  return el;
}

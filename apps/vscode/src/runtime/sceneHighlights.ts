import {
  activeLabelFill,
  flowColors,
  type Packet,
  paint,
  THEME_COLOR,
  type ZoneMove,
  zoneColor,
} from '../scene';

interface GroupTarget {
  id: string;
  el: SVGElement;
  rect: SVGRectElement | null;
}

interface EdgeTarget {
  edgeId: string;
  el: SVGElement;
}

interface StopTarget {
  phase: string | null;
  el: SVGElement;
  activeFill: string | null;
  activeText: string | null;
  circle: SVGCircleElement | null;
  text: SVGTextElement | null;
}

export interface SceneTargets {
  groups: GroupTarget[];
  flows: EdgeTarget[];
  edgeLabels: EdgeTarget[];
  stops: StopTarget[];
}

/**
 * Indexes the elements of a rendered scene that change across phases.
 * Must run after `ZoneLabels.collect`, which moves `.dav-group-label` holders out of `sceneLayer`.
 */
export function collectSceneTargets(sceneLayer: SVGGElement): SceneTargets {
  return {
    groups: Array.from(sceneLayer.querySelectorAll<SVGElement>('.dav-group'), (el) => ({
      id: el.getAttribute('data-id') ?? '',
      el,
      rect: el.querySelector<SVGRectElement>('rect'),
    })),
    flows: Array.from(sceneLayer.querySelectorAll<SVGElement>('.dav-flow'), (el) => ({
      edgeId: el.getAttribute('data-edge') ?? '',
      el,
    })),
    edgeLabels: Array.from(
      sceneLayer.querySelectorAll<SVGElement>('.dav-edge-label text'),
      (el) => ({
        edgeId: el.getAttribute('data-edge') ?? '',
        el,
      }),
    ),
    stops: Array.from(sceneLayer.querySelectorAll<SVGElement>('.dav-stop'), (el) => ({
      phase: el.getAttribute('data-phase'),
      el,
      activeFill: el.getAttribute('data-active-fill'),
      activeText: el.getAttribute('data-active-text'),
      circle: el.querySelector('circle'),
      text: el.querySelector('text'),
    })),
  };
}

/**
 * Shows the `.dav-flow` rail overlay only on the edges of the current animation phase,
 * or on every edge of the step while animation is stopped.
 */
export function syncPhaseHighlights(
  targets: SceneTargets,
  phases: readonly Packet[][],
  phase: number,
  stopped: boolean,
  pinned: boolean,
): void {
  if (phases.length === 0) return;
  const running = phases[Math.min(phase, phases.length - 1)] ?? [];
  // A phase picked while stopped goes first, so that its colors win on shared edges.
  const activeEdges = flowColors(
    stopped ? [...(pinned ? running : []), ...phases.flat()] : running,
  );
  for (const { edgeId, el } of targets.flows) {
    const color = activeEdges.get(edgeId);
    if (color === undefined) {
      el.setAttribute('hidden', '');
    } else {
      el.removeAttribute('hidden');
      el.setAttribute('stroke', paint(color));
    }
  }
  for (const { edgeId, el } of targets.edgeLabels) {
    const color = activeEdges.get(edgeId);
    el.setAttribute('fill', color === undefined ? THEME_COLOR.fg : activeLabelFill(color));
    el.setAttribute('font-weight', color === undefined ? '400' : '700');
  }
  const currentPhase = stopped && !pinned ? null : String(Math.min(phase, phases.length - 1));
  for (const stop of targets.stops) {
    const current = stop.phase === currentPhase;
    stop.el.classList.toggle('is-current', current);
    const fill = current ? stop.activeFill : null;
    const text = current ? stop.activeText : null;
    stop.circle?.setAttribute('fill', fill ?? THEME_COLOR.fg);
    stop.text?.setAttribute('fill', text ?? THEME_COLOR.bg);
  }
}

/** Outlines the zones the current phase moves between, clearing any earlier outlines. */
export function outlineZones(targets: SceneTargets, moves: readonly ZoneMove[]): void {
  for (const { el, rect } of targets.groups) {
    if (!el.classList.contains('is-zone-active')) continue;
    el.classList.remove('is-zone-active');
    rect?.style.removeProperty('stroke');
  }
  if (moves.length === 0) return;
  const active = new Map(moves.flat().map((place) => [place.id, place]));
  for (const { id, el, rect } of targets.groups) {
    const zone = active.get(id);
    if (!zone || !rect) continue;
    el.classList.add('is-zone-active');
    rect.style.setProperty('stroke', zoneColor(zone.color));
  }
}

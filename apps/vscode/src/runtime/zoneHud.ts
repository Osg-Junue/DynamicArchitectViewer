import { type ZoneMove, type ZonePlace, zoneColor } from '../scene';
import { html } from './dom';

const MAX_MOVES = 3;

function placeName(place: ZonePlace, departing: boolean): HTMLElement {
  const dot = html('i', { class: 'dav-zone-dot' });
  dot.style.setProperty('background', zoneColor(place.color));
  return html(
    'span',
    { class: departing ? 'dav-zone-name is-from' : 'dav-zone-name' },
    dot,
    place.label,
  );
}

/** Fills the strip above the canvas with the moves of the current phase. */
export function renderZoneHud(
  container: HTMLElement,
  moves: readonly ZoneMove[],
  durationMs: number,
  insideLabel: string,
): void {
  for (const [from, to] of moves.slice(0, MAX_MOVES)) {
    const pair = html('span', { class: 'dav-zone-pair' });
    if (from === to) {
      pair.append(placeName(from, false), html('span', { class: 'dav-zone-inside' }, insideLabel));
    } else {
      const progress = html('i');
      progress.style.setProperty('background', zoneColor(to.color));
      progress.style.setProperty('animation-duration', `${durationMs.toFixed(0)}ms`);
      pair.append(
        placeName(from, true),
        html('span', { class: 'dav-zone-line' }, progress),
        placeName(to, false),
      );
    }
    container.append(pair);
  }
  if (moves.length > MAX_MOVES) {
    container.append(html('span', { class: 'dav-zone-inside' }, `+${moves.length - MAX_MOVES}`));
  }
}

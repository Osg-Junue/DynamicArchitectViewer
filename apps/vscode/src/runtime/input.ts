export interface PointerActions {
  panBy(dx: number, dy: number): void;
  zoomAt(factor: number, x: number, y: number): void;
  selectNode(nodeId: string): void;
}

export function bindPointer(viewport: HTMLElement, svgEl: SVGSVGElement, on: PointerActions): void {
  let drag: { id: number; x: number; y: number; captured: boolean } | null = null;
  const down = (e: PointerEvent) => {
    if (e.button !== 0 || e.defaultPrevented) return;
    if (e.target instanceof Element && e.target.closest('.dav-zoom-group, .dav-minimap')) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, captured: false };
  };
  const move = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.captured) {
      if (Math.hypot(dx, dy) < 3) return;
      drag.captured = true;
      viewport.setPointerCapture(e.pointerId);
      viewport.classList.add('dav-dragging');
    }
    on.panBy(dx, dy);
    drag.x = e.clientX;
    drag.y = e.clientY;
  };
  const up = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    const wasDragged = drag.captured;
    if (drag.captured && viewport.hasPointerCapture(e.pointerId)) {
      viewport.releasePointerCapture(e.pointerId);
    }
    drag = null;
    viewport.classList.remove('dav-dragging');
    if (!wasDragged && e.type === 'pointerup') {
      const nodeEl = e.target instanceof Element ? e.target.closest('.dav-node') : null;
      const nodeId = nodeEl?.getAttribute('data-id');
      if (nodeId) on.selectNode(nodeId);
    }
  };
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    const box = svgEl.getBoundingClientRect();
    on.zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - box.left, e.clientY - box.top);
  };
  viewport.addEventListener('pointerdown', down);
  viewport.addEventListener('pointermove', move);
  viewport.addEventListener('pointerup', up);
  viewport.addEventListener('pointercancel', up);
  viewport.addEventListener('wheel', wheel, { passive: false });
}

export interface KeyboardActions {
  next(): void;
  prev(): void;
  togglePlay(): void;
  showOverview(): void;
}

let tracking = false;

/**
 * Marks the page while the last input came from a pointer, so that controls show their focus ring
 * only after keyboard input. A select counts as focused for the keyboard even when it was clicked.
 */
export function trackInputModality(): void {
  if (tracking) return;
  tracking = true;
  const root = document.documentElement;
  document.addEventListener('pointerdown', () => root.classList.add('dav-pointer'), true);
  document.addEventListener('keydown', () => root.classList.remove('dav-pointer'), true);
}

export function bindKeyboard(
  target: Window | HTMLElement,
  root: HTMLElement,
  playbackBar: HTMLElement,
  on: KeyboardActions,
): () => void {
  const onKey = (ke: KeyboardEvent) => {
    if (!root.isConnected) return;
    const targetEl = ke.target instanceof Element ? ke.target : null;
    const tag = targetEl?.tagName;
    if (
      ke.defaultPrevented ||
      ke.ctrlKey ||
      ke.metaKey ||
      ke.altKey ||
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      (targetEl instanceof HTMLElement && targetEl.isContentEditable) ||
      document.querySelector('dialog[open]') !== null
    ) {
      return;
    }
    if (ke.key === 'ArrowRight') on.next();
    else if (ke.key === 'ArrowLeft') on.prev();
    else if (ke.key === ' ' && tag !== 'BUTTON') on.togglePlay();
    else if (ke.key === 'Home') on.showOverview();
    else return;
    ke.preventDefault();
  };
  const keyTarget: GlobalEventHandlers = target;
  keyTarget.addEventListener('keydown', onKey);
  const externalBar = target !== window && !root.contains(playbackBar);
  if (externalBar) playbackBar.addEventListener('keydown', onKey);
  return () => {
    keyTarget.removeEventListener('keydown', onKey);
    if (externalBar) playbackBar.removeEventListener('keydown', onKey);
  };
}

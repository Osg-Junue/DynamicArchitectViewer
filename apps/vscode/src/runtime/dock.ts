import type { DavStep } from '../model/types';
import type { ResolvedView } from '../scene';
import { clear, html } from './dom';
import type { ViewerStrings } from './i18n';

/**
 * The step's description, which goes into the playback bar under the title, and the timeline:
 * a thin segmented line under the bar with a progress fill per step. The step's number and title
 * are kept for screen readers only, since the bar's step list shows them.
 */
export class StepDock {
  /** The timeline strip under the bar. */
  readonly element: HTMLElement;
  /** The description, for the playback bar. */
  readonly info: HTMLElement;
  readonly #strings: ViewerStrings;
  readonly #onSelectStep: (index: number) => void;
  readonly #stepTitleEl: HTMLElement;
  readonly #stepDescEl: HTMLElement;
  readonly #timelineEl: HTMLElement;
  #ticks: HTMLButtonElement[] = [];
  #tickFills: HTMLElement[] = [];

  constructor(strings: ViewerStrings, onSelectStep: (index: number) => void) {
    this.#strings = strings;
    this.#onSelectStep = onSelectStep;
    this.#stepTitleEl = html('div', { class: 'dav-step-title dav-sr-only' });
    this.#stepDescEl = html('div', { class: 'dav-step-desc' });
    this.#timelineEl = html('div', {
      class: 'dav-timeline',
      role: 'group',
      'aria-label': strings.steps,
      'data-testid': 'step-timeline',
    });
    this.info = html(
      'div',
      { class: 'dav-step-info', 'aria-live': 'polite' },
      this.#stepTitleEl,
      this.#stepDescEl,
    );
    this.element = html(
      'div',
      { class: 'dav-dock', 'data-testid': 'top-step-dock' },
      this.#timelineEl,
    );
  }

  /** Rebuilds the timeline ruler buttons for the document's steps. */
  setSteps(steps: readonly DavStep[]): void {
    clear(this.#timelineEl);
    this.#timelineEl.hidden = steps.length === 0;
    this.#ticks = [];
    this.#tickFills = [];
    steps.forEach((step, i) => {
      const fill = html('span', { class: 'dav-tick-fill', 'aria-hidden': 'true' });
      const tick = html(
        'button',
        {
          type: 'button',
          class: 'dav-tick',
          title: step.title,
          'aria-label': `${i + 1}. ${step.title}`,
        },
        fill,
      );
      tick.addEventListener('click', () => this.#onSelectStep(i));
      this.#ticks.push(tick);
      this.#tickFills.push(fill);
      this.#timelineEl.append(tick);
    });
  }

  /** Updates the active step header text and timeline graduation states. */
  showStep(view: ResolvedView, stepCount: number): void {
    const s = this.#strings;
    if (view.stepIndex === null) {
      this.#stepTitleEl.textContent = s.overview;
      this.#stepDescEl.textContent = s.overviewHint;
    } else {
      clear(this.#stepTitleEl);
      this.#stepTitleEl.append(
        html('span', { class: 'dav-step-no' }, s.stepLabel(view.stepIndex + 1, stepCount)),
        ` ${view.stepTitle ?? ''}`,
      );
      this.#stepDescEl.textContent = view.description ?? '';
    }
    // The bar shows two lines of it; the whole text is a hover away.
    this.#stepDescEl.title = this.#stepDescEl.textContent ?? '';

    const current = view.stepIndex;
    this.#ticks.forEach((tick, i) => {
      tick.classList.toggle('is-current', i === current);
      tick.classList.toggle('is-past', current !== null && i < current);
      if (i === current) tick.setAttribute('aria-current', 'step');
      else tick.removeAttribute('aria-current');
    });
    this.#tickFills.forEach((fill, i) => {
      fill.style.transform = current !== null && i < current ? 'scaleX(1)' : 'scaleX(0)';
    });
  }

  /** Fills the current step's ruler graduation in proportion to its animation phases. */
  updateProgress(
    stepIndex: number | null,
    phaseDurations: readonly number[],
    phase: number,
    elapsed: number,
    stopped: boolean,
  ): void {
    const fill = stepIndex === null ? undefined : this.#tickFills[stepIndex];
    if (!fill) return;
    const total = phaseDurations.reduce((sum, ms) => sum + ms, 0);
    const done =
      phaseDurations.slice(0, phase).reduce((sum, ms) => sum + ms, 0) +
      Math.min(elapsed, phaseDurations[phase] ?? 0);
    const progress = total === 0 || stopped ? 1 : Math.min(1, done / total);
    fill.style.transform = `scaleX(${progress.toFixed(3)})`;
  }
}

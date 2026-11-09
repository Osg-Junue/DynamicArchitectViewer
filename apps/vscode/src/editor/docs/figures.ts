import { parse } from '../../dsl';
import { computeLayout, type Layout, type Rect, stationRect } from '../../layout';
import type { DavDocument, IconName } from '../../model/types';
import { clear, html, renderSvg, svg } from '../../runtime/dom';
import { PHASE_MS, Player, type PlayerData } from '../../runtime/player';
import {
  buildDefs,
  buildScene,
  paint,
  type ResolvedView,
  resolveView,
  sceneBounds,
} from '../../scene';
import { mapStepLines, renderCodeLines } from './code';

export type Translate = (ja: string, en: string) => string;

export interface LiveFigure {
  element: HTMLElement;
  destroy(): void;
}

export interface LiveFigureOptions {
  caption?: string;
  /** Show the phase strip under the stage. */
  phases?: boolean;
  /** Show how `state` values accumulate over the steps. */
  matrix?: boolean;
}

function compile(dsl: string): PlayerData {
  const { document } = parse(dsl);
  return { document, layout: computeLayout(document) };
}

export async function copyWithFeedback(
  text: string,
  button: HTMLElement,
  label: string,
  copiedLabel: string,
  failedLabel: string,
  labelEl: HTMLElement = button,
): Promise<void> {
  let copied = true;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    copied = false; // Clipboard access can be denied in insecure or embedded contexts.
  }
  const stateClass = copied ? 'is-copied' : 'is-copy-failed';
  labelEl.textContent = copied ? copiedLabel : failedLabel;
  button.classList.add(stateClass);
  window.setTimeout(() => {
    labelEl.textContent = label;
    button.classList.remove(stateClass);
  }, 1400);
}

export function copyFailedLabel(t: Translate): string {
  return t('コピー失敗', 'Copy failed');
}

export function copyButton(text: string, t: Translate): HTMLButtonElement {
  const label = t('コピー', 'Copy');
  const button = html('button', { type: 'button', class: 'doc-copy' }, label);
  button.addEventListener('click', () => {
    void copyWithFeedback(text, button, label, t('コピー済み', 'Copied'), copyFailedLabel(t));
  });
  return button;
}

export function swatchDot(cssColor: string): HTMLElement {
  const dot = html('span', { class: 'doc-dot' });
  dot.style.setProperty('--doc-swatch', cssColor);
  return dot;
}

function svgFrame(frame: Rect, view: ResolvedView, label: string): SVGSVGElement {
  return svg(
    'svg',
    {
      class: 'doc-diagram',
      role: 'img',
      'aria-label': label,
      viewBox: `${frame.x} ${frame.y} ${frame.width} ${frame.height}`,
    },
    renderSvg(buildDefs()) as SVGElement,
    renderSvg(buildScene(view)) as SVGElement,
  );
}

/** The whole diagram at one moment, drawn by the real scene builder. */
export function staticDiagram(dsl: string, label: string, stepIndex: number | null = null) {
  const { document, layout } = compile(dsl);
  const view = resolveView(document, layout, stepIndex);
  const headroom = view.edges.some((e) => e.from === e.to) ? 30 : 0;
  return svgFrame(sceneBounds(view, 10, headroom), view, label);
}

/** A single icon exactly as it appears on the canvas, cropped to its station. */
export function stationPreview(icon: IconName, color?: string): SVGSVGElement {
  const document: DavDocument = {
    version: 1,
    title: '',
    groups: [],
    nodes: [{ id: 'n', label: '', icon, visible: true, ...(color ? { color } : {}) }],
    edges: [],
    steps: [],
  };
  const layout = computeLayout(document);
  const station = stationRect(layout.nodes.n as Rect, icon);
  const pad = 4;
  return svgFrame(
    {
      x: station.x - pad,
      y: station.y - pad,
      width: station.width + pad * 2,
      height: station.height + pad * 2,
    },
    resolveView(document, layout, null),
    icon,
  );
}

function phaseStrip(t: Translate, onSelect: (phase: number) => void) {
  const element = html('div', { class: 'doc-phases', 'data-testid': 'doc-phase-strip' });
  let cells: HTMLElement[] = [];

  return {
    element,
    render(view: ResolvedView): void {
      clear(element);
      cells = view.phases.map((packets, index) =>
        html(
          'button',
          { type: 'button', class: 'doc-phase' },
          html(
            'span',
            { class: 'doc-phase-head' },
            html('span', {}, `${t('フェーズ', 'Phase')} ${index + 1}`),
            html('span', { class: 'doc-phase-time' }, `${PHASE_MS / 1000}s`),
          ),
          ...packets.map((packet) =>
            html(
              'span',
              { class: 'doc-phase-lane' },
              swatchDot(paint(packet.color)),
              `${packet.fromLabel} ${packet.roundTrip ? '⇄' : '→'} ${packet.toLabel}`,
            ),
          ),
        ),
      );
      cells.forEach((cell, index) => {
        cell.addEventListener('click', () => onSelect(index));
      });
      element.append(...cells);
    },
    setPhase(phase: number): void {
      cells.forEach((cell, index) => {
        cell.classList.toggle('is-active', index === phase);
      });
    },
  };
}

function stateValue(view: ResolvedView, target: string, attr: string, hiddenLabel: string): string {
  const node = view.nodes.find((n) => n.id === target);
  const group = view.groups.find((g) => g.id === target);
  const edge = view.edges.find((e) => e.id === target);
  const element = node ?? group ?? edge;
  if (attr === 'visible') return element ? 'true' : 'false';
  if (!element) return hiddenLabel;
  if (attr === 'badge') return node?.badge ?? '—';
  const color = node?.accent ?? group?.color ?? edge?.color;
  return color && !color.startsWith('var(') ? color : '—';
}

/** Table of each `state` target over time, derived from the resolved view of every step. */
function stateMatrix(document: DavDocument, layout: Layout, t: Translate) {
  const views = [null, ...document.steps.map((s) => s.index)].map((i) =>
    resolveView(document, layout, i),
  );
  const rows = new Map<string, Set<string>>();
  for (const step of document.steps) {
    for (const state of step.states) {
      const attrs = rows.get(state.target) ?? new Set<string>();
      for (const key of ['badge', 'color', 'visible'] as const) {
        if (state[key] !== undefined) attrs.add(key);
      }
      rows.set(state.target, attrs);
    }
  }

  const hiddenLabel = t('(非表示)', '(hidden)');
  const headers = views.map((_, i) =>
    html(
      'th',
      { scope: 'col' },
      i === 0 ? t('宣言時', 'Declared') : `${t('ステップ', 'Step')} ${i}`,
    ),
  );
  const columns: HTMLElement[][] = headers.map((header) => [header]);
  const body = [...rows].flatMap(([target, attrs]) =>
    [...attrs].map((attr) => {
      const texts = views.map((view) => stateValue(view, target, attr, hiddenLabel));
      return html(
        'tr',
        {},
        html('th', { scope: 'row' }, html('code', {}, `${target}.${attr}`)),
        ...texts.map((text, i) => {
          const changed = i > 0 && texts[i - 1] !== text;
          const td = html('td', { class: changed ? 'is-changed' : undefined }, text);
          columns[i]?.push(td);
          return td;
        }),
      );
    }),
  );

  const element = html(
    'div',
    { class: 'doc-table-wrap' },
    html(
      'table',
      { class: 'doc-table doc-matrix', 'data-testid': 'doc-state-matrix' },
      html('thead', {}, html('tr', {}, html('th', {}, 'state'), ...headers)),
      html('tbody', {}, ...body),
    ),
  );

  return {
    element,
    show(stepIndex: number | null): void {
      const active = stepIndex === null ? 0 : stepIndex + 1;
      columns.forEach((column, i) => {
        for (const cell of column) cell.classList.toggle('is-current', i === active);
      });
    },
  };
}

/** Source next to a real, running Player, with the running statements highlighted. */
export function liveFigure(dsl: string, t: Translate, options: LiveFigureOptions = {}): LiveFigure {
  const { document, layout } = compile(dsl);
  const hasSteps = document.steps.length > 0;
  const stepLines = mapStepLines(dsl);
  const lines = renderCodeLines(dsl);
  const pre = html('pre', { class: 'doc-code' }, ...lines);
  const toolbar = html('div', { class: 'doc-stage-tools' });
  const host = html('div', { class: 'doc-stage-host' });
  const strip = options.phases ? phaseStrip(t, (phase) => player.selectPhase(phase)) : null;
  const matrix = options.matrix ? stateMatrix(document, layout, t) : null;

  const scrollToLines = (from: number, to: number) => {
    const first = lines[from];
    const last = lines[to];
    if (!first || !last || pre.scrollHeight <= pre.clientHeight) return;
    const top = first.offsetTop - pre.offsetTop;
    const bottom = last.offsetTop - pre.offsetTop + last.offsetHeight;
    if (top < pre.scrollTop || bottom > pre.scrollTop + pre.clientHeight) {
      pre.scrollTop = top - first.offsetHeight;
    }
  };

  let shownStep: number | null | undefined;
  const onPhase = (view: ResolvedView, phase: number) => {
    const range = view.stepIndex === null ? undefined : stepLines[view.stepIndex];
    const running = new Set(range?.phases[phase]);
    lines.forEach((line, index) => {
      line.classList.toggle('is-step', !!range && index >= range.from && index <= range.to);
      line.classList.toggle('is-running', running.has(index));
    });
    // Phases repeat while the step plays, so scrolling on them would undo the reader's scrolling.
    if (view.stepIndex !== shownStep) {
      shownStep = view.stepIndex;
      if (range) scrollToLines(range.from, range.to);
      strip?.render(view);
      matrix?.show(view.stepIndex);
    }
    strip?.setPhase(phase);
  };

  const hint =
    document.steps.length > 1
      ? t(
          'ステップは目盛りの番号をクリックして切り替えます。',
          'Click a number on the ruler to change steps.',
        )
      : '';
  const caption = [options.caption, hint].filter(Boolean).join(' ');

  const element = html(
    'figure',
    { class: 'doc-figure', 'data-testid': 'doc-figure' },
    html(
      'div',
      { class: 'doc-figure-grid' },
      html('div', { class: 'doc-code-wrap' }, copyButton(dsl, t), pre),
      html(
        'div',
        { class: hasSteps ? 'doc-stage' : 'doc-stage is-static' },
        toolbar,
        host,
        strip?.element,
      ),
    ),
    matrix?.element,
    caption ? html('figcaption', {}, caption) : null,
  );

  const player = new Player(
    host,
    { document, layout },
    {
      autoplay: 'step',
      initialStep: hasSteps ? 0 : null,
      playbackSlot: toolbar,
      fixedFrame: true,
      onPhaseChange: onPhase,
    },
  );

  return { element, destroy: () => player.destroy() };
}

import { ATTRIBUTE_SCHEMA, formatDiagnostic, parse } from '../../dsl';
import { COLOR_RESET } from '../../model/types';
import { html } from '../../runtime/dom';
import type { ViewerLocale } from '../../runtime/i18n';
import { HOLD_MS } from '../../runtime/player';
import { MIN_PACKET_MS, PHASE_MS } from '../../scene';
import { codeBlock } from './code';
import { type LiveFigureOptions, liveFigure, staticDiagram, type Translate } from './figures';
import { COLOR_NONE_DSL, DIAGNOSTIC_EXAMPLES } from './snippets';

export interface DocContext {
  t: Translate;
  locale: ViewerLocale;
  currentDsl: string;
  /** AI prompt option, kept across page changes. */
  prompt: { includeCurrent: boolean };
  go(pageId: string): void;
  /** Registers a teardown that runs when the page is left. */
  track(cleanup: () => void): void;
}

export type DocGroupId = 'start' | 'catalog' | 'language' | 'reference' | 'tools';

export interface DocPage {
  id: string;
  group: DocGroupId;
  title: readonly [ja: string, en: string];
  lead: readonly [ja: string, en: string];
  render(ctx: DocContext): Array<Node | null>;
}

/** Text where `backticks` become inline code. */
export function rich(text: string): Node[] {
  return text
    .split('`')
    .map((part, i) => (i % 2 === 1 ? html('code', {}, part) : document.createTextNode(part)));
}

export const p = (text: string): HTMLParagraphElement => html('p', {}, ...rich(text));
export const h2 = (text: string): HTMLHeadingElement => html('h2', {}, text);
export const syntax = (text: string): HTMLParagraphElement =>
  html('p', { class: 'doc-syntax' }, html('code', {}, text));
export const key = (text: string): HTMLElement => html('kbd', {}, text);

export function list(items: readonly string[]): HTMLElement {
  return html('ul', { class: 'doc-list' }, ...items.map((item) => html('li', {}, ...rich(item))));
}

export function note(text: string): HTMLElement {
  return html('p', { class: 'doc-note' }, ...rich(text));
}

export function table(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<Node | string>>,
): HTMLElement {
  return html(
    'div',
    { class: 'doc-table-wrap' },
    html(
      'table',
      { class: 'doc-table' },
      html('thead', {}, html('tr', {}, ...headers.map((h) => html('th', { scope: 'col' }, h)))),
      html(
        'tbody',
        {},
        ...rows.map((row) =>
          html(
            'tr',
            {},
            ...row.map((cell) =>
              typeof cell === 'string' ? html('td', {}, ...rich(cell)) : html('td', {}, cell),
            ),
          ),
        ),
      ),
    ),
  );
}

export function attrValues(t: Translate): { color: string; string: string; bool: string } {
  return {
    color: t('色名', 'color name'),
    string: t('文字列', 'string'),
    bool: '`true` / `false`',
  };
}

export function attrTable(
  t: Translate,
  rows: ReadonlyArray<ReadonlyArray<Node | string>>,
): HTMLElement {
  return table([t('属性', 'Attribute'), t('値', 'Value'), t('効果', 'Effect')], rows);
}

export function live(ctx: DocContext, dsl: string, options: LiveFigureOptions = {}): Node {
  const figure = liveFigure(dsl, ctx.locale, ctx.t, options);
  ctx.track(figure.destroy);
  return figure.element;
}

function galleryItem(diagram: SVGSVGElement, caption: Node): HTMLElement {
  return html(
    'figure',
    { class: 'doc-gallery-item' },
    html('div', { class: 'doc-gallery-stage' }, diagram),
    html('figcaption', {}, caption),
  );
}

export function gallery(prelude: string, examples: readonly string[]): HTMLElement {
  return html(
    'div',
    { class: 'doc-gallery' },
    ...examples.map((code) => galleryItem(staticDiagram(prelude + code, code), codeBlock(code))),
  );
}

/** The same diagram before, during and after a color override. */
export function colorNoneComparison(t: Translate): HTMLElement {
  const frames: ReadonlyArray<readonly [number | null, string]> = [
    [null, t('宣言時', 'Declared')],
    [0, t('ステップ 1: `color: red`', 'Step 1: `color: red`')],
    [1, t(`ステップ 2: \`color: ${COLOR_RESET}\``, `Step 2: \`color: ${COLOR_RESET}\``)],
  ];
  return html(
    'div',
    { class: 'doc-gallery', 'data-testid': 'doc-color-none' },
    ...frames.map(([step, label]) =>
      galleryItem(
        staticDiagram(COLOR_NONE_DSL, label.replaceAll('`', ''), step),
        html('div', { class: 'doc-gallery-note' }, ...rich(label)),
      ),
    ),
  );
}

export function pageLink(ctx: DocContext, pageId: string, label: string): HTMLElement {
  const link = html('button', { type: 'button', class: 'doc-link' }, label);
  link.addEventListener('click', () => ctx.go(pageId));
  return link;
}

export function scopeChip(t: Translate, kind: 'carry' | 'local'): HTMLElement {
  return html(
    'span',
    { class: kind === 'carry' ? 'doc-scope is-carry' : 'doc-scope' },
    kind === 'carry' ? t('以降へ累積', 'Carries over') : t('そのステップのみ', 'This step only'),
  );
}

export function timingBar(t: Translate): HTMLElement {
  const segment = (label: string, ms: number, cls: string, time = `${ms / 1000}s`) => {
    const el = html('div', { class: `doc-timing-seg ${cls}` }, html('span', {}, label), time);
    el.style.flexGrow = String(ms);
    return el;
  };
  const phaseTime = `${MIN_PACKET_MS / 1000}s+`;
  return html(
    'div',
    { class: 'doc-timing', role: 'img', 'aria-label': t('1倍速の時間配分', 'Timing at 1x') },
    ...[1, 2, 3].map((n) => segment(`${t('フェーズ', 'Phase')} ${n}`, PHASE_MS, '', phaseTime)),
    segment(t('保持', 'Hold'), HOLD_MS, 'is-hold'),
  );
}

export function diagnosticsTable(ctx: DocContext): HTMLElement {
  const { t, locale } = ctx;
  const rows = Object.entries(DIAGNOSTIC_EXAMPLES).flatMap(([code, dsl]) => {
    const diagnostic = parse(dsl).diagnostics.find((d) => d.code === code);
    if (!diagnostic) return [];
    return [
      [
        html('code', {}, code),
        html(
          'span',
          { class: `doc-severity is-${diagnostic.severity}` },
          diagnostic.severity === 'error' ? t('エラー', 'Error') : t('警告', 'Warning'),
        ),
        codeBlock(dsl),
        formatDiagnostic(diagnostic, locale),
      ],
    ];
  });
  return html(
    'div',
    { 'data-testid': 'doc-diagnostics' },
    table(
      [
        t('コード', 'Code'),
        t('重大度', 'Severity'),
        t('発生例', 'Example'),
        t('メッセージ', 'Message'),
      ],
      rows,
    ),
  );
}

export function attributeMatrix(ctx: DocContext): HTMLElement {
  const entries = Object.entries(ATTRIBUTE_SCHEMA);
  const names = [...new Set(entries.flatMap(([, schema]) => Object.keys(schema)))];
  const typeLabel: Record<string, string> = {
    string: '"…"',
    bool: 'true | false',
    color: ctx.t('色名', 'color'),
    stateColor: `${ctx.t('色名', 'color')} | ${COLOR_RESET}`,
    icon: ctx.t('アイコン名', 'icon'),
    ident: 'id',
  };
  return table(
    ['', ...entries.map(([owner]) => owner)],
    names.map((name) => [
      html('code', {}, name),
      ...entries.map(([, schema]) => {
        const type = schema[name];
        return type
          ? html('span', { class: 'doc-type' }, typeLabel[type] ?? type)
          : html('span', { class: 'doc-absent' }, '—');
      }),
    ]),
  );
}

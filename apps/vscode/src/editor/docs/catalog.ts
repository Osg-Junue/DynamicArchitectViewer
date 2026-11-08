import { ICON_META, type IconCategory } from '../../model/icons';
import { COLOR_NAMES, type ColorName, ICON_NAMES, type IconName } from '../../model/types';
import { clear, html } from '../../runtime/dom';
import { paint } from '../../scene';
import {
  copyButton,
  copyWithFeedback,
  type LiveFigure,
  liveFigure,
  stationPreview,
  swatchDot,
  type Translate,
} from './figures';
import { colorLabDsl } from './snippets';

type Scheme = 'light' | 'dark';

/** Resolves a CSS color in a given color scheme to `#rrggbb`, reading the live theme tokens. */
function resolveHex(cssColor: string, scheme: Scheme): string {
  const probe = html('span', { class: `doc-scheme-${scheme}` });
  probe.style.color = cssColor;
  document.body.append(probe);
  const channels =
    getComputedStyle(probe)
      .color.match(/[\d.]+/g)
      ?.map(Number) ?? [];
  probe.remove();
  const [r = 0, g = 0, b = 0] = channels;
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

/** Dark text reads better on light fields (WCAG relative luminance midpoint). */
function needsDarkText(hex: string): boolean {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179;
}

function swatchField(cssColor: string, scheme: Scheme): HTMLElement {
  const hex = resolveHex(cssColor, scheme);
  const field = html(
    'div',
    {
      class: `doc-swatch-field doc-scheme-${scheme}${needsDarkText(hex) ? ' on-light' : ' on-dark'}`,
    },
    html('span', {}, scheme === 'light' ? 'Light' : 'Dark'),
    html('span', { class: 'doc-swatch-hex' }, hex),
  );
  field.style.setProperty('--doc-swatch', cssColor);
  return field;
}

export function colorPalette(t: Translate): HTMLElement {
  return html(
    'div',
    { class: 'doc-palette', 'data-testid': 'doc-palette' },
    ...COLOR_NAMES.map((name) =>
      html(
        'div',
        { class: 'doc-swatch' },
        html(
          'div',
          { class: 'doc-swatch-fields' },
          swatchField(paint(name), 'light'),
          swatchField(paint(name), 'dark'),
        ),
        html(
          'div',
          { class: 'doc-swatch-foot' },
          html('code', {}, name),
          copyButton(`color: ${name}`, t),
        ),
      ),
    ),
  );
}

function colorChips<C extends ColorName | null>(
  options: readonly C[],
  selected: C,
  onPick: (color: C) => void,
  t: Translate,
): HTMLElement {
  const buttons = options.map((color) => {
    const button = html(
      'button',
      {
        type: 'button',
        class: 'doc-chip',
        'data-testid': `doc-chip-${color ?? 'default'}`,
        'aria-pressed': String(color === selected),
      },
      swatchDot(color ? paint(color) : 'var(--dav-fg)'),
      color ?? t('指定なし', 'default'),
    );
    button.addEventListener('click', () => {
      for (const b of buttons) b.setAttribute('aria-pressed', String(b === button));
      onPick(color);
    });
    return button;
  });
  return html(
    'div',
    { class: 'doc-chips', role: 'group', 'aria-label': t('色を選択', 'Choose a color') },
    ...buttons,
  );
}

/** Applies a chosen color to every element kind at once, in a running player. */
export function colorLab(t: Translate, track: (cleanup: () => void) => void): HTMLElement {
  let figure: LiveFigure | null = null;
  const slot = html('div', { 'data-testid': 'doc-color-lab' });
  const show = (color: ColorName) => {
    figure?.destroy();
    clear(slot);
    figure = liveFigure(colorLabDsl(color), t);
    slot.append(figure.element);
  };
  track(() => figure?.destroy());
  show('blue');
  return html('div', {}, colorChips(COLOR_NAMES, 'blue', show, t), slot);
}

const ICON_DESCRIPTIONS: Record<IconName, readonly [ja: string, en: string]> = {
  server: ['サーバー / VM（既定）', 'Server or VM (default)'],
  container: ['コンテナ / Pod', 'Container or pod'],
  function: ['サーバーレス関数', 'Serverless function'],
  database: ['データベース', 'Database'],
  cache: ['キャッシュ', 'Cache'],
  queue: ['キュー / ストリーム', 'Queue or stream'],
  storage: ['オブジェクト / ファイルストレージ', 'Object or file storage'],
  lb: ['ロードバランサー', 'Load balancer'],
  firewall: ['ファイアウォール / WAF', 'Firewall or WAF'],
  cdn: ['CDN', 'CDN'],
  cloud: ['クラウド / マネージドサービス', 'Cloud or managed service'],
  router: ['ルーター / ゲートウェイ', 'Router or gateway'],
  external: ['外部システム', 'External system'],
  screen: ['画面（ウィンドウ形）', 'Screen (window shape)'],
  modal: ['モーダル（ウィンドウ形）', 'Modal (window shape)'],
  browser: ['ブラウザ', 'Web browser'],
  mobile: ['モバイル端末', 'Mobile device'],
  user: ['ユーザー / アクター', 'User or actor'],
};

function iconTile(icon: IconName, tint: ColorName | null, t: Translate): HTMLElement {
  const name = html('code', {}, icon);
  const tile = html(
    'button',
    {
      type: 'button',
      class: 'doc-icon-card',
      title: t(`icon: ${icon} をコピー`, `Copy icon: ${icon}`),
    },
    stationPreview(icon, tint ?? undefined),
    name,
    html('span', { class: 'doc-muted' }, t(...ICON_DESCRIPTIONS[icon])),
  );
  tile.addEventListener('click', () => {
    void copyWithFeedback(`icon: ${icon}`, tile, icon, t('コピー済み', 'Copied'), name);
  });
  return tile;
}

export function iconCatalog(t: Translate): HTMLElement {
  let tint: ColorName | null = null;
  let filter = '';
  const categories: ReadonlyArray<readonly [IconCategory, string]> = [
    ['infra', t('インフラ', 'Infrastructure')],
    ['screen', t('画面・アクター', 'Screens & actors')],
  ];
  const list = html('div', { 'data-testid': 'doc-icon-catalog' });
  const empty = html(
    'p',
    { class: 'doc-muted', hidden: true },
    t('一致するアイコンはありません。', 'No matching icons.'),
  );

  const renderTiles = () => {
    clear(list);
    for (const [category, title] of categories) {
      const icons = ICON_NAMES.filter(
        (icon) =>
          ICON_META[icon].category === category &&
          `${icon} ${ICON_DESCRIPTIONS[icon].join(' ')}`.toLowerCase().includes(filter),
      );
      if (icons.length === 0) continue;
      list.append(
        html(
          'section',
          { class: 'doc-icon-section' },
          html('h3', {}, title, html('span', { class: 'doc-count' }, String(icons.length))),
          html('div', { class: 'doc-icon-grid' }, ...icons.map((icon) => iconTile(icon, tint, t))),
        ),
      );
    }
    empty.hidden = list.childElementCount > 0;
  };

  const search = html('input', {
    type: 'search',
    class: 'doc-search',
    placeholder: t('名前や用途で絞り込み', 'Filter by name or use'),
    'aria-label': t('アイコンを絞り込み', 'Filter icons'),
    'data-testid': 'doc-icon-search',
  });
  search.addEventListener('input', () => {
    filter = search.value.trim().toLowerCase();
    renderTiles();
  });

  renderTiles();
  return html(
    'div',
    {},
    html(
      'div',
      { class: 'doc-icon-tools' },
      search,
      colorChips<ColorName | null>(
        [null, ...COLOR_NAMES],
        null,
        (color) => {
          tint = color;
          renderTiles();
        },
        t,
      ),
    ),
    list,
    empty,
  );
}

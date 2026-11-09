import {
  ATTRIBUTE_SCHEMA,
  type DiagnosticCode,
  formatDiagnostic,
  KEYWORDS,
  parse,
  STATE_ATTRIBUTES_BY_TARGET,
} from '../../dsl';
import { COLOR_NAMES, COLOR_RESET, ICON_NAMES } from '../../model/types';
import { buildAiPrompt } from '../../prompt';
import { html } from '../../runtime/dom';
import type { ViewerLocale } from '../../runtime/i18n';
import { HOLD_MS, PHASE_MS, SPEEDS } from '../../runtime/player';
import { colorLab, colorPalette, iconCatalog } from './catalog';
import { codeBlock } from './code';
import {
  copyFailedLabel,
  copyWithFeedback,
  type LiveFigureOptions,
  liveFigure,
  staticDiagram,
  type Translate,
} from './figures';
import {
  BASICS_DSL,
  CALLOUT_DSL,
  COLOR_NONE_DSL,
  DIAGNOSTIC_EXAMPLES,
  EDGE_GALLERY,
  EDGE_PRELUDE,
  EDGE_STEPS_DSL,
  FOCUS_DSL,
  GRAMMAR_EBNF,
  GROUPS_DSL,
  NO_EDGE_DSL,
  NODE_GALLERY,
  NODE_PRELUDE,
  OVERVIEW_DSL,
  PARALLEL_DSL,
  ROUND_TRIP_DSL,
  SELF_LOOP_DSL,
  SEQUENTIAL_DSL,
  STATE_DSL,
  STEPS_DSL,
} from './snippets';

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

export const DOC_GROUPS: ReadonlyArray<readonly [DocGroupId, string, string]> = [
  ['start', 'はじめに', 'Start'],
  ['catalog', 'カタログ', 'Catalog'],
  ['language', '言語ルール', 'Language rules'],
  ['reference', 'リファレンス', 'Reference'],
  ['tools', 'ツール', 'Tools'],
];

/** Text where `backticks` become inline code. */
export function rich(text: string): Node[] {
  return text
    .split('`')
    .map((part, i) => (i % 2 === 1 ? html('code', {}, part) : document.createTextNode(part)));
}

const p = (text: string) => html('p', {}, ...rich(text));
const h2 = (text: string) => html('h2', {}, text);
const syntax = (text: string) => html('p', { class: 'doc-syntax' }, html('code', {}, text));

function list(items: readonly string[]): HTMLElement {
  return html('ul', { class: 'doc-list' }, ...items.map((item) => html('li', {}, ...rich(item))));
}

function note(text: string): HTMLElement {
  return html('p', { class: 'doc-note' }, ...rich(text));
}

function table(headers: readonly string[], rows: ReadonlyArray<ReadonlyArray<Node | string>>) {
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

function attrValues(t: Translate) {
  return {
    color: t('色名', 'color name'),
    string: t('文字列', 'string'),
    bool: '`true` / `false`',
  };
}

function attrTable(t: Translate, rows: ReadonlyArray<ReadonlyArray<Node | string>>) {
  return table([t('属性', 'Attribute'), t('値', 'Value'), t('効果', 'Effect')], rows);
}

function live(ctx: DocContext, dsl: string, options: LiveFigureOptions = {}): Node {
  const figure = liveFigure(dsl, ctx.t, options);
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

function gallery(prelude: string, examples: readonly string[]): HTMLElement {
  return html(
    'div',
    { class: 'doc-gallery' },
    ...examples.map((code) => galleryItem(staticDiagram(prelude + code, code), codeBlock(code))),
  );
}

/** The same diagram before, during and after a color override. */
function colorNoneComparison(t: Translate): HTMLElement {
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

function pageLink(ctx: DocContext, pageId: string, label: string): HTMLElement {
  const link = html('button', { type: 'button', class: 'doc-link' }, label);
  link.addEventListener('click', () => ctx.go(pageId));
  return link;
}

function scopeChip(t: Translate, kind: 'carry' | 'local'): HTMLElement {
  return html(
    'span',
    { class: kind === 'carry' ? 'doc-scope is-carry' : 'doc-scope' },
    kind === 'carry' ? t('以降へ累積', 'Carries over') : t('そのステップのみ', 'This step only'),
  );
}

const key = (text: string) => html('kbd', {}, text);

function timingBar(t: Translate): HTMLElement {
  const segment = (label: string, ms: number, cls: string) => {
    const el = html(
      'div',
      { class: `doc-timing-seg ${cls}` },
      html('span', {}, label),
      `${ms / 1000}s`,
    );
    el.style.flexGrow = String(ms);
    return el;
  };
  return html(
    'div',
    { class: 'doc-timing', role: 'img', 'aria-label': t('1倍速の時間配分', 'Timing at 1x') },
    ...[1, 2, 3].map((n) => segment(`${t('フェーズ', 'Phase')} ${n}`, PHASE_MS, '')),
    segment(t('保持', 'Hold'), HOLD_MS, 'is-hold'),
  );
}

function diagnosticsTable(ctx: DocContext): HTMLElement {
  const { t, locale } = ctx;
  const rows = (Object.keys(DIAGNOSTIC_EXAMPLES) as DiagnosticCode[]).flatMap((code) => {
    const dsl = DIAGNOSTIC_EXAMPLES[code];
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

function attributeMatrix(ctx: DocContext): HTMLElement {
  const owners = Object.keys(ATTRIBUTE_SCHEMA) as Array<keyof typeof ATTRIBUTE_SCHEMA>;
  const names = [...new Set(owners.flatMap((o) => Object.keys(ATTRIBUTE_SCHEMA[o])))];
  const typeLabel: Record<string, string> = {
    string: '"…"',
    bool: 'true | false',
    color: ctx.t('色名', 'color'),
    stateColor: `${ctx.t('色名', 'color')} | ${COLOR_RESET}`,
    icon: ctx.t('アイコン名', 'icon'),
    ident: 'id',
  };
  return table(
    ['', ...owners],
    names.map((name) => [
      html('code', {}, name),
      ...owners.map((owner) => {
        const type = ATTRIBUTE_SCHEMA[owner][name];
        return type
          ? html('span', { class: 'doc-type' }, typeLabel[type] ?? type)
          : html('span', { class: 'doc-absent' }, '—');
      }),
    ]),
  );
}

function renderPrompt(ctx: DocContext): Node[] {
  const { t, locale } = ctx;
  const promptText = () =>
    buildAiPrompt({
      locale,
      currentDsl: ctx.currentDsl,
      includeCurrentDsl: ctx.prompt.includeCurrent,
    });
  const checkbox = html('input', { type: 'checkbox', 'data-testid': 'chk-include-current-dsl' });
  checkbox.checked = ctx.prompt.includeCurrent;
  checkbox.addEventListener('change', () => {
    ctx.prompt.includeCurrent = checkbox.checked;
    textarea.value = promptText();
  });
  const label = t('プロンプトをコピー', 'Copy prompt');
  const copy = html(
    'button',
    { type: 'button', class: 'btn primary', 'data-testid': 'btn-copy-ai-prompt' },
    label,
  );
  copy.addEventListener('click', () => {
    void copyWithFeedback(
      promptText(),
      copy,
      label,
      t('コピーしました', 'Copied'),
      copyFailedLabel(t),
    );
  });
  const textarea = html('textarea', {
    class: 'doc-prompt-text',
    'aria-label': t('AI生成プロンプト', 'AI prompt'),
    readonly: true,
    'data-testid': 'ai-prompt-textarea',
  });
  textarea.value = promptText();
  return [
    html(
      'div',
      { class: 'doc-prompt-tools' },
      html(
        'label',
        { class: 'doc-checkbox' },
        checkbox,
        html(
          'span',
          {},
          t(
            '現在のDSLをプロンプトに含める（既存図の修正用）',
            'Include the current DSL (to modify an existing diagram)',
          ),
        ),
      ),
      copy,
    ),
    textarea,
  ];
}

export const DOC_PAGES: readonly DocPage[] = [
  {
    id: 'overview',
    group: 'start',
    title: ['概要', 'Overview'],
    lead: [
      '`.dav` は、図の構造と時系列のシナリオを1つのテキストに書く言語です。座標は不要で、配置はすべて自動で決まります。',
      'A `.dav` file describes a diagram and its timeline in one text file. There are no coordinates: layout is fully automatic.',
    ],
    render(ctx) {
      const { t } = ctx;
      const card = (no: string, title: string, body: string, pageId: string, link: string) =>
        html(
          'div',
          { class: 'doc-card' },
          html('span', { class: 'doc-card-no' }, no),
          html('h3', {}, title),
          p(body),
          pageLink(ctx, pageId, link),
        );
      return [
        live(ctx, OVERVIEW_DSL, {
          caption: t(
            '左のコードの実行中の行が強調され、右は実際のプレイヤーで再生されています。説明欄とステップ目盛りも本番と同じです。',
            'The running statements are highlighted in the source; the right side is the real player, including its narrative and step ruler.',
          ),
        }),
        html(
          'div',
          { class: 'doc-cards' },
          card(
            '1',
            t('構造を宣言する', 'Declare the structure'),
            t(
              '`node` が駅、`group` がゾーンになります。',
              '`node` draws a station, `group` draws a zone.',
            ),
            'nodes',
            t('ノードの書き方', 'Nodes'),
          ),
          card(
            '2',
            t('経路をつなぐ', 'Connect them'),
            t(
              '`a --> b` で線を引きます。矢印の形で線種が決まります。',
              '`a --> b` draws a rail. The arrow chooses its style.',
            ),
            'edges',
            t('エッジの書き方', 'Edges'),
          ),
          card(
            '3',
            t('シナリオを書く', 'Script the steps'),
            t(
              '`step` の中に `focus` / `state` / `animate` を並べます。',
              'List `focus`, `state` and `animate` inside each `step`.',
            ),
            'animate',
            t('アニメーション', 'Animation'),
          ),
        ),
      ];
    },
  },
  {
    id: 'colors',
    group: 'catalog',
    title: ['カラーパレット', 'Color palette'],
    lead: [
      `使える色は下の${COLOR_NAMES.length}色だけです。各色はライト / ダークの両テーマ向けに調整された値で描画されます。`,
      `These ${COLOR_NAMES.length} names are the only colors. Each renders with a value tuned for the light or dark theme.`,
    ],
    render(ctx) {
      const { t } = ctx;
      return [
        colorPalette(t),
        h2(t('要素ごとの見え方', 'How each element uses color')),
        p(
          t(
            '色を選ぶと、すべての要素に同じ色を適用して現在のテーマで再生します。',
            'Pick a color to apply it to every element and play it in the current theme.',
          ),
        ),
        colorLab(t, ctx.track),
        table(
          [
            t('対象', 'Target'),
            t('色が付く部分', 'What gets colored'),
            t('省略時', 'When omitted'),
          ],
          [
            [
              '`node`',
              t('駅の輪・アイコン・バッジ', 'Station ring, icon and badge'),
              t('無彩色', 'Neutral'),
            ],
            [
              '`group`',
              t('ゾーンの背景（14% の淡色）', 'Zone background (14% tint)'),
              t('無彩色の淡い背景', 'Neutral tint'),
            ],
            [t('エッジ', 'edge'), t('線と矢印', 'Rail and arrowhead'), t('無彩色', 'Neutral')],
            [
              '`animate`',
              t('パケットの輪・再生中の線・線ラベル', 'Packet ring, running rail and its label'),
              t('アクセントのオレンジ', 'Accent orange'),
            ],
            [
              '`state`',
              t('対象の色を置き換え（以降へ累積）', 'Replaces the target color (carries over)'),
              t('変更なし', 'No change'),
            ],
          ],
        ),
        h2(t('指定のルール', 'Rules')),
        list([
          t(
            '書式は `[color: blue]` です。大文字小文字は区別しません。',
            'Write `[color: blue]`. Names are case-insensitive.',
          ),
          t(
            '`#ff0000` などの16進カラーは使えません（`invalid-color`）。',
            'Hex values such as `#ff0000` are rejected (`invalid-color`).',
          ),
        ]),
        h2(t(`色の解除: color: ${COLOR_RESET}`, `Clearing a color: color: ${COLOR_RESET}`)),
        p(
          t(
            `\`state\` の \`color: ${COLOR_RESET}\` は、それまでのステップで \`state\` が付けた色を取り消し、宣言時の状態に戻します。透明にする指定ではありません。`,
            `In a \`state\`, \`color: ${COLOR_RESET}\` removes the color set by earlier \`state\` statements and returns to the declared one. It does not make anything transparent.`,
          ),
        ),
        colorNoneComparison(t),
        html('div', { class: 'doc-code-panel' }, codeBlock(COLOR_NONE_DSL)),
        table(
          [
            t('宣言時の指定', 'Declared as'),
            t(`color: ${COLOR_RESET} の結果`, `Result of color: ${COLOR_RESET}`),
          ],
          [
            [
              t('色を指定している（`[color: blue]`）', 'With a color (`[color: blue]`)'),
              t('宣言した色に戻る', 'Returns to that color'),
            ],
            [
              t('色を指定していない', 'Without a color'),
              t('既定の色に戻る', 'Returns to the default color'),
            ],
          ],
        ),
        list([
          t(
            '対象はノード・グループ・`id` 付きエッジです。',
            'Targets are nodes, groups and edges with an `id`.',
          ),
          t(
            `使えるのは \`state\` の中だけです。\`node\` / \`group\` / エッジの宣言や \`animate\` に書くとエラーになります（\`invalid-color\`）。`,
            `It is only valid in \`state\`. In a \`node\`, \`group\` or edge declaration, or in \`animate\`, it is an error (\`invalid-color\`).`,
          ),
          t(
            '他の `state` と同じく、解除した状態が以降のステップへ累積します。',
            'Like any `state`, the cleared color carries over to later steps.',
          ),
          t(
            '`state` で色を付けていない要素に指定しても、見た目は変わりません。',
            'On an element with no `state` color, it changes nothing.',
          ),
        ]),
      ];
    },
  },
  {
    id: 'icons',
    group: 'catalog',
    title: ['アイコン', 'Icons'],
    lead: [
      `全${ICON_NAMES.length}種です。タイルをクリックすると \`icon: 名前\` をコピーします。省略時は \`server\` です。`,
      `All ${ICON_NAMES.length} icons. Click a tile to copy \`icon: name\`. The default is \`server\`.`,
    ],
    render: ({ t }) => [iconCatalog(t)],
  },
  {
    id: 'basics',
    group: 'language',
    title: ['ファイルの基本', 'File basics'],
    lead: [
      'すべての `.dav` に共通する字句と構成のルールです。',
      'Lexical and structural rules shared by every `.dav` file.',
    ],
    render(ctx) {
      const { t } = ctx;
      return [
        live(ctx, BASICS_DSL),
        table(
          [t('要素', 'Element'), t('ルール', 'Rule')],
          [
            [
              t('ヘッダ', 'Header'),
              t(
                '先頭の文は必ず `dav 1`。コメントはその前に書けます。',
                'The first statement must be `dav 1`. Comments may precede it.',
              ),
            ],
            [
              '`title`',
              t(
                '省略可。複数書くと警告になり、最後の値が使われます。',
                'Optional. Repeats warn, and the last one wins.',
              ),
            ],
            [
              t('コメント', 'Comment'),
              t('`//` から行末まで。', 'From `//` to the end of the line.'),
            ],
            [
              'ID',
              t(
                '`[A-Za-z_][A-Za-z0-9_]*`。ノード・グループ・明示エッジIDで共有の名前空間です。',
                '`[A-Za-z_][A-Za-z0-9_]*`, shared by nodes, groups and explicit edge IDs.',
              ),
            ],
            [
              t('文字列', 'String'),
              t(
                '`"…"` のみ。エスケープは `\\"` `\\\\` `\\n` `\\t` の4種で、途中の改行は不可です。',
                'Only `"…"`. Escapes are `\\"`, `\\\\`, `\\n` and `\\t`; raw newlines are not allowed.',
              ),
            ],
            [t('真偽値', 'Boolean'), '`true` / `false`'],
            [
              t('属性', 'Attributes'),
              t(
                '`[key: value, key: value]`。末尾カンマ可。同じキーの重複は警告で、最後の値が使われます。',
                '`[key: value, key: value]`, trailing comma allowed. A repeated key warns and the last value wins.',
              ),
            ],
            [
              t('文の順序', 'Order'),
              t(
                'ヘッダ以外は自由です。後で宣言するIDも参照できます。文は改行で区切る必要もありません。',
                'Free after the header. IDs may be used before their declaration, and line breaks are not significant.',
              ),
            ],
          ],
        ),
        h2(t('予約語', 'Reserved words')),
        p(
          t(
            '次の語はIDに使えません（`desc` は属性名としてのみ使用可）。',
            'These cannot be IDs (`desc` is allowed as an attribute name).',
          ),
        ),
        html('div', { class: 'doc-tags' }, ...[...KEYWORDS].map((w) => html('code', {}, w))),
      ];
    },
  },
  {
    id: 'groups',
    group: 'language',
    title: ['グループ', 'Groups'],
    lead: [
      '`group` は配下の要素を包むゾーンです。入れ子にできます。',
      '`group` draws a zone around its members. Groups can be nested.',
    ],
    render(ctx) {
      const { t } = ctx;
      return [
        live(ctx, GROUPS_DSL),
        syntax('group <id> "label"? [attributes]? { (group | node)* }'),
        attrTable(t, [['`color`', attrValues(t).color, t('ゾーンの背景色', 'Zone background')]]),
        list([
          t(
            '中に書けるのは `group` と `node` だけです。エッジと `step` はトップレベルに書きます。',
            'Only `group` and `node` may appear inside. Edges and `step` stay at the top level.',
          ),
          t('ラベルを省略するとIDが表示されます。', 'Without a label, the ID is shown.'),
          t(
            'エッジや `animate` の端点にグループは指定できません（`reference-kind-mismatch`）。',
            'A group cannot be an edge or `animate` endpoint (`reference-kind-mismatch`).',
          ),
        ]),
      ];
    },
  },
  {
    id: 'nodes',
    group: 'language',
    title: ['ノード', 'Nodes'],
    lead: [
      '`node` は図の駅です。属性で見た目を指定します。',
      '`node` is a station on the map. Attributes set its appearance.',
    ],
    render(ctx) {
      const { t } = ctx;
      return [
        syntax('node <id> "label"? [attributes]?'),
        gallery(NODE_PRELUDE, NODE_GALLERY),
        table(
          [t('属性', 'Attribute'), t('値', 'Value'), t('既定', 'Default'), t('効果', 'Effect')],
          [
            [
              '`icon`',
              pageLink(ctx, 'icons', t('アイコン名', 'icon name')),
              '`server`',
              t(
                '駅の図柄。`screen` と `modal` は窓形になります。',
                'Station artwork. `screen` and `modal` use a window shape.',
              ),
            ],
            [
              '`sub`',
              attrValues(t).string,
              t('なし', 'none'),
              t('ラベル下の補足', 'Text under the label'),
            ],
            [
              '`badge`',
              attrValues(t).string,
              t('なし', 'none'),
              t('駅の上の丸バッジ', 'Pill above the station'),
            ],
            [
              '`color`',
              pageLink(ctx, 'colors', attrValues(t).color),
              t('無彩色', 'neutral'),
              t('輪・アイコン・バッジの色', 'Ring, icon and badge'),
            ],
            [
              '`visible`',
              attrValues(t).bool,
              '`true`',
              t('初期表示。`state` で切り替えます。', 'Initial visibility, toggled by `state`.'),
            ],
          ],
        ),
      ];
    },
  },
  {
    id: 'edges',
    group: 'language',
    title: ['エッジ', 'Edges'],
    lead: [
      '2つのノードを結ぶ線です。矢印の形が線種と向きを決めます。',
      'A rail between two nodes. The arrow sets its style and direction.',
    ],
    render(ctx) {
      const { t } = ctx;
      return [
        syntax('<from> <arrow> <to> (: "label")? [attributes]?'),
        gallery(EDGE_PRELUDE, EDGE_GALLERY),
        attrTable(t, [
          ['`id`', 'ID', t('`state` から参照するための名前', 'Name used by `state`')],
          ['`color`', attrValues(t).color, t('線の色', 'Rail color')],
          [
            '`visible`',
            attrValues(t).bool,
            t('初期表示（既定 `true`）', 'Initial visibility (default `true`)'),
          ],
        ]),
        note(
          t(
            '`state` でエッジを指定するには `[id: e_name]` が必須です。暗黙のID `a->b` はIDの文字規則に合わないため、ステップ内には書けません。',
            'To target an edge from `state`, give it `[id: e_name]`. The implicit `a->b` name is not a valid identifier, so it cannot be written in a step.',
          ),
        ),
        list([
          t('両端はノードのみです。', 'Both ends must be nodes.'),
          t(
            '同じ向きの同じペアを2本引くには、2本目以降に `id` が必要です（`duplicate-edge`）。',
            'A second edge with the same direction and endpoints needs an `id` (`duplicate-edge`).',
          ),
          t('ラベルの前の `:` は必須です。', 'The `:` before a label is required.'),
        ]),
        h2(t('ステップで見るエッジ', 'Edges across steps')),
        p(
          t(
            '逆向きのエッジは平行な2本の線に分かれます。`id` を付けたエッジは、`state` で表示や色を切り替えられます。',
            'Opposite edges split into two parallel tracks. An edge with an `id` can be shown, hidden or recolored with `state`.',
          ),
        ),
        live(ctx, EDGE_STEPS_DSL, { matrix: true }),
        h2(t('自己ループ', 'Self-loops')),
        p(
          t(
            '`a --> a` や `a ..> a` は、駅の右上にループを描きます。`animate a --> a` のパケットはループを1周します。リトライや定期処理の表現に使えます。',
            '`a --> a` and `a ..> a` draw a loop at the upper right of the station. A packet from `animate a --> a` goes once around it. Use them for retries or scheduled work.',
          ),
        ),
        live(ctx, SELF_LOOP_DSL, { phases: true }),
        list([
          t(
            '双方向の矢印 `<->` と `<.>` は自己ループには使えません（`invalid-self-arrow`）。',
            'The bidirectional arrows `<->` and `<.>` cannot form a self-loop (`invalid-self-arrow`).',
          ),
          t(
            '同じノードに2本目の自己ループを引くには `id` が必要で、外側に描かれます。',
            'A second self-loop on the same node needs an `id` and is drawn outside the first.',
          ),
        ]),
      ];
    },
  },
  {
    id: 'steps',
    group: 'language',
    title: ['ステップ', 'Steps'],
    lead: [
      '`step` は記述順に並ぶシナリオの1場面です。文ごとに効果の続く範囲が異なります。',
      'Each `step` is one scene, in declaration order. Statements differ in how long their effect lasts.',
    ],
    render(ctx) {
      const { t } = ctx;
      return [
        live(ctx, STEPS_DSL, { matrix: true }),
        table(
          [t('文', 'Statement'), t('書式', 'Form'), t('範囲', 'Scope'), t('効果', 'Effect')],
          [
            [
              '`desc`',
              '`desc "…"`',
              scopeChip(t, 'local'),
              t(
                '説明欄の文章。複数行は改行で連結。',
                'Narrative text. Multiple lines join with newlines.',
              ),
            ],
            [
              '`focus`',
              '`focus a, b`',
              scopeChip(t, 'local'),
              pageLink(ctx, 'focus', t('対象以外を減光', 'Dims everything else')),
            ],
            [
              '`state`',
              '`state a [...]`',
              scopeChip(t, 'carry'),
              pageLink(ctx, 'state', t('見た目を変更', 'Changes appearance')),
            ],
            [
              '`animate`',
              '`animate a --> b`',
              scopeChip(t, 'local'),
              pageLink(ctx, 'animate', t('パケットを走らせる', 'Runs packets')),
            ],
          ],
        ),
        list([
          t(
            'どのステップへ直接ジャンプしても、ステップ1から順に評価した場合と同じ状態になります。',
            'Jumping to any step yields the same result as playing from step 1.',
          ),
          t(
            'Overview は宣言時の状態で、`state` は適用されません。',
            'The Overview shows the declared state, with no `state` applied.',
          ),
          t(
            '`animate` のないステップは動きません。全再生では保持時間だけ表示して次へ進みます。',
            'A step with no `animate` has no motion. Under Play all, it holds for the hold time, then advances.',
          ),
        ]),
      ];
    },
  },
  {
    id: 'focus',
    group: 'language',
    title: ['focus', 'focus'],
    lead: [
      '注目させたい要素を指定し、それ以外を減光します。そのステップ限りで、次のステップには残りません。',
      'Highlights elements by dimming everything else. It applies to one step only.',
    ],
    render(ctx) {
      const { t } = ctx;
      return [
        live(ctx, FOCUS_DSL),
        list([
          t(
            '対象はノードとグループです。エッジは指定できません（`reference-kind-mismatch`）。',
            'Targets are nodes and groups. Edges cannot be targeted (`reference-kind-mismatch`).',
          ),
          t(
            'グループを指定すると配下すべてが対象になります。',
            'A group includes everything inside it.',
          ),
          t(
            '`state` の対象と `animate` の両端は、書かなくても自動で対象になります。',
            '`state` targets and `animate` endpoints are focused automatically.',
          ),
          t(
            'ただし `visible: false` にする `state` は対象に数えません。エッジを指定した `state` は両端のノードも対象にします。',
            'A `state` with `visible: false` does not count. A `state` on an edge also focuses both of its nodes.',
          ),
          t(
            '両端のノードが対象のエッジも減光されません。',
            'An edge between two focused nodes stays lit.',
          ),
          t(
            '`focus` も `state` も `animate` もないステップでは、何も減光されません。',
            'A step with no `focus`, `state` or `animate` dims nothing.',
          ),
        ]),
      ];
    },
  },
  {
    id: 'state',
    group: 'language',
    title: ['state', 'state'],
    lead: [
      '要素の見た目を変更します。変更は後のステップへ累積します。',
      'Changes how an element looks. Changes accumulate over later steps.',
    ],
    render(ctx) {
      const { t } = ctx;
      const targets = ['node', 'group', 'edge'] as const;
      const reverts: ReadonlyArray<readonly [string, string]> = [
        ['badge', t('`badge: ""` で消去', '`badge: ""` removes it')],
        ['color', `\`color: ${COLOR_RESET}\``],
        ['visible', t('逆の値を指定', 'Set the opposite value')],
      ];
      return [
        live(ctx, STATE_DSL, {
          matrix: true,
          caption: t(
            '表は各ステップの実際の値です。色付きのセルが、そのステップで変化した値です。',
            'The table shows the actual value at each step. Tinted cells changed at that step.',
          ),
        }),
        table(
          [
            t('属性', 'Attribute'),
            'node',
            'group',
            t('エッジ', 'edge'),
            t('元に戻す', 'To revert'),
          ],
          reverts.map(([attr, revert]) => [
            `\`${attr}\``,
            ...targets.map((kind) =>
              STATE_ATTRIBUTES_BY_TARGET[kind].has(attr)
                ? html('span', { class: 'doc-type' }, '✓')
                : html('span', { class: 'doc-absent' }, '—'),
            ),
            revert,
          ]),
        ),
        list([
          t(
            '表にない組み合わせは警告になり、無視されます（`attribute-not-applicable`）。',
            'Other combinations warn and are ignored (`attribute-not-applicable`).',
          ),
          t(
            `\`color: ${COLOR_RESET}\` は \`state\` で付けた色を取り消し、宣言時の色（宣言がなければ既定の色）に戻します。`,
            `\`color: ${COLOR_RESET}\` removes a color set by \`state\` and returns to the declared color, or the default if none was declared.`,
          ),
          t(
            '`state a []` のような空指定は警告になります（`empty-state`）。',
            'An empty `state a []` warns (`empty-state`).',
          ),
          t(
            '`state` の対象は、そのステップで自動的に `focus` されます（`visible: false` にする場合を除く）。',
            'A `state` target is automatically focused for that step, unless it sets `visible: false`.',
          ),
        ]),
      ];
    },
  },
  {
    id: 'animate',
    group: 'language',
    title: ['animate', 'animate'],
    lead: [
      '2つのノード間にパケットを走らせます。記述順に「フェーズ」へまとめられ、1フェーズずつ再生されます。',
      'Runs a packet between two nodes. Statements form phases in order, and phases play one at a time.',
    ],
    render(ctx) {
      const { t } = ctx;
      return [
        syntax('animate <from> (--> | <->) <to> (: "label")? [attributes]? { desc "…"* }?'),
        attrTable(t, [
          [
            '`color`',
            attrValues(t).color,
            t(
              'パケットと再生中の線の色（既定はアクセント色）',
              'Packet and running rail (accent by default)',
            ),
          ],
          [
            '`parallel`',
            attrValues(t).bool,
            t(
              '直前の `animate` と同じフェーズで同時に再生',
              'Plays in the same phase as the preceding `animate`',
            ),
          ],
          ['`desc`', attrValues(t).string, t('吹き出しの本文', 'Callout body text')],
        ]),
        h2(t('順次再生', 'Sequential')),
        p(
          t(
            '`animate` は書いた順に1フェーズずつ再生されます。フェーズが2つ以上あると、線上に順番の番号が表示されます。',
            'Each `animate` is its own phase, in order. With two or more phases, numbered stops appear on the rails.',
          ),
        ),
        live(ctx, SEQUENTIAL_DSL, { phases: true }),
        h2(t('同時再生', 'Parallel')),
        p(
          t(
            '`[parallel: true]` を付けると、直前の `animate` のフェーズに合流します。次の `animate` はまた新しいフェーズです。',
            '`[parallel: true]` joins the preceding statement’s phase. The next plain `animate` starts a new one.',
          ),
        ),
        live(ctx, PARALLEL_DSL, { phases: true }),
        h2(t('片道と往復', 'One way and round trip')),
        p(
          t(
            '`-->` は片道、`<->` は往復です。どちらも1フェーズの時間で完了するので、往復は2倍の速さで動きます。点線の矢印は使えません（`invalid-animate-arrow`）。',
            '`-->` goes one way and `<->` goes there and back. Both take one phase, so a round trip moves twice as fast. Dashed arrows are rejected (`invalid-animate-arrow`).',
          ),
        ),
        live(ctx, ROUND_TRIP_DSL, { phases: true }),
        h2(t('ラベル・説明・色', 'Label, description, color')),
        p(
          t(
            '`: "…"` は吹き出しの見出し、`desc` は本文です。`desc` は属性でもブロックでも書け、両方書くと属性、ブロックの順に連結します。',
            '`: "…"` is the callout heading and `desc` is its body. `desc` can be an attribute or a block; with both, the attribute comes first.',
          ),
        ),
        live(ctx, CALLOUT_DSL, { phases: true }),
        h2(t('エッジがなくても動く', 'Edges are optional')),
        p(
          t(
            'エッジの宣言がなくても再生できます。非表示のノードやエッジも、再生するステップでだけ表示されます。',
            'A packet does not need a declared edge. Hidden nodes and edges appear only in the step that animates them.',
          ),
        ),
        live(ctx, NO_EDGE_DSL, { phases: true }),
        note(
          t(
            '端点はノードのみです。エッジの線種はパケットの動きに影響しません。',
            'Endpoints must be nodes. The edge style does not affect packet motion.',
          ),
        ),
      ];
    },
  },
  {
    id: 'playback',
    group: 'reference',
    title: ['再生と操作', 'Playback & controls'],
    lead: [
      'ビュアーの再生の仕組みと操作の一覧です。',
      'How playback is timed, and every viewer control.',
    ],
    render(ctx) {
      const { t } = ctx;
      return [
        h2(t('時間配分（1倍速）', 'Timing at 1x')),
        timingBar(t),
        p(
          t(
            `1フェーズは ${PHASE_MS / 1000} 秒、最後のフェーズの後に ${HOLD_MS / 1000} 秒保持します。速度は ${SPEEDS[0]}x〜${SPEEDS[SPEEDS.length - 1]}x に変更できます。`,
            `Each phase takes ${PHASE_MS / 1000}s, followed by a ${HOLD_MS / 1000}s hold after the last one. Speed ranges from ${SPEEDS[0]}x to ${SPEEDS[SPEEDS.length - 1]}x.`,
          ),
        ),
        h2(t('操作', 'Controls')),
        table(
          [t('操作', 'Control'), t('動作', 'Action')],
          [
            [
              t('再生（三角1つ）', 'Play step (one triangle)'),
              t('現在のステップを繰り返し再生します。', 'Repeats the current step.'),
            ],
            [
              t('全再生（三角2つ）', 'Play all (two triangles)'),
              t(
                '全ステップを順に再生し、最後まで行くと先頭へ戻ります。',
                'Plays every step and loops back to the first.',
              ),
            ],
            [
              t('一時停止', 'Pause'),
              t(
                '再生中に同じボタンを押すと、その位置で止まります。もう一度押すと続きから再生します。',
                'Pressing the running button freezes playback in place. Pressing it again continues from there.',
              ),
            ],
            [
              t('アニメーションのオン / オフ', 'Animation on / off'),
              t(
                'オフにすると動きを止め、そのステップの状態と使う線をまとめて表示します。ステップを移動してもオフのままで、再生すると自動でオンに戻ります。オフの間にノードをクリックすると、そのフェーズのパケットと吹き出しを線の途中に止めて表示します。',
                'Off stops all motion and shows the step’s state and every rail it uses. It stays off across steps and turns back on when you play. While off, clicking a node parks that phase’s packet and callout on its rail.',
              ),
            ],
            [
              t('ステップ選択 / 目盛り', 'Step menu / ruler'),
              t('任意のステップへ移動します。', 'Jumps to a step.'),
            ],
            [
              t('ノードをクリック', 'Click a node'),
              t(
                'そのノードが送信元のフェーズ（なければ送信先のフェーズ）を繰り返します。再度クリックで次のフェーズへ。',
                'Repeats a phase the node sends from (or receives in, if it sends none). Click again for the next one.',
              ),
            ],
            [
              t('ノードをダブルクリック', 'Double-click a node'),
              t('ソースの該当箇所へ移動します。', 'Reveals its source.'),
            ],
            [t('ホイール / ドラッグ', 'Wheel / drag'), t('ズーム / 移動', 'Zoom / pan')],
            [t('フィット', 'Fit'), t('図全体を表示します。', 'Shows the whole diagram.')],
            [
              t('追従', 'Follow'),
              t(
                '再生中のパケットへカメラを追従させます。',
                'Keeps the camera on the running packets.',
              ),
            ],
          ],
        ),
        h2(t('キーボード', 'Keyboard')),
        table(
          [t('キー', 'Key'), t('動作', 'Action')],
          [
            [
              key('←'),
              t('前のステップ（先頭では Overview）', 'Previous step (Overview from the first)'),
            ],
            [key('→'), t('次のステップ', 'Next step')],
            [key('Space'), t('現在のステップを再生 / 一時停止', 'Play or pause the current step')],
            [key('Home'), 'Overview'],
          ],
        ),
        note(
          t(
            'OSの「視差効果を減らす」設定が有効な場合、アニメーションは常にオフになります。',
            'When the OS requests reduced motion, animation is always off.',
          ),
        ),
      ];
    },
  },
  {
    id: 'attributes',
    group: 'reference',
    title: ['属性一覧', 'Attribute matrix'],
    lead: [
      '各要素で使える属性と値の型です。',
      'Which attributes each element accepts, and their value types.',
    ],
    render(ctx) {
      const { t } = ctx;
      return [
        attributeMatrix(ctx),
        h2(t('矢印', 'Arrows')),
        table(
          [t('矢印', 'Arrow'), t('線', 'Line'), t('向き', 'Direction'), 'animate'],
          [
            [
              '`-->`',
              t('実線', 'Solid'),
              t('片方向', 'One way'),
              t('使用可（片道）', 'Yes (one way)'),
            ],
            ['`..>`', t('破線', 'Dashed'), t('片方向', 'One way'), t('使用不可', 'No')],
            [
              '`<->`',
              t('実線', 'Solid'),
              t('双方向', 'Both'),
              t('使用可（往復）', 'Yes (round trip)'),
            ],
            ['`<.>`', t('破線', 'Dashed'), t('双方向', 'Both'), t('使用不可', 'No')],
          ],
        ),
        h2(t('使える値', 'Allowed values')),
        p(
          t(
            `色: ${COLOR_NAMES.map((c) => `\`${c}\``).join(' ')}`,
            `Colors: ${COLOR_NAMES.map((c) => `\`${c}\``).join(' ')}`,
          ),
        ),
        p(
          t(
            `アイコン: ${ICON_NAMES.map((c) => `\`${c}\``).join(' ')}`,
            `Icons: ${ICON_NAMES.map((c) => `\`${c}\``).join(' ')}`,
          ),
        ),
      ];
    },
  },
  {
    id: 'grammar',
    group: 'reference',
    title: ['文法 (EBNF)', 'Grammar (EBNF)'],
    lead: [
      '`dav 1` の構文です。バージョン番号と属性の値は、構文解析の後に診断で検証します。',
      'The syntax of `dav 1`. The version number and attribute values are checked after parsing, by diagnostics.',
    ],
    render: () => [html('pre', { class: 'doc-pre' }, GRAMMAR_EBNF)],
  },
  {
    id: 'diagnostics',
    group: 'reference',
    title: ['診断メッセージ', 'Diagnostics'],
    lead: [
      'エディタが報告するすべての診断です。例とメッセージは実際のパーサの出力です。',
      'Every diagnostic the editor reports. Examples and messages come from the real parser.',
    ],
    render: (ctx) => [diagnosticsTable(ctx)],
  },
  {
    id: 'prompt',
    group: 'tools',
    title: ['AI生成プロンプト', 'AI prompt'],
    lead: [
      'ChatGPT / Claude / Gemini などに貼り付けて、`.dav` を生成・修正するためのプロンプトです。',
      'Paste this into ChatGPT, Claude or Gemini to generate or modify `.dav` diagrams.',
    ],
    render: renderPrompt,
  },
];

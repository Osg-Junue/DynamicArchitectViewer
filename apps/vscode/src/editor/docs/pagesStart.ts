import { COLOR_NAMES, COLOR_RESET, ICON_NAMES } from '../../model/types';
import { html } from '../../runtime/dom';
import { colorLab, colorPalette, iconCatalog } from './catalog';
import { codeBlock } from './code';
import { colorNoneComparison, type DocPage, h2, list, live, p, pageLink, table } from './elements';
import { COLOR_NONE_DSL, OVERVIEW_DSL } from './snippets';

export const START_PAGES: readonly DocPage[] = [
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
            t('接続の書き方', 'Connections'),
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
        colorLab(ctx.locale, t, ctx.track),
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
            [
              '`static`',
              t('そのステップの線と矢印', 'Its line and arrowhead in its step'),
              t('無彩色', 'Neutral'),
            ],
            [
              '`animate`',
              t('パケットの輪・再生中の線・線ラベル', 'Packet ring, running rail and its label'),
              t('アクセントのオレンジ', 'Accent orange'),
            ],
            [
              '`state`',
              t('そのステップの間、対象の色を置き換え', 'Replaces the target color for its step'),
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
            `\`state\` の \`color: ${COLOR_RESET}\` は、宣言した色をそのステップだけ消し、既定の色で描きます。透明にする指定ではありません。`,
            `In a \`state\`, \`color: ${COLOR_RESET}\` clears the declared color for its step, which draws the default color. It does not make anything transparent.`,
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
              t('そのステップだけ既定の色になる', 'The default color, for that step'),
            ],
            [
              t('色を指定していない', 'Without a color'),
              t('既定の色のまま', 'The default color, as before'),
            ],
          ],
        ),
        list([
          t('対象はノードとグループです。', 'Targets are nodes and groups.'),
          t(
            `使えるのは \`state\` の中だけです。\`node\` や \`group\` の宣言、\`animate\` や \`static\` に書くとエラーになります（\`invalid-color\`）。`,
            `It is only valid in \`state\`. In a \`node\` or \`group\` declaration, or in \`animate\` or \`static\`, it is an error (\`invalid-color\`).`,
          ),
          t(
            '他の `state` と同じく、そのステップだけに効きます。次のステップでは宣言どおりの色に戻ります。',
            'Like any `state`, it applies to its step only: the next step shows the declared color again.',
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
      `全${ICON_NAMES.length}種です。タイルをクリックすると \`icon: 名前\` をコピーします。\`node\` で省略すると \`server\` になります。\`animate\` に付けると、パケットにも表示できます。`,
      `All ${ICON_NAMES.length} icons. Click a tile to copy \`icon: name\`. A \`node\` without one uses \`server\`. On an \`animate\`, the icon appears on the packet.`,
    ],
    render: ({ t }) => [iconCatalog(t)],
  },
];

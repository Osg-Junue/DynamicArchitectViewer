import { KEYWORDS, STATE_ATTRIBUTES_BY_TARGET } from '../../dsl';
import { COLOR_RESET } from '../../model/types';
import { html } from '../../runtime/dom';
import {
  attrTable,
  attrValues,
  type DocPage,
  gallery,
  h2,
  list,
  live,
  note,
  p,
  pageLink,
  scopeChip,
  syntax,
  table,
} from './elements';
import {
  BASICS_DSL,
  CALLOUT_DSL,
  CODE_DSL,
  EDGE_GALLERY,
  EDGE_PRELUDE,
  EDGE_STEPS_DSL,
  EDGE_SUFFIX,
  FOCUS_DSL,
  GROUPS_DSL,
  NO_EDGE_DSL,
  NODE_GALLERY,
  NODE_PRELUDE,
  PACKET_ICON_DSL,
  PARALLEL_DSL,
  ROUND_TRIP_DSL,
  SELF_LOOP_DSL,
  SEQUENTIAL_DSL,
  STATE_DSL,
  STEPS_DSL,
} from './snippets';

export const LANGUAGE_PAGES: readonly DocPage[] = [
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
                'ありません。`title`・`group`・`node`・`step` から書き始めます。v1 の `dav 1` はエラーになり、v2 の書き方が案内されます。',
                'There is none: a file starts with `title`, `group`, `node` or `step`. The `dav 1` of v1 is an error that says how v2 writes it.',
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
                '`[A-Za-z_][A-Za-z0-9_]*`。ノードとグループで共有の名前空間です。',
                '`[A-Za-z_][A-Za-z0-9_]*`, shared by nodes and groups.',
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
                '`[key: value, key: value]`。末尾カンマ可。同じキーの重複は警告で、無視されなかった最後の値が使われます。',
                '`[key: value, key: value]`, trailing comma allowed. A repeated key warns, and the last value that is not ignored is used.',
              ),
            ],
            [
              t('文の順序', 'Order'),
              t(
                '自由です。後で宣言するIDも参照できます。文は改行で区切る必要もありません。`step` は1つ以上必要です（`missing-step`）。',
                'Free. IDs may be used before their declaration, and line breaks are not significant. At least one `step` is required (`missing-step`).',
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
        attrTable(t, [
          ['`color`', attrValues(t).color, t('ゾーンの背景色', 'Zone background')],
          [
            '`border`',
            '`solid` / `dashed`',
            t(
              '枠線の線種（既定 `solid`）。AZ などに',
              'Frame line (default `solid`), e.g. for an AZ',
            ),
          ],
        ]),
        list([
          t(
            '中に書けるのは `group` と `node` だけです。`step` はトップレベルに書きます。',
            'Only `group` and `node` may appear inside. `step` stays at the top level.',
          ),
          t('ラベルを省略するとIDが表示されます。', 'Without a label, the ID is shown.'),
          t(
            'グループは `static` の端点になれます（ゾーン全体のログなど）。`animate` の端点にはなれません（`reference-kind-mismatch`）。',
            'A group can be an end of a `static`, such as the logs of a whole zone, but not of an `animate` (`reference-kind-mismatch`).',
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
              t(
                '概観での表示。ステップでは `state` か、そのステップの接続で表示されます。',
                'Shown in the overview. A step shows it with `state`, or when one of its connections uses it.',
              ),
            ],
            [
              '`mount`',
              '`border`',
              t('なし', 'none'),
              t(
                'ゾーンの枠の上、接続が出ていく側に置きます。グループの中のノードだけ。',
                'On the frame of its zone, on the side its connections leave by. Only inside a group.',
              ),
            ],
          ],
        ),
      ];
    },
  },
  {
    id: 'edges',
    group: 'language',
    title: ['接続', 'Connections'],
    lead: [
      '接続はステップの中に書きます。パケットが通るものは `animate`、通らないものは `static` です。',
      'Connections are written inside steps: `animate` for one a packet travels, `static` for one none does.',
    ],
    render(ctx) {
      const { t } = ctx;
      return [
        syntax('static <from> <arrow> <to> (: "label")? [attributes]?'),
        gallery(EDGE_PRELUDE, EDGE_GALLERY, EDGE_SUFFIX),
        attrTable(t, [
          [
            '`color`',
            attrValues(t).color,
            t('このステップでの線の色', 'Color of the line in this step'),
          ],
        ]),
        list([
          t(
            '`static` の端点はノードかグループです。`animate` の端点はノードだけです。',
            'The ends of a `static` are nodes or groups; those of an `animate` are nodes.',
          ),
          t(
            'ラベルの前の `:` は必須です。ラベルはそのステップでだけ描かれ、概観には出ません。',
            'The `:` before a label is required. The label is drawn in its step only, not in the overview.',
          ),
        ]),
        h2(t('概観の線とステップの線', 'Rails in the overview and in a step')),
        p(
          t(
            '同じ2つのノードの接続は、向きやステップが違っても概観では1本の線になります。両方向があれば両端に矢印が付き、実線が1つでもあれば実線です。ステップでは、そのステップの接続を書いたとおりの線種で描きます。',
            'In the overview, the connections between two nodes become one rail, whatever their direction or step: with both directions it has arrowheads at both ends, and it is solid if any of them is. A step draws its own connections as it writes them.',
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
            '1つのノードの自己ループは、ラベルが違っても1本のループにまとまります。',
            'The self-loops of a node share one loop, whatever their labels.',
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
      '`step` は記述順に並ぶシナリオの1場面です。中の文は、すべてそのステップだけに効きます。',
      'Each `step` is one scene, in declaration order. Every statement in it applies to that step only.',
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
              scopeChip(t, 'local'),
              pageLink(ctx, 'state', t('見た目を変更', 'Changes appearance')),
            ],
            [
              '`animate`',
              '`animate a --> b`',
              scopeChip(t, 'local'),
              pageLink(ctx, 'animate', t('パケットを走らせる', 'Runs packets')),
            ],
            [
              '`static`',
              '`static a ..> b`',
              scopeChip(t, 'local'),
              pageLink(ctx, 'edges', t('パケットの通らない接続', 'A connection no packet travels')),
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
      '注目させたい要素を指定し、それ以外を減光します。ステップ自身の接続のほかは、注目しているノードどうしを結ぶ接続だけが描かれます。そのステップ限りです。',
      'Highlights elements by dimming everything else. Besides the step’s own connections, only those between highlighted nodes are drawn. It applies to one step only.',
    ],
    render(ctx) {
      const { t } = ctx;
      return [
        live(ctx, FOCUS_DSL),
        list([
          t('対象はノードとグループです。', 'Targets are nodes and groups.'),
          t(
            'グループを指定すると配下すべてが対象になります。',
            'A group includes everything inside it.',
          ),
          t(
            '`state` の対象と、`animate` と `static` の両端は、書かなくても自動で対象になります。',
            '`state` targets and the ends of `animate` and `static` are focused automatically.',
          ),
          t(
            'ただし `visible: false` にする `state` は対象に数えません。',
            'A `state` with `visible: false` does not count.',
          ),
          t(
            '`focus`・`state`・`animate`・`static` のどれもないステップでは、何も減光されません。',
            'A step with no `focus`, `state`, `animate` or `static` dims nothing.',
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
      'ノードやゾーンの見た目を、そのステップだけ変えます。次のステップでは宣言どおりに戻ります。',
      'Changes how a node or a zone looks, in its step only. The next step shows it as declared again.',
    ],
    render(ctx) {
      const { t } = ctx;
      const targets = ['node', 'group'] as const;
      const reverts: ReadonlyArray<readonly [string, string]> = [
        ['badge', t('`badge: ""` で消す', '`badge: ""` removes it')],
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
            t('宣言の値を消す', 'To clear the declared value'),
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
            `\`color: ${COLOR_RESET}\` は宣言した色を、そのステップだけ消して既定の色にします。`,
            `\`color: ${COLOR_RESET}\` clears the declared color for its step, which then shows the default.`,
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
        syntax(
          'animate <from> (--> | <->) <to> (: "label")? [attributes]? { (desc "…" | code …)* }?',
        ),
        attrTable(t, [
          [
            '`icon`',
            pageLink(ctx, 'icons', t('アイコン名', 'icon name')),
            t(
              'パケットをアイコン付きのチップにする（既定は点）',
              'Turns the packet into an icon chip (a dot by default)',
            ),
          ],
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
          [
            '`code`',
            attrValues(t).string,
            t(
              '吹き出しの中に等幅で表示するコード（1つまで）',
              'Monospace snippet inside the callout (at most one)',
            ),
          ],
        ]),
        h2(t('順次再生', 'Sequential')),
        p(
          t(
            '`animate` は書いた順に1フェーズずつ再生されます。フェーズが2つ以上あると、線上と吹き出しに同じ順番の番号が表示されます。',
            'Each `animate` is its own phase, in order. With two or more phases, each rail gets a numbered stop, and the callout carries the same number.',
          ),
        ),
        live(ctx, SEQUENTIAL_DSL, { phases: true }),
        h2(t('同時再生', 'Parallel')),
        p(
          t(
            '`[parallel: true]` を付けると、直前の `animate` のフェーズに合流します。次の `animate` はまた新しいフェーズです。同じフェーズのパケットは 2a、2b のように文字つきの同じ番号になり、吹き出しはそれぞれの線のそばに置かれます。',
            '`[parallel: true]` joins the preceding statement’s phase. The next plain `animate` starts a new one. Packets of one phase share its number with a letter each, such as 2a and 2b, and each callout is placed by its own rail.',
          ),
        ),
        live(ctx, PARALLEL_DSL, { phases: true }),
        h2(t('片道と往復', 'One way and round trip')),
        p(
          t(
            '`-->` は片道、`<->` は往復です。往復は向こうで少し止まってから戻るので、片道のおよそ2倍の時間がかかります。点線の矢印は使えません（`invalid-animate-arrow`）。',
            '`-->` goes one way and `<->` goes there and back. A round trip rests a moment at the far end before it comes back, so it takes about twice as long as one way. Dashed arrows are rejected (`invalid-animate-arrow`).',
          ),
        ),
        live(ctx, ROUND_TRIP_DSL, { phases: true }),
        h2(t('運ぶものを示す', 'Showing what a packet carries')),
        p(
          t(
            '`icon` を付けると、パケットがアイコン付きのチップになります。トークン、ファイル、イベントなど、流れているものの違いを動きの中で見せられます。シーケンス図のような用途で特に役立ちます。',
            'With `icon`, the packet becomes a chip that shows what is moving, such as a token, a file or an event. This is most useful in sequence-style diagrams.',
          ),
        ),
        live(ctx, PACKET_ICON_DSL, { phases: true }),
        h2(t('ラベル・説明・色', 'Label, description, color')),
        p(
          t(
            '`: "…"` は吹き出しの見出し、`desc` は本文です。`desc` は属性でもブロックでも書け、両方書くと属性、ブロックの順に連結します。',
            '`: "…"` is the callout heading and `desc` is its body. `desc` can be an attribute or a block; with both, the attribute comes first.',
          ),
        ),
        live(ctx, CALLOUT_DSL, { phases: true }),
        h2(t('コードを見せる', 'Showing code')),
        p(
          t(
            'ブロック内の `code` は、吹き出しの中にコードを等幅で表示します。言語名とタイトルは省略でき、本文はバッククォート3つで囲むか、1行の文字列で書きます。共通のインデントは取り除かれます。1つの `animate` に書けるのは1つまでです（`duplicate-code`）。',
            'A `code` statement in the block shows a monospace snippet inside the callout. The language and title are optional, and the body goes between two lines of three backticks, or in a one-line string. Common leading indentation is removed. One `animate` takes at most one (`duplicate-code`).',
          ),
        ),
        live(ctx, CODE_DSL, { phases: true }),
        h2(t('animate が接続になる', 'An animate is a connection')),
        p(
          t(
            '`animate` は、それ自体が接続です。概観の線もここから作られます。非表示のノードは、それを使うステップでだけ表示されます。破線の矢印 `..>` と `<.>` も使えます。',
            'An `animate` is a connection of its own, and the overview draws its rail from it. A hidden node appears only in the step that uses it. The dashed arrows `..>` and `<.>` work too.',
          ),
        ),
        live(ctx, NO_EDGE_DSL, { phases: true }),
        note(
          t(
            '端点はノードのみです。線種はパケットの動きに影響しません。',
            'Endpoints must be nodes. The line style does not affect packet motion.',
          ),
        ),
      ];
    },
  },
];

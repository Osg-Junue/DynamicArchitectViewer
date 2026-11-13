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
      '注目させたい要素を指定し、それ以外を減光します。エッジは、注目しているノードどうしを結ぶものだけが描かれます。そのステップ限りで、次のステップには残りません。',
      'Highlights elements by dimming everything else. Only the edges between highlighted nodes are drawn. It applies to one step only.',
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
            '`-->` は片道、`<->` は往復です。どちらも1フェーズの時間で完了するので、往復は2倍の速さで動きます。点線の矢印は使えません（`invalid-animate-arrow`）。',
            '`-->` goes one way and `<->` goes there and back. Both take one phase, so a round trip moves twice as fast. Dashed arrows are rejected (`invalid-animate-arrow`).',
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
];

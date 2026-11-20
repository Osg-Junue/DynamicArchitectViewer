import { COLOR_NAMES, type DavLocale, ICON_NAMES, KEYWORD_NAMES } from '../model/types';

export type Locale = DavLocale;

export interface AiPromptOptions {
  locale?: Locale;
  currentDsl?: string;
  includeCurrentDsl?: boolean;
}

const RESERVED_WORDS = KEYWORD_NAMES.map((w) => `\`${w}\``).join(', ');

/**
 * About how many characters of each text are drawn before it is cut off: Latin letters, then
 * Japanese. The same numbers as the table in the dav-diagrams skill; a test keeps them equal.
 */
export const TEXT_BUDGET: ReadonlyArray<readonly [text: string, latin: string, wide: string]> = [
  ['node label', '20', '12'],
  ['node `sub`', '26', '15'],
  ['`badge`', '16', '10'],
  ['`static` label', '28', '16'],
  ['`animate` label', '44', '27'],
  ['`animate` `desc`', '170', '95'],
  ['`code` line, of at most 10 lines', '55', '35'],
];

export const PROMPT_EXAMPLE_DSL = `title "Order Processing Architecture"

group cloud_vpc "Production VPC" {
  node alb "Ingress ALB" [icon: lb, sub: "HTTPS"]
  node api "Order Service" [icon: container, sub: "ECS x3"]
  node db "Orders DB" [icon: database, sub: "PostgreSQL"]
  node queue "Event Queue" [icon: queue, sub: "SQS"]
}

node client "Web Client" [icon: browser, sub: "Customer"]

step "Submit Order" {
  desc "Client sends an order request through the load balancer to the API."
  focus client, alb, api, db
  state api [badge: "200 OK"]
  state db [badge: "WRITE"]
  animate client --> alb : "POST /orders" [icon: file, desc: "Client sends order payload over HTTPS"] {
    code json "Order Request" \`\`\`
      {
        "orderId": "ord_01JCK9X7",
        "amount": 14800
      }
    \`\`\`
  }
  animate alb --> api : "Forward" [desc: "ALB routes request to healthy API container"]
  animate api --> db : "INSERT order" [icon: database, desc: "API commits transaction to primary PostgreSQL"]
}

step "Enqueue Background Job" {
  desc "API publishes an event to the queue while keeping the DB connection visible."
  focus api, queue
  state queue [badge: "QUEUED"]
  static api --> db : "SQL"
  animate api ..> queue : "OrderCreated" [icon: mail, desc: "Publish async event for downstream workers"]
}`;

/**
 * Generates a self-contained prompt instructing an AI assistant how to author or update
 * a DynamicArchitectViewer (`.dav` v2) diagram without syntax errors.
 */
export function buildAiPrompt(options: AiPromptOptions = {}): string {
  const locale = options.locale ?? 'en';
  const icons = ICON_NAMES.join(', ');
  const colors = COLOR_NAMES.join(', ');
  const current = options.includeCurrentDsl ? options.currentDsl?.trim() : undefined;

  const sections =
    locale === 'en'
      ? [
          '# DynamicArchitectViewer DSL v2 (`.dav`) Specification',
          '',
          'Generate or update a time-stepped architecture / screen-transition diagram in DynamicArchitectViewer DSL v2 (`.dav`).',
          'Output ONLY valid `.dav` v2 code inside a ```dav code block.',
          '',
          '## 1. Strict Grammar Rules',
          '- No file header is used: start directly with `title`, `group`, `node`, or `step`.',
          '- Diagram title: `title "Diagram Title"` (at most once).',
          '- At least one `step` is required (`missing-step` otherwise).',
          '- Identifiers (`<id>`): `[A-Za-z_][A-Za-z0-9_]*`. Every group and node ID must be unique.',
          `- Reserved words cannot be IDs: ${RESERVED_WORDS}. (\`code\` is contextual inside \`animate { ... }\`, so \`node code\` remains valid.)`,
          '- Strings: always double-quoted `"..."` (escapes: `\\"`, `\\\\`, `\\n`, `\\t`).',
          '- Comments: `// single-line comment` anywhere.',
          '- Layout is 100% automatic from group hierarchy and step flow order (no manual coordinates, no top-level edges).',
          '',
          '## 2. Declarations',
          '- Group (can be nested):',
          '  `group <id> "Label" [color: blue, border: solid|dashed] { ... }`',
          '- Node:',
          '  `node <id> "Label" [icon: <icon>, sub: "Sublabel", badge: "TEXT", color: green, visible: true, mount: border]`',
          `  - Allowed \`icon\` values (${ICON_NAMES.length}): \`${icons}\``,
          `  - Allowed \`color\` values (case-insensitive): \`${colors}\`. Hex codes are not supported.`,
          '  - `mount: border` places a grouped gateway/endpoint node directly on its parent group border.',
          '',
          '## 3. Time-Stepped Scenarios (`step`)',
          '- `step "Step Title" { ... }` (ordered sequentially). **Every statement applies to its own step only (no state carry-over).** Inside `{ ... }`:',
          '  - `desc "Explanation shown in the player dock"`',
          '  - `focus <id1>, <id2>, ...` (highlights listed nodes/groups; focusing a group automatically focuses its descendants; non-focused elements are dimmed during this step).',
          '  - `state <target_id> [badge: "...", color: <color>, visible: true|false]`',
          '    - Target must be a node or a group. A `state` target counts as focused for that step, unless it sets `visible: false`.',
          '    - **Step-local only**: `state` overrides apply only to their own step on top of declared attributes. Use `badge: ""` or `color: none` to clear a declared badge or color for that step.',
          '  - `animate <from_id> <arrow> <to_id> : "Packet Label" [icon: <icon>, color: blue, desc: "Action description", code: "...", parallel: true] { ... }`',
          '    - Allowed `<arrow>` tokens: `-->` (solid), `..>` (dashed), `<->` (solid round-trip), `<.>` (dashed round-trip). Self-loops allow `-->` or `..>` only.',
          "    - `icon` is optional and takes the same values as a node's `icon`. Use it to show what the packet carries, such as `key` for a token, `file` for a document or `mail` for an event.",
          "    - Plays in declaration order and displays `desc` in the packet's speech bubble during that animation phase. Add `parallel: true` to run simultaneously with the immediately preceding `animate` statement.",
          '    - Optional `code` snippet (shown inside the packet callout when non-empty; hidden completely when absent):',
          '      - Block form inside `animate ... { ... }`: ```` code [lang] ["Title"] ``` ... ``` ```` (both `<lang>` like `json`/`sql`/`http` and `"Title"` are optional; common leading indentation inside ```` ``` ... ``` ```` is stripped), or one-line string form `code [lang] "..."`.',
          '      - Attribute shorthand for short snippets: `[code: "{ \\"status\\": 201 }"]`.',
          '      - Specify at most one `code` per `animate` (multiple `code` entries emit a `duplicate-code` warning) and keep snippets concise (2–6 key lines/fields) so callouts stay readable.',
          '  - `static <from_id> <arrow> <to_id> : "Label" [color: gray]`',
          '    - Declares a non-moving relationship visible in that step (e.g. replication, monitoring, standby link). Endpoints may be nodes or groups (`static vpc ..> cloudwatch`). Uses the same 4 arrows (`-->`, `..>`, `<->`, `<.>`).',
          '',
          '## 4. Level of Detail',
          'A diagram must explain itself to a reader who was not there when it was written.',
          '- Node: a short label, an `icon` that matches its kind, and a `sub` with its technology or role.',
          '- Steps: 3 to 8, the normal flow first, then each failure or alternative as steps of its own. Every step has a `desc` of one or two sentences that says what happens and why.',
          '- `animate`: a concrete label such as `"POST /orders"`, a `desc` that says what the message does or decides, and an `icon` for what it carries.',
          '- `static`: non-moving background relationships such as replication or telemetry, with a short label.',
          '- `code`: on the packets whose content matters (the request, the query, the event, the response). At least one in the diagram; one or two per step is typical. Keep example values the same across steps.',
          '- Show a status that changes with `state` and a `badge` plus `color` in the steps where it applies.',
          '- Do not invent components that the source material does not have.',
          `- Only \`desc\` wraps. Any other text that is too long is cut off with \`…\`. What fits, in Latin letters (and in Japanese characters): ${TEXT_BUDGET.map(([name, latin, wide]) => `${name} ${latin} (${wide})`).join(', ')}.`,
          '',
          '## 5. Reference Example',
        ]
      : [
          '# DynamicArchitectViewer DSL v2（`.dav`）仕様プロンプト',
          '',
          '以下の仕様に従い、DynamicArchitectViewer DSL v2（`.dav`）形式で時系列アーキテクチャ構成図または画面遷移図を作成・更新してください。',
          '回答には有効な `.dav` v2 コードのみを ```dav コードブロックで出力してください。',
          '',
          '## 1. 基本構文ルール',
          '- ファイル先頭のヘッダ（`dav 1` 等）は不要。`title`, `group`, `node`, `step` から直接書き始める。',
          '- 図タイトルは `title "図タイトル"`（最大1回）。',
          '- `step` は最低1つ必須（ないと `missing-step` エラー）。',
          '- 識別子（`<id>`）は `[A-Za-z_][A-Za-z0-9_]*`。グループ・ノードIDは図全体で一意にする。',
          `- 次の予約語はIDに使用不可: ${RESERVED_WORDS}。（\`code\` は \`animate { ... }\` 内の文脈キーワードのため、\`node code\` 等のIDとしては使用可）`,
          '- 文字列はすべてダブルクォート `"..."` で囲む（エスケープ: `\\"`, `\\\\`, `\\n`, `\\t`）。',
          '- コメントは `// 行コメント`。',
          '- 配置はグループ階層とステップの流れから100%自動レイアウトされる（座標指定やトップレベルエッジは存在しない）。',
          '',
          '## 2. 要素の宣言',
          '- グループ（入れ子可能）:',
          '  `group <id> "表示名" [color: blue, border: solid|dashed] { ... }`',
          '- ノード:',
          '  `node <id> "表示名" [icon: <icon>, sub: "補足", badge: "バッジ", color: green, visible: true, mount: border]`',
          `  - 使用可能な \`icon\`（全${ICON_NAMES.length}種）: \`${icons}\``,
          `  - 使用可能な \`color\`（大文字小文字は区別しない）: \`${colors}\`。16進カラーコードは使用不可。`,
          '  - `mount: border` を付けると、親グループの枠線上にゲートウェイやエンドポイントノードを配置する。',
          '',
          '## 3. 時系列ステップ (`step`)',
          '- `step "ステップ名" { ... }` の中に以下を記述する。**すべての文はそのステップ限りで有効（次ステップへ累積しない）。**',
          '  - `desc "プレイヤー上部に表示するステップ説明文"`',
          '  - `focus <id1>, <id2>, ...`（注目するノード/グループID。グループを指定すると配下要素も自動フォーカスされ、それ以外は減光される）',
          '  - `state <target_id> [badge: "...", color: <color>, visible: true|false]`',
          '    - 対象はノードまたはグループ。`visible: false` の場合を除き自動でフォーカスされる。',
          '    - **ステップ独立**: そのステップだけ宣言時の属性を上書きする。宣言済みのバッジや色を一時的に外す場合は `badge: ""` や `color: none` を使う。',
          '  - `animate <from_id> <arrow> <to_id> : "パケット名" [icon: <icon>, color: blue, desc: "アニメーション動作の説明", code: "...", parallel: true] { ... }`',
          '    - 使用可能な `<arrow>`: `-->`（実線片道）, `..>`（破線片道）, `<->`（実線往復）, `<.>`（破線往復）。自己ループは `-->` / `..>` のみ。',
          '    - `icon` は省略可能で、値は `node` の `icon` と同じ。トークンなら `key`、文書なら `file`、イベントなら `mail` のように、パケットが運ぶものを示す。',
          '    - 記述順に直列再生され、各アニメーション実行中に `desc` の説明がパケットの吹き出しに表示される。直前の `animate` と同時再生したい場合は `[parallel: true]` を付与する。',
          '    - 任意の `code` スニペット（指定時のみパケットの吹き出し内に表示され、省略時は非表示）:',
          '      - `animate ... { ... }` 内のブロック形式: ```` code [lang] ["タイトル"] ``` ... ``` ````（`json`・`sql`・`http` 等の言語識別子と `"タイトル"` はどちらも省略可。```` ``` ... ``` ```` 内の共通インデントは自動除去）、または1行文字列形式 `code [lang] "..."`。',
          '      - 短いスニペット向けの属性省略記法: `[code: "{ \\"status\\": 201 }"]`。',
          '      - `code` は1つの `animate` につき最大1つまで（重複は `duplicate-code` 警告）。吹き出しの可読性のため2〜6行程度の要所に絞る。',
          '  - `static <from_id> <arrow> <to_id> : "ラベル" [color: gray]`',
          '    - レプリケーションや監視など、パケットを動かさない背景接続をそのステップで表示する。端点はノードまたはグループを指定可（例: `static vpc ..> cloudwatch`）。矢印4種すべて使用可。',
          '',
          '## 4. 詳しさの基準',
          '書いた場にいなかった人が読んでも、図だけで内容が分かるようにする。',
          '- ノード: 短い表示名、種類に合う `icon`、技術や役割を示す `sub` を付ける。',
          '- ステップ: 3〜8個。まず正常な流れ、次に失敗や別経路をそれぞれ独立したステップにする。各ステップに、何が起きるかとその理由を1〜2文で書いた `desc` を付ける。',
          '- `animate`: `"POST /orders"` のような具体的なラベル、そのメッセージが何をするか・何を決めるかを書いた `desc`、運ぶものを示す `icon` を付ける。',
          '- `static`: レプリケーションや監視などの非移動接続に短いラベルを付ける。',
          '- `code`: 中身が重要なパケット（リクエスト、クエリ、イベント、レスポンス）に付ける。図全体で最低1つ、1ステップに1〜2個が目安。例に使う値はステップをまたいで揃える。',
          '- 変化する状態は、それが当てはまるステップに `state` の `badge` と `color` で示す。',
          '- 元の資料にない構成要素を作らない。',
          `- 折り返されるのは \`desc\` だけで、ほかの文字列は長すぎると \`…\` で切られる。収まる目安（半角英数字の文字数、括弧内は日本語の文字数）: ${TEXT_BUDGET.map(([name, latin, wide]) => `${name} ${latin}（${wide}）`).join('、')}。`,
          '',
          '## 5. サンプルコード',
        ];

  const fenceOf = (dsl: string) => (dsl.includes('```') ? '````' : '```');
  const exampleFence = fenceOf(PROMPT_EXAMPLE_DSL);
  sections.push(`${exampleFence}dav`, PROMPT_EXAMPLE_DSL, exampleFence);
  if (current) {
    const currentHeading =
      locale === 'en'
        ? '## 6. Current `.dav` Diagram to Modify'
        : '## 6. 現在の `.dav` コード（これをベースに編集してください）';
    const currentFence = fenceOf(current);
    sections.push('', currentHeading, `${currentFence}dav`, current, currentFence);
  }
  return sections.join('\n');
}

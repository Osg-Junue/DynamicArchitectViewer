import { COLOR_NAMES, ICON_NAMES, KEYWORD_NAMES } from '../model/types';

export interface AiPromptOptions {
  locale?: 'ja' | 'en';
  currentDsl?: string;
  includeCurrentDsl?: boolean;
}

const RESERVED_WORDS = KEYWORD_NAMES.map((w) => `\`${w}\``).join(', ');

export const PROMPT_EXAMPLE_DSL = `dav 1
title "Order Processing Architecture"

group cloud_vpc "Production VPC" {
  node alb "Ingress ALB" [icon: lb, sub: "HTTPS"]
  node api "Order Service" [icon: container, sub: "ECS x3"]
  node db "Orders DB" [icon: database, sub: "PostgreSQL"]
  node queue "Event Queue" [icon: queue, sub: "SQS"]
}

node client "Web Client" [icon: browser]

client --> alb : "HTTPS"
alb --> api : "gRPC"
api --> db : "SQL"
api ..> queue : "Async Event"

step "1. Submit Order" {
  desc "Client sends an order request through the load balancer to the API."
  focus client, alb, api, db
  state api [badge: "200 OK"]
  state db [badge: "WRITE"]
  animate client --> alb : "POST /orders" [desc: "Client sends order payload over HTTPS"] {
    code json "Order Request" \`\`\`
      {
        "orderId": "ord_01JCK9X7",
        "amount": 14800
      }
    \`\`\`
  }
  animate alb --> api : "Forward" [desc: "ALB routes request to healthy API container"]
  animate api --> db : "INSERT order" [desc: "API commits transaction to primary PostgreSQL"]
}

step "2. Enqueue Background Job" {
  desc "API publishes an event to the queue while keeping the DB state."
  focus api, queue
  state db [badge: ""]
  state queue [badge: "QUEUED"]
  animate api --> queue : "OrderCreated" [desc: "Publish async event for downstream workers"]
}`;

/**
 * Generates a self-contained prompt instructing an AI assistant how to author or update
 * a DynamicArchitectViewer (`dav 1`) diagram without syntax errors.
 */
export function buildAiPrompt(options: AiPromptOptions = {}): string {
  const locale = options.locale ?? 'en';
  const icons = ICON_NAMES.join(', ');
  const colors = COLOR_NAMES.join(', ');
  const current = options.includeCurrentDsl ? options.currentDsl?.trim() : undefined;

  const sections =
    locale === 'en'
      ? [
          '# DynamicArchitectViewer DSL v1 (`dav 1`) Specification',
          '',
          'Generate or update a time-stepped architecture / screen-transition diagram in DynamicArchitectViewer DSL v1 (`.dav`).',
          'Output ONLY valid `dav 1` code inside a ```dav code block.',
          '',
          '## 1. Strict Grammar Rules',
          '- The first non-comment statement MUST be `dav 1`.',
          '- Diagram title: `title "Diagram Title"` (at most once).',
          '- Identifiers (`<id>`): `[A-Za-z_][A-Za-z0-9_]*`. Every group, node, and named edge ID must be unique.',
          `- Reserved words cannot be IDs: ${RESERVED_WORDS}. (\`code\` is contextual inside \`animate { ... }\`, so \`node code\` remains valid.)`,
          '- Strings: always double-quoted `"..."` (escapes: `\\"`, `\\\\`, `\\n`, `\\t`).',
          '- Comments: `// single-line comment` anywhere.',
          '- Layout is 100% automatic from graph topology and group hierarchy (no manual coordinates).',
          '',
          '## 2. Declarations',
          '- Group (can be nested):',
          '  `group <id> "Label" [color: blue] { ... }`',
          '- Node:',
          '  `node <id> "Label" [icon: <icon>, sub: "Sublabel", badge: "TEXT", color: green, visible: true]`',
          `  - Allowed \`icon\` values (${ICON_NAMES.length}): \`${icons}\``,
          `  - Allowed \`color\` values (case-insensitive): \`${colors}\`. Hex codes are not supported.`,
          '- Edge (top-level only):',
          '  `<from_id> <arrow> <to_id> : "Edge Label" [id: <edge_id>, color: gray, visible: true]`',
          '  - Allowed `<arrow>` tokens: `-->` (solid), `..>` (dashed), `<->` (solid bidirectional), `<.>` (dashed bidirectional).',
          '  - Note: a colon `:` is required before the edge label string (`a --> b : "Label"`).',
          '  - A node can connect to itself with `-->` or `..>` (`a --> a`); `<->` and `<.>` cannot form a self-loop.',
          '  - A second edge with the same direction and endpoints needs `[id: ...]`. `state` can target an edge only through its `id`.',
          '',
          '## 3. Time-Stepped Scenarios (`step`)',
          '- `step "Step Title" { ... }` (ordered sequentially). Inside `{ ... }`:',
          '  - `desc "Explanation shown in the player dock"`',
          '  - `focus <id1>, <id2>, ...` (highlights listed nodes/groups; focusing a group automatically focuses its descendants; non-focused elements are dimmed during this step).',
          '  - `state <target_id> [badge: "...", color: <color>, visible: true|false]`',
          '    - A `state` target counts as focused for that step, unless it sets `visible: false`. A `state` on an edge also focuses both of its nodes.',
          '    - **Cumulative semantics**: `state` overrides accumulate across steps `1..k`. To clear a badge in a later step, set `badge: ""`. To return to the declared color, set `color: none`.',
          '  - `animate <from_id> <arrow> <to_id> : "Packet Label" [icon: <icon>, color: blue, desc: "Action description", code: "...", parallel: true] { ... }`',
          "    - `icon` is optional and takes the same values as a node's `icon`. Use it to show what the packet carries, such as `key` for a token, `file` for a document or `mail` for an event.",
          "    - Plays in declaration order and displays `desc` in the packet's speech bubble during that animation phase. Add `parallel: true` to run simultaneously with the immediately preceding `animate` statement. Only `-->` (one way) and `<->` (there and back) are allowed in `animate`.",
          '    - Optional `code` snippet (shown inside the packet callout when non-empty; hidden completely when absent):',
          '      - Block form inside `animate ... { ... }`: ```` code [lang] ["Title"] ``` ... ``` ```` (both `<lang>` like `json`/`sql`/`http` and `"Title"` are optional; common leading indentation inside ```` ``` ... ``` ```` is stripped), or one-line string form `code [lang] "..."`.',
          '      - Attribute shorthand for short snippets: `[code: "{ \\"status\\": 201 }"]`.',
          '      - Specify at most one `code` per `animate` (multiple `code` entries emit a `duplicate-code` warning) and keep snippets concise (2–6 key lines/fields) so callouts stay readable.',
          '',
          '## 4. Reference Example',
        ]
      : [
          '# DynamicArchitectViewer DSL v1 (`dav 1`) 仕様プロンプト',
          '',
          '以下の仕様に従い、DynamicArchitectViewer DSL v1（`.dav`）形式で時系列アーキテクチャ構成図または画面遷移図を作成・更新してください。',
          '回答には有効な `dav 1` コードのみを ```dav コードブロックで出力してください。',
          '',
          '## 1. 基本構文ルール',
          '- 先頭の文は必ず `dav 1` と記述する。',
          '- 図タイトルは `title "図タイトル"`（最大1回）。',
          '- 識別子（`<id>`）は `[A-Za-z_][A-Za-z0-9_]*`。グループ・ノード・明示エッジIDは図全体で一意にする。',
          `- 次の予約語はIDに使用不可: ${RESERVED_WORDS}。（\`code\` は \`animate { ... }\` 内の文脈キーワードのため、\`node code\` 等のIDとしては使用可）`,
          '- 文字列はすべてダブルクォート `"..."` で囲む（エスケープ: `\\"`, `\\\\`, `\\n`, `\\t`）。',
          '- コメントは `// 行コメント`。',
          '- 配置はトポロジとグループ階層から100%自動レイアウトされる（座標指定は不要）。',
          '',
          '## 2. 要素の宣言',
          '- グループ（入れ子可能）:',
          '  `group <id> "表示名" [color: blue] { ... }`',
          '- ノード:',
          '  `node <id> "表示名" [icon: <icon>, sub: "補足", badge: "バッジ", color: green, visible: true]`',
          `  - 使用可能な \`icon\`（全${ICON_NAMES.length}種）: \`${icons}\``,
          `  - 使用可能な \`color\`（大文字小文字は区別しない）: \`${colors}\`。16進カラーコードは使用不可。`,
          '- エッジ（トップレベルに記述）:',
          '  `<from_id> <arrow> <to_id> : "ラベル" [id: <edge_id>, color: gray, visible: true]`',
          '  - 使用可能な `<arrow>`: `-->`（実線）, `..>`（破線）, `<->`（双方向実線）, `<.>`（双方向破線）',
          '  - ※エッジのラベル文字列の前にはコロン `:` が必須（例: `a --> b : "HTTPS"`）。',
          '  - ノードから自身へのエッジは `-->` または `..>` で書ける（`a --> a`）。`<->` と `<.>` は自己ループに使用不可。',
          '  - 同じ向き・同じ両端の2本目のエッジには `[id: ...]` が必須。`state` でエッジを指定するには `id` が必要。',
          '',
          '## 3. 時系列ステップ (`step`)',
          '- `step "ステップ名" { ... }` の中に以下を記述する:',
          '  - `desc "プレイヤー上部に表示するステップ説明文"`',
          '  - `focus <id1>, <id2>, ...`（注目するノード/グループID。グループを指定すると配下要素も自動フォーカスされ、それ以外は減光される）',
          '  - `state <target_id> [badge: "...", color: <color>, visible: true|false]`',
          '    - `state` の対象は、そのステップでフォーカスされる（`visible: false` にする場合を除く）。エッジを指定した `state` は両端のノードもフォーカスされる。',
          '    - **累積適用ルール**: `state` の変更はステップ `1..k` で累積される。後のステップでバッジを消す場合は `badge: ""`、宣言時の色に戻す場合は `color: none` を明示する。',
          '  - `animate <from_id> <arrow> <to_id> : "パケット名" [icon: <icon>, color: blue, desc: "アニメーション動作の説明", code: "...", parallel: true] { ... }`',
          '    - `icon` は省略可能で、値は `node` の `icon` と同じ。トークンなら `key`、文書なら `file`、イベントなら `mail` のように、パケットが運ぶものを示す。',
          '    - 記述順に直列再生され、各アニメーション実行中に `desc` の説明がパケットの吹き出しに表示される。直前の `animate` と同時再生したい場合は `[parallel: true]` を付与する。`animate` で使える矢印は `-->`（片道）と `<->`（往復）のみ。',
          '    - 任意の `code` スニペット（指定時のみパケットの吹き出し内に表示され、省略時は非表示）:',
          '      - `animate ... { ... }` 内のブロック形式: ```` code [lang] ["タイトル"] ``` ... ``` ````（`json`・`sql`・`http` 等の言語識別子と `"タイトル"` はどちらも省略可。```` ``` ... ``` ```` 内の共通インデントは自動除去）、または1行文字列形式 `code [lang] "..."`。',
          '      - 短いスニペット向けの属性省略記法: `[code: "{ \\"status\\": 201 }"]`。',
          '      - `code` は1つの `animate` につき最大1つまで（重複は `duplicate-code` 警告）。吹き出しの可読性のため2〜6行程度の要所に絞る。',
          '',
          '## 4. サンプルコード',
        ];

  const fenceOf = (dsl: string) => (dsl.includes('```') ? '````' : '```');
  const exampleFence = fenceOf(PROMPT_EXAMPLE_DSL);
  sections.push(`${exampleFence}dav`, PROMPT_EXAMPLE_DSL, exampleFence);
  if (current) {
    const currentHeading =
      locale === 'en'
        ? '## 5. Current `.dav` Diagram to Modify'
        : '## 5. 現在の `.dav` コード（これをベースに編集してください）';
    const currentFence = fenceOf(current);
    sections.push('', currentHeading, `${currentFence}dav`, current, currentFence);
  }
  return sections.join('\n');
}

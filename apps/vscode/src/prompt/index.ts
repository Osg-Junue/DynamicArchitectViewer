import { ICON_NAMES, NODE_STATUSES } from '../model/types';

export interface AiPromptOptions {
  locale?: 'ja' | 'en';
  currentDsl?: string;
  includeCurrentDsl?: boolean;
}

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
api -.-> queue : "Async Event"

step "1. Submit Order" {
  desc "Client sends an order request through the load balancer to the API."
  focus client, alb, api, db
  state api [status: active, badge: "200 OK"]
  state db [status: active, badge: "WRITE"]
  animate client --> alb : "POST /orders" [color: #3b82f6]
  animate alb --> api : "Forward" [color: #3b82f6]
  animate api --> db : "INSERT order" [color: #10b981]
}

step "2. Enqueue Background Job" {
  desc "API publishes an event to the queue while keeping the DB state."
  focus api, queue
  state db [status: normal, badge: ""]
  state queue [status: warning, badge: "QUEUED"]
  animate api -.-> queue : "OrderCreated" [color: #f59e0b]
}`;

/**
 * Generates a self-contained prompt instructing an AI assistant how to author or update
 * a DynamicArchitectViewer (`dav 1`) diagram without syntax errors.
 */
export function buildAiPrompt(options: AiPromptOptions = {}): string {
  const locale = options.locale ?? 'ja';
  const icons = ICON_NAMES.join(', ');
  const statuses = NODE_STATUSES.join(', ');
  const includeCurrent = Boolean(options.includeCurrentDsl && options.currentDsl?.trim());

  if (locale === 'en') {
    const sections = [
      '# DynamicArchitectViewer DSL v1 (`dav 1`) Specification',
      '',
      'Generate or update a time-stepped architecture / screen-transition diagram in DynamicArchitectViewer DSL v1 (`.dav`).',
      'Output ONLY valid `dav 1` code inside a ```dav code block.',
      '',
      '## 1. Strict Grammar Rules',
      '- The first non-comment statement MUST be `dav 1`.',
      '- Diagram title: `title "Diagram Title"` (at most once).',
      '- Identifiers (`<id>`): `[A-Za-z_][A-Za-z0-9_]*`. Every group, node, and named edge/step ID must be unique.',
      '- Strings: always double-quoted `"..."` (escapes: `\\"`, `\\\\`, `\\n`, `\\t`).',
      '- Comments: `// single-line comment` anywhere.',
      '- Coordinates `@pos(x, y)` and `@size(w, h)` are OPTIONAL. Omit them when creating a new diagram so auto-layout places elements cleanly; preserve existing `@pos` / `@size` when editing.',
      '',
      '## 2. Declarations',
      '- Group (can be nested):',
      '  `group <id> "Label" [color: #3b82f6] { ... }`',
      '- Node:',
      '  `node <id> "Label" [icon: <icon>, sub: "Sublabel", status: <status>, badge: "TEXT", color: #10b981, visible: true]`',
      `  - Allowed \`icon\` values (${ICON_NAMES.length}): \`${icons}\``,
      `  - Allowed \`status\` values (${NODE_STATUSES.length}): \`${statuses}\``,
      '- Edge (top-level only):',
      '  `<from_id> <arrow> <to_id> : "Edge Label" [id: <edge_id>, color: #64748b, visible: true]`',
      '  - Allowed `<arrow>` tokens: `-->` (solid), `-.->` (dashed), `<-->` (solid bidirectional), `<-.->` (dashed bidirectional).',
      '  - Note: a colon `:` is required before the edge label string (`a --> b : "Label"`).',
      '',
      '## 3. Time-Stepped Scenarios (`step`)',
      '- `step "Step Title" { ... }` (ordered sequentially). Inside `{ ... }`:',
      '  - `desc "Explanation shown in the player dock"`',
      '  - `focus <id1>, <id2>, ...` (highlights listed nodes/groups; focusing a group automatically focuses its descendants; non-focused elements are dimmed during this step).',
      '  - `state <target_id> [status: ..., badge: "...", color: #..., visible: true|false, label: "...", sub: "..."]`',
      '    - **Cumulative semantics**: `state` overrides accumulate across steps `1..k`. To clear a badge or reset status in a later step, set `badge: ""` or `status: normal`.',
      '  - `animate <from_id> <arrow> <to_id> : "Packet Label" [color: #3b82f6, parallel: true]`',
      '    - Plays in declaration order. Add `parallel: true` to run simultaneously with the immediately preceding `animate` statement.',
      '',
      '## 4. Reference Example',
      '```dav',
      PROMPT_EXAMPLE_DSL,
      '```',
    ];

    if (includeCurrent && options.currentDsl) {
      sections.push(
        '',
        '## 5. Current `.dav` Diagram to Modify',
        '```dav',
        options.currentDsl.trim(),
        '```',
      );
    }
    return sections.join('\n');
  }

  const sections = [
    '# DynamicArchitectViewer DSL v1 (`dav 1`) 仕様プロンプト',
    '',
    '以下の仕様に従い、DynamicArchitectViewer DSL v1（`.dav`）形式で時系列アーキテクチャ構成図または画面遷移図を作成・更新してください。',
    '回答には有効な `dav 1` コードのみを ```dav コードブロックで出力してください。',
    '',
    '## 1. 基本構文ルール',
    '- 先頭の文は必ず `dav 1` と記述する。',
    '- 図タイトルは `title "図タイトル"`（最大1回）。',
    '- 識別子（`<id>`）は `[A-Za-z_][A-Za-z0-9_]*`。グループ・ノード・明示エッジIDは図全体で一意にする。',
    '- 文字列はすべてダブルクォート `"..."` で囲む（エスケープ: `\\"`, `\\\\`, `\\n`, `\\t`）。',
    '- コメントは `// 行コメント`。',
    '- `@pos(x, y)` と `@size(w, h)` は省略可能。新規作成時は省略すれば自動レイアウトされる。既存図を編集する場合は既存の `@pos` / `@size` を維持すること。',
    '',
    '## 2. 要素の宣言',
    '- グループ（入れ子可能）:',
    '  `group <id> "表示名" [color: #3b82f6] { ... }`',
    '- ノード:',
    '  `node <id> "表示名" [icon: <icon>, sub: "補足", status: <status>, badge: "バッジ", color: #10b981, visible: true]`',
    `  - 使用可能な \`icon\`（全${ICON_NAMES.length}種）: \`${icons}\``,
    `  - 使用可能な \`status\`（全${NODE_STATUSES.length}種）: \`${statuses}\``,
    '- エッジ（トップレベルに記述）:',
    '  `<from_id> <arrow> <to_id> : "ラベル" [id: <edge_id>, color: #64748b, visible: true]`',
    '  - 使用可能な `<arrow>`: `-->`（実線）, `-.->`（破線）, `<-->`（双方向実線）, `<-.->`（双方向破線）',
    '  - ※エッジのラベル文字列の前にはコロン `:` が必須（例: `a --> b : "HTTPS"`）。',
    '',
    '## 3. 時系列ステップ (`step`)',
    '- `step "ステップ名" { ... }` の中に以下を記述する:',
    '  - `desc "プレイヤー下部に表示するステップ説明文"`',
    '  - `focus <id1>, <id2>, ...`（注目するノード/グループID。グループを指定すると配下要素も自動フォーカスされ、それ以外は減光される）',
    '  - `state <target_id> [status: ..., badge: "...", color: #..., visible: true|false, label: "...", sub: "..."]`',
    '    - **累積適用ルール**: `state` の変更はステップ `1..k` で累積される。後のステップでバッジや状態を戻す場合は `badge: ""` や `status: normal` を明示する。',
    '  - `animate <from_id> <arrow> <to_id> : "パケット名" [color: #3b82f6, parallel: true]`',
    '    - 記述順に直列再生される。直前の `animate` と同時再生したい場合は `[parallel: true]` を付与する。',
    '',
    '## 4. サンプルコード',
    '```dav',
    PROMPT_EXAMPLE_DSL,
    '```',
  ];

  if (includeCurrent && options.currentDsl) {
    sections.push(
      '',
      '## 5. 現在の `.dav` コード（これをベースに編集してください）',
      '```dav',
      options.currentDsl.trim(),
      '```',
    );
  }
  return sections.join('\n');
}

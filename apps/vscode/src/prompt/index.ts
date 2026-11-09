import { COLOR_NAMES, ICON_NAMES } from '../model/types';

export interface AiPromptOptions {
  locale?: 'ja' | 'en';
  currentDsl?: string;
  includeCurrentDsl?: boolean;
}

const RESERVED_WORDS =
  '`dav`, `title`, `group`, `node`, `step`, `desc`, `focus`, `state`, `animate`, `true`, `false`';

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
  animate client --> alb : "POST /orders" [desc: "Client sends order payload over HTTPS"]
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
      '- Identifiers (`<id>`): `[A-Za-z_][A-Za-z0-9_]*`. Every group, node, and named edge ID must be unique.',
      `- Reserved words cannot be IDs: ${RESERVED_WORDS}.`,
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
      '    - **Cumulative semantics**: `state` overrides accumulate across steps `1..k`. To clear a badge in a later step, set `badge: ""`. To return to the declared color, set `color: none`.',
      '  - `animate <from_id> <arrow> <to_id> : "Packet Label" [color: blue, desc: "Action description", parallel: true]`',
      "    - Plays in declaration order and displays `desc` in the packet's speech bubble during that animation phase. Add `parallel: true` to run simultaneously with the immediately preceding `animate` statement. Only `-->` (one way) and `<->` (there and back) are allowed in `animate`.",
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
    `- 次の予約語はIDに使用不可: ${RESERVED_WORDS}。`,
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
    '    - **累積適用ルール**: `state` の変更はステップ `1..k` で累積される。後のステップでバッジを消す場合は `badge: ""`、宣言時の色に戻す場合は `color: none` を明示する。',
    '  - `animate <from_id> <arrow> <to_id> : "パケット名" [color: blue, desc: "アニメーション動作の説明", parallel: true]`',
    '    - 記述順に直列再生され、各アニメーション実行中に `desc` の説明がパケットの吹き出しに表示される。直前の `animate` と同時再生したい場合は `[parallel: true]` を付与する。`animate` で使える矢印は `-->`（片道）と `<->`（往復）のみ。',
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

# Dynamic Architect DSL 言語仕様書 (DSL Specification)

DynamicArchitectViewer で使用する Mermaid ライクな独自ドメイン固有言語（DSL）の文法リファレンスです。

---

## 1. 基本構造

DSLファイルは上から順に以下の4種類の宣言で構成されます（順序は任意ですが、可読性のため以下の順序を推奨します）。

1. **図タイトル宣言 (`diagram`)**
2. **グループ・ノード定義 (`group`, `node`)**
3. **エッジ（接続線）定義 (`-->`, `-.->`, `<-->`)**
4. **動的ステップ定義 (`step 1 "..." { ... }`)**

行内の `//` 以降はコメントとして扱われます（ダブルクォート文字列内を除く）。

---

## 2. 各要素の文法

### 2.1 図タイトル宣言

```text
diagram "AWS マルチAZ Webアーキテクチャ & DBフェイルオーバー"
```

### 2.2 グループ定義 (`group`)

VPC、サブネット、マイクロサービス境界、またはフロントエンド/バックエンド領域などの枠を定義します。

```text
group <group_id> "グループ表示名" [color: #3b82f6] @pos(260, 40) @size(620, 420) {
  // グループ内に所属する node を記述
  node alb "Application LB" [icon: lb, sub: "Ingress"] @pos(300, 200)
}
```

- `@pos(x, y)` および `@size(w, h)` は省略可能です（省略時は所属ノードの配置から自動計算されます）。

### 2.3 ノード定義 (`node`)

インフラ構成要素または画面遷移図の画面カードを定義します。

```text
node <node_id> "表示ラベル" [icon: server, sub: "補足テキスト", status: normal, badge: "OK", visible: true, color: #3b82f6] @pos(490, 210)
```

- **利用可能な属性 (`[...]`)**:
  - `icon`: アイコン種別（下記セクション3参照。省略時は `server`）
  - `sub`: ラベルの下に表示する補足テキスト（画面URLやインスタンス種別など）
  - `status`: 初期状態（`normal` | `active` | `muted` | `warning` | `error`）
  - `badge`: ノード右上に表示するピル型バッジ文字列（例: `"STANDBY"`, `"v2"`）
  - `visible`: 初期表示の有無（`true` | `false`。障害時のみ出現する要素やモーダル画面では `false` に設定）
  - `color`: アクセントカラーのHEX指定（例: `#10b981`）
- **`@pos(x, y)`**:
  - 省略時は接続関係に基づいて左から右へ自動整列されます。
  - GUIキャンバス上でドラッグ移動すると、この `@pos(x, y)` が自動更新されます。

### 2.4 エッジ（接続線）定義

Mermaid風の矢印記法でノード間の接続を定義します。

```text
// 実線矢印
client --> alb : "HTTPS"

// Mermaidパイプ形式のラベル指定も可
client -->|HTTPS| alb

// 破線矢印 + 属性指定（初期非表示のフェイルオーバー経路など）
api -.-> db_sby : "Failover Route" [id: e_failover, visible: false, color: #f59e0b]

// 双方向矢印
apigw <--> client : "WebSocket"
```

- **矢印の種類**:
  - `-->` または `->`: 実線・片方向
  - `-.->` または `..>`: 破線・片方向
  - `<-->` または `<->`: 実線・双方向
  - `<-.->`: 破線・双方向
- **利用可能な属性 (`[...]`)**:
  - `id`: エッジの明示的ID（`step` 内の `state` で表示/非表示を切り替える際に使用）
  - `visible`: 初期表示の有無（`true` | `false`）
  - `color`: 線の色

---

## 3. 動的ステップ定義 (`step`)

時系列に沿ったデータの流れ・画面遷移・状態変化を `step` ブロックで定義します。

```text
step 1 "ステップのタイトル" {
  desc "画面下部のプレイヤーに表示される解説テキスト"
  focus client, alb, api
  state db_pri [status: error, badge: "DOWN"]
  state db_sby [status: active, badge: "PROMOTED"]
  state e_failover [visible: true]
  animate client --> alb : "POST /login" [color: #3b82f6]
  animate alb --> api : "Forward" [color: #10b981]
}
```

### `step` ブロック内の命令一覧

| 命令          | 構文例                                                                  | 動作                                                                                                                                                                                                       |
| :------------ | :---------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`desc`**    | `desc "解説文"`                                                         | ステップ選択時に下部パネルへ表示する説明文（複数行記述可）                                                                                                                                                 |
| **`focus`**   | `focus id1, id2, id3`                                                   | 指定したノード/エッジを強調し、それ以外の要素を減光（Dimming）表示する                                                                                                                                     |
| **`state`**   | `state <id> [status: error, badge: "DOWN", visible: true]`              | このステップにおける対象ノードまたはエッジの状態・バッジ・表示有無・ラベルを上書きする                                                                                                                     |
| **`animate`** | `animate <from> --> <to> : "データ名" [color: #3b82f6, parallel: true]` | `<from>` から `<to>` へ移動する発光データパケットとラベルを描画する。複数行記述した場合は上から順番に連続遷移（シーケンス再生）し、`parallel: true` を付与した場合は直前のアニメーションと同時並列で流れる |

---

## 4. 標準搭載アイコン一覧 (`icon`)

### インフラ構成系 (`category: infra`)

| `icon` 値   | 用途・意味                                      | 標準カラー |
| :---------- | :---------------------------------------------- | :--------- |
| `server`    | APIサーバー / アプリケーションサーバー / VM     | `#3b82f6`  |
| `container` | コンテナ / ECS / Kubernetes Pod                 | `#0ea5e9`  |
| `function`  | サーバーレス関数 (AWS Lambda / Cloud Functions) | `#f59e0b`  |
| `database`  | データベース (RDS / Aurora / DynamoDB)          | `#10b981`  |
| `cache`     | インメモリキャッシュ (Redis / ElastiCache)      | `#ef4444`  |
| `queue`     | メッセージキュー / イベントバス (SQS / Kafka)   | `#a855f7`  |
| `storage`   | オブジェクトストレージ (S3 / Cloud Storage)     | `#14b8a6`  |
| `lb`        | ロードバランサー (ALB / NLB / Nginx)            | `#6366f1`  |
| `firewall`  | WAF / Firewall / 認証基盤 (Auth0 / Cognito)     | `#f43f5e`  |
| `cdn`       | CDN / DNS (CloudFront / Route53 / Cloudflare)   | `#8b5cf6`  |
| `cloud`     | クラウドネットワーク / 外部インターネット       | `#38bdf8`  |
| `router`    | API Gateway / ルーター                          | `#ec4899`  |
| `external`  | 外部SaaS / 外部決済API (Stripe / SendGrid等)    | `#64748b`  |

### 画面遷移・クライアント系 (`category: screen`)

| `icon` 値 | 用途・意味                                           | 標準カラー |
| :-------- | :--------------------------------------------------- | :--------- |
| `screen`  | 画面カード（ブラウザ風ワイヤーフレームヘッダー付き） | `#3b82f6`  |
| `modal`   | モーダル / ポップアップダイアログ画面                | `#a855f7`  |
| `browser` | Webブラウザクライアント                              | `#06b6d4`  |
| `mobile`  | モバイルアプリ (iOS / Android)                       | `#10b981`  |
| `user`    | エンドユーザー / アクター                            | `#f59e0b`  |

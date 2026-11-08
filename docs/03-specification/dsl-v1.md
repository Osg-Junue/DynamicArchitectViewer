# DSL v1 言語仕様書 (`dav 1`)

DynamicArchitectViewer の唯一の真実のソース（Single Source of Truth）となる独自 DSL のバージョン 1 正式仕様。

---

## 1. 設計原則

1. **宣言的構造 × 命令的シナリオ**: 図の静的な構造（`group` / `node` / エッジ）と、時系列の振る舞い（`step`）を同一ファイル内で分離して記述する。
2. **コード記述のみ & 100% 自動レイアウト**: 座標やサイズの手動指定を廃し、トポロジとグループ階層から決定論的に自動配置する。
3. **コンパクトな文法**: 1行1宣言を基本とし、AI も人間も迷わず読み書きできる最小限の構文に絞る。
4. **Git フレンドリー**: フォーマッタにより常に一意なテキスト表現に正規化され、差分が最小化される。

---

## 2. 字句構造（Lexical Structure）

- **文字コード**: UTF-8
- **改行**: `\n` または `\r\n`
- **コメント**: `//` から行末まで（単一行コメント）
- **識別子 (`<id>`)**: `^[a-zA-Z_][a-zA-Z0-9_]*$`（予約語を除く）
- **文字列 (`<string>`)**: ダブルクォート `"..."` で囲まれた文字列（`\"`, `\\`, `\n`, `\t` のエスケープをサポート）
- **色 (`<color>`)**: `red` | `orange` | `yellow` | `green` | `teal` | `blue` | `purple` | `pink` | `gray`（大文字小文字は区別しない。表示テーマに合わせた色で描画する）
- **真偽値 (`<bool>`)**: `true` | `false`

---

## 3. 文法定義（EBNF）

```ebnf
Document      ::= Header Statement*
Header        ::= "dav" "1"

Statement     ::= TitleStmt | GroupDecl | NodeDecl | EdgeDecl | StepDecl
TitleStmt     ::= "title" String

GroupDecl     ::= "group" Identifier String? AttrBlock? "{" GroupChild* "}"
GroupChild    ::= GroupDecl | NodeDecl

NodeDecl      ::= "node" Identifier String? AttrBlock?

EdgeDecl      ::= Identifier ArrowOp Identifier (":" String)? AttrBlock?
ArrowOp       ::= "-->" | "-.->" | "<-->" | "<-.->"

StepDecl      ::= "step" String "{" StepStmt* "}"
StepStmt      ::= DescStmt | FocusStmt | StateStmt | AnimateStmt
DescStmt      ::= "desc" String
FocusStmt     ::= "focus" Identifier ("," Identifier)*
StateStmt     ::= "state" Identifier AttrBlock
AnimateStmt   ::= "animate" Identifier ArrowOp Identifier (":" String)? AttrBlock? ("{" DescStmt* "}")?

AttrBlock     ::= "[" (Attr ("," Attr)* ","?)? "]"
Attr          ::= (Identifier | "desc") ":" (String | Identifier | Color | Boolean)
```

---

## 4. 各要素のセマンティクスと属性

### 4.1 ヘッダ・タイトル

```dav
dav 1
title "AWS マルチAZ Webアーキテクチャ & DBフェイルオーバー"
```

- 先頭の非コメント文は必ず `dav 1`。省略時は `missing-header` エラー。

### 4.2 グループ (`group`)

```dav
group vpc "Production VPC" [color: blue] {
  node alb "Application LB" [icon: lb]
}
```

- ネスト可能。配下のノード・サブグループを自動で包含する境界ボックスとして描画される。
- **属性**:
  - `color`: `<color>`（ゾーンの色）

### 4.3 ノード (`node`)

```dav
node db_pri "Primary DB" [icon: database, sub: "Aurora Writer", badge: "WRITER", visible: true, color: green]
```

- **属性**:
  - `icon`: 下記 18 種の組み込みアイコン名（省略時: `server`）
    - インフラ系 (13種): `server`, `container`, `function`, `database`, `cache`, `queue`, `storage`, `lb`, `firewall`, `cdn`, `cloud`, `router`, `external`
    - 画面・アクター系 (5種): `screen`, `modal`, `browser`, `mobile`, `user`
  - `sub`: `<string>`（ノード下部の補足ラベル）
  - `badge`: `<string>`（駅の上に表示されるバッジ）
  - `visible`: `<bool>`（初期表示状態。省略時: `true`）
  - `color`: `<color>`（駅の輪、アイコン、バッジの色。省略時はいずれも無彩色）

### 4.4 エッジ（通信経路・画面遷移）

```dav
api --> db_pri : "Read / Write"
db_pri -.-> db_sby : "Sync Replication"
user <--> apigw : "HTTPS"
api -.-> db_sby : "Failover Route" [id: e_failover, visible: false, color: yellow]
```

- **矢印演算子**:
  - `-->` : 実線・単方向
  - `-.->` : 破線・単方向
  - `<-->` : 実線・双方向
  - `<-.->` : 破線・双方向
- **属性**:
  - `id`: `<id>`（`step` 内の `state` や `focus` から参照するための明示的 ID。省略時の暗黙 ID は `<from>-><to>`）
  - `color`: `<color>`（線の色）
  - `visible`: `<bool>`（初期表示状態。省略時: `true`）

### 4.5 ステップ (`step`)

```dav
step "Primary DB障害発生と自動フェイルオーバー" {
  desc "Primary DBで障害が発生。Standby DBをWriterに昇格させて経路を自動切替します。"
  focus api, db_pri, db_sby
  state db_pri [badge: "DOWN"]
  state db_sby [badge: "PROMOTED"]
  state e_failover [visible: true]
  animate api -.-> db_sby : "Reconnect Writer" [color: yellow, desc: "昇格したStandby DBへエンドポイントを自動切替"]
}
```

- **評価モデル（累積状態 + ステップ局所演出）**:
  - `state <id> [...]` による状態変更（`badge`, `visible`, `color`）は **Step 1 から Step $k$ まで順に累積適用** される（ノードは `badge`/`visible`/`color`、グループは `color`、エッジは `visible`/`color` を変更可能）。
  - `state` の `color` には `none` も指定でき、それまでのステップで付けた色を解除して宣言時の色に戻す（`node` / `group` / エッジの宣言では使用不可）。
  - `focus`（ハイライト対象）および `animate`（パケットアニメーション）は **そのステップのみ有効**。
  - `animate` には `desc: "..."` 属性（または `{ desc "..." }` ブロック）で各アニメーション動作の解説を記述でき、再生中のフェーズに合わせてパケットの吹き出しに表示される。
  - `animate` に `[parallel: true]` を指定すると、直前の `animate` と同じフェーズで同時再生される。

---

## 5. 診断コード一覧

| コード | 重大度 | 条件 |
| :--- | :--- | :--- |
| `missing-header` | Error | 先頭が `dav <version>` で始まっていない |
| `unsupported-version` | Error | バージョン番号が `1` 以外 |
| `duplicate-title` | Warning | `title` が複数回宣言された |
| `duplicate-id` | Error | 同一の `<id>` が複数回宣言された |
| `duplicate-edge` | Error | 同一ペア間に `id` 属性なしで複数エッジが宣言された |
| `undefined-reference` | Error | 未定義の `<id>` をエッジ・`focus`・`state`・`animate` で参照した |
| `reference-kind-mismatch` | Error | エッジの端点や `animate` にグループ ID を指定した等 |
| `unknown-attribute` | Warning | 要素種別で許可されていない属性名を指定した |
| `duplicate-attribute` | Warning | 同一属性ブロック内で同じ属性名を複数回指定した |
| `invalid-attribute-value` | Error | 属性値の型または列挙値が不正 |
| `attribute-not-applicable` | Warning | `state` の対象種別に適用できない属性を指定した |
| `empty-state` | Warning | `state` の属性ブロックが空 `[]` |
| `unknown-icon` | Error | 18種以外のアイコン名を指定した（最近傍候補をサジェスト） |
| `invalid-color` | Error | 定義済みの色名以外の色指定（16 進カラーコードを含む。最も近い色名をサジェスト） |
| `invalid-escape` | Error | 文字列内の未定義エスケープシーケンス |
| `unexpected-eof` | Error | ブロック `{ ... }` または文字列が閉じられていない |
| `syntax-error` | Error | その他の構文エラー |

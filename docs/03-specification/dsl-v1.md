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
Header        ::= "dav" Number

Statement     ::= TitleStmt | GroupDecl | NodeDecl | EdgeDecl | StepDecl
TitleStmt     ::= "title" String

GroupDecl     ::= "group" Identifier String? AttrBlock? "{" GroupChild* "}"
GroupChild    ::= GroupDecl | NodeDecl

NodeDecl      ::= "node" Identifier String? AttrBlock?

EdgeDecl      ::= Identifier ArrowOp Identifier (":" String)? AttrBlock?
ArrowOp       ::= "-->" | "..>" | "<->" | "<.>"

AnimateArrow  ::= "-->" | "<->"

StepDecl      ::= "step" String "{" StepStmt* "}"
StepStmt      ::= DescStmt | FocusStmt | StateStmt | AnimateStmt
DescStmt      ::= "desc" String
FocusStmt     ::= "focus" Identifier ("," Identifier)*
StateStmt     ::= "state" Identifier AttrBlock
AnimateStmt   ::= "animate" Identifier AnimateArrow Identifier (":" String)? AttrBlock? ("{" DescStmt* "}")?

AttrBlock     ::= "[" (Attr ("," Attr)* ","?)? "]"
Attr          ::= (Identifier | "desc") ":" (String | Number | Color | Identifier | Boolean)
```

---

## 4. 各要素のセマンティクスと属性

### 4.1 ヘッダ・タイトル

```dav
dav 1
title "AWS マルチAZ Webアーキテクチャ & DBフェイルオーバー"
```

- 先頭の非コメント文は必ず `dav 1`。省略時は `missing-header` エラー。
- バージョン番号は整数のみ。`dav 1.0` や `dav 01` は `unsupported-version` エラー。

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
  - `icon`: 下記 35 種の組み込みアイコン名（省略時: `server`、大文字小文字は区別しない）
    - インフラ・ロジック系 (23種): `server`, `container`, `function`, `database`, `cache`, `queue`, `storage`, `lb`, `firewall`, `cdn`, `cloud`, `router`, `external`, `auth`, `ai`, `mail`, `monitor`, `schedule`, `search`, `logic`, `webhook`, `payment`, `key`
    - 画面・アクター・ドキュメント系 (12種): `screen`, `modal`, `browser`, `mobile`, `terminal`, `device`, `chat`, `sheet`, `file`, `user`, `users`, `bot`
  - `sub`: `<string>`（ノード下部の補足ラベル）
  - `badge`: `<string>`（駅の上に表示されるバッジ）
  - `visible`: `<bool>`（初期表示状態。省略時: `true`）
  - `color`: `<color>`（駅の輪、アイコン、バッジの色。省略時はいずれも無彩色）

### 4.4 エッジ（通信経路・画面遷移）

```dav
api --> db_pri : "Read / Write"
db_pri ..> db_sby : "Sync Replication"
user <-> apigw : "HTTPS"
api ..> db_sby : "Failover Route" [id: e_failover, visible: false, color: yellow]
```

- **矢印演算子**:
  - `-->` : 実線・単方向
  - `..>` : 破線・単方向
  - `<->` : 実線・双方向
  - `<.>` : 破線・双方向
- **自己ループ**: `a --> a` のように同じノードを両端に指定すると、駅の右上にループを描く。`<->` と `<.>` は使用不可（`invalid-self-arrow`）。`animate a --> a` のパケットはループを1周する。
- **属性**:
  - `id`: `<id>`（`step` 内の `state` からエッジを参照するために必須の明示的 ID。省略時の暗黙 ID `<from>-><to>` は内部の識別用で、識別子の字句規則に合わないため DSL からは参照できない）
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
  animate api --> db_sby : "Reconnect Writer" [color: yellow, desc: "昇格したStandby DBへエンドポイントを自動切替"]
}
```

- **評価モデル（累積状態 + ステップ局所演出）**:
  - `state <id> [...]` による状態変更（`badge`, `visible`, `color`）は **Step 1 から Step $k$ まで順に累積適用** される（ノードは `badge`/`visible`/`color`、グループは `color`、エッジは `visible`/`color` を変更可能）。
  - `state` の対象と `animate` の両端は、`focus` に書かなくてもそのステップの強調対象になる。ただし `visible: false` にする `state` は対象に数えず、エッジを指定した `state` は両端のノードも対象にする。
  - `state` の `color` には `none` も指定でき、それまでのステップで付けた色を解除して宣言時の色に戻す（`node` / `group` / エッジの宣言では使用不可）。
  - `focus`（ハイライト対象）および `animate`（パケットアニメーション）は **そのステップのみ有効**。`focus` の対象はノードとグループのみで、エッジは指定できない。
  - `animate` には `desc: "..."` 属性（または `{ desc "..." }` ブロック）で各アニメーション動作の解説を記述でき、再生中のフェーズに合わせてパケットの吹き出しに表示される。
  - `animate` に `[parallel: true]` を指定すると、直前の `animate` と同じフェーズで同時再生される。
  - `animate` で使える矢印は `-->`（片道）と `<->`（片道と同じ時間で往復）のみ。エッジの矢印の種類はパケットの動きに影響しない。

---

## 5. 診断コード一覧

| コード | 重大度 | 条件 |
| :--- | :--- | :--- |
| `missing-header` | Error | 先頭が `dav <version>` で始まっていない |
| `unsupported-version` | Error | バージョン番号が `1` 以外（`1.0` のように整数でない表記を含む） |
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
| `unknown-icon` | Error | 35種以外のアイコン名を指定した（最近傍候補をサジェスト） |
| `invalid-color` | Error | 定義済みの色名以外の色指定（16 進カラーコードを含む。色名のタイプミスには最も近い色名をサジェスト） |
| `invalid-animate-arrow` | Error | `animate` に点線の矢印を指定した |
| `invalid-self-arrow` | Error | 自己ループに双方向の矢印を指定した |
| `invalid-escape` | Error | 文字列内の未定義エスケープシーケンス |
| `unexpected-eof` | Error | ブロック `{ ... }` が閉じられていない |
| `syntax-error` | Error | その他の構文エラー（閉じられていない文字列を含む） |

---

## 6. 互換性方針

### 6.1 `dav 1` を固定する時期

`dav 1` は **Marketplace の初回公開版で固定** する。それまでは `dav 1` のまま破壊的変更を行うことがある。

公開前に廃止した記法（`-.->` などの矢印、`focus` でのエッジ指定）には、移行を案内する診断や Quick Fix を用意しない。公開前の記法で書かれた外部のファイルがないため。

### 6.2 固定後に `dav 1` のまま行える変更

既存の `.dav` が同じ意味のまま読めることを基準にする。

| 変更 | `dav 1` のまま | 理由 |
| :--- | :--- | :--- |
| 省略可能な属性や構文の追加 | 可 | 既存のファイルは書き換えなしで同じ意味になる |
| アイコンなど、属性に指定できる値の追加 | 可 | 同上 |
| 新しい警告の追加 | 可 | ファイルは引き続き読める |
| 自動レイアウトのルールの変更 | 可 | 配置は仕様の対象外。保証するのは同じ入力から同じ配置になること |
| 仕様と異なる実装の修正、診断の文言の変更 | 可 | 仕様は変わらない |
| 予約語の追加 | 不可 | 同じ名前の ID を使うファイルが読めなくなる |
| 受理していた記法のエラー化 | 不可 | 既存のファイルが読めなくなる |
| 既定値や属性、矢印の意味の変更 | 不可 | 既存のファイルの表示が黙って変わる |

### 6.3 破壊的変更

「不可」の変更は `dav 2` として行う。その際は次を同時に提供する。

- 拡張機能は `dav 1` のファイルを引き続き読める
- 古い記法には、移行を案内する診断と Quick Fix を用意する

### 6.4 バージョン番号の独立性

`dav` のバージョンは DSL の言語仕様だけを表す。拡張機能のバージョン（`package.json`）と、出力 HTML の埋め込みデータの形式（`EXPORT_FORMAT_VERSION`）とは別に管理する。

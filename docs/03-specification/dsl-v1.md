# DSL v1 言語仕様

> [!NOTE]
> 製品版（`apps/web`）の DSL 仕様です。実装は `apps/web/src/dsl/`（文法: `grammar/dav.grammar`）。プロトタイプの旧仕様は [prototype/dsl-reference.md](../prototype/dsl-reference.md) を参照（互換性なし）。

## 1. 設計方針

| 方針 | 内容 |
| :--- | :--- |
| 書き方は1通り | 同じ意味の別名構文（`->` と `-->`、`|label|` と `: "label"`、`flow:`、`title`、`type:` など）は廃止 |
| AI が書きやすい | 座標なしで完結する。キーワードは英語、ラベルは任意の言語 |
| 間違いは必ず報告 | 未定義参照・重複 ID・不正な属性値・未知の属性は診断を出す（黙って補正しない） |
| 改行・インデントに依存しない | 文はトークン列だけで区切れる。`{` は次の行に書いてもよい |
| 版数を持つ | 先頭の `dav 1` で版を宣言し、将来のマイグレーションに備える |

## 2. 例

```text
dav 1
title "AWS マルチAZ Webアーキテクチャ & DBフェイルオーバー"

node client "Web Browser" [icon: browser, sub: "エンドユーザー"]

group vpc "Production VPC" [color: #3b82f6] {
  node alb "Application LB" [icon: lb]
  node api "Order API" [icon: container, sub: "ECS Fargate x4"]

  group data "Data Subnet" {
    node db_pri "Primary DB" [icon: database]
    node db_sby "Standby DB" [icon: database, status: muted, badge: "STANDBY"] @pos(980, 340)
  }
}

client --> alb : "HTTPS"
alb --> api
api --> db_pri : "Read / Write"
db_pri -.-> db_sby : "Sync Replication"
api -.-> db_sby : "Failover Route" [id: failover, visible: false, color: #f59e0b]

step "通常のリクエスト" {
  desc "ブラウザからのリクエストが ALB 経由で API に届きます。"
  focus client, alb, api
  animate client --> alb : "GET /products" [color: #38bdf8]
  animate alb --> api : "Forward"
}

step outage "Primary DB 障害とフェイルオーバー" {
  desc "Primary DB が停止し、Standby DB が昇格します。"
  state db_pri [status: error, badge: "DOWN"]
  state db_sby [status: active, badge: "PROMOTED"]
  state failover [visible: true]
  animate api -.-> db_sby : "Reconnect Writer" [color: #f59e0b]
}
```

## 3. 字句

| 要素 | 規則 |
| :--- | :--- |
| 空白・改行 | トークン区切りとしてのみ意味を持つ |
| コメント | `//` から行末まで（文字列内を除く） |
| 識別子 `Ident` | `[A-Za-z_][A-Za-z0-9_]*`。大文字小文字を区別。キーワードと同じ綴りは使用不可 |
| 文字列 `String` | `"..."`。エスケープは `\"` `\\` `\n` `\t` のみ。生の改行は不可 |
| 数値 `Number` | `-?[0-9]+(\.[0-9]+)?` |
| 色 `Color` | `#rgb` または `#rrggbb`（16進） |
| キーワード | `dav` `title` `group` `node` `step` `desc` `focus` `state` `animate` `true` `false` |
| 矢印 | `-->` 実線・片方向 / `-.->` 破線・片方向 / `<-->` 実線・双方向 / `<-.->` 破線・双方向 |

> [!NOTE]
> 識別子のハイフンは廃止します（`a-b-->c` のように矢印と曖昧になるため）。

## 4. 文法（EBNF）

```ebnf
Document     = Header { TopStatement } ;
Header       = "dav" Number ;

TopStatement = Title | Group | Node | Edge | Step ;
Title        = "title" String ;

Group        = "group" Ident [ String ] [ Attributes ] { Placement } "{" { GroupMember } "}" ;
GroupMember  = Group | Node ;
Node         = "node" Ident [ String ] [ Attributes ] { Placement } ;
Placement    = "@pos" "(" Number "," Number ")"
             | "@size" "(" Number "," Number ")" ;

Edge         = Ident Arrow Ident [ ":" String ] [ Attributes ] ;
Arrow        = "-->" | "-.->" | "<-->" | "<-.->" ;

Step         = "step" [ Ident ] String "{" { StepStatement } "}" ;
StepStatement= Desc | Focus | State | Animate ;
Desc         = "desc" String ;
Focus        = "focus" Ident { "," Ident } ;
State        = "state" Ident Attributes ;
Animate      = "animate" Ident Arrow Ident [ ":" String ] [ Attributes ] ;

Attributes   = "[" [ Attribute { "," Attribute } [ "," ] ] "]" ;
Attribute    = Ident ":" Value ;
Value        = String | Number | Color | Ident | "true" | "false" ;
```

## 5. 意味規則

### 5.1 文書
- `dav 1` は先頭に必須。省略時はエラー（`dav 1` を補完する修正候補を提示）。
- `title` は最大1回。省略時は空文字。

### 5.2 ID 空間
- ノード・グループ・エッジ・ステップの ID は**同一の名前空間**を共有し、重複はエラー。
- エッジの ID は `[id: ...]` で明示できる。省略時は `from->to` を内部 ID とする（DSL からは参照不可）。
- 同じ `from` / `to` / 向きのエッジを2本以上書く場合、2本目以降は `id` の明示が必須（エラー）。
- ステップの ID は省略可。ステップは記述順に番号付けされる（番号は DSL に書かない）。

### 5.3 グループ
- グループは入れ子にできる。ノードの所属は記述位置（直近の親グループ）で決まる。
- `@pos` / `@size` を省略したグループは、子要素の外接矩形＋余白から自動算出する。

### 5.4 属性

| 対象 | 属性 | 型 | 既定値 |
| :--- | :--- | :--- | :--- |
| node | `icon` | アイコン名（§6） | `server` |
| node | `sub` | String | なし |
| node / state | `status` | `normal` `active` `muted` `warning` `error` | `normal` |
| node / state | `badge` | String（`""` で非表示） | なし |
| node / edge / state | `visible` | Boolean | `true` |
| node / group / edge / state / animate | `color` | Color | アイコン既定色 |
| state | `label`, `sub` | String | — |
| edge | `id` | Ident | `from->to` |
| animate | `parallel` | Boolean | `false` |

- 対象に存在しない属性は**警告**、型・値が不正な属性は**エラー**（その属性は無視して描画は続行）。
- 同じ属性の重複は警告（後勝ち）。

### 5.5 ステップ
- `desc` を複数書いた場合は改行で連結する。
- `focus` に列挙した要素と、`state` / `animate` の対象を強調し、それ以外を減光する。何も指定がないステップは減光しない。
- `animate` は記述順に順次再生する。`parallel: true` は直前の `animate` と同時に再生する。
- `animate a --> b` に対応するエッジが存在しない場合も、`a`→`b` の暗黙の経路でパケットを描画する（警告なし）。両端ノードはそのステップで表示状態になる。
- `state` は**累積**する。ステップ k における各要素の状態は、基本状態に step 1..k の `state` を記述順に上書き適用して決定的に算出する（任意のステップへジャンプしても結果は同じ）。元に戻すには明示的に上書きする（例: `state db [status: normal, badge: ""]`）。
- `focus` と `animate` はそのステップ限りで、後続ステップには引き継がない。
- 全体図（ステップ未選択）は基本状態を表示する。

### 5.6 参照の検証
- `Edge` の両端、`focus` / `state` / `animate` の対象が未定義ならエラー。
- `state` の対象種別に合わない属性（例: エッジに `icon`）は警告。

## 6. アイコン

プロトタイプの18種を継承する: `server` `container` `function` `database` `cache` `queue` `storage` `lb` `firewall` `cdn` `cloud` `router` `external` `screen` `modal` `browser` `mobile` `user`。
未知のアイコン名はエラー（最も近い名前を修正候補として提示）。

## 7. 正規フォーマット

フォーマッタ（`format()`）は以下に正規化する。コメントは直後の文に付随させて保持する。
- インデントは2スペース、ブロック内の文は1行1文
- 並び順は変更しない（意味を持たないが、作者の意図した順序を尊重する）
- 属性は `[key: value, key: value]`、配置は `@pos(x, y) @size(w, h)` の順

## 8. 決定記録

| # | 論点 | 決定 | 理由 |
| :--- | :--- | :--- | :--- |
| 1 | `state` の持続性 | 累積 | 障害継続などのシナリオを毎ステップ書き直さずに済む。畳み込みで算出するため決定性は保たれる |
| 2 | グループの入れ子 | 許可 | VPC > サブネット等の階層を表現できる |

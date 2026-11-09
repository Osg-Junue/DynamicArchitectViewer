# DynamicArchitectViewer ドキュメント一覧

DynamicArchitectViewer（動的インフラ構成図・画面遷移図フレームワーク）のコンセプト、システムアーキテクチャ、およびDSL仕様に関する設計ドキュメントです。

---

## ディレクトリ構成

| カテゴリ | ドキュメント | 概要 |
| :--- | :--- | :--- |
| **01. コンセプト** | [01-concept/vision-and-goals.md](./01-concept/vision-and-goals.md) | 解決する課題、コアバリュー、コード記述×100%自動レイアウトの思想 |
| **02. アーキテクチャ** | [02-architecture/dsl-core.md](./02-architecture/dsl-core.md) | DSL コア（パーサー・検証・補完・フォーマッタ）の設計 |
| **02. アーキテクチャ** | [02-architecture/auto-layout.md](./02-architecture/auto-layout.md) | 自動レイアウトのルール（列・行の決め方、交差の削減、変更時に守る条件） |
| **02. アーキテクチャ** | [02-architecture/single-file-html.md](./02-architecture/single-file-html.md) | 統一レンダリング・単一HTMLバンドル構造・ラウンドトリップ再編集の設計 |
| **02. アーキテクチャ** | [02-architecture/vscode-extension.md](./02-architecture/vscode-extension.md) | VS Code 拡張機能（LSP相当機能・Webview連携・Vanilla TS UI）の設計 |
| **03. 仕様** | [03-specification/dsl-v1.md](./03-specification/dsl-v1.md) | DSL v1 言語仕様（文法 EBNF・意味規則・属性・アイコン） |
| **05. ロードマップ** | [05-roadmap/productization-strategy.md](./05-roadmap/productization-strategy.md) | 製品化方針、製品原則、マイルストーン |
| **05. ロードマップ** | [05-roadmap/publishing.md](./05-roadmap/publishing.md) | Marketplace の公開手順とバージョン方針 |
| **05. ロードマップ** | [05-roadmap/expressiveness-decisions.md](./05-roadmap/expressiveness-decisions.md) | 分岐シナリオとシーケンス図の採否、分岐の構文案 |
| **参考: プロトタイプ** | [prototype/](./prototype/) | 凍結済みプロトタイプのシステム構成と旧 DSL 仕様（製品版とは互換性なし） |

---

## リポジトリ全体構成

```text
DynamicArchitectViewer/
├── package.json                 # モノレポルート (npm workspaces, Node >=26.0.0)
├── biome.json                   # Lint + Format 設定（apps/prototype は対象外）
├── .vscode/launch.json          # VS Code Extension Development Host 起動設定 (F5)
├── .github/workflows/ci.yml     # CI（lint / typecheck / unit & property tests / package）
├── .node-version                # Node.js バージョン指定 (26.13.0)
├── examples/                    # サンプル .dav ファイル群
├── apps/
│   ├── vscode/                  # 製品版 VS Code 拡張機能パッケージ (Vanilla TS / Zero React)
│   │   ├── package.json         # VS Code 拡張マニフェスト
│   │   ├── syntaxes/            # .dav TextMate 文法定義
│   │   └── src/
│   │       ├── model/           # AST 型・内蔵アイコンカタログ
│   │       ├── dsl/             # Lezer パーサー・検証・補完・フォーマッタ
│   │       ├── layout/          # トポロジ階層ベースの 100% 自動レイアウト
│   │       ├── scene/           # ステップ状態解決・幾何計算・DOM非依存シーン構築
│   │       ├── runtime/         # 共通プレイヤーランタイム (Visual Studio 風上部再生バー)
│   │       ├── exporter/        # SHA-256 CSP 付単一HTML出力 & 再インポート
│   │       ├── prompt/          # AI エージェント用 DSL v1 仕様プロンプト生成
│   │       ├── protocol/        # Extension Host ⇄ Webview メッセージ型定義
│   │       ├── extension/       # VS Code Extension Host (診断・補完・整形・Webview管理)
│   │       └── editor/          # Vanilla TS Webview UI
│   └── prototype/               # 凍結済みプロトタイプ（挙動の参照実装。変更しない）
└── docs/                        # 本ドキュメント群
    ├── 01-concept/
    ├── 02-architecture/
    ├── 03-specification/
    ├── 05-roadmap/
    └── prototype/
```

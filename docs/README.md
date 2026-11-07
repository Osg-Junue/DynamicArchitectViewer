# DynamicArchitectViewer ドキュメント一覧

DynamicArchitectViewer（動的インフラ構成図・画面遷移図フレームワーク）のコンセプト、システムアーキテクチャ、およびDSL仕様に関する設計ドキュメントです。

---

## ディレクトリ構成

| カテゴリ | ドキュメント | 概要 |
| :--- | :--- | :--- |
| **01. コンセプト** | [01-concept/vision-and-goals.md](./01-concept/vision-and-goals.md) | 解決する課題、コアバリュー、AIエージェント×人間GUIの協調ワークフロー |
| **02. アーキテクチャ** | [02-architecture/dsl-core.md](./02-architecture/dsl-core.md) | DSL コア（パーサー・検証・非破壊編集・フォーマッタ）の設計 |
| **02. アーキテクチャ** | [02-architecture/single-file-html.md](./02-architecture/single-file-html.md) | 単一HTMLバンドル構造とラウンドトリップ再編集（プロトタイプ時点。M2 で改訂） |
| **03. 仕様** | [03-specification/dsl-v1.md](./03-specification/dsl-v1.md) | DSL v1 言語仕様（文法 EBNF・意味規則・属性・アイコン） |
| **04. 運用** | [04-operations/cloud-run-deploy.md](./04-operations/cloud-run-deploy.md) | Cloud Run / Terraform によるインフラ管理、デプロイ、ロールバック |
| **05. ロードマップ** | [05-roadmap/productization-strategy.md](./05-roadmap/productization-strategy.md) | 製品化方針、製品原則、マイルストーン M0〜M5 |
| **参考: プロトタイプ** | [prototype/](./prototype/) | 凍結済みプロトタイプのシステム構成と旧 DSL 仕様（製品版とは互換性なし） |

---

## リポジトリ全体構成

```text
DynamicArchitectViewer/
├── package.json                 # モノレポルート (npm workspaces) / Biome / check スクリプト
├── biome.json                   # Lint + Format 設定（apps/prototype は対象外）
├── Dockerfile                   # Cloud Run 用コンテナ（nginx-unprivileged で静的配信）
├── deploy/nginx/                # nginx 設定（SPA フォールバック・キャッシュ・セキュリティヘッダ）
├── infra/terraform/             # GCP（Cloud Run 等）と GitHub 設定の Terraform
├── .github/workflows/ci.yml     # CI（check / build / コンテナスモークテスト）+ Cloud Run デプロイ
├── .node-version                # Node.js 26.13.0
├── apps/
│   ├── web/                     # 製品版 Web アプリ（src/model, src/dsl: DSL v1 コア）
│   └── prototype/               # 凍結済みプロトタイプ（挙動の参照実装。変更しない）
│       └── src/
│           ├── core/            # DSLパーサー、双方向シリアライザ、自動レイアウト、アイコン定義
│           ├── viewer/          # ステップ状態解決・3次ベジェ曲線・アニメーション計算
│           ├── exporter/        # 単一HTML出力（Exporter）＆ 再読込（Importer）
│           └── editor/          # WebオーサリングUI（DSLエディタ / SVGキャンバス / インスペクタ）
└── docs/                        # 本ドキュメント群
    ├── 01-concept/
    ├── 02-architecture/
    ├── 03-specification/
    ├── 04-operations/
    ├── 05-roadmap/
    └── prototype/
```

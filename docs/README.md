# DynamicArchitectViewer ドキュメント一覧

DynamicArchitectViewer（動的インフラ構成図・画面遷移図フレームワーク）のコンセプト、システムアーキテクチャ、およびDSL仕様に関する設計ドキュメントです。

---

## ディレクトリ構成

| カテゴリ                   | ドキュメント                                                                     | 概要                                                                             |
| :------------------------- | :------------------------------------------------------------------------------- | :------------------------------------------------------------------------------- |
| **01. コンセプト**         | [01-concept/vision-and-goals.md](./01-concept/vision-and-goals.md)               | 解決する課題、コアバリュー、AIエージェント×人間GUIの協調ワークフロー             |
| **02. アーキテクチャ**     | [02-architecture/system-overview.md](./02-architecture/system-overview.md)       | 全体アーキテクチャ、モジュール設計、GUI ⇄ DSL双方向同期、自動レイアウト          |
| **02. アーキテクチャ**     | [02-architecture/single-file-html.md](./02-architecture/single-file-html.md)     | 単一HTML（Single-file HTML）バンドル構造とラウンドトリップ再編集の仕組み         |
| **03. 仕様・リファレンス** | [03-specification/dsl-reference.md](./03-specification/dsl-reference.md)         | Mermaidライク独自DSLの完全文法仕様、アイコン・属性一覧、AIプロンプトテンプレート |
| **04. 運用**               | [04-operations/cloud-run-deploy.md](./04-operations/cloud-run-deploy.md)         | Cloud Run へのデプロイ構成、GCP 初回セットアップ手順、ロールバック               |
| **05. ロードマップ**       | [05-roadmap/productization-strategy.md](./05-roadmap/productization-strategy.md) | 製品化方針、製品原則、マイルストーン M0〜M5                                      |

> [!NOTE]
> 01〜03 はプロトタイプ（`apps/prototype`）時点の内容です。製品版（`apps/web`）では DSL v1 として再設計するため、M1 完了時に改訂します。

---

## リポジトリ全体構成

```text
DynamicArchitectViewer/
├── package.json                 # モノレポルート (npm workspaces) / Biome / check スクリプト
├── biome.json                   # Lint + Format 設定（apps/prototype は対象外）
├── Dockerfile                   # Cloud Run 用コンテナ（nginx-unprivileged で静的配信）
├── deploy/nginx/                # nginx 設定（SPA フォールバック・キャッシュ・セキュリティヘッダ）
├── .github/workflows/ci.yml     # CI（check / build / コンテナスモークテスト）+ Cloud Run デプロイ
├── .node-version                # Node.js 26.13.0
├── apps/
│   ├── web/                     # 製品版 Web アプリ（M0 時点では雛形）
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
    └── 05-roadmap/
```

# 統一レンダリング・単一HTMLバンドル・再編集アーキテクチャ (M2)

## 1. 設計原則

製品版（M2）では、プロトタイプで発生していた「Webアプリ本体と出力HTMLで描画エンジンが二重管理される問題」および「出力HTMLへのXSS混入リスク」を排除するため、以下の原則を採用しています。

1. **単一描画エンジン（Single Rendering Engine）**:
   - VS Code Webview のプレビュー（`apps/vscode/src/editor/App.ts`）と単一HTML出力は、**同一のレイアウト・シーン解決・ランタイムコード**（`src/layout` + `src/scene` + `src/runtime`）を共有します。
   - プレビューと出力HTMLの任意のステップにおける `.dav-scene` のSVG DOM構造は100%一致します（Playwright E2Eテストで検証）。
2. **完全オフライン・ゼロ外部依存**:
   - 外部CDN（スクリプト、フォント、アイコン画像）へのHTTPリクエストを一切発生させません。
   - ローカルディスク上の `file://` プロトコルで直接開いた場合でも、CORSエラーやスクリプトブロックを起こさず動作します。
3. **厳格なCSPとXSS耐性**:
   - ユーザー文字列（タイトル、ラベル、バッジ、ステップ説明、DSL原文）はすべてJSONデータとして `<script type="application/json" id="dav-data">` に格納され、`</script>` や `<!--` を形成し得ないよう `\u003c` / `\u003e` / `\u0026` / `\u2028` / `\u2029` にエスケープされます。
   - ランタイム（`Player`）の描画は `createElementNS` / `textContent` / `setAttribute` と CSSOM（`element.style`）のみを使用し、`innerHTML` やインライン `style` 属性を一切使用しません。
   - 出力HTMLにはインライン `<script>` と `<style>` のSHA-256ハッシュのみを許可する厳格な `Content-Security-Policy`（`'unsafe-inline'` 不使用）が付与されます。
4. **ラウンドトリップ再編集性（Re-importability）**:
   - 出力された `.html` ファイル自体をプロジェクト保存ファイルとして扱えます。`importContent` により、元のDSLテキスト（コメントやインデントを含む）を1文字の欠損もなく復元できます。

---

## 2. モジュール構成と責務分担

```text
apps/vscode/src/
├── layout/                      # 純粋関数 computeLayout(doc) → Layout (座標・サイズ確定)
├── scene/                       # DOM非依存のシーン解決・SVG仮想ノード構築
│   ├── resolve.ts               # resolveView(doc, layout, stepIndex) → ResolvedView
│   ├── geometry.ts              # ポート選択、3次ベジェ曲線、パケット座標補間
│   ├── build.ts                 # buildScene(view) / buildDefs() / buildPacket(packet) → VElement
│   ├── icons.ts                 # 内蔵SVGアイコン定義（外部アセット不要）
│   └── text.ts                  # ラベル折り返し・テキスト幅推定
├── runtime/                     # Webview と単一HTMLの双方で動く軽量プレイヤー
│   ├── player.ts                # Player クラス（SVG DOM描画・アニメーション・操作系）
│   ├── dom.ts                   # VElement → 実SVGElement変換（createElementNSのみ使用）
│   ├── styles.css               # プレイヤー共通スタイル（インラインstyle属性ゼロ）
│   ├── standalone.ts            # 単一HTML用エントリポイント（#dav-data 読込 → Player起動）
│   └── generated/player.js      # Vite IIFEビルド成果物（約41KB minified / 約13KB gzip）
└── exporter/                    # 単一HTML生成・再インポート
    ├── export.ts                # exportHtml(dsl, options) → HTML文字列（SHA-256 CSP付）
    └── import.ts                # importContent(content) → ImportResult
```

---

## 3. 単一HTMLファイルの内部構造

`exportHtml(dsl, options)` が出力するHTMLは以下の構造を持ちます。

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-...'; style-src 'sha256-...'; img-src data:; base-uri 'none'; form-action 'none'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="dynamic-architect-viewer/1">
<title>図タイトル</title>
<style>/* PAGE_STYLES + runtime/styles.css */</style>
</head>
<body>
<script type="application/json" id="dav-data">{"format":"dynamic-architect-viewer","version":1,"locale":"en","dsl":"...","document":{...},"layout":{...}}</script>
<script>/* runtime/generated/player.js (IIFE) */</script>
</body>
</html>
```

### 埋め込みペイロード (`ExportPayload`)

`<script type="application/json" id="dav-data">` には以下のJSONオブジェクトが格納されます。

| フィールド | 型 | 用途 |
| :--- | :--- | :--- |
| `format` | `'dynamic-architect-viewer'` | フォーマット識別子（再インポート時の検証用） |
| `version` | `1` | ペイロードスキーマバージョン |
| `locale` | `'ja' \| 'en'` | `<html lang>` に使う言語（現在の出力は常に `en`。プレイヤーの UI は英語固定） |
| `dsl` | `string` | 元のDSL全文（再インポートの唯一の真実のソース） |
| `document` | `DavDocument` | パース済みASTモデル（単一HTML内でパーサーを同梱せずに即座に再生するため） |
| `layout` | `Layout` | 計算済みレイアウト座標（単一HTML内でレイアウト計算を再実行せず同一配置を保証するため） |

---

## 4. プレイヤーランタイム (`Player`) の機能

- **ステップ再生コントロール**:
  - 「再生」は現在のステップを繰り返し、「全再生」は全ステップを順に再生して先頭へ戻る
  - アニメーションのオン / オフ（オフでは動きを止め、そのステップの状態と使う線をまとめて表示）
  - ステップ選択、ステップ目盛り、Overview へのダイレクトジャンプ
  - 再生速度変更（`0.5x`, `1x`, `1.5x`, `2x`）
  - キーボード操作（`ArrowLeft` / `ArrowRight` でステップ移動、`Space` で再生/一時停止、`Home` で全体ビュー）
- **アニメーションフェーズ**:
  - 各ステップ内の `animate` 文を順番（直列フェーズ）または `parallel: true`（前フェーズと並列）で再生
  - OSの `prefers-reduced-motion: reduce` 設定時はアニメーションを常にオフにする（ノードのクリックでフェーズのパケットを経路上に静止表示）
- **キャンバスナビゲーション**:
  - ポインタドラッグによるパン、ホイールおよび `−` / `+` ボタンによるズーム、`Fit` ボタンによる全体フィット、再生中のパケットへの追従

---

## 5. ラウンドトリップ再インポート (`importContent`)

`importContent(content)` は受け取ったファイル内容を以下のように判定・抽出します。

1. 先頭が `<!doctype html` または `<html` で始まらない場合、プレーンなDSLテキスト（`source: 'dsl'`）としてそのまま受理します。
2. HTMLファイルの場合、`<script type="application/json" id="dav-data">` を抽出しJSONパースします（HTMLやスクリプトとしては一切評価・実行しません）。
3. `payload.format === 'dynamic-architect-viewer'`、`payload.version <= 1`、`typeof payload.dsl === 'string'` を検証し、通過した場合のみ `payload.dsl`（`source: 'html'`）を返します。
4. 検証失敗時は理由コード（`'unrecognized-html'` / `'unsupported-version'` / `'corrupt'`）を返し、不正なHTMLの読み込みを拒否します。

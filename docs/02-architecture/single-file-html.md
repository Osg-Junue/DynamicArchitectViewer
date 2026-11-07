# 単一HTMLバンドル構造と再編集仕様 (Single-file HTML Architecture)

## 1. 設計要件

生成物である単一HTMLファイル（Standalone HTML）は以下の要件を満たす必要があります。

1. **完全オフライン・ゼロ外部依存**:
   - 外部CDN（JavaScriptライブラリ、Webフォント、外部アイコン画像）へのHTTPリクエストを一切発生させないこと。
   - ローカルディスク上の `file://` プロトコルで直接開いた場合でも、CORSエラーやスクリプトブロックを起こさず100%動作すること。
2. **軽量性**:
   - エディタ用の重いフレームワーク（React等）を出力HTMLにバンドルせず、数十KBの軽量な再生専用ランタイム（Vanilla JS + CSS + インラインSVG）のみを埋め込むこと。
3. **ラウンドトリップ再編集性（Re-importability）**:
   - 出力された `.html` ファイル自体をプロジェクト保存ファイルとしても扱えるようにし、エディタの「HTML/DSL読込」から読み込むだけで元のDSLと図を完全に復元・再編集できること。

---

## 2. 単一HTMLファイルの内部構造

`generateStandaloneHtml(model, dslText)` が出力するHTMLは以下の4層構造を持っています。

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>図タイトル - DynamicArchitectViewer</title>
  <!-- 1. インラインCSS（レイアウト + アニメーションKeyframes） -->
  <style>
    /* Viewer UI Styles + VIEWER_SHARED_CSS */
  </style>
</head>
<body>
  <!-- 2. ビューアDOMシェル（トップバー + SVGビューポート + 下部ステッププレイヤードック + DSL表示モーダル） -->
  <div class="app-shell">
    ...
  </div>

  <!-- 3. ラウンドトリップ用 埋め込みデータブロック -->
  <script id="dav-dsl-source" type="text/plain">
    diagram "..."
    ...（元のDSLテキスト全文）
  </script>
  <script id="dav-model-json" type="application/json">
    {"model": {...}, "icons": {...}}
  </script>

  <!-- 4. 自己完結型 Vanilla JS 再生ランタイム -->
  <script>
    (function() {
      // JSONデータの読み込み、SVGレンダリング、60fpsベジェ曲線パケット再生、
      // パン/ズーム制御、キーボードショートカット（← / → / Space）制御
    })();
  </script>
</body>
</html>
```

---

## 3. 単一HTMLビューアに内蔵される機能

配布先のユーザーは、ブラウザでHTMLファイルを開くだけで以下の操作を行えます。

- **ステップ再生コントロール**:
  - 自動再生 / 一時停止（ステップ内の全アニメーションフェーズ完了後、自動で次のステップへ遷移してループ再生）
  - 前のステップ / 次のステップ移動（キーボードの `←` / `→` / `Space` キーにも対応）
  - 再生速度の変更（`0.7x`, `1.0x`, `1.5x`, `2.0x`）
  - 任意のStepピル（または「全体図」モード）へのダイレクトジャンプ
- **キャンバスナビゲーション**:
  - マウスドラッグによるパン（画面移動）
  - マウスホイールおよび `+` / `-` ボタンによるズーム
  - 「全体フィット」ボタンによる自動センタリング＆スケール調整
- **DSLソースの閲覧・コピー**:
  - 右上の「DSLソース」ボタンから、埋め込まれているDSL定義をその場で確認・クリップボードへコピー可能。

---

## 4. ラウンドトリップ再インポート (`src/exporter/htmlImporter.ts`)

エディタで `.html` ファイルを読み込んだ際、`extractDslFromImportedContent` は以下の優先順位でDSLを復元します。

1. `<script id="dav-dsl-source" type="text/plain">` タグが存在する場合、その中身をアンエスケープしてそのままエディタへ復元します（コメントや手動フォーマットも100%維持されます）。
2. 万一 `#dav-dsl-source` が存在せず `<script id="dav-model-json" type="application/json">` のみが存在する場合は、埋め込まれた `DiagramModel` JSONから `serializeModelToDsl` によってDSLを再構築します。
3. プレーンテキストファイル（`.dav` / `.txt`）が読み込まれた場合は、そのままDSLテキストとして読み込みます。

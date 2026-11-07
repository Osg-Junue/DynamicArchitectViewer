# VS Code 拡張機能アーキテクチャ

## 1. 概要

DynamicArchitectViewer は軽量な VS Code 拡張機能（`apps/vscode`）として提供されます。
AI エージェント（Claude Code / Antigravity / GitHub Copilot 等）や人間がワークスペース内の `.dav` ファイルを記述・編集すると、VS Code ネイティブの言語サポートと横分割のライブプレビュー Webview がリアルタイムに連携します。

---

## 2. コンポーネント構成

```text
apps/vscode/
├── package.json                 # VS Code 拡張マニフェスト (Node >=26.0.0)
├── language-configuration.json  # コメント (//)・括弧・折りたたみ設定
├── syntaxes/
│   └── dav.tmLanguage.json      # TextMate シンタックスハイライト定義
└── src/
    ├── model/                   # AST 型・内蔵アイコンカタログ (18種)
    ├── dsl/                     # Lezer パーサー・検証・補完計算・フォーマッタ
    ├── layout/                  # トポロジ & グループ階層からの 100% 自動レイアウト
    ├── scene/                   # ステップ状態解決・幾何計算・DOM非依存シーン構築
    ├── runtime/                 # 共通プレイヤーランタイム (上部再生バー・SVG描画)
    ├── exporter/                # SHA-256 CSP 付単一HTML出力 & 再インポート
    ├── prompt/                  # AI エージェント用 DSL v1 仕様プロンプト生成
    ├── protocol/                # Extension Host ⇄ Webview 間の型付きメッセージ定義
    ├── extension/               # VS Code Extension Host (Node.js)
    └── editor/                  # Vanilla TS 製 Webview UI (ゼロ React 依存)
```

---

## 3. Extension Host 側の機能 (`src/extension/extension.ts`)

1. **リアルタイム診断 (`DiagnosticCollection`)**:
   - `.dav` ファイルのオープン・変更時に `parse(doc.getText()).diagnostics` を実行し、VS Code の「問題 (Problems)」パネルおよびエディタ上の波線として表示します。
2. **Quick Fix (`CodeActionProvider`)**:
   - アイコン名やステータスのタイポ等で `d.suggestion` が存在する場合、`Ctrl+.`（`⌘.`）で1クリック修正アクションを提供します。
3. **コンテキスト認識補完 (`CompletionItemProvider`)**:
   - `computeCompletions(text, offset, true)` により、定義済みノード/グループ ID、キーワード、属性名、アイコン名（18種）、ステータス値（5種）を補完します。
4. **ドキュメント整形 (`DocumentFormattingEditProvider`)**:
   - `Shift+Alt+F` または保存時フォーマットにより、コメントを保持したまま `format(text)` で `.dav` ファイルを整形します。
5. **アウトライン・パンくずリスト (`DocumentSymbolProvider`)**:
   - グループ、ノード、ステップを VS Code の Outline ビューおよびエディタ上部の Breadcrumbs に表示します。
6. **コマンド**:
   - `dav.openPreview`: アクティブな `.dav` エディタの横にライブプレビュー Webview を開く（`Ctrl+Shift+V` / `Cmd+Shift+V` またはエディタ右上のプレビューアイコン）。
   - `dav.exportHtml`: 現在の `.dav` からゼロ外部依存・SHA-256 CSP 付の単一 `.html` ファイルを出力。
   - `dav.importHtml`: 出力済み `.html` ファイルから埋め込み `.dav` DSL を抽出して新規エディタで開く。
   - `dav.newFromTemplate`: 内蔵サンプルテンプレートから新規 `.dav` 図を作成。
   - `dav.copyAiPrompt`: AI エージェント用 DSL v1 仕様プロンプトをクリップボードにコピー。

---

## 4. Extension Host ⇄ Webview 連携プロトコル (`src/protocol/messages.ts`)

- **エディタ → Webview (`HostToWebviewMessage`)**:
  - `docChanged`: エディタ（または AI エージェントによるファイル書き換え）で `.dav` テキストが変化した際に Webview の自動レイアウトとプレビューを即時更新。
  - `cursorMoved`: エディタ内のカーソル位置オフセットを通知。`findAtOffset(sourceMap, offset)` によりカーソル下のノード/グループをキャンバス上で破線ハイライトし、ステップブロック内にいる場合は自動的にそのステップへ切り替えます。
- **Webview → エディタ (`WebviewToHostMessage`)**:
  - `revealRange`: キャンバス上の要素のダブルクリックから、該当する DSL 定義行へエディタをジャンプ・選択します。
  - `exportHtml` / `formatDocument`: Webview 上部ツールバーから単一HTML出力やフォーマットを実行します。

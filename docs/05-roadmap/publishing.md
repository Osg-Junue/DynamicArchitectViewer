# Marketplace 公開手順

拡張機能（`apps/vscode`）を Visual Studio Marketplace に公開する手順です。

---

## 1. バージョン方針

- 拡張機能のバージョンは [Semantic Versioning](https://semver.org/) に従う
- `0.x` はプレビューとし、`package.json` の `"preview": true` で Marketplace にプレビューと表示する
- 修正はパッチ、機能の追加はマイナーを上げる
- `1.0.0` は実機確認（#8）を終えて安定したと判断した時点で出し、`"preview"` を外す
- DSL のバージョンは別に管理する（[互換性方針](../03-specification/dsl-v1.md#6-互換性方針)）

---

## 2. 初回だけ必要な準備

1. [Marketplace の管理画面](https://marketplace.visualstudio.com/manage)で、ID が `osg-junue` の発行者を作成する
2. Azure DevOps で、スコープに Marketplace (Manage) を含む個人用アクセストークンを作成する
3. `apps/vscode` で次を実行し、トークンを登録する

```bash
npx vsce login osg-junue
```

---

## 3. 公開前の確認

- [ ] 実機確認（#8）が終わっている
- [ ] 初回公開なら、`dav 1` がこの時点で固定されることを確認した（[仕様書 6.1](../03-specification/dsl-v1.md#6-互換性方針)）
- [ ] `apps/vscode/package.json` の `version` と `apps/vscode/CHANGELOG.md` を更新した
- [ ] 公開するコミットがデフォルトブランチにマージされている（README の画像は GitHub の `HEAD` を参照するため）
- [ ] リポジトリのルートで `npm run check` が通る
- [ ] `apps/vscode` で `npx playwright test` が通る

---

## 4. パッケージの作成と確認

リポジトリのルートで実行します。

```bash
npm run package
```

`apps/vscode/dist/dynamic-architect-viewer.vsix` ができます。`.vsix` は ZIP 形式なので、中身を一覧で確認できます。`extension/` の下に次のファイルだけが入っていることを確認します。

| パス | 内容 |
| :--- | :--- |
| `dist/extension.cjs` | Extension Host（依存パッケージを同梱） |
| `dist/webview/` | プレビューの Webview |
| `media/icon.png` | 拡張機能アイコン |
| `syntaxes/`、`language-configuration.json` | 言語定義 |
| `package.json`、`package.nls*.json` | マニフェストと翻訳 |
| `readme.md`、`changelog.md`、`LICENSE.txt` | 文書 |

`src/`、`e2e/`、`node_modules/`、ソースマップが入っていれば `.vscodeignore` を見直します。

---

## 5. 公開

`apps/vscode` で、確認済みの `.vsix` をそのまま公開します。

```bash
npx vsce publish --packagePath dist/dynamic-architect-viewer.vsix
```

公開後、Marketplace のページで README の画像が表示されることを確認し、公開したコミットに `v<version>` のタグを付けます。

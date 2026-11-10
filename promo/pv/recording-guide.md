# PV 撮影ガイド（カット3〜5）

本物の VS Code の操作を録画する部分です。テロップ、早送り表示、カットのつなぎは後で合成するので、録画には何も載せないでください。

## 録画の設定（OBS など）

- 解像度 1920×1080、60fps。ディスプレイが 4K の場合は、VS Code のウィンドウを 1920×1080 にして、そのウィンドウだけを録画する
- 画質は高めに（OBS なら CQP / CRF 16〜18）。音声は不要（マイクとデスクトップ音声はオフ）
- 形式は MKV か MP4。MKV なら、録画が途中で落ちても壊れません

## VS Code の状態

- テーマ：**Dark+**（スタイルフレームと合わせるため）
- 表示言語：日本語版は日本語、英語版は English（後述のとおり2回撮影）
- `window.zoomLevel: 1`、`editor.fontSize: 16`（スマホで見ても読める大きさ）
- ミニマップはオフ、パンくずリストはオフ、通知は「応答不可」にする
- 使っていない拡張機能のパネルやバッジが映らないようにする
- **映ってはいけないもの：** メールアドレス、アカウント名、組織名、ほかのプロジェクト名。Claude Code のパネルにアカウント情報が出ていないか、撮る前に確認する

## 毎回の初期化

撮影の前に、`tiny-orders` を何もない状態に戻します。**必ず `tiny-orders` のフォルダで実行してください。** 別のリポジトリで実行すると、そのリポジトリの未追跡ファイルが消えます。

```bash
cd path/to/tiny-orders
```

```bash
git rev-parse --show-toplevel
```

```bash
git clean -fdn
```

1行目で移動し、2行目でリポジトリの場所が `tiny-orders` のフォルダになっていることを確認します。3行目は**消える予定のファイルを表示するだけ**（実際には消さない）です。表示されるのが `architecture.dav` と `.claude/` だけなら、次を実行します。

```bash
git clean -fd
```

## テイク

操作と操作の間は **1秒ほど止めてください**。編集でつなぐときの余白になります。マウスは、ゆっくり、まっすぐ動かします。

| テイク | 操作 | 目安 |
|---|---|---|
| 3 | エクスプローラーで新規ファイル `architecture.dav` を作る → `Ctrl+Shift+V` でプレビューを横に開く | 10秒 |
| 4 | `Ctrl+Shift+P` → `AI エージェント` と入力 → 「DynamicArchitectViewer: AI エージェントスキルをインストール...」 → Claude Code → ワークスペース | 15秒 |
| 5 | Claude Code のパネルを開いて、下の指示文を貼り付けて送る → 生成とチェッカーが終わり、プレビューに図が出るまで**止めずに**録る | 制限なし |

テイク5は数回撮ってかまいません。使うのは一番良い回で、**生成された `.dav` は手で直しません**。採用した回の `architecture.dav` は、ファイルごと保存しておいてください（カット6以降の再構成に使います）。

### 指示文

日本語版：

```
このリポジトリの構成を architecture.dav に図にして。注文から決済までの正常な流れと、決済プロバイダーが落ちてリトライした末に注文が失敗する流れをステップで見せて。
```

英語版：

```
Diagram this repository's architecture in architecture.dav. Show the normal flow from order to payment, and the flow where the payment provider is down, retries fail and the order fails, as steps.
```

## 渡してほしいもの

- テイク3〜5の録画ファイル（日本語版と英語版）
- 採用した回の `architecture.dav`（日本語版と英語版）

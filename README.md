# HarmoTrail GROWI plugin

HarmoTrailをGROWI（Kiwi）のページ内へ直接表示するscript pluginです。iframeは使用しません。

## ページへの設置

プラグインを有効化したあと、表示したいGROWIページに次のコードブロックを置いて保存します。

````markdown
```harmotrail

```
````

閲覧画面ではコードブロックがHarmoTrailのワークスペースへ置き換わります。アプリはShadow DOM内に描画するため、GROWIとHarmoTrailのCSSは互いに干渉しません。

## Kiwiへのインストール

GROWIは「1 Gitリポジトリ＝1プラグイン」としてインストールします。このフォルダはHarmoTrail本体と同じリポジトリで管理するため、`develop`へのpush時にGitHub Actionsが`growi-plugin`ブランチのルートへプラグインを公開します。

1. GitHub Actionsの「Publish GROWI plugin」が成功したことを確認します。
2. Kiwiの管理画面で「プラグイン」を開きます。
3. リポジトリURL `https://github.com/kazudayo/Chord-Canvas` を入力します。
4. ブランチに `growi-plugin` を指定してインストールします。
5. `growi-plugin-harmotrail` を有効にします。

リポジトリ名を変更した場合は、手順3のURLだけ新しい名前へ置き換えてください。

## 開発とビルド

このフォルダは親リポジトリの `src` を直接取り込んでバンドルします。親リポジトリのルートで実行してください。

```sh
npm ci
npm run build:growi-plugin
```

成果物は `growi-plugin-harmotrail/dist` に生成されます。

## 動作上の注意

- Kiwiへログインし、対象ページを閲覧できるユーザーだけがアプリを開けます。そのためプラグイン版ではHarmoTrail独自のログイン画面を表示しません。
- 曲データは現在のHarmoTrailと同じく、利用者のブラウザの`localStorage`に保存されます。GROWIページや他ユーザーとは自動共有されません。
- Web MIDIはHTTPSかつ対応ブラウザでのみ利用できます。
- MIDIファイル書き出し、内蔵音源、外部MIDI出力を含む既存機能を同じ画面で利用できます。

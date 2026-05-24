# fusenchat

`fusenchat` は、入力したテキストをチャットバブル風の PNG 画像に変換するアプリです。  
Tauri デスクトップアプリとして動作し、同じフロントエンドを Vercel 上の Web 版としても配信できます。

## 概要

- 1 メッセージごとに透過 PNG のバブル画像を生成
- 元テキストを PNG メタデータへ埋め込み
- 生成した PNG を再度読み込んでテキストを復元
- デスクトップ版ではローカル保存、ファイルドラッグアウト、フォルダ表示に対応
- Web 版ではブラウザ内での生成、ダウンロード、メタデータ復元に対応

## 主な機能

- Markdown 記法を反映したバブル画像レンダリング
- 横書き / 縦書きの切り替え
- 解像度 `1x / 2x / 3x` の切り替え
- バブル背景色の変更
- 背景色に応じた文字色の自動切り替え
- システムフォントの選択
- `Enter` 送信、`Shift + Enter` 改行
- IME 変換中の誤送信防止
- PNG ドロップによるテキスト復元
- 画像コピー
- デスクトップ版でのファイルパスコピー、保存先フォルダ表示、削除

## デスクトップ版と Web 版の違い

### デスクトップ版

- Tauri v2 ベース
- 生成 PNG をアプリ管理下のキャッシュへ保存
- ネイティブのファイルドラッグアウトに対応
- 保存先フォルダ表示に対応

### Web 版

- Vercel 上で静的配信
- PNG はブラウザ内で生成
- PNG メタデータの埋め込みと復元はフロントエンド側で処理
- `Download` で画像保存可能
- ブラウザ内ドラッグは可能
- OS のファイルマネージャへ確実なネイティブファイルドラッグアウトは不可

Web 版ではブラウザの制約があるため、デスクトップ版と完全に同じドラッグアウト体験にはできません。

## 技術スタック

- Tauri v2
- React 18
- TypeScript
- Vite
- Rust
- marked

## 開発

依存関係をインストール:

```bash
npm ci
```

フロントエンドをビルド:

```bash
npm run build
```

Tauri 開発起動:

```bash
npm run tauri dev
```

デスクトップ版をビルド:

```bash
npm run tauri build
```

## Vercel デプロイ

このリポジトリには [vercel.json](./vercel.json) が含まれており、Vite の静的サイトとしてデプロイできます。

CLI でデプロイする場合:

```bash
vercel
```

補足:

- `node_modules`、`dist`、`src-tauri/target` は Git 管理しない前提です
- Vercel 版ではブラウザ制約により、デスクトップ版専用の機能は一部利用できません

## GitHub Actions リリース

Windows / macOS 向けのリリース workflow は [.github/workflows/release.yml](./.github/workflows/release.yml) にあります。

- `v*` タグ push でリリースビルドを実行
- Windows は NSIS インストーラを生成
- macOS は DMG を生成

詳細は [docs/github_release_workflow.md](./docs/github_release_workflow.md) を参照してください。

## ライセンス

ライセンス表記が必要であれば、プロジェクト方針に合わせて追記してください。

# Codex実装指示書：fusenchat

## 0. 目的

Tauri v2 + React + TypeScript + Vite で、Windows向けのデスクトップアプリ「fusenchat」を実装してください。

このアプリは、チャットアプリ風UIの入力欄にテキストを入力し、Enterで送信すると、そのテキストを「チャットバブル風PNG画像」として生成・保存し、画面内にチャット履歴のように表示するツールです。

重要なのは、表示されるバブルが単なるDOMではなく、実体のあるPNGファイルとしてキャッシュフォルダに保存され、そのPNGファイルを外部アプリやExplorerへ持ち出せることです。

さらに今回の追加要件として、**出力PNGに元テキストをメタデータとして埋め込み**、そのPNGファイルを**アプリの入力欄にドラッグ＆ドロップしたときにメタデータ内の文字列を読み取り、現在の入力欄の文字列に追加する**機能を実装してください。

---

## 1. アプリ名

アプリ名：

```txt
fusenchat
```

内部プロジェクト名：

```txt
fusenchat
```

メタデータキー、保存フォルダ名、パッケージ名、ウィンドウタイトルも原則として `fusenchat` に統一してください。

---

## 2. 技術スタック

以下を前提に実装してください。

```txt
Tauri v2
React
TypeScript
Vite
Canvas API
@tauri-apps/plugin-fs
@tauri-apps/api/path
@tauri-apps/plugin-opener
@tauri-apps/plugin-clipboard-manager
必要に応じて Rust command
```

PNGメタデータについては、**PNGInfo相当のテキストメタデータ運用**を実装してください。  
実装方法は自由ですが、少なくとも以下を満たしてください。

- PNGファイル内に元テキストを保持できること
- 後からそのPNGを読み込んで元テキストを復元できること
- メタデータの保存と読み出しがアプリ内で完結すること

実装上は、PNGの `tEXt` / `iTXt` チャンクを使う方式でも、Rust側のPNGライブラリを使う方式でも構いません。  
重要なのは **「画像から元文字列を復元できること」** です。

Tauri v2の公式ドキュメントに沿って実装してください。API名や設定名を推測で書かず、実際に使えるものを確認しながら実装してください。

---

## 3. アプリの基本仕様

### 3.1 ユーザーフロー

1. アプリを起動する
2. 下部の入力欄にテキストを入力する
3. Enterを押す
4. 入力テキストがチャットバブル風PNG画像として生成される
5. PNGがローカルのキャッシュフォルダに保存される
6. そのPNGには元テキストがメタデータとして埋め込まれる
7. 保存されたPNGが会話エリアに右寄せバブルとして表示される
8. ユーザーはそのバブル画像をドラッグ、または右クリック操作で外部利用できる
9. 外部からPNGを入力欄へドロップすると、画像内メタデータからテキストを読み出し、入力欄へ追加できる

---

## 4. UI仕様

### 4.1 全体デザイン

ダークテーマのチャットアプリ風UIにしてください。

画面イメージ：

```txt
┌──────────────────────────────┐
│ fusenchat                  │
├──────────────────────────────┤
│                              │
│                              │
│                    ┌──────┐  │
│                    │docsに│  │
│                    │沿って│  │
│                    │作って│  │
│                    └──────┘  │
│                              │
├──────────────────────────────┤
│ [ Ask for follow-up changes ] │
│                         [↑]  │
└──────────────────────────────┘
```

### 4.2 レイアウト

- 上部：簡易タイトルバー風ヘッダー
- 中央：会話エリア
- 下部：入力エリア
- 入力エリアは下部固定
- 会話エリアは縦スクロール可能
- 生成されたバブルは右寄せで縦に並べる
- 新しいバブルは下に追加する
- 生成後は最下部まで自動スクロールする

### 4.3 色・雰囲気

MVPでは以下のような見た目にしてください。

```txt
アプリ背景：#151515
ヘッダー背景：#303030
入力欄背景：#2c2c2c
入力文字：#ffffff
プレースホルダー：#777777
バブル背景：#2f2f2f
バブル文字：#ffffff
```

細部は調整して構いませんが、黒背景＋右寄せグレーバブルのチャットUIに寄せてください。

### 4.4 入力欄のドロップ受け入れUI

入力欄は、テキスト入力だけでなく**PNGファイルのドロップターゲット**にもしてください。

要件：

- PNGファイルを入力欄上にドラッグしたとき、視覚的に「ドロップ可能」とわかるハイライトを出す
- ドロップ時に、そのPNGからメタデータ文字列を読む
- 読み出した文字列を、**現在入力欄に入っている文字列に追加**する
- 既存文字列を消さず、追記する
- 複数ファイルドロップ時は、順番に追記してよい
- メタデータがないPNGは無視するか、軽いエラー表示を出す

---

## 5. 入力仕様

### 5.1 入力欄

- textareaを使用してください
- 日本語入力に対応してください
- 複数行入力可能にしてください
- プレースホルダーは以下にしてください

```txt
Ask for follow-up changes
```

または日本語UIに寄せる場合：

```txt
ここに入力して Enter で画像化
```

### 5.2 キーボード操作

必須：

| 操作 | 挙動 |
|---|---|
| Enter | 送信＋画像化 |
| Shift + Enter | 改行 |
| IME変換中のEnter | 送信せず、IME確定を優先 |

重要：
日本語入力中にEnterを押したとき、IME変換確定で送信されないようにしてください。ReactのKeyboardEventで `event.nativeEvent.isComposing` または同等の状態を見て制御してください。

### 5.3 送信後

- 入力欄を空にする
- 空文字、空白のみの場合は送信しない
- 生成したバブルを会話エリア末尾に追加する

### 5.4 PNGドロップ時のテキスト追記仕様

PNGを入力欄にドロップした場合の仕様：

- PNGのメタデータから元テキストを取得する
- 入力欄にすでに文字がある場合、**その末尾に追加する**
- 追加時は読みやすさのため、必要に応じて `\n` を挟んでよい
- 例：
  - 現在の入力欄: `既存の文`
  - ドロップしたPNGのメタデータ文字列: `追加する文`
  - 結果: `既存の文\n追加する文`
- 空欄の場合はそのまま挿入する
- 複数PNGがドロップされた場合は、順に追記する

---

## 6. 画像生成仕様

### 6.1 基本方針

画面全体のスクリーンショットではなく、入力テキストから「チャットバブル単体のPNG」を生成してください。

DOMをスクショするのではなく、Canvas APIで直接描画する方式をMVPの第一候補としてください。

### 6.2 出力形式

```txt
PNG
背景透明
1メッセージ = 1 PNGファイル
```

### 6.3 バブル画像の見た目

バブル単体PNGは以下の仕様にしてください。

```txt
背景：透明
バブル色：#2f2f2f
文字色：#ffffff
フォント：Yu Gothic UI, Meiryo, sans-serif
フォントサイズ：24px
行間：1.4
角丸：18px〜24px程度
左右余白：24px〜32px
上下余白：16px〜24px
最大幅：520px程度
最小幅：テキスト幅 + padding
高さ：テキスト量に応じて自動可変
```

### 6.4 折り返し

日本語テキストが自然に折り返されるようにしてください。

要件：

- Canvasの `measureText` を使って行幅を計算する
- 最大幅を超える場合は折り返す
- 日本語は単語区切りがないため、必要に応じて文字単位で折り返す
- 改行文字 `\n` は明示的な改行として扱う
- Shift+Enterで入力された改行は、画像内でも改行として反映する

### 6.5 Canvas生成フロー

実装例の流れ：

```txt
input text
↓
normalize text
↓
split lines by newline
↓
wrap each line by max text width
↓
calculate canvas width/height
↓
create offscreen canvas
↓
draw rounded rectangle
↓
draw text lines
↓
canvas.toBlob("image/png")
↓
Uint8Array化
↓
Tauri経由でキャッシュフォルダへ保存
↓
PNGメタデータ埋め込み
↓
表示用URL/パスをstateへ追加
```

---

## 7. PNGメタデータ仕様（重要）

### 7.1 目的

出力されたPNGから、後で元の文字列を復元できるようにしてください。

### 7.2 必須要件

- 生成したPNGに、元テキストをメタデータとして埋め込むこと
- そのPNGをアプリにドロップしたとき、埋め込まれた文字列を取得できること
- 可逆的であること（少なくとも通常のテキストについて復元可能）

### 7.3 推奨メタデータキー

以下のような独自キーを使ってください。

```txt
fusenchat:text
```

必要なら追加キーも使ってよいです。

例：

```txt
fusenchat:text
fusenchat:createdAt
fusenchat:app
```

### 7.4 保存内容

最低限、以下を保存してください。

```txt
元テキスト
作成日時
アプリ識別子（任意）
```

例：

```json
{
  "text": "docsに沿って作って",
  "createdAt": "2026-05-22T15:30:12.123+09:00",
  "app": "fusenchat"
}
```

ただしメタデータ格納方式は自由です。  
たとえば以下のどちらでも構いません。

- `fusenchat:text` に元文字列をそのまま入れる
- `fusenchat:payload` にJSON文字列を入れる

**実装のしやすさを優先してください。**

### 7.5 実装方針

フロントエンドのCanvasから生成したPNG Blobに対して、保存前または保存時にメタデータを埋め込んでください。

候補：

- Rust側でPNGを書き直して `tEXt` / `iTXt` を埋め込む
- JavaScript側ライブラリでPNGチャンクを編集する
- 画像保存専用のRust commandを作り、PNG bytes + text payload を渡して、Rust側でメタデータ付きPNGとして保存する

**推奨：Rust側で確実にメタデータを付与する実装**  
理由：ファイル保存とPNGチャンク編集をまとめやすく、後で読み出しもRust側で一貫して扱いやすいため。

### 7.6 読み出し仕様

アプリへPNGがドロップされたとき：

- ドロップされたファイルがPNGか確認する
- PNGメタデータを読む
- `fusenchat:text` または対応キーから元文字列を取得する
- 取得成功したら入力欄へ追記する
- 取得失敗したら、そのファイルはスキップまたは軽いエラー表示

---

## 8. 保存仕様

### 8.1 保存先

生成PNGはアプリ管理下のキャッシュフォルダに保存してください。

保存先の考え方：

```txt
AppData/Local/fusenchat/cache/bubbles/
```

実装上はTauriのpath APIやfs pluginで扱いやすい場所を使って構いません。

### 8.2 ファイル名

以下の形式で重複しないファイル名にしてください。

```txt
bubble_YYYYMMDD_HHmmss_SSS.png
```

例：

```txt
bubble_20260522_153012_123.png
```

必要ならランダムIDを足してください。

```txt
bubble_20260522_153012_123_ab12cd.png
```

### 8.3 履歴保存

MVPでは履歴の永続保存は不要です。

やらないこと：

```txt
library.jsonを作らない
起動時に過去のキャッシュ画像を復元しない
生成履歴を永続化しない
```

ただし、アプリ起動中はReact state上で生成済みバブル一覧を保持してください。

---

## 9. データ構造

TypeScript側では以下のような型を使ってください。

```ts
export type BubbleItem = {
  id: string;
  text: string;
  filePath: string;
  previewSrc: string;
  createdAt: string;
  width: number;
  height: number;
};
```

必要なら、PNGメタデータ用のpayload型も定義してください。

```ts
export type FusenchatPngMetadata = {
  text: string;
  createdAt: string;
  app?: string;
};
```

---

## 10. 表示仕様

### 10.1 会話エリア

- `BubbleItem[]` を縦に表示する
- 各バブルは右寄せ
- 画像を `<img>` で表示する
- 表示される画像は、生成済みPNGファイルのプレビューである
- 画像サイズが大きすぎる場合はCSSで縮小表示してよい
- 実ファイルは元サイズのまま保持する

### 10.2 バブルカード操作

各バブルに以下の操作を実装してください。

優先度A：

```txt
削除
フォルダで表示
```

優先度B：

```txt
ファイルパスをコピー
画像をコピー
外部ドラッグアンドドロップ
```

---

## 11. ドラッグアンドドロップ仕様

### 11.1 目的

生成されたバブルPNGを、アプリ外へファイルとして持ち出せるようにしてください。

想定先：

```txt
Windows Explorer
Clip Studio Paint
Photoshop
Discord
ブラウザ
その他画像を受け取れるアプリ
```

### 11.2 アプリ外へ出すドラッグ

MVPでは、まずHTML5 Drag and Dropで以下を試してください。

```ts
event.dataTransfer?.setData("text/plain", filePath);
event.dataTransfer?.setData("text/uri-list", fileUri);
```

可能であれば、ドラッグ対象がファイルとして認識されるようにしてください。

Tauri v2 / WebView2 / Windowsでは、HTML5の外部ドラッグ挙動に制限や環境差がある可能性があります。そのため、ドラッグアウトが完全に動作しない場合でもMVPを止めないでください。

### 11.3 入力欄へのドロップ

入力欄にはPNGファイルのドロップ受け入れを実装してください。

要件：

- `dragover` で `preventDefault()` してドロップ可能にする
- `drop` でファイル一覧を取得する
- PNGのみを対象にする
- 各PNGについてメタデータを読む
- 取得した文字列を現在のtextarea valueに追記する
- 追記後、キャレット位置やスクロールも自然に扱う

### 11.4 Tauri設定注意

WindowsでHTML5 drag and dropを使う場合、Tauriのwindow設定で以下を検討してください。

```json
{
  "app": {
    "windows": [
      {
        "dragDropEnabled": false
      }
    ]
  }
}
```

### 11.5 代替操作

ドラッグアウトが不安定な場合に備えて、以下は必ず実装してください。

```txt
フォルダで表示
ファイルパスをコピー
画像をコピー
```

MVPの合格条件は、最低限「生成されたPNGをフォルダで表示でき、そこから外部利用できる」ことです。

---

## 12. Tauri / Rust側要件

### 12.1 必要な機能

Rust側またはTauri pluginで以下を実現してください。

```txt
キャッシュフォルダ作成
メタデータ付きPNG保存
PNG削除
保存先フォルダを開く
ファイルパスをクリップボードへコピー
必要に応じて画像をクリップボードへコピー
PNGメタデータ読み出し
```

### 12.2 推奨実装

できるだけTauri公式pluginを使ってください。

候補：

```txt
@tauri-apps/plugin-fs
@tauri-apps/api/path
@tauri-apps/plugin-opener
@tauri-apps/plugin-clipboard-manager
```

必要に応じてRust commandを追加して構いません。

特に以下の2つはRust commandで実装するのが有力です。

```txt
save_bubble_png_with_metadata(bytes, metadata)
read_bubble_png_metadata(file_path)
```

### 12.3 フォルダで表示

MVPでは「ファイルを選択状態でExplorerに表示」までできなくてもよいです。

最低条件：

```txt
PNGが保存されているフォルダを開ける
```

---

## 13. 推奨ディレクトリ構成

```txt
fusenchat/
  package.json
  index.html
  src/
    main.tsx
    App.tsx
    styles.css
    types.ts
    lib/
      bubbleRenderer.ts
      fileUtils.ts
      pngMetadata.ts
      dateUtils.ts
    components/
      Header.tsx
      ChatArea.tsx
      BubbleCard.tsx
      InputPanel.tsx
  src-tauri/
    Cargo.toml
    tauri.conf.json
    src/
      main.rs
      png_metadata.rs
```

---

## 14. 実装詳細

### 14.1 `bubbleRenderer.ts`

責務：

```txt
テキストをCanvasでチャットバブルPNGに変換する
```

必要な関数例：

```ts
export type RenderBubbleOptions = {
  maxWidth?: number;
  fontSize?: number;
  fontFamily?: string;
  lineHeight?: number;
  paddingX?: number;
  paddingY?: number;
  radius?: number;
  bubbleColor?: string;
  textColor?: string;
};

export type RenderedBubble = {
  blob: Blob;
  width: number;
  height: number;
};

export async function renderBubbleToPng(
  text: string,
  options?: RenderBubbleOptions
): Promise<RenderedBubble>;
```

### 14.2 `pngMetadata.ts`

責務：

```txt
PNGメタデータのpayload型定義
フロントエンドとRust commandの橋渡し
ドロップされたPNGのメタデータ読取呼び出し
```

必要な関数例：

```ts
export type FusenchatPngMetadata = {
  text: string;
  createdAt: string;
  app?: string;
};

export async function readMetadataFromPng(filePath: string): Promise<FusenchatPngMetadata | null>;
```

### 14.3 `fileUtils.ts`

責務：

```txt
BlobをUint8Arrayに変換する
PNGをキャッシュフォルダに保存する
保存時にメタデータを一緒に渡す
保存済みファイルの表示用URLを作る
フォルダを開く
ファイル削除
```

必要な関数例：

```ts
export async function saveBubblePngWithMetadata(
  blob: Blob,
  fileName: string,
  metadata: FusenchatPngMetadata
): Promise<string>;

export async function deleteBubbleFile(filePath: string): Promise<void>;

export async function openBubbleFolder(filePath: string): Promise<void>;

export async function copyFilePath(filePath: string): Promise<void>;
```

### 14.4 `InputPanel.tsx`

責務：

```txt
textarea入力
Enter送信
Shift+Enter改行
IME変換中Enterの誤送信防止
PNGファイルのドロップ受け入れ
PNGメタデータ読取
既存文字列への追記
```

特に重要な仕様：

- ドロップされたPNGから読んだテキストは、**現在の入力欄文字列に追加**
- 追加時はユーザー体験上、必要なら改行区切りにする
- 既存テキストを上書きしない

### 14.5 `ChatArea.tsx`

責務：

```txt
生成済みBubbleItemを縦に表示
最下部への自動スクロール
空状態表示
```

### 14.6 `BubbleCard.tsx`

責務：

```txt
PNG画像表示
右寄せ
削除
フォルダで表示
パスコピー
ドラッグ開始処理
```

---

## 15. CSS仕様

### 15.1 全体

```css
html,
body,
#root {
  width: 100%;
  height: 100%;
  margin: 0;
}

body {
  background: #151515;
  color: #ffffff;
  font-family: "Yu Gothic UI", "Meiryo", sans-serif;
}
```

### 15.2 レイアウト

```css
.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #151515;
}

.header {
  height: 44px;
  background: #303030;
  display: flex;
  align-items: center;
  padding: 0 16px;
}

.chat-area {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px;
}

.input-panel {
  padding: 12px;
  background: #151515;
}

.input-box {
  background: #2c2c2c;
  color: #ffffff;
  border: none;
  border-radius: 12px;
  resize: none;
}
```

入力欄ドラッグ中のハイライト用クラスも追加してください。

---

## 16. エラー処理

### 16.1 入力エラー

```txt
空文字は送信しない
空白のみは送信しない
長文でもクラッシュしない
```

### 16.2 画像生成エラー

```txt
Canvas生成に失敗した場合はエラーを表示
Blob化に失敗した場合はエラーを表示
```

### 16.3 保存エラー

```txt
保存先がなければ作成
保存に失敗したらエラー表示
権限エラーでもアプリが落ちないようにする
```

### 16.4 メタデータエラー

```txt
メタデータ付与に失敗したらエラー表示
メタデータ読み出しに失敗したPNGはスキップ可能
メタデータ未対応PNGをドロップしてもクラッシュしない
```

### 16.5 削除エラー

```txt
ファイル削除に失敗しても、UIはクラッシュさせない
必要ならerror表示またはconsole.errorに出す
```

---

## 17. MVP完成条件

以下を満たしたらMVP完成です。

```txt
Tauriアプリとして起動できる
ダークテーマのチャット風UIになっている
下部入力欄に日本語テキストを入力できる
Enterで送信＋画像化される
Shift+Enterで改行できる
IME変換中Enterで誤送信されない
チャットバブル単体の透明PNGが生成される
PNGがキャッシュフォルダに保存される
生成PNGに元テキストのメタデータが埋め込まれる
生成されたPNGが右寄せバブルとして会話エリアに表示される
送信後に入力欄が空になる
入力欄にPNGをドロップするとメタデータ文字列を読み出せる
ドロップで読んだ文字列は入力欄の既存文字列に追記される
フォルダで表示できる
バブルを削除できる
削除時に対応PNGも削除される
履歴永続化をしない
再起動後は空状態でよい
```

---

## 18. 実装優先順位

### Phase 1：最小UI

```txt
Tauri + React + TypeScript + Vite セットアップ
ダークテーマUI
Header
ChatArea
InputPanel
Enter送信
Shift+Enter改行
```

### Phase 2：画像生成

```txt
Canvasでバブル画像生成
日本語折り返し
透明PNG化
生成結果を画面に表示
```

### Phase 3：ファイル保存＋メタデータ

```txt
キャッシュフォルダ作成
PNG保存
PNGメタデータ埋め込み
保存済みファイルを表示
削除
フォルダで表示
```

### Phase 4：再投入機能

```txt
入力欄へのPNGドロップ
メタデータ読取
既存入力欄への追記
```

### Phase 5：外部利用

```txt
パスコピー
画像コピー
HTML5 drag and drop試験実装
必要ならTauri設定調整
```

---

## 19. やらないこと

MVPでは以下を実装しないでください。

```txt
履歴永続化
library.json
起動時の過去画像復元
ユーザーアカウント
クラウド同期
テンプレート管理
タグ管理
検索
複数プロジェクト管理
AI生成
OCR
スクリーンショット機能
```

---

## 20. 注意点

- 画像化するのはアプリ画面ではなく、バブル単体です。
- 1発言につき1PNGファイルです。
- PNGは背景透明にしてください。
- UI表示とPNG生成結果の見た目はなるべく近づけてください。
- ただし、DOMスクショではなくCanvas描画を優先してください。
- ドラッグアウトは環境差があるので、実装できる範囲でよいです。
- ドラッグアウトが不完全でも、フォルダで表示できればMVPとして成立します。
- 日本語IME中のEnter誤送信は必ず防いでください。
- 履歴保存は不要です。
- 再起動後は空で問題ありません。
- **PNGメタデータへの元テキスト保存は必須です。**
- **入力欄へのPNGドロップでテキスト復元＋追記は必須です。**

---

## 21. 最初にCodexにやってほしいこと

既存コードがある場合：

```txt
現在の構成を確認し、上記仕様に合わせて必要なファイルを作成・修正してください。
```

既存コードがない場合：

```txt
Tauri v2 + React + TypeScript + Vite の最小プロジェクトとして実装してください。
```

最初のゴール：

```txt
Enterで入力テキストがチャットバブルPNGになり、画面に表示され、キャッシュフォルダにもメタデータ付きで保存されるところまで完成させてください。
```

次のゴール：

```txt
そのPNGを入力欄にドロップすると、埋め込まれた元テキストを読み出し、現在の入力欄の末尾に追記できるようにしてください。
```

---

## 22. 参考実装観点

Codexは実装時に以下を重視してください。

- PNGメタデータは一時的な独自仕様ではなく、後で読める形で保存すること
- メタデータキー名を固定すること
- 追記時に既存テキストを消さないこと
- メタデータがないPNGでも落ちないこと
- 複数ファイルドロップにも対応しやすい構造にすること

---

## 23. 参考ドキュメント

- Tauri v2 File System Plugin
- Tauri v2 JavaScript fs API
- Tauri v2 path API
- Tauri v2 opener plugin
- Tauri v2 clipboard plugin
- Tauri v2 configuration: `dragDropEnabled`
- React KeyboardEvent / IME composition handling
- HTML Canvas API
- PNG `tEXt` / `iTXt` metadata chunk handling

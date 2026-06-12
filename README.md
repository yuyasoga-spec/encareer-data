# エンキャリ企業情報 — 公開＆共有保存セットアップ手順

このフォルダの中身：

| ファイル | 役割 |
|---|---|
| `index.html` | サイト本体（アプリ） |
| `data.json` | 共有データベース（全員の追加・編集がここに自動保存される） |
| `.nojekyll` | GitHub Pages用のおまじない（そのままアップロードでOK） |
| `worker.js` | AI連携用の中継サーバー（Cloudflareに貼る。手順は↓） |
| `AI連携セットアップ.md` | AI企業検索・画像読み取り・**メール制限ログイン**の設定手順 |

---

## ⚠ 最初に決めること：Public か Private か

| | Public（公開） | Private（非公開） |
|---|---|---|
| サイトURLで配布 | ✅ GitHub Pagesが使える | ❌ 無料プランでは不可 |
| データの見え方 | **世界中の誰でも閲覧可能** | メンバーだけ |
| 配布方法 | URLを送るだけ | `index.html` ファイルを各自に渡す |

> **注意**: データには選考の口コミ・個人名入りのメモが含まれています。
> 不特定多数に見られたくない場合は **Private＋ファイル配布** を推奨します。
> （Privateでも共有保存はちゃんと動きます。違いは「サイトURLで開けるかどうか」だけ）

---

## ① リポジトリを作る（代表者1人がやる）

1. [github.com](https://github.com) でアカウントを作成（無料）
2. 右上の「＋」→「**New repository**」
3. Repository name: `encareer-data`（好きな名前でOK）
4. **Public / Private を選択**（上の表を参照）→「Create repository」
5. 「**uploading an existing file**」リンクをクリック →
   このフォルダの `index.html` `data.json` `.nojekyll` をドラッグ＆ドロップ →「Commit changes」

## ② サイトとして公開する（Publicの場合のみ）

1. リポジトリの「**Settings**」→ 左メニュー「**Pages**」
2. Branch: `main` を選んで「Save」
3. 1〜2分後に表示されるURL（`https://ユーザー名.github.io/encareer-data/`）がサイトのURL。これをメンバーに配布

※ Privateの場合は、`index.html` ファイルをそのままLINE等でメンバーに送ってください。ダブルクリックで開けばOK（共有保存は同じように動きます）。

## ③ メンバーを招待する（代表者がやる）

1. リポジトリの「Settings」→「**Collaborators**」→「Add people」
2. メンバーのGitHubユーザー名を入力して招待（メンバーは届いたメールで承認）

※ 閲覧だけの人は招待不要（Public＋Pagesなら誰でも見られる）。**書き込みたい人だけ**招待が必要です。

## ④ 各メンバー：自分のトークンを作る（書き込みする人全員）

1. GitHubにログイン → 右上アイコン →「Settings」
2. 左メニュー最下部「**Developer settings**」→「**Personal access tokens**」→「**Fine-grained tokens**」→「Generate new token」
3. 設定：
   - **Token name**: `encareer`（なんでもOK）
   - **Expiration**: 90 days など（切れたら作り直し）
   - **Repository access**: 「Only select repositories」→ ①のリポジトリを選択
   - **Permissions** → Repository permissions → **Contents** を「**Read and write**」に
4. 「Generate token」→ 表示された `github_pat_...` を**その場でコピー**（後から見られません）

## ⑤ 各メンバー：サイトと連携する

1. サイト（またはindex.html）を開く
2. 右上の「**⚙ 共有設定**」をクリック
3. 入力：
   - **GitHubオーナー名**: リポジトリを作った人のユーザー名
   - **リポジトリ名**: `encareer-data`（①でつけた名前）
   - **ブランチ**: `main`（そのまま）
   - **アクセストークン**: ④でコピーした自分のトークン
4. 「保存して接続テスト」→「✅ 接続成功！」と出れば完了
5. 右上の「👤」ボタンで自分の名前も設定しておく（誰が追加したかの記録に使われます）

## 使い方（セットアップ後）

- **追加・編集すると自動でGitHubに保存**され、全員に共有されます（右上に「🟢 共有保存ON」と出ていればOK）
- 他の人の変更を見るには「**🔄 最新取得**」を押す（開き直しでも反映されます）
- 「🟠 未同期の変更あり」と出たら、まだ自分の変更がアップロードされていない状態です（⚙設定を確認）
- 念のため、たまに「⬇ バックアップ」でJSONを保存しておくと安心です

## よくあるトラブル

| 症状 | 原因と対処 |
|---|---|
| 接続失敗（401） | トークンの貼り間違い or 期限切れ → ④で作り直し |
| 接続失敗（403/404） | トークンの Repository access にこのリポジトリが入っていない／Contents権限がRead onlyになっている／Collaborator招待を承認していない |
| 保存したのに他の人に反映されない | 相手が「🔄 最新取得」を押していない（開き直しでもOK） |
| ほぼ同時に2人が保存した | 自動で再試行しますが、まれに後から保存した人の内容が優先されます。直後に「🔄 最新取得」で確認を |

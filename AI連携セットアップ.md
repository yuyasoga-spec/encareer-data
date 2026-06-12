# AI連携 ＆ メール制限ログイン セットアップ手順

この手順書でできるようになること：

| 機能 | 必要なもの | 月額目安 |
|---|---|---|
| 🔍 企業検索（Web検索で自動調査→リスト登録） | Cloudflare + Claude APIキー | 使った分だけ（1検索 数円〜数十円） |
| 📷 画像から登録（Xのスクショ読み取り→締切登録） | 同上 | 1枚あたり1〜数円 |
| 🔐 ログインを指定メールアドレスのみに制限 | Cloudflare（無料） | 0円 |

全部で30〜60分くらいの作業です。**パートA → B → C** の順に進めてください。

---

## パートA: Claude APIキーを発行する（10分）

AIの頭脳部分（Anthropic社のClaude）を使うためのキーです。

1. [console.anthropic.com](https://console.anthropic.com) でアカウント作成
2. 左メニュー「**Billing**」→ クレジットカードを登録し、**$5** など少額をチャージ（従量課金。チャージ分が無くなったら止まるだけなので安心）
3. 左メニュー「**API Keys**」→「**Create Key**」→ 名前は `encareer` など → 表示された `sk-ant-...` を**その場でコピー**（後から見られません）

> 💰 コスト感：企業検索1回 ≒ 5〜30円、スクショ読み取り1枚 ≒ 1〜5円。
> 節約したい場合は後述のWorker環境変数 `MODEL` に `claude-sonnet-4-6` を設定すると約4割安くなります（精度は少し下がります）。

## パートB: 中継サーバー（Cloudflare Worker）を設置する（15分）

APIキーをサイトに直接埋め込むと盗まれるため、間に無料の中継サーバーを置きます。
このフォルダの **`worker.js`** がそのプログラムです。

1. [dash.cloudflare.com](https://dash.cloudflare.com) でアカウント作成（無料プランでOK）
2. 左メニュー「**Workers & Pages**」→「**Create**」→「**Create Worker**」
3. 名前を `encareer-ai` などにして「**Deploy**」（中身はあとで差し替えます）
4. 「**Edit code**」をクリック → エディタが開くので、中身を全部消して **`worker.js` の内容を丸ごと貼り付け** →「**Deploy**」
5. Workerの画面に戻り「**Settings**」→「**Variables and Secrets**」→「**Add**」で次の2つを追加：
   - Type: **Secret** ／ 名前: `ANTHROPIC_API_KEY` ／ 値: パートAでコピーした `sk-ant-...`
   - Type: **Secret** ／ 名前: `APP_KEY` ／ 値: 好きな合言葉（例: `encareer-himitsu-2026`）。メンバーにだけ教えます
6. Workerの URL（`https://encareer-ai.あなたの名前.workers.dev`）をコピー

### サイト側の設定（各メンバー）

1. サイトを開く →「**⚙ 共有設定**」→ 下部の「🤖 AI連携」欄
2. **WorkerのURL** と **アプリキー**（手順5の合言葉）を入力 →「AI設定を保存」
3. 「**🤖 AI取込**」タブで企業名を検索してみる → 結果が出れば成功！

### 使い方

- **🔍 企業検索**：企業名を入れて「調べる」→ 基本情報・採用情報・締切が出る →「🏢 業界企業リストに登録」。**すでに登録済みの企業なら、既存データとの差分だけが表示され、チェックした項目だけ反映**されます。見つかった締切は「📅 カレンダーに登録」でワンタップ登録
- **📷 画像から登録**：毎朝、X の就活情報アカウント5つの投稿をスマホ/PCでスクショ → サイトの点線枠に**ドラッグ or Ctrl+V で貼り付け** →「読み取る」→ 企業名・締切が自動抽出される → チェックして「登録」→ カレンダーに反映

## パートC: ログインを指定メールアドレスのみにする（20分）

サイトを **Cloudflare Pages** でホスティングし直し、その手前に「**Cloudflare Access**」という無料の認証ゲートを置きます。許可したメールアドレスに届く**ワンタイムコード**でログインする方式です。

> これをやると、GitHubをPrivateリポジトリにしたままサイトURLで配布できるようになります（Pages はGitHubから自動デプロイ）。

### C-1. Cloudflare Pages でサイトを公開

1. Cloudflareダッシュボード →「**Workers & Pages**」→「**Create**」→「**Pages**」タブ →「**Connect to Git**」
2. GitHubアカウントを連携し、エンキャリのリポジトリを選択（**Privateのままで大丈夫です**）
3. ビルド設定は何も入れずそのまま「**Save and Deploy**」
4. 発行されたURL（`https://encareer-data.pages.dev` など）がサイトの新しいURLになります

※ 以後、GitHubにデータが保存されるたびにPagesも自動更新されます。GitHub Pagesを使っていた場合はSettings → Pagesで無効化してOK。

### C-2. Access でメール制限をかける

1. Cloudflareダッシュボード 左メニュー「**Zero Trust**」（初回はチーム名を決めて Free プランを選択）
2. 「**Access**」→「**Applications**」→「**Add an application**」→「**Self-hosted**」
3. 設定：
   - Application name: `encareer`
   - Session Duration: `1 week`（毎回ログインさせたくない場合）
   - 「Add public hostname」で C-1 のPagesドメイン（`encareer-data.pages.dev`）を指定
4. ポリシー設定：
   - Policy name: `members` ／ Action: **Allow**
   - Include → Selector:「**Emails**」→ **許可するメールアドレスを列挙**（メンバーのアドレスをカンマ区切りで）
5. 保存。以後サイトを開くとメールアドレス入力画面が出て、**許可リストにあるアドレスだけ**にワンタイムコードが届き、入力するとサイトが開きます

メンバーの追加・削除は Zero Trust → Access → Applications → encareer → ポリシー編集でいつでもできます。

---

## よくあるトラブル

| 症状 | 対処 |
|---|---|
| AI取込で「アプリキーが一致しません」 | ⚙設定のアプリキーとWorkerの `APP_KEY` が同じ値か確認 |
| 「Claude API 401」 | `ANTHROPIC_API_KEY` の貼り間違い。Workerの Variables を再設定 |
| 「Claude API 400/429」 | チャージ残高切れ or 使いすぎ。console.anthropic.com のBillingを確認 |
| 検索が2分以上返ってこない | 混雑の可能性。もう一度試す。続くならWorkerの「Logs」タブでエラー確認 |
| Accessのコードメールが届かない | 迷惑メールフォルダ確認。ポリシーのEmails欄にそのアドレスが入っているか確認 |
| 検索結果が間違っている | AIのWeb検索はベストエフォートです。登録前に必ず内容を確認し、間違いは編集で直してください |

## セキュリティのまとめ

- **Claude APIキー**はWorkerのSecretにだけ置かれ、サイトやGitHubには一切出ません
- **アプリキー（APP_KEY）**で、URLを知っている第三者がWorkerを勝手に使ってAPIクレジットを消費するのを防ぎます
- **Cloudflare Access**で、サイト自体を指定メールアドレスの人しか開けなくします
- GitHubのトークン（共有保存用）は従来どおり各自のブラウザ内のみ

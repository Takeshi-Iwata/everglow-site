# デプロイと自動公開（Netlify ＋ microCMS Webhook）

記事を microCMS で更新 → Netlify が自動ビルド → 自動公開、という流れを構築する手順。

## 構成
```
microCMS（記事編集）
   │ 公開/更新 → Webhook
   ▼
Netlify Build Hook → Netlify が `npm run build`（= node build-blog.js）
   │ microCMS から取得して静的HTML生成
   ▼
自動公開（everglow.site）
```

## 1. GitHub にプッシュ
```bash
cd ~/Desktop/everglow-site
git remote add origin https://github.com/<あなたのID>/everglow-site.git
git push -u origin main
```
※ 認証は `gh auth login` か Personal Access Token を使用。

## 2. Netlify にサイトを作成
1. https://app.netlify.com/ → **Add new site → Import an existing project**
2. GitHub を連携し、`everglow-site` リポジトリを選択
3. ビルド設定は `netlify.toml` を自動検出（Build command: `npm run build` / Publish: `.`）
4. Deploy

## 3. 環境変数を設定（重要）
Netlify → **Site configuration → Environment variables** に追加:

| Key | Value |
|---|---|
| `MICROCMS_SERVICE_DOMAIN` | `everglow` |
| `MICROCMS_ENDPOINT` | `news` |
| `MICROCMS_API_KEY` | （再発行したGET用キー） |

設定後、**Trigger deploy → Deploy site** で再ビルド（環境変数を反映）。

## 4. Build Hook を作成
Netlify → **Site configuration → Build & deploy → Build hooks → Add build hook**
- 名前: `microCMS` / ブランチ: `main`
- 生成された URL（`https://api.netlify.com/build_hooks/xxxx`）を控える

## 5. microCMS に Webhook を設定
microCMS → API「お知らせ」→ **API設定 → Webhook → 追加**
- 連携先に **Netlify** を選び、4で控えた Build Hook URL を貼り付け
- タイミング: 「コンテンツの公開・更新・削除時」
- 保存

## 6. 動作確認
microCMS で記事を公開 → 数十秒後に Netlify が自動ビルドし、サイトへ反映される。

## 7.（任意）独自ドメイン everglow.site
Netlify → **Domain management → Add a domain** → `everglow.site`
- ムームードメイン/ロリポップのDNSで Netlify を指す（Netlify DNS を使うか、A `75.2.60.5` ＋ `www` を CNAME）。

## ローカルでビルドする場合
`.env`（gitignore対象）にキーを入れて `npm run build`。未設定なら `content/posts.json` から生成。

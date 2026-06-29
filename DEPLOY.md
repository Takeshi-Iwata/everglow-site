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

| Key | Value | 用途 |
|---|---|---|
| `MICROCMS_SERVICE_DOMAIN` | `everglow` | ブログ生成（ビルド時） |
| `MICROCMS_ENDPOINT` | `news` | 同上 |
| `MICROCMS_API_KEY` | （GET用キー） | 同上 |
| `SUPABASE_URL` | `https://xxxx.supabase.co` | 予約の保存先 |
| `SUPABASE_SECRET_KEY` | （service_role / secret キー） | 予約Function（サーバー専用・公開不可） |
| `RESEND_API_KEY` | `re_xxxx` | 確認メール（任意。無ければ送信スキップ） |
| `SALON_EMAIL` | サロンの受信用アドレス | 予約のサロン控え（任意） |
| `RESERVATION_FROM` | `Everglow <yoyaku@認証済みドメイン>` | 送信元（任意。未設定だと Resend テスト送信元） |

設定後、**Trigger deploy → Deploy site** で再ビルド（環境変数を反映）。
※ `SITE_URL` を設定すると、生成ページの OGP/canonical の絶対URLが本番ドメインになります（未設定時は既定の `https://everglow.netlify.app`）。

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

## 予約システム（Netlify Functions ＋ Supabase）
予約UIは `reserve.html` ＋ `booking.js`、APIは `netlify/functions/`（`availability` / `reserve`）。
Netlify がデプロイ時に `netlify/functions/` を自動で関数化し、`/.netlify/functions/...` で公開する（追加設定は `netlify.toml` の `[functions]` 済み）。

### Supabase 側の準備（初回のみ）
1. プロジェクト作成 → SQL Editor で予約テーブルを作成:
   ```sql
   create table reservations (
     id uuid primary key default gen_random_uuid(),
     date date not null, start_time time not null, duration_min int not null,
     menu_id text not null, menu_name text not null, price int not null,
     name text not null, tel text not null, email text not null, note text,
     created_at timestamptz default now(),
     unique (date, start_time)
   );
   ```
2. サーバー(service_role)にだけ権限付与（匿名アクセスは遮断したまま）:
   ```sql
   grant select, insert on table public.reservations to service_role;
   ```
3. Settings → API のキーと URL を、上記の環境変数に設定。

### 確認メール（Resend・任意）
`RESEND_API_KEY` を設定すると、予約時に顧客へHTML確認メール＋`SALON_EMAIL` へ控えを送信。
本番で任意の顧客アドレスに送るには Resend で**独自ドメインを認証**し、`RESERVATION_FROM` をそのドメインのアドレスにする（未認証だと自分宛のみのテスト送信）。

### ローカル検証
`.env` にキーを入れて `npx netlify dev` → `http://localhost:8888/reserve`。
（静的のみの確認は `npx serve` 等でも可だが、予約APIは `netlify dev` が必要）

## ローカルでビルドする場合
`.env`（gitignore対象）にキーを入れて `npm run build`。未設定なら `content/posts.json` から生成。

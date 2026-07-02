# Cloudflare Pages へのデプロイ手順（無料）

Netlify の無料クレジット枯渇でデプロイが止まったため、Cloudflare Pages（無料枠が潤沢）へ移行する。
静的サイト＋予約API（Pages Functions）＋Supabase の構成をそのまま維持する。

## 構成
- 静的ファイル: リポジトリ直下（`index.html` など。ブログHTMLは生成済みでコミット済み）
- 予約API: `functions/api/availability.js`（GET）、`functions/api/reserve.js`（POST）
  - `functions/api/_lib.js` … 共有ロジック。Supabase は REST(fetch) を直接利用（npm 依存なし）
  - クライアント（`booking.js`）は `/api/availability`・`/api/reserve` を呼ぶ
- Supabase / Resend はそのまま（環境変数で接続）

## セットアップ
1. https://dash.cloudflare.com で無料アカウントを作成
2. **Workers & Pages → Create → Pages → Connect to Git** で GitHub の
   `Takeshi-Iwata/everglow-site` を選択
3. ビルド設定:
   - **Framework preset**: None
   - **Build command**: （空欄のまま）※ ブログHTMLは生成済みのためビルド不要
   - **Build output directory**: `/`
4. **環境変数（Settings → Environment variables, Production）** を設定:
   - `SUPABASE_URL` … 例 `https://xxxx.supabase.co`
   - `SUPABASE_SECRET_KEY` … Supabase の service_role キー
   - （任意・確認メール）`RESEND_API_KEY` / `SALON_EMAIL` / `RESERVATION_FROM`
5. **Save and Deploy** → `https://everglow-site.pages.dev` などで公開

## 動作確認
- `/api/availability?date=YYYY-MM-DD&menu=cut` が `{ "slots": [...] }` を返す
- 予約フロー（メニュー→日時→情報→送信）で 201、二重予約で 409

## メモ
- Netlify 用の `netlify.toml` / `netlify/functions/` は将来の復帰用に残置（Cloudflare は無視）。
- Supabase の `reservations` テーブルには `(date, start_time)` の UNIQUE 制約を設定しておくこと
  （二重予約の最終防衛。PostgREST は一意制約違反時に HTTP 409 を返す）。

# ブログの仕組み（Headless CMS ＋ 静的生成）

記事は「データ」と「テンプレート」を分け、**ビルド時に静的HTMLへ焼き込む**構成です。
サーバやDBを自前で運用せず、サイトは高速・安全なまま、**先方は管理画面で記事を編集**できます。

```
 記事データ ─────────────┐
  microCMS（本番）        │   node build-blog.js
   または                 ├────────────────────▶  blog.html（一覧）
  content/posts.json      │                        blog-<slug>.html（各記事）
 （ローカル/デモ）─────────┘
```

## 更新フロー
1. 先方が **microCMS の管理画面**で記事を作成・編集（タイトル・本文・カテゴリ・公開日・カバー画像）。
2. `node build-blog.js` を実行（または公開サービスの自動ビルドにフック）。
3. 生成された HTML をサーバへアップ → 反映。

## ローカル/デモ
環境変数が未設定なら `content/posts.json` から生成します（microCMS アカウント不要で動作確認可）。

```bash
node build-blog.js
```

## 本番（microCMS）に切り替える
1. microCMS で **リスト形式の API「blog」** を作成。フィールド例：
   - `title`（テキスト） / `body`（リッチエディタ or HTML） / `category`（セレクト）
   - `excerpt`（テキスト） / `cover`（画像）
   - 公開日は microCMS 標準の `publishedAt` を使用
2. `.env.example` を参考に `MICROCMS_SERVICE_DOMAIN` と `MICROCMS_API_KEY` を設定。
3. `node build-blog.js` を実行すると microCMS から取得して生成します。

## 自動公開（任意）
Netlify / Vercel に載せ、microCMS の Webhook で「記事更新→自動ビルド→自動公開」も可能です。
先方の編集がそのまま本番に反映され、運用の手間がかかりません。

## なぜこの構成か
- **速い/安全**：表側は静的HTML。攻撃対象になりやすい管理機能をサーバに持たない。
- **デザイン自由**：既存の手書きデザインをそのまま活かせる（WordPress テーマ化の制約を受けない）。
- **編集しやすい**：先方は microCMS の整ったUIで編集。技術知識は不要。
- WordPress 案件にも対応可（テーマ化／ヘッドレスWP）。要件に応じて選択。

#!/usr/bin/env node
/*
 * build-blog.js — ブログの「静的生成」スクリプト
 *
 * データソース:
 *   1) microCMS（環境変数 MICROCMS_SERVICE_DOMAIN / MICROCMS_API_KEY があれば優先）
 *      → 先方は microCMS の管理画面で記事を編集。ここで取得して静的HTMLに焼き込む。
 *   2) content/posts.json（ローカルのデモ用フォールバック）
 *
 * 生成物:
 *   - blog.html           … 記事一覧（カードが各記事ページへリンク）
 *   - blog-<slug>.html    … 各記事の個別ページ
 *
 * 使い方:  node build-blog.js
 *   （本番）MICROCMS_SERVICE_DOMAIN=xxx MICROCMS_API_KEY=yyy node build-blog.js
 */
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

// .env を読み込む（依存パッケージなしの簡易ローダー）
(function loadEnv() {
  const p = path.join(DIR, '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

/* ---------- データ取得（microCMS or ローカルJSON） ---------- */
async function fetchFromMicroCMS() {
  const domain = process.env.MICROCMS_SERVICE_DOMAIN;
  const key = process.env.MICROCMS_API_KEY;
  const endpoint = process.env.MICROCMS_ENDPOINT || 'blog'; // 既定テンプレートなら news
  if (!domain || !key) return null; // 未設定ならローカルJSONを使う
  const url = `https://${domain}.microcms.io/api/v1/${endpoint}?limit=100&orders=-publishedAt`;
  const res = await fetch(url, { headers: { 'X-MICROCMS-API-KEY': key } });
  if (!res.ok) throw new Error(`microCMS fetch failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  // microCMS のフィールド名 → サイト内の共通形に変換（独自スキーマ / 既定テンプレート両対応）
  return json.contents.map((c) => {
    const body = c.body || c.content || '';
    let category = c.category;
    if (Array.isArray(category)) category = category[0]; // セレクト型
    if (category && typeof category === 'object') category = category.name || category.value || ''; // 参照型
    const cover = (c.cover && c.cover.url) || (c.eyecatch && c.eyecatch.url) || '';
    const excerpt = c.excerpt || body.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 70);
    return {
      slug: c.id,
      category: category || 'BLOG',
      date: (c.publishedAt || c.createdAt || '').slice(0, 10).replace(/-/g, '.'),
      title: c.title,
      excerpt,
      cover,
      body,
    };
  });
}

async function loadPosts() {
  const fromCMS = await fetchFromMicroCMS();
  if (fromCMS) {
    console.log(`microCMS から ${fromCMS.length} 件取得`);
    return fromCMS;
  }
  const local = JSON.parse(fs.readFileSync(path.join(DIR, 'content/posts.json'), 'utf8'));
  console.log(`content/posts.json から ${local.length} 件読込（デモ用フォールバック）`);
  return local;
}

/* ---------- 共通パーツ（他ページと同じシェル） ---------- */
const NAV = [
  ['index.html', 'Home', 'ホーム'],
  ['our-salon.html', 'Our Salon', 'サロンについて'],
  ['menu.html', 'Menu', 'メニュー'],
  ['gallery.html', 'Gallery', 'ギャラリー'],
  ['blog.html', 'Blog', 'お知らせ'],
  ['access.html', 'Access', 'アクセス'],
  ['contact.html', 'Contact', 'お問い合わせ'],
];
const HEADNAV = ['our-salon.html', 'menu.html', 'gallery.html', 'blog.html', 'access.html', 'contact.html'];
const SNS = `<a href="#" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none"/></svg></a>
    <a href="#" aria-label="Facebook"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.2 22v-8h2.7l.4-3.4h-3.1V8.4c0-1 .27-1.65 1.7-1.65h1.5V3.7c-.26-.03-1.16-.11-2.2-.11-2.18 0-3.67 1.33-3.67 3.77v2.23H7.8V14h2.4v8h3z"/></svg></a>
    <a href="#" aria-label="X"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 3h2.7l-5.9 6.75L21.6 21h-5.43l-4.25-5.56L6.86 21H4.15l6.3-7.2L3.6 3h5.57l3.84 5.08L17.5 3zm-.95 16.4h1.5L8.02 4.5H6.4l10.15 14.9z"/></svg></a>`;

const header = () => `<header class="hd">
  <a class="hd__logo" href="index.html">Everglow.</a>
  <nav class="hd__nav">${HEADNAV.map((h) => `<a href="${h}">${NAV.find((n) => n[0] === h)[1]}</a>`).join('')}</nav>
  <a class="btn btn--gold hd__cta" href="reserve.html" style="height:42px;padding:0 22px;">予約する</a>
  <button class="burger" id="burger" aria-label="メニュー"><span></span><span></span><span></span></button>
</header>
<div class="panel" id="panel">
  <button class="burger panel__close" id="panelClose" aria-label="閉じる"><span></span><span></span><span></span></button>
  ${NAV.map((n) => `<a href="${n[0]}">${n[1]}<small>${n[2]}</small></a>`).join('\n  ')}
  <div class="panel__sns">
    ${SNS}
  </div>
</div>`;

const footer = (cur) => `<footer class="ft">
  <div class="wrap">
    <h3 class="ft__h">Salon</h3>
    <div class="ft__salon">
      <a class="ul" href="access.html">神奈川県藤沢市〇〇 0-0-0</a><br>
      平日 10:00–19:00 ／ 土日祝 9:00–18:00<br>
      定休日 毎週月曜日<br>
      <a class="ul" href="tel:0466000000">0466-xx-xxxx</a>
    </div>
    <hr class="ft__hr">
    <h3 class="ft__h">Pages</h3>
    <nav class="ft__pages">${NAV.map((n) => `<a${n[0] === cur ? ' class="cur"' : ''} href="${n[0]}">${n[1]}</a>`).join('')}</nav>
    <hr class="ft__hr">
    <h3 class="ft__h">SNS</h3>
    <div class="ft__sns">${SNS}</div>
    <hr class="ft__hr">
    <div class="ft__brand"><div class="ft__logo">Everglow.</div><div class="ft__copy">© 2026 Everglow</div></div>
  </div>
</footer>
<a class="fab" id="fab" href="reserve.html" aria-label="ご予約はこちら">
  <span class="fab__ripple"></span><span class="fab__ripple"></span><span class="fab__ripple"></span>
  <span class="fab__core"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9.5h16M8 3v4M16 3v4"/></svg><span class="fab__txt">予約</span></span>
</a>`;

const resv = () => `<section class="resv">
  <div class="en">Reservation</div>
  <div class="jp">ご予約・お問い合わせ</div>
  <a class="btn" href="reserve.html">予約する →</a>
</section>`;

// 公開ドメイン（確定後に置換）。OGP/canonical の絶対URLに使用。
const DOMAIN = process.env.SITE_URL || 'https://everglow-salon.netlify.app';
const OGIMG = `${DOMAIN}/images/ogp.jpg`;
const escAttr = (s) => esc(s).replace(/"/g, '&quot;');
const headMeta = (fullTitle, desc, pathRel, ogType) => {
  const url = `${DOMAIN}/${pathRel}`;
  const t = escAttr(fullTitle);
  const d = escAttr(desc);
  return `<link rel="canonical" href="${url}">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<meta name="theme-color" content="#fcfcf5" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121110" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="Everglow">
<meta property="og:locale" content="ja_JP">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${OGIMG}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${OGIMG}">`;
};
const docHead = (title, desc, pathRel, opts = {}) => {
  const fullTitle = `${title} ｜ Everglow`;
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>(function(d){d.classList.add('js');try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light')d.setAttribute('data-theme',t)}catch(e){}})(document.documentElement)</script>
<title>${esc(fullTitle)}</title>
<meta name="description" content="${escAttr(desc)}">
${headMeta(fullTitle, desc, pathRel, opts.ogType || 'website')}${opts.jsonld ? `\n${opts.jsonld}` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="style.css">
</head>
<body>
<a class="skip" href="#main">本文へスキップ</a>`;
};
const docFoot = `<script src="app.js" defer></script>
</body>
</html>`;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ph = (cls, comment) => `<div class="ph ${cls}">${comment ? `<!-- ${comment} -->` : ''}</div>`;

/* ---------- 一覧ページ blog.html ---------- */
function buildIndex(posts) {
  const cards = posts
    .map(
      (p) => `    <a class="bcard" href="blog-${p.slug}.html" data-cat="${esc(p.category)}">${p.cover ? `<img class="bcard__img" src="${p.cover}" alt="">` : ph('bcard__img')}<div class="bcard__meta"><span class="bcard__cat">${esc(p.category)}</span><span class="bcard__date">${esc(p.date)}</span></div><h3 class="bcard__ttl">${esc(p.title)}</h3><p class="bcard__ex">${esc(p.excerpt)}</p></a>`
    )
    .join('\n');
  // チップは実在カテゴリから生成（好みの並び順を優先し、未知のものは後ろに付ける）
  const PREFERRED = ['お知らせ', 'スタイル', 'ヘアケア', 'カラー'];
  const present = [...new Set(posts.map((p) => p.category))];
  const cats = [...PREFERRED.filter((c) => present.includes(c)), ...present.filter((c) => !PREFERRED.includes(c))];
  const chips = `<div class="chips" data-rev><a class="on" href="#" data-cat="">すべて</a>${cats
    .map((c) => `<a href="#" data-cat="${esc(c)}">${esc(c)}</a>`)
    .join('')}</div>`;
  const html = `${docHead('Blog', 'Everglow からのお知らせ・ブログ。', 'blog.html')}
${header()}
<section class="subhero"><span class="ghost" aria-hidden="true">Blog</span><span class="en">Blog</span><span class="jp">お知らせ・ブログ</span></section>
<main class="page" id="main" tabindex="-1"><div class="wrap">
  ${chips}
  <div class="blist" data-rev>
${cards}
  </div>
  <p class="bempty" hidden>このカテゴリの記事はまだありません。</p>
</div></main>
${resv()}
${footer('blog.html')}
${docFoot}`;
  fs.writeFileSync(path.join(DIR, 'blog.html'), html);
}

/* ---------- 各記事ページ blog-<slug>.html ---------- */
function buildArticle(p, posts, i) {
  const prev = posts[i - 1]; // 新しい記事
  const next = posts[i + 1]; // 古い記事
  const nav = `<div class="art__nav">
    ${next ? `<a href="blog-${next.slug}.html">← 前の記事</a>` : '<span></span>'}
    <a class="art__navc" href="blog.html">一覧へ</a>
    ${prev ? `<a href="blog-${prev.slug}.html">次の記事 →</a>` : '<span></span>'}
  </div>`;
  // 記事の構造化データ（BlogPosting）
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: p.title,
    datePublished: p.date.replace(/\./g, '-'),
    articleSection: p.category,
    url: `${DOMAIN}/blog-${p.slug}.html`,
    mainEntityOfPage: `${DOMAIN}/blog-${p.slug}.html`,
    publisher: { '@type': 'Organization', name: 'Everglow' },
    ...(p.cover ? { image: p.cover } : {}),
  };
  const jsonld = `<script type="application/ld+json">\n${JSON.stringify(articleLd, null, 2)}\n</script>`;
  const html = `${docHead(p.title, p.excerpt, `blog-${p.slug}.html`, { ogType: 'article', jsonld })}
${header()}
<main class="page" id="main" tabindex="-1"><div class="wrap">
  <article class="art">
    <header class="art__head" data-rev>
      <div class="art__meta"><span class="art__cat">${esc(p.category)}</span><span class="art__date">${esc(p.date)}</span></div>
      <h1 class="art__title">${esc(p.title)}</h1>
    </header>
    ${p.cover ? `<img class="art__cover" src="${p.cover}" alt="">` : ph('art__cover')}
    <div class="art__body" data-rev>
${p.body}
    </div>
    ${nav}
  </article>
</div></main>
${resv()}
${footer('blog.html')}
${docFoot}`;
  fs.writeFileSync(path.join(DIR, `blog-${p.slug}.html`), html);
}

/* ---------- トップページの新着ブログ（最新3件を index.html に差し込む） ---------- */
function patchIndexNews(posts) {
  const idx = path.join(DIR, 'index.html');
  if (!fs.existsSync(idx)) return;
  let html = fs.readFileSync(idx, 'utf8');
  const re = /(<ul class="news__list"[^>]*>)[\s\S]*?(<\/ul>)/;
  if (!re.test(html)) {
    console.warn('index.html に news__list が見つからず、トップ新着の更新をスキップ');
    return;
  }
  const items = posts
    .slice(0, 3)
    .map(
      (p) =>
        `        <li><a href="blog-${p.slug}.html"><span class="news__meta"><span class="news__cat">${esc(p.category)}</span><span class="news__date">${esc(p.date)}</span></span><span class="news__ttl">${esc(p.title)}</span></a></li>`
    )
    .join('\n');
  const next = html.replace(re, `$1\n${items}\n      $2`);
  if (next !== html) {
    fs.writeFileSync(idx, next);
    console.log('index.html のトップ新着を最新3件に更新');
  }
}

/* ---------- 実行 ---------- */
(async () => {
  // 既存の生成物を掃除（slugが変わっても孤児ページを残さない）
  for (const f of fs.readdirSync(DIR)) {
    if (/^blog-.*\.html$/.test(f)) fs.unlinkSync(path.join(DIR, f));
  }
  const posts = await loadPosts();
  buildIndex(posts);
  posts.forEach((p, i) => buildArticle(p, posts, i));
  patchIndexNews(posts);
  console.log(`生成完了: blog.html + ${posts.length} 記事ページ`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

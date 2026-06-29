/* gallery.js — ギャラリーのカテゴリ絞り込み＋ライトボックス
 * 画像が入ると <img> を拡大表示。未挿入のうちはプレースホルダ＋スタイル名で動作。
 */
(function () {
  'use strict';
  const grid = document.querySelector('.ggrid');
  if (!grid) return;
  const items = [...grid.querySelectorAll('.gitem')];
  const chips = document.querySelector('.gchips');
  const CAT = { cut: 'カット', color: 'カラー', perm: 'パーマ', arrange: 'アレンジ' };

  /* ---- カテゴリ絞り込み ---- */
  let visible = items.slice();
  if (chips) {
    chips.addEventListener('click', (e) => {
      const a = e.target.closest('a');
      if (!a) return;
      e.preventDefault();
      chips.querySelectorAll('a').forEach((x) => x.classList.toggle('on', x === a));
      const cat = a.dataset.cat;
      items.forEach((it) => { it.hidden = cat && it.dataset.cat !== cat; });
      visible = items.filter((it) => !it.hidden);
    });
  }

  /* ---- ライトボックス ---- */
  const lb = document.createElement('div');
  lb.className = 'lb';
  lb.hidden = true;
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', '写真の拡大表示');
  lb.innerHTML = `
    <button class="lb__close" type="button" aria-label="閉じる"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    <button class="lb__nav lb__prev" type="button" aria-label="前の写真"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M15 5l-7 7 7 7"/></svg></button>
    <figure class="lb__stage"><div class="lb__media"></div><figcaption class="lb__cap"></figcaption></figure>
    <button class="lb__nav lb__next" type="button" aria-label="次の写真"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 5l7 7-7 7"/></svg></button>`;
  document.body.appendChild(lb);
  const media = lb.querySelector('.lb__media');
  const cap = lb.querySelector('.lb__cap');
  let cur = -1, lastFocus = null;

  function render(i) {
    const it = visible[i];
    if (!it) return;
    const img = it.querySelector('img');
    const label = it.dataset.label || '';
    const catLabel = CAT[it.dataset.cat] || '';
    media.className = 'lb__media' + (img ? '' : ' ph'); // 画像が無ければプレースホルダ
    media.innerHTML = img ? `<img src="${img.currentSrc || img.src}" alt="${label}">` : '';
    cap.textContent = label + (catLabel ? ` ／ ${catLabel}` : '');
    cur = i;
  }
  function open(it) {
    const i = visible.indexOf(it);
    if (i < 0) return;
    lastFocus = document.activeElement;
    render(i);
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    lb.querySelector('.lb__close').focus();
  }
  function close() {
    lb.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  function step(d) {
    if (visible.length) render((cur + d + visible.length) % visible.length);
  }

  items.forEach((it) => it.addEventListener('click', () => open(it)));
  lb.querySelector('.lb__close').addEventListener('click', close);
  lb.querySelector('.lb__prev').addEventListener('click', () => step(-1));
  lb.querySelector('.lb__next').addEventListener('click', () => step(1));
  lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
  document.addEventListener('keydown', (e) => {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'ArrowRight') step(1);
  });
})();

/* booking.js — 予約フロー（メニュー→日付→時間→お客様情報→完了）
 *
 * Phase 1: データ層（getMenus / getAvailability / submitReservation）は
 *          下部の MOCK 実装。Phase 2 で Netlify Functions(/.netlify/functions/*)
 *          ＋ Supabase に差し替える（UI 側は無変更で済む設計）。
 */
(function () {
  'use strict';
  const root = document.getElementById('bk');
  if (!root) return;

  /* ---------- 設定（Phase 2 でサーバー側と共有する想定） ---------- */
  const SLOT_MIN = 30; // 予約枠の刻み（分）
  // 営業時間（曜日: 0=日 … 6=土）。月曜(1)は定休＝未定義。
  const HOURS = {
    0: { open: '09:00', close: '18:00' }, // 日
    2: { open: '10:00', close: '19:00' }, // 火
    3: { open: '10:00', close: '19:00' }, // 水
    4: { open: '10:00', close: '19:00' }, // 木
    5: { open: '10:00', close: '19:00' }, // 金
    6: { open: '09:00', close: '18:00' }, // 土
  };

  /* ---------- ユーティリティ ---------- */
  const yen = (n) => '¥' + n.toLocaleString('ja-JP');
  const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const toHHMM = (min) => String((min / 60) | 0).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const WD = ['日', '月', '火', '水', '木', '金', '土'];
  const fmtDate = (iso) => { const d = new Date(iso + 'T00:00:00'); return `${d.getMonth() + 1}月${d.getDate()}日（${WD[d.getDay()]}）`; };

  /* ---------- 状態 ---------- */
  const state = { menu: null, date: null, time: null };
  const els = {
    steps: root.querySelector('.bk__progress'),
    panels: [...root.querySelectorAll('.bk__panel')],
    menus: root.querySelector('#bkMenus'),
    dates: root.querySelector('#bkDates'),
    times: root.querySelector('#bkTimes'),
    timeHint: root.querySelector('#bkTimeHint'),
    form: root.querySelector('#bkForm'),
    summary: root.querySelector('#bkSummary'),
    done: root.querySelector('#bkDoneSummary'),
  };
  const ORDER = ['menu', 'date', 'time', 'info', 'done'];

  function go(step) {
    els.panels.forEach((p) => (p.hidden = p.dataset.step !== step));
    const idx = ORDER.indexOf(step);
    [...els.steps.children].forEach((d, i) => {
      d.classList.toggle('on', i === idx);
      d.classList.toggle('done', i < idx);
    });
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- Step 1: メニュー ---------- */
  async function renderMenus() {
    const menus = await getMenus();
    els.menus.innerHTML = menus
      .map(
        (m) => `<button type="button" class="bk-menu" data-id="${m.id}">
          <span class="bk-menu__name">${m.name}</span>
          <span class="bk-menu__meta"><span class="bk-menu__price">${yen(m.price)}</span><span class="bk-menu__min">約${m.min}分</span></span>
        </button>`
      )
      .join('');
    els.menus.querySelectorAll('.bk-menu').forEach((b) =>
      b.addEventListener('click', async () => {
        const menus2 = await getMenus();
        state.menu = menus2.find((m) => m.id === b.dataset.id);
        state.date = null; state.time = null;
        renderDates();
        go('date');
      })
    );
  }

  /* ---------- Step 2: 日付（今日から28日、定休日を除外） ---------- */
  function renderDates() {
    const out = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 28; i++) {
      const d = new Date(today); d.setDate(today.getDate() + i);
      if (!HOURS[d.getDay()]) continue; // 定休日
      out.push(`<button type="button" class="bk-date" data-d="${ymd(d)}">
        <span class="bk-date__wd">${WD[d.getDay()]}</span>
        <span class="bk-date__day">${d.getDate()}</span>
        <span class="bk-date__mo">${d.getMonth() + 1}月</span>
      </button>`);
    }
    els.dates.innerHTML = out.join('');
    els.dates.querySelectorAll('.bk-date').forEach((b) =>
      b.addEventListener('click', () => {
        state.date = b.dataset.d; state.time = null;
        renderTimes();
        go('time');
      })
    );
  }

  /* ---------- Step 3: 時間（空き枠） ---------- */
  async function renderTimes() {
    els.timeHint.textContent = `${fmtDate(state.date)} ／ ${state.menu.name}（約${state.menu.min}分）`;
    els.times.innerHTML = '<p class="bk-loading">空き状況を確認中…</p>';
    let slots;
    try {
      slots = await getAvailability(state.date, state.menu.id);
    } catch (e) {
      els.times.innerHTML = '<p class="bk-error">空き状況の取得に失敗しました。時間をおいて再度お試しください。</p>';
      return;
    }
    if (!slots.length) {
      els.times.innerHTML = '<p class="bk-empty">この日は空き枠がありません。別の日をお選びください。</p>';
      return;
    }
    els.times.innerHTML = slots
      .map((s) => `<button type="button" class="bk-time" data-t="${s.time}"${s.available ? '' : ' disabled'}>${s.time}</button>`)
      .join('');
    els.times.querySelectorAll('.bk-time:not([disabled])').forEach((b) =>
      b.addEventListener('click', () => {
        state.time = b.dataset.t;
        fillSummary();
        go('info');
      })
    );
  }

  /* ---------- Step 4: お客様情報 ＋ 確認 ---------- */
  function fillSummary() {
    els.summary.innerHTML = `
      <div class="bk-sum__row"><span>メニュー</span><b>${state.menu.name}（${yen(state.menu.price)}）</b></div>
      <div class="bk-sum__row"><span>日時</span><b>${fmtDate(state.date)} ${state.time}〜</b></div>
      <div class="bk-sum__row"><span>所要</span><b>約${state.menu.min}分</b></div>`;
  }

  els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = els.form.querySelector('[type="submit"]');
    const data = {
      menuId: state.menu.id, menuName: state.menu.name, price: state.menu.price, durationMin: state.menu.min,
      date: state.date, time: state.time,
      name: els.form.name.value.trim(), tel: els.form.tel.value.trim(),
      email: els.form.email.value.trim(), note: els.form.note.value.trim(),
    };
    btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = '送信中…';
    try {
      const res = await submitReservation(data);
      if (!res.ok) throw new Error(res.message || 'failed');
      els.done.innerHTML = `
        <div class="bk-sum__row"><span>メニュー</span><b>${data.menuName}</b></div>
        <div class="bk-sum__row"><span>日時</span><b>${fmtDate(data.date)} ${data.time}〜</b></div>
        <div class="bk-sum__row"><span>お名前</span><b>${data.name} 様</b></div>`;
      go('done');
    } catch (err) {
      alert(err.message === 'slot_taken'
        ? '申し訳ありません。その枠はちょうど埋まりました。別の時間をお選びください。'
        : '送信に失敗しました。お手数ですが、お電話でもご予約を承ります。');
      if (err.message === 'slot_taken') { renderTimes(); go('time'); }
    } finally {
      btn.disabled = false; btn.textContent = btn.dataset.label || 'この内容で予約する';
    }
  });

  /* ---------- 戻る/進む ---------- */
  root.querySelectorAll('[data-back]').forEach((b) =>
    b.addEventListener('click', () => go(b.dataset.back))
  );

  /* ================= データ層（Phase 2 で差し替え） ================= */
  // 本番では fetch('/.netlify/functions/menus' 等) に置き換える。
  async function getMenus() {
    return [
      { id: 'cut', name: 'カット', price: 5000, min: 60 },
      { id: 'bangs', name: '前髪カット', price: 1500, min: 15 },
      { id: 'kids', name: 'キッズカット', price: 3000, min: 30 },
      { id: 'color', name: 'オーガニックカラー', price: 8000, min: 90 },
      { id: 'retouch', name: 'リタッチカラー', price: 6500, min: 60 },
      { id: 'highlight', name: 'ハイライト', price: 12000, min: 120 },
      { id: 'digital_perm', name: 'デジタルパーマ', price: 11000, min: 120 },
      { id: 'water_perm', name: '水パーマ', price: 9000, min: 100 },
      { id: 'treatment', name: 'プレミアムトリートメント', price: 5500, min: 45 },
      { id: 'kaizen', name: '髪質改善トリートメント', price: 9000, min: 90 },
      { id: 'spa', name: 'ヘッドスパ', price: 4000, min: 30 },
    ];
  }

  async function getAvailability(dateISO, menuId) {
    const r = await fetch(`/.netlify/functions/availability?date=${dateISO}&menu=${encodeURIComponent(menuId)}`);
    if (!r.ok) throw new Error('availability');
    const j = await r.json();
    return j.slots || [];
  }

  async function submitReservation(payload) {
    const r = await fetch('/.netlify/functions/reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 409) return { ok: false, message: 'slot_taken' };
    if (!r.ok) return { ok: false, message: j.message || 'failed' };
    return { ok: true };
  }

  /* ---------- 初期化 ---------- */
  renderMenus();
  go('menu');
})();

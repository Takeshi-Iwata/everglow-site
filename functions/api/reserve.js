/* POST /api/reserve
 * body: { menuId, date, time, name, tel, email, note }
 * → 201 {ok:true} / 409 {message:"slot_taken"} / 400 / 500
 * メニューの料金・所要時間はサーバー側(_lib)を正とする。
 */
import { SLOT_MIN, menuById, toMin, isYmd, hoursFor, getTaken, insertReservation, json } from './_lib.js';

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export async function onRequestPost(context) {
  const { request, env } = context;

  let b;
  try { b = await request.json(); } catch { return json(400, { message: 'invalid json' }); }

  const name = (b.name || '').trim();
  const tel = (b.tel || '').trim();
  const email = (b.email || '').trim();
  const note = (b.note || '').trim();
  const date = (b.date || '').trim();
  const time = (b.time || '').trim();
  const menu = menuById(b.menuId);

  // バリデーション
  if (!name || !tel || !isEmail(email)) return json(400, { message: 'invalid contact' });
  if (!menu) return json(400, { message: 'invalid menu' });
  if (!isYmd(date) || !/^\d{2}:\d{2}$/.test(time)) return json(400, { message: 'invalid datetime' });
  const h = hoursFor(date);
  if (!h) return json(400, { message: 'closed day' });
  const start = toMin(time), end = start + menu.min;
  if (start < toMin(h.open) || end > toMin(h.close) || start % SLOT_MIN !== 0) {
    return json(400, { message: 'out of hours' });
  }

  try {
    // 二重予約の事前チェック（最終防衛は DB の unique 制約）
    const taken = await getTaken(env, date);
    if (taken.some((r) => start < r.end && r.start < end)) return json(409, { message: 'slot_taken' });

    const res = await insertReservation(env, {
      date, start_time: time, duration_min: menu.min,
      menu_id: menu.id, menu_name: menu.name, price: menu.price,
      name, tel, email, note: note || null,
    });
    if (res.status === 409) return json(409, { message: 'slot_taken' }); // unique violation (23505)
    if (!res.ok) {
      console.error('insert error', res.status, (await res.text()).slice(0, 200));
      return json(500, { message: 'server error' });
    }

    // 確認メール（RESEND_API_KEY があれば送信。無ければスキップ）
    await sendMail(env, { name, tel, email, date, time, menu, note }).catch((e) => console.error('mail error', e));

    return json(201, { ok: true });
  } catch (e) {
    console.error('reserve error', e);
    return json(500, { message: 'server error' });
  }
}

const WD = ['日', '月', '火', '水', '木', '金', '土'];
function fmtDateJp(dateISO) {
  const d = new Date(dateISO + 'T00:00:00Z');
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日（${WD[d.getUTCDay()]}）`;
}

async function sendMail(env, { name, tel, email, date, time, menu, note }) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return; // 未設定なら送らない
  const from = env.RESERVATION_FROM || 'Everglow <onboarding@resend.dev>';
  const salon = env.SALON_EMAIL;
  const dateJp = fmtDateJp(date);
  const yen = '¥' + menu.price.toLocaleString('ja-JP');
  const subject = `【Everglow】ご予約を承りました（${dateJp} ${time}）`;

  const text = `${name} 様\n\nご予約ありがとうございます。下記の内容で承りました。\n\n` +
    `■ メニュー: ${menu.name}（${yen}）\n■ 日時: ${dateJp} ${time}〜（約${menu.min}分）\n` +
    (note ? `■ ご要望: ${note}\n` : '') +
    `\nご変更・キャンセルはお電話にてお願いいたします。\n当日の最終受付は終了の1時間前です。\n\nEverglow ｜ 神奈川県藤沢市〇〇 0-0-0 ｜ 0466-xx-xxxx`;

  const row = (k, v) => `<tr><td style="padding:8px 0;color:#5c5c5c;font-size:13px;width:90px;vertical-align:top">${k}</td><td style="padding:8px 0;font-size:14px;font-weight:600;color:#333">${v}</td></tr>`;
  const html = `<div style="margin:0;background:#f7f6ef;padding:24px">
    <div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #dcd9d2;border-radius:8px;overflow:hidden">
      <div style="background:#8c6b2f;padding:22px 24px"><div style="font-family:Georgia,serif;color:#fcfcf5;font-size:22px;letter-spacing:.06em">Everglow.</div></div>
      <div style="padding:24px">
        <p style="margin:0 0 16px;font-size:15px;color:#333">${escHtml(name)} 様</p>
        <p style="margin:0 0 20px;font-size:14px;color:#5c5c5c;line-height:1.9">ご予約ありがとうございます。下記の内容で承りました。</p>
        <table style="width:100%;border-collapse:collapse;border-top:1px solid #dcd9d2;border-bottom:1px solid #dcd9d2">
          ${row('メニュー', escHtml(menu.name) + `<span style="color:#8c6b2f">（${yen}）</span>`)}
          ${row('日時', `${dateJp} ${time}〜`)}
          ${row('所要', `約${menu.min}分`)}
          ${note ? row('ご要望', escHtml(note)) : ''}
        </table>
        <p style="margin:20px 0 0;font-size:12.5px;color:#5c5c5c;line-height:1.9">ご変更・キャンセルはお電話にてお願いいたします。<br>当日の最終受付は終了の1時間前です。</p>
      </div>
      <div style="padding:16px 24px;background:#f7f6ef;font-size:11px;color:#5c5c5c;line-height:1.8">Everglow ｜ 神奈川県藤沢市〇〇 0-0-0 ｜ 0466-xx-xxxx</div>
    </div>
  </div>`;

  const send = (to, payload) => fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, ...payload }),
  });
  const rc = await send(email, { html, text });
  console.log('[mail] customer', rc.status, (await rc.text()).slice(0, 200));
  // サロン控え（SALON_EMAIL があれば、テキストで通知）
  if (salon) {
    const rs = await send(salon, {
      subject: `【予約】${dateJp} ${time} ${menu.name} / ${name} 様`,
      text: `新規予約\n\n${dateJp} ${time}〜（約${menu.min}分）\n${menu.name}（${yen}）\n\nお名前: ${name}\n電話: ${tel || ''}\nメール: ${email}\n${note ? 'ご要望: ' + note : ''}`,
    });
    console.log('[mail] salon', rs.status, (await rs.text()).slice(0, 150));
  }
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

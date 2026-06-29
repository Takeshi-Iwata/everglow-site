/* POST /.netlify/functions/reserve
 * body: { menuId, date, time, name, tel, email, note }
 * → 201 {ok:true} / 409 {message:"slot_taken"} / 400 / 500
 * メニューの料金・所要時間はサーバー側(_lib)を正とする。
 */
const { SLOT_MIN, menuById, toMin, isYmd, hoursFor, getClient, getTaken, json } = require('./_lib');

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { message: 'method not allowed' });

  let b;
  try { b = JSON.parse(event.body || '{}'); } catch { return json(400, { message: 'invalid json' }); }

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
    const sb = getClient();

    // 二重予約の事前チェック（最終防衛は DB の unique 制約）
    const taken = await getTaken(sb, date);
    if (taken.some((r) => start < r.end && r.start < end)) return json(409, { message: 'slot_taken' });

    const { error } = await sb.from('reservations').insert({
      date, start_time: time, duration_min: menu.min,
      menu_id: menu.id, menu_name: menu.name, price: menu.price,
      name, tel, email, note: note || null,
    });
    if (error) {
      if (error.code === '23505') return json(409, { message: 'slot_taken' }); // unique violation
      console.error('insert error', error);
      return json(500, { message: 'server error' });
    }

    // 確認メール（RESEND_API_KEY があれば送信。無ければスキップ）
    await sendMail({ name, email, date, time, menu, note }).catch((e) => console.error('mail error', e));

    return json(201, { ok: true });
  } catch (e) {
    console.error('reserve error', e);
    return json(500, { message: 'server error' });
  }
};

async function sendMail({ name, email, date, time, menu }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // 未設定なら送らない（Phase 3で有効化）
  const from = process.env.RESERVATION_FROM || 'Everglow <onboarding@resend.dev>';
  const salon = process.env.SALON_EMAIL;
  const subject = `【Everglow】ご予約を承りました（${date} ${time}）`;
  const text = `${name} 様\n\nご予約ありがとうございます。下記の内容で承りました。\n\n` +
    `メニュー: ${menu.name}（¥${menu.price.toLocaleString('ja-JP')}）\n日時: ${date} ${time}〜（約${menu.min}分）\n\n` +
    `ご変更・キャンセルはお電話にてお願いいたします。\nEverglow`;
  const send = (to) => fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, text }),
  });
  await send(email);
  if (salon) await send(salon).catch(() => {}); // サロン控え（任意）
}

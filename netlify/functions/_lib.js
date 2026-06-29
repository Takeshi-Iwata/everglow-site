/* _lib.js — 予約Functionsの共有ロジック（メニュー・営業時間・空き枠計算・Supabase接続）
 * メニューと営業時間はサーバー側を正とする（クライアント送信値は信用しない）。
 */
const { createClient } = require('@supabase/supabase-js');

const SLOT_MIN = 30; // 予約枠の刻み（分）

// メニュー（料金・所要時間の正本）。client(booking.js)の表示用コピーと一致させること。
const MENUS = [
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

// 営業時間（0=日 … 6=土）。月曜(1)は定休＝未定義。
const HOURS = {
  0: { open: '09:00', close: '18:00' },
  2: { open: '10:00', close: '19:00' },
  3: { open: '10:00', close: '19:00' },
  4: { open: '10:00', close: '19:00' },
  5: { open: '10:00', close: '19:00' },
  6: { open: '09:00', close: '18:00' },
};

const menuById = (id) => MENUS.find((m) => m.id === id) || null;
const toMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };
const toHHMM = (min) => String((min / 60) | 0).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const hoursFor = (dateISO) => HOURS[new Date(dateISO + 'T00:00:00Z').getUTCDay()] || null;

// 現在のJST（壁時計）を {todayISO, curMin} で返す
function nowJST() {
  const j = new Date(Date.now() + 9 * 3600 * 1000);
  return { todayISO: j.toISOString().slice(0, 10), curMin: j.getUTCHours() * 60 + j.getUTCMinutes() };
}

// taken: [{start, end}]（分）。営業時間内で durationMin が収まる開始枠を列挙し空き判定。
function buildSlots(dateISO, durationMin, taken) {
  const h = hoursFor(dateISO);
  if (!h) return [];
  const open = toMin(h.open), close = toMin(h.close);
  const { todayISO, curMin } = nowJST();
  const minStart = dateISO === todayISO ? curMin : -1; // 当日は過ぎた枠を除外
  const slots = [];
  for (let t = open; t <= close - durationMin; t += SLOT_MIN) {
    const end = t + durationMin;
    let available = t > minStart;
    if (available) for (const r of taken) { if (t < r.end && r.start < end) { available = false; break; } }
    slots.push({ time: toHHMM(t), available });
  }
  return slots;
}

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Supabase env (SUPABASE_URL / SUPABASE_SECRET_KEY) が未設定です');
  return createClient(url, key, { auth: { persistSession: false } });
}

// その日の予約を取得し taken[] に整形
async function getTaken(sb, dateISO) {
  const { data, error } = await sb.from('reservations').select('start_time,duration_min').eq('date', dateISO);
  if (error) throw error;
  return (data || []).map((r) => { const s = toMin(r.start_time); return { start: s, end: s + r.duration_min }; });
}

const json = (statusCode, obj) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(obj),
});

module.exports = { SLOT_MIN, MENUS, HOURS, menuById, toMin, toHHMM, isYmd, hoursFor, buildSlots, getClient, getTaken, json };

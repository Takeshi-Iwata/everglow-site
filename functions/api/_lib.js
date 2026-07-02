/* functions/api/_lib.js — Cloudflare Pages Functions 用 共有ロジック
 * Supabase は REST(PostgREST) を fetch で直接叩く（npm 依存なし・Workers 互換）。
 * メニューと営業時間はサーバー側を正とする（クライアント送信値は信用しない）。
 */
export const SLOT_MIN = 30; // 予約枠の刻み（分）

// メニュー（料金・所要時間の正本）。client(booking.js)の表示用コピーと一致させること。
export const MENUS = [
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
export const HOURS = {
  0: { open: '09:00', close: '18:00' },
  2: { open: '10:00', close: '19:00' },
  3: { open: '10:00', close: '19:00' },
  4: { open: '10:00', close: '19:00' },
  5: { open: '10:00', close: '19:00' },
  6: { open: '09:00', close: '18:00' },
};

export const menuById = (id) => MENUS.find((m) => m.id === id) || null;
export const toMin = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };
export const toHHMM = (min) => String((min / 60) | 0).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
export const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
export const hoursFor = (dateISO) => HOURS[new Date(dateISO + 'T00:00:00Z').getUTCDay()] || null;

// 現在のJST（壁時計）を {todayISO, curMin} で返す
export function nowJST() {
  const j = new Date(Date.now() + 9 * 3600 * 1000);
  return { todayISO: j.toISOString().slice(0, 10), curMin: j.getUTCHours() * 60 + j.getUTCMinutes() };
}

// taken: [{start, end}]（分）。営業時間内で durationMin が収まる開始枠を列挙し空き判定。
export function buildSlots(dateISO, durationMin, taken) {
  const h = hoursFor(dateISO);
  if (!h) return [];
  const open = toMin(h.open), close = toMin(h.close);
  const { todayISO, curMin } = nowJST();
  const minStart = dateISO === todayISO ? curMin : -1; // 当日は過ぎた枠を除外
  const slots = [];
  // 最終受付は「閉店の1時間前」かつ「施術が閉店までに終わる」時刻まで（掲示ポリシーに合わせる）
  const lastStart = close - Math.max(durationMin, 60);
  for (let t = open; t <= lastStart; t += SLOT_MIN) {
    const end = t + durationMin;
    let available = t > minStart;
    if (available) for (const r of taken) { if (t < r.end && r.start < end) { available = false; break; } }
    slots.push({ time: toHHMM(t), available });
  }
  return slots;
}

/* ---- Supabase REST(PostgREST) ---- */
function sbHeaders(env) {
  const key = env.SUPABASE_SECRET_KEY;
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}
function assertEnv(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    throw new Error('Supabase env (SUPABASE_URL / SUPABASE_SECRET_KEY) が未設定です');
  }
}

// その日の予約を取得し taken[] に整形
export async function getTaken(env, dateISO) {
  assertEnv(env);
  const url = `${env.SUPABASE_URL}/rest/v1/reservations?date=eq.${dateISO}&select=start_time,duration_min`;
  const res = await fetch(url, { headers: sbHeaders(env) });
  if (!res.ok) throw new Error(`supabase select ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return (data || []).map((r) => { const s = toMin(r.start_time); return { start: s, end: s + r.duration_min }; });
}

// 予約を1件挿入。Response をそのまま返す（呼び出し側で status を判定：409=二重予約）。
export async function insertReservation(env, row) {
  assertEnv(env);
  const url = `${env.SUPABASE_URL}/rest/v1/reservations`;
  return fetch(url, {
    method: 'POST',
    headers: { ...sbHeaders(env), Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
}

export const json = (status, obj) => new Response(JSON.stringify(obj), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});

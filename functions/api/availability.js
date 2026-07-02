/* GET /api/availability?date=YYYY-MM-DD&menu=<menuId>
 * → { slots: [{ time:"HH:MM", available:boolean }] }
 */
import { menuById, isYmd, hoursFor, buildSlots, getTaken, json } from './_lib.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const date = url.searchParams.get('date') || '';
  const menu = url.searchParams.get('menu') || '';

  if (!isYmd(date)) return json(400, { message: 'invalid date' });
  const m = menuById(menu);
  if (!m) return json(400, { message: 'invalid menu' });
  if (!hoursFor(date)) return json(200, { slots: [] }); // 定休日

  try {
    const taken = await getTaken(env, date);
    return json(200, { slots: buildSlots(date, m.min, taken) });
  } catch (e) {
    console.error('availability error', e);
    return json(500, { message: 'server error' });
  }
}

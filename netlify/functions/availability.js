/* GET /.netlify/functions/availability?date=YYYY-MM-DD&menu=<menuId>
 * → { slots: [{ time:"HH:MM", available:boolean }] }
 */
const { menuById, isYmd, hoursFor, buildSlots, getClient, getTaken, json } = require('./_lib');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { message: 'method not allowed' });
  const { date, menu } = event.queryStringParameters || {};
  if (!isYmd(date)) return json(400, { message: 'invalid date' });
  const m = menuById(menu);
  if (!m) return json(400, { message: 'invalid menu' });
  if (!hoursFor(date)) return json(200, { slots: [] }); // 定休日

  try {
    const sb = getClient();
    const taken = await getTaken(sb, date);
    return json(200, { slots: buildSlots(date, m.min, taken) });
  } catch (e) {
    console.error('availability error', e);
    return json(500, { message: 'server error', detail: String((e && e.message) || e) });
  }
};

// ── ניטור ייבוא טורנירים אוטומטי ───────────────────────────────────────────
// כל מקור (ג'וקר, LetsPoker, דאבלאפ, ראנר ראנר) מעדכן feed_sources.last_synced רק כשסנכרון
// מצליח. אם עבר יותר זמן מהסף של המקור — הייבוא "תקוע" (האתר של המועדון השתנה, הסורק
// במחשב כבוי, קישור ישן...). אז: התראת דחיפה לאדמין (לכל היותר פעם ביממה לכל מקור)
// ופס אזהרה בראש פאנל הניהול (GET /api/admin/feed-health).
const pool = require('../config/db');

// שעות מקסימליות בין סנכרונים מוצלחים, לפי source_key (הקצב הרגיל + מרווח)
const STALE_HOURS = {
  jokerclub: 8,   // סורק מקומי, כל שעתיים
  letspoker: 14,  // כל 5 שעות
  doubleup: 30,   // פעם ביום ב-22:00
  feed: 30,       // ראנר ראנר — פעם ביום
};
const DEFAULT_STALE_HOURS = 30;
const ALERT_EVERY_HOURS = 24;

async function staleFeeds() {
  const r = await pool.query(`
    SELECT f.id, f.source_key, f.last_synced, f.last_result, v.name AS venue
    FROM feed_sources f JOIN venues v ON v.id = f.venue_id
    WHERE f.active = true`);
  const now = Date.now();
  return r.rows
    .map((f) => {
      const limit = STALE_HOURS[f.source_key] ?? DEFAULT_STALE_HOURS;
      const ageH = f.last_synced ? (now - new Date(f.last_synced).getTime()) / 3600000 : Infinity;
      return { id: f.id, venue: f.venue, source: f.source_key, lastSynced: f.last_synced, ageHours: Math.round(ageH), limitHours: limit, stale: ageH > limit };
    })
    .filter((f) => f.stale);
}

const fmt = (d) => (d ? new Date(d).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'אף פעם');

async function checkFeedsAndAlert() {
  const stale = await staleFeeds();
  if (stale.length === 0) return { stale: 0 };
  const r = await pool.query(`SELECT value FROM app_settings WHERE key = 'feed_alerts'`);
  const sent = r.rows[0] ? JSON.parse(r.rows[0].value) : {};
  const now = Date.now();
  const due = stale.filter((f) => !sent[f.id] || now - new Date(sent[f.id]).getTime() > ALERT_EVERY_HOURS * 3600000);
  if (due.length === 0) return { stale: stale.length, alerted: 0 };

  const body = due.map((f) => `${f.venue}: לא התעדכן מאז ${fmt(f.lastSynced)}`).join('\n');
  try {
    await require('./webPush').sendToAll({
      title: due.length === 1 ? '⚠️ ייבוא טורנירים תקוע' : `⚠️ ${due.length} ייבואי טורנירים תקועים`,
      body,
      url: '/admin',
      tag: 'feed-stale',
    });
  } catch (err) {
    console.error('[feedMonitor] push failed:', err.message);
  }
  for (const f of due) sent[f.id] = new Date().toISOString();
  await pool.query(
    `INSERT INTO app_settings (key, value) VALUES ('feed_alerts', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(sent)]
  );
  console.warn('[feedMonitor] stale feeds:', body.replace(/\n/g, ' | '));
  return { stale: stale.length, alerted: due.length };
}

module.exports = { staleFeeds, checkFeedsAndAlert, STALE_HOURS };

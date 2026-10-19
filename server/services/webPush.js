// ── התראות דחיפה (Web Push) לאדמין ─────────────────────────────────────────
// כל בוקר: "טורנירי היום מוכנים לשיתוף" → לחיצה פותחת את /today (תמונה + שיתוף לוואטסאפ).
// מפתחות VAPID נוצרים פעם אחת ונשמרים ב-DB (app_settings) — אין צורך במשתנה סביבה.
// באייפון: עובד רק כשהאתר נוסף למסך הבית (iOS 16.4+), ההרשמה נעשית מתוך האפליקציה המותקנת.
const webpush = require('web-push');
const pool = require('../config/db');

let vapid = null;

async function getVapidKeys() {
  if (vapid) return vapid;
  const r = await pool.query(`SELECT value FROM app_settings WHERE key = 'vapid_keys'`);
  if (r.rows[0]) {
    vapid = JSON.parse(r.rows[0].value);
  } else {
    const keys = webpush.generateVAPIDKeys();
    // ON CONFLICT: אם שני תהליכים יצרו במקביל — משתמשים במה שנשמר ראשון
    await pool.query(
      `INSERT INTO app_settings (key, value) VALUES ('vapid_keys', $1) ON CONFLICT (key) DO NOTHING`,
      [JSON.stringify(keys)]
    );
    vapid = JSON.parse((await pool.query(`SELECT value FROM app_settings WHERE key = 'vapid_keys'`)).rows[0].value);
  }
  webpush.setVapidDetails(`mailto:${process.env.ADMIN_EMAIL || 'info@pokerisrael.org'}`, vapid.publicKey, vapid.privateKey);
  return vapid;
}

async function saveSubscription(sub, userId, userAgent) {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) throw new Error('invalid subscription');
  await pool.query(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_id, user_agent)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
       user_id = EXCLUDED.user_id, user_agent = EXCLUDED.user_agent`,
    [sub.endpoint, sub.keys.p256dh, sub.keys.auth, userId, String(userAgent || '').slice(0, 300)]
  );
}

async function removeSubscription(endpoint) {
  await pool.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint]);
}

// שולח לכל המנויים (כרגע רק אדמינים נרשמים). מנוי שפג (404/410) נמחק.
async function sendToAll(payload) {
  await getVapidKeys();
  const subs = (await pool.query('SELECT endpoint, p256dh, auth FROM push_subscriptions')).rows;
  let sent = 0, removed = 0, failed = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 6 * 3600, urgency: 'normal' }
      );
      sent++;
      pool.query('UPDATE push_subscriptions SET last_ok = NOW() WHERE endpoint = $1', [s.endpoint]).catch(() => {});
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await removeSubscription(s.endpoint);
        removed++;
      } else {
        failed++;
        console.error('[push] send failed:', err.statusCode || '', err.body || err.message);
      }
    }
  }
  return { total: subs.length, sent, removed, failed };
}

// כמה טורנירים מתקיימים היום — אותו סינון כמו הרשימה הציבורית (בלי פיתיונות ובלי קאש).
// start_time נשמר כשעון-קיר ישראלי (timestamp ללא אזור זמן).
async function countToday() {
  const r = await pool.query(`
    WITH today AS (SELECT (NOW() AT TIME ZONE 'Asia/Jerusalem')::date AS d)
    SELECT COUNT(*)::int AS n
    FROM tournaments t JOIN venues v ON v.id = t.venue_id, today
    WHERE t.status = 'approved' AND t.is_active = true AND v.is_approved = true
      AND t.is_canary = false AND t.tournament_type <> 'cash'
      AND (
        (t.is_recurring AND COALESCE(t.day_of_week, EXTRACT(DOW FROM t.start_time)::int) = EXTRACT(DOW FROM today.d)::int
          AND NOT (COALESCE(t.skipped_dates, '[]'::jsonb) ? to_char(today.d, 'YYYY-MM-DD')))
        OR (NOT t.is_recurring AND t.start_time::date = today.d)
      )`);
  return r.rows[0].n;
}

async function sendDailyShareReminder() {
  const n = await countToday();
  if (n === 0) return { skipped: 'no tournaments today' };
  return sendToAll({
    title: '📲 טורנירי היום מוכנים לשיתוף',
    body: `${n} טורנירים היום — לחץ, ואז "שתף בוואטסאפ"`,
    url: '/today',
    tag: 'daily-share',
  });
}

module.exports = { getVapidKeys, saveSubscription, removeSubscription, sendToAll, sendDailyShareReminder, countToday };

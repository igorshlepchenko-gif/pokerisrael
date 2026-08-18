const pool = require('../config/db');

// מדידת ניסויי A/B. ציבורי בכוונה — האירועים נשלחים מדפדפן של מבקר לא מחובר.
//
// visitor הוא מזהה אקראי שנוצר בדפדפן ונשמר ב-localStorage. אין בו מידע מזהה,
// והוא משמש רק כדי לספור כל מבקר פעם אחת (ראה האינדקס הייחודי ב-ensureSchema).

const ALLOWED = {
  nearby_button: { variants: ['a', 'b'], events: ['impression', 'click'] },
};

exports.track = async (req, res) => {
  const { test_key, variant, event, visitor } = req.body || {};
  const spec = ALLOWED[test_key];

  // ולידציה מול רשימה סגורה — הנתיב פתוח לכל, ובלי זה אפשר היה להזרים
  // מפתחות/וריאנטים שרירותיים ולזהם את התוצאות
  if (!spec) return res.status(400).json({ message: 'unknown test' });
  if (!spec.variants.includes(variant)) return res.status(400).json({ message: 'unknown variant' });
  if (!spec.events.includes(event)) return res.status(400).json({ message: 'unknown event' });
  if (typeof visitor !== 'string' || !/^[a-z0-9-]{8,64}$/i.test(visitor)) {
    return res.status(400).json({ message: 'bad visitor id' });
  }

  try {
    // הווריאנט נלקח מהשורה הראשונה שנרשמה למבקר הזה, ולא מהערך שהלקוח שלח.
    // אחרת מבקר שהווריאנט שלו השתנה (ניקוי חלקי של localStorage, שינוי בהגרלה)
    // היה נספר כחשיפה בגרסה אחת וכהקלקה בגרסה השנייה — מה שמייצר גרסה עם
    // הקלקות בלי חשיפות, כלומר אחוז הקלקה מנופח או אפילו מעל 100%.
    await pool.query(
      `INSERT INTO ab_events (test_key, variant, event, visitor)
       SELECT $1::varchar,
              COALESCE((SELECT e.variant FROM ab_events e
                        WHERE e.test_key = $1::varchar AND e.visitor = $4::varchar
                        ORDER BY e.id LIMIT 1), $2::varchar),
              $3::varchar, $4::varchar
       ON CONFLICT (test_key, visitor, event) DO NOTHING`,
      [test_key, variant, event, visitor]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

// תוצאות — לאדמין בלבד (הנתיב רשום תחת /api/admin)
exports.results = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT test_key, variant,
             COUNT(*) FILTER (WHERE event='impression')::int AS impressions,
             COUNT(*) FILTER (WHERE event='click')::int      AS clicks,
             MIN(created_at) AS first_seen,
             MAX(created_at) AS last_seen
      FROM ab_events
      GROUP BY test_key, variant
      ORDER BY test_key, variant`);
    res.json(r.rows.map(x => ({
      ...x,
      ctr: x.impressions > 0 ? +(x.clicks / x.impressions * 100).toFixed(1) : null,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

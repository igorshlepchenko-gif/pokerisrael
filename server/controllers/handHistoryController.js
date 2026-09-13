const pool = require('../config/db');

// משותף ליצירה ולעדכון — אותה יד, אותם כללים. מחזיר הודעת שגיאה או null.
function validateHand({ game_type, hero_position, hero_cards, result }) {
  if (!game_type || !['tournament', 'cash', 'tournament_online', 'cash_online'].includes(game_type))
    return 'סוג משחק לא תקין';
  if (!hero_position) return 'עמדה חסרה';
  if (!hero_cards || !Array.isArray(hero_cards) || hero_cards.length !== 2)
    return 'יש לבחור 2 קלפים';
  // 'unknown' = יד שנעצרה מכוונת בנקודת החלטה (כפתור "?" באשף) בלי לחשוף
  // תוצאה — כדי לשתף ולקבל פידבק על ההחלטה בלי הטיית hindsight אצל הנשאלים
  if (!result || !['won', 'lost', 'split', 'unknown'].includes(result))
    return 'תוצאה לא תקינה';
  return null;
}

// סדר העמודות זהה ב-INSERT וב-UPDATE, כדי ששני המסלולים ישמרו יד באותה צורה בדיוק
function handColumns(body) {
  const {
    game_type, tournament_stage, blind_sb, blind_bb, ante, cash_stakes,
    players_count, hero_position, hero_stack, hero_cards,
    hand_data, result, hero_profit, narrative, notes,
  } = body;
  return [
    game_type, tournament_stage || null,
    blind_sb || null, blind_bb || null, ante || 0, cash_stakes || null,
    players_count || 2, hero_position, hero_stack || 0,
    JSON.stringify(hero_cards), JSON.stringify(hand_data || {}),
    result, hero_profit || null, narrative || null, notes || null,
  ];
}

const hasHandLoggerAccess = (user) => user.hand_logger_access || user.role === 'admin';

exports.createHand = async (req, res) => {
  // בדיקת הרשאת גישה למודול
  if (!hasHandLoggerAccess(req.user)) {
    return res.status(403).json({ message: 'אין לך הרשאה למודול רישום ידיים' });
  }

  const invalid = validateHand(req.body);
  if (invalid) return res.status(400).json({ message: invalid });

  // מגבלת 20 ידיים שמורות למשתמש — הבדיקה וההכנסה בתוך אותה טרנזקציה, נעולות
  // ב-advisory lock לפי user_id, כדי ששתי שמירות מקבילות מאותו משתמש לא יעברו
  // את הבדיקה שתיהן לפני שאף אחת הספיקה לכתוב (TOCTOU) ויביאו אותו מעל 20
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [req.user.id]);
    const countRes = await client.query(
      'SELECT COUNT(*) FROM hand_histories WHERE user_id = $1',
      [req.user.id]
    );
    if (parseInt(countRes.rows[0].count) >= 20) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        message: `הגעת למגבלת 20 ידיים שמורות. מחק ידיים ישנות כדי לפנות מקום.`,
      });
    }
    const r = await client.query(
      `INSERT INTO hand_histories
        (user_id, game_type, tournament_stage, blind_sb, blind_bb, ante, cash_stakes,
         players_count, hero_position, hero_stack, hero_cards, hand_data, result, hero_profit, narrative, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id, created_at`,
      [req.user.id, ...handColumns(req.body)]
    );
    await client.query('COMMIT');
    res.status(201).json({ id: r.rows[0].id, created_at: r.rows[0].created_at });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  } finally {
    client.release();
  }
};

// עדכון יד שמורה במקומה. בלי בדיקת מגבלת 20 — לא נוספת יד, והמשתמש שכבר
// במגבלה חייב להיות מסוגל לתקן יד קיימת. created_at לא משתנה, כך שהיד
// נשארת במקומה ברשימה. WHERE user_id — אפשר לעדכן רק יד של עצמך.
exports.updateHand = async (req, res) => {
  if (!hasHandLoggerAccess(req.user)) {
    return res.status(403).json({ message: 'אין לך הרשאה למודול רישום ידיים' });
  }
  const id = parseInt(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'מזהה יד לא תקין' });

  const invalid = validateHand(req.body);
  if (invalid) return res.status(400).json({ message: invalid });

  try {
    const r = await pool.query(
      `UPDATE hand_histories SET
         game_type = $1, tournament_stage = $2, blind_sb = $3, blind_bb = $4, ante = $5,
         cash_stakes = $6, players_count = $7, hero_position = $8, hero_stack = $9,
         hero_cards = $10, hand_data = $11, result = $12, hero_profit = $13,
         narrative = $14, notes = $15
       WHERE id = $16 AND user_id = $17
       RETURNING id, created_at`,
      [...handColumns(req.body), id, req.user.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'יד לא נמצאה' });
    res.json({ id: r.rows[0].id, created_at: r.rows[0].created_at });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.getUserHands = async (req, res) => {
  // parseInt('-5') === -5, שהוא truthy — || ברירת המחדל לא תופס מספרים שליליים,
  // והם היו ממשיכים ישר ל-LIMIT/OFFSET שלילי ב-SQL שפוסטגרס דוחה עם 500 גנרי
  const rawLimit = req.query.limit !== undefined ? parseInt(req.query.limit) : 20;
  const rawOffset = req.query.offset !== undefined ? parseInt(req.query.offset) : 0;
  if (!Number.isInteger(rawLimit) || rawLimit < 0 || !Number.isInteger(rawOffset) || rawOffset < 0) {
    return res.status(400).json({ message: 'limit/offset לא תקינים' });
  }
  const limit = Math.min(rawLimit, 50);
  const offset = rawOffset;
  try {
    const r = await pool.query(
      `SELECT id, game_type, tournament_stage, blind_sb, blind_bb, ante, cash_stakes,
              players_count, hero_position, hero_stack, hero_cards, hand_data,
              result, hero_profit, narrative, notes, created_at
       FROM hand_histories
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    const count = await pool.query('SELECT COUNT(*) FROM hand_histories WHERE user_id = $1', [req.user.id]);
    res.json({ hands: r.rows, total: parseInt(count.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.deleteHand = async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM hand_histories WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'יד לא נמצאה' });
    res.json({ message: 'היד נמחקה' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

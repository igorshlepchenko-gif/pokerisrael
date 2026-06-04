const pool = require('../config/db');

exports.createHand = async (req, res) => {
  const {
    game_type, tournament_stage, blind_sb, blind_bb, ante, cash_stakes,
    players_count, hero_position, hero_stack, hero_cards,
    hand_data, result, hero_profit, narrative, notes,
  } = req.body;

  // בדיקת הרשאת גישה למודול
  if (!req.user.hand_logger_access && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'אין לך הרשאה למודול רישום ידיים' });
  }

  if (!game_type || !['tournament', 'cash', 'tournament_online', 'cash_online'].includes(game_type))
    return res.status(400).json({ message: 'סוג משחק לא תקין' });
  if (!hero_position) return res.status(400).json({ message: 'עמדה חסרה' });
  if (!hero_cards || !Array.isArray(hero_cards) || hero_cards.length !== 2)
    return res.status(400).json({ message: 'יש לבחור 2 קלפים' });
  if (!result || !['won', 'lost', 'split'].includes(result))
    return res.status(400).json({ message: 'תוצאה לא תקינה' });

  try {
    // מגבלת 20 ידיים שמורות למשתמש
    const countRes = await pool.query(
      'SELECT COUNT(*) FROM hand_histories WHERE user_id = $1',
      [req.user.id]
    );
    if (parseInt(countRes.rows[0].count) >= 20) {
      return res.status(403).json({
        message: `הגעת למגבלת 20 ידיים שמורות. מחק ידיים ישנות כדי לפנות מקום.`,
      });
    }
    const r = await pool.query(
      `INSERT INTO hand_histories
        (user_id, game_type, tournament_stage, blind_sb, blind_bb, ante, cash_stakes,
         players_count, hero_position, hero_stack, hero_cards, hand_data, result, hero_profit, narrative, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id, created_at`,
      [
        req.user.id, game_type, tournament_stage || null,
        blind_sb || null, blind_bb || null, ante || 0, cash_stakes || null,
        players_count || 2, hero_position, hero_stack || 0,
        JSON.stringify(hero_cards), JSON.stringify(hand_data || {}),
        result, hero_profit || null, narrative || null, notes || null,
      ]
    );
    res.status(201).json({ id: r.rows[0].id, created_at: r.rows[0].created_at });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.getUserHands = async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const offset = parseInt(req.query.offset) || 0;
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

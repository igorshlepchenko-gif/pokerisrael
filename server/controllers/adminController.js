const pool = require('../config/db');

exports.getPending = async (req, res) => {
  try {
    const [venues, tournaments] = await Promise.all([
      pool.query('SELECT v.*, u.name AS owner_name, u.email AS owner_email, u.phone AS owner_phone FROM venues v JOIN users u ON v.owner_id = u.id WHERE v.is_approved = false ORDER BY v.created_at DESC'),
      pool.query(`SELECT t.*, v.name AS venue_name, u.name AS owner_name
                  FROM tournaments t JOIN venues v ON t.venue_id = v.id JOIN users u ON t.created_by = u.id
                  WHERE t.status = 'pending' ORDER BY t.created_at DESC`),
    ]);
    res.json({ venues: venues.rows, tournaments: tournaments.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.approveVenue = async (req, res) => {
  try {
    await pool.query('UPDATE venues SET is_approved = true WHERE id = $1', [req.params.id]);
    res.json({ message: 'המקום אושר בהצלחה' });
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.rejectVenue = async (req, res) => {
  try {
    await pool.query('DELETE FROM venues WHERE id = $1', [req.params.id]);
    res.json({ message: 'המקום נדחה ונמחק' });
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.approveTournament = async (req, res) => {
  try {
    await pool.query("UPDATE tournaments SET status = 'approved', updated_at = NOW() WHERE id = $1", [req.params.id]);
    res.json({ message: 'הטורניר אושר בהצלחה' });
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.rejectTournament = async (req, res) => {
  const { reason } = req.body;
  try {
    await pool.query(
      "UPDATE tournaments SET status = 'rejected', rejection_reason = $1, updated_at = NOW() WHERE id = $2",
      [reason || '', req.params.id]
    );
    res.json({ message: 'הטורניר נדחה' });
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.boostTournament = async (req, res) => {
  const { label } = req.body;
  try {
    const result = await pool.query(
      `UPDATE tournaments
       SET is_boosted = NOT is_boosted,
           boost_label = CASE WHEN NOT is_boosted THEN $1 ELSE '' END,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, is_boosted, boost_label`,
      [label || 'מקודם', req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'טורניר לא נמצא' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.getAllVenues = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT v.*, u.name AS owner_name, u.email AS owner_email, u.phone AS owner_phone
      FROM venues v JOIN users u ON v.owner_id = u.id
      ORDER BY v.is_approved ASC, v.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.getAllTournaments = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.id, t.name, t.status, t.start_time, t.cost, t.is_boosted, t.boost_label,
             v.name AS venue_name
      FROM tournaments t JOIN venues v ON t.venue_id = v.id
      WHERE t.status = 'approved'
      ORDER BY t.is_boosted DESC, t.start_time ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, phone, role, is_active,
              is_locked, failed_login_attempts, locked_at, created_at
       FROM users
       ORDER BY is_locked DESC, created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.toggleUser = async (req, res) => {
  try {
    // מניעת כיבוי עצמי
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ message: 'לא ניתן לכבות את החשבון שלך' });
    }
    // מניעת כיבוי אדמינים אחרים
    const target = await pool.query('SELECT role FROM users WHERE id = $1', [req.params.id]);
    if (target.rows[0]?.role === 'admin') {
      return res.status(403).json({ message: 'לא ניתן לכבות חשבון אדמין' });
    }
    const result = await pool.query(
      'UPDATE users SET is_active = NOT is_active WHERE id = $1 RETURNING is_active',
      [req.params.id]
    );
    res.json({ is_active: result.rows[0].is_active });
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.unlockUser = async (req, res) => {
  try {
    await pool.query(
      'UPDATE users SET is_locked = false, failed_login_attempts = 0, locked_at = NULL WHERE id = $1',
      [req.params.id]
    );
    res.json({ message: 'החשבון שוחרר בהצלחה' });
  } catch (err) {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.getChangeLogs = async (req, res) => {
  try {
    const { entity_type, action, date_from, date_to, search, offset = 0 } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);

    const params = [];
    const conditions = [];

    if (entity_type) {
      params.push(entity_type);
      conditions.push(`cl.entity_type = $${params.length}`);
    }
    if (action) {
      params.push(action);
      conditions.push(`cl.action = $${params.length}`);
    }
    if (date_from) {
      params.push(date_from);
      conditions.push(`cl.created_at >= $${params.length}::date`);
    }
    if (date_to) {
      params.push(date_to);
      conditions.push(`cl.created_at < ($${params.length}::date + interval '1 day')`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(cl.entity_name ILIKE $${params.length}
          OR cl.changed_by_name ILIKE $${params.length}
          OR cl.new_data::text ILIKE $${params.length}
          OR cl.old_data::text ILIKE $${params.length})`
      );
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(parseInt(limit), parseInt(offset));
    const result = await pool.query(
      `SELECT
         cl.id, cl.entity_type, cl.entity_id, cl.entity_name,
         cl.action, cl.changed_by_name, cl.old_data, cl.new_data,
         cl.created_at
       FROM change_logs cl
       ${where}
       ORDER BY cl.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countParams = params.slice(0, params.length - 2);
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM change_logs cl ${where}`,
      countParams
    );

    res.json({ logs: result.rows, total: parseInt(countResult.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

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

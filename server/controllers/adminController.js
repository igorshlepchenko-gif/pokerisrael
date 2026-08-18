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
    const result = await pool.query('UPDATE venues SET is_approved = true WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'מועדון לא נמצא' });
    res.json({ message: 'המקום אושר בהצלחה' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.rejectVenue = async (req, res) => {
  try {
    const venue = await pool.query('SELECT is_approved FROM venues WHERE id = $1', [req.params.id]);
    if (!venue.rows[0]) return res.status(404).json({ message: 'מועדון לא נמצא' });

    // אותו endpoint משמש גם לדחיית בקשה שמעולם לא פורסמה (בטוח, is_approved=false)
    // וגם למחיקת מועדון חי עם טורנירים אמיתיים — אלו שתי פעולות שונות לגמרי בהשלכות.
    // עבור מועדון חי דורשים אישור עם מספר הטורנירים העדכני שיימחקו, לא רק קליק אחד:
    // מונע בדיוק את המקרה של טאב ניהול פתוח (stale) שמציג התראה גנרית ולא ספירה
    // אמיתית, ומאפשר למחוק בטעות מועדון פעיל בלי לדעת כמה נמחק יחד איתו.
    if (venue.rows[0].is_approved) {
      const tCount = await pool.query('SELECT COUNT(*)::int AS count FROM tournaments WHERE venue_id = $1', [req.params.id]);
      const actualCount = tCount.rows[0].count;
      const confirmedCount = Number.isInteger(req.body?.confirmTournamentCount) ? req.body.confirmTournamentCount : null;
      if (confirmedCount !== actualCount) {
        return res.status(409).json({
          message: `למועדון יש כרגע ${actualCount} טורנירים שיימחקו יחד איתו — יש לאשר שוב עם המספר המעודכן`,
          tournamentCount: actualCount,
        });
      }
    }

    await pool.query('DELETE FROM venues WHERE id = $1', [req.params.id]);
    res.json({ message: 'המקום נדחה ונמחק' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.approveTournament = async (req, res) => {
  try {
    const result = await pool.query("UPDATE tournaments SET status = 'approved', updated_at = NOW() WHERE id = $1 RETURNING id", [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'טורניר לא נמצא' });
    res.json({ message: 'הטורניר אושר בהצלחה' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.rejectTournament = async (req, res) => {
  const { reason } = req.body;
  try {
    const result = await pool.query(
      "UPDATE tournaments SET status = 'rejected', rejection_reason = $1, updated_at = NOW() WHERE id = $2 RETURNING id",
      [reason || '', req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'טורניר לא נמצא' });
    res.json({ message: 'הטורניר נדחה' });
  } catch (err) {
    console.error(err);
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
      SELECT v.*, u.name AS owner_name, u.email AS owner_email, u.phone AS owner_phone,
             (SELECT COUNT(*)::int FROM tournaments t WHERE t.venue_id = v.id) AS tournament_count
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
      WHERE t.status = 'approved' AND t.is_active = true
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
              is_locked, failed_login_attempts, locked_at, created_at,
              hand_logger_access
       FROM users
       ORDER BY is_locked DESC, created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
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
    if (!result.rows[0]) return res.status(404).json({ message: 'משתמש לא נמצא' });
    res.json({ is_active: result.rows[0].is_active });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.unlockUser = async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE users SET is_locked = false, failed_login_attempts = 0, locked_at = NULL WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'משתמש לא נמצא' });
    res.json({ message: 'החשבון שוחרר בהצלחה' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.toggleHandLoggerAccess = async (req, res) => {
  try {
    const r = await pool.query(
      `UPDATE users SET hand_logger_access = NOT COALESCE(hand_logger_access, false)
       WHERE id = $1 RETURNING id, name, hand_logger_access`,
      [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ message: 'משתמש לא נמצא' });
    const { name, hand_logger_access } = r.rows[0];
    res.json({ hand_logger_access, message: `${name}: גישה לרישום ידיים ${hand_logger_access ? 'הופעלה' : 'כובתה'}` });
  } catch (err) {
    console.error(err);
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

// ── ניהול מיקומים (locations) ──────────────────────────────────────────────
//
// טבלת locations ממפה כתובת -> קואורדינטות, וזה מה שמאפשר לטורניר שנוצר
// אוטומטית ע"י הסוכן לקבל מיקום נכון בלי התערבות. כתובת שאינה ממופה מקבלת
// NULL בכוונה (ולא את מיקום המועדון, שנמצא בעיר אחרת) — ולכן הטורניר פשוט
// לא מוצע ב"מצא טורניר קרוב אליי". השקט הזה הוא בדיוק מה שהמסך הזה חושף.

const IL_BOUNDS = { latMin: 29.4, latMax: 33.4, lngMin: 34.2, lngMax: 35.95 };

function validateCoords(latitude, longitude) {
  const lat = Number(latitude), lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'קואורדינטות חייבות להיות מספרים';
  if (lat < IL_BOUNDS.latMin || lat > IL_BOUNDS.latMax || lng < IL_BOUNDS.lngMin || lng > IL_BOUNDS.lngMax) {
    return `הקואורדינטות (${lat}, ${lng}) נמצאות מחוץ לגבולות ישראל — כנראה טעות הקלדה או סדר הפוך`;
  }
  return null;
}

exports.getLocations = async (req, res) => {
  try {
    const [locations, unmapped, venuesMissing] = await Promise.all([
      pool.query(`
        SELECT l.*,
          (SELECT COUNT(*)::int FROM tournaments t
            WHERE normalize_address(t.address) = normalize_address(l.address)) AS tournament_count,
          (SELECT COUNT(*)::int FROM venues v
            WHERE normalize_address(v.address) = normalize_address(l.address)) AS venue_count
        FROM locations l ORDER BY l.city NULLS LAST, l.address`),
      // כתובות של טורנירים פעילים שאין להן מיפוי — אלה שנופלים מההצעות
      pool.query(`
        SELECT t.address, COALESCE(t.city,'') AS city, v.name AS venue_name, COUNT(*)::int AS n
        FROM tournaments t JOIN venues v ON t.venue_id = v.id
        WHERE t.status='approved' AND t.is_active = true AND v.is_approved = true
          AND t.tournament_type <> 'online'
          AND t.address IS NOT NULL AND t.latitude IS NULL
          AND normalize_address(t.address) <> normalize_address(v.address)
          AND NOT EXISTS (SELECT 1 FROM locations l
                          WHERE normalize_address(l.address) = normalize_address(t.address))
        GROUP BY 1,2,3 ORDER BY n DESC`),
      pool.query(`
        SELECT id, name, address, city FROM venues
        WHERE venue_type <> 'online' AND is_approved = true AND latitude IS NULL
          AND NOT EXISTS (SELECT 1 FROM locations l
                          WHERE normalize_address(l.address) = normalize_address(venues.address))
        ORDER BY name`),
    ]);
    res.json({
      locations: locations.rows,
      unmapped: unmapped.rows,
      venuesMissing: venuesMissing.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.createLocation = async (req, res) => {
  const { address, city, latitude, longitude, notes } = req.body;
  if (!address || !String(address).trim()) return res.status(400).json({ message: 'כתובת היא שדה חובה' });
  const bad = validateCoords(latitude, longitude);
  if (bad) return res.status(400).json({ message: bad });
  try {
    const r = await pool.query(
      `INSERT INTO locations (address, city, latitude, longitude, source, notes)
       VALUES ($1,$2,$3,$4,'manual',$5)
       ON CONFLICT (address) DO UPDATE
         SET city=$2, latitude=$3, longitude=$4, notes=$5, updated_at=NOW()
       RETURNING *`,
      [String(address).trim(), city || null, Number(latitude), Number(longitude), notes || null]);
    res.json({ message: 'המיקום נשמר', location: r.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.updateLocation = async (req, res) => {
  const { address, city, latitude, longitude, notes } = req.body;
  if (!address || !String(address).trim()) return res.status(400).json({ message: 'כתובת היא שדה חובה' });
  const bad = validateCoords(latitude, longitude);
  if (bad) return res.status(400).json({ message: bad });
  try {
    const r = await pool.query(
      `UPDATE locations SET address=$1, city=$2, latitude=$3, longitude=$4, notes=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [String(address).trim(), city || null, Number(latitude), Number(longitude), notes || null, req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ message: 'מיקום לא נמצא' });
    res.json({ message: 'המיקום עודכן', location: r.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: 'כתובת זו כבר קיימת' });
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.deleteLocation = async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM locations WHERE id=$1 RETURNING address', [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ message: 'מיקום לא נמצא' });
    res.json({ message: `המיקום "${r.rows[0].address}" נמחק` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

const pool = require('../config/db');
const { validationResult } = require('express-validator');
const XLSX = require('xlsx');

const DAYS_MAP_HE = { 'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'שישי': 5, 'שבת': 6 };

exports.getAll = async (req, res) => {
  try {
    const { city, day, search, sort } = req.query;
    const hasFilters = city || day !== undefined || search;

    const baseSelect = `
      SELECT
        t.id, t.name, t.description, t.cost, t.start_time, t.estimated_end_time,
        t.stages, t.starting_stack, t.level_duration, t.is_recurring, t.day_of_week, t.status,
        t.is_boosted, t.boost_label,
        v.id AS venue_id, v.name AS venue_name, v.address AS venue_address,
        v.city AS venue_city, v.whatsapp_number, v.logo_url AS venue_logo
      FROM tournaments t
      JOIN venues v ON t.venue_id = v.id
    `;

    // מיון
    const sortClause = sort === 'venue_name'
      ? 'ORDER BY t.is_boosted DESC, v.name ASC'
      : 'ORDER BY t.is_boosted DESC, t.start_time ASC';

    let query, params = [], idx = 1;

    if (hasFilters) {
      // מקודמים תמיד מוצגים + תוצאות שמתאימות לפילטר
      const filterParts = [];
      if (city) { filterParts.push(`v.city ILIKE $${idx++}`); params.push(`%${city}%`); }
      if (day !== undefined) { filterParts.push(`t.day_of_week = $${idx++}`); params.push(parseInt(day)); }
      if (search) {
        filterParts.push(`(t.name ILIKE $${idx} OR v.name ILIKE $${idx})`);
        params.push(`%${search}%`);
        idx++;
      }

      query = `${baseSelect}
        WHERE t.status = 'approved' AND v.is_approved = true
        AND (t.is_boosted = true OR (${filterParts.join(' AND ')}))
        ${sortClause}`;
    } else {
      query = `${baseSelect}
        WHERE t.status = 'approved' AND v.is_approved = true
        ${sortClause}`;
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.getMyTournaments = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, v.name AS venue_name, v.address AS venue_address
       FROM tournaments t
       JOIN venues v ON t.venue_id = v.id
       WHERE v.owner_id = $1
       ORDER BY t.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.create = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { venue_id, name, description, cost, start_time, estimated_end_time, stages, starting_stack, level_duration, is_recurring, day_of_week } = req.body;

  try {
    const venueCheck = await pool.query(
      'SELECT id FROM venues WHERE id = $1 AND owner_id = $2 AND is_approved = true',
      [venue_id, req.user.id]
    );
    if (!venueCheck.rows[0]) {
      return res.status(403).json({ message: 'אין לך הרשאה להוסיף טורניר למקום זה' });
    }

    const result = await pool.query(
      `INSERT INTO tournaments
        (venue_id, name, description, cost, start_time, estimated_end_time, stages, starting_stack, level_duration, is_recurring, day_of_week, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [venue_id, name, description, cost, start_time, estimated_end_time,
       JSON.stringify(stages || []), starting_stack || null, level_duration || null, is_recurring || false, day_of_week, req.user.id]
    );

    res.status(201).json({
      tournament: result.rows[0],
      message: 'הטורניר נשלח לאישור המנהל. תקבל עדכון בקרוב.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.getVenuesByOwner = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM venues WHERE owner_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.bulkCreate = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'לא נשלח קובץ' });

    const { venue_id } = req.body;
    if (!venue_id) return res.status(400).json({ message: 'יש לבחור מקום' });

    // אימות בעלות על המקום
    const venueCheck = await pool.query(
      'SELECT id FROM venues WHERE id = $1 AND owner_id = $2 AND is_approved = true',
      [venue_id, req.user.id]
    );
    if (!venueCheck.rows[0]) {
      return res.status(403).json({ message: 'אין הרשאה להוסיף טורנירים למקום זה' });
    }

    // פענוח הקובץ
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rows.length === 0) return res.status(400).json({ message: 'הקובץ ריק — לא נמצאו שורות נתונים' });
    if (rows.length > 10) return res.status(400).json({ message: `הקובץ מכיל ${rows.length} שורות — המקסימום הוא 10 טורנירים` });

    const parsed = [];
    const errors = [];

    rows.forEach((row, i) => {
      const rowNum = i + 2; // שורה 1 = כותרות

      const name        = String(row['שם טורניר'] || '').trim();
      const description = String(row['תיאור'] || '').trim();
      const cost        = row['עלות'];
      const dateStr     = String(row['תאריך התחלה'] || '').trim();
      const timeStr     = String(row['שעת התחלה'] || '').trim();
      const endTimeStr  = String(row['שעת סיום משוערת'] || '').trim();
      const recurStr    = String(row['חוזר שבועי'] || 'לא').trim();
      const dayStr      = String(row['יום בשבוע'] || '').trim();

      if (!name)    { errors.push(`שורה ${rowNum}: שם הטורניר חסר`); return; }
      if (!dateStr) { errors.push(`שורה ${rowNum}: תאריך התחלה חסר`); return; }
      if (!timeStr) { errors.push(`שורה ${rowNum}: שעת התחלה חסרה`); return; }
      if (cost === '' || isNaN(parseFloat(cost))) { errors.push(`שורה ${rowNum}: עלות לא תקינה`); return; }

      // פענוח תאריך — תומך ב-DD/MM/YYYY וב-Date אוטומטי של xlsx
      let start_time = null;
      try {
        if (dateStr instanceof Date) {
          start_time = new Date(dateStr);
        } else if (!isNaN(dateStr)) {
          // מספר סריאלי של Excel
          const d = XLSX.SSF.parse_date_code(parseFloat(dateStr));
          start_time = new Date(d.y, d.m - 1, d.d);
        } else {
          const parts = dateStr.split('/');
          if (parts.length !== 3) throw new Error('bad format');
          start_time = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
        if (isNaN(start_time.getTime())) throw new Error('invalid date');

        // הוספת שעה
        const [hh, mm] = timeStr.split(':');
        start_time.setHours(parseInt(hh) || 0, parseInt(mm) || 0, 0, 0);
      } catch {
        errors.push(`שורה ${rowNum}: פורמט תאריך לא תקין — נדרש DD/MM/YYYY`);
        return;
      }

      let estimated_end_time = null;
      if (endTimeStr) {
        try {
          const [hh, mm] = endTimeStr.split(':');
          estimated_end_time = new Date(start_time);
          estimated_end_time.setHours(parseInt(hh) || 0, parseInt(mm) || 0, 0, 0);
          if (estimated_end_time <= start_time) estimated_end_time.setDate(estimated_end_time.getDate() + 1);
        } catch { /* מתעלם משעת סיום לא תקינה */ }
      }

      const is_recurring = ['כן', 'yes', 'true', '1'].includes(recurStr.toLowerCase());
      let day_of_week = null;
      if (is_recurring) {
        if (DAYS_MAP_HE[dayStr] !== undefined)          day_of_week = DAYS_MAP_HE[dayStr];
        else if (!isNaN(dayStr) && dayStr !== '')       day_of_week = parseInt(dayStr);
        else                                            day_of_week = start_time.getDay();
      }

      parsed.push({ name, description, cost: parseFloat(cost), start_time, estimated_end_time, is_recurring, day_of_week });
    });

    if (errors.length > 0) return res.status(400).json({ message: 'נמצאו שגיאות בקובץ', errors });

    // הכנסה לבסיס הנתונים
    const inserted = [];
    for (const t of parsed) {
      const result = await pool.query(
        `INSERT INTO tournaments
           (venue_id, name, description, cost, start_time, estimated_end_time, stages, is_recurring, day_of_week, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, name`,
        [venue_id, t.name, t.description, t.cost, t.start_time, t.estimated_end_time,
         JSON.stringify([]), t.is_recurring, t.day_of_week, req.user.id]
      );
      inserted.push(result.rows[0]);
    }

    res.status(201).json({
      message: `${inserted.length} טורנירים נשלחו לאישור המנהל בהצלחה`,
      tournaments: inserted,
    });
  } catch (err) {
    console.error('bulkCreate error:', err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.createVenue = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, address, city, whatsapp_number, description, logo_url } = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO venues (owner_id, name, address, city, whatsapp_number, description, logo_url) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [req.user.id, name, address, city, whatsapp_number, description, logo_url || null]
    );
    res.status(201).json({
      venue: result.rows[0],
      message: 'המקום נשלח לאישור המנהל.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

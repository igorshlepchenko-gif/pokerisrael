const pool = require('../config/db');
const { validationResult } = require('express-validator');
const ExcelJS = require('exceljs');
const { BLIND_PRESETS, presetToStages } = require('../config/blindPresets');

const DAYS_MAP_HE = { 'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'שישי': 5, 'שבת': 6 };

exports.getPublicVenues = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, logo_url FROM venues WHERE is_approved = true ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.getAll = async (req, res) => {
  try {
    const { city, day, search, sort, venue_ids, gtd_min, tournament_type } = req.query;
    const hasFilters = city || day !== undefined || search || venue_ids || gtd_min || tournament_type;

    const baseSelect = `
      SELECT
        t.id, t.name, t.description, t.cost, t.start_time, t.estimated_end_time,
        t.stages, t.starting_stack, t.level_duration, t.is_recurring, t.day_of_week, t.status,
        t.is_boosted, t.boost_label, t.re_entry, t.late_reg_level, t.gtd, t.tournament_type, t.rake, t.rake_type,
        v.id AS venue_id, v.name AS venue_name, v.address AS venue_address,
        v.city AS venue_city, v.whatsapp_number, v.logo_url AS venue_logo
      FROM tournaments t
      JOIN venues v ON t.venue_id = v.id
    `;

    // מיון
    const sortClause =
      sort === 'venue_name' ? 'ORDER BY t.is_boosted DESC, v.name ASC' :
      sort === 'cost_asc'   ? 'ORDER BY t.is_boosted DESC, t.cost ASC NULLS LAST' :
      sort === 'cost_desc'  ? 'ORDER BY t.is_boosted DESC, t.cost DESC NULLS LAST' :
      sort === 'day'        ? 'ORDER BY t.is_boosted DESC, t.day_of_week ASC NULLS LAST, t.start_time ASC' :
      /* start_time default */ 'ORDER BY t.is_boosted DESC, t.start_time ASC';

    let query, params = [], idx = 1;

    // הסתרת טורנירים שעבר זמנם — חוזרים תמיד גלויים
    const notPastClause = `(t.is_recurring = true OR COALESCE(t.estimated_end_time, t.start_time) > NOW())`;

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
      if (venue_ids) {
        const ids = venue_ids.split(',').map(Number).filter(Boolean);
        if (ids.length > 0) { filterParts.push(`v.id = ANY($${idx++})`); params.push(ids); }
      }
      if (gtd_min) { filterParts.push(`t.gtd >= $${idx++}`); params.push(parseInt(gtd_min)); }
      if (tournament_type) { filterParts.push(`t.tournament_type = $${idx++}`); params.push(tournament_type); }

      query = `${baseSelect}
        WHERE t.status = 'approved' AND v.is_approved = true AND ${notPastClause}
        AND (t.is_boosted = true OR (${filterParts.join(' AND ')}))
        ${sortClause}`;
    } else {
      const extraParts = [];
      if (gtd_min) { extraParts.push(`t.gtd >= $${idx++}`); params.push(parseInt(gtd_min)); }
      if (tournament_type) { extraParts.push(`t.tournament_type = $${idx++}`); params.push(tournament_type); }
      const extraWhere = extraParts.length ? `AND ${extraParts.join(' AND ')}` : '';
      query = `${baseSelect}
        WHERE t.status = 'approved' AND v.is_approved = true AND ${notPastClause} ${extraWhere}
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

  const { venue_id, name, description, cost, start_time, estimated_end_time, stages, starting_stack, level_duration, is_recurring, day_of_week, re_entry, late_reg_level, gtd, tournament_type, rake, rake_type } = req.body;

  try {
    const venueCheck = await pool.query(
      'SELECT id FROM venues WHERE id = $1 AND owner_id = $2 AND is_approved = true',
      [venue_id, req.user.id]
    );
    if (!venueCheck.rows[0]) {
      return res.status(403).json({ message: 'אין לך הרשאה להוסיף טורניר למקום זה' });
    }

    // מועדון מאושר → טורניר מאושר אוטומטית
    const autoApprove = venueCheck.rows[0] !== undefined; // כבר וידאנו is_approved=true
    const status = autoApprove ? 'approved' : 'pending';

    const result = await pool.query(
      `INSERT INTO tournaments
        (venue_id, name, description, cost, start_time, estimated_end_time, stages, starting_stack, level_duration, is_recurring, day_of_week, re_entry, late_reg_level, gtd, tournament_type, rake, rake_type, created_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING *`,
      [venue_id, name, description, cost, start_time, estimated_end_time,
       JSON.stringify(stages || []), starting_stack || null, level_duration || null, is_recurring || false, day_of_week,
       re_entry || null, late_reg_level || null, gtd || null, tournament_type || 'live',
       rake || null, rake_type || 'amount', req.user.id, status]
    );

    const newTournament = result.rows[0];

    // רישום ביומן שינויים
    pool.query(
      `INSERT INTO change_logs (entity_type, entity_id, entity_name, action, changed_by, changed_by_name, new_data)
       VALUES ($1,$2,$3,'create',$4,$5,$6)`,
      ['tournament', newTournament.id, newTournament.name, req.user.id, req.user.name, JSON.stringify(newTournament)]
    ).catch(() => {});

    res.status(201).json({
      tournament: newTournament,
      message: autoApprove ? 'הטורניר פורסם בהצלחה!' : 'הטורניר נשלח לאישור המנהל. תקבל עדכון בקרוב.',
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

    // פענוח הקובץ עם exceljs
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];

    // קריאת כותרות מהשורה הראשונה
    const headers = {};
    sheet.getRow(1).eachCell((cell, colNum) => {
      headers[String(cell.value || '').trim()] = colNum;
    });

    const dataRows = [];
    sheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return; // דלג על שורת כותרות
      const get = (key) => {
        const col = headers[key];
        if (!col) return '';
        const v = row.getCell(col).value;
        return v === null || v === undefined ? '' : v;
      };
      dataRows.push({ rowNum, get });
    });

    if (dataRows.length === 0) return res.status(400).json({ message: 'הקובץ ריק — לא נמצאו שורות נתונים' });
    if (dataRows.length > 15) return res.status(400).json({ message: `הקובץ מכיל ${dataRows.length} שורות — המקסימום הוא 15 טורנירים` });

    const parsed = [];
    const errors = [];

    for (const { rowNum, get } of dataRows) {
      const name           = String(get('שם טורניר') || '').trim();
      const description    = String(get('תיאור') || '').trim();
      const cost           = get('עלות');
      const dateVal        = get('תאריך התחלה');
      const timeStr        = String(get('שעת התחלה') || '').trim();
      const endTimeStr     = String(get('שעת סיום משוערת') || '').trim();
      const recurStr       = String(get('חוזר שבועי') || 'לא').trim();
      const dayStr         = String(get('יום בשבוע') || '').trim();
      const stackStr       = String(get('ערימה התחלתית') || '').trim();
      const durStr         = String(get('זמן לשלב') || '').trim();
      const reEntryStr     = String(get('כניסה חוזרת') || '').trim();
      const lateRegStr     = String(get('Late Reg עד שלב') || '').trim();

      if (!name)    { errors.push(`שורה ${rowNum}: שם הטורניר חסר`); continue; }
      if (!dateVal) { errors.push(`שורה ${rowNum}: תאריך התחלה חסר`); continue; }
      if (!timeStr) { errors.push(`שורה ${rowNum}: שעת התחלה חסרה`); continue; }
      if (cost === '' || isNaN(parseFloat(cost))) { errors.push(`שורה ${rowNum}: עלות לא תקינה`); continue; }

      // פענוח תאריך — ExcelJS מחזיר Date אוטומטית, או string DD/MM/YYYY
      let start_time = null;
      try {
        if (dateVal instanceof Date) {
          start_time = new Date(dateVal);
        } else {
          const dateStr = String(dateVal).trim().replace(/\\/g, '/'); // תמיכה ב-\ כמו /
          const parts = dateStr.split('/');
          if (parts.length !== 3) throw new Error('bad format');
          start_time = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
        if (isNaN(start_time.getTime())) throw new Error('invalid date');
        const [hh, mm] = timeStr.split(':');
        start_time.setHours(parseInt(hh) || 0, parseInt(mm) || 0, 0, 0);
      } catch {
        errors.push(`שורה ${rowNum}: פורמט תאריך לא תקין — נדרש DD/MM/YYYY`);
        continue;
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
        if (DAYS_MAP_HE[dayStr] !== undefined)    day_of_week = DAYS_MAP_HE[dayStr];
        else if (!isNaN(dayStr) && dayStr !== '') day_of_week = parseInt(dayStr);
        else                                      day_of_week = start_time.getDay();
      }

      const starting_stack  = stackStr   && !isNaN(parseInt(stackStr))   ? parseInt(stackStr)   : null;
      const level_duration  = durStr     && !isNaN(parseInt(durStr))     ? parseInt(durStr)     : null;
      const re_entry        = reEntryStr || null;
      const late_reg_level  = lateRegStr && !isNaN(parseInt(lateRegStr)) ? parseInt(lateRegStr) : null;
      const blindsKey       = String(get('מבנה בליינדים') || '').trim();
      const gtdStr          = String(get('פרסים מובטחים GTD') || '').trim();
      const gtd             = gtdStr && !isNaN(parseInt(gtdStr)) ? parseInt(gtdStr) : null;

      parsed.push({ name, description, cost: parseFloat(cost), start_time, estimated_end_time, is_recurring, day_of_week, starting_stack, level_duration, re_entry, late_reg_level, blindsKey, gtd });
    }

    if (errors.length > 0) return res.status(400).json({ message: 'נמצאו שגיאות בקובץ', errors });

    // מועדון מאושר → טורנירים מאושרים אוטומטית
    const status = 'approved'; // venueCheck כבר אימת is_approved=true

    // טעינת תבניות שמורות של המשתמש (לחיפוש לפי שם)
    const userTemplates = await pool.query(
      'SELECT name, stages FROM blind_templates WHERE user_id = $1',
      [req.user.id]
    );
    const templateMap = {};
    for (const tpl of userTemplates.rows) {
      templateMap[tpl.name.toLowerCase()] = tpl.stages;
    }

    // הכנסה לבסיס הנתונים
    const inserted = [];
    for (const t of parsed) {
      // פתרון stages מ-preset או תבנית שמורה
      let stages = [];
      if (t.blindsKey) {
        const key = t.blindsKey.toLowerCase();
        const presetStages = presetToStages(key, t.level_duration || null);
        if (presetStages) {
          stages = presetStages;
        } else if (templateMap[key]) {
          stages = templateMap[key];
        }
      }

      const result = await pool.query(
        `INSERT INTO tournaments
           (venue_id, name, description, cost, start_time, estimated_end_time, stages,
            is_recurring, day_of_week, starting_stack, level_duration, re_entry, late_reg_level, gtd,
            created_by, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id, name`,
        [venue_id, t.name, t.description, t.cost, t.start_time, t.estimated_end_time,
         JSON.stringify(stages), t.is_recurring, t.day_of_week,
         t.starting_stack, t.level_duration, t.re_entry, t.late_reg_level, t.gtd,
         req.user.id, status]
      );
      inserted.push(result.rows[0]);
    }

    res.status(201).json({
      message: `${inserted.length} טורנירים פורסמו בהצלחה!`,
      tournaments: inserted,
    });
  } catch (err) {
    console.error('bulkCreate error:', err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.downloadTemplate = async (req, res) => {
  try {
    // תבניות שמורות של המשתמש
    const tplResult = await pool.query(
      'SELECT name FROM blind_templates WHERE user_id = $1 ORDER BY name',
      [req.user.id]
    );
    const userTplNames = tplResult.rows.map(r => r.name);

    const presetNames  = Object.keys(BLIND_PRESETS); // hyper, turbo, regular
    const blindOptions = [...presetNames, ...userTplNames];

    const workbook  = new ExcelJS.Workbook();
    const sheet     = workbook.addWorksheet('טורנירים', { views: [{ rightToLeft: true }] });

    // ── עמודות ────────────────────────────────────────────────────
    const COLUMNS = [
      { header: 'שם טורניר *',           key: 'name',            width: 22 },
      { header: 'תיאור',                  key: 'description',     width: 28 },
      { header: 'עלות *',                 key: 'cost',            width: 10 },
      { header: 'תאריך התחלה *',          key: 'date',            width: 16 },
      { header: 'שעת התחלה *',            key: 'start_time',      width: 12 },
      { header: 'שעת סיום משוערת',        key: 'end_time',        width: 14 },
      { header: 'חוזר שבועי',             key: 'recurring',       width: 12 },
      { header: 'יום בשבוע',              key: 'day',             width: 12 },
      { header: 'ערימה התחלתית',          key: 'stack',           width: 14 },
      { header: 'זמן לשלב (דק\')',        key: 'level_dur',       width: 13 },
      { header: 'כניסה חוזרת',            key: 're_entry',        width: 14 },
      { header: 'Late Reg עד שלב',        key: 'late_reg',        width: 14 },
      { header: 'פרסים מובטחים GTD',       key: 'gtd',             width: 16 },
      { header: 'מבנה בליינדים',          key: 'blinds',          width: 20 },
    ];
    sheet.columns = COLUMNS;

    // עיצוב כותרת
    const headerRow = sheet.getRow(1);
    headerRow.eachCell(cell => {
      cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F6B3A' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rightToLeft' };
      cell.border    = { bottom: { style: 'medium', color: { argb: 'FF14532D' } } };
    });
    headerRow.height = 22;
    sheet.views = [{ state: 'frozen', ySplit: 1, rightToLeft: true }];

    // שורות דוגמה
    const examples = [
      ['טורניר שישי לילה', 'טורניר פריים טיים, 15K guarantee', 150, '30/06/2026', '22:00', '02:00', 'כן', 'שישי',  20000, 20, '2X',       6, 15000,  'regular'],
      ['טורניר צהריים',    '',                                    80,  '25/06/2026', '13:00', '17:00', 'לא', '',     15000, 15, '1X',       4, '',     'turbo'],
      ['טורניר VIP',       'כניסה מוגבלת ל-20 שחקנים',         300, '01/07/2026', '20:00', '00:00', 'כן', 'ראשון', 30000, 25, 'Unlimited','', 50000, 'hyper'],
    ];
    examples.forEach(row => {
      const r = sheet.addRow(row);
      r.eachCell({ includeEmpty: true }, cell => {
        cell.alignment = { readingOrder: 'rightToLeft' };
      });
    });

    // ── Data validation — מבנה בליינדים (עמודה M) ────────────────
    const blindColLetter = 'M';
    if (blindOptions.length > 0) {
      // Excel data validation: list from formula (max 255 chars per item, fits in formula string)
      const listStr = blindOptions.map(o => `"${o}"`).join(',');
      for (let row = 2; row <= 17; row++) {
        sheet.getCell(`${blindColLetter}${row}`).dataValidation = {
          type:         'list',
          allowBlank:   true,
          formulae:     [`${listStr}`],
          showErrorMessage: true,
          errorTitle:   'ערך לא תקין',
          error:        `בחר אחד מהאפשרויות: ${blindOptions.join(', ')}`,
        };
      }
    }

    // ── Data validation — כניסה חוזרת (עמודה K) ─────────────────
    for (let row = 2; row <= 17; row++) {
      sheet.getCell(`K${row}`).dataValidation = {
        type:       'list',
        allowBlank: true,
        formulae:   ['"1X,2X,3X,4X,Unlimited"'],
      };
    }

    // ── Data validation — חוזר שבועי (עמודה G) ───────────────────
    for (let row = 2; row <= 17; row++) {
      sheet.getCell(`G${row}`).dataValidation = {
        type:       'list',
        allowBlank: true,
        formulae:   ['"כן,לא"'],
      };
    }

    // ── Data validation — יום בשבוע (עמודה H) ────────────────────
    for (let row = 2; row <= 17; row++) {
      sheet.getCell(`H${row}`).dataValidation = {
        type:       'list',
        allowBlank: true,
        formulae:   ['"ראשון,שני,שלישי,רביעי,חמישי,שישי,שבת"'],
      };
    }

    // ── שמירה לזיכרון ─────────────────────────────────────────────
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="tournaments_template.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('[TEMPLATE]', err);
    res.status(500).json({ message: 'שגיאה ביצירת התבנית' });
  }
};

exports.updateTournament = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { id } = req.params;
  const {
    name, description, cost, start_time, estimated_end_time,
    stages, starting_stack, level_duration, is_recurring, day_of_week,
    re_entry, late_reg_level, gtd, rake, rake_type,
  } = req.body;

  try {
    // בדיקת בעלות — הטורניר שייך למקום של המשתמש
    const ownerCheck = await pool.query(
      `SELECT t.id FROM tournaments t
       JOIN venues v ON t.venue_id = v.id
       WHERE t.id = $1 AND v.owner_id = $2`,
      [id, req.user.id]
    );
    if (!ownerCheck.rows[0]) {
      return res.status(403).json({ message: 'אין לך הרשאה לערוך טורניר זה' });
    }

    // שמירת נתונים ישנים לפני עדכון
    const oldRow = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
    const oldData = oldRow.rows[0];

    const result = await pool.query(
      `UPDATE tournaments SET
         name = $1, description = $2, cost = $3, start_time = $4, estimated_end_time = $5,
         stages = $6, starting_stack = $7, level_duration = $8, is_recurring = $9,
         day_of_week = $10, re_entry = $11, late_reg_level = $12, gtd = $13,
         rake = $14, rake_type = $15, updated_at = NOW()
       WHERE id = $16
       RETURNING *`,
      [
        name, description, cost, start_time, estimated_end_time || null,
        JSON.stringify(stages || []),
        starting_stack || null, level_duration || null,
        is_recurring || false, day_of_week ?? null,
        re_entry || null, late_reg_level || null, gtd || null,
        rake || null, rake_type || 'amount',
        id,
      ]
    );

    const newData = result.rows[0];

    // רישום ביומן שינויים
    await pool.query(
      `INSERT INTO change_logs (entity_type, entity_id, entity_name, action, changed_by, changed_by_name, old_data, new_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      ['tournament', id, newData.name, 'update', req.user.id, req.user.name, JSON.stringify(oldData), JSON.stringify(newData)]
    );

    res.json({ tournament: newData, message: 'הטורניר עודכן בהצלחה' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.updateVenue = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { id } = req.params;
  const { name, address, city, whatsapp_number, description, logo_url } = req.body;

  try {
    const ownerCheck = await pool.query(
      'SELECT id FROM venues WHERE id = $1 AND owner_id = $2',
      [id, req.user.id]
    );
    if (!ownerCheck.rows[0]) {
      return res.status(403).json({ message: 'אין לך הרשאה לערוך מועדון זה' });
    }

    // שמירת נתונים ישנים לפני עדכון
    const oldRow = await pool.query('SELECT * FROM venues WHERE id = $1', [id]);
    const oldData = oldRow.rows[0];

    const result = await pool.query(
      `UPDATE venues SET
         name = $1, address = $2, city = $3,
         whatsapp_number = $4, description = $5, logo_url = $6
       WHERE id = $7 RETURNING *`,
      [name, address, city, whatsapp_number, description || null, logo_url || null, id]
    );

    const newData = result.rows[0];

    // רישום ביומן שינויים
    await pool.query(
      `INSERT INTO change_logs (entity_type, entity_id, entity_name, action, changed_by, changed_by_name, old_data, new_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      ['venue', id, newData.name, 'update', req.user.id, req.user.name, JSON.stringify(oldData), JSON.stringify(newData)]
    );

    res.json({ venue: newData, message: 'המועדון עודכן בהצלחה' });
  } catch (err) {
    console.error(err);
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
    const newVenue = result.rows[0];

    // רישום ביומן שינויים
    pool.query(
      `INSERT INTO change_logs (entity_type, entity_id, entity_name, action, changed_by, changed_by_name, new_data)
       VALUES ($1,$2,$3,'create',$4,$5,$6)`,
      ['venue', newVenue.id, newVenue.name, req.user.id, req.user.name, JSON.stringify(newVenue)]
    ).catch(() => {});

    res.status(201).json({
      venue: newVenue,
      message: 'המקום נשלח לאישור המנהל.',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

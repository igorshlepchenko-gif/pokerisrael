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
        t.platform, t.game_type, t.secondary_games, t.cash_sb, t.cash_bb, t.skipped_dates, t.external_registration_url,
        v.id AS venue_id, v.name AS venue_name, v.address AS venue_address,
        v.city AS venue_city, v.whatsapp_number, v.logo_url AS venue_logo,
        v.venue_type AS venue_type, v.club_number AS venue_club_number, v.website AS venue_website
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

  const { venue_id, name, description, cost, start_time, estimated_end_time, stages, starting_stack, level_duration, is_recurring, day_of_week, re_entry, late_reg_level, gtd, tournament_type, rake, rake_type, platform, game_type, secondary_games, cash_sb, cash_bb, external_registration_url } = req.body;

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
        (venue_id, name, description, cost, start_time, estimated_end_time, stages, starting_stack, level_duration, is_recurring, day_of_week, re_entry, late_reg_level, gtd, tournament_type, rake, rake_type, platform, game_type, secondary_games, cash_sb, cash_bb, created_by, status, external_registration_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
       RETURNING *`,
      [venue_id, name, description, cost, start_time, estimated_end_time,
       JSON.stringify(stages || []), starting_stack || null, level_duration || null, is_recurring || false, day_of_week,
       re_entry || null, late_reg_level || null, gtd || null, tournament_type || 'live',
       rake || null, rake_type || 'amount',
       platform || null, game_type || null, JSON.stringify(secondary_games || []),
       cash_sb || null, cash_bb || null,
       req.user.id, status, external_registration_url || null]
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

// מיפוי סוג אירוע מעברית → הגדרות
const EVENT_TYPE_MAP = {
  'טורניר לייב':    { tt: 'live',   mode: 'tournament', online: false },
  'טורניר אונליין': { tt: 'online', mode: 'tournament', online: true  },
  'קאש לייב':       { tt: 'cash',   mode: 'cash',       online: false },
  'קאש אונליין':    { tt: 'online', mode: 'cash',       online: true  },
};

exports.bulkCreate = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'לא נשלח קובץ' });

    // מועדונים מאושרים של המשתמש (לפי שם)
    const venuesRes = await pool.query(
      'SELECT id, name, venue_type FROM venues WHERE owner_id = $1 AND is_approved = true',
      [req.user.id]
    );
    if (venuesRes.rows.length === 0) {
      return res.status(403).json({ message: 'אין לך מועדונים מאושרים — הוסף מועדון תחילה' });
    }
    const venueByName = {};
    venuesRes.rows.forEach(v => { venueByName[v.name.trim().toLowerCase()] = v; });
    const singlePhysical = venuesRes.rows.filter(v => (v.venue_type||'physical')==='physical');
    const singleOnline   = venuesRes.rows.filter(v => v.venue_type === 'online');

    // תבניות בליינדים שמורות
    const tplRes = await pool.query('SELECT name, stages FROM blind_templates WHERE user_id = $1', [req.user.id]);
    const templateMap = {};
    tplRes.rows.forEach(tpl => { templateMap[tpl.name.trim().toLowerCase()] = tpl.stages; });

    // פענוח הקובץ
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];
    // נרמול כותרות — מסיר " *", סוגריים ורווחים כפולים כדי להתאים בין התבנית לקריאה
    const norm = s => String(s || '').replace(/\*/g, '').replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    const headers = {};
    sheet.getRow(1).eachCell((cell, colNum) => { headers[norm(cell.value)] = colNum; });
    const get = (row, key) => {
      const col = headers[norm(key)];
      if (!col) return '';
      const v = row.getCell(col).value;
      return v === null || v === undefined ? '' : v;
    };

    const dataRows = [];
    sheet.eachRow((row, rowNum) => { if (rowNum !== 1) dataRows.push({ rowNum, row }); });
    if (dataRows.length === 0) return res.status(400).json({ message: 'הקובץ ריק — לא נמצאו שורות נתונים' });
    if (dataRows.length > 20) return res.status(400).json({ message: `הקובץ מכיל ${dataRows.length} שורות — המקסימום 20` });

    const parsed = [];
    const errors = [];

    for (const { rowNum, row } of dataRows) {
      const g = (k) => String(get(row, k) || '').trim();
      const eventTypeStr = g('סוג אירוע');
      const venueStr     = g('מועדון');
      const name         = g('שם');
      const cost         = get(row, 'עלות/כניסה מינ׳');
      const dateVal      = get(row, 'תאריך התחלה');
      const timeStr      = g('שעת התחלה');

      // שורה ריקה לגמרי — דלג
      if (!eventTypeStr && !name && !dateVal) continue;

      const cfg = EVENT_TYPE_MAP[eventTypeStr];
      if (!cfg) { errors.push(`שורה ${rowNum}: סוג אירוע לא תקין ("${eventTypeStr}")`); continue; }
      if (!name)    { errors.push(`שורה ${rowNum}: שם חסר`); continue; }
      if (!dateVal) { errors.push(`שורה ${rowNum}: תאריך התחלה חסר`); continue; }
      if (!timeStr) { errors.push(`שורה ${rowNum}: שעת התחלה חסרה`); continue; }
      if (cost === '' || isNaN(parseFloat(cost))) { errors.push(`שורה ${rowNum}: עלות/כניסה לא תקינה`); continue; }

      // מועדון — לפי שם, או אוטומטית לפי סוג
      let venue = venueStr ? venueByName[venueStr.toLowerCase()] : null;
      if (!venue) {
        const pool2 = cfg.online ? singleOnline : singlePhysical;
        if (pool2.length === 1) venue = pool2[0];
      }
      if (!venue) {
        errors.push(`שורה ${rowNum}: מועדון לא נמצא/לא נבחר${venueStr ? ` ("${venueStr}")` : ''}`);
        continue;
      }
      const needType = cfg.online ? 'online' : 'physical';
      if ((venue.venue_type || 'physical') !== needType) {
        errors.push(`שורה ${rowNum}: המועדון "${venue.name}" אינו ${cfg.online ? 'אונליין' : 'פיזי'} — לא תואם לסוג האירוע`);
        continue;
      }

      // תאריך + שעה
      let start_time = null;
      try {
        if (dateVal instanceof Date) start_time = new Date(dateVal);
        else {
          const parts = String(dateVal).trim().replace(/\\/g, '/').split('/');
          if (parts.length !== 3) throw new Error('bad');
          start_time = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
        if (isNaN(start_time.getTime())) throw new Error('invalid');
        const [hh, mm] = timeStr.split(':');
        start_time.setHours(parseInt(hh) || 0, parseInt(mm) || 0, 0, 0);
      } catch {
        errors.push(`שורה ${rowNum}: פורמט תאריך לא תקין — נדרש DD/MM/YYYY`); continue;
      }

      const endTimeStr = g('שעת סיום');
      let estimated_end_time = null;
      if (endTimeStr) {
        try {
          const [hh, mm] = endTimeStr.split(':');
          estimated_end_time = new Date(start_time);
          estimated_end_time.setHours(parseInt(hh) || 0, parseInt(mm) || 0, 0, 0);
          if (estimated_end_time <= start_time) estimated_end_time.setDate(estimated_end_time.getDate() + 1);
        } catch { /* ignore */ }
      }

      const is_recurring = ['כן','yes','true','1'].includes(g('חוזר שבועי').toLowerCase());
      let day_of_week = null;
      if (is_recurring) {
        const dayStr = g('יום בשבוע');
        if (DAYS_MAP_HE[dayStr] !== undefined) day_of_week = DAYS_MAP_HE[dayStr];
        else if (!isNaN(dayStr) && dayStr !== '') day_of_week = parseInt(dayStr);
        else day_of_week = start_time.getDay();
      }

      const numOrNull = (k) => { const s = g(k); return s && !isNaN(parseInt(s)) ? parseInt(s) : null; };
      const rakeVal   = g('RAKE');
      const rake      = rakeVal && !isNaN(parseFloat(rakeVal)) ? parseFloat(rakeVal) : null;
      const rake_type = g('סוג RAKE') === '%' ? 'percent' : 'amount';
      const platform  = cfg.online ? (g('פלטפורמה') || null) : null;

      const item = {
        cfg, venue_id: venue.id, name, description: g('תיאור'),
        cost: parseFloat(cost), start_time, estimated_end_time, is_recurring, day_of_week,
        rake: (cfg.mode === 'cash' && !cfg.online) ? null : rake, // אין RAKE לקאש לייב
        rake_type, platform,
        // טורניר
        gtd: cfg.mode === 'tournament' ? numOrNull('GTD') : null,
        starting_stack: cfg.mode === 'tournament' ? numOrNull('ערימה התחלתית') : null,
        level_duration: cfg.mode === 'tournament' ? numOrNull('זמן לשלב (דק׳)') : null,
        re_entry: cfg.mode === 'tournament' ? (g('כניסה חוזרת') || null) : null,
        late_reg_level: cfg.mode === 'tournament' ? numOrNull('Late Reg עד שלב') : null,
        blindsKey: cfg.mode === 'tournament' ? g('מבנה בליינדים') : '',
        // קאש
        game_type: cfg.mode === 'cash' ? (g('סוג משחק (קאש)') || 'NLH') : null,
        cash_sb: cfg.mode === 'cash' ? numOrNull('סמול בליינד') : null,
        cash_bb: cfg.mode === 'cash' ? numOrNull('ביג בליינד') : null,
      };
      parsed.push(item);
    }

    if (errors.length > 0) return res.status(400).json({ message: 'נמצאו שגיאות בקובץ', errors });

    const inserted = [];
    for (const t of parsed) {
      // מבנה בליינדים (טורניר בלבד)
      let stages = [];
      if (t.cfg.mode === 'tournament' && t.blindsKey) {
        const key = t.blindsKey.toLowerCase();
        const presetStages = presetToStages(key, t.level_duration || null);
        if (presetStages) stages = presetStages;
        else if (templateMap[key]) stages = templateMap[key];
      }

      const result = await pool.query(
        `INSERT INTO tournaments
           (venue_id, name, description, cost, start_time, estimated_end_time, stages,
            is_recurring, day_of_week, starting_stack, level_duration, re_entry, late_reg_level, gtd,
            tournament_type, rake, rake_type, platform, game_type, secondary_games, cash_sb, cash_bb,
            created_by, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,'approved')
         RETURNING id, name`,
        [t.venue_id, t.name, t.description, t.cost, t.start_time, t.estimated_end_time,
         JSON.stringify(stages), t.is_recurring, t.day_of_week,
         t.starting_stack, t.level_duration, t.re_entry, t.late_reg_level, t.gtd,
         t.cfg.tt, t.rake, t.rake_type, t.platform, t.game_type, JSON.stringify([]), t.cash_sb, t.cash_bb,
         req.user.id]
      );
      inserted.push(result.rows[0]);
    }

    res.status(201).json({
      message: `${inserted.length} אירועים פורסמו בהצלחה!`,
      tournaments: inserted,
    });
  } catch (err) {
    console.error('bulkCreate error:', err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

// סוגי אירוע לאקסל
const EVENT_TYPES_HE = ['טורניר לייב', 'טורניר אונליין', 'קאש לייב', 'קאש אונליין'];

exports.downloadTemplate = async (req, res) => {
  try {
    // תבניות בליינדים שמורות של המשתמש
    const tplResult = await pool.query(
      'SELECT name FROM blind_templates WHERE user_id = $1 ORDER BY name',
      [req.user.id]
    );
    const userTplNames = tplResult.rows.map(r => r.name);
    const presetNames  = Object.keys(BLIND_PRESETS); // hyper, turbo, regular
    const blindOptions = [...presetNames, ...userTplNames];
    // אם יש תבנית שמורה אחת בלבד — שים אותה כברירת מחדל
    const defaultBlind = userTplNames.length === 1 ? userTplNames[0] : 'regular';

    // מועדונים מאושרים של המשתמש (לבורר + ברירת מחדל)
    const venueResult = await pool.query(
      `SELECT name, venue_type FROM venues WHERE owner_id = $1 AND is_approved = true ORDER BY name`,
      [req.user.id]
    );
    const physicalVenues = venueResult.rows.filter(v => (v.venue_type || 'physical') === 'physical').map(v => v.name);
    const onlineVenues   = venueResult.rows.filter(v => v.venue_type === 'online').map(v => v.name);
    const allVenueNames  = venueResult.rows.map(v => v.name);
    const exPhysical = physicalVenues[0] || allVenueNames[0] || '';
    const exOnline   = onlineVenues[0]   || allVenueNames[0] || '';

    const workbook  = new ExcelJS.Workbook();
    const sheet     = workbook.addWorksheet('אירועים', { views: [{ rightToLeft: true }] });

    // ── עמודות (A..V) ─────────────────────────────────────────────
    const COLUMNS = [
      { header: 'סוג אירוע *',       key: 'event_type', width: 16 }, // A
      { header: 'מועדון *',          key: 'venue',      width: 20 }, // B
      { header: 'שם *',              key: 'name',       width: 22 }, // C
      { header: 'תיאור',             key: 'description',width: 26 }, // D
      { header: 'עלות/כניסה מינ׳ *', key: 'cost',       width: 14 }, // E
      { header: 'RAKE',              key: 'rake',       width: 9  }, // F
      { header: 'סוג RAKE',          key: 'rake_type',  width: 10 }, // G
      { header: 'תאריך התחלה *',     key: 'date',       width: 15 }, // H
      { header: 'שעת התחלה *',       key: 'start_time', width: 12 }, // I
      { header: 'שעת סיום',          key: 'end_time',   width: 11 }, // J
      { header: 'חוזר שבועי',        key: 'recurring',  width: 11 }, // K
      { header: 'יום בשבוע',         key: 'day',        width: 11 }, // L
      { header: 'GTD',               key: 'gtd',        width: 12 }, // M
      { header: 'ערימה התחלתית',     key: 'stack',      width: 13 }, // N
      { header: 'זמן לשלב (דק׳)',    key: 'level_dur',  width: 12 }, // O
      { header: 'כניסה חוזרת',       key: 're_entry',   width: 12 }, // P
      { header: 'Late Reg עד שלב',   key: 'late_reg',   width: 13 }, // Q
      { header: 'מבנה בליינדים',     key: 'blinds',     width: 18 }, // R
      { header: 'סוג משחק (קאש)',    key: 'game_type',  width: 14 }, // S
      { header: 'סמול בליינד',       key: 'cash_sb',    width: 11 }, // T
      { header: 'ביג בליינד',        key: 'cash_bb',    width: 11 }, // U
      { header: 'פלטפורמה (אונליין)',key: 'platform',   width: 16 }, // V
    ];
    sheet.columns = COLUMNS;

    const headerRow = sheet.getRow(1);
    headerRow.eachCell(cell => {
      cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, readingOrder: 'rightToLeft' };
      cell.border    = { bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } } };
    });
    headerRow.height = 30;
    sheet.views = [{ state: 'frozen', ySplit: 1, rightToLeft: true }];

    // ── שורות דוגמה (אחת לכל סוג) ─────────────────────────────────
    // [event_type, venue, name, desc, cost, rake, rake_type, date, time, end, recur, day, gtd, stack, level, reentry, latereg, blinds, gametype, sb, bb, platform]
    const examples = [
      ['טורניר לייב',   exPhysical, 'טורניר שישי לילה', '15K GTD',           150, 30, '₪', '30/06/2026', '22:00', '02:00', 'כן', 'שישי',  15000, 20000, 20, '2X', 6, defaultBlind, '', '', '', ''],
      ['טורניר אונליין',exOnline,   'Sunday Online',    '',                  100, 10, '%', '28/06/2026', '21:00', '',      'כן', 'ראשון', 20000, 25000, 15, '1X', 8, defaultBlind, '', '', '', 'ClubGG'],
      ['קאש לייב',      exPhysical, 'קאש שישי NLH',     'שולחן פתוח',        200, 0,  '₪', '03/07/2026', '20:00', '',      'כן', 'שישי',  '',    '',    '',  '',   '', '',           'NLH',  5,  10, ''],
      ['קאש אונליין',   exOnline,   'קאש PLO אונליין',  '',                  100, 5,  '%', '04/07/2026', '20:00', '',      'לא', '',      '',    '',    '',  '',   '', '',           'PLO',  2,  5,  'PPPoker'],
    ];
    examples.forEach(row => {
      const r = sheet.addRow(row);
      r.eachCell({ includeEmpty: true }, cell => { cell.alignment = { readingOrder: 'rightToLeft' }; });
    });

    // ── Data validations ──────────────────────────────────────────
    const addList = (col, optionsCsv) => {
      for (let row = 2; row <= 25; row++) {
        sheet.getCell(`${col}${row}`).dataValidation = {
          type: 'list', allowBlank: true, formulae: [`"${optionsCsv}"`],
        };
      }
    };
    addList('A', EVENT_TYPES_HE.join(','));                  // סוג אירוע
    addList('G', '₪,%');                                     // סוג RAKE
    addList('K', 'כן,לא');                                   // חוזר שבועי
    addList('L', 'ראשון,שני,שלישי,רביעי,חמישי,שישי,שבת');     // יום בשבוע
    addList('P', '1X,2X,3X,4X,Unlimited');                   // כניסה חוזרת
    addList('S', 'NLH,PLO,PLO5,PLO6');                       // סוג משחק
    addList('V', 'ClubGG,Pokerrrr2,PPPoker,UPoker');         // פלטפורמה
    // מועדונים — רק אם יש
    if (allVenueNames.length > 0) addList('B', allVenueNames.join(','));
    // מבנה בליינדים — presets + תבניות שמורות
    if (blindOptions.length > 0) {
      for (let row = 2; row <= 25; row++) {
        sheet.getCell(`R${row}`).dataValidation = {
          type: 'list', allowBlank: true, formulae: [`"${blindOptions.join(',')}"`],
          showErrorMessage: true, errorTitle: 'ערך לא תקין',
          error: `בחר: ${blindOptions.join(', ')}`,
        };
      }
    }

    // ── גיליון הוראות ─────────────────────────────────────────────
    const help = workbook.addWorksheet('הוראות', { views: [{ rightToLeft: true }] });
    help.columns = [{ width: 100 }];
    const lines = [
      '📋 הוראות מילוי — ייבוא אירועים',
      '',
      '• סוג אירוע (חובה): בחר מהרשימה — טורניר לייב / טורניר אונליין / קאש לייב / קאש אונליין',
      '• מועדון (חובה): בחר מהרשימה את המועדון שלך (פיזי לטורניר/קאש לייב, אונליין לאירועי אונליין)',
      '• עלות/כניסה מינ׳ (חובה): לטורניר = דמי כניסה, לקאש = כניסה מינימלית',
      '• תאריך התחלה (חובה): DD/MM/YYYY · שעת התחלה (חובה): HH:MM',
      '• RAKE + סוג RAKE: מספר + בחירה ₪ או % (לא רלוונטי לקאש לייב)',
      '• חוזר שבועי: כן/לא · יום בשבוע: לאירוע חוזר',
      '',
      '── שדות לטורניר בלבד ──',
      '• GTD: פרסים מובטחים · ערימה התחלתית · זמן לשלב · כניסה חוזרת · Late Reg עד שלב',
      '• מבנה בליינדים: בחר preset (regular/turbo/hyper) או תבנית שמורה שלך',
      userTplNames.length === 1
        ? `   ⭐ יש לך תבנית שמורה אחת ("${userTplNames[0]}") — היא כבר מוגדרת כברירת מחדל בדוגמאות`
        : userTplNames.length > 1
          ? `   יש לך ${userTplNames.length} תבניות שמורות — בחר ביניהן: ${userTplNames.join(', ')}`
          : '   (אין לך תבניות שמורות — השתמש ב-regular/turbo/hyper)',
      '',
      '── שדות לקאש בלבד ──',
      '• סוג משחק: NLH/PLO/PLO5/PLO6 · סמול בליינד · ביג בליינד',
      '',
      '── שדות לאונליין בלבד ──',
      '• פלטפורמה: ClubGG / Pokerrrr2 / PPPoker / UPoker',
      '',
      '⚠️ מחק את שורות הדוגמה לפני העלאה, או החלף בנתונים שלך. מקסימום 20 שורות.',
    ];
    lines.forEach((t, i) => {
      const r = help.addRow([t]);
      r.getCell(1).alignment = { readingOrder: 'rightToLeft', wrapText: true };
      if (i === 0) r.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1D4ED8' } };
      if (t.startsWith('──')) r.getCell(1).font = { bold: true, color: { argb: 'FF1E3A8A' } };
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="events_template.xlsx"');
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
    platform, game_type, secondary_games, cash_sb, cash_bb,
    external_registration_url,
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
         rake = $14, rake_type = $15,
         platform = $16, game_type = $17, secondary_games = $18,
         cash_sb = $19, cash_bb = $20, external_registration_url = $21, updated_at = NOW()
       WHERE id = $22
       RETURNING *`,
      [
        name, description, cost, start_time, estimated_end_time || null,
        JSON.stringify(stages || []),
        starting_stack || null, level_duration || null,
        is_recurring || false, day_of_week ?? null,
        re_entry || null, late_reg_level || null, gtd || null,
        rake || null, rake_type || 'amount',
        platform || null, game_type || null, JSON.stringify(secondary_games || []),
        cash_sb || null, cash_bb || null, external_registration_url || null,
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

// חישוב המופע הבא של אירוע שבועי (שרת)
function computeNextOccurrence(startTime, dayOfWeek, skipped) {
  const base = new Date(startTime);
  const dow = (dayOfWeek === null || dayOfWeek === undefined) ? base.getDay() : Number(dayOfWeek);
  const skipList = Array.isArray(skipped) ? skipped : [];
  const pad = n => String(n).padStart(2, '0');
  const toStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const now = new Date();
  const res = new Date(now);
  res.setHours(base.getHours(), base.getMinutes(), 0, 0);
  let daysAhead = (dow - res.getDay() + 7) % 7;
  if (daysAhead === 0 && res <= now) daysAhead = 7;
  res.setDate(res.getDate() + daysAhead);
  let guard = 0;
  while (skipList.includes(toStr(res)) && guard < 60) { res.setDate(res.getDate() + 7); guard++; }
  return toStr(res);
}

// דילוג על המופע הבא של אירוע שבועי קבוע (למשל חג)
exports.skipNextOccurrence = async (req, res) => {
  const { id } = req.params;
  try {
    const check = await pool.query(
      `SELECT t.id, t.start_time, t.day_of_week, t.is_recurring, t.skipped_dates
       FROM tournaments t JOIN venues v ON t.venue_id = v.id
       WHERE t.id = $1 AND v.owner_id = $2`,
      [id, req.user.id]
    );
    const t = check.rows[0];
    if (!t) return res.status(403).json({ message: 'אין לך הרשאה לערוך אירוע זה' });
    if (!t.is_recurring) return res.status(400).json({ message: 'ניתן לדלג רק על אירוע שבועי קבוע' });

    const skipped = Array.isArray(t.skipped_dates) ? t.skipped_dates : [];
    const nextDate = computeNextOccurrence(t.start_time, t.day_of_week, skipped);
    if (skipped.includes(nextDate)) {
      return res.json({ message: 'המופע כבר מסומן לדילוג', skipped_dates: skipped });
    }
    const updated = [...skipped, nextDate];
    await pool.query('UPDATE tournaments SET skipped_dates = $1 WHERE id = $2', [JSON.stringify(updated), id]);
    res.json({ message: `המופע ב-${nextDate} ידולג`, skipped_dates: updated, skipped_date: nextDate });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

// ביטול דילוגים (איפוס) — מחזיר את כל המופעים
exports.clearSkips = async (req, res) => {
  const { id } = req.params;
  try {
    const check = await pool.query(
      `SELECT t.id FROM tournaments t JOIN venues v ON t.venue_id = v.id
       WHERE t.id = $1 AND v.owner_id = $2`,
      [id, req.user.id]
    );
    if (!check.rows[0]) return res.status(403).json({ message: 'אין הרשאה' });
    await pool.query(`UPDATE tournaments SET skipped_dates = '[]'::jsonb WHERE id = $1`, [id]);
    res.json({ message: 'הדילוגים אופסו', skipped_dates: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.updateVenue = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { id } = req.params;
  const { name, address, city, whatsapp_number, description, logo_url, venue_type, club_number, agent_number, website } = req.body;

  try {
    if (req.user.role !== 'admin') {
      const ownerCheck = await pool.query(
        'SELECT id FROM venues WHERE id = $1 AND owner_id = $2',
        [id, req.user.id]
      );
      if (!ownerCheck.rows[0]) {
        return res.status(403).json({ message: 'אין לך הרשאה לערוך מועדון זה' });
      }
    }

    const isOnline = venue_type === 'online';
    if (isOnline && !club_number) {
      return res.status(400).json({ message: 'מספר המועדון באפליקציה הוא שדה חובה' });
    }

    // שמירת נתונים ישנים לפני עדכון
    const oldRow = await pool.query('SELECT * FROM venues WHERE id = $1', [id]);
    const oldData = oldRow.rows[0];

    const result = await pool.query(
      `UPDATE venues SET
         name = $1, address = $2, city = $3,
         whatsapp_number = $4, description = $5, logo_url = $6,
         venue_type = $7, club_number = $8, agent_number = $9, website = $10
       WHERE id = $11 RETURNING *`,
      [name, isOnline ? null : address, isOnline ? null : city,
       whatsapp_number, description || null, logo_url || null,
       venue_type || 'physical', isOnline ? club_number : null, isOnline ? (agent_number || null) : null,
       website || null, id]
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

  const { name, address, city, whatsapp_number, description, logo_url, venue_type, club_number, agent_number, website } = req.body;

  try {
    const isOnline = venue_type === 'online';
    if (isOnline && !club_number) {
      return res.status(400).json({ message: 'מספר המועדון באפליקציה הוא שדה חובה' });
    }

    const result = await pool.query(
      `INSERT INTO venues (owner_id, name, address, city, whatsapp_number, description, logo_url, venue_type, club_number, agent_number, website)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.user.id, name, isOnline ? null : address, isOnline ? null : city,
       whatsapp_number, description, logo_url || null,
       venue_type || 'physical', isOnline ? club_number : null, isOnline ? (agent_number || null) : null,
       website || null]
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

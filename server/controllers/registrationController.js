const pool = require('../config/db');
const ExcelJS = require('exceljs');

exports.logRegistration = async (req, res) => {
  const {
    tournament_id, tournament_name, venue_id, venue_name,
    tournament_date, registrant_name, registrant_phone, user_id,
  } = req.body;

  if (!tournament_name || !venue_name || !registrant_name) {
    return res.status(400).json({ message: 'שדות חובה חסרים' });
  }

  // ולידציה על אורך שדות — מניעת injection/spam
  if (String(registrant_name).length > 100 ||
      String(tournament_name).length > 200 ||
      String(venue_name).length > 200 ||
      (registrant_phone && String(registrant_phone).length > 30)) {
    return res.status(400).json({ message: 'ערכים ארוכים מדי' });
  }

  try {
    await pool.query(
      `INSERT INTO registration_logs
         (tournament_id, tournament_name, venue_id, venue_name,
          tournament_date, user_id, registrant_name, registrant_phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        tournament_id || null, tournament_name,
        venue_id || null, venue_name,
        tournament_date || null,
        user_id || null, registrant_name,
        registrant_phone || null,
      ]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('logRegistration error:', err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.getRegistrations = async (req, res) => {
  try {
    const { tournament_id, search, offset = 0 } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 200, 1000); // מקסימום 1000
    const params = [];
    const where = [];
    let idx = 1;

    if (tournament_id) {
      where.push(`tournament_id = $${idx++}`);
      params.push(parseInt(tournament_id));
    }
    if (search) {
      where.push(`(registrant_name ILIKE $${idx} OR tournament_name ILIKE $${idx} OR venue_name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(
      `SELECT * FROM registration_logs ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM registration_logs ${whereClause}`,
      params.slice(0, -2)
    );

    res.json({ registrations: result.rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.exportRegistrations = async (req, res) => {
  try {
    // אותה בניית WHERE כמו ב-getRegistrations — כדי שהייצוא יכבד את הסינון/חיפוש
    // הפעיל בפאנל הניהול, ולא תמיד יוציא את כל טבלת ההרשמות
    const { tournament_id, search } = req.query;
    const params = [];
    const where = [];
    let idx = 1;

    if (tournament_id) {
      where.push(`tournament_id = $${idx++}`);
      params.push(parseInt(tournament_id));
    }
    if (search) {
      where.push(`(registrant_name ILIKE $${idx} OR tournament_name ILIKE $${idx} OR venue_name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT * FROM registration_logs ${whereClause} ORDER BY created_at DESC`,
      params
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Poker Live Israel';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('הרשמות', { views: [{ rightToLeft: true }] });

    // עמודות עם כותרות בעברית
    ws.columns = [
      { header: 'תאריך הרשמה', key: 'created_at', width: 20 },
      { header: 'שם הנרשם',    key: 'registrant_name', width: 22 },
      { header: 'טלפון',       key: 'registrant_phone', width: 16 },
      { header: 'שם טורניר',   key: 'tournament_name', width: 26 },
      { header: 'שם מועדון',   key: 'venue_name', width: 26 },
      { header: 'תאריך טורניר', key: 'tournament_date', width: 20 },
    ];

    // עיצוב כותרות
    ws.getRow(1).font = { bold: true, size: 11 };
    ws.getRow(1).fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: 'FF1E3A2F' },
    };
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    const fmt = (d) => d ? new Date(d).toLocaleString('he-IL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }) : '';

    result.rows.forEach(r => {
      ws.addRow({
        created_at:       fmt(r.created_at),
        registrant_name:  r.registrant_name,
        registrant_phone: r.registrant_phone || '',
        tournament_name:  r.tournament_name,
        venue_name:       r.venue_name,
        tournament_date:  fmt(r.tournament_date),
      });
    });

    const filename = `registrations_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

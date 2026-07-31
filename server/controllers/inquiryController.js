const pool = require('../config/db');
const ExcelJS = require('exceljs');

exports.logInquiry = async (req, res) => {
  const { lesson_id, lesson_name, inquirer_name, inquirer_phone, user_id } = req.body;

  if (!lesson_name || !inquirer_name) {
    return res.status(400).json({ message: 'שדות חובה חסרים' });
  }

  // ולידציה על אורך שדות — מניעת injection/spam
  if (String(inquirer_name).length > 200 ||
      String(lesson_name).length > 200 ||
      (lesson_id && String(lesson_id).length > 100) ||
      (inquirer_phone && String(inquirer_phone).length > 30)) {
    return res.status(400).json({ message: 'ערכים ארוכים מדי' });
  }

  try {
    await pool.query(
      `INSERT INTO inquiry_logs
         (lesson_id, lesson_name, user_id, inquirer_name, inquirer_phone)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        lesson_id || null, lesson_name,
        user_id || null, inquirer_name,
        inquirer_phone || null,
      ]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('logInquiry error:', err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.getInquiries = async (req, res) => {
  try {
    const { lesson_id, search, offset = 0 } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 200, 1000); // מקסימום 1000
    const params = [];
    const where = [];
    let idx = 1;

    if (lesson_id) {
      where.push(`lesson_id = $${idx++}`);
      params.push(lesson_id);
    }
    if (search) {
      where.push(`(inquirer_name ILIKE $${idx} OR lesson_name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(
      `SELECT * FROM inquiry_logs ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM inquiry_logs ${whereClause}`,
      params.slice(0, -2)
    );

    res.json({ inquiries: result.rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

exports.exportInquiries = async (req, res) => {
  try {
    // אותה בניית WHERE כמו ב-getInquiries — כדי שהייצוא יכבד את הסינון/חיפוש הפעיל בפאנל
    const { lesson_id, search } = req.query;
    const params = [];
    const where = [];
    let idx = 1;

    if (lesson_id) {
      where.push(`lesson_id = $${idx++}`);
      params.push(lesson_id);
    }
    if (search) {
      where.push(`(inquirer_name ILIKE $${idx} OR lesson_name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT * FROM inquiry_logs ${whereClause} ORDER BY created_at DESC`,
      params
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Poker Live Israel';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('פניות', { views: [{ rightToLeft: true }] });

    ws.columns = [
      { header: 'תאריך פנייה', key: 'created_at', width: 20 },
      { header: 'שם הפונה',    key: 'inquirer_name', width: 22 },
      { header: 'טלפון',       key: 'inquirer_phone', width: 16 },
      { header: 'שיעור/מאמן',  key: 'lesson_name', width: 30 },
    ];

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
        created_at:      fmt(r.created_at),
        inquirer_name:   r.inquirer_name,
        inquirer_phone:  r.inquirer_phone || '',
        lesson_name:     r.lesson_name,
      });
    });

    const filename = `inquiries_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

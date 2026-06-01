const pool = require('../config/db');

// קבלת כל תבניות האירוע של המשתמש המחובר
exports.getTemplates = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, config, created_at FROM event_templates WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

// שמירת תבנית אירוע חדשה
exports.createTemplate = async (req, res) => {
  const { name, config } = req.body;

  if (!name?.trim()) return res.status(400).json({ message: 'שם התבנית הוא שדה חובה' });
  if (name.trim().length > 100) return res.status(400).json({ message: 'שם התבנית ארוך מדי' });
  if (!config || typeof config !== 'object') return res.status(400).json({ message: 'הגדרות התבנית חסרות' });

  try {
    const existing = await pool.query(
      'SELECT id FROM event_templates WHERE user_id = $1 AND name = $2',
      [req.user.id, name.trim()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'כבר קיימת תבנית עם שם זה — בחר שם אחר' });
    }

    const count = await pool.query('SELECT COUNT(*) FROM event_templates WHERE user_id = $1', [req.user.id]);
    if (parseInt(count.rows[0].count) >= 30) {
      return res.status(400).json({ message: 'הגעת למגבלה של 30 תבניות — מחק תבנית קיימת כדי להוסיף חדשה' });
    }

    const result = await pool.query(
      'INSERT INTO event_templates (user_id, name, config) VALUES ($1, $2, $3) RETURNING id, name, config, created_at',
      [req.user.id, name.trim(), JSON.stringify(config)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

// מחיקת תבנית (בעלים בלבד)
exports.deleteTemplate = async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM event_templates WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'תבנית לא נמצאה' });
    res.json({ message: 'התבנית נמחקה' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

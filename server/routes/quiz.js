// ── שעשועון הפוקר "שולם בליינד" (services/quiz.js) ─────────────────────────
// שלב סגור: רק אדמין ומשתמשים שאושרו בפאנל (או כולם, כשהמתג "פתוח לכולם" דולק).
// משחק בלי חשבון — בלי ניקוד; ניקוד וטבלה — רק למשתמשים רשומים.
const express = require('express');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const pool = require('../config/db');
const quiz = require('../services/quiz');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const SITE = process.env.SITE_URL || 'https://www.pokerisrael.org';

// מספיק לשחק מהר (נגד השעון ≈ שאלה בשנייה), לא מספיק לגרוף את כל המאגר בסקריפט
router.use(rateLimit({
  windowMs: 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.clientIp || req.ip),
  message: { message: 'יותר מדי בקשות — נסה שוב בעוד דקה' },
}));

// משתמש מחובר אם יש טוקן תקף (כולל בדיקת ביטול טוקן), אחרת אורח
async function softUser(req, res, next) {
  const token = req.cookies?.pli_token || req.headers.authorization?.split(' ')[1];
  if (!token) return next();
  try {
    const d = jwt.verify(token, process.env.JWT_SECRET);
    const r = await pool.query(`SELECT id, role, is_active, token_version, quiz_access FROM users WHERE id = $1`, [d.id]);
    const u = r.rows[0];
    if (u && u.is_active && d.tokenVersion === u.token_version) req.user = { id: u.id, role: u.role, quiz_access: u.quiz_access };
  } catch { /* אורח */ }
  next();
}

const wrap = (fn) => async (req, res) => {
  try { res.json(await fn(req)); }
  catch (err) {
    if (!err.status) console.error('[quiz]', err.message);
    res.status(err.status || 500).json({ message: err.status ? err.message : 'שגיאת שרת' });
  }
};

router.get('/access', softUser, wrap((req) => quiz.access(req.user)));
router.get('/me', softUser, wrap((req) => quiz.me(req.user)));
router.get('/leaderboard', softUser,
  wrap((req) => quiz.leaderboard(String(req.query.period || 'day'), req.user, req.query.club || null)));
router.get('/clubs/:id', softUser, wrap(async (req) => { await quiz.access(req.user); return quiz.clubInfo(req.params.id); }));
router.post('/games', softUser,
  wrap((req) => quiz.startGame({ user: req.user, mode: req.body?.mode, topic: req.body?.topic, venueId: req.body?.club })));
router.get('/games/:id', softUser, wrap((req) => quiz.getState(req.params.id, req.user)));
router.post('/games/:id/bet', softUser, wrap((req) => quiz.placeBet(req.params.id, req.user, req.body?.bet)));
router.post('/games/:id/answer', softUser, wrap((req) => quiz.answer(req.params.id, req.user, req.body?.choice)));
router.post('/games/:id/finish', softUser, wrap((req) => quiz.finishClock(req.params.id, req.user)));
router.post('/questions/:id/flag', softUser, wrap((req) => quiz.flagQuestion(req.user, req.params.id, req.body?.reason)));
router.put('/nickname', authenticate, wrap((req) => quiz.setNickname(req.user, req.body?.nickname)));

// ── ניהול (אדמין) ──
const admin = [authenticate, requireRole('admin')];
router.get('/admin/questions', ...admin, wrap((req) => quiz.adminList({ status: req.query.status, category: req.query.category })));
router.post('/admin/questions', ...admin, wrap((req) => quiz.adminSave(null, req.body || {})));
router.put('/admin/questions/:id', ...admin, wrap((req) => quiz.adminSave(Number(req.params.id), req.body || {})));
router.post('/admin/questions/status', ...admin, wrap((req) => quiz.adminSetStatus(req.body?.ids, req.body?.status)));
// גישה: מתג כללי, משתמש ספציפי, או כולם (ids: 'all')
router.get('/admin/access', ...admin, wrap(() => quiz.adminAccess()));
router.put('/admin/access/open', ...admin, wrap((req) => quiz.adminSetOpen(!!req.body?.open)));
router.put('/admin/access/users', ...admin, wrap((req) => quiz.adminSetUserAccess(req.body?.ids, !!req.body?.allowed)));
// מועדונים + QR לשולחן
router.get('/admin/clubs', ...admin, wrap(() => quiz.adminClubs(SITE)));
router.get('/admin/clubs/:id/qr', ...admin, wrap(async (req) => {
  const club = await quiz.clubInfo(req.params.id);
  const link = `${SITE}/quiz?club=${club.id}&utm_source=club_qr`;
  return { link, qr: await QRCode.toDataURL(link, { width: 600, margin: 2, errorCorrectionLevel: 'M' }) };
}));

module.exports = router;

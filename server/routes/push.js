// התראות דחיפה לאדמין (services/webPush.js)
const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const push = require('../services/webPush');

const router = express.Router();

router.get('/vapid-public-key', async (req, res) => {
  try {
    res.json({ publicKey: (await push.getVapidKeys()).publicKey });
  } catch (err) {
    console.error('[push]', err.message);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
});

router.use(authenticate, requireRole('admin'));

router.post('/subscribe', async (req, res) => {
  try {
    await push.saveSubscription(req.body?.subscription, req.user.id, req.get('user-agent'));
    res.json({ message: 'ההתראות הופעלו' });
  } catch (err) {
    res.status(400).json({ message: 'מנוי לא תקין' });
  }
});

router.post('/unsubscribe', async (req, res) => {
  await push.removeSubscription(req.body?.endpoint).catch(() => {});
  res.json({ message: 'ההתראות בוטלו' });
});

// התראת בדיקה — אותה הודעה כמו של הבוקר, עכשיו
router.post('/test', async (req, res) => {
  try {
    const n = await push.countToday();
    const r = await push.sendToAll({
      title: '📲 טורנירי היום מוכנים לשיתוף',
      body: `${n} טורנירים היום — לחץ, ואז "שתף בוואטסאפ" (בדיקה)`,
      url: '/today',
      tag: 'daily-share',
    });
    res.json(r);
  } catch (err) {
    console.error('[push] test failed:', err.message);
    res.status(500).json({ message: 'שגיאה בשליחה' });
  }
});

module.exports = router;

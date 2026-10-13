// שער אימות לנתיבי agent שמיועדים לקריאה על ידי סקריפטים אוטומטיים חיצוניים
// (whatsapp-forwarder, jokerclub-scraper) ולא על ידי משתמשים מחוברים — אין להם
// session/JWT, אז האימות כאן הוא סוד משותף בהדר, לא authenticate/requireRole.
const crypto = require('crypto');
const AGENT_SECRET = process.env.AGENT_SECRET;

// השוואה בזמן קבוע — לא חושפת דרך זמני תגובה כמה תווים מהסוד נכונים
function secretMatches(given) {
  if (typeof given !== 'string') return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(AGENT_SECRET).digest();
  return crypto.timingSafeEqual(a, b);
}

// כשלון סגור בכוונה: אם הסוד לא הוגדר בסביבה, חוסמים את כל התנועה במקום להריץ
// בלי אימות בשקט — זו בדיוק ההתנהגות שהובילה לנתיבים פתוחים לגמרי קודם לכן.
function requireAgentSecret(req, res, next) {
  if (!AGENT_SECRET) {
    console.error('[Agent] AGENT_SECRET אינו מוגדר — חוסם את כל התנועה לנתיבי agent');
    return res.status(503).json({ error: 'agent endpoint not configured' });
  }
  if (!secretMatches(req.headers['x-agent-secret'])) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

module.exports = { requireAgentSecret };

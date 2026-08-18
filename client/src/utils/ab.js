import api from './api';

/**
 * ניסויי A/B פשוטים על טקסט בממשק.
 *
 * הווריאנט נבחר פעם אחת למבקר ונשמר ב-localStorage — מבקר חוזר רואה תמיד את
 * אותה גרסה, אחרת המדידה חסרת משמעות (אותו אדם היה נספר בשתי הקבוצות).
 *
 * visitor הוא מזהה אקראי מקומי בלבד. אין בו מידע מזהה, והוא קיים רק כדי
 * שהשרת יוכל לספור כל מבקר פעם אחת ולא לספור ריענוני עמוד.
 */

const VISITOR_KEY = 'pli_visitor';

function visitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return null;   // localStorage חסום (מצב פרטי/הגדרות) — פשוט לא נמדוד
  }
}

export function getVariant(testKey, variants = ['a', 'b']) {
  const key = `pli_ab_${testKey}`;
  try {
    const saved = localStorage.getItem(key);
    if (saved && variants.includes(saved)) return saved;
    const picked = variants[Math.floor(Math.random() * variants.length)];
    localStorage.setItem(key, picked);
    return picked;
  } catch {
    return variants[0];   // בלי localStorage אין מדידה — מציגים ברירת מחדל יציבה
  }
}

export function trackAb(testKey, variant, event) {
  const visitor = visitorId();
  if (!visitor) return;
  // fire-and-forget: מדידה לעולם לא צריכה להאט או לשבור את הממשק
  api.post('/ab/event', { test_key: testKey, variant, event, visitor }).catch(() => {});
}

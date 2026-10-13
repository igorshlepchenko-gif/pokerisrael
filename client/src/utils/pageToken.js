// טוקן דף — נדרש לקריאות נתוני הטורנירים (הגנה מפני scraping, ראה
// server/middleware/antiScraping.js). השרת מטמיע אותו ב-index.html כ-<meta>;
// כשהוא פג (לשונית פתוחה יותר מכמה דקות) מבקשים דף חדש ושולפים ממנו טוקן טרי.
const META_NAME = 'pli-pt';
const REFRESH_MARGIN_SEC = 30;

let token = null;
let pending = null;

function decode(t) {
  try {
    const body = t.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(body));
  } catch {
    return null;
  }
}

function isFresh(t) {
  const p = t && decode(t);
  return !!p && p.e - REFRESH_MARGIN_SEC > Date.now() / 1000;
}

export function refreshPageToken() {
  if (!pending) {
    pending = (async () => {
      try {
        if (import.meta.env.DEV) {
          // בפיתוח Vite מגיש את index.html, לא השרת — יש endpoint ייעודי (רק מחוץ לפרודקשן)
          const res = await fetch('/api/page-token');
          token = (await res.json()).token || null;
        } else {
          const res = await fetch('/', { cache: 'no-store', credentials: 'same-origin' });
          const m = (await res.text()).match(new RegExp(`<meta name="${META_NAME}" content="([^"]+)"`));
          token = m ? m[1] : null;
        }
      } catch {
        token = null;
      } finally {
        pending = null;
      }
      return token;
    })();
  }
  return pending;
}

export async function getPageToken() {
  if (!token) token = document.querySelector(`meta[name="${META_NAME}"]`)?.content || null;
  if (isFresh(token)) return token;
  return refreshPageToken();
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// מפריד טורנירי "פיתיון" (canary) מהרשימה — הם נשארים ב-DOM אבל מוסתרים מהגולש.
// הטוקן מחזיק גיבובים של המזהים שלהם (אותו חישוב כמו server/utils/pageToken.js)
export async function splitCanaries(items) {
  const p = token && decode(token);
  if (!p?.h?.length || !globalThis.crypto?.subtle) return { visible: items, hidden: [] };
  const wanted = new Set(p.h);
  const hashes = await Promise.all(items.map((t) => sha256Hex(`${p.s}:${t.id}`)));
  const visible = [];
  const hidden = [];
  items.forEach((t, i) => (wanted.has(hashes[i].slice(0, 16)) ? hidden : visible).push(t));
  return { visible, hidden };
}

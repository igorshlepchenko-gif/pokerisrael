// LetsPoker sync — multi-club schedule sync (open.lets.poker), fetched directly server-side.
// Unlike Joker Club, the club page is Next.js SSR and embeds the full event data as JSON in a
// __NEXT_DATA__ script tag on the plain page load — no headless browser/scraper needed, and no
// dependency on their internal build-id (which changes on their redeploys; we never construct
// a /_next/data/<buildId>/... URL, just parse whatever the normal page returns).
// Mirrors jokerClubSync.js's upsert/diff approach, but — unlike Joker Club — LetsPoker exposes a
// real stable per-tournament id and a full per-level blind structure, so we store both.
//
// Multiple clubs run this same parser against their own club page (CLUBS below) — each is synced
// independently (own cron schedule in index.js) but shares this module's logic and the
// feed_sources bookkeeping table (keyed by venue_id+url, so rows never collide across clubs).
const pool = require('../config/db');
const axios = require('axios');
const { assertSafeUrl, SAFE_AXIOS } = require('../utils/safeUrl');

const SOURCE_KEY = 'letspoker';
const ADMIN_USER_ID = 1;

// venueId קבוע כשידוע ולא משתנה בין סביבות; venueName כשצריך שיפתר דינמית (HOUSE הוא
// venue_id=7 בפרודקשן אבל venue_id=9 מקומית — id קשיח היה שובר את הריצה המקומית)
const CLUBS = {
  evplus:   { venueId: 8, clubUrl: 'https://open.lets.poker/club/7e3d03b52cf0b58e', label: 'EVPlus — LetsPoker (יומי)' },
  house:    { venueName: 'HOUSE', clubUrl: 'https://open.lets.poker/club/2252df1b3bc6f405', label: 'HOUSE — LetsPoker (כל 5 שעות)' },
  showdown: { venueName: 'ShowDown', clubUrl: 'https://open.lets.poker/club/d6a9540abb951952', label: 'ShowDown — LetsPoker (כל 5 שעות)' },
  suits:    { venueName: 'Suits', clubUrl: 'https://open.lets.poker/club/suits-il', label: 'Suits — LetsPoker (כל 5 שעות)' },
  housedarom: { venueName: 'House דרום', clubUrl: 'https://open.lets.poker/club/house-il', label: 'House דרום — LetsPoker (כל 5 שעות)' },
};

async function resolveVenueId(club) {
  if (club.venueId) return club.venueId;
  const r = await pool.query(`SELECT id FROM venues WHERE name=$1 LIMIT 1`, [club.venueName]);
  if (!r.rows[0]) throw new Error(`[letsPokerSync] venue not found by name: "${club.venueName}"`);
  return r.rows[0].id;
}

// LetsPoker נותנת UTC אמיתי (עם Z), אבל עמודת start_time היא timestamp without time zone
// ומאוכלסת בכל הקוד הקיים (feedSync/jokerClubSync) כמחרוזת שעון-קיר ישראלי נטול Z —
// לכן צריך המרה מפורשת, אחרת הטורניר נשמר עם שעה שגויה (הפרש הקיץ/חורף מול UTC)
function toIsraelLocalNaive(isoUtc) {
  const d = new Date(isoUtc);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
}

function stripHtml(html) {
  if (!html) return null;
  const text = String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text || null;
}

// וריאנט ה"כניסה הרגילה" (לא הרשמה מוקדמת) — הטווח הרחב ביותר מבין סוגי Entry
function pickStandardEntry(variants) {
  const entries = (variants || []).filter(v => Array.isArray(v.types) && v.types.includes('Entry'));
  if (!entries.length) return null;
  const span = v => (v.allowedLevelsRange?.[1] ?? 0) - (v.allowedLevelsRange?.[0] ?? 0);
  return entries.reduce((best, v) => (span(v) > span(best) ? v : best), entries[0]);
}

function mapStages(structure) {
  return (structure || []).map(l => (
    l.break
      ? { type: 'break', duration: l.duration }
      : { type: 'level', level: l.level, ante: l.ante || 0, small_blind: l.smallBlind, big_blind: l.bigBlind, duration: l.duration }
  ));
}

// נרמול אירוע LetsPoker → הסכמה שלנו
function normalize(event) {
  const g = event?.config?.general;
  if (!g?.eventName || !g?.scheduledDate) return null;

  const buyin = event.config.buyin;
  const structure = event.config.structure;
  const standard = pickStandardEntry(buyin?.variants);
  const hasReentry = (buyin?.variants || []).some(v => v.types?.includes('Reentry'));
  const maxReentries = buyin?.maxReentriesPerPlayer;
  const reEntry = !hasReentry ? null : (maxReentries >= 900 ? 'Unlimited' : String(maxReentries ?? ''));

  const firstLevel = (structure || []).find(l => !l.break);
  const hrefMatch = String(g.descriptionHtml || '').match(/href="([^"]+)"/);

  return {
    external_id: event.id,
    name: g.eventName,
    description: stripHtml(g.descriptionHtml),
    start_time: toIsraelLocalNaive(g.scheduledDate),
    cost: standard?.totalCost ?? 0,
    gtd: event.config.prizePool?.guaranteeValue ?? null,
    starting_stack: standard?.chipsAdded ?? null,
    level_duration: firstLevel?.duration ?? null,
    re_entry: reEntry,
    late_reg_level: event.lastEntryLevel?.level ?? null,
    stages: JSON.stringify(mapStages(structure)),
    external_registration_url: hrefMatch ? hrefMatch[1] : null,
  };
}

// שליפת רשימת האירועים הגולמית מדף המועדון (ללא תלות ב-buildId של Next.js)
async function fetchEvents(clubUrl) {
  await assertSafeUrl(clubUrl);
  const { data: html } = await axios.get(clubUrl, SAFE_AXIOS);
  const m = String(html).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('__NEXT_DATA__ לא נמצא בדף — ייתכן שהאתר שינה מבנה');
  const data = JSON.parse(m[1]);
  const events = data?.props?.pageProps?.events;
  if (!Array.isArray(events)) throw new Error('מבנה לא צפוי — events חסר');
  return events;
}

// stringify עם מפתחות ממוינים — JSONB של Postgres מחזיר אובייקטים בסדר מפתחות
// לא בהכרח זהה לזה שנשלח בהכנסה, אז השוואת מחרוזת גולמית מייצרת "שינוי" מזויף בכל סנכרון
function stableStringify(val) {
  return JSON.stringify(val, (_key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value).sort().reduce((acc, k) => { acc[k] = value[k]; return acc; }, {});
    }
    return value;
  });
}

function isChanged(existing, fresh) {
  return (
    existing.name !== fresh.name ||
    Number(existing.cost) !== Number(fresh.cost) ||
    new Date(existing.start_time).getTime() !== new Date(fresh.start_time).getTime() ||
    (existing.description || null) !== (fresh.description || null) ||
    Number(existing.starting_stack ?? 0) !== Number(fresh.starting_stack ?? 0) ||
    Number(existing.gtd ?? 0) !== Number(fresh.gtd ?? 0) ||
    (existing.re_entry || null) !== (fresh.re_entry || null) ||
    Number(existing.late_reg_level ?? 0) !== Number(fresh.late_reg_level ?? 0) ||
    stableStringify(existing.stages) !== stableStringify(JSON.parse(fresh.stages)) ||
    (existing.external_registration_url || null) !== (fresh.external_registration_url || null) ||
    // נכתב ב-UPDATE למטה אבל לא נבדק כאן — שינוי שמערב רק אותו היה מוחזר
    // כ"אין שינוי" ונשאר תקוע עם הערך הישן לצמיתות
    Number(existing.level_duration ?? 0) !== Number(fresh.level_duration ?? 0)
  );
}

// clubKey: מפתח לתוך CLUBS (כרגע 'evplus' | 'house') — כל מועדון נשמר ומנוטר בנפרד,
// אך חולק את אותו פרסר/לוגיקת דיף/הגנות מחיקה
async function syncLetsPoker(clubKey) {
  const club = CLUBS[clubKey];
  if (!club) throw new Error(`[letsPokerSync] Unknown club key: ${clubKey}`);
  const venueId = await resolveVenueId(club);
  const { clubUrl, label } = club;

  const result = { added: 0, updated: 0, removed: 0, skipped: 0, errors: 0 };

  const rawEvents = await fetchEvents(clubUrl);
  const normalized = rawEvents.map(normalize).filter(Boolean);
  const freshIds = new Set(normalized.map(t => t.external_id));

  const existingRes = await pool.query(
    `SELECT id, external_id, name, cost, start_time, description, starting_stack, gtd,
            re_entry, late_reg_level, stages, external_registration_url, manually_edited, level_duration
     FROM tournaments WHERE external_source=$1 AND venue_id=$2`,
    [SOURCE_KEY, venueId]
  );
  const existingById = new Map(existingRes.rows.map(r => [r.external_id, r]));

  for (const t of normalized) {
    try {
      const existing = existingById.get(t.external_id);
      if (!existing) {
        await pool.query(
          `INSERT INTO tournaments
             (venue_id, name, description, cost, start_time, stages, starting_stack, level_duration,
              re_entry, late_reg_level, gtd, external_registration_url, is_recurring, tournament_type,
              status, created_by, external_source, external_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false,'live','approved',$13,$14,$15)`,
          [venueId, t.name, t.description, t.cost, t.start_time, t.stages, t.starting_stack,
           t.level_duration, t.re_entry, t.late_reg_level, t.gtd, t.external_registration_url,
           ADMIN_USER_ID, SOURCE_KEY, t.external_id]
        );
        result.added++;
      } else if (existing.manually_edited) {
        result.skipped++;
      } else if (isChanged(existing, t)) {
        await pool.query(
          `UPDATE tournaments SET
             name=$1, description=$2, cost=$3, start_time=$4, stages=$5, starting_stack=$6,
             level_duration=$7, re_entry=$8, late_reg_level=$9, gtd=$10, external_registration_url=$11,
             updated_at=NOW()
           WHERE id=$12`,
          [t.name, t.description, t.cost, t.start_time, t.stages, t.starting_stack,
           t.level_duration, t.re_entry, t.late_reg_level, t.gtd, t.external_registration_url, existing.id]
        );
        result.updated++;
      } else {
        result.skipped++;
      }
    } catch (e) {
      console.error(`[letsPokerSync:${clubKey}] upsert error:`, e.message);
      result.errors++;
    }
  }

  // מחיקה — טורנירים שירדו מהפיד (הסתיימו/בוטלו), עם אותה הגנה מפני ירידה חשודה
  const toRemove = existingRes.rows.filter(r => !freshIds.has(r.external_id) && !r.manually_edited);
  const existingCount = existingRes.rows.length;

  if (normalized.length === 0) {
    console.warn(`[letsPokerSync:${clubKey}] feed returned 0 valid tournaments — skipping all deletions`);
    result.removeSkipped = toRemove.length;
  } else if (existingCount >= 4 && toRemove.length > existingCount * 0.5) {
    console.warn(`[letsPokerSync:${clubKey}] suspicious drop (${toRemove.length}/${existingCount} > 50%) — skipping deletions`);
    result.removeSkipped = toRemove.length;
  } else {
    for (const r of toRemove) {
      try {
        await pool.query('DELETE FROM tournaments WHERE id=$1', [r.id]);
        result.removed++;
      } catch (e) {
        console.error(`[letsPokerSync:${clubKey}] delete error:`, e.message);
        result.errors++;
      }
    }
  }

  const summary = `✅ +${result.added} ~${result.updated} -${result.removed} (${result.skipped} ללא שינוי)` +
    (result.removeSkipped ? ` ⚠️ דילוג על ${result.removeSkipped} מחיקות (חשוד)` : '');
  await pool.query(
    `INSERT INTO feed_sources (venue_id, url, label, source_key, auto_publish, active, last_synced, last_result, created_by)
     VALUES ($1,$2,$3,$4,true,true,NOW(),$5,$6)
     ON CONFLICT (venue_id, url) DO UPDATE SET last_synced=NOW(), last_result=$5`,
    [venueId, clubUrl, label, SOURCE_KEY, summary, ADMIN_USER_ID]
  ).catch(e => console.error(`[letsPokerSync:${clubKey}] feed_sources bookkeeping error:`, e.message));

  console.log(`[letsPokerSync:${clubKey}] ${summary}`);
  return result;
}

module.exports = { syncLetsPoker, normalize, fetchEvents, CLUBS };

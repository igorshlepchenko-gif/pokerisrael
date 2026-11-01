// Joker Club sync — receives tournament data scraped by the local jokerclub-scraper
// script (headless browser, since jokerclub.co.il/reg is a client-rendered SPA with
// no public API) and upserts it into `tournaments`, mirroring feedSync.js's approach.
const crypto = require('crypto');
const pool   = require('../config/db');

const JOKER_CLUB_VENUE_ID = 6;
const SOURCE_KEY = 'jokerclub';

function makeExternalId(t) {
  const key = [t.name, t.date_str, t.start_time].join('|');
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
}

function parseStack(s) {
  if (!s) return null;
  const m = String(s).match(/([\d.]+)\s*K/i);
  if (m) return Math.round(parseFloat(m[1]) * 1000);
  const n = String(s).replace(/[^\d]/g, '');
  return n ? Number(n) : null;
}

function parseLevelMinutes(s) {
  if (!s) return null;
  const m = String(s).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function parseLateRegLevel(s) {
  if (!s) return null;
  const m = String(s).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function parseStartDt(dateStr, timeStr) {
  // dateStr: DD.MM.YY
  const m = String(dateStr).match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
  if (!m || !timeStr) return null;
  const [, dd, mm, yy] = m;
  return `20${yy}-${mm}-${dd}T${timeStr}:00`;
}

// עמלה מתוך "פירוט דמי כניסה": הרכיב האחרון הוא תמיד העמלה.
// "₪1,200 (1,000+200)" → 200 (פרסים+עמלה); "₪1,600 (1,250+100+250)" → 250 (פרסים+באונטי+עמלה).
function parseRake(breakdown) {
  const m = String(breakdown || '').match(/\(([\d,+\s]+)\)/);
  if (!m) return null;
  const parts = m[1].split('+').map(s => Number(s.replace(/[,\s]/g, '')));
  if (parts.length < 2 || parts.some(n => !Number.isFinite(n))) return null;
  return parts[parts.length - 1];
}

function buildDescription(t) {
  const parts = [];
  if (t.prize_percent) parts.push(`אחוז בפרסים: ${t.prize_percent}`);
  if (t.early_bird_bonus) parts.push(`בונוס מגיעים מוקדם: ${t.early_bird_bonus}`);
  if (t.badge) parts.push(`סדרה: ${t.badge}`);
  if (t.max_players) parts.push(`מקסימום שחקנים: ${t.max_players}`);
  if (!t.is_open) parts.push(`סטטוס: ${t.status}`);
  return parts.length ? parts.join(' | ') : null;
}

// משחקים שאינם פוקר שהג'וקר מפרסם באותו עמוד הרשמה (למשל טורניר שש-בש) — לא מיובאים לאתר
const NON_POKER = /שש[\s-]?בש|backgammon|שחמט|\bchess\b/i;

function normalize(t) {
  const startDt = parseStartDt(t.date_str, t.start_time);
  if (!startDt || !t.name) return null;
  if (NON_POKER.test(t.name)) return null;
  return {
    external_id: makeExternalId(t),
    name: t.name,
    description: buildDescription(t),
    cost: t.cost ?? 0,
    rake: parseRake(t.cost_breakdown),
    start_time: startDt,
    starting_stack: parseStack(t.starting_stack),
    level_duration: parseLevelMinutes(t.blind_length),
    re_entry: t.max_rebuys || null,
    late_reg_level: parseLateRegLevel(t.late_reg),
  };
}

function isChanged(existing, fresh) {
  return (
    existing.name !== fresh.name ||
    Number(existing.cost) !== Number(fresh.cost) ||
    Number(existing.rake ?? 0) !== Number(fresh.rake ?? 0) ||
    new Date(existing.start_time).getTime() !== new Date(fresh.start_time).getTime() ||
    (existing.description || null) !== (fresh.description || null) ||
    Number(existing.starting_stack ?? 0) !== Number(fresh.starting_stack ?? 0) ||
    Number(existing.level_duration ?? 0) !== Number(fresh.level_duration ?? 0) ||
    (existing.re_entry || null) !== (fresh.re_entry || null) ||
    Number(existing.late_reg_level ?? 0) !== Number(fresh.late_reg_level ?? 0)
  );
}

async function syncJokerClub(rawTournaments) {
  const result = { added: 0, updated: 0, removed: 0, skipped: 0, errors: 0 };

  const normalized = rawTournaments.map(normalize).filter(Boolean);
  const freshIds = new Set(normalized.map(t => t.external_id));

  const existingRes = await pool.query(
    `SELECT id, external_id, name, cost, rake, start_time, description, starting_stack, level_duration, re_entry, late_reg_level, manually_edited
     FROM tournaments WHERE external_source=$1 AND venue_id=$2`,
    [SOURCE_KEY, JOKER_CLUB_VENUE_ID]
  );
  const existingById = new Map(existingRes.rows.map(r => [r.external_id, r]));

  for (const t of normalized) {
    try {
      const existing = existingById.get(t.external_id);
      if (!existing) {
        await pool.query(
          `INSERT INTO tournaments
             (venue_id, name, description, cost, start_time, starting_stack, level_duration,
              re_entry, late_reg_level, is_recurring, tournament_type, status, created_by,
              external_source, external_id, rake, rake_type)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false,'live','approved',$10,$11,$12,$13,$14)`,
          [JOKER_CLUB_VENUE_ID, t.name, t.description, t.cost, t.start_time, t.starting_stack,
           t.level_duration, t.re_entry, t.late_reg_level, 1, SOURCE_KEY, t.external_id,
           t.rake, t.rake != null ? 'amount' : null]
        );
        result.added++;
      } else if (existing.manually_edited) {
        result.skipped++;
      } else if (isChanged(existing, t)) {
        await pool.query(
          `UPDATE tournaments SET
             name=$1, description=$2, cost=$3, start_time=$4, starting_stack=$5,
             level_duration=$6, re_entry=$7, late_reg_level=$8,
             rake=$9, rake_type=$10, updated_at=NOW()
           WHERE id=$11`,
          [t.name, t.description, t.cost, t.start_time, t.starting_stack,
           t.level_duration, t.re_entry, t.late_reg_level,
           t.rake, t.rake != null ? 'amount' : null, existing.id]
        );
        result.updated++;
      } else {
        result.skipped++;
      }
    } catch (e) {
      console.error('[jokerClubSync] upsert error:', e.message);
      result.errors++;
    }
  }

  // Remove tournaments that dropped off the list (ended/cancelled) — same safety
  // guard as feedSync.js: never wipe everything on an empty or suspicious response.
  const toRemove = existingRes.rows.filter(r => !freshIds.has(r.external_id) && !r.manually_edited);
  const existingCount = existingRes.rows.length;

  if (normalized.length === 0) {
    console.warn('[jokerClubSync] scrape returned 0 valid tournaments — skipping all deletions');
    result.removeSkipped = toRemove.length;
  } else if (existingCount >= 4 && toRemove.length > existingCount * 0.5) {
    console.warn(`[jokerClubSync] suspicious drop (${toRemove.length}/${existingCount} > 50%) — skipping deletions`);
    result.removeSkipped = toRemove.length;
  } else {
    for (const r of toRemove) {
      try {
        await pool.query('DELETE FROM tournaments WHERE id=$1', [r.id]);
        result.removed++;
      } catch (e) {
        console.error('[jokerClubSync] delete error:', e.message);
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
    [JOKER_CLUB_VENUE_ID, 'https://jokerclub.co.il/reg', 'Joker Club — סריקה כל שעתיים', SOURCE_KEY, summary, 1]
  ).catch(e => console.error('[jokerClubSync] feed_sources bookkeeping error:', e.message));

  console.log(`[jokerClubSync] ${summary}`);
  return result;
}

module.exports = { syncJokerClub, normalize, makeExternalId, parseRake };

// Doubleup Club sync — receives tournament data scraped by the local doubleup-scraper
// script (headless browser, since the schedule lives on a Monday.com form with no public
// API and real Cloudflare bot-detection) and upserts it into `tournaments`, mirroring
// jokerClubSync.js's approach.
const crypto = require('crypto');
const pool   = require('../config/db');

const DOUBLEUP_VENUE_ID = 11;
const SOURCE_KEY = 'doubleup';

function makeExternalId(t) {
  const key = [t.name, t.date_str, t.start_time].join('|');
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
}

function formatChips(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Order matches the manual bootstrap entries (2026-07-27): late-reg, re-entry, early-bird.
function buildDescription(t) {
  const parts = [];
  if (t.is_mystery_bounty) parts.push('מיסטרי באונטי');
  if (t.bounty) parts.push(`כולל ${t.bounty} בונוס באונטי מתוך הכניסה`);
  if (t.late_reg_time) parts.push(`הרשמה מאוחרת עד ${t.late_reg_time}`);
  if (t.reentry_multiplier) parts.push(`ריאנטרי X${t.reentry_multiplier}${t.reentry_level ? ` עד סוף שלב ${t.reentry_level}` : ''}`);
  if (t.early_bird_chips) parts.push(`הרשמה מוקדמת עד ${t.early_bird_deadline} מזכה בבונוס ${formatChips(t.early_bird_chips)} צ׳יפים`);
  return parts.length ? parts.join('. ') + '.' : null;
}

function parseStartDt(dateStr, timeStr) {
  // dateStr: D.M.YY or D.M.YYYY, exactly as it appears on the form (not zero-padded)
  const m = String(dateStr).match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (!m || !timeStr) return null;
  let [, dd, mm, yy] = m;
  if (yy.length === 2) yy = `20${yy}`;
  dd = dd.padStart(2, '0');
  mm = mm.padStart(2, '0');
  return `${yy}-${mm}-${dd}T${timeStr}:00`;
}

function normalize(t) {
  const startDt = parseStartDt(t.date_str, t.start_time);
  if (!startDt || !t.name || t.cost == null) return null;
  return {
    external_id: makeExternalId(t),
    name: t.name,
    description: buildDescription(t),
    cost: t.cost,
    start_time: startDt,
    starting_stack: t.starting_stack ?? null,
    level_duration: t.level_duration ?? null,
    re_entry: t.reentry_multiplier != null ? String(t.reentry_multiplier) : null,
    rake: t.rake ?? null,
    rake_type: t.rake != null ? 'amount' : null,
  };
}

function isChanged(existing, fresh) {
  return (
    existing.name !== fresh.name ||
    Number(existing.cost) !== Number(fresh.cost) ||
    new Date(existing.start_time).getTime() !== new Date(fresh.start_time).getTime() ||
    (existing.description || null) !== (fresh.description || null) ||
    Number(existing.starting_stack ?? 0) !== Number(fresh.starting_stack ?? 0) ||
    Number(existing.level_duration ?? 0) !== Number(fresh.level_duration ?? 0) ||
    (existing.re_entry || null) !== (fresh.re_entry || null) ||
    Number(existing.rake ?? 0) !== Number(fresh.rake ?? 0)
  );
}

async function syncDoubleup(rawTournaments) {
  const result = { added: 0, updated: 0, removed: 0, skipped: 0, errors: 0 };

  const normalized = rawTournaments.map(normalize).filter(Boolean);
  const freshIds = new Set(normalized.map(t => t.external_id));

  const existingRes = await pool.query(
    `SELECT id, external_id, name, cost, start_time, description, starting_stack, level_duration, re_entry, rake, manually_edited
     FROM tournaments WHERE external_source=$1 AND venue_id=$2`,
    [SOURCE_KEY, DOUBLEUP_VENUE_ID]
  );
  const existingById = new Map(existingRes.rows.map(r => [r.external_id, r]));

  for (const t of normalized) {
    try {
      const existing = existingById.get(t.external_id);
      if (!existing) {
        await pool.query(
          `INSERT INTO tournaments
             (venue_id, name, description, cost, start_time, starting_stack, level_duration,
              re_entry, rake, rake_type, is_recurring, tournament_type, status,
              external_source, external_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,'live','approved',$11,$12)`,
          [DOUBLEUP_VENUE_ID, t.name, t.description, t.cost, t.start_time, t.starting_stack,
           t.level_duration, t.re_entry, t.rake, t.rake_type, SOURCE_KEY, t.external_id]
        );
        result.added++;
      } else if (existing.manually_edited) {
        result.skipped++;
      } else if (isChanged(existing, t)) {
        await pool.query(
          `UPDATE tournaments SET
             name=$1, description=$2, cost=$3, start_time=$4, starting_stack=$5,
             level_duration=$6, re_entry=$7, rake=$8, rake_type=$9, updated_at=NOW()
           WHERE id=$10`,
          [t.name, t.description, t.cost, t.start_time, t.starting_stack,
           t.level_duration, t.re_entry, t.rake, t.rake_type, existing.id]
        );
        result.updated++;
      } else {
        result.skipped++;
      }
    } catch (e) {
      console.error('[doubleupSync] upsert error:', e.message);
      result.errors++;
    }
  }

  // Remove tournaments that dropped off the list — same safety guard as jokerClubSync.js:
  // never wipe everything on an empty or suspicious response.
  const toRemove = existingRes.rows.filter(r => !freshIds.has(r.external_id) && !r.manually_edited);
  const existingCount = existingRes.rows.length;

  if (normalized.length === 0) {
    console.warn('[doubleupSync] scrape returned 0 valid tournaments — skipping all deletions');
    result.removeSkipped = toRemove.length;
  } else if (existingCount >= 4 && toRemove.length > existingCount * 0.5) {
    console.warn(`[doubleupSync] suspicious drop (${toRemove.length}/${existingCount} > 50%) — skipping deletions`);
    result.removeSkipped = toRemove.length;
  } else {
    for (const r of toRemove) {
      try {
        await pool.query('DELETE FROM tournaments WHERE id=$1', [r.id]);
        result.removed++;
      } catch (e) {
        console.error('[doubleupSync] delete error:', e.message);
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
    [DOUBLEUP_VENUE_ID, 'https://wkf.ms/4cY3pvm', 'DoubleUp — סריקה יומית 22:00', SOURCE_KEY, summary, 1]
  ).catch(e => console.error('[doubleupSync] feed_sources bookkeeping error:', e.message));

  console.log(`[doubleupSync] ${summary}`);
  return result;
}

module.exports = { syncDoubleup, normalize, makeExternalId, parseStartDt };

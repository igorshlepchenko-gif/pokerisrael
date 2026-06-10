// סנכרון פיד טורנירים חיצוני (JSON) → טבלת tournaments
// רץ יומית: מוסיף חדשים, מעדכן ששונו, מוחק שירדו מהפיד (הסתיימו)
const crypto = require('crypto');
const axios = require('axios');
const pool = require('../config/db');
const { assertSafeUrl, SAFE_AXIOS } = require('../utils/safeUrl');

const DAY_NAME_MAP = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

// מזהה יציב לטורניר בפיד (אין id מובנה) — hash משדות יציבים
function makeExternalId(t) {
  const key = [t.name, t.date, t.start_time, t.host?.name].join('|');
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 32);
}

// נרמול טורניר בפורמט runnerrunner → הסכמה שלנו (כולל מבנה בליינדים)
function normalize(t) {
  if (!t || !t.name) return null;
  const phases = Array.isArray(t.structure?.phases) ? t.structure.phases : [];
  let level = 0;
  const stages = phases.map(p => {
    if (p.is_break) return { type: 'break', duration: p.break_duration_minutes || p.duration_minutes || 0 };
    return {
      level: ++level,
      small_blind: p.small_blind ?? 0,
      big_blind: p.big_blind ?? 0,
      ante: p.ante ?? 0,
      duration: p.duration_minutes ?? null,
    };
  });
  const firstPlay = phases.find(p => !p.is_break);
  const startTime = (t.date && t.start_time) ? `${t.date}T${t.start_time}:00` : null;
  return {
    external_id: makeExternalId(t),
    name: t.name,
    description: t.description || null,
    start_time: startTime,
    cost: t.buy_in ?? 0,
    starting_stack: t.initial_stack ?? null,
    level_duration: firstPlay?.duration_minutes ?? null,
    re_entry: t.re_buy ? '1' : null,
    day_of_week: t.day ? (DAY_NAME_MAP[String(t.day).toLowerCase()] ?? null) : null,
    stages: JSON.stringify(stages),
    host_name: t.host?.name || null,
    host_address: t.host?.address || t.address || null,
  };
}

// נרמול טקסט עברי להשוואת מארח↔מועדון (הסרת תחיליות נפוצות)
function normHost(s) {
  return String(s || '')
    .replace(/^(בית|מועדון|מקום|האוס)\s+/i, '')
    .replace(/[״"',.]/g, '')
    .trim();
}

// התאמת מארח מהפיד למועדון מאושר קיים. מחזיר venue_id או null.
function matchHostVenue(hostName, hostAddress, venues) {
  const hn = normHost(hostName);
  if (!hn) return null;
  for (const v of venues) {
    const vn = normHost(v.name);
    if (vn && (vn === hn || vn.includes(hn) || hn.includes(vn))) return v.id;
  }
  // גיבוי: התאמה לפי כתובת (רחוב+מספר)
  if (hostAddress) {
    const ha = String(hostAddress).split(',')[0].replace(/[״"',.]/g, '').trim();
    for (const v of venues) {
      const va = String(v.address || '').replace(/[״"',.]/g, '').trim();
      if (va && ha && (va === ha || va.includes(ha) || ha.includes(va))) return v.id;
    }
  }
  return null;
}

// השוואה: האם טורניר קיים שונה מהפיד (לעדכון)
function isChanged(existing, feed) {
  return (
    existing.name !== feed.name ||
    Number(existing.cost) !== Number(feed.cost) ||
    new Date(existing.start_time).getTime() !== new Date(feed.start_time).getTime() ||
    (existing.description || null) !== (feed.description || null) ||
    Number(existing.starting_stack ?? 0) !== Number(feed.starting_stack ?? 0)
  );
}

// סנכרון פיד יחיד
async function syncFeed(feed) {
  const result = { added: 0, updated: 0, removed: 0, skipped: 0, errors: 0 };
  const sourceKey = feed.source_key || 'feed';
  const status = feed.auto_publish ? 'approved' : 'pending';

  // 1. משיכת הפיד (עם הגנת SSRF)
  await assertSafeUrl(feed.url);
  const { data } = await axios.get(feed.url, SAFE_AXIOS);
  let raw = data;
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { /* */ } }
  const list = Array.isArray(raw?.tournaments) ? raw.tournaments : Array.isArray(raw) ? raw : null;
  if (!list) throw new Error('פורמט פיד לא נתמך');

  const normalized = list.map(normalize).filter(t => t && t.start_time);
  const feedIds = new Set(normalized.map(t => t.external_id));

  // המארגן = המועדון של מקור הפיד (למשל "ראנר ראנר")
  const organizerVenueId = feed.venue_id;

  // מועדונים מאושרים — להתאמת מארח (host) למועדון קיים
  const venuesRes = await pool.query('SELECT id, name, address FROM venues WHERE is_approved = true');
  const approvedVenues = venuesRes.rows;

  // 2. טורנירים קיימים שמקורם בפיד הזה (לפי מארגן)
  const existingRes = await pool.query(
    `SELECT id, external_id, name, cost, start_time, description, starting_stack, manually_edited
     FROM tournaments WHERE external_source = $1 AND organizer_venue_id = $2`,
    [sourceKey, organizerVenueId]
  );
  const existingById = new Map(existingRes.rows.map(r => [r.external_id, r]));

  // 3. הוספה / עדכון
  for (const t of normalized) {
    try {
      // התאמת מארח למועדון קיים → רישום כפול. אם אין התאמה → המארגן עצמו.
      const matchedHost = matchHostVenue(t.host_name, t.host_address, approvedVenues);
      const venueId = matchedHost || organizerVenueId;

      const existing = existingById.get(t.external_id);
      if (!existing) {
        await pool.query(
          `INSERT INTO tournaments
             (venue_id, organizer_venue_id, name, description, cost, start_time, stages, starting_stack,
              level_duration, re_entry, day_of_week, is_recurring, tournament_type,
              status, created_by, external_source, external_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false,'live',$12,$13,$14,$15)`,
          [venueId, organizerVenueId, t.name, t.description, t.cost, t.start_time, t.stages,
           t.starting_stack, t.level_duration, t.re_entry, t.day_of_week,
           status, feed.created_by, sourceKey, t.external_id]
        );
        result.added++;
      } else if (existing.manually_edited) {
        // עריכה ידנית מנצחת — לא דורסים תוכן שנערך אצלנו
        result.skipped++;
      } else if (isChanged(existing, t)) {
        await pool.query(
          `UPDATE tournaments SET
             venue_id=$1, name=$2, description=$3, cost=$4, start_time=$5, stages=$6,
             starting_stack=$7, level_duration=$8, re_entry=$9, day_of_week=$10, updated_at=NOW()
           WHERE id=$11`,
          [venueId, t.name, t.description, t.cost, t.start_time, t.stages,
           t.starting_stack, t.level_duration, t.re_entry, t.day_of_week, existing.id]
        );
        result.updated++;
      } else {
        result.skipped++;
      }
    } catch (e) {
      console.error('[feedSync] upsert error:', e.message);
      result.errors++;
    }
  }

  // 4. מחיקה — טורנירים שירדו מהפיד (הסתיימו / בוטלו)
  const toRemove = existingRes.rows.filter(r => !feedIds.has(r.external_id));
  const existingCount = existingRes.rows.length;

  // הגנה: פיד ריק או ירידה חשודה → אל תמחק (כנראה תקלה אצל הספק, לא ביטול אמיתי)
  if (normalized.length === 0) {
    console.warn('[feedSync] feed returned 0 valid tournaments — skipping all deletions');
    result.removeSkipped = toRemove.length;
  } else if (existingCount >= 4 && toRemove.length > existingCount * 0.5) {
    console.warn(`[feedSync] suspicious drop (${toRemove.length}/${existingCount} > 50%) — skipping deletions`);
    result.removeSkipped = toRemove.length;
  } else {
    for (const r of toRemove) {
      try {
        await pool.query('DELETE FROM tournaments WHERE id = $1', [r.id]);
        result.removed++;
      } catch (e) {
        console.error('[feedSync] delete error:', e.message);
        result.errors++;
      }
    }
  }

  return result;
}

// סנכרון כל הפידים הפעילים
async function syncAllFeeds() {
  const feeds = await pool.query('SELECT * FROM feed_sources WHERE active = true');
  for (const feed of feeds.rows) {
    try {
      const r = await syncFeed(feed);
      const warn = r.removeSkipped ? ` ⚠️ דילוג על ${r.removeSkipped} מחיקות (פיד חשוד)` : '';
      const summary = `✅ +${r.added} ~${r.updated} -${r.removed} (${r.skipped} ללא שינוי)${warn}`;
      await pool.query('UPDATE feed_sources SET last_synced=NOW(), last_result=$1 WHERE id=$2', [summary, feed.id]);
      console.log(`[feedSync] feed#${feed.id} (${feed.label || feed.url}): ${summary}`);
    } catch (e) {
      const msg = `❌ ${e.message}`;
      await pool.query('UPDATE feed_sources SET last_synced=NOW(), last_result=$1 WHERE id=$2', [msg, feed.id]).catch(() => {});
      console.error(`[feedSync] feed#${feed.id} failed:`, e.message);
    }
  }
}

module.exports = { syncFeed, syncAllFeeds, normalize, makeExternalId };

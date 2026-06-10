// סנכרון פיד טורנירים חיצוני (JSON) → טבלת tournaments
// רץ יומית: מוסיף חדשים, מעדכן ששונו, מוחק שירדו מהפיד (הסתיימו)
const crypto = require('crypto');
const axios = require('axios');
const pool = require('../config/db');

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
  };
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

  // 1. משיכת הפיד
  const { data } = await axios.get(feed.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PokerIsraelBot/1.0)' },
    timeout: 20000,
    maxContentLength: 10 * 1024 * 1024,
  });
  let raw = data;
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { /* */ } }
  const list = Array.isArray(raw?.tournaments) ? raw.tournaments : Array.isArray(raw) ? raw : null;
  if (!list) throw new Error('פורמט פיד לא נתמך');

  const normalized = list.map(normalize).filter(t => t && t.start_time);
  const feedIds = new Set(normalized.map(t => t.external_id));

  // 2. טורנירים קיימים שמקורם בפיד הזה (למועדון הזה)
  const existingRes = await pool.query(
    `SELECT id, external_id, name, cost, start_time, description, starting_stack
     FROM tournaments WHERE external_source = $1 AND venue_id = $2`,
    [sourceKey, feed.venue_id]
  );
  const existingById = new Map(existingRes.rows.map(r => [r.external_id, r]));

  // 3. הוספה / עדכון
  for (const t of normalized) {
    try {
      const existing = existingById.get(t.external_id);
      if (!existing) {
        await pool.query(
          `INSERT INTO tournaments
             (venue_id, name, description, cost, start_time, stages, starting_stack,
              level_duration, re_entry, day_of_week, is_recurring, tournament_type,
              status, created_by, external_source, external_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false,'live',$11,$12,$13,$14)`,
          [feed.venue_id, t.name, t.description, t.cost, t.start_time, t.stages,
           t.starting_stack, t.level_duration, t.re_entry, t.day_of_week,
           status, feed.created_by, sourceKey, t.external_id]
        );
        result.added++;
      } else if (isChanged(existing, t)) {
        await pool.query(
          `UPDATE tournaments SET
             name=$1, description=$2, cost=$3, start_time=$4, stages=$5,
             starting_stack=$6, level_duration=$7, re_entry=$8, day_of_week=$9, updated_at=NOW()
           WHERE id=$10`,
          [t.name, t.description, t.cost, t.start_time, t.stages,
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
  for (const r of toRemove) {
    try {
      await pool.query('DELETE FROM tournaments WHERE id = $1', [r.id]);
      result.removed++;
    } catch (e) {
      console.error('[feedSync] delete error:', e.message);
      result.errors++;
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
      const summary = `✅ +${r.added} ~${r.updated} -${r.removed} (${r.skipped} ללא שינוי)`;
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

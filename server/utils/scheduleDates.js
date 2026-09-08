/**
 * Year resolution for imported tournament schedules.
 *
 * Club schedules — printed images and WhatsApp text alike — give day and month
 * only ("14.9"), essentially never a year. Something has to supply it, and both
 * of the obvious sources are wrong in their own way:
 *   • The vision model is the worst source. Left to itself it dated a September
 *     schedule to 2024, and Dashboard.jsx feeds `date` straight into
 *     POST /tournaments, so a wrong year silently creates a past tournament.
 *   • A flat `new Date().getFullYear()` is right for most of the year and wrong
 *     every December, when a row reading "5.1" means January of the NEXT year.
 *
 * So the year is derived here instead, from one rule: a schedule advertises
 * upcoming events, so its dates are not in the past.
 *
 * Used by controllers/tournamentController.js (image import) and
 * services/importAgent.js (weekly schedule text/image). Keep it shared — the
 * two features drifted apart once already.
 */

// How far into the past a date may sit before it is treated as "really means next
// year". Keeps a schedule uploaded a couple of weeks late from being flung a whole
// year forward, while still catching a genuine December→January rollover.
const SCHEDULE_PAST_GRACE_DAYS = 60;

/** Date-only "today" in club-local terms. en-CA formats as YYYY-MM-DD. */
function todayInIsrael() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
}

/**
 * Re-derive the year of a YYYY-MM-DD date from the month/day it carries.
 *
 * A plausible (non-past) year is left alone, so an image that really does print
 * "14.9.2027" still works. Only a date already in the past gets rebuilt — which
 * fixes both the invented-past-year case and the December rollover with one rule.
 * Anything that isn't a YYYY-MM-DD string is returned untouched.
 */
function resolveScheduleYear(iso, todayIso = todayInIsrael()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return iso;                       // null / free-text — leave for the caller to skip
  const [, modelYear, month, day] = m;
  const [ty, tm, td] = todayIso.split('-').map(Number);
  const mo = Number(month), da = Number(day);

  // Date.UTC silently rolls an impossible day into the next month (29 February in a
  // non-leap year becomes 1 March), which would emit a date string that never existed.
  // Round-trip the components instead and treat a mismatch as "not a real date".
  const realDate = y => {
    const d = new Date(Date.UTC(y, mo - 1, da));
    return d.getUTCMonth() === mo - 1 && d.getUTCDate() === da ? d.getTime() : null;
  };
  const cutoff = Date.UTC(ty, tm - 1, td) - SCHEDULE_PAST_GRACE_DAYS * 86400000;

  const asModel = realDate(Number(modelYear));
  if (asModel !== null && asModel >= cutoff) return iso;   // year is already sensible

  // Nearest upcoming year in which this day+month actually exists. The bound only ever
  // matters for 29 February, which needs at most a four-year hop.
  for (let y = ty; y <= ty + 8; y++) {
    const t = realDate(y);
    if (t !== null && t >= cutoff) return `${y}-${month}-${day}`;
  }
  return iso;   // nothing sensible to offer — leave it for the admin to eyeball
}

module.exports = { SCHEDULE_PAST_GRACE_DAYS, todayInIsrael, resolveScheduleYear };

// Parses the rendered innerText of https://jokerclub.co.il/reg into structured tournaments.
// Each tournament block is delimited by a Hebrew day-name + date + HH:MM header, so
// parsing is chunk-based and label-anchored rather than positional — resilient to optional
// fields (early-bird bonus, series badge, max players) appearing only on some tournaments.
//
// 2026-10-19: the site changed its layout — the date lost its year ("19.10" instead of
// "19.10.26"), a "● הבא בתור" marker can precede the name, and the details block is now
// introduced by "פרטים נוספים" / "פרטי הטורניר" instead of "לחץ לפרטי הטורניר". The parser
// accepts both layouts. Since the old marker no longer existed, starting stack and blind
// length had silently stopped being captured (and later every tournament was missed).

const DAY_NAMES = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'יום שבת'];
const DETAIL_LABELS = {
  'פירוט דמי כניסה': 'costBreakdown',
  'אחוז בפרסים': 'prizePercent',
  'ערימה התחלתית': 'startingStack',
  'אורך בליינדים': 'blindLength',
  "מקס' קניות חוזרות": 'maxRebuys',
  'הרשמה מאוחרת': 'lateReg',
  'בונוס מגיעים מוקדם': 'earlyBirdBonus',
  'מיקום': 'location',
  'מקסימום שחקנים': 'maxPlayers',
};
// Lines that open the details section (old and new layouts)
const DETAIL_MARKERS = ['לחץ לפרטי הטורניר', 'פרטים נוספים', 'פרטי הטורניר'];
// Buttons / UI words that are never the tournament name or badge
const UI_TOKENS = new Set(['כניסה', 'מקומות פנויים', 'הירשם', 'הרשמה לטורניר', 'עוד לא נפתח', 'רשום', 'רשימת המתנה',
  'פרטים נוספים', 'פרטי הטורניר', 'לחץ לפרטי הטורניר']);

const DATE_RE = /^(\d{2})\.(\d{2})(?:\.(\d{2}))?$/;
const TIME_RE = /^\d{2}:\d{2}$/;
// Every tournament card ends with this line; in the new layout, further tournaments on the
// same day start right after it with just "HH:MM" (the day/date header appears once per day)
const CARD_END = 'עדכונים על הטורניר בקבוצת הוואטסאפ';
const PRICE_RE = /^₪([\d,]+)(?:\s*\/\s*₪[\d,]+)?$/;

// "19.10" → "19.10.26". The site dropped the year; infer it so the date string (and the
// tournament external id derived from it) stays in the original DD.MM.YY form. A date more
// than ~2 months in the past belongs to next year (December list showing January dates).
function withYear(dateStr, now = new Date()) {
  const m = dateStr.match(DATE_RE);
  if (m[3]) return dateStr;
  const dd = Number(m[1]), mm = Number(m[2]);
  let year = now.getFullYear();
  const candidate = new Date(year, mm - 1, dd);
  if (now - candidate > 60 * 24 * 3600 * 1000) year += 1;
  return `${m[1]}.${m[2]}.${String(year).slice(-2)}`;
}

function parseJokerClubText(text, now = new Date()) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Each start = { at: index of the time line, day, date }
  const starts = [];
  let day = null, date = null;
  for (let i = 0; i < lines.length; i++) {
    if (!TIME_RE.test(lines[i])) continue;
    if (i >= 2 && DAY_NAMES.includes(lines[i - 2]) && DATE_RE.test(lines[i - 1])) {
      day = lines[i - 2]; date = lines[i - 1];
      starts.push({ at: i, day, date, headerAt: i - 2 });
    } else if (date && i >= 1 && lines[i - 1] === CARD_END) {
      starts.push({ at: i, day, date, headerAt: i });
    }
  }

  const tournaments = [];
  for (let s = 0; s < starts.length; s++) {
    const { at, day: dayHebrew } = starts[s];
    const end = s + 1 < starts.length ? starts[s + 1].headerAt : lines.length;
    // normalized chunk: [day, date, time, ...rest] — same shape for both kinds of starts
    const chunk = [dayHebrew, starts[s].date, ...lines.slice(at, end)];

    const dateStr = withYear(chunk[1], now);
    const timeStr = chunk[2];

    // Summary = everything before the first details marker or details label
    let detailsIdx = chunk.findIndex((l, i) => i >= 3 && (DETAIL_MARKERS.includes(l) || DETAIL_LABELS[l]));
    if (detailsIdx === -1) detailsIdx = chunk.length;
    const summary = chunk.slice(3, detailsIdx).filter(l => !l.startsWith('●'));
    const details = chunk.slice(detailsIdx);

    const status = summary.find(l => l.includes('להרשמה') || l.includes('נפתח')) || null;
    const name = summary.find(l => l !== status && !UI_TOKENS.has(l) && !PRICE_RE.test(l)) || null;
    const priceLine = summary.find(l => PRICE_RE.test(l));
    const cost = priceLine ? Number(priceLine.match(PRICE_RE)[1].replace(/,/g, '')) : null;
    const spotsIdx = summary.indexOf('מקומות פנויים');
    const spotsAvailable = spotsIdx > 0 ? Number(summary[spotsIdx - 1]) : null;
    const isOpen = status === 'פתוח להרשמה';

    // Series badge: old layout — an extra summary line; new layout — the first line right
    // after "פרטים נוספים" (e.g. "SGC")
    const knownSummaryTokens = new Set([name, status, priceLine, String(spotsAvailable), ...UI_TOKENS]);
    let badge = summary.find(l => !knownSummaryTokens.has(l)) || null;
    const moreIdx = details.indexOf('פרטים נוספים');
    if (!badge && moreIdx !== -1 && details[moreIdx + 1] && !DETAIL_MARKERS.includes(details[moreIdx + 1]) && !DETAIL_LABELS[details[moreIdx + 1]]) {
      badge = details[moreIdx + 1];
    }

    const parsed = {};
    for (let i = 0; i < details.length; i++) {
      const key = DETAIL_LABELS[details[i]];
      if (key && i + 1 < details.length && parsed[key] === undefined) parsed[key] = details[i + 1];
    }

    tournaments.push({
      day_hebrew: dayHebrew,
      date_str: dateStr,
      start_time: timeStr,
      name,
      badge,
      status,
      is_open: isOpen,
      cost,
      spots_available: spotsAvailable,
      cost_breakdown: parsed.costBreakdown || null,
      prize_percent: parsed.prizePercent || null,
      starting_stack: parsed.startingStack || null,
      blind_length: parsed.blindLength || null,
      max_rebuys: parsed.maxRebuys || null,
      late_reg: parsed.lateReg || null,
      early_bird_bonus: parsed.earlyBirdBonus || null,
      location: parsed.location || null,
      max_players: parsed.maxPlayers ? Number(parsed.maxPlayers) : null,
    });
  }

  return tournaments;
}

module.exports = { parseJokerClubText, withYear };

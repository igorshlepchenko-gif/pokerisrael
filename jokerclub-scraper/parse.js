// Parses the rendered innerText of https://jokerclub.co.il/reg into structured tournaments.
// Each tournament block is delimited by a Hebrew day-name + DD.MM.YY + HH:MM header, so
// parsing is chunk-based and label-anchored rather than positional — resilient to optional
// fields (early-bird bonus, series badge, max players) appearing only on some tournaments.

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

function parseJokerClubText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const starts = [];
  for (let i = 0; i < lines.length - 2; i++) {
    if (DAY_NAMES.includes(lines[i]) && /^\d{2}\.\d{2}\.\d{2}$/.test(lines[i + 1]) && /^\d{2}:\d{2}$/.test(lines[i + 2])) {
      starts.push(i);
    }
  }

  const tournaments = [];
  for (let s = 0; s < starts.length; s++) {
    const start = starts[s];
    const end = s + 1 < starts.length ? starts[s + 1] : lines.length;
    const chunk = lines.slice(start, end);

    const dayHebrew = chunk[0];
    const dateStr = chunk[1];
    const timeStr = chunk[2];

    const detailsIdx = chunk.indexOf('לחץ לפרטי הטורניר');
    const summary = chunk.slice(3, detailsIdx === -1 ? chunk.length : detailsIdx);
    const details = detailsIdx === -1 ? [] : chunk.slice(detailsIdx + 1);

    const name = summary[0] || null;
    const status = summary.find(l => l.includes('להרשמה') || l.includes('נפתח')) || null;
    const priceLine = summary.find(l => /^₪[\d,]+$/.test(l));
    const cost = priceLine ? Number(priceLine.replace(/[₪,]/g, '')) : null;
    const spotsIdx = summary.indexOf('מקומות פנויים');
    const spotsAvailable = spotsIdx > 0 ? Number(summary[spotsIdx - 1]) : null;
    const isOpen = status === 'פתוח להרשמה';

    const knownSummaryTokens = new Set([name, status, priceLine, 'כניסה', String(spotsAvailable), 'מקומות פנויים', 'הירשם', 'עוד לא נפתח', 'רשום', 'רשימת המתנה']);
    const badge = summary.find(l => !knownSummaryTokens.has(l) && l !== priceLine) || null;

    const parsed = {};
    for (let i = 0; i < details.length; i++) {
      const key = DETAIL_LABELS[details[i]];
      if (key && i + 1 < details.length) parsed[key] = details[i + 1];
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

module.exports = { parseJokerClubText };

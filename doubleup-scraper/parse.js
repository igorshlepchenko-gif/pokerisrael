// Parses the rendered innerText of the Doubleup Monday.com schedule form into structured
// tournaments. Each tournament is anchored on a "יום X | NAME | D.M.YY" (or "מוצ״ש | NAME |
// D.M.YY") header line — the rest of that block (bullet line + late-reg/bonus/re-entry line)
// is treated as one blob and field-extracted with tolerant regexes, since the exact line
// wrapping and separator punctuation (־/|/ו) varies between tournaments on the same page.

const HEADER_RE = /^(?:יום\s*\S+|מוצ[״"]?ש)\s*\|\s*(.+?)\s*\|\s*(\d{1,2}\.\d{1,2}\.\d{2,4})\s*$/;

function parseTournamentBlock(name, dateStr, blob) {
  const startTimeM = blob.match(/•\s*(\d{1,2}:\d{2})/);
  const start_time = startTimeM ? startTimeM[1] : null;

  const costM = blob.match(/כניסה\s*(\d+)\s*₪/) || blob.match(/(\d+)\s*₪/);
  const cost = costM ? Number(costM[1]) : null;

  const rakeM = blob.match(/(\d+)\s*לתפעול הטורניר/);
  const rake = rakeM ? Number(rakeM[1]) : null;

  const bountyM = blob.match(/(\d+)\s*באונטי/);
  const bounty = bountyM ? Number(bountyM[1]) : null;

  const blindsM = blob.match(/בליינדים\s*(\d+)\s*\/\s*(\d+)/);
  const level_duration = blindsM ? Math.max(Number(blindsM[1]), Number(blindsM[2])) : null;

  const stackM = blob.match(/ערימה\s*(\d+)\s*K/i);
  const starting_stack = stackM ? Number(stackM[1]) * 1000 : null;

  const is_mystery_bounty = /מיסטרי\s*באונטי/.test(blob);

  const lateRegM = blob.match(/הרשמה מאוחרת עד\s*(\d{1,2}:\d{2})/);
  const late_reg_time = lateRegM ? lateRegM[1] : null;

  const earlyBirdM = blob.match(/בונוס\s*([\d,]+)\s*צ['׳]?יפים\s*בהרשמה מוקדמת עד\s*(\d{1,2}:\d{2})/);
  const early_bird_chips = earlyBirdM ? Number(earlyBirdM[1].replace(/,/g, '')) : null;
  const early_bird_deadline = earlyBirdM ? earlyBirdM[2] : null;

  // X can appear before ("X2 - ריאנטרי") or after ("ריאנטרי ... X3") the word itself.
  const reentryMultM = blob.match(/X(\d+)\s*-?\s*ריאנטרי/) || blob.match(/ריאנטרי[^X\n]*X(\d+)/);
  const reentry_multiplier = reentryMultM ? Number(reentryMultM[1]) : null;

  const reentryLevelM = blob.match(/ריאנטרי עד\s*(?:סוף\s*)?שלב\s*(\d+)/);
  const reentry_level = reentryLevelM ? Number(reentryLevelM[1]) : null;

  return {
    name, date_str: dateStr, start_time, cost, rake, bounty,
    level_duration, starting_stack, is_mystery_bounty,
    late_reg_time, early_bird_chips, early_bird_deadline,
    reentry_multiplier, reentry_level,
  };
}

function parseDoubleupText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    if (HEADER_RE.test(lines[i])) starts.push(i);
  }

  const tournaments = [];
  for (let s = 0; s < starts.length; s++) {
    const start = starts[s];
    const end = s + 1 < starts.length ? starts[s + 1] : lines.length;
    const headerMatch = lines[start].match(HEADER_RE);
    if (!headerMatch) continue;

    const name = headerMatch[1].trim();
    const date_str = headerMatch[2];
    const blob = lines.slice(start + 1, end).join(' ');

    const t = parseTournamentBlock(name, date_str, blob);
    if (t.start_time && t.cost != null) tournaments.push(t);
  }

  return tournaments;
}

module.exports = { parseDoubleupText, parseTournamentBlock, HEADER_RE };

// ── קלפים בתוך טקסט של שאלה ("בורד: K♠ 8♦ 4♣. א' A♣ K♦, ב' ...") ─────────────
// parseScene מוציא מהטקסט את הבורד ואת הידיים כדי לצייר אותם על שולחן (QuizCards.jsx),
// ומחזיר את שאר הטקסט (בדרך כלל השאלה עצמה: "מי מנצח?"). splitCards מפרק טקסט רגיל
// לחלקים של טקסט וקלפים, כדי לצייר קלף קטן במקום "A♦" באמצע משפט.
const CARD = '(?:10|[2-9TJQKA])[♠♥♦♣]';
const CARD_RE = new RegExp(`(10|[2-9TJQKA])([♠♥♦♣])`, 'g');
const cards = (s) => [...s.matchAll(CARD_RE)].map((m) => ({ rank: m[1], suit: m[2] }));

const BOARD_RE = new RegExp(`(?:ב?בורד|פלופ)\\s*:?\\s*((?:${CARD}\\s*){3,5})`);
const HERO_RE = new RegExp(`(?:היד שלך|יש לך(?: סט)?)\\s*:?\\s*((?:${CARD}\\s*){2})`);
const SEAT_RE = new RegExp(`(^|[\\s,.;])([א-ו]')\\s*:?\\s*((?:${CARD}\\s*){2})`, 'g');

export const hasCards = (s) => new RegExp(CARD).test(String(s || ''));

export function parseScene(text) {
  let rest = String(text || '');
  const board = rest.match(BOARD_RE);
  const hero = rest.match(HERO_RE);
  const seats = [...rest.matchAll(SEAT_RE)];
  if (!board && !hero && !seats.length) return null;

  const scene = {
    board: board ? cards(board[1]) : [],
    // "היד שלך" — יושב בתחתית השולחן; שחקנים א'/ב'/ג' — לפי הסדר
    hero: hero ? { label: hero[0].includes('סט') ? 'הסט שלך' : 'היד שלך', cards: cards(hero[1]) } : null,
    seats: seats.map((m) => ({ label: `שחקן ${m[2]}`, cards: cards(m[3]) })),
    street: board && /פלופ/.test(board[0]) ? 'פלופ' : null,
  };
  if (board) rest = rest.replace(board[0], ' ');
  if (hero) rest = rest.replace(hero[0], ' ');
  rest = rest.replace(SEAT_RE, '$1 ');
  // שאריות פיסוק אחרי ההסרה (". , , . מי מנצח?" → "מי מנצח?")
  rest = rest.replace(/(\s*[,.;:]\s*)+(?=[,.;:])/g, '').replace(/^[\s,.;:]+/, '').replace(/\s{2,}/g, ' ').trim();
  scene.text = rest;
  return scene;
}

// טקסט → [{text}|{card}] לציור קלפים קטנים בתוך משפט
export function splitCards(text) {
  const s = String(text || '');
  const parts = [];
  let last = 0;
  for (const m of s.matchAll(CARD_RE)) {
    if (m.index > last) parts.push({ text: s.slice(last, m.index) });
    parts.push({ card: { rank: m[1], suit: m[2] } });
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push({ text: s.slice(last) });
  return parts;
}

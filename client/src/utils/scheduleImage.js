// ציור תמונת "טורנירי היום" לשיתוף (TodayShare.jsx) — canvas טהור, בלי תלויות.
// עיצוב "לוח טורנירים" יוקרתי: כותרת מוזהבת, טבלה עם עמודות (שעה · כניסה · מבנה · טורניר · מועדון),
// לוגו לכל מועדון, ובתחתית סלוגן + כתובת האתר. שלוש ערכות צבע (THEMES).
//
// rows: [{ time, cost, gtd, stack, levelMin, name, sub, venue, logo }]  (logo = HTMLImageElement | null)

export const THEMES = {
  gold: {
    label: 'שחור-זהב',
    bg: ['#0a0f24', '#02030a'], streak: 'rgba(56,120,255,', bokeh: 'rgba(255,200,90,',
    gold: ['#fff4c2', '#f6c94c', '#b9821c'], accent: '#f6c94c', accentSoft: 'rgba(246,201,76,0.55)',
    row: 'rgba(14,18,34,0.92)', rowEdge: 'rgba(246,201,76,0.55)', head: 'rgba(30,24,8,0.85)',
    text: '#ffffff', sub: '#d6d9e4', price: ['#fff4c2', '#f6c94c'], chip: ['#1b1b1b', '#f6c94c'],
  },
  neon: {
    label: 'כחול חשמלי',
    bg: ['#0b1a4a', '#03050f'], streak: 'rgba(34,211,238,', bokeh: 'rgba(96,165,250,',
    gold: ['#e0f7ff', '#5fd4ff', '#2563eb'], accent: '#38bdf8', accentSoft: 'rgba(56,189,248,0.55)',
    row: 'rgba(8,16,40,0.92)', rowEdge: 'rgba(56,189,248,0.55)', head: 'rgba(10,30,70,0.85)',
    text: '#ffffff', sub: '#cfe3ff', price: ['#e0f7ff', '#38bdf8'], chip: ['#0b1a4a', '#38bdf8'],
  },
  felt: {
    label: 'שולחן ירוק',
    bg: ['#0f5132', '#03140c'], streak: 'rgba(255,230,150,', bokeh: 'rgba(255,215,120,',
    gold: ['#fff4c2', '#f2c14e', '#a8741a'], accent: '#f2c14e', accentSoft: 'rgba(242,193,78,0.55)',
    row: 'rgba(4,28,18,0.9)', rowEdge: 'rgba(242,193,78,0.5)', head: 'rgba(30,22,6,0.85)',
    text: '#ffffff', sub: '#d9efe2', price: ['#fff4c2', '#f2c14e'], chip: ['#7f1d1d', '#f2c14e'],
  },
};

const W = 1080;
const HEADER = 330, COLHEAD = 74, ROW_H = 118, GAP = 14, FOOTER = 250, SIDE = 34;
// עמודות מימין לשמאל (x = קצה ימני של העמודה)
const COLS = { time: W - SIDE - 14, cost: 866, struct: 714, name: 572, club: SIDE + 86 };

export const imageHeight = (n) => HEADER + COLHEAD + 16 + n * (ROW_H + GAP) - GAP + FOOTER;

const FONT = { title: '"Secular One", "Heebo", sans-serif', body: '"Heebo", sans-serif', script: '"Amatic SC", "Heebo", sans-serif' };
export const FONTS_TO_LOAD = ['400 120px "Secular One"', '700 90px "Amatic SC"', '900 40px Heebo', '800 40px Heebo', '700 30px Heebo', '500 24px Heebo'];

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const lin = (ctx, x0, y0, x1, y1, stops) => {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
};
function fit(ctx, text, maxW) {
  if (!text || ctx.measureText(text).width <= maxW) return text || '';
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}
// מקטין את הגופן עד min לפני שחותכים עם "…"
function fitSize(ctx, text, maxW, weight, size, min) {
  let sz = size;
  ctx.font = `${weight} ${sz}px ${FONT.body}`;
  while (sz > min && ctx.measureText(text || '').width > maxW) { sz -= 1; ctx.font = `${weight} ${sz}px ${FONT.body}`; }
  return fit(ctx, text, maxW);
}

// מחולל אקראי דטרמיניסטי — אותה תמונה לאותם נתונים
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function background(ctx, H, T, rand) {
  const g = ctx.createRadialGradient(W * 0.5, H * 0.25, 50, W * 0.5, H * 0.45, H * 0.9);
  g.addColorStop(0, T.bg[0]); g.addColorStop(1, T.bg[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // קרני אור אלכסוניות
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(W * 0.62, 0, 0, W * 0.62, 0, W * 0.9);
  halo.addColorStop(0, T.streak + '0.28)'); halo.addColorStop(1, T.streak + '0)');
  ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H * 0.6);
  for (let i = 0; i < 16; i++) {
    const x = rand() * W * 1.5 - W * 0.25, w = 2 + rand() * 14, a = 0.12 + rand() * 0.3;
    ctx.save(); ctx.translate(x, 0); ctx.rotate(-0.42);
    ctx.fillStyle = lin(ctx, 0, 0, 0, H * 0.7, [T.streak + '0)', T.streak + a + ')', T.streak + '0)']);
    ctx.fillRect(0, -100, w, H * (0.5 + rand() * 0.5)); ctx.restore();
  }
  // בוקה
  for (let i = 0; i < 26; i++) {
    const x = rand() * W, y = rand() * H, r = 3 + rand() * 16, a = 0.04 + rand() * 0.1;
    const b = ctx.createRadialGradient(x, y, 0, x, y, r);
    b.addColorStop(0, T.bokeh + a + ')'); b.addColorStop(1, T.bokeh + '0)');
    ctx.fillStyle = b; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function goldText(ctx, text, x, y, size, T, font = FONT.title, align = 'center') {
  ctx.save();
  ctx.font = `400 ${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = size * 0.09; ctx.strokeText(text, x, y);
  ctx.shadowColor = T.accentSoft; ctx.shadowBlur = size * 0.35;
  ctx.fillStyle = lin(ctx, 0, y - size * 0.85, 0, y + size * 0.1, [T.gold[0], T.gold[0], T.gold[1], T.gold[2], T.gold[1]]);
  ctx.fillText(text, x, y);
  ctx.restore();
}

function chipStack(ctx, cx, baseY, n, r, T) {
  for (let i = 0; i < n; i++) {
    const y = baseY - i * r * 0.32;
    ctx.fillStyle = T.chip[0]; ctx.beginPath(); ctx.ellipse(cx, y + r * 0.12, r, r * 0.34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = lin(ctx, cx - r, y, cx + r, y, [T.chip[1], '#fff1b8', T.chip[1]]);
    ctx.beginPath(); ctx.ellipse(cx, y, r, r * 0.34, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.setLineDash([r * 0.25, r * 0.22]); ctx.strokeStyle = T.chip[0]; ctx.lineWidth = r * 0.12;
    ctx.beginPath(); ctx.ellipse(cx, y, r * 0.86, r * 0.28, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
}

function playingCard(ctx, x, y, w, h, rot, T) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 24;
  rr(ctx, -w / 2, -h / 2, w, h, 14);
  ctx.fillStyle = lin(ctx, 0, -h / 2, 0, h / 2, ['#16161c', '#050507']); ctx.fill();
  ctx.shadowBlur = 0; ctx.lineWidth = 4; ctx.strokeStyle = lin(ctx, -w / 2, 0, w / 2, 0, T.gold); ctx.stroke();
  ctx.fillStyle = lin(ctx, 0, -h / 2, 0, h / 2, T.gold);
  ctx.textAlign = 'left'; ctx.font = `800 ${w * 0.28}px ${FONT.body}`; ctx.fillText('A', -w / 2 + 12, -h / 2 + w * 0.3);
  ctx.textAlign = 'center'; ctx.font = `${w * 0.62}px ${FONT.body}`; ctx.fillText('♠', 0, h * 0.18);
  ctx.restore();
}

function headerArt(ctx, T, brandLogo) {
  // שתי קלפים + ערימת צ'יפים (פינה שמאלית עליונה — הכותרת מיושרת לימין)
  playingCard(ctx, 120, 150, 120, 168, -0.32, T);
  playingCard(ctx, 205, 140, 120, 168, 0.12, T);
  chipStack(ctx, 110, 285, 5, 44, T);
  chipStack(ctx, 210, 295, 3, 40, T);
  // לוגו האתר: הצ'יפ בתוך טבעת מוזהבת בלי רקע, והכיתוב על סרט מוזהב שעולה על תחתית הטבעת
  if (brandLogo) {
    const cx = W - 140, cy = 104, r = 80;
    ctx.save();
    // טבעת בלבד (שקופה מבפנים) עם זוהר עדין
    ctx.shadowColor = T.accentSoft; ctx.shadowBlur = 26;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 6; ctx.strokeStyle = lin(ctx, cx - r, cy - r, cx + r, cy + r, T.gold); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(cx, cy, r - 9, 0, Math.PI * 2);
    ctx.lineWidth = 1.5; ctx.strokeStyle = T.accentSoft; ctx.stroke();
    // הצ'יפ — גדול, ממורכז מעט מעל האמצע
    const s = r * 1.42;
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 14;
    ctx.drawImage(brandLogo, cx - s / 2, cy - s / 2 - 8, s, s);
    ctx.shadowBlur = 0;
    // סרט עם הכיתוב — חוצה את תחתית הטבעת
    const label = 'PokerIsrael';
    ctx.font = `900 24px ${FONT.body}`;
    const tw = ctx.measureText(label).width, bw = tw + 44, bh = 38, by = cy + r - 22;
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12;
    rr(ctx, cx - bw / 2, by, bw, bh, bh / 2);
    ctx.fillStyle = lin(ctx, 0, by, 0, by + bh, [T.gold[0], T.gold[1], T.gold[2]]); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.stroke();
    ctx.fillStyle = '#0a0d1a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, by + bh / 2 + 1);
    ctx.restore();
  }
}

function icon(ctx, kind, x, y, s, color) {
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2.4;
  if (kind === 'stack') {
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x, y + s * 0.3 - i * s * 0.28, s * 0.42, s * 0.15, 0, 0, Math.PI * 2); ctx.stroke(); }
  } else {
    ctx.beginPath(); ctx.arc(x, y + 2, s * 0.4, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x, y - s * 0.18); ctx.moveTo(x, y + 2); ctx.lineTo(x + s * 0.18, y + 6); ctx.stroke();
    ctx.fillRect(x - 3, y - s * 0.52, 6, 5);
  }
  ctx.restore();
}

// ניתוח לוגו: צבע הרקע שלו + גבולות התוכן (בלי שוליים ריקים), כדי שהלוגו ימלא את העיגול
// והעיגול ייצבע בצבע הרקע של הלוגו עצמו — בלי טבעת לבנה סביב לוגו כהה. נשמר במטמון לכל תמונה.
const logoInfo = new WeakMap();
function analyzeLogo(img) {
  if (logoInfo.has(img)) return logoInfo.get(img);
  let info = { sx: 0, sy: 0, sw: img.width, sh: img.height, bg: '#ffffff' };
  try {
    const n = 96;
    const sc = Math.min(1, n / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * sc)), h = Math.max(1, Math.round(img.height * sc));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data;
    const px = (cx, cy) => { const k = (cy * w + cx) * 4; return [d[k], d[k + 1], d[k + 2], d[k + 3]]; };
    // צבע רקע = ממוצע ארבע הפינות (שקוף → לבן)
    const corners = [px(0, 0), px(w - 1, 0), px(0, h - 1), px(w - 1, h - 1)];
    const transparent = corners.every((p) => p[3] < 40);
    const bg = transparent ? [255, 255, 255] : [0, 1, 2].map((ch) => Math.round(corners.reduce((a, p) => a + p[ch], 0) / 4));
    const differs = (p) => p[3] > 40 && (transparent || Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]) > 60);
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      if (differs(px(xx, yy))) { if (xx < minX) minX = xx; if (xx > maxX) maxX = xx; if (yy < minY) minY = yy; if (yy > maxY) maxY = yy; }
    }
    if (maxX >= minX && maxY >= minY) {
      // התוכן עצמו יכול להיות "קופסה" כהה על רקע לבן (למשל DoubleUp) — אז הרקע של העיגול
      // הוא צבע השוליים של התוכן, לא של התמונה המקורית
      // דגימה כמה פיקסלים פנימה מהקצה — הקצה עצמו מוחלק (שקוף-למחצה) בלוגו עם פינות מעוגלות
      const ins = Math.max(2, Math.round(Math.min(maxX - minX, maxY - minY) * 0.04));
      const midX = Math.round((minX + maxX) / 2), midY = Math.round((minY + maxY) / 2);
      const inner = [px(minX + ins, midY), px(maxX - ins, midY), px(midX, minY + ins), px(midX, maxY - ins)];
      const boxBg = [0, 1, 2].map((ch) => Math.round(inner.reduce((a, p) => a + p[ch], 0) / 4));
      const solidBox = inner.every((p) => p[3] > 200 && Math.abs(p[0] - boxBg[0]) + Math.abs(p[1] - boxBg[1]) + Math.abs(p[2] - boxBg[2]) < 90);
      const fill = solidBox ? boxBg : bg;
      const pad = 1;
      info = {
        sx: Math.max(0, (minX - pad) / sc), sy: Math.max(0, (minY - pad) / sc),
        sw: Math.min(img.width, (maxX - minX + 1 + pad * 2) / sc), sh: Math.min(img.height, (maxY - minY + 1 + pad * 2) / sc),
        bg: `rgb(${fill.join(',')})`, box: solidBox,
      };
    }
  } catch { /* תמונה ממקור אחר — בלי ניתוח */ }
  logoInfo.set(img, info);
  return info;
}

function clubBadge(ctx, cx, cy, r, logo, venue, T) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  const info = logo ? analyzeLogo(logo) : null;
  ctx.fillStyle = info ? info.bg : '#0b1220'; ctx.fill();
  ctx.save();
  ctx.clip();
  if (logo) {
    // קופסה מלאה (רקע כהה) — ממלאת את העיגול; לוגו על רקע — נכנס בתוך העיגול עם מרווח קטן
    // לוגו על רקע: נכנס בריבוע החסום במעגל (צלע ≈ 1.41r) כך ששום פינה לא נחתכת.
    // קופסה מלאה (רקע כהה): נמתחת לרוחב העיגול — מה שנחתך הוא רק רקע באותו צבע
    // המלבן הגדול ביותר ביחס-הצדדים של הלוגו שנכנס במעגל ברדיוס R: רוחב 2Ra/√(1+a²), גובה 2R/√(1+a²)
    const a = info.sw / info.sh, R = r * (info.box ? 1.08 : 0.92), k = 2 * R / Math.sqrt(1 + a * a);
    const s = Math.min((k * a) / info.sw, k / info.sh);
    const dw = info.sw * s, dh = info.sh * s;
    ctx.drawImage(logo, info.sx, info.sy, info.sw, info.sh, cx - dw / 2, cy - dh / 2, dw, dh);
  } else {
    ctx.fillStyle = T.accent; ctx.font = `800 ${r * 0.62}px ${FONT.body}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((venue || '?').trim().slice(0, 2), cx, cy + 2);
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 4; ctx.strokeStyle = lin(ctx, cx - r, cy - r, cx + r, cy + r, T.gold); ctx.stroke();
  ctx.restore();
}

export function drawSchedule(canvas, { rows, title, dateLabel, page = 1, pages = 1, theme = 'gold', brandLogo = null, slogan = 'כל הפוקר בישראל — במקום אחד', site = 'PokerIsrael.org' }) {
  const T = THEMES[theme] || THEMES.gold;
  const H = imageHeight(rows.length);
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.direction = 'rtl';
  const rand = rng(rows.length * 7919 + title.length);

  background(ctx, H, T, rand);
  headerArt(ctx, T, brandLogo);

  // כותרת + תאריך
  goldText(ctx, title, W - 250, 175, 112, T, FONT.title, 'right');
  ctx.save();
  ctx.font = `800 44px ${FONT.body}`; ctx.textAlign = 'right'; ctx.fillStyle = T.text;
  ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 8;
  ctx.fillText(dateLabel + (pages > 1 ? `  ·  ${page}/${pages}` : ''), W - 250, 245);
  ctx.restore();

  // שורת כותרות עמודות
  const hy = HEADER;
  ctx.save();
  rr(ctx, SIDE, hy, W - SIDE * 2, COLHEAD - 10, 16);
  ctx.fillStyle = T.head; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = lin(ctx, SIDE, 0, W - SIDE, 0, [T.rowEdge, T.accent, T.rowEdge]); ctx.stroke();
  ctx.fillStyle = T.accent; ctx.font = `700 28px ${FONT.body}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  const labels = [['שעה', COLS.time], ['כניסה', COLS.cost], ['מבנה', COLS.struct], ['טורניר', COLS.name]];
  labels.forEach(([t, x]) => ctx.fillText(t, x, hy + (COLHEAD - 10) / 2 + 1));
  ctx.textAlign = 'center'; ctx.fillText('מועדון', COLS.club, hy + (COLHEAD - 10) / 2 + 1);
  ctx.restore();

  // שורות
  rows.forEach((r, i) => {
    const y = HEADER + COLHEAD + 16 + i * (ROW_H + GAP), mid = y + ROW_H / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 16;
    rr(ctx, SIDE, y, W - SIDE * 2, ROW_H, 18); ctx.fillStyle = T.row; ctx.fill();
    ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.strokeStyle = T.rowEdge; ctx.stroke();
    // מפרידים אנכיים עדינים
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 2;
    [COLS.cost + 22, COLS.struct + 22, COLS.name + 22].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, y + 18); ctx.lineTo(x, y + ROW_H - 18); ctx.stroke(); });
    ctx.restore();

    ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
    // שעה
    ctx.fillStyle = T.text; ctx.font = `900 46px ${FONT.body}`; ctx.fillText(r.time, COLS.time, mid + 2);
    // כניסה (+ GTD קטן)
    ctx.fillStyle = lin(ctx, 0, mid - 26, 0, mid + 20, T.price);
    ctx.fillText(fitSize(ctx, r.cost || '—', COLS.cost - COLS.struct - 34, 900, 42, 28), COLS.cost, r.gtd ? mid - 12 : mid + 2);
    if (r.gtd) { ctx.fillStyle = T.sub; ctx.font = `700 21px ${FONT.body}`; ctx.fillText(`GTD ${r.gtd}`, COLS.cost, mid + 28); }
    // מבנה: סטאק + דקות לשלב
    ctx.font = `700 25px ${FONT.body}`; ctx.fillStyle = T.text;
    if (r.stack) { icon(ctx, 'stack', COLS.struct - 14, mid - 22, 26, T.accent); ctx.fillText(r.stack, COLS.struct - 38, mid - 20); }
    if (r.levelMin) { icon(ctx, 'clock', COLS.struct - 14, mid + 22, 26, T.accent); ctx.fillText(`${r.levelMin} דק׳`, COLS.struct - 38, mid + 24); }
    if (!r.stack && !r.levelMin) { ctx.fillStyle = T.sub; ctx.fillText('—', COLS.struct - 14, mid + 2); }
    // שם + תת-כותרת
    const nameW = COLS.name - (COLS.club + 70) - 10;
    ctx.fillStyle = T.text;
    ctx.fillText(fitSize(ctx, r.name, nameW, 800, 31, 24), COLS.name, r.sub ? mid - 16 : mid + 2);
    if (r.sub) { ctx.fillStyle = T.sub; ctx.fillText(fitSize(ctx, r.sub, nameW, 500, 23, 19), COLS.name, mid + 22); }
    // מועדון
    clubBadge(ctx, COLS.club, mid, 46, r.logo, r.venue, T);
  });

  // תחתית: סלוגן בכתב יד על משיכת מכחול + כתובת האתר
  const fy = H - FOOTER;
  chipStack(ctx, 90, H - 40, 6, 52, T);
  chipStack(ctx, W - 95, H - 35, 5, 50, T);
  ctx.save();
  ctx.translate(W / 2, fy + 120); ctx.rotate(-0.05);
  ctx.fillStyle = lin(ctx, -330, 0, 330, 0, ['rgba(0,0,0,0)', T.accentSoft, T.accent, T.accentSoft, 'rgba(0,0,0,0)']);
  ctx.beginPath(); ctx.moveTo(-340, 18); ctx.quadraticCurveTo(0, -10, 340, 6); ctx.lineTo(330, 52); ctx.quadraticCurveTo(0, 36, -330, 60); ctx.closePath(); ctx.fill();
  ctx.restore();
  goldText(ctx, slogan, W / 2, fy + 120, 84, T, FONT.script, 'center');
  ctx.save();
  ctx.font = `800 40px ${FONT.body}`; ctx.textAlign = 'center'; ctx.fillStyle = T.text;
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 10;
  ctx.fillText(`פרטים והרשמה בלחיצה:  ${site}`, W / 2, fy + 205);
  ctx.restore();
  return canvas;
}

// "נו לימיט (באונטי על מני וקסיאס)" → { name: 'נו לימיט', sub: 'באונטי על מני וקסיאס' };  "כפר סבא - חד פעמי" → שם + תת
export function splitTitle(full) {
  const s = String(full || '').trim();
  const paren = s.match(/^(.+?)\s*\((.+)\)\s*$/);
  if (paren) return { name: paren[1].trim(), sub: paren[2].trim() };
  const dash = s.split(/\s+[-–—]\s+/);
  if (dash.length > 1 && dash[0].length >= 2) return { name: dash[0].trim(), sub: dash.slice(1).join(' - ').trim() };
  return { name: s, sub: '' };
}

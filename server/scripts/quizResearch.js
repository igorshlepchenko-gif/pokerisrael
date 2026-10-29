// ── הוספת שאלות חדשות לשעשועון (המשימה היומית "מחקר שאלות לשולם בליינד") ──
//
//   node scripts/quizResearch.js existing [out.json]   רשימת כל השאלות הקיימות (לבדיקת כפילויות)
//   node scripts/quizResearch.js add <file.json>       בדיקה + הוספה לאתר
//     שאלה עם "sure": true (ביטחון ≥95% שהתשובה נכונה) → מאושרת מיד ("אוטומטית").
//     אחרת → ממתינה לאישור, עם "doubt": "<למה לא בטוח>" — מוצגת ראשונה במסך הבדיקה.
//   QUIZ_STAGE_ONLY=1 node scripts/quizResearch.js add <file.json>   רק שמירה בתיקייה, בלי האתר
//
// מול הפרודקשן: railway run --service Postgres node scripts/quizResearch.js ...
// (DATABASE_PUBLIC_URL של Railway — החיבור הפנימי לא נגיש מהמחשב).
//
// כל קובץ שנוסף נשמר גם בתיקייה quiz-research/ שבשורש הפרויקט (לא ב-git). אם באתר עוד
// אין טבלת שאלות (השעשועון לא עלה) — השאלות נשמרות רק שם, ונכנסות בהרצה הבאה של add
// אחרי העלייה (או: add על כל קובץ בתיקייה). שאלה קיימת (גם שנפסלה) לא תיכנס שוב.
if (process.env.DATABASE_PUBLIC_URL) process.env.DATABASE_URL = process.env.DATABASE_PUBLIC_URL;
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const quiz = require('../services/quiz');

const STAGING = path.join(__dirname, '../../quiz-research');
const SEED = path.join(__dirname, '../data/quizQuestions.json');

// השוואה "רכה": בלי ניקוד/פיסוק/רווחים/אותיות גדולות — כדי לתפוס ניסוח כמעט זהה
const norm = (s) => String(s || '').toLowerCase().replace(/[֑-ׇ]/g, '').replace(/[^\p{L}\p{N}]+/gu, '');

// QUIZ_STAGE_ONLY=1 — בלי חיבור לאתר (למשל כשההתחברות ל-Railway פגה): רק שמירה בתיקייה
async function hasTable() {
  if (process.env.QUIZ_STAGE_ONLY === '1') return false;
  try { return !!(await pool.query(`SELECT to_regclass('public.quiz_questions') AS t`)).rows[0].t; } catch { return false; }
}

async function existing() {
  const list = [];
  const db = await hasTable();
  if (db) {
    const r = await pool.query(`SELECT category, difficulty, question, options->>correct AS answer, status FROM quiz_questions`);
    list.push(...r.rows.map((q) => ({ ...q, from: 'db' })));
  } else {
    for (const q of JSON.parse(fs.readFileSync(SEED, 'utf8'))) list.push({ category: q.category, difficulty: q.difficulty, question: q.question, answer: q.options[q.correct], from: 'seed' });
  }
  if (fs.existsSync(STAGING)) {
    for (const f of fs.readdirSync(STAGING).filter((n) => n.endsWith('.json'))) {
      for (const q of JSON.parse(fs.readFileSync(path.join(STAGING, f), 'utf8'))) {
        list.push({ category: q.category, difficulty: q.difficulty, question: q.question, answer: q.options?.[q.correct], from: `staging:${f}` });
      }
    }
  }
  // אותה שאלה גם בקובץ וגם ב-DB — פעם אחת
  const seen = new Set();
  return { db, list: list.filter((q) => (seen.has(norm(q.question)) ? false : seen.add(norm(q.question)))) };
}

async function add(file) {
  const items = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(items)) throw new Error('הקובץ צריך להכיל מערך שאלות');
  const { db, list } = await existing();
  const stagedName = path.basename(file);
  const known = new Set(list.filter((q) => q.from !== `staging:${stagedName}`).map((q) => norm(q.question)));
  const report = { file: stagedName, received: items.length, added: 0, duplicates: [], invalid: [], savedToSite: db };
  const valid = [];
  for (const raw of items) {
    let q;
    try { q = quiz.validateQuestion({ ...raw, venue_id: null }); } catch (e) { report.invalid.push(`${String(raw.question).slice(0, 60)} — ${e.message}`); continue; }
    if (q.category === 'club') { report.invalid.push(`${q.question.slice(0, 60)} — שאלות מועדון רק מהפאנל`); continue; }
    if (!q.source) { report.invalid.push(`${q.question.slice(0, 60)} — חסר מקור`); continue; }
    const k = norm(q.question);
    if (known.has(k)) { report.duplicates.push(q.question.slice(0, 60)); continue; }
    known.add(k);
    valid.push({ ...q, sure: raw.sure === true, doubt: raw.doubt ? String(raw.doubt) : undefined });
  }
  report.approved = 0;
  report.needsReview = [];
  if (db) {
    for (const q of valid) {
      const sure = q.sure === true && !q.doubt;
      const note = sure ? null : (String(q.doubt || '').trim() || 'לא סומנה כבטוחה (≥95%)');
      const r = await pool.query(
        `INSERT INTO quiz_questions (question_key, category, difficulty, question, options, correct, explanation, source, status, review_note, reviewed_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (question_key) DO NOTHING`,
        [quiz.questionKey(q.question), q.category, q.difficulty, q.question, JSON.stringify(q.options), q.correct, q.explanation, q.source,
          sure ? 'approved' : 'pending', note, sure ? new Date() : null]
      );
      report.added += r.rowCount;
      if (r.rowCount && sure) report.approved++;
      if (r.rowCount && !sure) report.needsReview.push(`${q.question.slice(0, 50)} — ${note}`);
    }
  }
  // שמירה בתיקייה — רק השאלות התקינות (כך שהרצה חוזרת אחרי העלייה לא תיכשל על אותן שגיאות)
  fs.mkdirSync(STAGING, { recursive: true });
  const dest = path.join(STAGING, stagedName);
  const prev = fs.existsSync(dest) ? JSON.parse(fs.readFileSync(dest, 'utf8')) : [];
  const merged = [...prev, ...valid.filter((q) => !prev.some((p) => norm(p.question) === norm(q.question)))];
  fs.writeFileSync(dest, JSON.stringify(merged, null, 1) + '\n');
  report.staged = merged.length;
  return report;
}

(async () => {
  const [cmd, arg] = process.argv.slice(2);
  try {
    if (cmd === 'existing') {
      const { db, list } = await existing();
      const out = arg || path.join(STAGING, '_existing.json');
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, JSON.stringify(list, null, 1));
      const by = {};
      for (const q of list) by[q.category] = (by[q.category] || 0) + 1;
      console.log(JSON.stringify({ source: db ? 'site database' : 'seed file (quiz not on the site yet)', total: list.length, byCategory: by, file: out }));
    } else if (cmd === 'add' && arg) {
      console.log(JSON.stringify(await add(arg), null, 1));
    } else {
      console.log('usage: quizResearch.js existing [out.json] | add <file.json>');
      process.exitCode = 2;
    }
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();

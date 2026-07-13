// Tournament Import Controller
// Parses Hebrew poker announcements → structured data via Groq (free tier)
// Model: llama-3.3-70b-versatile — 14,400 requests/day free

const Groq = require('groq-sdk');
const pool = require('../config/db');

function getGroq() {
  if (!process.env.GROQ_API_KEY) return null;
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

// ── Prompt ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert at parsing Hebrew poker tournament announcements.
Extract structured data and return ONLY valid JSON — no explanation, no markdown, no backticks.

Rules:
- Return null for any field not found in the text.
- date: YYYY-MM-DD format (assume current year if not stated).
- start_time: HH:MM (24-hour).
- cost / gtd / starting_stack: integer in shekels/chips, no commas or ₪ sign.
- is_recurring: true only if explicitly "שבועי" / "קבוע" / "every week".
- day_of_week: 0=Sunday … 6=Saturday.
- confidence: 0.0–1.0 how certain you are about the extraction.`;

function buildPrompt(text, venueList) {
  return `Registered venues in the system:
${venueList}

Return JSON matching this exact schema:
{
  "name": string|null,
  "venue_name": string|null,
  "venue_id": number|null,
  "venue_city": string|null,
  "venue_address": string|null,
  "date": "YYYY-MM-DD"|null,
  "start_time": "HH:MM"|null,
  "cost": number|null,
  "gtd": number|null,
  "starting_stack": number|null,
  "level_duration": number|null,
  "re_entry": boolean|null,
  "late_reg_level": number|null,
  "description": string|null,
  "is_recurring": boolean|null,
  "day_of_week": number|null,
  "whatsapp_number": string|null,
  "notes": string|null,
  "confidence": number
}

If venue_name matches one of the registered venues, set venue_id to its id.

Announcement to parse:
---
${text.trim()}
---`;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function extractJSON(text) {
  if (!text) return null;
  try { return JSON.parse(text.trim()); } catch {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1].trim()); } catch {} }
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) { try { return JSON.parse(brace[0]); } catch {} }
  return null;
}

async function loadVenues() {
  try {
    const r = await pool.query(
      `SELECT id, name, city FROM venues WHERE is_approved = true ORDER BY name`
    );
    return r.rows;
  } catch { return []; }
}

function matchVenue(parsedName, venues) {
  if (!parsedName) return null;
  const norm = v => (v || '').replace(/\s+/g, '').toLowerCase();
  const needle = norm(parsedName);
  return venues.find(v =>
    norm(v.name).includes(needle) || needle.includes(norm(v.name))
  ) || null;
}

// ── POST /api/imports/parse ─────────────────────────────────────────────────
exports.parseText = async (req, res) => {
  const { text, source = 'manual' } = req.body;

  if (!text || text.trim().length < 15)
    return res.status(400).json({ message: 'Text too short (min 15 characters)' });
  if (text.length > 8000)
    return res.status(400).json({ message: 'Text too long (max 8000 characters)' });

  const groq = getGroq();
  if (!groq)
    return res.status(503).json({ message: 'GROQ_API_KEY not configured. Add it to server/.env' });

  const venues = await loadVenues();
  const venueList = venues.length
    ? venues.map(v => `• id=${v.id}  "${v.name}" (${v.city || '?'})`).join('\n')
    : '(no registered venues)';

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',  // best free Groq model
      temperature: 0.1,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: buildPrompt(text, venueList) },
      ],
    });

    const rawText = completion.choices[0]?.message?.content || '';
    const parsed  = extractJSON(rawText);

    if (!parsed)
      return res.status(422).json({ message: 'Model did not return valid JSON', raw: rawText.slice(0, 400) });

    // Venue matching: prefer model's venue_id, fallback to string match
    const venueIdFromModel = parsed.venue_id ? parseInt(parsed.venue_id) : null;
    const matchedVenue = venueIdFromModel
      ? (venues.find(v => v.id === venueIdFromModel) || matchVenue(parsed.venue_name, venues))
      : matchVenue(parsed.venue_name, venues);

    const { venue_id: _v, ...cleanParsed } = parsed;

    res.json({
      parsed: cleanParsed,
      matched_venue: matchedVenue
        ? { id: matchedVenue.id, name: matchedVenue.name, city: matchedVenue.city }
        : null,
      venues,
      usage: {
        prompt_tokens:     completion.usage?.prompt_tokens     || 0,
        completion_tokens: completion.usage?.completion_tokens || 0,
      },
    });

  } catch (err) {
    console.error('[importController] Groq error:', err?.message || err);
    if (err?.status === 401) return res.status(401).json({ message: 'GROQ_API_KEY is invalid' });
    if (err?.status === 429) return res.status(429).json({ message: 'Groq rate limit hit — wait a moment and retry' });
    res.status(500).json({ message: 'Error parsing text', detail: err?.message });
  }
};

// ── POST /api/imports ────────────────────────────────────────────────────────
exports.createImport = async (req, res) => {
  const { source = 'manual', raw_text, parsed_data, venue_id } = req.body;
  if (!raw_text) return res.status(400).json({ message: 'raw_text is required' });
  try {
    const r = await pool.query(
      `INSERT INTO tournament_imports (source, raw_text, parsed_data, venue_id, status, created_by)
       VALUES ($1,$2,$3,$4,'pending',$5) RETURNING id, created_at`,
      [source, raw_text, JSON.stringify(parsed_data || {}), venue_id || null, req.user.id]
    );
    res.status(201).json({ id: r.rows[0].id, created_at: r.rows[0].created_at });
  } catch (err) {
    console.error('[importController] createImport:', err?.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/imports ─────────────────────────────────────────────────────────
exports.listImports = async (req, res) => {
  const { status = 'pending' } = req.query;
  try {
    const r = await pool.query(
      `SELECT i.id, i.source, i.raw_text, i.parsed_data, i.status,
              i.venue_id, i.created_at,
              u.name AS created_by_name, v.name AS venue_name
       FROM tournament_imports i
       LEFT JOIN users  u ON u.id = i.created_by
       LEFT JOIN venues v ON v.id = i.venue_id
       WHERE i.status = $1 ORDER BY i.created_at DESC LIMIT 100`,
      [status]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── PATCH /api/imports/:id/approve ──────────────────────────────────────────
exports.approveImport = async (req, res) => {
  const { id } = req.params;
  const overrides = req.body || {};
  try {
    const imp = await pool.query('SELECT * FROM tournament_imports WHERE id=$1', [id]);
    if (!imp.rows[0]) return res.status(404).json({ message: 'Import not found' });
    const row = imp.rows[0];
    const d   = { ...row.parsed_data, ...overrides };
    const venueId = d.venue_id || row.venue_id;
    if (!venueId) return res.status(400).json({ message: 'Select a venue before approving' });

    const startTime = (d.date && d.start_time) ? `${d.date}T${d.start_time}:00` : null;
    if (!startTime) {
      return res.status(400).json({ message: 'חסרים תאריך ושעה — יש למלא אותם לפני האישור' });
    }

    // תפיסה אטומית — ה-WHERE בודק status='pending' באותה שאילתה שמעדכנת אותו, אחרי
    // שכל הבדיקות עברו, כך שלחיצה כפולה על הכפתור (או שתי בקשות מקבילות) לא יכולות
    // שתיהן לעבור: רק הראשונה שתופסת את השורה ממשיכה ליצור טורניר, והשנייה נעצרת
    // כאן במקום ליצור טורניר כפול
    const claim = await pool.query(
      `UPDATE tournament_imports SET status='processing' WHERE id=$1 AND status='pending'`,
      [id]
    );
    if (claim.rowCount === 0) {
      return res.status(409).json({ message: 'הפריט כבר טופל (אושר/נדחה) על ידי בקשה אחרת' });
    }

    const tRes = await pool.query(
      `INSERT INTO tournaments
         (venue_id, name, description, cost, start_time,
          is_recurring, day_of_week, re_entry, late_reg_level,
          gtd, starting_stack, level_duration, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'approved',$13)
       RETURNING id`,
      [
        venueId,
        d.name           || 'Imported Tournament',
        d.description    || d.notes || null,
        d.cost           || null,
        startTime,
        d.is_recurring   || false,
        d.day_of_week    ?? null,
        d.re_entry       || false,
        d.late_reg_level || null,
        d.gtd            || null,
        d.starting_stack || null,
        d.level_duration || null,
        req.user.id,
      ]
    );

    await pool.query(
      `UPDATE tournament_imports SET status='approved', tournament_id=$1 WHERE id=$2`,
      [tRes.rows[0].id, id]
    );

    res.json({ tournament_id: tRes.rows[0].id, message: 'Tournament created successfully' });
  } catch (err) {
    console.error('[importController] approveImport:', err?.message);
    // אם התפיסה כבר קרתה (status='processing') אבל יצירת הטורניר נכשלה, מחזירים
    // ל-pending כדי שהפריט יהיה ניתן לניסיון חוזר במקום להיתקע לצמיתות "בעיבוד"
    await pool.query(
      `UPDATE tournament_imports SET status='pending' WHERE id=$1 AND status='processing'`,
      [id]
    ).catch(() => {});
    res.status(500).json({ message: 'Server error', detail: err?.message });
  }
};

// ── PATCH /api/imports/:id/reject ───────────────────────────────────────────
exports.rejectImport = async (req, res) => {
  try {
    await pool.query(`UPDATE tournament_imports SET status='rejected' WHERE id=$1`, [req.params.id]);
    res.json({ message: 'Import rejected' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

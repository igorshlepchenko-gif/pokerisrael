/**
 * Fixture runner for the hand-narration parser.
 *
 * Runs every fixture in services/handNarration.fixtures.js through the parser
 * and scores the result leaf-by-leaf, so a near-miss shows up as "9/10 fields"
 * rather than a bare fail. Provider-agnostic on purpose: the point of this
 * script is to pick a model on evidence, not to bless the one we started with.
 *
 *   node server/scripts/testHandNarration.js                  # Claude (what ships)
 *   node server/scripts/testHandNarration.js --provider=groq   # kept for re-evaluation
 *   node server/scripts/testHandNarration.js --only=threebet-encoding
 *   node server/scripts/testHandNarration.js --verbose         # dump full JSON
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fixtures = require('../services/handNarration.fixtures');
const {
  HAND_SCHEMA_SYSTEM, buildUserContent, DEFAULT_MODEL, parseHandNarration,
} = require('../services/handNarrationAgent');
const { analyze, toWizardState } = require('../services/narrationGaps');

const args = process.argv.slice(2);
const argVal = (name, dflt) => {
  const hit = args.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const PROVIDER = argVal('provider', 'claude');
const ONLY = argVal('only', null);
const VERBOSE = args.includes('--verbose');

// ── Providers ────────────────────────────────────────────────────────────────
// Each returns the raw JSON string the model produced.

async function callGroq(fx) {
  const system = HAND_SCHEMA_SYSTEM;
  const user = buildUserContent(fx.input, fx.priorState || null, fx.history || []);
  const Groq = require('groq-sdk');
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY חסר ב-server/.env');
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const body = {
    model: argVal('model', DEFAULT_MODEL),
    temperature: 0.1,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  };
  // gpt-oss models are reasoning models; their default effort dominates latency.
  const effort = argVal('effort', null);
  if (effort) body.reasoning_effort = effort;
  const r = await groq.chat.completions.create(body);
  return JSON.parse(r.choices[0]?.message?.content || '{}');
}

// Runs the real production path — structured outputs, schema, model choice and
// all — so a green fixture run means the shipped code works, not a copy of it.
async function callClaude(fx) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY חסר ב-server/.env');
  const parsed = await parseHandNarration(fx.input, fx.priorState || null, fx.history || []);
  if (!parsed) throw new Error('הפרסר החזיר null — בדוק מפתח/workspace id ואת הלוג');
  return parsed;
}

const PROVIDERS = { groq: callGroq, claude: callClaude };

// ── Leaf-by-leaf comparison ──────────────────────────────────────────────────

const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);

// Cards are compared as a set where order carries no meaning (hole cards, flop).
const ORDERLESS_CARD_PATHS = new Set(['hero_cards', 'streets.flop.board']);

const cardKey = c => `${c?.rank ?? '?'}${c?.suit ?? ''}`;

/**
 * Walks `expected` and records a pass/fail per leaf. Fields absent from
 * `expected` are never checked — silence in a fixture means "the narration
 * didn't determine this, any answer is acceptable".
 */
function compare(expected, actual, path = '', out = []) {
  for (const [key, want] of Object.entries(expected)) {
    const p = path ? `${path}.${key}` : key;
    const got = actual == null ? undefined : actual[key];

    // `null` in a fixture means "must not be invented".
    if (want === null) {
      const empty = got == null || (Array.isArray(got) && got.length === 0);
      out.push({ path: p, ok: empty, want: '(ריק)', got: JSON.stringify(got) });
      continue;
    }

    if (Array.isArray(want)) {
      if (!Array.isArray(got)) {
        out.push({ path: p, ok: false, want: `array[${want.length}]`, got: JSON.stringify(got) });
        continue;
      }
      if (ORDERLESS_CARD_PATHS.has(p)) {
        const wantSet = want.map(cardKey).sort();
        // A fixture may pin only the rank; match on the fields it actually pinned.
        const ok = want.every(w =>
          got.some(g =>
            (w.rank === undefined || g?.rank === w.rank) &&
            (w.suit === undefined || g?.suit === w.suit)));
        out.push({
          path: p, ok,
          want: wantSet.join(' '),
          got: got.map(cardKey).sort().join(' '),
        });
        continue;
      }
      // Ordered arrays (action sequences): compare index by index.
      if (got.length !== want.length) {
        out.push({
          path: `${p}.length`, ok: false,
          want: String(want.length), got: String(got.length),
        });
      }
      want.forEach((w, i) => {
        if (isPlainObject(w)) compare(w, got[i], `${p}[${i}]`, out);
        else out.push({ path: `${p}[${i}]`, ok: got[i] === w, want: String(w), got: String(got[i]) });
      });
      continue;
    }

    if (isPlainObject(want)) {
      compare(want, got, p, out);
      continue;
    }

    // The output schema types amounts as strings ("1500"); narrationGaps'
    // sanitizer coerces them back to numbers, so "1500" and 1500 are the same
    // answer and a fixture shouldn't have to care which side it sees.
    const sameNumber =
      got !== null && got !== '' && want !== null &&
      Number.isFinite(+got) && Number.isFinite(+want) && +got === +want;
    out.push({ path: p, ok: got === want || sameNumber, want: String(want), got: String(got) });
  }
  return out;
}

// ── Run ──────────────────────────────────────────────────────────────────────

async function main() {
  const call = PROVIDERS[PROVIDER];
  if (!call) {
    console.error(`ספק לא מוכר: ${PROVIDER}. אפשרויות: ${Object.keys(PROVIDERS).join(', ')}`);
    process.exit(1);
  }

  const list = ONLY ? fixtures.filter(f => f.id === ONLY) : fixtures;
  if (!list.length) {
    console.error(`לא נמצא fixture בשם "${ONLY}"`);
    process.exit(1);
  }

  console.log(`\n🃏 בדיקת פרסר תיאור-יד — ספק: ${PROVIDER}, ${list.length} תרחישים\n`);

  const rows = [];
  let totalLeaves = 0, totalOk = 0, totalTaps = 0;

  for (const fx of list) {
    let parsed = null, err = null;
    const t0 = Date.now();
    try {
      parsed = await call(fx);
    } catch (e) {
      err = e.message;
    }
    const ms = Date.now() - t0;

    if (err) {
      rows.push({ id: fx.id, ok: 0, total: 0, ms, note: `❌ ${err}` });
      console.log(`❌ ${fx.id} — ${err}\n`);
      continue;
    }

    // Gaps and structural contradictions are decided by narrationGaps.js, never
    // by the model — this also exercises the sanitizer and the state adapter.
    let analysis = null, adapterError = null;
    try {
      analysis = analyze(parsed.extracted || {});
      toWizardState(analysis.state);
    } catch (e) {
      adapterError = e.message;
    }

    // Assert against the analyzed state, not the raw model output. That is the
    // shape every consumer downstream actually sees, and it is what the feature
    // has to get right — the model returns a flat action/board list that
    // sanitize() regroups per street, so checking the raw reply would test an
    // intermediate representation nothing consumes.
    const leaves = fx.expect ? compare(fx.expect, (analysis && analysis.state) || {}) : [];

    // A contradiction counts as caught from either source: the model for
    // semantic ones, the rule checks for structural ones.
    if (fx.expectContradiction) {
      const structural = analysis ? analysis.contradictions : [];
      const found = parsed.contradiction || structural[0];
      leaves.push({
        path: '(סתירה זוהתה)',
        ok: !!found,
        want: 'true',
        got: found ? JSON.stringify(found.description) : 'null',
      });
    }

    // Some fixtures assert the ABSENCE of a contradiction — a rule that fires on
    // legitimate poker is worse than one that never fires.
    if (fx.expectNoContradiction) {
      const found = parsed.contradiction || (analysis ? analysis.contradictions[0] : null);
      leaves.push({
        path: '(ללא סתירה)',
        ok: !found,
        want: 'אין סתירה',
        got: found ? JSON.stringify(found.description) : 'אין',
      });
    }

    if (fx.expectScaledAmounts && analysis) {
      const { street, index, amount } = fx.expectScaledAmounts;
      const got = analysis.state.streets?.[street]?.actions?.[index]?.amount;
      leaves.push({
        path: `סכום מוקנה־מחדש ${street}[${index}]`,
        ok: got === amount, want: String(amount), got: String(got),
      });
    }

    for (const f of fx.expectMissing || []) {
      leaves.push({
        path: `gap⊇${f}`,
        ok: !!analysis && analysis.gaps.some(g => g.field === f),
        want: f,
        got: analysis ? JSON.stringify(analysis.gaps.map(g => g.field)) : 'n/a',
      });
    }
    if (adapterError) {
      leaves.push({ path: '(המרה לסכימת האשף)', ok: false, want: 'ללא שגיאה', got: adapterError });
    }

    const ok = leaves.filter(l => l.ok).length;
    totalLeaves += leaves.length;
    totalOk += ok;
    const taps = analysis ? analysis.gaps.length : null;
    if (taps !== null) totalTaps += taps;
    rows.push({ id: fx.id, ok, total: leaves.length, ms, taps });

    const icon = ok === leaves.length ? '✅' : ok === 0 ? '❌' : '⚠️ ';
    console.log(`${icon} ${fx.id}  ${ok}/${leaves.length}  (${ms}ms)`);
    console.log(`   ${fx.why}`);
    for (const l of leaves.filter(x => !x.ok)) {
      console.log(`   ✗ ${l.path}: ציפינו ${l.want} · קיבלנו ${l.got}`);
    }
    if (analysis) {
      console.log(analysis.gaps.length
        ? `   ❓ נשאר להשלים (${analysis.gaps.length}): ${analysis.gaps.map(g => g.field).join(', ')}`
        : `   ✨ מוכן לשמירה בלי אף שאלה`);
      for (const d of analysis.dropped) console.log(`   ⚠️  נזרק: ${d}`);
    }
    if (VERBOSE) console.log(`   ${JSON.stringify(parsed, null, 2).replace(/\n/g, '\n   ')}`);
    console.log('');
  }

  console.log('─'.repeat(64));
  const pct = totalLeaves ? Math.round((totalOk / totalLeaves) * 100) : 0;
  const perfect = rows.filter(r => r.total > 0 && r.ok === r.total).length;
  const avgMs = Math.round(rows.reduce((s, r) => s + r.ms, 0) / rows.length);
  console.log(`ציון כולל: ${totalOk}/${totalLeaves} שדות (${pct}%)`);
  console.log(`תרחישים מושלמים: ${perfect}/${rows.length}`);
  console.log(`זמן ממוצע לקריאה: ${avgMs}ms\n`);
}

main().catch(e => { console.error(e); process.exit(1); });

// דוח כתובות שאינן ממופות לקואורדינטות.
//
// פתרון המיקום עצמו קורה בזמן שליפה (tournamentController -> LOCATION_JOINS),
// אז אין צורך ב"backfill" שוטף. מה שכן צריך מעקב: טורניר שהסוכן יצר בכתובת
// חדשה שאינה בטבלת locations לא יקבל מרחק כלל — בכוונה, כדי לא לדרג אותו לפי
// מיקום המועדון שנמצא בעיר אחרת — ולכן פשוט לא יופיע ב"מצא טורניר קרוב אליי".
//
// הסקריפט מדפיס בדיוק את הכתובות האלה, כדי שאפשר יהיה להוסיף אותן ל-locations.
//
// שימוש:
//   PGURL=<DATABASE_PUBLIC_URL> node server/scripts/syncLocations.js
//   PGURL=... node server/scripts/syncLocations.js --add "כתובת" <lat> <lng> "עיר"

const { Pool } = require('pg');

const IL = { latMin: 29.4, latMax: 33.4, lngMin: 34.2, lngMax: 35.95 };

async function addLocation(pool, address, lat, lng, city) {
  const la = Number(lat), ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) throw new Error('lat/lng must be numbers');
  if (la < IL.latMin || la > IL.latMax || ln < IL.lngMin || ln > IL.lngMax) {
    throw new Error(`coordinate is outside Israel: ${la}, ${ln}`);
  }
  await pool.query(
    `INSERT INTO locations (address, city, latitude, longitude, source)
     VALUES ($1,$2,$3,$4,'manual')
     ON CONFLICT (address) DO UPDATE SET latitude=$3, longitude=$4, city=$2, updated_at=NOW()`,
    [address, city || null, la, ln]);
  console.log(`saved: ${address} -> ${la}, ${ln}${city ? ' (' + city + ')' : ''}`);
}

(async () => {
  if (!process.env.PGURL) throw new Error('PGURL is required');
  const pool = new Pool({ connectionString: process.env.PGURL, ssl: { rejectUnauthorized: false } });

  const addIdx = process.argv.indexOf('--add');
  if (addIdx !== -1) {
    const [address, lat, lng, city] = process.argv.slice(addIdx + 1);
    if (!address || !lat || !lng) throw new Error('usage: --add "<address>" <lat> <lng> ["<city>"]');
    await addLocation(pool, address, lat, lng, city);
    process.exit(0);
  }

  const total = await pool.query('SELECT COUNT(*)::int c FROM locations');
  console.log(`locations mapped: ${total.rows[0].c}\n`);

  // כתובות של טורנירים פעילים שאינן ממופות ואינן זהות לכתובת המועדון
  const unmapped = await pool.query(`
    SELECT t.address, COALESCE(t.city,'') AS city, v.name AS venue, COUNT(*)::int AS n
    FROM tournaments t
    JOIN venues v ON t.venue_id = v.id
    WHERE t.status='approved' AND t.is_active = true AND v.is_approved = true
      AND t.tournament_type <> 'online'
      AND t.address IS NOT NULL
      AND t.latitude IS NULL
      AND normalize_address(t.address) <> normalize_address(v.address)
      AND NOT EXISTS (
        SELECT 1 FROM locations l
        WHERE normalize_address(l.address) = normalize_address(t.address))
    GROUP BY 1,2,3 ORDER BY n DESC`);

  if (!unmapped.rows.length) {
    console.log('every active tournament address resolves to coordinates.');
  } else {
    console.log('UNMAPPED — these tournaments get no distance and will not be suggested:\n');
    unmapped.rows.forEach(r =>
      console.log(`  ${String(r.n).padStart(3)}x  ${r.address}  (${r.city || '—'}, via ${r.venue})`));
    console.log('\nadd one with:');
    console.log(`  PGURL=... node server/scripts/syncLocations.js --add "${unmapped.rows[0].address}" <lat> <lng> "${unmapped.rows[0].city}"`);
  }

  // ומועדונים ללא מיקום כלל
  const venues = await pool.query(`
    SELECT name, city, address FROM venues
    WHERE venue_type <> 'online' AND is_approved = true AND latitude IS NULL
      AND NOT EXISTS (SELECT 1 FROM locations l WHERE normalize_address(l.address)=normalize_address(venues.address))`);
  if (venues.rows.length) {
    console.log('\nvenues without coordinates:');
    venues.rows.forEach(v => console.log(`  ${v.name} — ${v.address || '(no address)'}, ${v.city || ''}`));
  }
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });

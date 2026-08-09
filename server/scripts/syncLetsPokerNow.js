/**
 * One-off / manual trigger for the LetsPoker sync.
 * Uses local .env by default; export DATABASE_URL before running to target another DB
 * (db.js prefers an already-set DATABASE_URL over the local DB_* vars — dotenv won't override it).
 *
 * Run: node server/scripts/syncLetsPokerNow.js            (all clubs)
 *      node server/scripts/syncLetsPokerNow.js house       (one club — key from CLUBS)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = require('../config/db');
const { syncLetsPoker, CLUBS } = require('../services/letsPokerSync');

const requested = process.argv[2];
const clubKeys = requested ? [requested] : Object.keys(CLUBS);

(async () => {
  for (const key of clubKeys) {
    console.log(`\n── ${key} ──`);
    try {
      const result = await syncLetsPoker(key);
      console.log('Result:', JSON.stringify(result, null, 2));
    } catch (e) {
      console.error('Fatal:', e.message);
    }
  }
  await pool.end();
})();

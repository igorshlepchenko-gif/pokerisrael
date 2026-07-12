/**
 * One-off / manual trigger for the LetsPoker (EVPlus) sync.
 * Uses local .env by default; export DATABASE_URL before running to target another DB
 * (db.js prefers an already-set DATABASE_URL over the local DB_* vars — dotenv won't override it).
 *
 * Run: node server/scripts/syncLetsPokerNow.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const pool = require('../config/db');
const { syncLetsPoker } = require('../services/letsPokerSync');

syncLetsPoker()
  .then(result => {
    console.log('Result:', JSON.stringify(result, null, 2));
    return pool.end();
  })
  .catch(e => {
    console.error('Fatal:', e.message);
    process.exit(1);
  });

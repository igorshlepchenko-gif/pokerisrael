/**
 * מרענן את רשימת טווחי הכתובות של רשתות חסומות (config/antiScraping.js → blockedAsns)
 * מ-RIPEstat, וכותב אותה ל-config/blockedNetworks.json.
 *
 * הרצה (מתיקיית הפרויקט): node server/scripts/updateBlockedNetworks.js
 * ספקי אחסון מוסיפים טווחים מדי פעם — כדאי להריץ אחת לכמה חודשים ולדחוף.
 */
const fs = require('fs');
const path = require('path');
const { blockedAsns } = require('../config/antiScraping');

(async () => {
  const out = { generatedAt: new Date().toISOString(), source: 'https://stat.ripe.net (announced-prefixes)', asns: {} };
  for (const { asn, name } of blockedAsns) {
    const res = await fetch(`https://stat.ripe.net/data/announced-prefixes/data.json?resource=AS${asn}`);
    if (!res.ok) throw new Error(`RIPEstat AS${asn}: HTTP ${res.status}`);
    const prefixes = (await res.json()).data.prefixes.map((p) => p.prefix).sort();
    if (prefixes.length === 0) throw new Error(`RIPEstat AS${asn}: no prefixes — not overwriting`);
    out.asns[asn] = { name, prefixes };
    console.log(`AS${asn} (${name}): ${prefixes.length} prefixes`);
  }
  const file = path.join(__dirname, '../config/blockedNetworks.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
  console.log('written', file);
})().catch((e) => { console.error(e.message); process.exit(1); });

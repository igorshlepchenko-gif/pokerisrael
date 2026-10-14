// בדיקות למונה הכניסות — רצות בלי DB
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-analytics';
const { test } = require('node:test');
const assert = require('node:assert');
const { visitorHash, deviceOf, sourceOf } = require('../routes/analytics')._test;

test('visitor id: stable within a day, changes the next day, never contains the IP', () => {
  const ua = 'Mozilla/5.0 (iPhone)';
  const a = visitorHash('2026-10-14', '84.229.1.2', ua);
  assert.equal(a, visitorHash('2026-10-14', '84.229.1.2', ua));
  assert.notEqual(a, visitorHash('2026-10-15', '84.229.1.2', ua));
  assert.notEqual(a, visitorHash('2026-10-14', '84.229.1.3', ua));
  assert.equal(a.length, 16);
  assert.ok(!a.includes('84'));
});

test('device type from user agent', () => {
  assert.equal(deviceOf('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile/15E148'), 'mobile');
  assert.equal(deviceOf('Mozilla/5.0 (Linux; Android 14; SM-S918B) Mobile Safari'), 'mobile');
  assert.equal(deviceOf('Mozilla/5.0 (iPad; CPU OS 17_0)'), 'tablet');
  assert.equal(deviceOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130'), 'desktop');
});

test('traffic source: utm wins, own site and empty referrer are direct', () => {
  assert.equal(sourceOf('WhatsApp_Group', 'https://www.google.com/', 'www.pokerisrael.org'), 'whatsapp_group');
  assert.equal(sourceOf('', 'https://www.google.co.il/search?q=x', 'www.pokerisrael.org'), 'google.co.il');
  assert.equal(sourceOf('', 'https://l.facebook.com/l.php?u=x', 'www.pokerisrael.org'), 'l.facebook.com');
  assert.equal(sourceOf('', 'https://www.pokerisrael.org/podcasts', 'www.pokerisrael.org'), null);
  assert.equal(sourceOf('', '', 'www.pokerisrael.org'), null);
  assert.equal(sourceOf('', 'not a url', 'www.pokerisrael.org'), null);
});

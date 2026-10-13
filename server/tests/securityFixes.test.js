// בדיקות לתיקוני האבטחה (קישורים, SSRF, סוד ה-agent). רצות בלי DB.
const { test } = require('node:test');
const assert = require('node:assert');
const { cleanUrlField } = require('../utils/urlField');
const { safeGet, isPrivateIp } = require('../utils/safeUrl');

test('registration / website links: only http(s), bare domains get https://', () => {
  assert.deepEqual(cleanUrlField('https://club.co.il/reg'), { ok: true, value: 'https://club.co.il/reg' });
  assert.deepEqual(cleanUrlField('www.club.co.il'), { ok: true, value: 'https://www.club.co.il' });
  assert.deepEqual(cleanUrlField('wa.me/972501234567'), { ok: true, value: 'https://wa.me/972501234567' });
  assert.deepEqual(cleanUrlField(''), { ok: true, value: null });
  assert.deepEqual(cleanUrlField(null), { ok: true, value: null });
  for (const bad of ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,<script>', 'vbscript:x', 'file:///etc/passwd']) {
    assert.equal(cleanUrlField(bad).ok, false, bad);
  }
});

test('private / internal addresses are recognised', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.1.1', '172.20.0.1', '169.254.169.254', '::1', 'fd00::1', '::ffff:10.0.0.1']) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
  assert.equal(isPrivateIp('8.8.8.8'), false);
});

test('safeGet refuses internal targets before connecting', async () => {
  await assert.rejects(safeGet('http://127.0.0.1:5000/api/health'));
  await assert.rejects(safeGet('http://localhost/'));
  await assert.rejects(safeGet('http://myservice.railway.internal/'));
  await assert.rejects(safeGet('file:///etc/passwd'));
});

test('safeGet re-checks every redirect hop', async () => {
  // שרת "חיצוני" מדומה שמפנה לכתובת פנימית — הבקשה הראשונה עוברת דרך axios מדומה
  const axios = require('axios');
  const dns = require('dns').promises;
  const realGet = axios.get, realLookup = dns.lookup;
  const visited = [];
  dns.lookup = async (host) => (host === 'public.example' ? [{ address: '93.184.216.34', family: 4 }] : realLookup(host, { all: true }));
  axios.get = async (url) => {
    visited.push(url);
    return { status: 302, headers: { location: 'http://10.0.0.5/admin' } };
  };
  try {
    await assert.rejects(safeGet('http://public.example/feed.json'), /פנימית/);
    assert.deepEqual(visited, ['http://public.example/feed.json']); // ה-hop הפנימי לא נשלח
  } finally {
    axios.get = realGet;
    dns.lookup = realLookup;
  }
});

test('agent secret check: right secret passes, wrong/missing fails', () => {
  process.env.AGENT_SECRET = 'test-agent-secret';
  delete require.cache[require.resolve('../middleware/agentAuth')];
  const { requireAgentSecret } = require('../middleware/agentAuth');
  const run = (secret) => {
    let status = 200;
    const res = { status: (s) => { status = s; return { json: () => {} }; } };
    requireAgentSecret({ headers: secret === undefined ? {} : { 'x-agent-secret': secret } }, res, () => {});
    return status;
  };
  assert.equal(run('test-agent-secret'), 200);
  assert.equal(run('test-agent-secreX'), 401);
  assert.equal(run(undefined), 401);
});

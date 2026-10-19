// בדיקות לסנכרון פרסומים מ-Google Drive — בלי רשת ובלי DB (safeGet ו-pool מוחלפים)
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// PNG מינימלי תקין (1x1)
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
  '1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');

let folderHtml = '';
let downloads = 0;
let failListing = false;
const saved = {};
require.cache[require.resolve('../utils/safeUrl')] = { exports: {
  safeGet: async (url) => {
    if (url.includes('embeddedfolderview')) {
      if (failListing) throw new Error('network down');
      return { data: folderHtml };
    }
    downloads++;
    if (url.includes('id=VIDEOVIDEOVIDEO123')) return { data: Buffer.from('not an image at all') };
    return { data: PNG };
  },
} };
require.cache[require.resolve('../config/db')] = { exports: {
  query: async (sql, params) => {
    if (/INSERT INTO app_settings/.test(sql)) { saved.value = params[0]; return { rows: [] }; }
    return { rows: saved.value ? [{ value: saved.value }] : [] };
  },
} };

const drive = require('../services/drivePromos');
const dir = path.join(__dirname, '../uploads/online-promos/ludus');

const entry = (id, name) =>
  `<div class="flip-entry" id="entry-${id}" tabindex="0"><div class="flip-entry-info"><a href="https://drive.google.com/file/d/${id}/view">` +
  `<div class="flip-entry-title">${name}</div></a></div></div>`;
const page = (entries) => `<html><body><div class="flip-entries">${entries.join('')}</div></body></html>`;

test('folder images replace the club promos; non-images skipped; files cached', async () => {
  fs.rmSync(dir, { recursive: true, force: true });
  folderHtml = page([entry('AAAAAAAAAAAAAAAAAAAA1', 'בוקר 10-14.png'), entry('VIDEOVIDEOVIDEO123', 'clip.mp4')]);
  let r = await drive.syncDrivePromos();
  assert.equal(r.ludus, 1);
  const promos = drive.currentDrivePromos();
  assert.equal(promos.length, 1);
  assert.equal(promos[0].clubId, 'ludus');
  assert.equal(promos[0].image, '/uploads/online-promos/ludus/AAAAAAAAAAAAAAAAAAAA1.png');
  assert.equal(promos[0].alt, 'Ludus — בוקר 10-14');
  assert.ok(fs.existsSync(path.join(dir, 'AAAAAAAAAAAAAAAAAAAA1.png')));

  // אותו קובץ בסנכרון הבא — לא מורד שוב
  const before = downloads;
  await drive.syncDrivePromos();
  assert.equal(downloads - before, 1); // רק ה-"VIDEO" נבדק שוב (לא נשמר)
});

test('new file in the folder replaces the old one (old file deleted)', async () => {
  folderHtml = page([entry('BBBBBBBBBBBBBBBBBBBB2', 'ערב.png')]);
  await drive.syncDrivePromos();
  const promos = drive.currentDrivePromos();
  assert.deepEqual(promos.map((p) => p.id), ['drive-ludus-BBBBBBBBBBBBBBBBBBBB2']);
  assert.ok(!fs.existsSync(path.join(dir, 'AAAAAAAAAAAAAAAAAAAA1.png')));
});

test('listing failure keeps the current promo; empty folder removes it', async () => {
  failListing = true;
  const r = await drive.syncDrivePromos();
  assert.match(String(r.ludus), /error/);
  assert.equal(drive.currentDrivePromos().length, 1);
  failListing = false;

  folderHtml = page([]);
  await drive.syncDrivePromos();
  assert.equal(drive.currentDrivePromos().length, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

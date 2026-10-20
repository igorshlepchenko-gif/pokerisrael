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
const saved = {}; // לפי מפתח ב-app_settings
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
    const key = (sql.match(/'([a-z_]+)'/) || [])[1];
    if (/INSERT INTO app_settings/.test(sql)) { saved[key] = params[0]; return { rows: [] }; }
    return { rows: saved[key] ? [{ value: saved[key] }] : [] };
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

test('folder link parsing and automatic file names', () => {
  assert.equal(drive.parseFolderId('https://drive.google.com/drive/folders/1VXKQP_Ze_JEm3R6uFW7rqhczyyIXDwM3?usp=sharing'), '1VXKQP_Ze_JEm3R6uFW7rqhczyyIXDwM3');
  assert.equal(drive.parseFolderId('https://drive.google.com/open?id=1VXKQP_Ze_JEm3R6uFW7rqhczyyIXDwM3'), '1VXKQP_Ze_JEm3R6uFW7rqhczyyIXDwM3');
  assert.equal(drive.parseFolderId('not a link'), null);
  assert.equal(drive.titleFromFile('WhatsApp Image 2026-10-19 at 11.23.53.jpeg'), '');
  assert.equal(drive.titleFromFile('EPT_Prague.jpg'), 'EPT Prague');
});

test('second club gets its own folder; removing it drops its promos and files', async () => {
  const dgpcDir = path.join(__dirname, '../uploads/online-promos/dgpc');
  folderHtml = page([entry('CCCCCCCCCCCCCCCCCCCC3', 'WhatsApp Image 2026-10-20.jpeg')]);
  const r = await drive.setClubFolder('dgpc', 'DGPC', 'https://drive.google.com/drive/folders/DGPCFOLDER1234567890');
  assert.equal(r.synced, 1);
  assert.deepEqual(drive.currentDriveClubs().sort(), ['dgpc', 'ludus']);
  const dg = drive.currentDrivePromos().filter((p) => p.clubId === 'dgpc');
  assert.equal(dg.length, 1);
  assert.equal(dg[0].alt, 'DGPC — פרסום'); // שם וואטסאפ אוטומטי → שם כללי
  assert.ok(JSON.parse(saved.drive_promo_folders).dgpc.folderId === 'DGPCFOLDER1234567890');

  await drive.setClubFolder('dgpc', 'DGPC', '');
  assert.deepEqual(drive.currentDriveClubs(), ['ludus']);
  assert.equal(drive.currentDrivePromos().filter((p) => p.clubId === 'dgpc').length, 0);
  assert.ok(!fs.existsSync(dgpcDir));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('bad link or private folder is rejected without saving', async () => {
  const before = saved.drive_promo_folders;
  await assert.rejects(drive.setClubFolder('dgpc', 'DGPC', 'hello'), { status: 400 });
  failListing = true;
  await assert.rejects(drive.setClubFolder('dgpc', 'DGPC', 'https://drive.google.com/drive/folders/PRIVATEFOLDER123456'), /כל מי שיש לו את הקישור/);
  failListing = false;
  await assert.rejects(drive.setClubFolder('../etc', 'x', 'https://drive.google.com/drive/folders/DGPCFOLDER1234567890'), { status: 400 });
  assert.equal(saved.drive_promo_folders, before);
});

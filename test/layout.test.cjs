'use strict';
// CSD Receipt page layout: values, date format and the Word tab, from CSD_DATE.docx. Made-up values only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('../src/layout.js');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('PO date prints as DD-MON-YY in capitals', () => {
  assert.equal(L.formatDate('2026-09-22'), '22-SEP-26');
  assert.equal(L.formatDate('2027-01-05'), '05-JAN-27');
  assert.equal(L.formatDate('2026-13-01'), ''); assert.equal(L.formatDate(''), '');
});
test('Word tab after "PO Num: " at 11 pt: 8 characters = 52.8 pt, tab to 72 pt = 19.2 pt', () => {
  assert.ok(Math.abs(L.tabWidth('PO Num: ', 11) - 19.2) < 1e-9);
  assert.ok(Math.abs(L.tabWidth('SR Num: ', 11) - 19.2) < 1e-9);
  assert.ok(Math.abs(L.tabWidth('x'.repeat(6), 6) - 14.4) < 1e-9);   // exactly on a stop (21.6 -> 36)
});
test('the four lines, values escaped; an empty GST number leaves the first line empty', () => {
  const h = L.sheetHtml({ gst: '32zzzpz0000z1z0', po: '70289', sr: '53931', date: '2026-09-22' });
  assert.match(h, /<p class="csd-line csd-gst">GST NO : 32ZZZPZ0000Z1Z0<\/p>/);
  assert.match(h, /<p class="csd-line csd-r">PO Num: <span class="csd-tab" style="width:19\.20pt"><\/span>70289<\/p>/);
  assert.match(h, /<p class="csd-line csd-r">SR Num: <span class="csd-tab" style="width:19\.20pt"><\/span>53931<\/p>/);
  assert.match(h, /<p class="csd-line csd-r">PO Date:22-SEP-26<\/p>/);
  assert.match(L.sheetHtml({ po: '1', sr: '2', date: '2026-09-22' }), /^<p class="csd-line csd-gst"><\/p>/);
  assert.doesNotMatch(L.sheetHtml({ po: '<b>1', sr: '"2', date: '2026-09-22' }), /<b>|"2/);
});
test('GST number: 15 letters and digits starting with the state code, or empty; masked as first 2 and last 2', () => {
  assert.ok(L.gstOk('32ZZZPZ0000Z1Z0')); assert.ok(L.gstOk(''));
  assert.ok(!L.gstOk('32ZZZPZ0000Z1Z')); assert.ok(!L.gstOk('ZZZZZPZ0000Z1Z0'));
  assert.equal(L.cleanGst(' 32zzz-pz0000z1z0 '), '32ZZZPZ0000Z1Z0');
  assert.equal(L.mask('32ZZZPZ0000Z1Z0'), '32***********Z0');
});
test('page sizes match the document: A4, 36 pt margins, Courier New bold, 14 pt and 11 pt, single line spacing', () => {
  const css = read('src/sheet.css');
  for (const rule of [/width:595\.28pt/, /height:841\.89pt/, /padding:36pt/, /font-family:"Courier New",monospace;/, /font-weight:700/, /line-height:1\.1328/, /\.csd-gst\{font-size:14pt;text-indent:36pt;text-align:left\}/, /\.csd-r\{font-size:11pt;text-align:right\}/]) assert.match(css, rule);
  const page = L.pageHtml({ po: '1', sr: '2', date: '2026-09-22' }, css);
  assert.match(page, /@page\{size:A4;margin:0\}/); assert.match(page, /<title>CSD print<\/title>/); assert.doesNotMatch(page, /<script/);
});
test('the printed page must be in Courier New Bold: the font is read back from the PDF before printing', () => {
  const { pdfFonts, fontOk } = require('../src/fonts.cjs');
  const pdf = (...names) => Buffer.from(names.map((n, i) => `${i} 0 obj << /Type /Font /BaseFont /${n} >> endobj`).join('\n'), 'latin1');
  assert.deepEqual(pdfFonts(pdf('AAAAAA+CourierNewPS-BoldMT')), ['CourierNewPS-BoldMT']);
  assert.equal(fontOk(pdf('AAAAAA+CourierNewPS-BoldMT')), true);
  assert.equal(fontOk(pdf('BAAAAA+LiberationMono-Bold')), false);          // look-alike font: refused
  assert.equal(fontOk(pdf('AAAAAA+CourierNewPSMT')), false);               // Courier New, but not bold: refused
  assert.equal(fontOk(pdf('AAAAAA+CourierNewPS-BoldMT', 'BAAAAA+Consolas-Bold')), false);
  assert.equal(fontOk(pdf()), false);
  assert.match(read('src/main.cjs'), /if \(!fontOk\(await pdfOf\(sheet\.webContents\), wantedFont\(\)\)\) throw new Error\(FONT_MISSING\);/);
  assert.doesNotMatch(read('src/sheet.css'), /Liberation/);
});
test('the app only takes messages from its own page, prints silently with the chosen copies, keeps no GST number in the list', () => {
  const m = read('src/main.cjs');
  assert.match(m, /event\.sender !== win\.webContents \|\| event\.senderFrame !== event\.sender\.mainFrame \|\| !isOurPage\(event\.senderFrame\.url\)/);
  assert.match(m, /silent: true, deviceName: printer, copies/);
  // No printer from Electron: Windows is asked directly, and the Windows print dialog is always offered.
  assert.match(m, /if \(!list\.length\) list = await windowsPrinters\(\);/);
  assert.match(m, /Get-CimInstance Win32_Printer/);
  assert.match(m, /\} else if \(viaDialog\) \{[^]*?silent: false, copies/);
  assert.match(m, /return \{ printed: false, cancelled: true \}/);
  assert.match(read('src/app.js'), /Windows print dialog…<\/option>/); assert.match(m, /margins: \{ marginType: 'none' \}, scaleFactor: 100/);
  assert.match(m, /javascript: false/); assert.match(m, /setPermissionRequestHandler\(\(_wc, _perm, cb\) => cb\(false\)\)/);
  assert.match(m, /history\.unshift\(\{ at: new Date\(\)\.toISOString\(\), po: e\.po, sr: e\.sr, date: e\.date/);
  assert.match(m, /safeStorage\.encryptString/);
  const app = read('src/app.js');
  assert.match(app, /\$\('poInput'\)\.value = ''; \$\('srInput'\)\.value = '';/);   // ready for the next numbers
  assert.ok(!/\bon(click|change|input|keydown)=/.test(read('src/index.html')));
  assert.match(read('src/index.html'), /script-src 'self';/);
});

test('the app recognises its own page by file path, however Windows writes the address', () => {
  const path = require('node:path'); const { pageOf } = require('../src/pages.cjs');
  const w = path.win32, root = 'C:\\Users\\KARTHI~1\\AppData\\Local\\Temp\\2abc\\resources\\app.asar\\src';
  assert.equal(pageOf('file:///C:/Users/KARTHI~1/AppData/Local/Temp/2abc/resources/app.asar/src/index.html', root, w), 'index.html');
  assert.equal(pageOf('file:///c:/users/karthi~1/appdata/local/temp/2abc/resources/app.asar/src/index.html', root, w), 'index.html');   // letter case
  assert.equal(pageOf('file:///C:/Users/KARTHI%7E1/AppData/Local/Temp/2abc/resources/app.asar/src/index.html', root, w), 'index.html'); // escaped ~
  const spaced = 'C:\\Program Files\\CSD Receipt (copy)\\resources\\app.asar\\src';
  assert.equal(pageOf('file:///C:/Program%20Files/CSD%20Receipt%20(copy)/resources/app.asar/src/index.html', spaced, w), 'index.html');
  // Anything else is not our page.
  assert.equal(pageOf('file:///C:/Users/x/evil/index.html', root, w), '');
  assert.equal(pageOf('file:///C:/Users/KARTHI~1/AppData/Local/Temp/2abc/resources/app.asar/src/index.html?x=1', root, w), '');
  assert.equal(pageOf('https://example.com/index.html', root, w), '');
  const x = path.posix; // Linux-style paths, whatever machine runs the test
  assert.equal(pageOf('file:///home/u/app/src/index.html', '/home/u/app/src', x), 'index.html');
  assert.equal(pageOf('file:///home/u/app/src/../other/index.html', '/home/u/app/src', x), '');
  assert.doesNotMatch(read('src/main.cjs'), /senderFrame\.url !== PAGE/);
});

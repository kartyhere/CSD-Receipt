// Isolated Electron check: CSD Receipt. Types GST number, PO Num, SR Num and PO Date, checks the print pop-up
// (page preview, copies, printer), "prints" (written as a PDF in a test folder instead of a printer), checks the form is
// ready for the next numbers, and lists the print. Made-up values only.
//   CSD_OUT=/tmp/csdr xvfb-run -a node_modules/.bin/electron --no-sandbox --disable-gpu test/app-electron-smoke.cjs
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const assert = require('node:assert/strict');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'csdr-'));
const out = process.env.CSD_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'csdr-out-')); fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(out)) if (f.endsWith('.pdf') || f.endsWith('.png')) fs.rmSync(path.join(out, f));
process.env.CSDRECEIPT_TEST_PDF_DIR = out;
// This Linux test machine has no Courier New: Liberation Mono (same widths) stands in, and the font check expects it.
process.env.CSDRECEIPT_TEST_NO_PRINTERS = '1'; // like Karthik's PC: Electron's list comes back empty
process.env.CSDRECEIPT_TEST_FONT = 'Liberation Mono'; process.env.CSDRECEIPT_TEST_FONT_PS = 'LiberationMono';
process.env.CSDRECEIPT_TEST_PROFILE = '1'; // keep the throw-away profile below instead of %APPDATA%\CSD Receipt
app.setPath('userData', profile);
const errors = [];
app.on('web-contents-created', (_, c) => { c.on('console-message', (d) => { if (d.level === 'error' || d.level === 3) errors.push(d.message); }); });
require('../src/main.cjs');
setTimeout(() => { console.error('FAIL: timed out'); process.exit(1); }, 120000);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(check, timeout = 40000) { const end = Date.now() + timeout; while (Date.now() < end) { const r = await check(); if (r) return r; await wait(50); } throw Error('Condition timed out: ' + String(check)); }
const page = (name) => waitFor(() => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith(name) && !w.webContents.isLoading()));
const GST = '32ZZZPZ0000Z1Z0'; // obviously fake
(async () => {
  await app.whenReady();
  const win = await page('src/index.html'); const js = (c) => win.webContents.executeJavaScript(c);
  await waitFor(() => js(`!document.body.classList.contains('booting')`));
  const shot = async (n) => { await wait(400); fs.writeFileSync(path.join(out, n + '.png'), (await win.webContents.capturePage()).toPNG()); };
  const key = (k, mods) => { win.webContents.sendInputEvent({ type: 'keyDown', keyCode: k, modifiers: mods || [] }); win.webContents.sendInputEvent({ type: 'keyUp', keyCode: k, modifiers: mods || [] }); };
  const type = async (s) => { for (const ch of s) win.webContents.sendInputEvent({ type: 'char', keyCode: ch }); await wait(60); };
  const active = () => js(`document.activeElement.id`);
  const open = () => js(`document.getElementById('printDialog').open`);

  await waitFor(() => js(`document.getElementById('fontWarning').hidden`));     // font found: no warning
  // First use: no GST number yet, so the GST box has the focus. Enter moves box to box.
  assert.equal(await js(`document.getElementById('dataNote').textContent`), path.join(profile, 'csd-receipt.dat'));
  assert.equal(await active(), 'gstInput');
  await type(GST.toLowerCase()); key('Return'); await wait(80);                 // typed in lower case: stored upper case
  assert.equal(await active(), 'poInput'); await type('70289'); key('Return'); await wait(80);
  assert.equal(await active(), 'srInput'); await type('53931'); key('Return'); await wait(80);
  assert.equal(await active(), 'dateInput');
  await js(`(()=>{const d=document.getElementById('dateInput');d.value='2026-09-22';d.dispatchEvent(new Event('input'));d.dispatchEvent(new Event('change'))})()`);
  assert.equal(await js(`document.getElementById('dateShown').textContent`), '22-SEP-26');
  assert.equal(await js(`document.getElementById('gstInput').type`), 'password');           // masked on screen
  const lines = await js(`[...document.querySelectorAll('#stripSheet .csd-line')].map(p=>p.textContent)`);
  assert.deepEqual(lines, [`GST NO : ${GST}`, 'PO Num: 70289', 'SR Num: 53931', 'PO Date:22-SEP-26']);
  await shot('c1-form');

  // Enter on the date opens the print pop-up: whole page, copies 1 focused, facts with the GST number masked.
  await js(`document.getElementById('dateInput').focus()`); key('Return');
  await waitFor(open);
  assert.equal(await active(), 'copiesInput');
  assert.match(await js(`document.getElementById('printFacts').innerText`), /70289[^]*53931[^]*22-SEP-26[^]*32\*{11}Z0/);
  assert.equal(await js(`document.querySelectorAll('#pageSheet .csd-line').length`), 4);
  // No printer listed: "Windows print dialog…" is chosen and the note says why.
  await waitFor(() => js(`document.getElementById('printerSelect').options.length > 0`));
  assert.deepEqual(await js(`[...document.getElementById('printerSelect').options].map(o=>o.text)`), ['Windows print dialog…']);
  assert.match(await js(`document.getElementById('printerNote').textContent`), /Windows print dialog will open/);
  await shot('c2-dialog');
  // Esc goes back without printing.
  key('Escape'); await waitFor(async () => !(await open()));
  assert.equal(fs.readdirSync(out).filter((f) => f.endsWith('.pdf')).length, 0);
  // Wrong font on the page: nothing is printed and the pop-up says why.
  process.env.CSDRECEIPT_TEST_FONT_PS = 'CourierNew';
  key('P', ['control']); await waitFor(open); await wait(200); key('Return');
  await waitFor(async () => /Courier New Bold is not installed/.test(await js(`document.getElementById('printError').textContent`)));
  assert.equal(await open(), true); assert.equal(fs.readdirSync(out).filter((f) => f.endsWith('.pdf')).length, 0);
  key('Escape'); await waitFor(async () => !(await open()));
  process.env.CSDRECEIPT_TEST_FONT_PS = 'LiberationMono';
  // Ctrl+P opens it again; 2 copies; Enter prints.
  key('P', ['control']); await waitFor(open); await wait(200);
  await js(`document.getElementById('copiesInput').select()`); await type('2'); key('Return');
  await waitFor(async () => !(await open()));
  const pdfs = fs.readdirSync(out).filter((f) => f.startsWith('print-')); assert.equal(pdfs.length, 1); assert.match(pdfs[0], /-2-dialog\.pdf$/);
  const pdf = fs.readFileSync(path.join(out, pdfs[0])).toString('latin1');
  assert.match(pdf, /\/MediaBox \[0 0 59[45]\.\d+ 84[12]\.\d+\]/);                                     // A4
  assert.match(pdf, /\/Title \(CSD print\)/); assert.ok(!pdf.includes('ZZZPZ'), 'no GST number in the PDF details');
  assert.match(pdf, /\/BaseFont \/[A-Z]{6}\+LiberationMono-Bold/);
  fs.renameSync(path.join(out, pdfs[0]), path.join(out, 'printed.pdf'));
  // Ready for the next one: PO and SR empty, date and GST kept, focus on PO Num.
  assert.deepEqual(await js(`['poInput','srInput','dateInput','gstInput'].map(i=>document.getElementById(i).value)`), ['', '', '2026-09-22', GST]);
  assert.equal(await active(), 'poInput');
  assert.match(await js(`document.getElementById('toast').textContent`), /Printed 2 copies · PO Num 70289 · SR Num 53931/);
  // Missing SR number: the pop-up does not open and says why.
  await type('70290'); key('P', ['control']); await wait(200);
  assert.equal(await open(), false); assert.match(await js(`document.getElementById('formError').textContent`), /SR number/); assert.equal(await active(), 'srInput');
  // Printed list: Enter puts the numbers back.
  assert.equal(await js(`document.getElementById('printedBadge').textContent`), '1');
  await js(`document.querySelector('[data-view="printed"]').click()`);
  assert.match(await js(`document.getElementById('printedBody').innerText`), /70289\s*53931\s*22-SEP-26\s*2/);
  assert.doesNotMatch(await js(`document.getElementById('printedBody').innerText`), /ZZZPZ/);           // no GST number in the list
  await js(`document.getElementById('printedBody').focus()`); key('Return'); await wait(150);
  assert.deepEqual(await js(`['poInput','srInput'].map(i=>document.getElementById(i).value)`), ['70289', '53931']);
  // Remembered after the window is reloaded; GST number saved sealed or marked plain, never in the list of prints.
  win.webContents.reload(); await wait(300);
  await waitFor(() => js(`!!document.body && !document.body.classList.contains('booting')`));
  assert.deepEqual(await js(`['gstInput','dateInput'].map(i=>document.getElementById(i).value)`), [GST, '2026-09-22']);
  assert.equal(await js(`document.activeElement.id`), 'poInput');
  // Alt+2 / Alt+1 switch sections.
  key('2', ['alt']); await wait(150); assert.equal(await js(`document.getElementById('pageTitle').textContent`), 'Printed');
  key('1', ['alt']); await wait(150); assert.equal(await js(`document.getElementById('pageTitle').textContent`), 'Print');
  const stored = fs.readFileSync(path.join(profile, 'csd-receipt.dat')).toString('utf8');
  assert.ok(!/"history":\[[^\]]*ZZZPZ/.test(stored), 'no GST number in the list of prints');
  const bad = errors.filter((m) => !/Failed to load resource/.test(m)); assert.deepEqual(bad, []);
  console.log(`PASS: CSD Receipt types, previews, prints copies, clears for the next numbers and lists prints. PDF in ${out}`);
  process.exit(0);
})().catch((e) => { console.error('FAIL:', e && e.stack || e, errors.join('\n')); process.exit(1); });

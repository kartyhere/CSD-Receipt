'use strict';
// CSD Receipt: type the GST number, PO Num, SR Num and PO Date, check the page, print n copies, next one.
// One window, nothing sent anywhere. The page is printed from a hidden window that holds only the sheet (no scripts).
// Settings and the list of prints are kept in the user's app-data folder, sealed with Windows' own protection
// (Electron safeStorage) when it is available. The GST number is never written to the list of prints.
const { app, BrowserWindow, dialog, ipcMain, safeStorage, session, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const Layout = require('./layout.js');
const { fontOk } = require('./fonts.cjs');

const HISTORY_MAX = 1000;
const SHEET_CSS = fs.readFileSync(path.join(__dirname, 'sheet.css'), 'utf8');
const PAGE = pathToFileURL(path.join(__dirname, 'index.html')).href;
// Only when run from source (never in the packaged app): write a PDF instead of printing, and stand in another font
// for Courier New (the Linux test machine has no Courier New), for the automatic checks.
const testHook = (name) => (app.isPackaged ? '' : String(process.env[name] || ''));
const sheetCss = () => { const f = testHook('CSDRECEIPT_TEST_FONT'); return f ? SHEET_CSS.replace(/"Courier New"/g, `"${f.replace(/["\\]/g, '')}"`) : SHEET_CSS; };
const wantedFont = () => testHook('CSDRECEIPT_TEST_FONT_PS') || 'CourierNew';
const FONT_MISSING = 'Courier New Bold is not installed on this computer, so nothing was printed. Install the Courier New font in Windows (Settings > Fonts) and try again.';

let win = null; let data = null;
const dataFile = () => path.join(app.getPath('userData'), 'csd-receipt.dat');

// ---- storage ----
function load() {
  if (data) return data;
  data = { gst: '', date: '', printer: '', history: [] };
  try {
    if (fs.existsSync(dataFile())) {
      const raw = fs.readFileSync(dataFile());
      const text = raw.subarray(0, 6).toString() === 'PLAIN:' ? raw.subarray(6).toString('utf8') : safeStorage.decryptString(raw);
      const d = JSON.parse(text);
      data = { gst: Layout.cleanGst(d.gst), date: /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') ? d.date : '', printer: String(d.printer || '').slice(0, 200), history: Array.isArray(d.history) ? d.history.slice(0, HISTORY_MAX) : [] };
    }
  } catch { /* unreadable file: start empty; the next save replaces it */ }
  return data;
}
function save() {
  const text = JSON.stringify({ schema: 1, ...data });
  const bytes = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(text) : Buffer.concat([Buffer.from('PLAIN:'), Buffer.from(text)]);
  const tmp = `${dataFile()}.tmp`;
  fs.mkdirSync(path.dirname(dataFile()), { recursive: true });
  fs.writeFileSync(tmp, bytes, { mode: 0o600 });
  fs.renameSync(tmp, dataFile());
}

// ---- the page ----
function entry(p) {
  const gst = Layout.cleanGst(p?.gst), po = Layout.cleanText(p?.po), sr = Layout.cleanText(p?.sr), date = String(p?.date || '');
  if (!Layout.gstOk(gst)) throw new Error('The GST number must be 15 letters and digits, starting with the 2-digit state code.');
  if (!po) throw new Error('Type the PO number.');
  if (!sr) throw new Error('Type the SR number.');
  if (!Layout.formatDate(date)) throw new Error('Choose the PO date.');
  return { gst, po, sr, date };
}
function remember(e, extra) {
  const d = load();
  d.gst = e.gst; d.date = e.date;
  d.history.unshift({ at: new Date().toISOString(), po: e.po, sr: e.sr, date: e.date, ...extra });
  d.history = d.history.slice(0, HISTORY_MAX);
  save();
  return d.history.slice(0, 200);
}
const pdfOf = (wc) => wc.printToPDF({ printBackground: false, pageSize: 'A4', preferCSSPageSize: true, margins: { top: 0, bottom: 0, left: 0, right: 0 }, scale: 1 });
async function withSheet(e, work) {
  const sheet = new BrowserWindow({ show: false, width: 800, height: 1100, webPreferences: { sandbox: true, javascript: false, spellcheck: false, contextIsolation: true, nodeIntegration: false } });
  try {
    await sheet.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(Layout.pageHtml(e, sheetCss()))}`);
    if (!fontOk(await pdfOf(sheet.webContents), wantedFont())) throw new Error(FONT_MISSING);
    return await work(sheet.webContents);
  } finally { if (!sheet.isDestroyed()) sheet.destroy(); }
}

// ---- messages from the window: only from our own page in our own window ----
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, payload) => {
    if (!win || win.isDestroyed() || event.sender !== win.webContents || event.senderFrame !== event.sender.mainFrame || event.senderFrame.url !== PAGE) throw new Error('This window is not allowed to do that.');
    if (payload !== undefined && (payload === null || typeof payload !== 'object' || Array.isArray(payload))) throw new Error('Unexpected request.');
    return fn(payload);
  });
}
function registerHandlers() {
  handle('csd:load', () => { const d = load(); return { gst: d.gst, date: d.date, printer: d.printer, history: d.history.slice(0, 200), version: require('../package.json').version }; });
  handle('csd:save-settings', (p) => {
    const d = load(), gst = Layout.cleanGst(p?.gst);
    if (p && 'gst' in p) { if (!Layout.gstOk(gst)) throw new Error('The GST number must be 15 letters and digits, starting with the 2-digit state code.'); d.gst = gst; }
    if (p && 'date' in p && Layout.formatDate(p.date)) d.date = p.date;
    save(); return true;
  });
  handle('csd:font-check', async () => {
    try { await withSheet({ gst: '', po: '0', sr: '0', date: '2026-01-01' }, async () => true); return { ok: true }; }
    catch (err) { return { ok: false, message: String(err.message || err) }; }
  });
  handle('csd:printers', async () => {
    const list = await win.webContents.getPrintersAsync();
    return list.map((x) => ({ name: x.name, label: x.displayName || x.name, isDefault: !!x.isDefault })).slice(0, 100);
  });
  // Prints without a second dialog: the copies and the printer were chosen in the window's own pop-up.
  handle('csd:print', async (p) => {
    const e = entry(p);
    const copies = Math.round(Number(p?.copies));
    if (!(copies >= 1 && copies <= 99)) throw new Error('Copies must be between 1 and 99.');
    const printer = String(p?.printer || '').slice(0, 200);
    const testDir = testHook('CSDRECEIPT_TEST_PDF_DIR');
    if (testDir) {
      await withSheet(e, async (wc) => fs.writeFileSync(path.join(testDir, `print-${Date.now()}-${copies}.pdf`), await pdfOf(wc)));
    } else {
      const printers = await win.webContents.getPrintersAsync();
      if (!printers.some((x) => x.name === printer)) throw new Error('Choose a printer.');
      const result = await withSheet(e, (wc) => new Promise((resolve) => wc.print({
        silent: true, deviceName: printer, copies, collate: true, printBackground: false, color: false,
        pageSize: 'A4', margins: { marginType: 'none' }, scaleFactor: 100, landscape: false,
      }, (ok, reason) => resolve({ ok, reason }))));
      if (!result.ok) throw new Error(`The printer did not take the page${result.reason ? ` (${String(result.reason).slice(0, 80)})` : ''}.`);
    }
    load().printer = printer;
    return { printed: true, history: remember(e, { copies, how: 'Printed' }) };
  });
  handle('csd:pdf', async (p) => {
    const e = entry(p);
    const testDir = testHook('CSDRECEIPT_TEST_PDF_DIR');
    let target = testDir ? path.join(testDir, `saved-${e.po}.pdf`) : '';
    if (!target) {
      const pick = await dialog.showSaveDialog(win, { title: 'Save as PDF', defaultPath: `CSD PO ${e.po.replace(/[^\w-]+/g, '_')}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
      if (pick.canceled || !pick.filePath) return { saved: false };
      target = pick.filePath;
    }
    fs.writeFileSync(target, await withSheet(e, pdfOf));
    return { saved: true, fileName: path.basename(target), history: remember(e, { copies: 0, how: 'PDF' }) };
  });
}

// ---- window ----
function createWindow() {
  if (win && !win.isDestroyed()) { if (win.isMinimized()) win.restore(); win.focus(); return; }
  win = new BrowserWindow({
    show: false, width: 1280, height: 860, minWidth: 980, minHeight: 640, title: 'CSD Receipt', autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'), backgroundColor: '#f4f6f5',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, webSecurity: true },
  });
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.on('closed', () => { win = null; });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', createWindow);
  // No other pages, windows, downloads, permissions or web requests: the app only shows its own page.
  app.on('web-contents-created', (_e, contents) => {
    contents.on('will-navigate', (ev, url) => { if (url !== PAGE) ev.preventDefault(); });
    contents.on('will-attach-webview', (ev) => ev.preventDefault());
    contents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  });
  app.whenReady().then(() => {
    require('electron').Menu.setApplicationMenu(null);
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
    session.defaultSession.webRequest.onBeforeRequest((details, cb) => cb({ cancel: !/^(file|data|devtools|chrome-extension):/.test(details.url) }));
    session.defaultSession.on('will-download', (ev) => ev.preventDefault());
    registerHandlers();
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}


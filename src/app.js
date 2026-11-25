(() => {
  'use strict';
  // CSD Receipt page: the form, the live preview, the print pop-up (page preview, copies, printer) and the Printed list.
  const api = window.csdReceipt, L = window.CsdLayout;
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PAGE_W = 595.28 * 4 / 3, PAGE_H = 841.89 * 4 / 3; // A4 in CSS pixels
  let history = [], printers = [], savedPrinter = '', sel = 0, busy = false, toastTimer = 0;
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const errorText = (e) => String(e && e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  function toast(msg, bad) { const t = $('toast'); t.textContent = msg; t.classList.toggle('error', !!bad); t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 4500); }

  const entry = () => ({ gst: L.cleanGst($('gstInput').value), po: L.cleanText($('poInput').value), sr: L.cleanText($('srInput').value), date: $('dateInput').value });
  function check(e) {
    if (!L.gstOk(e.gst)) return { field: 'gstInput', msg: 'The GST number must be 15 letters and digits, starting with the 2-digit state code.' };
    if (!e.po) return { field: 'poInput', msg: 'Type the PO number.' };
    if (!e.sr) return { field: 'srInput', msg: 'Type the SR number.' };
    if (!L.formatDate(e.date)) return { field: 'dateInput', msg: 'Choose the PO date.' };
    return null;
  }

  // Preview: the same sheet as the printed page, scaled. The strip shows the top of the page at full width.
  function fit(box, sheet, height) {
    const k = box.clientWidth / PAGE_W;
    sheet.style.transform = `scale(${k})`;
    box.style.height = `${Math.ceil((height || PAGE_H) * k)}px`;
  }
  function renderPreview() {
    const e = entry();
    $('stripSheet').innerHTML = L.sheetHtml(e);
    fit($('stripBox'), $('stripSheet'), 150 * 4 / 3);
    $('dateShown').textContent = L.formatDate(e.date) || '—';
  }

  // ---- Print pop-up ----
  // Printers Windows reported, plus "Windows print dialog…" (always there; chosen when no printer was found).
  let dialogValue = '__windows_dialog__';
  async function loadPrinters() {
    let failed = '';
    try { const r = await api.printers(); printers = r.printers || []; dialogValue = r.dialog || dialogValue; } catch (err) { printers = []; failed = errorText(err); }
    const pick = (savedPrinter === dialogValue ? { name: dialogValue } : null) || printers.find((p) => p.name === savedPrinter) || printers.find((p) => p.isDefault) || printers[0] || { name: dialogValue };
    $('printerSelect').innerHTML = printers.map((p) => `<option value="${esc(p.name)}" ${p.name === pick.name ? 'selected' : ''}>${esc(p.label)}${p.isDefault ? ' (default)' : ''}</option>`).join('')
      + `<option value="${esc(dialogValue)}" ${pick.name === dialogValue ? 'selected' : ''}>Windows print dialog…</option>`;
    $('printerNote').textContent = failed ? `Could not read the printer list (${failed}). The Windows print dialog will open: choose the printer there.` : printers.length ? '' : 'Windows did not list any printer here, so the Windows print dialog will open: choose the printer there.';
  }
  async function openPrint() {
    const e = entry(), bad = check(e);
    $('formError').textContent = bad ? bad.msg : '';
    if (bad) { $(bad.field).focus(); return; }
    $('pageSheet').innerHTML = L.sheetHtml(e);
    $('printFacts').innerHTML = `<div><span>PO Num</span><strong>${esc(e.po)}</strong></div><div><span>SR Num</span><strong>${esc(e.sr)}</strong></div><div><span>PO Date</span><strong>${esc(L.formatDate(e.date))}</strong></div><div><span>GST number</span><strong>${e.gst ? esc(L.mask(e.gst)) : 'No GST line'}</strong></div>`;
    $('printError').textContent = ''; $('copiesInput').value = '1';
    $('printDialog').showModal();
    $('copiesInput').focus(); $('copiesInput').select();
    fit($('pageBox'), $('pageSheet'));
    await loadPrinters();
  }
  function closePrint() { if ($('printDialog').open) $('printDialog').close(); }
  async function doPrint() {
    if (busy) return;
    const copies = Math.round(Number($('copiesInput').value));
    if (!(copies >= 1 && copies <= 99)) { $('printError').textContent = 'Copies must be between 1 and 99.'; $('copiesInput').focus(); return; }
    const e = entry();
    busy = true; $('printGo').disabled = true; $('printError').textContent = 'Printing…';
    try {
      const r = await api.print({ ...e, copies, printer: $('printerSelect').value });
      if (r.cancelled) { $('printError').textContent = 'Printing was cancelled in the Windows print dialog. Nothing was printed.'; return; }
      savedPrinter = $('printerSelect').value; history = r.history; renderPrinted();
      closePrint(); nextOne(`Printed ${copies} cop${copies === 1 ? 'y' : 'ies'} · PO Num ${e.po} · SR Num ${e.sr}. Type the next numbers.`);
    } catch (err) { $('printError').textContent = errorText(err); }
    finally { busy = false; $('printGo').disabled = false; }
  }
  async function doPdf() {
    if (busy) return;
    busy = true;
    try {
      const r = await api.savePdf(entry());
      if (r.saved) { history = r.history; renderPrinted(); closePrint(); toast(`Saved ${r.fileName}.`); $('poInput').focus(); }
    } catch (err) { $('printError').textContent = errorText(err); }
    finally { busy = false; }
  }
  // After a print the numbers change every time: PO and SR are emptied, the date and GST number stay.
  function nextOne(msg) {
    $('poInput').value = ''; $('srInput').value = ''; $('formError').textContent = '';
    renderPreview(); toast(msg); $('poInput').focus();
  }

  // ---- Printed list ----
  function renderPrinted() {
    $('printedBadge').textContent = String(history.length);
    if (!history.length) { $('printedBody').innerHTML = '<div class="empty"><strong>Nothing printed yet</strong>Every print and saved PDF is listed here.</div>'; return; }
    sel = Math.min(sel, history.length - 1);
    $('printedBody').innerHTML = `<table class="data-table csd-table"><thead><tr><th>When</th><th>PO Num</th><th>SR Num</th><th>PO Date</th><th>Copies</th><th></th></tr></thead><tbody>${history.map((h, i) => `<tr data-i="${i}" class="${i === sel ? 'sel' : ''}"><td>${esc(new Date(h.at).toLocaleString('en-IN'))}</td><td><strong>${esc(h.po)}</strong></td><td>${esc(h.sr)}</td><td>${esc(L.formatDate(h.date))}</td><td>${h.how === 'PDF' ? 'PDF' : esc(h.copies)}</td><td><button type="button" class="button secondary" data-use="${i}">Use again</button></td></tr>`).join('')}</tbody></table>`;
  }
  function useAgain(i) {
    const h = history[i]; if (!h) return;
    $('poInput').value = h.po; $('srInput').value = h.sr; if (h.date) $('dateInput').value = h.date;
    switchView('print'); renderPreview(); $('poInput').focus();
  }
  function switchView(id) {
    for (const v of document.querySelectorAll('.view')) v.classList.toggle('active', v.id === id);
    for (const b of document.querySelectorAll('.nav-button')) b.classList.toggle('active', b.dataset.view === id);
    $('pageTitle').textContent = id === 'printed' ? 'Printed' : 'Print';
    if (id === 'printed') $('printedBody').focus();
    if (id === 'print') renderPreview();
  }

  // ---- Events ----
  for (const id of ['gstInput', 'poInput', 'srInput', 'dateInput']) $(id).addEventListener('input', () => { $('formError').textContent = ''; renderPreview(); });
  $('gstInput').addEventListener('input', () => { const v = L.cleanGst($('gstInput').value); if (v !== $('gstInput').value) $('gstInput').value = v; });
  $('gstInput').addEventListener('change', async () => { const g = L.cleanGst($('gstInput').value); if (L.gstOk(g)) { try { await api.saveSettings({ gst: g }); } catch (e) { toast(errorText(e), true); } } else $('formError').textContent = 'The GST number must be 15 letters and digits, starting with the 2-digit state code.'; });
  $('dateInput').addEventListener('change', () => { if (L.formatDate($('dateInput').value)) api.saveSettings({ date: $('dateInput').value }).catch(() => {}); });
  $('gstShow').addEventListener('click', () => { const show = $('gstInput').type === 'password'; $('gstInput').type = show ? 'text' : 'password'; $('gstShow').textContent = show ? 'Hide' : 'Show'; $('gstShow').setAttribute('aria-pressed', String(show)); });
  // Enter moves to the next box; on the last box it opens the print pop-up.
  const order = ['gstInput', 'poInput', 'srInput', 'dateInput'];
  $('csdForm').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.altKey || e.ctrlKey || !order.includes(e.target.id)) return;
    e.preventDefault();
    const i = order.indexOf(e.target.id);
    if (i < order.length - 1) $(order[i + 1]).focus(); else openPrint();
  });
  $('csdForm').addEventListener('submit', (e) => { e.preventDefault(); openPrint(); });
  document.addEventListener('keydown', (e) => {
    if (e.altKey && !e.ctrlKey && (e.key === '1' || e.key === '2') && !$('printDialog').open) { e.preventDefault(); switchView(e.key === '1' ? 'print' : 'printed'); if (e.key === '1') $('poInput').focus(); return; }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); if ($('printDialog').open) doPrint(); else { switchView('print'); openPrint(); } }
  });
  $('printGo').addEventListener('click', doPrint);
  $('pdfSave').addEventListener('click', doPdf);
  for (const id of ['printCancel', 'printClose']) $(id).addEventListener('click', () => { closePrint(); $('poInput').focus(); });
  $('printDialog').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.target.closest('#printCancel,#printClose,#pdfSave,select')) { e.preventDefault(); doPrint(); }
  });
  $('printDialog').addEventListener('cancel', () => setTimeout(() => $('poInput').focus(), 0)); // Esc: back to the form, nothing printed
  $('printedBody').addEventListener('click', (e) => { const b = e.target.closest('[data-use]'); if (b) { useAgain(Number(b.dataset.use)); return; } const r = e.target.closest('tr[data-i]'); if (r) { sel = Number(r.dataset.i); renderPrinted(); } });
  $('printedBody').addEventListener('keydown', (e) => {
    if (!history.length || e.target.closest('button')) return;
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (step) { e.preventDefault(); sel = Math.max(0, Math.min(history.length - 1, sel + step)); renderPrinted(); const r = document.querySelector('#printedBody tr.sel'); if (r) r.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); useAgain(sel); }
  });
  document.querySelectorAll('.nav-button').forEach((b) => b.addEventListener('click', () => switchView(b.dataset.view)));
  window.addEventListener('resize', () => { renderPreview(); if ($('printDialog').open) fit($('pageBox'), $('pageSheet')); });

  (async () => {
    try {
      const d = await api.load();
      $('gstInput').value = d.gst || ''; $('dateInput').value = d.date || today(); savedPrinter = d.printer || ''; history = d.history || [];
      $('versionNote').textContent = d.version ? `Version ${d.version}` : '';
      $('dataNote').textContent = d.dataFile || ''; $('dataNote').title = d.dataFile || '';
    } catch (e) { $('dateInput').value = today(); toast(errorText(e), true); }
    renderPrinted(); renderPreview();
    // Courier New must be on this computer; otherwise printing is refused and this says why.
    api.fontCheck().then((r) => { const w = $('fontWarning'); w.hidden = !!r.ok; w.textContent = r.ok ? '' : r.message; }).catch(() => {});
    document.body.classList.remove('booting');
    $(L.cleanGst($('gstInput').value) ? 'poInput' : 'gstInput').focus();
  })();
})();

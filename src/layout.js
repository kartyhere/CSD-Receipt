// CSD Print: the printed page, built the same way for the preview (page) and for printing (main process).
// Layout copied from Karthik's CSD_DATE.docx: A4, 0.5" (36 pt) margins, Courier New bold, "No Spacing" (single lines, no space after).
//   Line 1  GST NO : <gst>        14 pt, first-line indent 0.5" (starts 72 pt from the page edge)
//   Line 2  PO Num: <tab><po>     11 pt, right-aligned on the right margin
//   Line 3  SR Num: <tab><sr>     11 pt, right-aligned
//   Line 4  PO Date:<date>        11 pt, right-aligned, date as 22-SEP-26
// Word's tab in these lines runs to the next 0.5" default tab stop counted from the start of the line, so the value
// starts 72 pt after the start of "PO Num: " (8 characters x 6.6 pt = 52.8 pt, then a 19.2 pt tab).
(function exposeCsdLayout(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CsdLayout = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';
  const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const CHAR = 0.6;        // Courier New: every character is 0.6 em wide (bold too)
  const TAB_STOP = 36;     // Word default tab stop: 0.5" = 36 pt
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // 2026-09-22 -> 22-SEP-26
  function formatDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return '';
    return `${m[3]}-${MONTHS[Number(m[2]) - 1]}-${m[1].slice(2)}`;
  }
  // What may be typed: letters, digits and a few separators, at most 30 characters.
  const cleanText = (v, max = 30) => String(v == null ? '' : v).replace(/[^\w\s/.-]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  const cleanGst = (v) => String(v == null ? '' : v).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
  const gstOk = (v) => v === '' || /^[0-9]{2}[A-Z0-9]{13}$/.test(v);
  const mask = (v) => (String(v || '').length > 4 ? `${v.slice(0, 2)}${'*'.repeat(v.length - 4)}${v.slice(-2)}` : String(v || ''));
  // Width of a Word default tab after `label` (in pt) at `size` pt.
  const tabWidth = (label, size) => { const w = label.length * CHAR * size; return (Math.floor(w / TAB_STOP + 1e-9) + 1) * TAB_STOP - w; };

  // The four lines as HTML (values escaped). Use inside an element with class "csd-sheet".
  function sheetHtml(d) {
    const gst = cleanGst(d && d.gst), po = cleanText(d && d.po), sr = cleanText(d && d.sr), date = formatDate(d && d.date);
    const tab = (label) => `<span class="csd-tab" style="width:${tabWidth(label, 11).toFixed(2)}pt"></span>`;
    return `<p class="csd-line csd-gst">${gst ? `GST NO : ${esc(gst)}` : ''}</p>`
      + `<p class="csd-line csd-r">PO Num: ${tab('PO Num: ')}${esc(po)}</p>`
      + `<p class="csd-line csd-r">SR Num: ${tab('SR Num: ')}${esc(sr)}</p>`
      + `<p class="csd-line csd-r">PO Date:${esc(date)}</p>`;
  }
  // A whole page for printing: no scripts, only the sheet styles.
  function pageHtml(d, css) {
    return `<!doctype html><html><head><meta charset="utf-8"><title>CSD print</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#fff}${css}</style></head><body><div class="csd-sheet">${sheetHtml(d)}</div></body></html>`;
  }
  return { MONTHS, formatDate, cleanText, cleanGst, gstOk, mask, tabWidth, sheetHtml, pageHtml };
}));

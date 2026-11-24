'use strict';
// The fonts Chromium really used on a page, read from the PDF it makes (e.g. "CourierNewPS-BoldMT").
// A missing font is replaced silently by another one, so the page is checked before every print and PDF.
function pdfFonts(pdf) {
  const names = new Set();
  for (const m of Buffer.from(pdf).toString('latin1').matchAll(/\/BaseFont\s*\/([A-Za-z0-9+_.-]+)/g)) names.add(m[1].replace(/^[A-Z]{6}\+/, ''));
  return [...names];
}
// Every font on the page must be the wanted one, in bold.
function fontOk(pdf, wanted = 'CourierNew') {
  const fonts = pdfFonts(pdf);
  return fonts.length > 0 && fonts.every((f) => f.replace(/[^A-Za-z]/g, '').toLowerCase().includes(String(wanted).toLowerCase()) && /bold/i.test(f));
}
module.exports = { pdfFonts, fontOk };

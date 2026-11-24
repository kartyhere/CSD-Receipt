#!/usr/bin/env node
// Privacy guard (see CLAUDE.md): looks for Indian regulatory identifiers in the project before a zip or a push.
// It finds GSTIN, PAN, TAN, Aadhaar and the banned sample name in code, tests, notes and spreadsheet fixtures.
// What it finds is printed MASKED (never in full), so running it does not copy the number anywhere.
//   node scripts/privacy-scan.cjs            exit code 1 if anything is found
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'out', 'vendor', 'fonts', 'dist', 'build']);
const TEXT = /\.(cjs|mjs|js|json|html|css|md|txt|csv|tsv|py|yml|yaml)$/i;
const SHEET = /\.(xlsx|xlsm|xls|ods)$/i;
const SELF = path.join(__dirname, 'privacy-scan.cjs');

// Verhoeff check, so a random 12-digit number is not called an Aadhaar number.
const D = [[0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],[3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],[6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],[9,8,7,6,5,4,3,2,1,0]];
const P = [[0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],[8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],[2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8]];
const verhoeff = (s) => { let c = 0; [...s].reverse().forEach((ch, i) => { c = D[c][P[i % 8][Number(ch)]]; }); return c === 0; };

// PAN 4th letter is the holder type (P person, C company, F firm, H HUF, A AOP, T trust, B BOI, L local authority, J juridical, G government).
const RULES = [
  { kind: 'GSTIN', re: /\b\d{2}[A-Z]{3}[PCHFATBLJG][A-Z]\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g },
  { kind: 'PAN', re: /\b[A-Z]{3}[PCHFATBLJG][A-Z]\d{4}[A-Z]\b/g },
  { kind: 'TAN', re: /\b[A-Z]{4}\d{5}[A-Z]\b/g },
  { kind: 'Aadhaar', re: /\b[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b/g, check: (m) => verhoeff(m.replace(/\D/g, '')) },
  { kind: 'banned sample name', re: /THRISSUR-SRV/gi },
];
// Made-up test values are allowed when they are obviously fake: a 0000 digit block (32ZZZPZ0000Z1Z0, ZZZPZ0000Z) or one repeated digit.
const dummy = (m) => /0000/.test(m) || /^(\d)\1+$/.test(m.replace(/\D/g, ''));
const mask = (s) => s.length <= 4 ? '****' : s.slice(0, 2) + '*'.repeat(Math.max(0, s.length - 4)) + s.slice(-2);

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) yield* walk(p); }
    else if (p !== SELF) yield p;
  }
}
function textOf(file) {
  if (TEXT.test(file)) return fs.readFileSync(file, 'utf8');
  if (SHEET.test(file)) {
    try {
      const XLSX = require(path.join(root, 'node_modules', 'xlsx'));
      const wb = XLSX.read(fs.readFileSync(file), { type: 'buffer' });
      return wb.SheetNames.map((n) => XLSX.utils.sheet_to_csv(wb.Sheets[n])).join('\n');
    } catch { return `__UNREADABLE_SHEET__`; }
  }
  return null;
}
const hits = [];
for (const file of walk(root)) {
  const text = textOf(file); if (text == null) continue;
  const rel = path.relative(root, file);
  if (text === '__UNREADABLE_SHEET__') { hits.push(`${rel}: spreadsheet could not be read, check it by hand`); continue; }
  text.split(/\r?\n/).forEach((line, i) => {
    for (const r of RULES) for (const m of line.matchAll(r.re)) {
      if ((r.check && !r.check(m[0])) || (r.kind !== 'banned sample name' && dummy(m[0]))) continue;
      hits.push(`${rel}:${i + 1}: possible ${r.kind} ${mask(m[0])}`);
    }
  });
}
if (hits.length) { console.error(`Privacy scan: ${hits.length} possible identifier(s) found. Replace them with made-up values or remove them.\n` + hits.join('\n')); process.exit(1); }
console.log('Privacy scan: no GSTIN, PAN, TAN, Aadhaar or banned sample names found.');

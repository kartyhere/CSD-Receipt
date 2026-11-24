# CSD Receipt: instructions for Claude

Owner: Karthik (works in IST). A small Windows Electron app that prints the GST number, PO Num, SR Num and PO Date on the CSD page. It was split out of Business Operations Hub (repo `kartyhere/BOH`, project 12 CSD Print) and is now separate: changes here do not go to BOH and the other way round, unless Karthik asks.

Read `README.md` first (how it works, the page layout, build and test) and `CHANGES.md` (newest first).

## Privacy
- The GST number, PAN, TAN, Aadhaar, bank account and phone numbers are private. Never write a real one in code, tests, notes, commit messages or file names; mask it if it must be referred to (`32***********Z0`). Test values must be obviously fake (`32ZZZPZ0000Z1Z0`).
- If Karthik uploads a file, copy it outside the project, use it only to diagnose, then delete the copy and the upload and tell him.
- `npm run privacy` must pass before every zip and push.

## The page is fixed
- Layout in `src/layout.js` and `src/sheet.css`, copied from `CSD_DATE.docx`: A4, 36 pt margins, Courier New bold, 14 pt GST line with a 36 pt first-line indent, 11 pt right-aligned lines, Word default tab 19.2 pt, line height 1.1328 em, date `DD-MON-YY`.
- Do not change sizes or positions without printing a PDF and measuring it (pdfplumber) against the layout above.
- It must print in Courier New Bold. `src/fonts.cjs` reads the fonts back from a PDF before every print. This Linux machine has no Courier New, so the window test stands in Liberation Mono through `CSDRECEIPT_TEST_FONT` / `CSDRECEIPT_TEST_FONT_PS`. Never add a fallback font to `sheet.css`.

## Release steps (every change)
1. Bump the patch version in `package.json`.
2. Prepend `# 1.0.x — title` with bullet points at the top of `CHANGES.md`.
3. `npm run privacy`
4. `npm test`
5. `CSD_OUT=/tmp/csdr xvfb-run -a node_modules/.bin/electron --no-sandbox --disable-gpu test/app-electron-smoke.cjs` must print PASS.
6. Zip: `cd /home/claude/csd-receipt && zip -qr ../CSD-Receipt-<ver>-Source.zip . -x "node_modules/*" -x ".git/*" -x "dist/*"` and send it.
7. Report briefly: what changed, interpretations, what was run versus not checked (real printer, packaged Windows app).
8. Ask before pushing ("Push to main" / "Not yet"). A push builds the Windows .exe on GitHub Actions.

## Conventions
- Strict CSP: no inline scripts or event handlers; escape every value shown in HTML.
- Keyboard first: Enter moves through the form, Ctrl+P prints, Esc closes the pop-up, Alt+1 / Alt+2 switch sections.
- Plain, short UI wording.

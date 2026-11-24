# CSD Receipt

A small Windows app that prints the GST number, PO number, SR number and PO date on the CSD page, one after another. It was taken out of Business Operations Hub (project 12, CSD Print) to run on its own: no sign-in, one window.

## Using it

1. Type the GST number once. It is hidden on screen (Show / Hide) and remembered on this computer. Leave it empty for no GST line.
2. Type **PO Num**, Enter, **SR Num**, Enter, and check **PO Date**. It prints as `22-SEP-26`.
3. Enter on the date, or **Ctrl+P**, opens the print preview. It shows the whole A4 page as it will print, with **Copies** and **Printer** (the last one used, else the Windows default). **Enter** prints, **Esc** goes back, and **Save PDF** writes the same page.
4. After printing, PO Num and SR Num are emptied and the cursor is back in PO Num. The date and GST number stay.
5. **Printed** (Alt+2) lists every print. Up / Down and Enter put the numbers back in the form.

## The page

Copied from `CSD_DATE.docx` and checked by measuring a printed PDF against the document. Every character is within 0.4 pt.

| | |
|---|---|
| Paper | A4, margins 0.5" (36 pt) on all sides |
| Font | Courier New, bold, single line spacing, no space after (Word "No Spacing") |
| Line 1 | `GST NO : <number>`, 14 pt, starts 0.5" in from the left margin |
| Lines 2–4 | `PO Num: <tab><number>`, `SR Num: <tab><number>`, `PO Date:<date>`, 11 pt, ending on the right margin. The tab is Word's 0.5" default stop: 19.2 pt after the 8-character label. |

The page must print in **Courier New Bold**. Before every print and PDF, the app makes the page into a PDF in memory and reads back the fonts in it. If they are not Courier New Bold, it prints nothing and says Courier New is missing. Courier New comes with Windows and is not bundled; Microsoft does not allow it to be copied.

Layout code: `src/layout.js` (the four lines, date format, tab width) and `src/sheet.css` (sizes in points). Do not change sizes or positions without measuring a printed PDF.

## Where things are kept

`%APPDATA%\CSD Receipt\csd-receipt.dat` holds the GST number, last PO date, last printer and the Printed list. It is sealed with Windows' own protection (Electron safeStorage). The GST number is never written to the Printed list or into the PDF's file details. Nothing is sent anywhere: the app blocks every web request, permission, download and new window.

## Build and test

```
npm ci
npm test                       # layout, date, tab and font-check unit tests
npm run privacy                # fails if a GSTIN, PAN, TAN or Aadhaar number is in the project
xvfb-run -a node_modules/.bin/electron --no-sandbox --disable-gpu test/app-electron-smoke.cjs   # whole flow, prints to PDF
npm start                      # run from source
```

A push to `main` makes GitHub Actions build `CSD-Receipt-<version>-portable.exe` (Actions › latest run › Artifacts). A tag `v*` also attaches it to a release.

The window test runs on Linux, which has no Courier New. It stands in Liberation Mono (same letter widths) through `CSDRECEIPT_TEST_FONT` / `CSDRECEIPT_TEST_FONT_PS`, and writes PDFs instead of printing through `CSDRECEIPT_TEST_PDF_DIR`. These settings are ignored in the packaged app.

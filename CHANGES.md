# 1.0.3 — Fix: "This window is not allowed to do that"

- Karthik's 1.0.1 .exe showed "This window is not allowed to do that." when printing. The app checks that every request comes from its own page. 1.0.0–1.0.2 compared the page address as text with an address built by the app. The portable .exe runs from the Windows temp folder, and there the two can be written differently (short names like `KARTHI~1`, letter case, escaping). Every request was then refused: printing, and also reading the printer list. So the earlier "No printer found" most likely had the same cause.
- The page is now recognised by its file path, the way BOH does it (`src/pages.cjs`, used for requests and for navigation). The window and frame checks are unchanged.
- If the printer list cannot be read, the pop-up now shows the real reason instead of only "Windows did not list any printer".
- Checked by running: unit tests with Windows-style addresses (short name, other letter case, escaped `~`, spaces and brackets; and outside or wrong pages refused), and the whole window test run from folders named with spaces, brackets, `#`, `ü` and `KARTHI~1`. Not checked: the .exe on Karthik's PC.
- Found while testing: on this Linux test machine, Electron cannot load the app's bridge from a folder with non-English letters unless the system language is UTF-8. Windows is always fine here; the tests now set `LANG=C.UTF-8`.

# 1.0.2 — BOH look, and a smaller .exe

- Look copied from Business Operations Hub (DESIGN-LANGUAGE.txt), as Karthik asked. The window now uses BOH's shared project stylesheets unchanged: `shell.css` (BOH `servicepay/styles.css`), `uniform-green-theme.css`, `suite-motion.css`, `suite-icons.css`, `suite-polish.css`, `appearance.js` and the bundled fonts (Archivo, Inter, Geist Mono).
  - The result matches CSD Print as it looked in BOH: sidebar with numbered sections, title card, bordered panels, mono labels and an inverted active section.
  - Dark is the default, and a sun / moon switch sits in the title bar. The choice is remembered.
  - `styles.css` holds only what is specific to CSD Receipt. `DESIGN-LANGUAGE.txt` is BOH's design note, with a header saying the copied files are not edited here.
- The printed page is unchanged: it uses only `sheet.css`.
- Size: Karthik asked whether the app really takes 81 MB of code. It does not. CSD Receipt's own code is 43 KB (about 0.05 % of the .exe). The rest is Electron (Chromium and Node), which every Electron app carries.
  - Electron includes 55 language packs (44 MB uncompressed) for its built-in menus and messages. The app now keeps only English (`electronLanguages: ["en-US"]`). The unpacked app shrinks from 284 MB to 241 MB, and the .exe should be roughly 10 MB smaller.
- Checked by running: unit tests, the window test (same flow and same PDF), and a Linux test package (only en-US.pak left). Not checked: the new .exe size (the GitHub build will show it) and the look on Windows.

# 1.0.1 — Printer list fix: Windows print dialog when no printer is found

- Karthik saw "No printer found" in the print pop-up, although BOH's Invoice Clearing prints fine. Invoice Clearing opens the Windows print dialog and never asks Electron for the printer list; CSD Receipt did ask, and on his PC Electron's list came back empty.
- If Electron's list is empty, the app now asks Windows directly (`Get-CimInstance Win32_Printer`, no window shown, 10 s limit).
- The Printer list always ends with **Windows print dialog…**. It is chosen automatically when no printer is found, with a note saying why. Print then opens the normal Windows dialog with the copies filled in; the printer is chosen there, as in Invoice Clearing. The choice is remembered like a printer.
- Cancelling the Windows dialog prints nothing, records nothing and keeps the numbers in the form. If a named printer refuses the page, the message suggests choosing Windows print dialog….
- Checked by running: unit tests and the window test, which now runs with an empty printer list (as on Karthik's PC) and checks that the Windows print dialog is offered and used. Not checked: the Windows dialog itself and a real printer (this machine has neither).

# 1.0.0 — CSD Receipt on its own

- Taken out of Business Operations Hub 1.0.190 (project 12, CSD Print) as a standalone Windows app with its own repository.
- Same page, layout and Courier New check as CSD Print. Character positions in the printed PDF are identical.
- No sign-in and no Hub: one window that opens maximised on the form. Alt+1 / Alt+2 switch between Print and Printed.
- Settings and the Printed list are in `%APPDATA%\CSD Receipt\csd-receipt.dat`, sealed with Electron safeStorage. Nothing is carried over from BOH; the GST number is typed once again.
- Security: messages are taken only from the app's own page in its own window. The printed page has no scripts. Web requests, permissions, downloads, new windows and navigation are blocked.
- Own icon (a receipt on dark green), own tests (`test/layout.test.cjs`, `test/app-electron-smoke.cjs`), privacy scan, and a GitHub Actions workflow that builds `CSD-Receipt-<version>-portable.exe`.

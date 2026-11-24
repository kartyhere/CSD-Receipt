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

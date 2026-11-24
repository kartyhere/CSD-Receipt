# 1.0.0 — CSD Receipt on its own

- Taken out of Business Operations Hub 1.0.190 (project 12, CSD Print) as a standalone Windows app with its own repository.
- Same page, layout and Courier New check as CSD Print. Character positions in the printed PDF are identical.
- No sign-in and no Hub: one window that opens maximised on the form. Alt+1 / Alt+2 switch between Print and Printed.
- Settings and the Printed list are in `%APPDATA%\CSD Receipt\csd-receipt.dat`, sealed with Electron safeStorage. Nothing is carried over from BOH; the GST number is typed once again.
- Security: messages are taken only from the app's own page in its own window. The printed page has no scripts. Web requests, permissions, downloads, new windows and navigation are blocked.
- Own icon (a receipt on dark green), own tests (`test/layout.test.cjs`, `test/app-electron-smoke.cjs`), privacy scan, and a GitHub Actions workflow that builds `CSD-Receipt-<version>-portable.exe`.

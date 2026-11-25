'use strict';
// Which file a page address points to, relative to `root` (the same check BOH uses), or '' if it is outside it.
// File paths are compared, not the address text: on Windows the portable .exe runs from the temp folder, whose address
// can be written differently (letter case, escaping, short names) from one built by the app.
const nodePath = require('node:path');
const { fileURLToPath } = require('node:url');

function pageOf(url, root, path = nodePath) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'file:' || u.search || u.hash) return '';
    const rel = path.relative(root, fileURLToPath(u, { windows: path === nodePath.win32 }));
    if (!rel || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return '';
    return rel.split(path.sep).join('/');
  } catch { return ''; }
}
module.exports = { pageOf };

// تشغيل: node tools/make-sri.mjs  — يولّد data/sri.json (بصمات SRI لسكربتات CDN). آمن: عند أي فشل لا يتغير شيء.
import path from 'path'; import { fileURLToPath } from 'url'; import { createRequire } from 'module';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const sri = require(path.join(root, 'lib/sri.js'))({ DATA_DIR: path.join(root, 'data'), PUBLIC: path.join(root, 'public') });
try { const r = await sri.generate(); for (const x of r.report) console.log(x.ok ? 'OK  ' : 'FAIL', x.url, x.ok ? '→ ' + x.pinned : x.error); console.log('saved', r.saved); }
catch (e) { console.log('SRI skipped:', e.message); }
process.exit(0);

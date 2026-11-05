/* نسخ احتياطي لملفات البيانات (JSON + الترجمات + admin.json). الفيديوهات لا تُنسخ (حجمها كبير) ما لم يُطلب INCLUDE_UPLOADS_IN_BACKUP=true */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

function make({ ROOT, DATA_DIR, UPLOADS, dir = path.join(ROOT, 'backups') }) {
  fs.mkdirSync(dir, { recursive: true });
  const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safe = n => /^backup-[\dT-]+\.tar\.gz$/.test(n) ? path.join(dir, n) : null;

  function create() {
    return new Promise((resolve, reject) => {
      const name = `backup-${stamp()}.tar.gz`;
      const out = path.join(dir, name);
      const items = ['data'];
      if (fs.existsSync(path.join(ROOT, 'admin.json'))) items.push('admin.json');
      if (process.env.INCLUDE_UPLOADS_IN_BACKUP === 'true' && fs.existsSync(UPLOADS)) items.push('uploads');
      const args = ['-czf', out, '-C', ROOT];
      if (process.env.INCLUDE_UPLOADS_IN_BACKUP !== 'true') args.push('--exclude=data/private');
      args.push(...items);
      execFile('tar', args, { timeout: 10 * 60 * 1000 }, err => {
        if (err) { try { fs.unlinkSync(out); } catch {} return reject(err); }
        prune(); resolve({ name, size: fs.statSync(out).size, createdAt: new Date().toISOString() });
      });
    });
  }
  function list() {
    return fs.readdirSync(dir).filter(n => safe(n)).map(n => { const st = fs.statSync(path.join(dir, n)); return { name: n, size: st.size, createdAt: st.mtime.toISOString() }; })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  function prune() {
    const keep = Math.max(1, Number(process.env.BACKUP_KEEP || 7));
    for (const b of list().slice(keep)) { try { fs.unlinkSync(path.join(dir, b.name)); } catch {} }
  }
  function remove(name) { const f = safe(name); if (!f || !fs.existsSync(f)) return false; fs.unlinkSync(f); return true; }
  function schedule() {
    const hours = Number(process.env.BACKUP_EVERY_HOURS || 24);
    if (!hours || hours <= 0) return;
    const tick = () => create().catch(e => console.error('[backup]', e.message));
    const last = list()[0];
    if (!last || Date.now() - Date.parse(last.createdAt) > hours * 3600e3) setTimeout(tick, 15000);
    setInterval(() => { const l = list()[0]; if (!l || Date.now() - Date.parse(l.createdAt) >= hours * 3600e3 - 60e3) tick(); }, 30 * 60 * 1000).unref();
  }
  return { create, list, remove, schedule, path: n => safe(n), dir };
}
module.exports = { make };

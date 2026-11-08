'use strict';
/* v20 — هوية التطبيق (PWA): الاسم والأيقونة قابلان للتخصيص من لوحة الأدمن.
   - لا يحذف/يعدّل أي بيانات موجودة؛ يخزّن في data/app-brand.json و data/app-icon/icon.png فقط.
   - الأيقونة المرفوعة: PNG مربّعة 512–2048px ≤ 2MB، تُتحقَّق من بنيتها (توقيع PNG + IHDR). */
const fs = require('fs'), path = require('path');
module.exports = function ({ app, requireAdmin, sameOrigin, readJSON, writeJSONAtomic, DATA_DIR, PUBLIC }) {
  const FILE = path.join(DATA_DIR, 'app-brand.json'), DIR = path.join(DATA_DIR, 'app-icon'), ICON = path.join(DIR, 'icon.png');
  const MAXB = 2 * 1024 * 1024;
  const DEF = { name: 'Cineo — Osama Cinema', shortName: 'Cineo', themeColor: '#1b1646', backgroundColor: '#0a0a1f', maskableSafe: false, iconVersion: 0 };
  const col = (v, d) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : d);
  const txt = (v, d, n) => { if (typeof v !== 'string') return d; const t = v.replace(/[\u0000-\u001f<>"`]/g, '').trim().slice(0, n); return t || d; };
  const get = () => { const f = readJSON(FILE, {}) || {}; return { name: txt(f.name, DEF.name, 40), shortName: txt(f.shortName, DEF.shortName, 12), themeColor: col(f.themeColor, DEF.themeColor), backgroundColor: col(f.backgroundColor, DEF.backgroundColor), maskableSafe: f.maskableSafe === true, iconVersion: Number(f.iconVersion) || 0 }; };
  const hasIcon = () => { try { return fs.statSync(ICON).isFile(); } catch { return false; } };
  const pngInfo = b => { if (b.length < 33 || b.readUInt32BE(0) !== 0x89504e47 || b.readUInt32BE(4) !== 0x0d0a1a0a || b.toString('ascii', 12, 16) !== 'IHDR') return null; return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };
  // المانيفست الديناميكي (قبل express.static)
  app.get('/manifest.webmanifest', (req, res) => {
    let base = {}; try { base = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'manifest.webmanifest'), 'utf8')); } catch {}
    const b = get(), v = b.iconVersion ? '?v=' + b.iconVersion : '', custom = hasIcon();
    base.name = b.name; base.short_name = b.shortName; base.theme_color = b.themeColor; base.background_color = b.backgroundColor;
    if (custom) {
      base.icons = [{ src: '/app-icon/192.png' + v, sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: '/app-icon/512.png' + v, sizes: '512x512', type: 'image/png', purpose: 'any' }];
      if (b.maskableSafe) base.icons.push({ src: '/app-icon/512.png' + v, sizes: '512x512', type: 'image/png', purpose: 'maskable' });
      (base.shortcuts || []).forEach(s => { s.icons = [{ src: '/app-icon/192.png' + v, sizes: '192x192' }]; });
    }
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8'); res.setHeader('Cache-Control', 'no-cache'); res.end(JSON.stringify(base));
  });
  // الأيقونة (المخصّصة إن وُجدت وإلا الافتراضية)
  const DEFMAP = { '192.png': 'icon-192.png', '180.png': 'icon-180.png', '512.png': 'icon-512.png' };
  app.get('/app-icon/:n', (req, res) => {
    const n = String(req.params.n); if (!DEFMAP[n]) return res.status(404).end();
    res.setHeader('Cache-Control', 'public, max-age=3600'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Content-Type', 'image/png');
    res.sendFile(hasIcon() ? ICON : path.join(PUBLIC, 'icons', DEFMAP[n]));
  });
  app.get('/api/admin/app-brand', requireAdmin, (req, res) => res.json({ ...get(), customIcon: hasIcon(), defaults: DEF }));
  app.put('/api/admin/app-brand', sameOrigin, requireAdmin, (req, res) => {
    const c = get(), b = req.body || {};
    const n = { ...c, name: txt(b.name, c.name, 40), shortName: txt(b.shortName, c.shortName, 12), themeColor: col(b.themeColor, c.themeColor), backgroundColor: col(b.backgroundColor, c.backgroundColor), maskableSafe: typeof b.maskableSafe === 'boolean' ? b.maskableSafe : c.maskableSafe };
    writeJSONAtomic(FILE, n); res.json({ ...n, customIcon: hasIcon() });
  });
  app.post('/api/admin/app-brand/icon', sameOrigin, requireAdmin, (req, res) => {
    const ct = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (ct !== 'image/png') return res.status(415).json({ error: 'الصيغة المقبولة: PNG فقط' });
    const parts = []; let size = 0, dead = false;
    req.on('data', d => { if (dead) return; size += d.length; if (size > MAXB) { dead = true; res.status(413).json({ error: 'الحجم الأقصى 2MB' }); req.destroy && req.destroy(); } else parts.push(d); });
    req.on('error', () => {});
    req.on('end', () => {
      if (dead) return; const buf = Buffer.concat(parts), i = pngInfo(buf);
      if (!i) return res.status(400).json({ error: 'الملف ليس PNG صالحاً' });
      if (i.w !== i.h) return res.status(400).json({ error: 'يجب أن تكون الصورة مربّعة (عرض = ارتفاع)' });
      if (i.w < 512 || i.w > 2048) return res.status(400).json({ error: 'المقاس المقبول بين 512 و2048 بكسل' });
      fs.mkdirSync(DIR, { recursive: true }); const tmp = ICON + '.tmp'; fs.writeFileSync(tmp, buf, { mode: 0o600 }); fs.renameSync(tmp, ICON);
      const c = get(); c.iconVersion = Date.now(); writeJSONAtomic(FILE, c); res.json({ ok: true, customIcon: true, size: i.w, iconVersion: c.iconVersion });
    });
  });
  app.delete('/api/admin/app-brand/icon', sameOrigin, requireAdmin, (req, res) => {
    try { fs.unlinkSync(ICON); } catch {} const c = get(); c.iconVersion = Date.now(); writeJSONAtomic(FILE, c); res.json({ ok: true, customIcon: false });
  });
};

/* lib/music.js — v22: قسم الموسيقى. إضافة فقط (لا يلمس الأفلام ولا Shorts ولا الحسابات).
   • الأدمن يرفع/ينشر/يخفي/يحذف المقاطع؛ الزائر يستمع ويحمّل (إن سمح الأدمن لكل مقطع).
   • الملفات تُخزَّن في data/private/music وتُقدَّم عبر مسارات تتحقق من حالة النشر (المسودّات لا تظهر لغير الأدمن).
   • التحقق من نوع الملف بالبصمة (magic bytes) لا بالاسم أو الـ MIME فقط. */
'use strict';
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const multer = require('multer');
module.exports = function (c) {
  const { app, readJSON, writeJSONAtomic, requireAdmin, sameOrigin, hit, cleanLine, DATA_DIR, PRIVATE_DIR } = c;
  const FILE = path.join(DATA_DIR, 'music.json'), DIR = path.join(PRIVATE_DIR, 'music');
  fs.mkdirSync(DIR, { recursive: true });
  const MAXMB = Math.max(1, Math.min(500, Number(process.env.MUSIC_MAX_MB) || 100)), MAXTRACKS = 1000;
  const all = () => { const d = readJSON(FILE, []); return Array.isArray(d) ? d : []; };
  const save = l => writeJSONAtomic(FILE, l);
  const ID = /^[a-f0-9]{16}$/;
  const MIME = { mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg', wav: 'audio/wav', flac: 'audio/flac' };
  const unlink = f => { try { f && fs.unlinkSync(path.join(DIR, path.basename(f))); } catch {} };

  function sniffAudio(f) {
    try {
      const fd = fs.openSync(f, 'r'), b = Buffer.alloc(16); fs.readSync(fd, b, 0, 16, 0); fs.closeSync(fd);
      if (b.toString('latin1', 0, 3) === 'ID3' || (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0)) return 'mp3';
      if (b.toString('latin1', 4, 8) === 'ftyp') return 'm4a';
      if (b.toString('latin1', 0, 4) === 'OggS') return 'ogg';
      if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WAVE') return 'wav';
      if (b.toString('latin1', 0, 4) === 'fLaC') return 'flac';
    } catch {} return null;
  }
  function sniffImg(f) {
    try {
      const fd = fs.openSync(f, 'r'), b = Buffer.alloc(16); fs.readSync(fd, b, 0, 16, 0); fs.closeSync(fd);
      if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpg';
      if (b[0] === 0x89 && b.toString('latin1', 1, 4) === 'PNG') return 'png';
      if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp';
    } catch {} return null;
  }
  const up = multer({
    storage: multer.diskStorage({ destination: (q, f, cb) => cb(null, DIR), filename: (q, f, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.tmp`) }),
    limits: { fileSize: MAXMB * 1024 * 1024, files: 2 },
    fileFilter: (q, f, cb) => { const ok = (f.fieldname === 'audio' && /^(audio\/|video\/mp4|application\/ogg|application\/octet-stream)/.test(f.mimetype)) || (f.fieldname === 'cover' && /^image\/(jpeg|png|webp)$/.test(f.mimetype)); cb(ok ? null : new Error('نوع الملف غير مسموح'), ok); }
  }).fields([{ name: 'audio', maxCount: 1 }, { name: 'cover', maxCount: 1 }]);

  const pub = t => ({ id: t.id, title: t.title, artist: t.artist, album: t.album, genre: t.genre, duration: t.duration || 0, hasCover: !!t.cover, allowDownload: !!t.allowDownload, plays: t.plays || 0, createdAt: t.createdAt });
  const adm = t => ({ ...pub(t), published: !!t.published, downloads: t.downloads || 0, size: t.size || 0, format: t.format });
  const bool = v => v === true || v === 'true' || v === '1' || v === 'on';
  const dl = (s, ext) => (String(s).replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 80) || 'track') + '.' + ext;

  /* ---- عام ---- */
  app.get('/api/music', (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.json(all().filter(t => t.published).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map(pub)); });
  const find = (req, onlyPub) => { const t = ID.test(req.params.id) && all().find(x => x.id === req.params.id); return t && (!onlyPub || t.published) ? t : null; };
  app.get('/api/music/:id/file', (req, res) => {
    const t = find(req, true); if (!t) return res.status(404).json({ error: 'غير موجود.' });
    res.setHeader('Cache-Control', 'public, max-age=3600'); res.type(MIME[t.format] || 'application/octet-stream'); res.sendFile(path.join(DIR, path.basename(t.file)));
  });
  app.get('/api/music/:id/cover', (req, res) => {
    const t = find(req, true); if (!t || !t.cover) return res.status(404).end();
    res.setHeader('Cache-Control', 'public, max-age=86400'); res.sendFile(path.join(DIR, path.basename(t.cover)));
  });
  app.get('/api/music/:id/download', (req, res) => {
    if (hit(`mdl:${req.ip}`, 60, 10 * 60 * 1000)) return res.status(429).json({ error: 'محاولات كثيرة، حاول بعد قليل.' });
    const list = all(), t = list.find(x => ID.test(req.params.id) && x.id === req.params.id && x.published);
    if (!t) return res.status(404).json({ error: 'غير موجود.' });
    if (!t.allowDownload) return res.status(403).json({ error: 'التحميل غير متاح لهذا المقطع.' });
    t.downloads = (t.downloads || 0) + 1; save(list);
    res.download(path.join(DIR, path.basename(t.file)), dl((t.artist ? t.artist + ' - ' : '') + t.title, t.format));
  });
  app.post('/api/music/:id/play', sameOrigin, (req, res) => {
    if (hit(`mpl:${req.ip}:${req.params.id}`, 3, 10 * 60 * 1000)) return res.json({ ok: true });
    const list = all(), t = list.find(x => ID.test(req.params.id) && x.id === req.params.id && x.published);
    if (!t) return res.status(404).json({ error: 'غير موجود.' });
    t.plays = (t.plays || 0) + 1; save(list); res.json({ plays: t.plays });
  });

  /* ---- أدمن ---- */
  app.get('/api/admin/music', requireAdmin, (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.json({ maxMB: MAXMB, tracks: all().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map(adm) }); });
  app.get('/api/admin/music/:id/file', requireAdmin, (req, res) => { const t = find(req, false); if (!t) return res.status(404).end(); res.setHeader('Cache-Control', 'private, no-store'); res.type(MIME[t.format] || 'application/octet-stream'); res.sendFile(path.join(DIR, path.basename(t.file))); });
  app.post('/api/admin/music', sameOrigin, requireAdmin, (req, res) => {
    up(req, res, err => {
      const fa = ((req.files || {}).audio || [])[0], fc = ((req.files || {}).cover || [])[0];
      const cleanup = () => { for (const f of [fa, fc]) if (f) { try { fs.unlinkSync(f.path); } catch {} } };
      if (err) { cleanup(); return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? `الملف أكبر من ${MAXMB}MB.` : (err.message || 'تعذر الرفع.') }); }
      if (!fa) { cleanup(); return res.status(400).json({ error: 'اختر ملفاً صوتياً.' }); }
      const b = req.body || {}, title = cleanLine(b.title, 120);
      if (!title) { cleanup(); return res.status(400).json({ error: 'عنوان المقطع مطلوب.' }); }
      const fmt = sniffAudio(fa.path); if (!fmt) { cleanup(); return res.status(400).json({ error: 'الملف ليس صوتاً صالحاً (mp3 / m4a / ogg / wav / flac).' }); }
      const list = all(); if (list.length >= MAXTRACKS) { cleanup(); return res.status(400).json({ error: 'وصلت إلى الحد الأقصى من المقاطع.' }); }
      const id = crypto.randomBytes(8).toString('hex'), file = `${id}.${fmt}`; let cover = '';
      try {
        fs.renameSync(fa.path, path.join(DIR, file));
        if (fc) { const ci = fc.size <= 3 * 1024 * 1024 && sniffImg(fc.path); if (ci) { cover = `${id}-cover.${ci}`; fs.renameSync(fc.path, path.join(DIR, cover)); } else fs.unlinkSync(fc.path); }
      } catch { cleanup(); return res.status(500).json({ error: 'تعذر حفظ الملف.' }); }
      const dur = Number(b.duration); const t = { id, title, artist: cleanLine(b.artist, 80), album: cleanLine(b.album, 80), genre: cleanLine(b.genre, 40), file, format: fmt, cover, size: fa.size, duration: dur > 0 && dur < 86400 ? Math.round(dur) : 0, allowDownload: bool(b.allowDownload), published: b.published === undefined ? true : bool(b.published), plays: 0, downloads: 0, createdAt: new Date().toISOString() };
      list.push(t); save(list); res.status(201).json(adm(t));
    });
  });
  app.patch('/api/admin/music/:id', sameOrigin, requireAdmin, (req, res) => {
    const list = all(), t = ID.test(req.params.id) && list.find(x => x.id === req.params.id); if (!t) return res.status(404).json({ error: 'غير موجود.' });
    const b = req.body || {};
    if (b.title !== undefined) { const v = cleanLine(b.title, 120); if (!v) return res.status(400).json({ error: 'العنوان مطلوب.' }); t.title = v; }
    for (const [k, n] of [['artist', 80], ['album', 80], ['genre', 40]]) if (b[k] !== undefined) t[k] = cleanLine(b[k], n);
    if (b.published !== undefined) t.published = bool(b.published);
    if (b.allowDownload !== undefined) t.allowDownload = bool(b.allowDownload);
    save(list); res.json(adm(t));
  });
  app.delete('/api/admin/music/:id', sameOrigin, requireAdmin, (req, res) => {
    const list = all(), i = ID.test(req.params.id) ? list.findIndex(x => x.id === req.params.id) : -1; if (i < 0) return res.status(404).json({ error: 'غير موجود.' });
    const [t] = list.splice(i, 1); save(list); unlink(t.file); unlink(t.cover); res.json({ success: true });
  });
};

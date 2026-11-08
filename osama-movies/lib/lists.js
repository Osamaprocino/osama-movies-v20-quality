/* lib/lists.js — v20.2: قوائم مشاركة بالرابط. إضافة فقط: لا تلمس المكتبة ولا قوائم التشغيل الموجودة.
   • المستخدم ينشئ رابطاً لنسخة من قائمة (أسماء أفلام فقط) — يمكنه إلغاؤه في أي وقت.
   • الرابط العام يعرض الأفلام المنشورة فقط (بلا مدفوع مفتوح/مجدول/معلّق)، ولا يكشف بريداً ولا رمز جلسة. */
'use strict';
const path = require('path'), crypto = require('crypto');
module.exports = function (c) {
  const { app, ext, readJSON, writeJSONAtomic, requireUser, sameOrigin, hit, getMovies, getUsers, publicMovie, cleanLine, DATA_DIR } = c;
  const FILE = path.join(DATA_DIR, 'shared-lists.json');
  const get = () => { const d = readJSON(FILE, {}); return d && typeof d === 'object' && !Array.isArray(d) ? d : {}; };
  const TOK = /^[a-f0-9]{20}$/;
  app.post('/api/user/shares', sameOrigin, requireUser, (req, res) => {
    if (hit(`shr:${req.user.id}`, 20, 10 * 60 * 1000)) return res.status(429).json({ error: 'محاولات كثيرة، حاول بعد قليل.' });
    const b = req.body || {}; const name = cleanLine(b.name, 60);
    if (!name) return res.status(400).json({ error: 'اسم القائمة مطلوب.' });
    if (!Array.isArray(b.ids)) return res.status(400).json({ error: 'قائمة غير صالحة.' });
    const known = new Set(getMovies().map(m => m.id));
    const ids = [...new Set(b.ids.filter(x => typeof x === 'string' && known.has(x)))].slice(0, 100);
    if (!ids.length) return res.status(400).json({ error: 'القائمة فارغة.' });
    const all = get(); const mine = Object.entries(all).filter(([, v]) => v.uid === req.user.id);
    if (mine.length >= 20) return res.status(400).json({ error: 'وصلت إلى الحد الأقصى من القوائم المشاركة (20). ألغِ إحداها أولاً.' });
    const token = crypto.randomBytes(10).toString('hex');
    all[token] = { uid: req.user.id, name, ids, createdAt: new Date().toISOString() };
    writeJSONAtomic(FILE, all); res.status(201).json({ token, url: '/?list=' + token });
  });
  app.get('/api/user/shares', requireUser, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(Object.entries(get()).filter(([, v]) => v.uid === req.user.id).map(([token, v]) => ({ token, name: v.name, count: v.ids.length, createdAt: v.createdAt })));
  });
  app.delete('/api/user/shares/:token', sameOrigin, requireUser, (req, res) => {
    const all = get(), s = TOK.test(req.params.token) && all[req.params.token];
    if (!s || s.uid !== req.user.id) return res.status(404).json({ error: 'غير موجود.' });
    delete all[req.params.token]; writeJSONAtomic(FILE, all); res.json({ success: true });
  });
  app.get('/api/shared/:token', (req, res) => {
    if (hit(`shg:${req.ip}`, 120, 60 * 1000)) return res.status(429).json({ error: 'محاولات كثيرة، حاول بعد قليل.' });
    const s = TOK.test(req.params.token) && get()[req.params.token];
    if (!s) return res.status(404).json({ error: 'هذه القائمة غير موجودة أو أُلغيت.' });
    const all = getMovies(); const by = new Map(all.map(m => [m.id, m]));
    let list = s.ids.map(i => by.get(i)).filter(m => m && !m.pending && !(ext.isScheduled && ext.isScheduled(m)));
    if (ext.filterMovies) list = ext.filterMovies(list, req);
    const owner = (getUsers().find(u => u.id === s.uid) || {}).username || '';
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex');
    res.json({ name: s.name, owner, createdAt: s.createdAt, movies: list.map(publicMovie) });
  });
  /* v21: الاشتراكات — القنوات التي يتابعها المستخدم + آخر ما نشرته (Shorts). قراءة فقط. */
  app.get('/api/user/following', requireUser, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const f = readJSON(path.join(DATA_DIR, 'follows.json'), {}); const ids = Array.isArray(f[req.user.id]) ? f[req.user.id] : [];
    const users = new Map(getUsers().map(u => [u.id, u])); const ctx = c.shortsCtx(req);
    const shorts = c.getShorts().filter(x => !x.hidden && ids.includes(x.userId)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const channels = ids.map(id => users.get(id)).filter(Boolean).map(u => ({
      username: u.username, displayName: u.displayName || u.username, avatarUrl: u.avatarUrl || '',
      count: shorts.filter(x => x.userId === u.id).length
    }));
    res.json({ channels, videos: shorts.slice(0, 40).map(x => c.shapeShort(x, ctx)) });
  });
};

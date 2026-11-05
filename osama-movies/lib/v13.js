/* ===================================================================
   الإصدار 13 — نشر الأفلام الطويلة من حسابات المستخدمين + قنوات الأفلام + الاشتراك
   (يعمل فوق نفس مسار الرفع ونفس الحدود والمعالجة؛ الأفلام المدفوعة تبقى للإدارة فقط)
   =================================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function registerV13(c) {
  const { app, ext, readJSON, writeJSONAtomic, getUser, requireUser, sameOrigin, hit, tr, cleanLine, cleanBlock,
    getMovies, saveMovies, getUsers, publicMovie, upload, sniffFile, cleanupMovieExtras, getAnalytics, saveAnalytics, recordEvent,
    ROOT, UPLOADS, PRIVATE_DIR, DATA_DIR, hasBanned, byUsername } = c;
  const requireAdmin = c.requireAdmin;
  const CFG13 = path.join(DATA_DIR, 'settings13.json');
  const cfg13 = () => ({ approveUserMovies: true, ...readJSON(CFG13, {}) });
  const isAdminReq = req => { try { return !!(c.getSession && c.getSession(req)); } catch { return false; } };
  // الأفلام المعلّقة تظهر لصاحبها وللإدارة فقط
  const prevFilter = ext.filterMovies;
  ext.filterMovies = (ms, req) => {
    const base = prevFilter ? prevFilter(ms, req) : ms;
    if (!base.some(m => m.pending)) return base;
    const u = getUser(req), adm = isAdminReq(req);
    return base.filter(m => !m.pending || adm || (u && u.id === m.userId));
  };

  const F = n => path.join(DATA_DIR, n);
  const iso = () => new Date().toISOString();
  const unlink = f => { try { if (f) fs.unlinkSync(f); } catch {} };
  const rl = (req, res, key, max, ms) => { if (hit(`${key}:${req.user ? req.user.id : req.ip}`, max, ms)) { res.status(429).json({ error: tr(req, 'too_many') }); return true; } return false; };
  const getFollows = () => readJSON(F('follows.json'), {});
  const followersOf = uid => Object.values(getFollows()).filter(a => a.includes(uid)).length;

  /* ---------- كاتب الفيلم يظهر في الفيلم العام (صف القناة) ---------- */
  let umCache = { t: 0, m: new Map() };
  const userById = id => { if (Date.now() - umCache.t > 3000) umCache = { t: Date.now(), m: new Map(getUsers().map(u => [u.id, u])) }; return umCache.m.get(id); };
  const prevExtras = ext.movieExtras;
  ext.movieExtras = m => {
    const out = prevExtras ? prevExtras(m) : {};
    if (m.userId) { const u = userById(m.userId); if (u) out.author = { username: u.username, displayName: u.displayName || u.username, avatarUrl: u.avatarUrl || '', verified: !!(ext.isVerified && ext.isVerified(u.id)) }; }
    return out;
  };

  /* ---------- نشر فيلم من مستخدم ---------- */
  const cleanFiles = req => { for (const f of [...(req.files?.poster || []), ...(req.files?.video || [])]) unlink(f.path); };
  app.post('/api/user/movies', sameOrigin, requireUser, (req, res, next) => {
    if (ext.userPublishOff && ext.userPublishOff()) return res.status(403).json({ error: tr(req, 'forbidden'), code: 'forbidden' });
    if (ext.kidsBlocked && ext.kidsBlocked(req.user)) return res.status(403).json({ error: tr(req, 'forbidden'), code: 'forbidden' });
    if (hit(`movie-up:${req.user.id}`, 10, 60 * 60 * 1000)) return res.status(429).json({ error: tr(req, 'too_many') });
    next();
  }, (req, res, next) => ext.cap ? ext.cap('movie')(req, res, next) : next(),
  upload.fields([{ name: 'poster', maxCount: 1 }, { name: 'video', maxCount: 1 }]), async (req, res) => {
    try {
      const poster = req.files?.poster?.[0], video = req.files?.video?.[0];
      const title = cleanLine(req.body.title, 160), description = cleanBlock(req.body.description, 4000);
      const bad = (status, key) => { cleanFiles(req); return res.status(status).json({ error: tr(req, key), code: key }); };
      if (title.length < 2 || !poster || !video) return bad(400, 'movie_fields');
      if (!['mp4', 'webm'].includes(sniffFile(video.path))) return bad(400, 'video_invalid');
      if (poster.size > 5 * 1024 * 1024 || !['jpeg', 'png', 'webp'].includes(sniffFile(poster.path))) return bad(400, 'poster_invalid');
      if (hasBanned(title) || hasBanned(description)) return bad(422, 'banned_word');
      if (ext.moderateText && await ext.moderateText(`${title}\n${description}`)) return bad(422, 'moderated');
      const movies = getMovies();
      const movie = {
        id: crypto.randomUUID(), userId: req.user.id, title,
        category: cleanLine(req.body.category, 60) || 'عام', description,
        posterUrl: `/uploads/${poster.filename}`, videoUrl: `/uploads/${video.filename}`,
        posterSize: poster.size || 0, fileSize: video.size || 0, views: 0, createdAt: iso()
      };
      if (cfg13().approveUserMovies) movie.pending = true;
      if (ext.catalogFrom) { const k = ext.catalogFrom(req.body); delete k.featured; Object.assign(movie, k); }
      movies.unshift(movie); saveMovies(movies);
      const a = getAnalytics(); a.uploads = Number(a.uploads || 0) + 1; saveAnalytics(a);
      recordEvent('upload', { movieId: movie.id, title: movie.title, username: req.user.username });
      if (ext.processMovie) ext.processMovie(movie.id);
      // إشعار المتابعين
      if (!movie.pending && ext.notify) for (const [uid, arr] of Object.entries(getFollows())) if (arr.includes(req.user.id) && uid !== req.user.id)
        ext.notify(uid, 'channel_movie', { fromId: req.user.id, name: req.user.displayName || req.user.username, username: req.user.username, movieId: movie.id, title: movie.title.slice(0, 80) });
      res.status(201).json({ ...publicMovie(movie), pending: !!movie.pending });
    } catch (e) { cleanFiles(req); res.status(500).json({ error: tr(req, 'server_error') }); }
  });

  const mine = req => getMovies().filter(m => m.userId === req.user.id);
  app.get('/api/user/movies', requireUser, (req, res) => res.json(mine(req).map(m => ({ ...publicMovie(m), pending: !!m.pending }))));
  app.patch('/api/user/movies/:id', sameOrigin, requireUser, async (req, res) => {
    const list = getMovies(); const m = list.find(x => x.id === req.params.id && x.userId === req.user.id);
    if (!m) return res.status(404).json({ error: tr(req, 'target_not_found') });
    const b = req.body || {};
    const title = 'title' in b ? cleanLine(b.title, 160) : m.title, description = 'description' in b ? cleanBlock(b.description, 4000) : m.description;
    if (title.length < 2) return res.status(400).json({ error: tr(req, 'movie_fields'), code: 'movie_fields' });
    if (hasBanned(title) || hasBanned(description)) return res.status(422).json({ error: tr(req, 'banned_word'), code: 'banned_word' });
    if (ext.moderateText && await ext.moderateText(`${title}\n${description}`)) return res.status(422).json({ error: tr(req, 'moderated'), code: 'moderated' });
    m.title = title; m.description = description;
    if ('category' in b) m.category = cleanLine(b.category, 60) || 'عام';
    saveMovies(list); res.json(publicMovie(m));
  });
  app.delete('/api/user/movies/:id', sameOrigin, requireUser, (req, res) => {
    const list = getMovies(); const m = list.find(x => x.id === req.params.id && x.userId === req.user.id);
    if (!m) return res.status(404).json({ error: tr(req, 'target_not_found') });
    for (const url of [m.posterUrl, m.videoUrl]) if (typeof url === 'string' && url.startsWith('/uploads/')) { const f = path.join(ROOT, url.replace(/^\/+/, '')); if (f.startsWith(UPLOADS + path.sep)) unlink(f); }
    for (const r of m.renditions || []) if (r.file) unlink(path.join(UPLOADS, path.basename(String(r.file))));
    if (m.sprite && m.sprite.url) unlink(path.join(UPLOADS, path.basename(String(m.sprite.url))));
    saveMovies(list.filter(x => x.id !== m.id)); cleanupMovieExtras(m);
    recordEvent('delete', { movieId: m.id, title: m.title, username: req.user.username });
    res.json({ success: true });
  });

  /* ---------- مراجعة الإدارة لأفلام المستخدمين ---------- */
  const removeMovie = m => {
    for (const url of [m.posterUrl, m.videoUrl]) if (typeof url === 'string' && url.startsWith('/uploads/')) { const f = path.join(ROOT, url.replace(/^\/+/, '')); if (f.startsWith(UPLOADS + path.sep)) unlink(f); }
    for (const r of m.renditions || []) if (r.file) unlink(path.join(UPLOADS, path.basename(String(r.file))));
    if (m.sprite && m.sprite.url) unlink(path.join(UPLOADS, path.basename(String(m.sprite.url))));
    saveMovies(getMovies().filter(x => x.id !== m.id)); cleanupMovieExtras(m);
  };
  const adminItem = m => { const u = getUsers().find(x => x.id === m.userId); return { id: m.id, title: m.title, category: m.category, posterUrl: m.posterUrl, videoUrl: m.videoUrl, description: (m.description || '').slice(0, 300), createdAt: m.createdAt, pending: !!m.pending, owner: u ? u.username : '—' }; };
  app.get('/api/admin/user-movies', requireAdmin, (req, res) => res.json({ approve: cfg13().approveUserMovies, items: getMovies().filter(m => m.userId && (req.query.all === '1' || m.pending)).map(adminItem) }));
  app.put('/api/admin/user-movies/settings', sameOrigin, requireAdmin, (req, res) => { writeJSONAtomic(CFG13, { ...cfg13(), approveUserMovies: !!(req.body || {}).approveUserMovies }); res.json({ success: true }); });
  app.post('/api/admin/user-movies/:id/approve', sameOrigin, requireAdmin, (req, res) => {
    const list = getMovies(); const m = list.find(x => x.id === req.params.id && x.userId);
    if (!m) return res.status(404).json({ error: 'الفيلم غير موجود' });
    const was = m.pending; delete m.pending; saveMovies(list);
    if (was && ext.notify) { const au = getUsers().find(x => x.id === m.userId) || {};
      for (const [uid, arr] of Object.entries(getFollows())) if (arr.includes(m.userId) && uid !== m.userId)
        ext.notify(uid, 'channel_movie', { fromId: m.userId, name: au.displayName || au.username || '', username: au.username || '', movieId: m.id, title: m.title.slice(0, 80) }); }
    res.json({ success: true });
  });
  app.post('/api/admin/user-movies/:id/reject', sameOrigin, requireAdmin, (req, res) => {
    const m = getMovies().find(x => x.id === req.params.id && x.userId);
    if (!m) return res.status(404).json({ error: 'الفيلم غير موجود' });
    removeMovie(m); recordEvent('delete', { movieId: m.id, title: m.title, username: 'admin' }); res.json({ success: true });
  });

  /* ---------- قناة: أفلامها وبطاقتها الخفيفة ---------- */
  const visibleTo = (req, ms) => (ext.filterMovies ? ext.filterMovies(ms.filter(m => !(ext.isScheduled && ext.isScheduled(m))), req) : ms);
  app.get('/api/users/:username/movies', (req, res) => {
    const u = byUsername(req.params.username); if (!u) return res.status(404).json({ error: tr(req, 'target_not_found') });
    res.json({ items: visibleTo(req, getMovies().filter(m => m.userId === u.id)).map(publicMovie) });
  });
  app.get('/api/users/:username/card', (req, res) => {
    const u = byUsername(req.params.username); if (!u) return res.status(404).json({ error: tr(req, 'target_not_found') });
    const me = getUser(req);
    const st = (ext.channelStyle && ext.channelStyle(u.id)) || {};
    res.json({ username: u.username, displayName: st.name || u.displayName || u.username, handle: st.handle || '', verified: !!(ext.isVerified && ext.isVerified(u.id)), avatarUrl: u.avatarUrl || '', followers: followersOf(u.id), isMe: !!me && me.id === u.id,
      isFollowing: !!me && (getFollows()[me.id] || []).includes(u.id), movies: getMovies().filter(m => m.userId === u.id).length });
  });

  /* ---------- قناة الموقع نفسه (أفلام الإدارة) ---------- */
  const siteFollowers = () => readJSON(F('sitefollow.json'), []);
  const siteCard = req => { const me = getUser(req), f = siteFollowers(); return { ...(ext.siteStyle ? ext.siteStyle() : {}), followers: f.length, isFollowing: !!me && f.includes(me.id), movies: getMovies().filter(m => !m.userId).length }; };
  app.get('/api/site/card', (req, res) => res.json(siteCard(req)));
  app.get('/api/site/movies', (req, res) => res.json({ items: visibleTo(req, getMovies().filter(m => !m.userId)).map(publicMovie) }));
  const siteFollow = on => (req, res) => {
    if (rl(req, res, 'sitefollow', 30, 60 * 1000)) return;
    const f = siteFollowers().filter(x => x !== req.user.id); if (on) f.push(req.user.id);
    writeJSONAtomic(F('sitefollow.json'), f); res.json({ ...siteCard(req), isFollowing: on });
  };
  app.post('/api/site/follow', sameOrigin, requireUser, siteFollow(true));
  app.delete('/api/site/follow', sameOrigin, requireUser, siteFollow(false));
  // إشعار مشتركي الموقع عند نشر الإدارة فيلماً جديداً
  const prevProcess = ext.processMovie;
  const announced = new Set();
  ext.processMovie = id => {
    if (prevProcess) prevProcess(id);
    const m = getMovies().find(x => x.id === id);
    if (m && !m.userId && ext.notify && !announced.has(id) && !(ext.isScheduled && ext.isScheduled(m))) {
      announced.add(id); for (const uid of siteFollowers()) ext.notify(uid, 'site_movie', { name: '', movieId: m.id, title: m.title.slice(0, 80) });
    }
  };
};

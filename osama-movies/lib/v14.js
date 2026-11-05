/* ===================================================================
   الإصدار 14 — تخصيص القناة (اسم/رابط/صورة/بانر) + قناة الموقع + إعدادات الموقع + البث المباشر
   =================================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

module.exports = function registerV14(c) {
  const { app, ext, readJSON, writeJSONAtomic, getUser, requireUser, requireAdmin, sameOrigin, hit, tr, cleanLine, cleanBlock,
    getUsers, UPLOADS, DATA_DIR, hasBanned, byUsername } = c;
  const F = n => path.join(DATA_DIR, n);
  const iso = () => new Date().toISOString();
  const unlink = f => { try { if (f) fs.unlinkSync(f); } catch {} };
  const rl = (req, res, key, n, ms) => { if (hit(`${key}:${(req.user && req.user.id) || req.ip}`, n, ms)) { res.status(429).json({ error: tr(req, 'too_many') }); return true; } return false; };

  /* ---------- إعدادات الموقع ---------- */
  const cfg = () => ({ userPublish: true, userLive: true, maxViewers: 100, maxLives: 3, liveBlocked: [], ...readJSON(F('settings14.json'), {}) });
  const liveBlockedFor = u => !!u && cfg().liveBlocked.includes(u.id);
  ext.userPublishOff = () => !cfg().userPublish;
  app.get('/api/site/features', (req, res) => { const u = getUser(req), k = cfg(); res.json({ userPublish: k.userPublish, userLive: !!u && k.userLive && !liveBlockedFor(u) && !(ext.kidsBlocked && ext.kidsBlocked(u)), live: [...lives.values()].some(l => !l.ended) }); });
  app.get('/api/admin/site-settings', requireAdmin, (req, res) => res.json(cfg()));
  app.put('/api/admin/site-settings', sameOrigin, requireAdmin, (req, res) => {
    const b = req.body || {}; const cur = cfg();
    if ('userPublish' in b) cur.userPublish = !!b.userPublish;
    if ('userLive' in b) cur.userLive = !!b.userLive;
    if ('maxViewers' in b) cur.maxViewers = Math.min(2000, Math.max(5, Number(b.maxViewers) || 100));
    writeJSONAtomic(F('settings14.json'), cur); res.json(cur);
  });

  /* ---------- صور البانر/الأفاتار ---------- */
  const BANNERS = path.join(UPLOADS, 'banners'); fs.mkdirSync(BANNERS, { recursive: true });
  const memUp = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
  const kindOf = b => { if (!b || b.length < 12) return ''; if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'jpg'; if (b[0] === 0x89 && b.slice(1, 4).toString() === 'PNG') return 'png'; if (b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') return 'webp'; return ''; };
  const takeImage = field => (req, res, next) => memUp.single(field)(req, res, err => {
    if (err) return res.status(400).json({ error: tr(req, 'poster_invalid'), code: 'poster_invalid' });
    const k = kindOf(req.file && req.file.buffer);
    if (!k) return res.status(400).json({ error: tr(req, 'poster_invalid'), code: 'poster_invalid' });
    req.imgKind = k; next();
  });
  const saveImage = (req, prefix) => { const name = `${prefix}-${crypto.randomBytes(6).toString('hex')}.${req.imgKind}`; fs.writeFileSync(path.join(BANNERS, name), req.file.buffer); return `/uploads/banners/${name}`; };
  const dropImage = url => { if (typeof url === 'string' && url.startsWith('/uploads/banners/')) unlink(path.join(BANNERS, path.basename(url))); };

  /* ---------- أسماء/روابط القنوات ---------- */
  const RESERVED = new Set(['admin', 'api', 'uploads', 'c', 'live', 'site', 'static', 'public', 'login', 'register', 'shorts', 'official']);
  const HANDLE_RE = /^[a-z0-9_]{3,24}$/;
  const chans = () => readJSON(F('channels.json'), {});
  const site = () => ({ name: '', handle: '', bio: '', avatarUrl: '', bannerUrl: '', ...readJSON(F('site-channel.json'), {}) });
  const pub = s => ({ name: s.name || '', handle: s.handle || '', bio: s.bio || '', bannerUrl: s.bannerUrl || '' });
  ext.channelStyle = uid => ({ ...pub(chans()[uid] || {}), verified: !!(ext.isVerified && ext.isVerified(uid)) });
  ext.siteStyle = () => { const s = site(); return { name: s.name, handle: s.handle, bio: s.bio, avatarUrl: s.avatarUrl, bannerUrl: s.bannerUrl }; };
  const handleTaken = (h, selfId) => {
    if (RESERVED.has(h)) return true;
    if (site().handle === h && selfId !== 'site') return true;
    for (const [uid, s] of Object.entries(chans())) if (s.handle === h && uid !== selfId) return true;
    return getUsers().some(u => u.username.toLowerCase() === h && u.id !== selfId);
  };
  const validate = (req, b, selfId, base) => {
    const out = { ...base };
    if ('name' in b) out.name = cleanLine(b.name, 40);
    if ('bio' in b) out.bio = cleanBlock(b.bio, 200);
    if ('handle' in b) {
      const h = String(b.handle || '').trim().toLowerCase().replace(/^@/, '');
      if (h && !HANDLE_RE.test(h)) return { error: 'handle_invalid' };
      if (h && handleTaken(h, selfId)) return { error: 'handle_taken' };
      out.handle = h;
    }
    if (hasBanned(out.name) || hasBanned(out.bio)) return { error: 'banned_word' };
    return { out };
  };
  const ERR = { handle_invalid: 'الرابط: 3–24 حرفاً إنجليزياً صغيراً أو أرقاماً أو _', handle_taken: 'هذا الرابط مستخدم، اختر غيره.', banned_word: null };
  const fail = (req, res, k) => res.status(k === 'banned_word' ? 422 : 400).json({ error: ERR[k] || tr(req, k), code: k });

  app.get('/api/user/channel-style', requireUser, (req, res) => res.json(pub(chans()[req.user.id] || {})));
  app.put('/api/user/channel-style', sameOrigin, requireUser, async (req, res) => {
    if (rl(req, res, 'chstyle', 20, 60 * 60 * 1000)) return;
    const all = chans(); const v = validate(req, req.body || {}, req.user.id, all[req.user.id] || {});
    if (v.error) return fail(req, res, v.error);
    if (ext.moderateText && await ext.moderateText(`${v.out.name}\n${v.out.bio}`)) return res.status(422).json({ error: tr(req, 'moderated'), code: 'moderated' });
    all[req.user.id] = v.out; writeJSONAtomic(F('channels.json'), all); res.json(pub(v.out));
  });
  app.post('/api/user/channel/banner', sameOrigin, requireUser, takeImage('banner'), (req, res) => {
    if (rl(req, res, 'chbanner', 10, 60 * 60 * 1000)) return;
    const all = chans(); const cur = all[req.user.id] || {}; dropImage(cur.bannerUrl);
    cur.bannerUrl = saveImage(req, 'u'); all[req.user.id] = cur; writeJSONAtomic(F('channels.json'), all); res.json(pub(cur));
  });
  app.delete('/api/user/channel/banner', sameOrigin, requireUser, (req, res) => {
    const all = chans(); const cur = all[req.user.id] || {}; dropImage(cur.bannerUrl); cur.bannerUrl = ''; all[req.user.id] = cur; writeJSONAtomic(F('channels.json'), all); res.json(pub(cur));
  });
  app.get('/api/users/:username/channel-style', (req, res) => {
    const u = byUsername(req.params.username); if (!u) return res.status(404).json({ error: tr(req, 'target_not_found') });
    res.json(ext.channelStyle(u.id));
  });
  // رابط قصير: /c/handle  (أو اسم المستخدم)
  const shortLink = (req, res) => {
    const h = String(req.params.handle || '').toLowerCase();
    if (site().handle === h && h) return res.redirect('/?site=1');
    const hit1 = Object.entries(chans()).find(([, s]) => s.handle === h);
    const u = hit1 ? getUsers().find(x => x.id === hit1[0]) : byUsername(h);
    res.redirect(u ? `/?channel=${encodeURIComponent(u.username)}` : '/');
  };
  app.get('/c/:handle', shortLink);
  app.get('/@:handle', shortLink);

  /* ---------- قناة الموقع (الإدارة) ---------- */
  app.get('/api/admin/site-channel', requireAdmin, (req, res) => res.json(site()));
  app.put('/api/admin/site-channel', sameOrigin, requireAdmin, (req, res) => {
    const v = validate(req, req.body || {}, 'site', site()); if (v.error) return fail(req, res, v.error);
    writeJSONAtomic(F('site-channel.json'), v.out); res.json(v.out);
  });
  const siteImg = (field, key) => [sameOrigin, requireAdmin, takeImage(field), (req, res) => {
    const s = site(); dropImage(s[key]); s[key] = saveImage(req, 's'); writeJSONAtomic(F('site-channel.json'), s); res.json(s);
  }];
  app.post('/api/admin/site-channel/avatar', ...siteImg('avatar', 'avatarUrl'));
  app.post('/api/admin/site-channel/banner', ...siteImg('banner', 'bannerUrl'));
  app.delete('/api/admin/site-channel/:kind', sameOrigin, requireAdmin, (req, res) => {
    const key = req.params.kind === 'avatar' ? 'avatarUrl' : req.params.kind === 'banner' ? 'bannerUrl' : null; if (!key) return res.status(404).end();
    const s = site(); dropImage(s[key]); s[key] = ''; writeJSONAtomic(F('site-channel.json'), s); res.json(s);
  });

  /* ---------- البث المباشر (من المتصفح: مقاطع قصيرة مستقلة تُمرَّر للمشاهدين) ---------- */
  const lives = new Map(); // id → {id,title,mime,startedAt,lastAt,seq,segs:[{n,buf}],viewers:Map,ended}
  const MAX_SEG = 6 * 1024 * 1024, KEEP = 8;
  const mimeOk = m => /^video\/(webm|mp4)(;\s*codecs=[\w.,"' -]+)?$/i.test(String(m || ''));
  const viewersOf = l => { const now = Date.now(); let n = 0; for (const [k, t] of l.viewers) { if (now - t > 20000) l.viewers.delete(k); else n++; } return n; };
  const pubLive = l => ({ id: l.id, title: l.title, mime: l.mime, startedAt: l.startedAt, latest: l.seq, ended: l.ended, viewers: viewersOf(l), owner: ownerInfo(l) });
  setInterval(() => { const now = Date.now(); for (const [id, l] of lives) { if (!l.ended && now - l.lastAt > 30000) l.ended = true; if (l.ended && now - l.lastAt > 5 * 60000) lives.delete(id); } }, 10000).unref();

  app.get('/api/live', (req, res) => res.json({ items: [...lives.values()].filter(l => !l.ended).map(pubLive) }));
  app.get('/api/live/:id', (req, res) => {
    const l = lives.get(req.params.id); if (!l) return res.status(404).json({ error: tr(req, 'target_not_found') });
    const v = String(req.query.v || '').slice(0, 40);
    if (v && !l.ended) { if (!l.viewers.has(v) && viewersOf(l) >= cfg().maxViewers) return res.status(503).json({ error: 'البث ممتلئ حالياً، حاول بعد قليل.', code: 'full' }); l.viewers.set(v, Date.now()); }
    res.set('Cache-Control', 'no-store'); res.json(pubLive(l));
  });
  app.get('/api/live/:id/seg/:n', (req, res) => {
    const l = lives.get(req.params.id); const n = Number(req.params.n);
    const s = l && l.segs.find(x => x.n === n); if (!s) return res.status(404).end();
    res.setHeader('Content-Type', l.mime.split(';')[0]); res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Length', s.buf.length); res.end(s.buf);
  });
  /* --- صلاحيات: الإدارة أو صاحب البث --- */
  const ownerInfo = l => { if (!l.userId) return null; const u = getUsers().find(x => x.id === l.userId); if (!u) return null; const st = (ext.channelStyle && ext.channelStyle(u.id)) || {}; return { username: u.username, name: st.name || u.displayName || u.username, avatarUrl: u.avatarUrl || '', verified: !!st.verified }; };
  const can = (req, l) => { if (c.getSession && c.getSession(req)) return true; const u = getUser(req); return !!u && !!l.userId && l.userId === u.id; };
  const activeCount = () => [...lives.values()].filter(l => !l.ended).length;
  const beginLive = (req, res, userId) => {
    const b = req.body || {};
    if (!mimeOk(b.mime)) return res.status(400).json({ error: 'صيغة البث غير مدعومة' });
    for (const l of lives.values()) if (!l.ended && (userId ? l.userId === userId : !l.userId)) l.ended = true; // بث واحد لكل صاحب
    if (activeCount() >= cfg().maxLives) return res.status(429).json({ error: 'عدد البثوث المتزامنة وصل حدّه، حاول لاحقاً.' });
    const id = crypto.randomBytes(6).toString('hex');
    const l = { id, userId: userId || '', title: cleanLine(b.title, 120) || 'بث مباشر', mime: String(b.mime), startedAt: iso(), lastAt: Date.now(), seq: 0, segs: [], viewers: new Map(), ended: false };
    lives.set(id, l);
    if (ext.notify) {
      if (userId) { const o = ownerInfo(l) || {}; for (const [uid, arr] of Object.entries(readJSON(F('follows.json'), {}))) if (arr.includes(userId) && uid !== userId) ext.notify(uid, 'channel_live', { fromId: userId, name: o.name || '', username: o.username || '', liveId: id, title: l.title.slice(0, 80) }); }
      else for (const uid of readJSON(F('sitefollow.json'), [])) ext.notify(uid, 'site_live', { name: '', liveId: id, title: l.title.slice(0, 80) });
    }
    res.status(201).json(pubLive(l));
  };
  ext.lives = lives; ext.liveCan = can;
  app.post('/api/admin/live/start', sameOrigin, requireAdmin, (req, res) => beginLive(req, res, ''));
  app.post('/api/live/start', sameOrigin, requireUser, (req, res) => {
    const k = cfg();
    if (!k.userLive || liveBlockedFor(req.user) || (ext.kidsBlocked && ext.kidsBlocked(req.user))) return res.status(403).json({ error: tr(req, 'forbidden'), code: 'forbidden' });
    if (hit(`live-start:${req.user.id}`, 10, 60 * 60 * 1000)) return res.status(429).json({ error: tr(req, 'too_many') });
    beginLive(req, res, req.user.id);
  });
  const pushSeg = (req, res) => {
    const l = lives.get(req.params.id); if (!l || l.ended) return res.status(404).json({ error: 'البث منتهٍ' });
    if (!can(req, l)) return res.status(403).json({ error: tr(req, 'forbidden') });
    const parts = []; let size = 0, bad = false;
    req.on('data', d => { if (bad) return; size += d.length; if (size > MAX_SEG) { bad = true; res.status(413).json({ error: 'المقطع كبير' }); req.destroy(); } else parts.push(d); });
    req.on('end', () => {
      if (bad) return; if (!size) return res.status(400).json({ error: 'مقطع فارغ' });
      l.seq += 1; l.segs.push({ n: l.seq, buf: Buffer.concat(parts) }); while (l.segs.length > KEEP) l.segs.shift(); l.lastAt = Date.now();
      res.json({ n: l.seq, viewers: viewersOf(l) });
    });
  };
  const stopLive = (req, res) => { const l = lives.get(req.params.id); if (l && can(req, l)) { l.ended = true; l.lastAt = Date.now(); } res.json({ success: true }); };
  app.post('/api/live/:id/seg', sameOrigin, pushSeg);
  app.post('/api/live/:id/stop', sameOrigin, stopLive);
  app.post('/api/admin/live/:id/seg', sameOrigin, requireAdmin, pushSeg);
  app.post('/api/admin/live/:id/stop', sameOrigin, requireAdmin, stopLive);
  // إدارة: بثوث جارية + منع مستخدم من البث
  app.get('/api/admin/lives', requireAdmin, (req, res) => res.json({ items: [...lives.values()].filter(l => !l.ended).map(l => ({ ...pubLive(l), owner: ownerInfo(l) })), blocked: cfg().liveBlocked.map(id => (getUsers().find(u => u.id === id) || {}).username).filter(Boolean) }));
  app.post('/api/admin/live/block', sameOrigin, requireAdmin, (req, res) => {
    const u = byUsername(String((req.body || {}).username || '')); if (!u) return res.status(404).json({ error: 'المستخدم غير موجود' });
    const k = cfg(); k.liveBlocked = k.liveBlocked.filter(x => x !== u.id); if ((req.body || {}).blocked !== false) { k.liveBlocked.push(u.id); for (const l of lives.values()) if (l.userId === u.id) l.ended = true; }
    writeJSONAtomic(F('settings14.json'), k); res.json({ success: true });
  });
};

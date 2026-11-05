/* ===================================================================
   الإضافات (الإصدار 10) — تُسجَّل فوق الخادم الحالي دون تعديل منطقه:
   إشعارات • متابعة المشاهدة • مكتبة وقوائم تشغيل • قنوات ومتابعة • بلاغات
   اشتراكات وكوبونات • نشر مجدول • استعادة كلمة المرور وتأكيد البريد
   معالجة ffmpeg • تفريغ صوتي • تحليلات المشاهدة • نسخ احتياطي • حدود الرفع
   =================================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mailer = require('./mailer');
const media = require('./media');
const backupLib = require('./backup');
const { parseSubtitles } = require('./subtitles');

module.exports = function registerV10(c) {
  const { app, ext, readJSON, writeJSONAtomic, getUser, requireUser, requireAdmin, sameOrigin, hit, tr, cleanLine, cleanBlock,
    getMovies, saveMovies, getShorts, saveShorts, getUsers, saveUsers, getComments, saveComments, getPayments, savePayments,
    getAnalytics, saveAnalytics, recordEvent, publicUser, movieFileOf, shapeShort, shortsCtx, removeShort,
    passwordProblem, scryptAsync, SCRYPT_OPTS, hashToken, userSessions, persistSessions, getSession,
    autoVerifyReceipt, normalizeReceipt, paymentStatusFor, DATA_DIR, UPLOADS, ROOT, PRIVATE_DIR, SHORTS_DIR, SUBS_DIR, unlinkQuiet } = c;

  const F = n => path.join(DATA_DIR, n);
  const J = (file, fb) => () => readJSON(F(file), fb);
  const S = file => v => writeJSONAtomic(F(file), v);
  const getNotifs = J('notifications.json', {}), saveNotifs = S('notifications.json');
  const getProgress = J('progress.json', {}), saveProgress = S('progress.json');
  const getLibrary = J('library.json', {}), saveLibrary = S('library.json');
  const getFollows = J('follows.json', {}), saveFollows = S('follows.json');
  const getReports = J('reports.json', []), saveReports = S('reports.json');
  const getCommerce = () => { const d = readJSON(F('commerce.json'), {}); d.plans ||= []; d.coupons ||= []; d.subs ||= {}; return d; };
  const saveCommerce = S('commerce.json');
  const getWatch = () => { const d = readJSON(F('watch.json'), {}); d.days ||= {}; d.items ||= {}; d.sources ||= {}; d.countries ||= {}; d.totalSecs ||= 0; d.plays ||= 0; d.replays ||= 0; return d; };
  const saveWatch = S('watch.json');
  const getTokens = J('tokens.json', {}), saveTokens = S('tokens.json');
  const getReminders = J('reminders.json', {}), saveReminders = S('reminders.json');
  const getSettings = () => ({ maxMovieMB: 1024, maxShortMB: 200, ...readJSON(F('settings.json'), {}) });
  const saveSettings = S('settings.json');
  const now = () => Date.now();
  const iso = () => new Date().toISOString();
  const baseUrl = req => process.env.PUBLIC_URL || `${req.protocol}://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const ok = (res, extra = {}) => res.json({ success: true, ...extra });
  const rl = (req, res, key, max, ms) => { if (hit(`${key}:${req.user ? req.user.id : req.ip}`, max, ms)) { res.status(429).json({ error: 'محاولات كثيرة، حاول بعد قليل.' }); return true; } return false; };

  /* ---------- الإشعارات ---------- */
  function notify(userId, type, data = {}) {
    if (!userId) return;
    if (ext.isBlockedBy && data.fromId && ext.isBlockedBy(userId, data.fromId)) return; // المحظور لا يزعج
    const all = getNotifs();
    const list = all[userId] ||= [];
    list.unshift({ id: crypto.randomUUID(), type, data, createdAt: iso(), read: false });
    all[userId] = list.slice(0, 100);
    saveNotifs(all);
    if (ext.pushTo) ext.pushTo(userId, type, data);
  }
  ext.notify = notify;
  app.get('/api/notifications', requireUser, (req, res) => {
    const list = getNotifs()[req.user.id] || [];
    res.json({ items: list.slice(0, 50), unread: list.filter(n => !n.read).length });
  });
  app.get('/api/notifications/count', (req, res) => {
    const u = getUser(req);
    res.json({ unread: u ? (getNotifs()[u.id] || []).filter(n => !n.read).length : 0 });
  });
  app.post('/api/notifications/read', sameOrigin, requireUser, (req, res) => {
    const all = getNotifs(); const ids = Array.isArray(req.body && req.body.ids) ? new Set(req.body.ids) : null;
    for (const n of all[req.user.id] || []) if (!ids || ids.has(n.id)) n.read = true;
    saveNotifs(all); ok(res);
  });
  app.delete('/api/notifications', sameOrigin, requireUser, (req, res) => { const all = getNotifs(); delete all[req.user.id]; saveNotifs(all); ok(res); });

  /* ---------- متابعة المشاهدة ---------- */
  app.get('/api/user/progress', requireUser, (req, res) => {
    const p = getProgress()[req.user.id] || {};
    const movies = new Map(getMovies().map(m => [m.id, m]));
    const items = Object.entries(p).filter(([id, v]) => movies.has(id) && v.t > 5 && v.d > 0 && v.t / v.d < 0.95)
      .sort((a, b) => b[1].u - a[1].u).slice(0, 20)
      .map(([id, v]) => ({ id, t: v.t, d: v.d, updatedAt: new Date(v.u).toISOString() }));
    res.json({ items, map: Object.fromEntries(Object.entries(p).map(([id, v]) => [id, { t: v.t, d: v.d }])) });
  });
  app.put('/api/user/progress/:id', sameOrigin, requireUser, (req, res) => {
    if (rl(req, res, 'prog', 60, 60 * 1000)) return;
    const t = Number(req.body && req.body.t), d = Number(req.body && req.body.d);
    if (!Number.isFinite(t) || !Number.isFinite(d) || t < 0 || d <= 0 || d > 86400 * 2) return res.status(400).json({ error: tr(req, 'target_not_found') });
    if (!getMovies().some(m => m.id === req.params.id)) return res.status(404).json({ error: 'الفيلم غير موجود' });
    const all = getProgress(); (all[req.user.id] ||= {})[req.params.id] = { t: Math.round(t), d: Math.round(d), u: now() };
    saveProgress(all); ok(res);
  });
  app.delete('/api/user/progress/:id', sameOrigin, requireUser, (req, res) => {
    const all = getProgress(); if (all[req.user.id]) delete all[req.user.id][req.params.id]; saveProgress(all); ok(res);
  });

  /* ---------- المكتبة: المحفوظات والسجل وقوائم التشغيل (مرتبطة بالحساب) ---------- */
  const lib = uid => { const all = getLibrary(); const l = all[uid] ||= {}; l.saved ||= []; l.history ||= []; l.playlists ||= []; return { all, l }; };
  const movieIds = () => new Set(getMovies().map(m => m.id));
  const libOut = l => { const ids = movieIds(); return { saved: l.saved.filter(i => ids.has(i)), history: l.history.filter(i => ids.has(i)), playlists: l.playlists.map(p => ({ ...p, items: p.items.filter(i => ids.has(i)) })) }; };
  app.get('/api/user/library', requireUser, (req, res) => res.json(libOut(lib(req.user.id).l)));
  app.post('/api/user/library/sync', sameOrigin, requireUser, (req, res) => {
    const { all, l } = lib(req.user.id), ids = movieIds();
    const take = a => (Array.isArray(a) ? a : []).filter(i => typeof i === 'string' && ids.has(i)).slice(0, 200);
    l.saved = [...new Set([...take(req.body && req.body.saved), ...l.saved])].slice(0, 500);
    l.history = [...new Set([...take(req.body && req.body.history), ...l.history])].slice(0, 100);
    saveLibrary(all); res.json(libOut(l));
  });
  app.post('/api/user/library/saved/:id', sameOrigin, requireUser, (req, res) => {
    if (!movieIds().has(req.params.id)) return res.status(404).json({ error: 'الفيلم غير موجود' });
    const { all, l } = lib(req.user.id); l.saved = l.saved.filter(i => i !== req.params.id);
    if (req.body && req.body.on) l.saved.unshift(req.params.id);
    saveLibrary(all); res.json(libOut(l));
  });
  app.post('/api/user/library/history/:id', sameOrigin, requireUser, (req, res) => {
    if (!movieIds().has(req.params.id)) return res.status(404).json({ error: 'الفيلم غير موجود' });
    const { all, l } = lib(req.user.id); l.history = [req.params.id, ...l.history.filter(i => i !== req.params.id)].slice(0, 100);
    saveLibrary(all); ok(res);
  });
  app.delete('/api/user/library/history', sameOrigin, requireUser, (req, res) => { const { all, l } = lib(req.user.id); l.history = []; saveLibrary(all); ok(res); });
  app.post('/api/user/playlists', sameOrigin, requireUser, (req, res) => {
    const name = cleanLine(req.body && req.body.name, 60);
    if (!name) return res.status(400).json({ error: tr(req, 'name_required') });
    const { all, l } = lib(req.user.id);
    if (l.playlists.length >= 30) return res.status(400).json({ error: tr(req, 'too_many') });
    l.playlists.push({ id: crypto.randomBytes(6).toString('hex'), name, items: [], createdAt: iso() });
    saveLibrary(all); res.status(201).json(libOut(l));
  });
  const withPlaylist = fn => (req, res) => {
    const { all, l } = lib(req.user.id); const p = l.playlists.find(x => x.id === req.params.pid);
    if (!p) return res.status(404).json({ error: tr(req, 'target_not_found') });
    fn(req, res, p, l); saveLibrary(all);
  };
  app.patch('/api/user/playlists/:pid', sameOrigin, requireUser, withPlaylist((req, res, p, l) => {
    const name = cleanLine(req.body && req.body.name, 60); if (name) p.name = name; res.json(libOut(l));
  }));
  app.delete('/api/user/playlists/:pid', sameOrigin, requireUser, (req, res) => {
    const { all, l } = lib(req.user.id); l.playlists = l.playlists.filter(x => x.id !== req.params.pid); saveLibrary(all); res.json(libOut(l));
  });
  app.post('/api/user/playlists/:pid/items', sameOrigin, requireUser, withPlaylist((req, res, p, l) => {
    const id = req.body && req.body.movieId;
    if (!movieIds().has(id)) return res.status(404).json({ error: 'الفيلم غير موجود' });
    if (!p.items.includes(id)) p.items.unshift(id);
    p.items = p.items.slice(0, 300); res.json(libOut(l));
  }));
  app.delete('/api/user/playlists/:pid/items/:mid', sameOrigin, requireUser, withPlaylist((req, res, p, l) => {
    p.items = p.items.filter(i => i !== req.params.mid); res.json(libOut(l));
  }));

  /* ---------- القنوات والمتابعة والوسوم ---------- */
  const tagsOf = s => [...new Set((String(s.caption || '').match(/#[\p{L}\p{N}_]{2,40}/gu) || []).map(x => x.slice(1).toLowerCase()))];
  ext.tagsOf = tagsOf;
  const byUsername = name => { const l = String(name || '').toLowerCase(); return getUsers().find(u => u.usernameLower === l); };
  const followersOf = uid => Object.entries(getFollows()).filter(([, arr]) => arr.includes(uid)).length;
  ext.filterShorts = (list, req) => {
    const tag = typeof req.query.tag === 'string' ? req.query.tag.replace(/^#/, '').toLowerCase().slice(0, 40) : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase().slice(0, 80) : '';
    const author = typeof req.query.author === 'string' ? byUsername(req.query.author) : null;
    if (tag) list = list.filter(s => tagsOf(s).includes(tag));
    if (q) { const users = new Map(getUsers().map(u => [u.id, u])); list = list.filter(s => String(s.caption || '').toLowerCase().includes(q) || ((users.get(s.userId) || {}).username || '').toLowerCase().includes(q)); }
    if (req.query.author) list = author ? list.filter(s => s.userId === author.id) : [];
    if (req.query.feed === 'following') {
      const u = getUser(req); const f = u ? (getFollows()[u.id] || []) : [];
      list = list.filter(s => f.includes(s.userId));
    }
    if (req.query.feed === 'trending') {
      const soc = c.getSocial(); const cnt = {}; for (const cm of getComments()) if (cm.type === 'short') cnt[cm.targetId] = (cnt[cm.targetId] || 0) + 1;
      const score = s => { const e = soc[`short:${s.id}`] || {}; const age = (now() - Date.parse(s.createdAt)) / 3600e3; return ((e.likes || []).length * 3 + (cnt[s.id] || 0) * 2 + (s.views || 0) * 0.3 + (e.shares || 0) * 4) / Math.pow(age + 2, 0.6); };
      list = [...list].sort((a, b) => score(b) - score(a));
    }
    return list;
  };
  app.get('/api/hashtags/trending', (req, res) => {
    const cut = now() - 14 * 86400e3, cnt = {};
    for (const s of getShorts()) if (Date.parse(s.createdAt) > cut) for (const t of tagsOf(s)) cnt[t] = (cnt[t] || 0) + 1;
    res.json(Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([tag, n]) => ({ tag, n })));
  });
  app.get('/api/users/:username/channel', (req, res) => {
    const u = byUsername(req.params.username); if (!u) return res.status(404).json({ error: tr(req, 'target_not_found') });
    const me = getUser(req), ctx = shortsCtx(req);
    const shorts = getShorts().filter(s => s.userId === u.id && !s.hidden).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({
      user: { username: u.username, displayName: u.displayName || u.username, avatarUrl: u.avatarUrl || '', createdAt: u.createdAt },
      followers: followersOf(u.id), following: (getFollows()[u.id] || []).length, shortsCount: shorts.length,
      isMe: !!me && me.id === u.id, isFollowing: !!me && (getFollows()[me.id] || []).includes(u.id),
      shorts: shorts.slice(0, 30).map(s => shapeShort(s, ctx))
    });
  });
  const followRoute = on => (req, res) => {
    const u = byUsername(req.params.username); if (!u) return res.status(404).json({ error: tr(req, 'target_not_found') });
    if (u.id === req.user.id) return res.status(400).json({ error: tr(req, 'forbidden') });
    if (on && ext.isBlockedBy && (ext.isBlockedBy(u.id, req.user.id) || ext.isBlockedBy(req.user.id, u.id))) return res.status(403).json({ error: tr(req, 'forbidden') });
    if (rl(req, res, 'follow', 40, 60 * 1000)) return;
    const all = getFollows(); const arr = (all[req.user.id] ||= []); const had = arr.includes(u.id);
    all[req.user.id] = arr.filter(x => x !== u.id); if (on) all[req.user.id].push(u.id);
    saveFollows(all);
    if (on && !had) { const lg = readJSON(F('followlog.json'), []); lg.push({ a: req.user.id, b: u.id, t: now() }); writeJSONAtomic(F('followlog.json'), lg.slice(-5000)); }
    if (on && !had) notify(u.id, 'follow', { fromId: req.user.id, name: req.user.displayName || req.user.username, username: req.user.username });
    res.json({ isFollowing: on, followers: followersOf(u.id) });
  };
  app.post('/api/users/:username/follow', sameOrigin, requireUser, followRoute(true));
  app.delete('/api/users/:username/follow', sameOrigin, requireUser, followRoute(false));

  /* ---------- البلاغات ---------- */
  const REASONS = ['spam', 'abuse', 'sexual', 'violence', 'copyright', 'other'];
  app.post('/api/report', sameOrigin, requireUser, (req, res) => {
    if (rl(req, res, 'report', 10, 60 * 60 * 1000)) return;
    const b = req.body || {};
    const type = ['movie', 'short', 'comment'].includes(b.type) ? b.type : null;
    const reason = REASONS.includes(b.reason) ? b.reason : null;
    if (!type || !reason || typeof b.targetId !== 'string') return res.status(400).json({ error: tr(req, 'target_not_found') });
    const exists = type === 'comment' ? getComments().some(x => x.id === b.targetId) : type === 'movie' ? getMovies().some(x => x.id === b.targetId) : getShorts().some(x => x.id === b.targetId);
    if (!exists) return res.status(404).json({ error: tr(req, 'target_not_found') });
    const list = getReports();
    if (list.some(r => r.userId === req.user.id && r.targetId === b.targetId && r.status === 'open')) return ok(res, { duplicate: true });
    list.unshift({ id: crypto.randomUUID(), type, targetId: b.targetId, reason, note: cleanBlock(b.note, 300), userId: req.user.id, status: 'open', createdAt: iso() });
    saveReports(list.slice(0, 1000)); res.status(201).json({ success: true });
  });
  function reportTargetInfo(r, users, movies, shorts, comments) {
    let label = '—', owner = '';
    if (r.type === 'movie') { const m = movies.find(x => x.id === r.targetId); label = m ? m.title : '(محذوف)'; }
    else if (r.type === 'short') { const s = shorts.find(x => x.id === r.targetId); label = s ? (s.caption || 'Short') : '(محذوف)'; owner = s ? (users.get(s.userId) || {}).username : ''; }
    else { const cm = comments.find(x => x.id === r.targetId); label = cm ? cm.text.slice(0, 120) : '(محذوف)'; owner = cm ? (users.get(cm.userId) || {}).username : ''; }
    return { label, owner: owner || '' };
  }
  app.get('/api/admin/reports', requireAdmin, (req, res) => {
    const users = new Map(getUsers().map(u => [u.id, u])), movies = getMovies(), shorts = getShorts(), comments = getComments();
    res.json(getReports().filter(r => req.query.all === '1' || r.status === 'open').slice(0, 200).map(r => ({
      ...r, reporter: (users.get(r.userId) || {}).username || '—', ...reportTargetInfo(r, users, movies, shorts, comments)
    })));
  });
  app.post('/api/admin/reports/:id/resolve', requireAdmin, (req, res) => {
    const list = getReports(); const r = list.find(x => x.id === req.params.id);
    if (!r) return res.status(404).json({ error: 'البلاغ غير موجود' });
    if (req.body && req.body.action === 'remove') {
      if (r.type === 'short') { const s = getShorts().find(x => x.id === r.targetId); if (s) removeShort(s); }
      else if (r.type === 'comment') { const cm = getComments(); const t = cm.find(x => x.id === r.targetId); if (t) saveComments(cm.filter(x => x.id !== t.id && x.parentId !== t.id)); }
      else if (r.type === 'movie') return res.status(400).json({ error: 'احذف الفيلم من قسم إدارة الأفلام.' });
      for (const o of list) if (o.targetId === r.targetId && o.status === 'open') { o.status = 'removed'; o.resolvedAt = iso(); }
    } else { r.status = 'dismissed'; r.resolvedAt = iso(); if (r.type === 'short' && ext.unhideShort) ext.unhideShort(r.targetId); }
    saveReports(list); ok(res);
  });

  /* ---------- الاشتراكات والكوبونات ---------- */
  const subOf = uid => { const s = getCommerce().subs[uid]; return s && s.until > now() ? s : null; };
  ext.hasSub = u => !!u && !!subOf(u.id);
  ext.subInfo = u => { const s = u && subOf(u.id); return s ? { planName: s.planName, until: new Date(s.until).toISOString() } : null; };
  function grantSub(uid, plan, days) {
    const d = getCommerce(); const cur = d.subs[uid];
    const start = cur && cur.until > now() ? cur.until : now();
    d.subs[uid] = { planId: plan ? plan.id : 'manual', planName: plan ? plan.name : 'مميز', until: start + days * 86400e3 };
    saveCommerce(d);
  }
  const round = (n, cur) => cur === 'USD' ? Math.round(n * 100) / 100 : Math.round(n);
  /* يعيد السعر بعد الكوبون أو خطأ */
  ext.quote = (price, code, kind, user, currency) => {
    code = String(code || '').trim().toUpperCase();
    if (!code) return { ok: true, price, percent: 0, code: '' };
    const d = getCommerce(); const cp = d.coupons.find(x => x.code === code && x.active !== false);
    if (!cp) return { ok: false, error: 'coupon_invalid' };
    if (cp.expiresAt && Date.parse(cp.expiresAt) < now()) return { ok: false, error: 'coupon_expired' };
    if (cp.maxUses && (cp.used || 0) >= cp.maxUses) return { ok: false, error: 'coupon_used_up' };
    if (cp.scope && cp.scope !== 'all' && cp.scope !== kind) return { ok: false, error: 'coupon_scope' };
    if (user && (cp.usedBy || []).includes(user.id)) return { ok: false, error: 'coupon_used_by_you' };
    const p = Math.max(0.01, round(price * (1 - cp.percent / 100), currency));
    return { ok: true, price: Math.min(price, p), percent: cp.percent, code };
  };
  const COUPON_ERR = { coupon_invalid: 'كوبون غير صالح.', coupon_expired: 'انتهت صلاحية الكوبون.', coupon_used_up: 'استُنفد هذا الكوبون.', coupon_scope: 'هذا الكوبون لا ينطبق هنا.', coupon_used_by_you: 'سبق أن استخدمت هذا الكوبون.' };
  ext.couponError = q => COUPON_ERR[q.error] || 'كوبون غير صالح.';
  ext.onPaymentDecided = (p, status) => {
    if (status === 'approved') {
      if (p.plan) { const d = getCommerce(); const plan = d.plans.find(x => x.id === p.plan.id) || p.plan; grantSub(p.userId, plan, Number(p.plan.days) || 30); }
      if (p.coupon) { const d = getCommerce(); const cp = d.coupons.find(x => x.code === p.coupon); if (cp) { cp.used = (cp.used || 0) + 1; (cp.usedBy ||= []).push(p.userId); saveCommerce(d); } }
    }
    notify(p.userId, status === 'approved' ? 'payment_approved' : 'payment_rejected', { title: p.movieTitle, movieId: p.movieId || '', plan: !!p.plan });
  };
  app.get('/api/plans', (req, res) => {
    const d = getCommerce(); const u = getUser(req);
    res.json({ plans: d.plans.filter(p => p.active !== false).map(({ account, ...p }) => ({ ...p, account: account || (ext.defaultAccount ? ext.defaultAccount() : '') })), mine: u ? ext.subInfo(u) : null });
  });
  app.get('/api/user/subscription', requireUser, (req, res) => res.json({ sub: ext.subInfo(req.user) }));
  app.post('/api/coupons/check', sameOrigin, (req, res) => {
    if (hit(`cpn:${req.ip}`, 30, 10 * 60 * 1000)) return res.status(429).json({ error: 'محاولات كثيرة، حاول بعد قليل.' });
    const b = req.body || {}; let price = 0, cur = 'SYP', kind = 'movie';
    if (b.kind === 'plan') { const pl = getCommerce().plans.find(x => x.id === b.id); if (!pl) return res.status(404).json({ error: 'الخطة غير موجودة' }); price = pl.price; cur = pl.currency; kind = 'plan'; }
    else { const m = getMovies().find(x => x.id === b.id); if (!m || !m.isPaid) return res.status(404).json({ error: 'الفيلم غير موجود' }); price = m.price; cur = m.currency; }
    const q = ext.quote(price, b.code, kind, getUser(req), cur);
    if (!q.ok) return res.status(400).json({ error: ext.couponError(q), code: q.error });
    res.json({ valid: true, percent: q.percent, price: q.price, original: price, currency: cur });
  });
  app.post('/api/subscribe', sameOrigin, requireUser, async (req, res) => {
    const user = req.user; const b = req.body || {};
    const plan = getCommerce().plans.find(x => x.id === b.planId && x.active !== false);
    if (!plan) return res.status(404).json({ error: 'الخطة غير موجودة' });
    if (hit(`pay:${user.id}`, 8, 10 * 60 * 1000)) return res.status(429).json({ error: 'محاولات كثيرة، حاول بعد قليل.' });
    const receipt = normalizeReceipt(b.receipt);
    if (!/^\d{6,14}$/.test(receipt)) return res.status(400).json({ error: 'رقم الإيصال يجب أن يتكوّن من أرقام فقط (من 6 إلى 14 رقماً).' });
    const q = ext.quote(plan.price, b.coupon, 'plan', user, plan.currency);
    if (!q.ok) return res.status(400).json({ error: ext.couponError(q), code: q.error });
    let payments = getPayments();
    const dup = payments.find(p => p.receipt === receipt);
    if (dup) { if (dup.userId === user.id && dup.plan && dup.plan.id === plan.id && dup.status === 'pending') return res.status(202).json({ status: 'pending' }); return res.status(409).json({ error: 'رقم الإيصال هذا مستخدم من قبل.' }); }
    if (payments.filter(p => p.userId === user.id && p.plan && p.status === 'pending').length >= 3) return res.status(429).json({ error: 'لديك طلبات قيد المراجعة بالفعل. انتظر قرار الإدارة.' });
    const auto = await autoVerifyReceipt(receipt, { price: q.price, currency: plan.currency, shamcashAccount: plan.account });
    if (auto.mode === 'auto' && !auto.paid) return res.status(402).json({ error: 'لم نعثر على عملية دفع بهذا الرقم. تأكد من الرقم والمبلغ والحساب.' });
    payments = getPayments();
    if (payments.some(p => p.receipt === receipt)) return res.status(409).json({ error: 'رقم الإيصال هذا مستخدم من قبل.' });
    const status = auto.mode === 'auto' && auto.paid ? 'approved' : 'pending';
    const p = {
      id: crypto.randomUUID(), userId: user.id, username: user.username, movieId: '', movieTitle: `اشتراك: ${plan.name}`, receipt,
      amount: q.price, currency: plan.currency, status, method: status === 'approved' ? 'auto' : 'manual', createdAt: iso(),
      decidedAt: status === 'approved' ? iso() : null, plan: { id: plan.id, name: plan.name, days: plan.days }, coupon: q.code || ''
    };
    payments.unshift(p); savePayments(payments);
    recordEvent(status === 'approved' ? 'payment_approved' : 'payment_submitted', { title: p.movieTitle, username: user.username });
    if (status === 'approved') ext.onPaymentDecided(p, 'approved');
    res.status(status === 'approved' ? 200 : 202).json({ status });
  });
  app.get('/api/admin/plans', requireAdmin, (req, res) => res.json(getCommerce().plans));
  app.post('/api/admin/plans', requireAdmin, (req, res) => {
    const b = req.body || {}; const name = cleanLine(b.name, 60), days = Math.round(Number(b.days)), price = Number(b.price);
    const currency = b.currency === 'USD' ? 'USD' : 'SYP', account = cleanLine(b.account, 120) || (ext.defaultAccount ? ext.defaultAccount() : '');
    if (!name || !(days >= 1 && days <= 3650) || !(price > 0 && price <= 1e9) || !account) return res.status(400).json({ error: 'أكمل بيانات الخطة (الاسم، المدة، السعر، حساب شام كاش).' });
    const d = getCommerce(); const plan = { id: crypto.randomBytes(5).toString('hex'), name, days, price, currency, account, active: true };
    d.plans.push(plan); saveCommerce(d); res.status(201).json(plan);
  });
  app.delete('/api/admin/plans/:id', requireAdmin, (req, res) => { const d = getCommerce(); d.plans = d.plans.filter(p => p.id !== req.params.id); saveCommerce(d); ok(res); });
  app.get('/api/admin/coupons', requireAdmin, (req, res) => res.json(getCommerce().coupons));
  app.post('/api/admin/coupons', requireAdmin, (req, res) => {
    const b = req.body || {}; const code = String(b.code || '').trim().toUpperCase();
    const percent = Math.round(Number(b.percent)), maxUses = Math.max(0, Math.round(Number(b.maxUses) || 0));
    if (!/^[A-Z0-9_-]{3,24}$/.test(code)) return res.status(400).json({ error: 'الكود: 3–24 حرفاً إنجليزياً أو أرقاماً.' });
    if (!(percent >= 1 && percent <= 100)) return res.status(400).json({ error: 'نسبة الخصم من 1 إلى 100.' });
    const d = getCommerce(); if (d.coupons.some(x => x.code === code)) return res.status(409).json({ error: 'الكود موجود مسبقاً.' });
    const exp = b.expiresAt ? new Date(b.expiresAt) : null;
    const cp = { code, percent, maxUses, used: 0, usedBy: [], scope: ['all', 'movie', 'plan'].includes(b.scope) ? b.scope : 'all', expiresAt: exp && !isNaN(exp) ? exp.toISOString() : null, active: true, createdAt: iso() };
    d.coupons.push(cp); saveCommerce(d); res.status(201).json(cp);
  });
  app.delete('/api/admin/coupons/:code', requireAdmin, (req, res) => { const d = getCommerce(); d.coupons = d.coupons.filter(x => x.code !== req.params.code); saveCommerce(d); ok(res); });
  app.get('/api/admin/subs', requireAdmin, (req, res) => {
    const users = new Map(getUsers().map(u => [u.id, u]));
    res.json(Object.entries(getCommerce().subs).filter(([, s]) => s.until > now()).map(([uid, s]) => ({ userId: uid, username: (users.get(uid) || {}).username || '—', planName: s.planName, until: new Date(s.until).toISOString() })));
  });
  app.post('/api/admin/subs/grant', requireAdmin, (req, res) => {
    const u = byUsername(req.body && req.body.username); const days = Math.round(Number(req.body && req.body.days));
    if (!u) return res.status(404).json({ error: 'المستخدم غير موجود' });
    if (!(days >= 1 && days <= 3650)) return res.status(400).json({ error: 'عدد الأيام من 1 إلى 3650.' });
    grantSub(u.id, null, days); notify(u.id, 'sub_granted', { days }); ok(res);
  });
  app.delete('/api/admin/subs/:uid', requireAdmin, (req, res) => { const d = getCommerce(); delete d.subs[req.params.uid]; saveCommerce(d); ok(res); });

  /* ---------- النشر المجدول والتذكير ---------- */
  ext.isScheduled = m => !!m.publishAt && Date.parse(m.publishAt) > now();
  app.post('/api/movies/:id/remind', sameOrigin, requireUser, (req, res) => {
    const m = getMovies().find(x => x.id === req.params.id);
    if (!m || !ext.isScheduled(m)) return res.status(404).json({ error: 'الفيلم غير موجود' });
    const all = getReminders(); const arr = all[m.id] ||= [];
    const on = !(req.body && req.body.on === false);
    all[m.id] = arr.filter(x => x !== req.user.id); if (on) all[m.id].push(req.user.id);
    saveReminders(all); res.json({ reminding: on });
  });
  app.get('/api/movies/:id/remind', (req, res) => { const u = getUser(req); res.json({ reminding: !!u && (getReminders()[req.params.id] || []).includes(u.id) }); });
  function publishTick() {
    const all = getReminders(); let dirty = false;
    const movies = getMovies();
    for (const id of Object.keys(all)) {
      const m = movies.find(x => x.id === id);
      if (!m) { delete all[id]; dirty = true; continue; }
      if (!ext.isScheduled(m)) { for (const uid of all[id]) notify(uid, 'movie_published', { title: m.title, movieId: m.id }); delete all[id]; dirty = true; }
    }
    if (dirty) saveReminders(all);
  }
  setInterval(publishTick, 60 * 1000).unref();
  app.patch('/api/admin/movies/:id/meta', requireAdmin, (req, res) => {
    const movies = getMovies(); const m = movies.find(x => x.id === req.params.id);
    if (!m) return res.status(404).json({ error: 'الفيلم غير موجود' });
    const b = req.body || {};
    if ('publishAt' in b) { const d = b.publishAt ? new Date(b.publishAt) : null; if (b.publishAt && isNaN(d)) return res.status(400).json({ error: 'تاريخ غير صالح.' }); m.publishAt = d ? d.toISOString() : ''; }
    const sec = v => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n < 86400 ? Math.round(n) : 0; };
    if ('introStart' in b) m.introStart = sec(b.introStart);
    if ('introEnd' in b) m.introEnd = sec(b.introEnd);
    if (m.introEnd && m.introEnd <= (m.introStart || 0)) { m.introStart = 0; m.introEnd = 0; return res.status(400).json({ error: 'نهاية المقدمة يجب أن تكون بعد بدايتها.' }); }
    saveMovies(movies); res.json(c.publicMovie(m));
  });

  /* ---------- شكل الفيلم العام (يُستدعى من publicMovie) ---------- */
  ext.movieExtras = m => {
    const out = {};
    if (ext.isScheduled(m)) out.comingSoon = true;
    if (m.publishAt) out.publishAt = m.publishAt;
    if (m.duration) out.duration = m.duration;
    if (m.introEnd) { out.introStart = m.introStart || 0; out.introEnd = m.introEnd; }
    if (m.renditions && m.renditions.length) out.qualities = m.renditions.map(r => r.h).sort((a, b) => a - b);
    if (m.sprite) out.sprite = m.sprite;
    if (m.processing) out.processing = m.processing;
    if (m.transcribe) out.transcribe = m.transcribe;
    return out;
  };

  /* ---------- تتبع زمن المشاهدة والتحليلات ---------- */
  const SRC = new Set(['home', 'search', 'share', 'related', 'continue', 'shorts', 'channel', 'next', 'direct']);
  app.post('/api/track', sameOrigin, (req, res) => {
    const b = req.body || {};
    if (hit(`track:${req.ip}`, 240, 60 * 1000)) return res.status(429).json({ error: 'x' });
    const kind = b.kind === 'short' ? 'short' : 'movie';
    const id = typeof b.id === 'string' ? b.id.slice(0, 64) : '';
    const exists = kind === 'movie' ? getMovies().some(m => m.id === id) : getShorts().some(s => s.id === id);
    if (!exists) return res.status(404).json({ error: 'x' });
    const secs = Math.max(0, Math.min(120, Number(b.seconds) || 0));
    const src = SRC.has(b.source) ? b.source : 'direct';
    const cc = String(req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || req.headers['x-country-code'] || 'XX').toUpperCase().slice(0, 2).replace(/[^A-Z]/g, '') || 'XX';
    const w = getWatch(); const k = `${kind}:${id}`;
    const it = w.items[k] ||= { secs: 0, plays: 0, replays: 0 };
    it.secs += secs; w.totalSecs += secs;
    const day = new Date().toISOString().slice(0, 10); w.days[day] = (w.days[day] || 0) + secs;
    w.countries[cc] = (w.countries[cc] || 0) + secs;
    if (b.start) { it.plays++; w.plays++; w.sources[src] = (w.sources[src] || 0) + 1; }
    if (b.replay) { it.replays++; w.replays++; }
    const keys = Object.keys(w.days).sort(); while (keys.length > 120) delete w.days[keys.shift()];
    saveWatch(w); res.json({ ok: true });
  });
  app.get('/api/admin/watch-stats', requireAdmin, (req, res) => {
    const w = getWatch(); const movies = new Map(getMovies().map(m => [m.id, m])), shorts = new Map(getShorts().map(s => [s.id, s]));
    const items = Object.entries(w.items).map(([k, v]) => {
      const [kind, id] = [k.slice(0, k.indexOf(':')), k.slice(k.indexOf(':') + 1)];
      const t = kind === 'movie' ? (movies.get(id) || {}).title : (shorts.get(id) || {}).caption;
      return { kind, id, title: t || '(محذوف)', ...v, avg: v.plays ? Math.round(v.secs / v.plays) : 0 };
    }).sort((a, b) => b.secs - a.secs).slice(0, 15);
    const days = []; for (let i = 13; i >= 0; i--) { const d = new Date(now() - i * 86400e3).toISOString().slice(0, 10); days.push({ date: d, secs: Math.round(w.days[d] || 0) }); }
    res.json({
      totalSecs: Math.round(w.totalSecs), plays: w.plays, replays: w.replays, avgSecs: w.plays ? Math.round(w.totalSecs / w.plays) : 0,
      sources: Object.entries(w.sources).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n })),
      countries: Object.entries(w.countries).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([code, secs]) => ({ code, secs: Math.round(secs) })),
      items, days
    });
  });

  /* ---------- البريد: استعادة كلمة المرور وتأكيد البريد ---------- */
  const TOKEN_TTL = { reset: 60 * 60 * 1000, verify: 3 * 24 * 60 * 60 * 1000 };
  function makeToken(userId, type, extra = {}) {
    const raw = crypto.randomBytes(32).toString('hex'); const all = getTokens();
    for (const [k, v] of Object.entries(all)) if (v.exp < now() || (v.userId === userId && v.type === type)) delete all[k];
    all[hashToken(raw)] = { userId, type, exp: now() + TOKEN_TTL[type], ...extra };
    saveTokens(all); return raw;
  }
  function useToken(raw, type) {
    if (typeof raw !== 'string' || raw.length > 100) return null;
    const all = getTokens(); const k = hashToken(raw); const t = all[k];
    if (!t || t.type !== type || t.exp < now()) return null;
    delete all[k]; saveTokens(all); return t;
  }
  const MAILS = {
    ar: { reset: ['إعادة تعيين كلمة المرور', 'اضغط الرابط التالي لتعيين كلمة مرور جديدة (صالح ساعة واحدة). إذا لم تطلب ذلك تجاهل الرسالة:'], verify: ['تأكيد البريد الإلكتروني', 'اضغط الرابط التالي لتأكيد بريدك الإلكتروني:'] },
    en: { reset: ['Reset your password', 'Open this link to set a new password (valid for 1 hour). If you did not ask for this, ignore this email:'], verify: ['Confirm your email', 'Open this link to confirm your email address:'] },
    ru: { reset: ['Сброс пароля', 'Откройте ссылку, чтобы задать новый пароль (действует 1 час). Если вы не запрашивали сброс, проигнорируйте письмо:'], verify: ['Подтверждение почты', 'Откройте ссылку, чтобы подтвердить адрес почты:'] }
  };
  async function mailLink(req, user, type, link) {
    const lang = ['ar', 'en', 'ru'].includes(String(req.headers['x-lang'])) ? req.headers['x-lang'] : 'ar';
    const [subject, line] = MAILS[lang][type];
    const html = `<div style="font-family:sans-serif;direction:${lang === 'ar' ? 'rtl' : 'ltr'}"><p>${line}</p><p><a href="${link}">${link}</a></p></div>`;
    return mailer.sendMail({ to: user.email, subject: `${subject} — سينما أسامة`, text: `${line}\n${link}\n`, html });
  }
  app.post('/api/user/forgot', sameOrigin, async (req, res) => {
    if (hit(`forgot:${req.ip}`, 8, 60 * 60 * 1000)) return res.status(429).json({ error: 'محاولات كثيرة، حاول لاحقاً.' });
    const email = String(req.body && req.body.email || '').trim().toLowerCase();
    // نفس الرد دائماً حتى لا نكشف الحسابات الموجودة
    const user = email && getUsers().find(u => u.email === email);
    if (user && !hit(`forgot-u:${user.id}`, 3, 60 * 60 * 1000)) {
      const raw = makeToken(user.id, 'reset');
      mailLink(req, user, 'reset', `${baseUrl(req)}/?reset=${raw}`).catch(() => {});
    }
    res.json({ success: true, mail: mailer.configured() ? 'smtp' : 'dev' });
  });
  app.post('/api/user/reset', sameOrigin, async (req, res) => {
    if (hit(`reset:${req.ip}`, 20, 60 * 60 * 1000)) return res.status(429).json({ error: 'محاولات كثيرة، حاول لاحقاً.' });
    const t = useToken(req.body && req.body.token, 'reset');
    if (!t) return res.status(400).json({ error: tr(req, 'token_invalid'), code: 'token_invalid' });
    const users = getUsers(); const u = users.find(x => x.id === t.userId);
    if (!u) return res.status(400).json({ error: tr(req, 'token_invalid'), code: 'token_invalid' });
    const problem = passwordProblem(req.body.password, u.username);
    if (problem) { saveTokens({ ...getTokens(), [hashToken(req.body.token)]: t }); return res.status(400).json({ error: problem }); }
    u.salt = crypto.randomBytes(16).toString('hex');
    u.hash = (await scryptAsync(req.body.password, u.salt, 64, SCRYPT_OPTS)).toString('hex');
    saveUsers(users);
    for (const k of Object.keys(userSessions)) if (userSessions[k].userId === u.id) delete userSessions[k];
    persistSessions(); notify(u.id, 'password_changed', {});
    ok(res);
  });
  app.post('/api/user/verify/send', sameOrigin, requireUser, async (req, res) => {
    if (req.user.emailVerified) return ok(res, { verified: true });
    if (rl(req, res, 'verify', 4, 60 * 60 * 1000)) return;
    const raw = makeToken(req.user.id, 'verify', { email: req.user.email });
    const r = await mailLink(req, req.user, 'verify', `${baseUrl(req)}/?verify=${raw}`);
    res.json({ success: true, mail: mailer.configured() ? (r.sent ? 'smtp' : 'failed') : 'dev' });
  });
  app.post('/api/user/verify', sameOrigin, (req, res) => {
    if (hit(`verify-try:${req.ip}`, 30, 60 * 60 * 1000)) return res.status(429).json({ error: 'محاولات كثيرة، حاول لاحقاً.' });
    const t = useToken(req.body && req.body.token, 'verify');
    if (!t) return res.status(400).json({ error: tr(req, 'token_invalid'), code: 'token_invalid' });
    const users = getUsers(); const u = users.find(x => x.id === t.userId);
    if (!u || u.email !== t.email) return res.status(400).json({ error: tr(req, 'token_invalid'), code: 'token_invalid' });
    u.emailVerified = true; saveUsers(users); ok(res);
  });

  /* ---------- معالجة الوسائط (ffmpeg) ---------- */
  const RENDITIONS_DIR = path.join(UPLOADS, 'renditions'), SPRITES_DIR = path.join(UPLOADS, 'sprites');
  fs.mkdirSync(RENDITIONS_DIR, { recursive: true }); fs.mkdirSync(SPRITES_DIR, { recursive: true });
  function patchMovie(id, fn) { const list = getMovies(); const m = list.find(x => x.id === id); if (!m) return null; fn(m); saveMovies(list); return m; }
  function patchShort(id, fn) { const list = getShorts(); const m = list.find(x => x.id === id); if (!m) return null; fn(m); saveShorts(list); return m; }
  const renditionFile = (m, r) => path.join(m.isPaid ? PRIVATE_DIR : RENDITIONS_DIR, path.basename(r.file));

  async function processMovie(id) {
    if (!media.isAvailable()) return;
    let m = getMovies().find(x => x.id === id); if (!m) return;
    patchMovie(id, x => { x.processing = 'working'; });
    try {
      let src = movieFileOf(m); if (!src || !fs.existsSync(src)) throw new Error('الملف غير موجود');
      let info = await media.probe(src); if (!info) throw new Error('تعذر قراءة الفيديو');
      // تحويل الصيغ غير المتوافقة (MOV / HEVC ...) إلى MP4 H.264
      if (media.needsNormalize(info, src)) {
        const dir = path.dirname(src), nb = path.basename(src, path.extname(src)) + '-n.mp4', dst = path.join(dir, nb);
        await media.normalizeMp4(src, dst);
        const old = src; src = dst;
        patchMovie(id, x => { if (x.isPaid) x.videoFile = nb; else x.videoUrl = '/uploads/' + nb; x.fileSize = fs.statSync(dst).size; });
        unlinkQuiet(old); info = await media.probe(src) || info;
      }
      const stamp = id.slice(0, 8);
      const renditions = [];
      for (const h of [360, 720]) {
        if (!(info.height > h + 40)) continue;
        const name = `${stamp}-${h}p.mp4`, dst = path.join(m.isPaid ? PRIVATE_DIR : RENDITIONS_DIR, name);
        await media.rendition(src, dst, h);
        renditions.push({ h, file: name, size: fs.statSync(dst).size });
      }
      let sprite = null;
      if (info.duration > 8) {
        const out = path.join(SPRITES_DIR, `${id}.jpg`);
        const s = await media.sprite(src, out, info.duration);
        sprite = { url: `/uploads/sprites/${id}.jpg`, ...s };
      }
      patchMovie(id, x => { x.duration = Math.round(info.duration); x.renditions = renditions; if (sprite) x.sprite = sprite; x.processing = 'done'; });
    } catch (e) {
      console.error('[media] movie', id, e.message);
      patchMovie(id, x => { x.processing = 'failed'; });
    }
  }
  async function processShort(id) {
    if (!media.isAvailable()) return;
    const s = getShorts().find(x => x.id === id); if (!s) return;
    try {
      let src = path.join(SHORTS_DIR, path.basename(s.videoUrl));
      let info = await media.probe(src); if (!info) return;
      if (media.needsNormalize(info, src)) {
        const nb = path.basename(src, path.extname(src)) + '-n.mp4', dst = path.join(SHORTS_DIR, nb);
        await media.normalizeMp4(src, dst);
        patchShort(id, x => { x.videoUrl = '/uploads/shorts/' + nb; x.size = fs.statSync(dst).size; });
        unlinkQuiet(src); src = dst;
      }
      if (!s.posterUrl) {
        const pn = path.basename(src, path.extname(src)) + '-p.jpg', pd = path.join(SHORTS_DIR, pn);
        await media.posterFrame(src, pd, Math.min(1, Math.max(0, info.duration / 3)));
        if (fs.existsSync(pd)) patchShort(id, x => { x.posterUrl = '/uploads/shorts/' + pn; });
      }
      patchShort(id, x => { x.duration = Math.round(info.duration); });
    } catch (e) { console.error('[media] short', id, e.message); }
  }
  ext.processMovie = id => { setImmediate(() => processMovie(id).catch(() => {})); };
  const shortJobs = new Map();
  ext.processShort = id => { const p = new Promise(r => setImmediate(r)).then(() => processShort(id)).catch(() => {}); shortJobs.set(id, p); p.then(() => shortJobs.delete(id)); };
  ext.whenShortProcessed = id => shortJobs.get(id) || Promise.resolve();
  app.get('/api/movies/:id/rendition/:h', (req, res) => {
    const m = getMovies().find(x => x.id === req.params.id);
    if (!m) return res.status(404).json({ error: 'الفيلم غير موجود' });
    if (!c.hasAccess(req, m)) return res.status(403).json({ error: 'يجب شراء الفيلم أولاً.' });
    const r = (m.renditions || []).find(x => String(x.h) === req.params.h);
    const f = r && renditionFile(m, r);
    if (!f || !fs.existsSync(f)) return res.status(404).json({ error: 'الملف غير موجود' });
    res.setHeader('Cache-Control', 'private, no-store'); res.sendFile(f);
  });
  app.post('/api/admin/movies/:id/process', requireAdmin, (req, res) => {
    if (!media.isAvailable()) return res.status(400).json({ error: 'ffmpeg غير مثبّت على الخادم.' });
    if (!getMovies().some(m => m.id === req.params.id)) return res.status(404).json({ error: 'الفيلم غير موجود' });
    patchMovie(req.params.id, x => { x.processing = 'queued'; }); ext.processMovie(req.params.id); res.status(202).json({ success: true });
  });
  ext.purgeMovie = m => {
    for (const r of m.renditions || []) unlinkQuiet(renditionFile(m, r));
    if (m.sprite) unlinkQuiet(path.join(SPRITES_DIR, path.basename(m.sprite.url)));
    const id = m.id;
    for (const [get, save] of [[getProgress, saveProgress]]) { const a = get(); for (const u of Object.keys(a)) delete a[u][id]; save(a); }
    const l = getLibrary(); for (const u of Object.keys(l)) { const x = l[u]; x.saved = (x.saved || []).filter(i => i !== id); x.history = (x.history || []).filter(i => i !== id); for (const p of x.playlists || []) p.items = p.items.filter(i => i !== id); } saveLibrary(l);
    const r = getReminders(); delete r[id]; saveReminders(r);
    saveReports(getReports().filter(x => !(x.type === 'movie' && x.targetId === id)));
  };
  ext.purgeShort = s => { saveReports(getReports().filter(x => !(x.type === 'short' && x.targetId === s.id))); };

  /* ---------- تفريغ صوتي (Whisper) ---------- */
  const whisperReady = () => !!(process.env.WHISPER_URL || process.env.OPENAI_API_KEY);
  async function transcribe(id, lang) {
    const m0 = getMovies().find(x => x.id === id); if (!m0) return;
    const setState = (status, error) => patchMovie(id, x => { x.transcribe = { status, error: error || '', at: iso() }; });
    setState('working');
    const tmp = path.join(DATA_DIR, `tmp-${id}.mp3`);
    try {
      const src = movieFileOf(m0); if (!src || !fs.existsSync(src)) throw new Error('الملف غير موجود');
      await media.extractAudio(src, tmp);
      const size = fs.statSync(tmp).size;
      if (size > 24 * 1024 * 1024) throw new Error('الصوت أكبر من حد 25MB لخدمة التفريغ.');
      const form = new FormData();
      form.append('file', new Blob([fs.readFileSync(tmp)], { type: 'audio/mpeg' }), 'audio.mp3');
      form.append('model', process.env.WHISPER_MODEL || 'whisper-1');
      form.append('response_format', 'srt');
      if (lang && /^[a-z]{2}$/.test(lang)) form.append('language', lang);
      const url = process.env.WHISPER_URL || 'https://api.openai.com/v1/audio/transcriptions';
      const r = await fetch(url, { method: 'POST', headers: process.env.OPENAI_API_KEY ? { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } : {}, body: form, signal: AbortSignal.timeout(15 * 60 * 1000) });
      const body = await r.text();
      if (!r.ok) throw new Error(`Whisper ${r.status}: ${body.slice(0, 120)}`);
      const cues = parseSubtitles(body);
      if (!cues.length) throw new Error('لم يُنتج التفريغ أي مقاطع.');
      const sid = crypto.randomBytes(8).toString('hex');
      writeJSONAtomic(path.join(SUBS_DIR, sid + '.json'), { cues });
      patchMovie(id, x => { (x.subtitles ||= []).push({ id: sid, lang: lang || 'und', label: 'تلقائي', count: cues.length, createdAt: iso(), auto: true }); });
      setState('done');
    } catch (e) { console.error('[whisper]', e.message); setState('failed', e.message); }
    finally { unlinkQuiet(tmp); }
  }
  app.get('/api/admin/capabilities', requireAdmin, (req, res) => res.json({ ffmpeg: media.isAvailable(), whisper: whisperReady() && media.isAvailable(), smtp: mailer.configured(), backup: true, settings: getSettings() }));
  app.post('/api/admin/movies/:id/transcribe', requireAdmin, (req, res) => {
    if (!media.isAvailable()) return res.status(400).json({ error: 'ffmpeg غير مثبّت على الخادم.' });
    if (!whisperReady()) return res.status(400).json({ error: 'لم يُضبط OPENAI_API_KEY أو WHISPER_URL على الخادم.' });
    const m = getMovies().find(x => x.id === req.params.id); if (!m) return res.status(404).json({ error: 'الفيلم غير موجود' });
    if (m.transcribe && m.transcribe.status === 'working') return res.status(409).json({ error: 'التفريغ جارٍ بالفعل.' });
    const lang = typeof req.body.lang === 'string' && /^[a-z]{2}$/.test(req.body.lang) ? req.body.lang : '';
    patchMovie(m.id, x => { x.transcribe = { status: 'working', error: '', at: iso() }; });
    setImmediate(() => transcribe(m.id, lang)); res.status(202).json({ success: true });
  });

  /* ---------- حدود الرفع والإعدادات ---------- */
  ext.cap = kind => (req, res, next) => {
    const mb = kind === 'short' ? getSettings().maxShortMB : getSettings().maxMovieMB;
    const len = Number(req.headers['content-length'] || 0);
    if (len && len > mb * 1024 * 1024 + 2 * 1024 * 1024) return res.status(413).json({ error: kind === 'short' ? tr(req, 'file_too_large') : `حجم الملف أكبر من الحد المسموح (${mb}MB).`, code: 'file_too_large' });
    next();
  };
  app.get('/api/admin/settings', requireAdmin, (req, res) => res.json(getSettings()));
  app.put('/api/admin/settings', requireAdmin, (req, res) => {
    const n = (v, lo, hi, d) => { v = Math.round(Number(v)); return Number.isFinite(v) && v >= lo && v <= hi ? v : d; };
    const cur = getSettings();
    saveSettings({ ...readJSON(F('settings.json'), {}), maxMovieMB: n(req.body && req.body.maxMovieMB, 10, 20480, cur.maxMovieMB), maxShortMB: n(req.body && req.body.maxShortMB, 1, 1024, cur.maxShortMB) });
    res.json(getSettings());
  });

  /* ---------- النسخ الاحتياطي ---------- */
  const backups = backupLib.make({ ROOT, DATA_DIR, UPLOADS });
  backups.schedule();
  app.get('/api/admin/backups', requireAdmin, (req, res) => res.json({ items: backups.list(), everyHours: Number(process.env.BACKUP_EVERY_HOURS || 24), keep: Number(process.env.BACKUP_KEEP || 7) }));
  app.post('/api/admin/backups', requireAdmin, async (req, res) => {
    if (hit(`backup:${req.ip}`, 6, 60 * 60 * 1000)) return res.status(429).json({ error: 'محاولات كثيرة، حاول لاحقاً.' });
    try { res.status(201).json(await backups.create()); } catch (e) { res.status(500).json({ error: 'تعذر إنشاء النسخة: ' + e.message }); }
  });
  app.get('/api/admin/backups/:name', requireAdmin, (req, res) => { const f = backups.path(req.params.name); if (!f || !fs.existsSync(f)) return res.status(404).json({ error: 'غير موجود' }); res.download(f, req.params.name); });
  app.delete('/api/admin/backups/:name', requireAdmin, (req, res) => backups.remove(req.params.name) ? ok(res) : res.status(404).json({ error: 'غير موجود' }));

  /* ---------- مساعدات للإدارة: المستخدمون ---------- */
  app.get('/api/admin/users', requireAdmin, (req, res) => {
    const subs = getCommerce().subs;
    res.json(getUsers().map(u => ({ username: u.username, email: u.email || '', verified: !!u.emailVerified, createdAt: u.createdAt, sub: subs[u.id] && subs[u.id].until > now() ? subs[u.id].planName : '' })).slice(-300).reverse());
  });
};

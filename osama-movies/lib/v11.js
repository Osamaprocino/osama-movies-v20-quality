/* ===================================================================
   الإضافات (الإصدار 11) — فوق v10 دون تعديل منطقه، عبر نفس نمط ext:
   كتالوج متقدم + مسلسلات • تقييمات ومراجعات • قوائم الرئيسية والتوصيات
   وضع الأطفال + PIN + قفل عمري • حظر/كتم • كلمات محظورة • تعليقات (@ ، تثبيت)
   محفوظات Shorts وقوائمها • لوحة المبدع
   (الجزء الثاني في v11b: مشاهدة جماعية، Push، دخول Google/Telegram، إشراف، CSV)
   =================================================================== */
const path = require('path');
const crypto = require('crypto');

module.exports = function registerV11(c) {
  const { app, ext, readJSON, writeJSONAtomic, getUser, requireUser, requireAdmin, sameOrigin, hit, tr, cleanLine, cleanBlock,
    getMovies, saveMovies, getShorts, saveShorts, getUsers, saveUsers, getComments, saveComments, getSocial,
    publicMovie, shapeShort, shortsCtx, authorOf, userMap, scryptAsync, SCRYPT_OPTS, getSession, DATA_DIR, hasAccess } = c;

  const F = n => path.join(DATA_DIR, n);
  const now = () => Date.now();
  const iso = () => new Date().toISOString();
  const ok = (res, extra = {}) => res.json({ success: true, ...extra });
  const rl = (req, res, key, max, ms) => { if (hit(`${key}:${req.user ? req.user.id : req.ip}`, max, ms)) { res.status(429).json({ error: tr(req, 'too_many') }); return true; } return false; };
  const byUsername = n => { n = String(n || '').toLowerCase(); return getUsers().find(u => u.usernameLower === n); };
  const J = (file, fb) => () => readJSON(F(file), fb);
  const S = file => v => writeJSONAtomic(F(file), v);

  /* ---------- إعدادات الإضافة (ملف مستقل كي لا نلمس settings.json) ---------- */
  const DEFAULTS = { bannedWords: [], moderation: { on: false }, report: { on: false, to: '', day: 1, hour: 8, lastSent: '' }, push: { enabled: true } };
  const getCfg = () => { const d = readJSON(F('settings2.json'), {}); return { ...DEFAULTS, ...d, moderation: { ...DEFAULTS.moderation, ...(d.moderation || {}) }, report: { ...DEFAULTS.report, ...(d.report || {}) }, push: { ...DEFAULTS.push, ...(d.push || {}) }, bannedWords: Array.isArray(d.bannedWords) ? d.bannedWords : [] }; };
  const saveCfg = S('settings2.json');
  c.getCfg = getCfg; c.saveCfg = saveCfg;

  /* ---------- كلمات محظورة ---------- */
  const norm = s => String(s || '').toLowerCase().normalize('NFKD')
    .replace(/[ً-ٰٟـ]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[̀-ͯ]/g, '');
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let bwCache = { key: '', re: null };
  function bannedRegex() {
    const words = getCfg().bannedWords.map(norm).filter(Boolean);
    const key = words.join('\n');
    if (bwCache.key !== key) bwCache = { key, re: words.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${words.map(esc).join('|')})(?![\\p{L}\\p{N}])`, 'u') : null };
    return bwCache.re;
  }
  const hasBanned = text => { const re = bannedRegex(); return !!re && re.test(norm(text)); };
  c.hasBanned = hasBanned;

  /* ---------- الكتالوج المتقدم ---------- */
  const AGE_STEPS = [0, 7, 10, 13, 16, 18];
  const list = (v, max, len) => {
    const a = Array.isArray(v) ? v : String(v == null ? '' : v).split(/[,،\n]/);
    return [...new Set(a.map(x => cleanLine(String(x).trim().replace(/^#/, ''), len)).filter(Boolean))].slice(0, max);
  };
  /* يعيد { set, clear } من جسم الطلب: الحقل الفارغ يعني مسحه */
  function parseCatalog(b) {
    b = b || {}; const set = {}, clear = [];
    const has = k => Object.prototype.hasOwnProperty.call(b, k);
    const empty = k => b[k] === '' || b[k] === null;
    const put = (k, fn) => { if (!has(k)) return; if (empty(k)) { clear.push(k); return; } const v = fn(b[k]); if (v === undefined || (Array.isArray(v) && !v.length)) clear.push(k); else set[k] = v; };
    put('cast', v => list(v, 20, 60));
    put('tags', v => list(v, 15, 30));
    put('director', v => cleanLine(v, 80) || undefined);
    put('country', v => cleanLine(v, 60) || undefined);
    put('language', v => cleanLine(v, 40) || undefined);
    put('series', v => cleanLine(v, 100) || undefined);
    const int = (v, lo, hi) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= lo && n <= hi ? n : undefined; };
    put('year', v => int(v, 1888, new Date().getFullYear() + 2));
    put('season', v => int(v, 1, 99));
    put('episode', v => int(v, 1, 999));
    put('featured', v => (v === true || v === 'true' || v === '1' || v === 1) ? true : undefined);
    put('chapters', v => {
      let arr = v; if (typeof v === 'string') { try { arr = JSON.parse(v); } catch { arr = v.split('\n').map(l => { const m = /^\s*(?:(\d+):)?(\d{1,2}):(\d{2})\s+(.+)$/.exec(l); return m ? { t: (+m[1] || 0) * 3600 + +m[2] * 60 + +m[3], title: m[4] } : null; }); } }
      if (!Array.isArray(arr)) return undefined;
      const out = arr.filter(x => x && Number.isFinite(+x.t) && +x.t >= 0 && +x.t < 86400 && cleanLine(x.title, 60)).map(x => ({ t: Math.round(+x.t), title: cleanLine(x.title, 60) })).sort((a, b) => a.t - b.t).slice(0, 60);
      return out.length ? out : undefined;
    });
    put('ageRating', v => { const n = parseInt(v, 10); return AGE_STEPS.includes(n) ? n : undefined; });
    return { set, clear };
  }
  ext.catalogFrom = b => parseCatalog(b).set;
  const seriesKey = m => String(m.series || '').trim().toLowerCase();
  const visible = m => !(ext.isScheduled && ext.isScheduled(m));

  app.patch('/api/admin/movies/:id/catalog', requireAdmin, (req, res) => {
    const movies = getMovies(); const m = movies.find(x => x.id === req.params.id);
    if (!m) return res.status(404).json({ error: 'الفيلم غير موجود' });
    const { set, clear } = parseCatalog(req.body);
    Object.assign(m, set); for (const k of clear) delete m[k];
    saveMovies(movies); res.json(publicMovie(m));
  });
  app.get('/api/catalog/facets', (req, res) => {
    const ms = getMovies().filter(visible);
    const cnt = (arr) => { const o = {}; for (const x of arr) if (x) o[x] = (o[x] || 0) + 1; return Object.entries(o).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n })); };
    res.json({
      years: cnt(ms.map(m => m.year)).sort((a, b) => b.name - a.name), categories: cnt(ms.map(m => m.category)),
      directors: cnt(ms.map(m => m.director)), cast: cnt(ms.flatMap(m => m.cast || [])).slice(0, 60), tags: cnt(ms.flatMap(m => m.tags || [])).slice(0, 60),
      countries: cnt(ms.map(m => m.country)), languages: cnt(ms.map(m => m.language))
    });
  });

  /* ---------- مسلسلات: مواسم وحلقات ---------- */
  function episodesOf(m) {
    const k = seriesKey(m); if (!k) return [];
    return getMovies().filter(x => seriesKey(x) === k && visible(x))
      .sort((a, b) => (a.season || 1) - (b.season || 1) || (a.episode || 0) - (b.episode || 0) || a.createdAt.localeCompare(b.createdAt));
  }
  const nextOf = m => { const e = episodesOf(m); const i = e.findIndex(x => x.id === m.id); return i >= 0 && i < e.length - 1 ? e[i + 1] : null; };
  const brief = x => ({ id: x.id, title: x.title, season: x.season || 1, episode: x.episode || 0, posterUrl: x.posterUrl, duration: x.duration || 0 });
  app.get('/api/series', (req, res) => {
    const groups = new Map();
    for (const m of getMovies().filter(visible)) { const k = seriesKey(m); if (!k) continue; (groups.get(k) || groups.set(k, []).get(k)).push(m); }
    const out = [...groups.values()].map(g => {
      g.sort((a, b) => (a.season || 1) - (b.season || 1) || (a.episode || 0) - (b.episode || 0));
      return { title: g[0].series, posterUrl: g[0].posterUrl, episodes: g.length, seasons: new Set(g.map(x => x.season || 1)).size, firstId: g[0].id };
    });
    res.json(ext.filterMovies ? out.filter(s => ext.filterMovies(getMovies().filter(m => m.id === s.firstId), req).length) : out);
  });
  app.get('/api/movies/:id/series', (req, res) => {
    const m = getMovies().find(x => x.id === req.params.id);
    if (!m) return res.status(404).json({ error: 'الفيلم غير موجود' });
    const eps = episodesOf(m);
    if (!eps.length) return res.json({ series: null });
    const seasons = {}; for (const e of eps) (seasons[e.season || 1] ||= []).push(brief(e));
    const i = eps.findIndex(x => x.id === m.id);
    res.json({ series: m.series, seasons: Object.entries(seasons).map(([n, list]) => ({ n: Number(n), episodes: list })), prev: i > 0 ? brief(eps[i - 1]) : null, next: i >= 0 && i < eps.length - 1 ? brief(eps[i + 1]) : null });
  });

  /* ---------- التقييمات والمراجعات ---------- */
  const readRatings = J('ratings.json', {});
  let ratings = null;
  const getRatings = () => (ratings ||= readRatings());
  const saveRatings = () => writeJSONAtomic(F('ratings.json'), ratings);
  function ratingStats(mid) {
    const e = Object.values(getRatings()[mid] || {});
    const dist = [0, 0, 0, 0, 0]; let sum = 0;
    for (const r of e) { dist[r.stars - 1]++; sum += r.stars; }
    return { avg: e.length ? Math.round((sum / e.length) * 10) / 10 : 0, count: e.length, dist };
  }
  const prevMovieExtras = ext.movieExtras;
  ext.movieExtras = m => {
    const out = prevMovieExtras ? prevMovieExtras(m) : {};
    const r = getRatings()[m.id];
    if (r) { const s = ratingStats(m.id); if (s.count) out.rating = { avg: s.avg, count: s.count }; }
    return out;
  };
  const findMovie = id => getMovies().find(m => m.id === id);
  app.get('/api/movies/:id/ratings', (req, res) => {
    const m = findMovie(req.params.id); if (!m) return res.status(404).json({ error: 'الفيلم غير موجود' });
    const me = getUser(req), users = userMap(), all = getRatings()[m.id] || {};
    const blocked = me ? blockedSet(me.id) : new Set();
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0), limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const reviews = Object.entries(all).filter(([uid, r]) => r.review && !blocked.has(uid))
      .sort((a, b) => (b[1].updatedAt || '').localeCompare(a[1].updatedAt || ''));
    res.json({
      ...ratingStats(m.id), mine: me && all[me.id] ? { stars: all[me.id].stars, review: all[me.id].review || '' } : null,
      reviews: reviews.slice(offset, offset + limit).map(([uid, r]) => ({ userId: undefined, username: (users.get(uid) || {}).username || '', author: authorOf(users.get(uid)), stars: r.stars, review: r.review, updatedAt: r.updatedAt, mine: !!me && uid === me.id })),
      hasMore: offset + limit < reviews.length
    });
  });
  app.post('/api/movies/:id/rate', sameOrigin, requireUser, async (req, res) => {
    const m = findMovie(req.params.id); if (!m) return res.status(404).json({ error: 'الفيلم غير موجود' });
    if (rl(req, res, 'rate', 20, 60 * 1000)) return;
    const stars = parseInt(req.body && req.body.stars, 10);
    if (!(stars >= 1 && stars <= 5)) return res.status(400).json({ error: tr(req, 'rate_invalid'), code: 'rate_invalid' });
    const review = cleanBlock(req.body && req.body.review, 600);
    if (review) {
      if (hasBanned(review)) return res.status(422).json({ error: tr(req, 'banned_word'), code: 'banned_word' });
      if (ext.moderateText) { const bad = await ext.moderateText(review); if (bad) return res.status(422).json({ error: tr(req, 'moderated'), code: 'moderated' }); }
    }
    const all = getRatings(); const e = (all[m.id] ||= {}); const prev = e[req.user.id];
    e[req.user.id] = { stars, review, createdAt: prev ? prev.createdAt : iso(), updatedAt: iso() };
    saveRatings();
    res.json({ ...ratingStats(m.id), mine: { stars, review } });
  });
  app.delete('/api/movies/:id/rate', sameOrigin, requireUser, (req, res) => {
    const all = getRatings(); if (all[req.params.id]) { delete all[req.params.id][req.user.id]; if (!Object.keys(all[req.params.id]).length) delete all[req.params.id]; saveRatings(); }
    res.json({ ...ratingStats(req.params.id), mine: null });
  });
  app.delete('/api/admin/reviews/:mid/:uid', requireAdmin, (req, res) => {
    const all = getRatings(); const e = all[req.params.mid];
    if (!e || !e[req.params.uid]) return res.status(404).json({ error: 'غير موجود' });
    e[req.params.uid].review = ''; e[req.params.uid].updatedAt = iso(); saveRatings(); ok(res);
  });
  app.get('/api/admin/reviews', requireAdmin, (req, res) => {
    const users = userMap(), movies = new Map(getMovies().map(m => [m.id, m])), out = [];
    for (const [mid, e] of Object.entries(getRatings())) for (const [uid, r] of Object.entries(e)) if (r.review) out.push({ movieId: mid, userId: uid, movie: (movies.get(mid) || {}).title || '—', username: (users.get(uid) || {}).username || '—', stars: r.stars, review: r.review, updatedAt: r.updatedAt });
    res.json(out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 200));
  });
  const prevPurgeMovie = ext.purgeMovie;
  ext.purgeMovie = m => { if (prevPurgeMovie) prevPurgeMovie(m); const all = getRatings(); if (all[m.id]) { delete all[m.id]; saveRatings(); } };

  /* ---------- حظر وكتم ---------- */
  const getBlocks = J('blocks.json', {}), saveBlocks = S('blocks.json');
  const blockedSet = uid => { const b = getBlocks()[uid]; return new Set([...(b ? b.blocked || [] : []), ...(b ? b.muted || [] : [])]); };
  ext.isBlockedBy = (userId, otherId) => { const b = getBlocks()[userId]; return !!b && (b.blocked || []).includes(otherId); };
  const blockRoute = (kind, on) => (req, res) => {
    const u = byUsername(req.params.username); if (!u) return res.status(404).json({ error: tr(req, 'target_not_found') });
    if (u.id === req.user.id) return res.status(400).json({ error: tr(req, 'forbidden') });
    if (rl(req, res, 'block', 30, 60 * 1000)) return;
    const all = getBlocks(); const b = (all[req.user.id] ||= { blocked: [], muted: [] }); b.blocked ||= []; b.muted ||= [];
    b[kind] = b[kind].filter(x => x !== u.id); if (on) b[kind].push(u.id);
    saveBlocks(all);
    if (on && kind === 'blocked') { // الحظر يلغي المتابعة في الاتجاهين
      const f = readJSON(F('follows.json'), {});
      if (f[req.user.id]) f[req.user.id] = f[req.user.id].filter(x => x !== u.id);
      if (f[u.id]) f[u.id] = f[u.id].filter(x => x !== req.user.id);
      writeJSONAtomic(F('follows.json'), f);
    }
    ok(res, { blocked: b.blocked.includes(u.id), muted: b.muted.includes(u.id) });
  };
  app.post('/api/users/:username/block', sameOrigin, requireUser, blockRoute('blocked', true));
  app.delete('/api/users/:username/block', sameOrigin, requireUser, blockRoute('blocked', false));
  app.post('/api/users/:username/mute', sameOrigin, requireUser, blockRoute('muted', true));
  app.delete('/api/users/:username/mute', sameOrigin, requireUser, blockRoute('muted', false));
  app.get('/api/user/blocks', requireUser, (req, res) => {
    const b = getBlocks()[req.user.id] || {}, users = userMap();
    const shape = ids => (ids || []).map(id => users.get(id)).filter(Boolean).map(u => ({ username: u.username, displayName: u.displayName || u.username, avatarUrl: u.avatarUrl || '' }));
    res.json({ blocked: shape(b.blocked), muted: shape(b.muted) });
  });
  app.get('/api/users/:username/relation', (req, res) => {
    const me = getUser(req), u = byUsername(req.params.username);
    if (!u) return res.status(404).json({ error: tr(req, 'target_not_found') });
    const b = me ? getBlocks()[me.id] || {} : {};
    res.json({ blocked: (b.blocked || []).includes(u.id), muted: (b.muted || []).includes(u.id) });
  });

  /* ---------- وضع الأطفال + PIN + قفل عمري ---------- */
  const kidsOn = u => !!u && !!u.kids && !!u.kids.on;
  ext.kidsBlocked = kidsOn;
  ext.ageBlocked = (u, m) => {
    const a = m.ageRating;
    if (kidsOn(u)) return typeof a !== 'number' || a > (u.kids.maxAge || 7);
    if (u && u.age && typeof a === 'number' && a > u.age) return true;
    return false;
  };
  ext.filterMovies = (movies, req) => { const u = getUser(req); return kidsOn(u) ? movies.filter(m => !ext.ageBlocked(u, m)) : movies; };
  const pinOk = async (rec, pin) => {
    if (!rec.kids || !rec.kids.hash || typeof pin !== 'string' || pin.length > 12) return false;
    const h = await scryptAsync(pin, rec.kids.salt, 64, SCRYPT_OPTS);
    return crypto.timingSafeEqual(h, Buffer.from(rec.kids.hash, 'hex'));
  };
  const passOk = async (rec, pw) => {
    if (typeof pw !== 'string' || pw.length > 128 || !rec.hash) return false;
    const h = await scryptAsync(pw, rec.salt, 64, SCRYPT_OPTS); return crypto.timingSafeEqual(h, Buffer.from(rec.hash, 'hex'));
  };
  const setPin = async (rec, pin) => { const salt = crypto.randomBytes(16).toString('hex'); rec.kids = { ...(rec.kids || {}), salt, hash: (await scryptAsync(pin, salt, 64, SCRYPT_OPTS)).toString('hex') }; };
  app.post('/api/user/kids', sameOrigin, requireUser, async (req, res) => {
    const b = req.body || {}, users = getUsers(), rec = users.find(x => x.id === req.user.id);
    const maxAge = [7, 10, 13].includes(parseInt(b.maxAge, 10)) ? parseInt(b.maxAge, 10) : (rec.kids && rec.kids.maxAge) || 10;
    const hasPin = !!(rec.kids && rec.kids.hash), on = !!b.on, was = kidsOn(rec);
    const bad = () => res.status(403).json({ error: tr(req, 'kids_pin_bad'), code: 'kids_pin_bad' });
    if (on && !was) {
      if (!hasPin) {
        if (!/^\d{4,6}$/.test(String(b.pin || ''))) return res.status(400).json({ error: tr(req, 'kids_pin_needed'), code: 'kids_pin_needed' });
        await setPin(rec, String(b.pin));
      }
      rec.kids = { ...rec.kids, on: true, maxAge };
    } else {
      // أي تغيير أثناء التفعيل (إيقاف أو تغيير العمر) يتطلب PIN أو كلمة مرور الحساب
      if (was) {
        if (hit(`kidspin:${rec.id}`, 6, 10 * 60 * 1000)) return res.status(429).json({ error: tr(req, 'too_many') });
        if (!(await pinOk(rec, String(b.pin || ''))) && !(await passOk(rec, b.password))) return bad();
      }
      rec.kids = { ...(rec.kids || {}), on, maxAge };
    }
    saveUsers(users);
    res.json({ success: true, user: c.publicUser(rec) });
  });
  app.post('/api/user/kids/pin', sameOrigin, requireUser, async (req, res) => {
    const b = req.body || {}, users = getUsers(), rec = users.find(x => x.id === req.user.id);
    if (!/^\d{4,6}$/.test(String(b.newPin || ''))) return res.status(400).json({ error: tr(req, 'kids_pin_needed'), code: 'kids_pin_needed' });
    if (rec.kids && rec.kids.hash) {
      if (hit(`kidspin:${rec.id}`, 6, 10 * 60 * 1000)) return res.status(429).json({ error: tr(req, 'too_many') });
      if (!(await pinOk(rec, String(b.pin || ''))) && !(await passOk(rec, b.password))) return res.status(403).json({ error: tr(req, 'kids_pin_bad'), code: 'kids_pin_bad' });
    }
    await setPin(rec, String(b.newPin)); saveUsers(users); res.json({ success: true, user: c.publicUser(rec) });
  });
  app.get('/api/movies/:id/age-lock', (req, res) => {
    const m = findMovie(req.params.id); if (!m) return res.status(404).json({ error: 'الفيلم غير موجود' });
    const u = getUser(req), blocked = ext.ageBlocked(u, m);
    res.json({ blocked, reason: blocked ? (kidsOn(u) ? 'kids' : 'age') : null, need: typeof m.ageRating === 'number' ? m.ageRating : null });
  });

  /* ---------- التعليقات: حماية، @إشارات، تثبيت، إغلاق التعليقات ---------- */
  const shortOwner = (ctx, id) => { ctx._so ||= new Map(getShorts().map(s => [s.id, s.userId])); return ctx._so.get(id); };
  ext.canPin = (ctx, cm) => !cm.parentId && (ctx.admin || (cm.type === 'short' && !!ctx.user && shortOwner(ctx, cm.targetId) === ctx.user.id));
  ext.filterComments = (all, user) => {
    if (!user) return all;
    const bl = blockedSet(user.id); if (!bl.size) return all;
    const gone = new Set(all.filter(x => bl.has(x.userId)).map(x => x.id));
    return all.filter(x => !gone.has(x.id) && !gone.has(x.parentId));
  };
  ext.commentGuard = async (req, type, id, text) => {
    const u = req.user;
    if (kidsOn(u)) return { status: 403, error: tr(req, 'forbidden'), code: 'forbidden' };
    if (type === 'short') {
      const s = getShorts().find(x => x.id === id);
      if (s && s.commentsOff) return { status: 403, error: tr(req, 'comments_off'), code: 'comments_off' };
      if (s && ext.isBlockedBy(s.userId, u.id)) return { status: 403, error: tr(req, 'forbidden'), code: 'forbidden' };
    }
    if (hasBanned(text)) return { status: 422, error: tr(req, 'banned_word'), code: 'banned_word' };
    if (ext.moderateText && await ext.moderateText(text)) return { status: 422, error: tr(req, 'moderated'), code: 'moderated' };
    return null;
  };
  ext.afterComment = (cm, req) => {
    const names = [...new Set((cm.text.match(/@([\p{L}\p{N}_.-]{3,24})/gu) || []).map(x => x.slice(1).toLowerCase()))].slice(0, 5);
    if (!names.length || !ext.notify) return;
    const t = cm.type === 'movie' ? findMovie(cm.targetId) : getShorts().find(s => s.id === cm.targetId);
    for (const n of names) {
      const u = byUsername(n); if (!u || u.id === req.user.id) continue;
      ext.notify(u.id, 'mention', { fromId: req.user.id, name: req.user.displayName || req.user.username, targetType: cm.type, targetId: cm.targetId, title: String((t && (t.title || t.caption)) || '').slice(0, 80) });
    }
  };
  app.get('/api/users/suggest', (req, res) => {
    const q = String(req.query.q || '').toLowerCase().replace(/^@/, '').slice(0, 24); if (q.length < 1) return res.json([]);
    res.json(getUsers().filter(u => u.usernameLower.startsWith(q)).slice(0, 6).map(u => ({ username: u.username, displayName: u.displayName || u.username, avatarUrl: u.avatarUrl || '' })));
  });
  app.post('/api/comment/:cid/pin', sameOrigin, requireUser, (req, res) => {
    const cms = getComments(); const cm = cms.find(x => x.id === req.params.cid);
    if (!cm) return res.status(404).json({ error: tr(req, 'comment_not_found') });
    const ctx = { user: req.user, admin: !!getSession(req) };
    if (!ext.canPin(ctx, cm)) return res.status(403).json({ error: tr(req, 'forbidden'), code: 'forbidden' });
    const on = !cm.pinned;
    for (const x of cms) if (x.type === cm.type && x.targetId === cm.targetId) delete x.pinned;
    if (on) cm.pinned = true;
    saveComments(cms); ok(res, { pinned: on });
  });
  app.patch('/api/shorts/:id/settings', sameOrigin, requireUser, (req, res) => {
    const list = getShorts(); const s = list.find(x => x.id === req.params.id);
    if (!s) return res.status(404).json({ error: tr(req, 'short_not_found') });
    if (s.userId !== req.user.id) return res.status(403).json({ error: tr(req, 'forbidden'), code: 'forbidden' });
    if (req.body && 'commentsOff' in req.body) { if (req.body.commentsOff) s.commentsOff = true; else delete s.commentsOff; }
    saveShorts(list); ok(res, { commentsOff: !!s.commentsOff });
  });

  /* ---------- محفوظات Shorts وقوائمها ---------- */
  const getSV = J('shortsaved.json', {}), saveSV = S('shortsaved.json');
  const svOf = (all, uid) => { const e = (all[uid] ||= {}); e.saved ||= []; e.lists ||= []; return e; };
  ext.shortExtras = (s, ctx) => {
    const out = {};
    if (s.commentsOff) out.commentsOff = true;
    if (s.hidden && ctx.user && ctx.user.id === s.userId) { out.hidden = true; out.modReason = s.modReason || ''; }
    if (ctx.user) { ctx._sv ||= new Set(svOf(getSV(), ctx.user.id).saved); out.saved = ctx._sv.has(s.id); }
    return out;
  };
  const prevFilterShorts = ext.filterShorts;
  ext.filterShorts = (list, req) => {
    const u = getUser(req);
    list = list.filter(s => !s.hidden || (u && u.id === s.userId));
    if (u) { const bl = blockedSet(u.id); if (bl.size) list = list.filter(s => !bl.has(s.userId)); }
    if (req.query.feed === 'saved') {
      const ids = u ? svOf(getSV(), u.id).saved : [];
      list = ids.map(id => list.find(s => s.id === id)).filter(Boolean); // بترتيب الحفظ
      return list;
    }
    return prevFilterShorts ? prevFilterShorts(list, req) : list;
  };
  const existsShort = id => getShorts().some(s => s.id === id && !s.hidden);
  app.post('/api/shorts/:id/save', sameOrigin, requireUser, (req, res) => {
    if (!existsShort(req.params.id)) return res.status(404).json({ error: tr(req, 'short_not_found') });
    const all = getSV(), e = svOf(all, req.user.id), on = !(req.body && req.body.on === false);
    e.saved = e.saved.filter(x => x !== req.params.id); if (on) e.saved.unshift(req.params.id);
    e.saved = e.saved.slice(0, 500); saveSV(all); ok(res, { saved: on });
  });
  app.get('/api/user/short-lists', requireUser, (req, res) => {
    const e = svOf(getSV(), req.user.id), ids = new Set(getShorts().map(s => s.id));
    res.json({ saved: e.saved.filter(i => ids.has(i)).length, lists: e.lists.map(l => ({ id: l.id, name: l.name, count: l.items.filter(i => ids.has(i)).length, items: l.items.filter(i => ids.has(i)) })) });
  });
  app.post('/api/user/short-lists', sameOrigin, requireUser, (req, res) => {
    const name = cleanLine(req.body && req.body.name, 40); if (!name) return res.status(400).json({ error: tr(req, 'name_required') });
    const all = getSV(), e = svOf(all, req.user.id); if (e.lists.length >= 30) return res.status(400).json({ error: tr(req, 'too_many') });
    const l = { id: crypto.randomUUID(), name, items: [] }; e.lists.push(l); saveSV(all); res.status(201).json(l);
  });
  const withList = fn => (req, res) => { const all = getSV(), e = svOf(all, req.user.id), l = e.lists.find(x => x.id === req.params.lid); if (!l) return res.status(404).json({ error: tr(req, 'target_not_found') }); fn(req, res, l, e, all); };
  app.patch('/api/user/short-lists/:lid', sameOrigin, requireUser, withList((req, res, l, e, all) => { const n = cleanLine(req.body && req.body.name, 40); if (n) l.name = n; saveSV(all); ok(res); }));
  app.delete('/api/user/short-lists/:lid', sameOrigin, requireUser, withList((req, res, l, e, all) => { e.lists = e.lists.filter(x => x !== l); saveSV(all); ok(res); }));
  app.post('/api/user/short-lists/:lid/items', sameOrigin, requireUser, withList((req, res, l, e, all) => {
    const id = req.body && req.body.shortId; if (!existsShort(id)) return res.status(404).json({ error: tr(req, 'short_not_found') });
    l.items = [id, ...l.items.filter(x => x !== id)].slice(0, 300); saveSV(all); ok(res, { count: l.items.length });
  }));
  app.delete('/api/user/short-lists/:lid/items/:sid', sameOrigin, requireUser, withList((req, res, l, e, all) => { l.items = l.items.filter(x => x !== req.params.sid); saveSV(all); ok(res, { count: l.items.length }); }));
  app.get('/api/user/short-lists/:lid/shorts', requireUser, withList((req, res, l) => {
    const ctx = shortsCtx(req), map = new Map(getShorts().filter(s => !s.hidden).map(s => [s.id, s]));
    res.json({ id: l.id, name: l.name, items: l.items.map(i => map.get(i)).filter(Boolean).map(s => shapeShort(s, ctx)) });
  }));
  const prevPurgeShort = ext.purgeShort;
  ext.purgeShort = s => {
    if (prevPurgeShort) prevPurgeShort(s);
    const all = getSV(); let d = false;
    for (const e of Object.values(all)) { if ((e.saved || []).includes(s.id)) { e.saved = e.saved.filter(x => x !== s.id); d = true; } for (const l of e.lists || []) if (l.items.includes(s.id)) { l.items = l.items.filter(x => x !== s.id); d = true; } }
    if (d) saveSV(all);
  };
  ext.unhideShort = id => { const l = getShorts(); const s = l.find(x => x.id === id); if (s && s.hidden) { delete s.hidden; delete s.modReason; saveShorts(l); } };

  /* ---------- قوائم الرئيسية والتوصيات ---------- */
  const getLibrary = J('library.json', {}), getProgress = J('progress.json', {});
  function similarity(a, b) {
    let s = 0;
    if (a.category && a.category === b.category) s += 3;
    if (seriesKey(a) && seriesKey(a) === seriesKey(b)) s += 6;
    if (a.director && a.director === b.director) s += 3;
    for (const x of a.cast || []) if ((b.cast || []).includes(x)) s += 2;
    for (const x of a.tags || []) if ((b.tags || []).map(t => t.toLowerCase()).includes(String(x).toLowerCase())) s += 1.5;
    if (a.country && a.country === b.country) s += 0.5;
    if (a.year && b.year) s += Math.max(0, 1 - Math.abs(a.year - b.year) / 20);
    return s;
  }
  const allowed = (req, ms) => ext.filterMovies(ms.filter(visible), req);
  app.get('/api/movies/:id/similar', (req, res) => {
    const m = findMovie(req.params.id); if (!m) return res.status(404).json({ error: 'الفيلم غير موجود' });
    const items = allowed(req, getMovies()).filter(x => x.id !== m.id).map(x => [x, similarity(m, x)]).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([x]) => x.id);
    res.json({ items });
  });
  app.get('/api/home/lists', (req, res) => {
    const me = getUser(req), ms = allowed(req, getMovies()), byId = new Map(ms.map(m => [m.id, m]));
    const rows = [], seen = new Set();
    const push = (key, ids, extra = {}) => { ids = [...new Set(ids)].filter(id => byId.has(id)).slice(0, 14); if (ids.length >= 2 || (key === 'next_up' && ids.length)) rows.push({ key, ids, ...extra }); };
    const lib = me ? (getLibrary()[me.id] || {}) : {}, hist = (lib.history || []).filter(id => byId.has(id));
    if (me) {
      const prog = getProgress()[me.id] || {};
      const nextUp = [];
      for (const id of hist.slice(0, 15)) {
        const m = byId.get(id), p = prog[id]; if (!m || !seriesKey(m)) continue;
        if (p && p.d && p.t / p.d < 0.9) continue;
        const n = nextOf(m); if (n && byId.has(n.id) && !hist.includes(n.id) && !nextUp.includes(n.id)) nextUp.push(n.id);
      }
      push('next_up', nextUp);
      if (hist.length) {
        const base = byId.get(hist[0]);
        push('because', ms.filter(x => x.id !== base.id && !hist.includes(x.id)).map(x => [x, similarity(base, x)]).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([x]) => x.id), { title: base.title });
        const cats = {}; for (const id of hist.slice(0, 20)) { const m = byId.get(id); if (m) cats[m.category] = (cats[m.category] || 0) + 1; }
        const fav = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
        if (fav) push('for_you', ms.filter(x => x.category === fav[0] && !hist.includes(x.id)).sort((a, b) => (b.views || 0) - (a.views || 0)).map(x => x.id), { category: fav[0] });
      }
    }
    const rated = ms.map(m => [m, ratingStats(m.id)]).filter(([, s]) => s.count >= 1 && s.avg >= 3.5).sort((a, b) => b[1].avg - a[1].avg || b[1].count - a[1].count);
    push('top_rated', rated.map(([m]) => m.id));
    push('trending', [...ms].sort((a, b) => (b.views || 0) - (a.views || 0)).filter(m => (m.views || 0) > 0).map(m => m.id));
    push('new', ms.filter(m => now() - Date.parse(m.createdAt) < 30 * 86400e3).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(m => m.id));
    res.json({ rows });
  });

  /* ---------- لوحة المبدع ---------- */
  app.get('/api/user/creator', requireUser, (req, res) => {
    const mine = getShorts().filter(s => s.userId === req.user.id), soc = getSocial(), cc = {};
    for (const cm of getComments()) if (cm.type === 'short') cc[cm.targetId] = (cc[cm.targetId] || 0) + 1;
    const rows = mine.map(s => { const e = soc[`short:${s.id}`] || {}; const likes = (e.likes || []).length, comments = cc[s.id] || 0, views = s.views || 0;
      return { id: s.id, caption: s.caption, posterUrl: s.posterUrl || '', createdAt: s.createdAt, views, likes, dislikes: (e.dislikes || []).length, comments, shares: e.shares || 0, downloads: e.downloads || 0, hidden: !!s.hidden, commentsOff: !!s.commentsOff, engagement: views ? Math.round(((likes + comments + (e.shares || 0)) / views) * 1000) / 10 : 0 }; });
    const sum = k => rows.reduce((a, r) => a + r[k], 0);
    const log = readJSON(F('followlog.json'), []).filter(x => x.b === req.user.id), days = {};
    const cut = now() - 30 * 86400e3;
    for (let i = 29; i >= 0; i--) days[new Date(now() - i * 86400e3).toISOString().slice(0, 10)] = 0;
    for (const x of log) if (x.t > cut) { const k = new Date(x.t).toISOString().slice(0, 10); if (k in days) days[k]++; }
    const follows = readJSON(F('follows.json'), {}); const followers = Object.values(follows).filter(a => a.includes(req.user.id)).length;
    const tags = {}; for (const r of rows) for (const t of ext.tagsOf({ caption: r.caption })) { const e = (tags[t] ||= { tag: t, shorts: 0, views: 0, likes: 0 }); e.shorts++; e.views += r.views; e.likes += r.likes; }
    res.json({
      totals: { shorts: rows.length, views: sum('views'), likes: sum('likes'), comments: sum('comments'), shares: sum('shares'), downloads: sum('downloads'), followers },
      followersDaily: Object.entries(days).map(([d, n]) => ({ d, n })), newFollowers30: Object.values(days).reduce((a, b) => a + b, 0),
      top: [...rows].sort((a, b) => b.views - a.views)[0] || null, shorts: rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      tags: Object.values(tags).sort((a, b) => b.views - a.views).slice(0, 8)
    });
  });

  const c2 = { ...c, getCfg, saveCfg, hasBanned, blockedSet, byUsername };
  require('./v11b')(c2);
  require('./v12')(c2);
  require('./v13')(c2); require('./v14')(c2); require('./v15')(c2); require('./v16')(c2); require('./v17')(c2); require('./v17b')(c2); require('./v17c')(c2); require('./v17d')(c2); require('./v18')(c2);
};

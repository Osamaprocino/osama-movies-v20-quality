/* ===================================================================
   الإضافات (الإصدار 12) — فوق v11:
   مشاهدة لاحقاً + متابعة المسلسلات • مجموعات تلقائية من الكتالوج • شارات
   تحدي أسبوعي + «سنتك في الأفلام» • اختيار فيلم بالمزاج • ترجمة تلقائية للترجمات
   =================================================================== */
const path = require('path');
const crypto = require('crypto');
const translator = require('./translate');

module.exports = function registerV12(c) {
  const { app, ext, readJSON, writeJSONAtomic, getUser, requireUser, requireAdmin, sameOrigin, hit, tr,
    getMovies, saveMovies, getShorts, getUsers, getComments, DATA_DIR, SUBS_DIR, getCfg } = c;
  const F = n => path.join(DATA_DIR, n);
  const now = () => Date.now();
  const iso = () => new Date().toISOString();
  const ok = (res, extra = {}) => res.json({ success: true, ...extra });
  const rl = (req, res, key, max, ms) => { if (hit(`${key}:${req.user ? req.user.id : req.ip}`, max, ms)) { res.status(429).json({ error: tr(req, 'too_many') }); return true; } return false; };
  const J = (file, fb) => () => readJSON(F(file), fb);
  const S = file => v => writeJSONAtomic(F(file), v);
  const skey = m => String(m.series || '').trim().toLowerCase();
  const visible = m => !(ext.isScheduled && ext.isScheduled(m));
  const allowed = (req, ms) => ext.filterMovies ? ext.filterMovies(ms.filter(visible), req) : ms.filter(visible);
  const patchMovie = (id, fn) => { const l = getMovies(); const m = l.find(x => x.id === id); if (!m) return null; fn(m); c.saveMovies(l); return m; };

  /* ---------- نصوص push الإضافية ---------- */
  if (c.__PT) {
    c.__PT.ar.series_episode = ['حلقة جديدة', n => `${n.series}: ${n.title}`]; c.__PT.en.series_episode = ['New episode', n => `${n.series}: ${n.title}`]; c.__PT.ru.series_episode = ['Новая серия', n => `${n.series}: ${n.title}`];
    c.__PT.ar.challenge_done = ['أنجزت التحدي الأسبوعي 🎉', () => 'أحسنت! نلتَ نقطة جديدة']; c.__PT.en.challenge_done = ['Weekly challenge complete 🎉', () => 'Well done!']; c.__PT.ru.challenge_done = ['Недельный челлендж выполнен 🎉', () => 'Отлично!'];
  }

  /* ---------- مشاهدة لاحقاً ---------- */
  const getWL = J('watchlater.json', {}), saveWL = S('watchlater.json');
  app.get('/api/user/watch-later', requireUser, (req, res) => {
    const ids = new Set(getMovies().map(m => m.id));
    res.json({ items: (getWL()[req.user.id] || []).filter(i => ids.has(i)) });
  });
  app.post('/api/user/watch-later/:id', sameOrigin, requireUser, (req, res) => {
    if (!getMovies().some(m => m.id === req.params.id)) return res.status(404).json({ error: 'الفيلم غير موجود' });
    if (rl(req, res, 'wl', 60, 60 * 1000)) return;
    const all = getWL(); let l = (all[req.user.id] || []).filter(i => i !== req.params.id);
    const on = !(req.body && req.body.on === false); if (on) l.unshift(req.params.id);
    all[req.user.id] = l.slice(0, 300); saveWL(all); ok(res, { on, count: all[req.user.id].length });
  });
  app.delete('/api/user/watch-later', sameOrigin, requireUser, (req, res) => { const all = getWL(); delete all[req.user.id]; saveWL(all); ok(res); });

  /* ---------- متابعة مسلسل: إشعار عند نزول حلقة جديدة ---------- */
  const getSF = J('seriesfollow.json', {}), saveSF = S('seriesfollow.json');
  app.get('/api/user/series-follow', requireUser, (req, res) => {
    const titles = new Map(); for (const m of getMovies()) if (skey(m) && !titles.has(skey(m))) titles.set(skey(m), m.series);
    res.json({ items: (getSF()[req.user.id] || []).filter(k => titles.has(k)).map(k => ({ key: k, title: titles.get(k) })) });
  });
  app.post('/api/series/follow', sameOrigin, requireUser, (req, res) => {
    const k = String((req.body && req.body.series) || '').trim().toLowerCase();
    if (!k || !getMovies().some(m => skey(m) === k)) return res.status(404).json({ error: tr(req, 'target_not_found') });
    if (rl(req, res, 'sf', 30, 60 * 1000)) return;
    const all = getSF(); let l = (all[req.user.id] || []).filter(x => x !== k); const on = !(req.body && req.body.on === false); if (on) l.push(k);
    all[req.user.id] = l.slice(0, 100); saveSF(all); ok(res, { following: on });
  });
  // نشر الإشعارات: الحلقات المرئية الجديدة (بعد الإقلاع) فقط، فلا نُغرق المتابعين بالقديم
  for (const m of getMovies().filter(visible)) if (m.series && !m.seriesNotified) patchMovie(m.id, x => { x.seriesNotified = true; });
  function seriesTick() {
    const todo = getMovies().filter(m => m.series && !m.seriesNotified && visible(m));
    if (!todo.length) return;
    const sf = getSF();
    for (const m of todo) {
      const k = skey(m);
      for (const [uid, keys] of Object.entries(sf)) if (keys.includes(k) && ext.notify) ext.notify(uid, 'series_episode', { title: m.title, movieId: m.id, series: m.series });
      patchMovie(m.id, x => { x.seriesNotified = true; });
    }
  }
  setInterval(seriesTick, 30 * 1000).unref(); c.__seriesTick = seriesTick;

  /* ---------- مجموعات تلقائية من الكتالوج ---------- */
  const groupsOf = ms => {
    const g = new Map(), add = (kind, name, m) => { if (name === undefined || name === '' || name === null) return; const k = kind + '\u0000' + name; (g.get(k) || g.set(k, { kind, name: String(name), movies: [] }).get(k)).movies.push(m); };
    for (const m of ms) { add('director', m.director, m); (m.cast || []).forEach(x => add('cast', x, m)); add('series', m.series, m); add('year', m.year, m); add('country', m.country, m); (m.tags || []).forEach(x => add('tag', x, m)); add('category', m.category, m); }
    return g;
  };
  app.get('/api/collections', (req, res) => {
    const ms = allowed(req, getMovies());
    const out = [...groupsOf(ms).values()].filter(x => x.movies.length >= (x.kind === 'series' ? 1 : 2) && !(x.kind === 'category'))
      .sort((a, b) => b.movies.length - a.movies.length).slice(0, 60)
      .map(x => ({ kind: x.kind, name: x.name, count: x.movies.length, posterUrl: x.movies[0].posterUrl, ids: x.movies.slice(0, 20).map(m => m.id) }));
    res.json({ items: out });
  });
  app.get('/api/collections/:kind/:name', (req, res) => {
    const g = groupsOf(allowed(req, getMovies())).get(req.params.kind + '\u0000' + req.params.name);
    if (!g) return res.json({ kind: req.params.kind, name: req.params.name, ids: [] });
    const list = g.kind === 'series' ? g.movies.sort((a, b) => (a.season || 1) - (b.season || 1) || (a.episode || 0) - (b.episode || 0)) : g.movies;
    res.json({ kind: g.kind, name: g.name, ids: list.map(m => m.id) });
  });

  /* ---------- شارات + تحدٍ أسبوعي + «سنتك في الأفلام» ---------- */
  const getProgress = J('progress.json', {}), getLibrary = J('library.json', {}), getRatings = J('ratings.json', {});
  const getChal = J('challenges.json', {}), saveChal = S('challenges.json');
  const getFollows = J('follows.json', {});
  const TARGET = 3;
  const weekStart = (d = now()) => { const x = new Date(d); x.setUTCHours(0, 0, 0, 0); const day = (x.getUTCDay() + 6) % 7; return x.getTime() - day * 86400e3; };
  function challengeFor(uid, notify) {
    const prog = getProgress()[uid] || {}, ws = weekStart();
    const n = Object.values(prog).filter(p => p.u >= ws && p.d > 0 && p.t / p.d >= 0.5).length;
    const all = getChal(); const rec = (all[uid] ||= { weeks: [] }); const wk = new Date(ws).toISOString().slice(0, 10);
    const done = n >= TARGET;
    if (done && !rec.weeks.includes(wk)) { rec.weeks.push(wk); rec.weeks = rec.weeks.slice(-200); saveChal(all); if (notify && ext.notify) ext.notify(uid, 'challenge_done', {}); }
    return { target: TARGET, progress: Math.min(n, TARGET), done, week: wk, completed: (rec.weeks || []).length, endsAt: new Date(ws + 7 * 86400e3).toISOString() };
  }
  app.get('/api/user/challenge', requireUser, (req, res) => res.json(challengeFor(req.user.id, true)));

  const BADGES = [
    ['first_review', '⭐', s => s.reviews, 1], ['critic', '✍️', s => s.reviews, 10], ['cinephile', '🎬', s => s.history, 25], ['binge', '🍿', s => s.history, 10],
    ['commenter', '💬', s => s.comments, 5], ['creator', '⚡', s => s.shorts, 3], ['popular', '🌟', s => s.followers, 10], ['supporter', '👑', s => (s.sub ? 1 : 0), 1],
    ['veteran', '🏅', s => Math.floor(s.ageDays), 180], ['champion', '🏆', s => s.weeks, 3]
  ];
  function statsOf(u) {
    let reviews = 0; for (const e of Object.values(getRatings())) if (e[u.id] && e[u.id].review) reviews++;
    return {
      reviews, history: ((getLibrary()[u.id] || {}).history || []).length, comments: getComments().filter(x => x.userId === u.id).length,
      shorts: getShorts().filter(s => s.userId === u.id && !s.hidden).length, followers: Object.values(getFollows()).filter(a => a.includes(u.id)).length,
      sub: ext.hasSub && ext.hasSub(u), ageDays: (now() - Date.parse(u.createdAt || iso())) / 86400e3, weeks: ((getChal()[u.id] || {}).weeks || []).length
    };
  }
  const badgesOf = u => { const s = statsOf(u); return BADGES.map(([id, icon, fn, target]) => ({ id, icon, progress: Math.min(target, Math.round(fn(s))), target, earned: fn(s) >= target })); };
  app.get('/api/user/badges', requireUser, (req, res) => res.json({ items: badgesOf(req.user) }));
  app.get('/api/users/:username/badges', (req, res) => {
    const u = c.byUsername(req.params.username); if (!u) return res.status(404).json({ error: tr(req, 'target_not_found') });
    res.json({ items: badgesOf(u).filter(b => b.earned).map(b => ({ id: b.id, icon: b.icon })) });
  });

  app.get('/api/user/wrapped', requireUser, (req, res) => {
    const year = parseInt(req.query.year, 10) || new Date().getUTCFullYear();
    const from = Date.UTC(year, 0, 1), to = Date.UTC(year + 1, 0, 1);
    const movies = new Map(getMovies().map(m => [m.id, m]));
    const mine = Object.entries(getProgress()[req.user.id] || {}).filter(([id, p]) => p.u >= from && p.u < to && movies.has(id));
    const cnt = (arr) => { const o = {}; for (const x of arr) if (x) o[x] = (o[x] || 0) + 1; return Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, n]) => ({ name, n })); };
    const months = Array(12).fill(0); let secs = 0, finished = 0;
    for (const [id, p] of mine) { secs += p.t; if (p.d && p.t / p.d >= 0.9) finished++; months[new Date(p.u).getUTCMonth()] += p.t; }
    const ms = mine.map(([id]) => movies.get(id));
    let rsum = 0, rn = 0; for (const e of Object.values(getRatings())) { const r = e[req.user.id]; if (r && Date.parse(r.createdAt) >= from && Date.parse(r.createdAt) < to) { rsum += r.stars; rn++; } }
    const best = months.indexOf(Math.max(...months));
    res.json({
      year, started: mine.length, finished, minutes: Math.round(secs / 60), topCategories: cnt(ms.map(m => m.category)), topDirectors: cnt(ms.map(m => m.director)), topCast: cnt(ms.flatMap(m => m.cast || [])),
      ratings: rn, avgRating: rn ? Math.round(rsum / rn * 10) / 10 : 0, busiestMonth: secs ? best : null, months: months.map(x => Math.round(x / 60)),
      challenges: ((getChal()[req.user.id] || {}).weeks || []).filter(w => Date.parse(w) >= from && Date.parse(w) < to).length
    });
  });

  /* ---------- اختر لي فيلماً بالمزاج ---------- */
  const MOODS = {
    funny: ['كوميد', 'مضحك', 'ضحك', 'comedy', 'funny', 'комед', 'юмор'], sad: ['دراما', 'حزين', 'مؤثر', 'drama', 'emotional', 'драм'],
    thrilling: ['أكشن', 'اكشن', 'إثارة', 'رعب', 'جريمة', 'action', 'thriller', 'horror', 'crime', 'боевик', 'триллер', 'ужас'],
    romantic: ['رومانس', 'حب', 'romance', 'love', 'мелодрам', 'романт'], family: ['عائل', 'أطفال', 'كرتون', 'family', 'kids', 'animation', 'семейн', 'мульт'],
    scifi: ['خيال', 'علمي', 'فضاء', 'sci', 'space', 'фантаст', 'космос']
  };
  app.get('/api/pick', (req, res) => {
    if (hit(`pick:${req.ip}`, 60, 60 * 1000)) return res.status(429).json({ error: tr(req, 'too_many') });
    const me = getUser(req), mood = String(req.query.mood || 'any'), len = String(req.query.len || 'any');
    let pool = allowed(req, getMovies());
    const lib = me ? (getLibrary()[me.id] || {}) : {}, seen = new Set(lib.history || []);
    const tx = m => [m.category, m.title, m.description, ...(m.tags || [])].join(' ').toLowerCase();
    let fallback = false;
    if (MOODS[mood]) { const f = pool.filter(m => MOODS[mood].some(w => tx(m).includes(w))); if (f.length) pool = f; else fallback = true; }
    if (len === 'short') pool = pool.filter(m => !m.duration || m.duration <= 5400); else if (len === 'long') pool = pool.filter(m => !m.duration || m.duration > 5400);
    if (!pool.length) return res.json({ id: null });
    const fresh = pool.filter(m => !seen.has(m.id)), free = (fresh.length ? fresh : pool);
    const prefer = free.filter(m => !m.isPaid); const from = prefer.length ? prefer : free;
    const exclude = String(req.query.not || ''); const pickFrom = from.filter(m => m.id !== exclude); const arr = pickFrom.length ? pickFrom : from;
    res.json({ id: arr[crypto.randomInt(arr.length)].id, fallback, unseen: !!fresh.length });
  });

  /* ---------- ترجمة الترجمات تلقائياً ---------- */
  const getCfg3 = () => ({ autoTranslate: [], ...readJSON(F('settings3.json'), {}) }), saveCfg3 = S('settings3.json');
  const LABEL = { ar: 'العربية', en: 'English', ru: 'Русский', tr: 'Türkçe', fr: 'Français', de: 'Deutsch', es: 'Español' };
  const TO = Object.keys(LABEL);
  async function translateTrack(movieId, srcId, to) {
    const m = getMovies().find(x => x.id === movieId); if (!m) throw new Error('الفيلم غير موجود');
    const src = (m.subtitles || []).find(x => x.id === srcId); if (!src) throw new Error('المسار غير موجود');
    if (src.lang === to) return null;
    if ((m.subtitles || []).some(x => x.srcId === srcId && x.lang === to)) return null;
    const data = readJSON(path.join(SUBS_DIR, path.basename(src.id) + '.json'), null); if (!data || !data.cues) throw new Error('الملف غير موجود');
    const r = await translator.translateMany(data.cues.map(x => x.t), to, src.lang && src.lang !== 'und' ? src.lang : 'auto');
    const cues = data.cues.map((x, i) => ({ s: x.s, e: x.e, t: r.translations[i] || x.t }));
    const sid = crypto.randomBytes(8).toString('hex');
    writeJSONAtomic(path.join(SUBS_DIR, sid + '.json'), { cues });
    patchMovie(movieId, x => { (x.subtitles ||= []).push({ id: sid, lang: to, label: `${LABEL[to]} (مترجم آلياً)`, count: cues.length, createdAt: iso(), auto: true, translated: true, srcId }); });
    return sid;
  }
  c.__translateTrack = translateTrack;
  app.post('/api/admin/movies/:id/subtitles/translate', requireAdmin, (req, res) => {
    const m = getMovies().find(x => x.id === req.params.id); if (!m) return res.status(404).json({ error: 'الفيلم غير موجود' });
    const to = req.body && req.body.to; if (!TO.includes(to)) return res.status(400).json({ error: 'لغة غير مدعومة' });
    const subs = m.subtitles || [];
    const src = subs.find(x => x.id === (req.body && req.body.from)) || subs.find(x => x.auto && !x.translated) || subs.find(x => !x.translated);
    if (!src) return res.status(400).json({ error: 'لا توجد ترجمة مصدر. أضف ملف ترجمة أو شغّل التفريغ الصوتي أولاً.' });
    if (src.lang === to) return res.status(400).json({ error: 'المصدر بنفس اللغة المطلوبة.' });
    if (m.subTr && m.subTr.status === 'working') return res.status(409).json({ error: 'الترجمة جارية بالفعل.' });
    patchMovie(m.id, x => { x.subTr = { status: 'working', to, at: iso() }; });
    res.status(202).json({ success: true });
    setImmediate(() => translateTrack(m.id, src.id, to).then(() => patchMovie(m.id, x => { x.subTr = { status: 'done', to, at: iso() }; }))
      .catch(e => { console.error('[subtr]', e.message); patchMovie(m.id, x => { x.subTr = { status: 'failed', to, error: String(e.message).slice(0, 120), at: iso() }; }); }));
  });
  app.get('/api/admin/v12-settings', requireAdmin, (req, res) => res.json(getCfg3()));
  app.put('/api/admin/v12-settings', requireAdmin, (req, res) => {
    const a = req.body && req.body.autoTranslate; if (!Array.isArray(a)) return res.status(400).json({ error: 'غير صالح' });
    saveCfg3({ ...getCfg3(), autoTranslate: [...new Set(a.filter(x => TO.includes(x)))] }); ok(res);
  });
  let busy = false;
  async function autoTick() {
    const langs = getCfg3().autoTranslate; if (!langs.length || busy) return;
    const m = getMovies().find(x => x.transcribe && x.transcribe.status === 'done' && !x.autoTrChecked && (x.subtitles || []).some(s => s.auto && !s.translated));
    if (!m) return;
    busy = true;
    try {
      patchMovie(m.id, x => { x.autoTrChecked = true; });
      const src = m.subtitles.find(s => s.auto && !s.translated);
      for (const to of langs) { try { await translateTrack(m.id, src.id, to); } catch (e) { console.error('[auto-subtr]', e.message); } }
    } finally { busy = false; }
  }
  setInterval(() => autoTick().catch(() => {}), 45 * 1000).unref(); c.__autoTick = autoTick;
  /* ---------- لوحة متصدري المبدعين ---------- */
  app.get('/api/leaderboard', (req, res) => {
    const users = new Map(getUsers().map(u => [u.id, u])), soc = c.getSocial(), cc = {};
    for (const cm of getComments()) if (cm.type === 'short') cc[cm.targetId] = (cc[cm.targetId] || 0) + 1;
    const fol = {};
    for (const a of Object.values(readJSON(F('follows.json'), {}))) for (const id of a) fol[id] = (fol[id] || 0) + 1;
    const agg = {};
    for (const s of getShorts()) {
      if (s.hidden) continue;
      const e = soc[`short:${s.id}`] || {}, a = (agg[s.userId] ||= { shorts: 0, views: 0, likes: 0, comments: 0 });
      a.shorts++; a.views += s.views || 0; a.likes += (e.likes || []).length; a.comments += cc[s.id] || 0;
    }
    const rows = Object.entries(agg).map(([uid, a]) => {
      const u = users.get(uid); if (!u) return null;
      const followers = fol[uid] || 0;
      return { username: u.username, displayName: u.displayName || u.username, avatarUrl: u.avatarUrl || '', ...a, followers, score: Math.round(followers * 5 + a.likes * 2 + a.comments * 1.5 + a.views * 0.2) };
    }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 10);
    res.json({ items: rows });
  });
};

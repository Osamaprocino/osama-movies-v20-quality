/* الإصدار 11 — الجزء الثاني: مشاهدة جماعية (SSE) • Web Push • دخول Google/Telegram
   إشراف تلقائي • تصدير CSV • تقرير أسبوعي بالبريد */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mailer = require('./mailer');
const media = require('./media');
const webpush = require('./webpush');

module.exports = function registerV11b(c) {
  const { app, ext, readJSON, writeJSONAtomic, getUser, requireUser, requireAdmin, sameOrigin, hit, tr, cleanLine, cleanBlock,
    getMovies, getShorts, saveShorts, getUsers, saveUsers, getComments, getPayments, getAnalytics, hasAccess, authorOf, userMap,
    getCfg, saveCfg, hasBanned, blockedSet, byUsername, startUserSession, USERNAME_RE, scryptAsync, SCRYPT_OPTS, DATA_DIR, SHORTS_DIR, unlinkQuiet } = c;
  const F = n => path.join(DATA_DIR, n);
  const now = () => Date.now();
  const iso = () => new Date().toISOString();
  const ok = (res, extra = {}) => res.json({ success: true, ...extra });
  const rl = (req, res, key, max, ms) => { if (hit(`${key}:${req.user ? req.user.id : req.ip}`, max, ms)) { res.status(429).json({ error: tr(req, 'too_many') }); return true; } return false; };

  /* =================== مشاهدة جماعية =================== */
  const rooms = new Map();
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const newCode = () => { for (;;) { const k = Array.from(crypto.randomBytes(6), b => CODE_CHARS[b % CODE_CHARS.length]).join(''); if (!rooms.has(k)) return k; } };
  const posOf = r => r.state.playing ? r.state.t + ((now() - r.state.at) / 1000) * r.state.rate : r.state.t;
  const stateOut = r => ({ playing: r.state.playing, t: Math.round(posOf(r) * 100) / 100, rate: r.state.rate, serverTime: now(), by: r.state.by || '' });
  const membersOut = r => [...r.members.values()].filter(m => m.conns.size).map(m => ({ id: m.id, name: m.name, avatarUrl: m.avatarUrl, host: m.id === r.hostId }));
  function sse(res, event, data) { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }
  function broadcast(r, event, data) { for (const m of r.members.values()) for (const res of m.conns) { try { sse(res, event, data); } catch {} } }
  const infoOut = r => ({ code: r.code, movieId: r.movieId, hostId: r.hostId, control: r.control, members: membersOut(r), state: stateOut(r), chat: r.chat.slice(-40) });
  const getRoom = (req, res) => { const r = rooms.get(String(req.params.code || '').toUpperCase()); if (!r) { res.status(404).json({ error: tr(req, 'party_not_found'), code: 'party_not_found' }); return null; } return r; };

  app.post('/api/party', sameOrigin, requireUser, (req, res) => {
    if (rl(req, res, 'party', 10, 60 * 60 * 1000)) return;
    const m = getMovies().find(x => x.id === (req.body && req.body.movieId));
    if (!m) return res.status(404).json({ error: 'الفيلم غير موجود' });
    if (!hasAccess(req, m)) return res.status(403).json({ error: tr(req, 'no_access'), code: 'no_access' });
    if ([...rooms.values()].filter(r => r.hostId === req.user.id).length >= 3) return res.status(429).json({ error: tr(req, 'too_many') });
    const code = newCode();
    const r = { code, movieId: m.id, hostId: req.user.id, control: req.body && req.body.control === 'all' ? 'all' : 'host', created: now(), touched: now(), state: { playing: false, t: 0, rate: 1, at: now(), by: '' }, members: new Map(), chat: [] };
    rooms.set(code, r);
    res.status(201).json(infoOut(r));
  });
  app.get('/api/party/:code', (req, res) => { const r = getRoom(req, res); if (r) res.json(infoOut(r)); });
  app.get('/api/party/:code/events', requireUser, (req, res) => {
    const r = getRoom(req, res); if (!r) return;
    const m = getMovies().find(x => x.id === r.movieId);
    if (!m || !hasAccess(req, m)) return res.status(403).json({ error: tr(req, 'no_access'), code: 'no_access' });
    if (r.members.size >= 20 && !r.members.has(req.user.id)) return res.status(429).json({ error: tr(req, 'too_many') });
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 3000\n\n');
    let mem = r.members.get(req.user.id);
    if (!mem) { const a = authorOf(req.user); mem = { id: req.user.id, name: a.name, avatarUrl: a.avatarUrl || '', conns: new Set(), lastSeen: now() }; r.members.set(req.user.id, mem); }
    const wasOffline = !mem.conns.size; mem.conns.add(res); r.touched = now();
    sse(res, 'init', { ...infoOut(r), me: req.user.id });
    if (wasOffline) broadcast(r, 'members', membersOut(r));
    const hb = setInterval(() => { try { res.write(': hb\n\n'); } catch {} }, 20000);
    req.on('close', () => {
      clearInterval(hb); mem.conns.delete(res); mem.lastSeen = now();
      if (!mem.conns.size) {
        if (r.hostId === mem.id) { const next = [...r.members.values()].find(x => x.conns.size && x.id !== mem.id); if (next) { r.hostId = next.id; broadcast(r, 'host', { hostId: next.id }); } }
        broadcast(r, 'members', membersOut(r));
      }
    });
  });
  app.post('/api/party/:code/control', sameOrigin, requireUser, (req, res) => {
    const r = getRoom(req, res); if (!r) return;
    if (!r.members.has(req.user.id)) return res.status(403).json({ error: tr(req, 'forbidden') });
    if (r.control !== 'all' && r.hostId !== req.user.id) return res.status(403).json({ error: tr(req, 'forbidden'), code: 'forbidden' });
    if (rl(req, res, 'pctl', 120, 60 * 1000)) return;
    const b = req.body || {}, t = Number(b.t);
    if (!['play', 'pause', 'seek', 'rate'].includes(b.action) || !Number.isFinite(t) || t < 0 || t > 86400 * 2) return res.status(400).json({ error: tr(req, 'target_not_found') });
    const cur = posOf(r), s = r.state;
    if (b.action === 'rate') { const rate = Number(b.rate); if (![0.5, 0.75, 1, 1.25, 1.5, 2].includes(rate)) return res.status(400).json({ error: tr(req, 'target_not_found') }); s.t = cur; s.rate = rate; s.at = now(); }
    else { s.t = t; s.at = now(); if (b.action === 'play') s.playing = true; else if (b.action === 'pause') s.playing = false; }
    s.by = (r.members.get(req.user.id) || {}).name || ''; r.touched = now();
    broadcast(r, 'state', { ...stateOut(r), action: b.action });
    ok(res);
  });
  app.post('/api/party/:code/chat', sameOrigin, requireUser, async (req, res) => {
    const r = getRoom(req, res); if (!r) return;
    if (!r.members.has(req.user.id)) return res.status(403).json({ error: tr(req, 'forbidden') });
    if (rl(req, res, 'pchat', 20, 60 * 1000)) return;
    const text = cleanLine(req.body && req.body.text, 300); if (!text) return res.status(400).json({ error: tr(req, 'comment_empty') });
    if (hasBanned(text)) return res.status(422).json({ error: tr(req, 'banned_word'), code: 'banned_word' });
    if (ext.moderateText && await ext.moderateText(text)) return res.status(422).json({ error: tr(req, 'moderated'), code: 'moderated' });
    const msg = { id: crypto.randomUUID(), userId: req.user.id, name: authorOf(req.user).name, text, at: now() };
    r.chat.push(msg); r.chat = r.chat.slice(-100); r.touched = now();
    for (const m of r.members.values()) { if (m.id !== req.user.id && ext.isBlockedBy(m.id, req.user.id)) continue; for (const rs of m.conns) { try { sse(rs, 'chat', msg); } catch {} } }
    ok(res);
  });
  app.post('/api/party/:code/leave', sameOrigin, requireUser, (req, res) => {
    const r = rooms.get(String(req.params.code || '').toUpperCase()); if (!r) return ok(res);
    const mem = r.members.get(req.user.id); if (mem) { for (const rs of mem.conns) { try { rs.end(); } catch {} } mem.conns.clear(); r.members.delete(req.user.id); }
    if (r.hostId === req.user.id) { const next = [...r.members.values()].find(x => x.conns.size); if (next) { r.hostId = next.id; broadcast(r, 'host', { hostId: next.id }); } else rooms.delete(r.code); }
    broadcast(r, 'members', membersOut(r)); ok(res);
  });
  setInterval(() => { for (const [k, r] of rooms) { const live = [...r.members.values()].some(m => m.conns.size); if ((!live && now() - r.touched > 10 * 60 * 1000) || now() - r.created > 12 * 3600e3) { for (const m of r.members.values()) for (const rs of m.conns) try { rs.end(); } catch {} rooms.delete(k); } } }, 60 * 1000).unref();
  c.__rooms = rooms;

  /* =================== Web Push =================== */
  const vapid = webpush.loadVapid(F('vapid.json'));
  const getSubs = () => readJSON(F('pushsubs.json'), {});
  const saveSubs = v => writeJSONAtomic(F('pushsubs.json'), v);
  const PUSH_HOSTS = ['googleapis.com', 'mozilla.com', 'mozaws.net', 'push.apple.com', 'notify.windows.com', ...String(process.env.PUSH_HOSTS || '').split(',').map(s => s.trim()).filter(Boolean)];
  const endpointOk = ep => {
    try {
      const u = new URL(ep); if (ep.length > 800) return false;
      if (process.env.PUSH_ALLOW_ANY === '1') return u.protocol === 'https:' || u.protocol === 'http:';
      return u.protocol === 'https:' && !u.port && PUSH_HOSTS.some(h => u.hostname === h || u.hostname.endsWith('.' + h));
    } catch { return false; }
  };
  const subject = () => process.env.VAPID_SUBJECT || 'mailto:' + (process.env.ADMIN_EMAIL || 'admin@localhost.invalid');
  app.get('/api/push/key', (req, res) => res.json({ enabled: getCfg().push.enabled !== false, publicKey: vapid.publicKey }));
  app.post('/api/push/subscribe', sameOrigin, requireUser, (req, res) => {
    const s = req.body && req.body.subscription;
    if (!s || typeof s.endpoint !== 'string' || !s.keys || typeof s.keys.p256dh !== 'string' || typeof s.keys.auth !== 'string' || !endpointOk(s.endpoint)) return res.status(400).json({ error: tr(req, 'target_not_found'), code: 'bad_subscription' });
    if (rl(req, res, 'psub', 20, 60 * 60 * 1000)) return;
    const all = getSubs();
    for (const k of Object.keys(all)) all[k] = all[k].filter(x => x.endpoint !== s.endpoint); // الجهاز يخص حساباً واحداً
    const arr = (all[req.user.id] ||= []);
    arr.unshift({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh.slice(0, 120), auth: s.keys.auth.slice(0, 60) }, lang: ['ar', 'en', 'ru'].includes(req.body.lang) ? req.body.lang : (req.lang || 'ar'), createdAt: iso() });
    all[req.user.id] = arr.slice(0, 5); saveSubs(all); ok(res);
  });
  app.delete('/api/push/subscribe', sameOrigin, requireUser, (req, res) => {
    const ep = req.body && req.body.endpoint, all = getSubs();
    all[req.user.id] = (all[req.user.id] || []).filter(x => !ep || x.endpoint === ep); saveSubs(all); ok(res);
  });
  app.get('/api/push/status', requireUser, (req, res) => res.json({ devices: (getSubs()[req.user.id] || []).length }));
  const PT = {
    ar: { channel_movie: ['فيلم جديد', n => `${n.name} نشر فيلماً: ${n.title}`], site_movie: ['فيلم جديد', n => `${n.title} متاح الآن`], reply: ['رد جديد', n => `${n.name} ردّ على تعليقك`], short_comment: ['تعليق جديد', n => `${n.name} علّق على مقطعك`], comment_like: ['إعجاب', n => `${n.name} أعجبه تعليقك`], follow: ['متابع جديد', n => `${n.name} بدأ بمتابعتك`], mention: ['إشارة', n => `${n.name} ذكرك في تعليق`], movie_published: ['فيلم جديد', n => `${n.title} متاح الآن`], short_hidden: ['مقطعك قيد المراجعة', () => 'تم إخفاء المقطع مؤقتاً لمراجعته'], test: ['إشعارات سينما أسامة', () => 'الإشعارات تعمل على هذا الجهاز ✓'], _: ['سينما أسامة', () => 'لديك إشعار جديد'] },
    en: { channel_movie: ['New movie', n => `${n.name} published: ${n.title}`], site_movie: ['New movie', n => `${n.title} is now available`], reply: ['New reply', n => `${n.name} replied to your comment`], short_comment: ['New comment', n => `${n.name} commented on your clip`], comment_like: ['New like', n => `${n.name} liked your comment`], follow: ['New follower', n => `${n.name} started following you`], mention: ['Mention', n => `${n.name} mentioned you in a comment`], movie_published: ['New movie', n => `${n.title} is now available`], short_hidden: ['Your clip is under review', () => 'Your clip was hidden for review'], test: ['Osama Cinema notifications', () => 'Notifications work on this device ✓'], _: ['Osama Cinema', () => 'You have a new notification'] },
    ru: { channel_movie: ['Новый фильм', n => `${n.name} опубликовал: ${n.title}`], site_movie: ['Новый фильм', n => `«${n.title}» уже доступен`], reply: ['Новый ответ', n => `${n.name} ответил на ваш комментарий`], short_comment: ['Новый комментарий', n => `${n.name} прокомментировал ваш ролик`], comment_like: ['Новый лайк', n => `${n.name} оценил ваш комментарий`], follow: ['Новый подписчик', n => `${n.name} подписался на вас`], mention: ['Упоминание', n => `${n.name} упомянул вас в комментарии`], movie_published: ['Новый фильм', n => `«${n.title}» уже доступен`], short_hidden: ['Ролик на проверке', () => 'Ваш ролик временно скрыт для проверки'], test: ['Уведомления Osama Cinema', () => 'Уведомления работают на этом устройстве ✓'], _: ['Osama Cinema', () => 'У вас новое уведомление'] }
  };
  c.__PT = PT;
  const urlFor = (type, d) => d.movieId ? `/?movie=${encodeURIComponent(d.movieId)}` : d.targetType === 'short' ? `/?short=${encodeURIComponent(d.targetId)}` : d.targetType === 'movie' ? `/?movie=${encodeURIComponent(d.targetId)}` : d.username ? `/?channel=${encodeURIComponent(d.username)}` : '/';
  async function pushNow(userId, type, data, only) {
    if (getCfg().push.enabled === false) return { sent: 0 };
    const all = getSubs(), subs = (all[userId] || []).filter(s => !only || s.endpoint === only);
    let sent = 0, dead = [];
    await Promise.all(subs.map(async s => {
      const tt = (PT[s.lang] || PT.ar)[type] || (PT[s.lang] || PT.ar)._;
      const payload = { title: tt[0], body: tt[1](data || {}), url: urlFor(type, data || {}), tag: type };
      try { const r = await webpush.send(vapid, s, payload, { subject: subject() }); if (r.gone) dead.push(s.endpoint); else if (r.status >= 200 && r.status < 300) sent++; }
      catch (e) { console.error('[push]', e.message); }
    }));
    if (dead.length) { const a = getSubs(); a[userId] = (a[userId] || []).filter(s => !dead.includes(s.endpoint)); saveSubs(a); }
    return { sent };
  }
  ext.pushTo = (userId, type, data) => { if (!(getSubs()[userId] || []).length) return; pushNow(userId, type, data).catch(() => {}); };
  app.post('/api/push/test', sameOrigin, requireUser, async (req, res) => {
    if (rl(req, res, 'ptest', 5, 60 * 1000)) return;
    res.json({ success: true, ...(await pushNow(req.user.id, 'test', {})) });
  });

  /* =================== دخول Google / Telegram =================== */
  const providers = () => ({
    google: process.env.GOOGLE_CLIENT_ID ? { clientId: process.env.GOOGLE_CLIENT_ID } : null,
    telegram: process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME ? { bot: process.env.TELEGRAM_BOT_USERNAME } : null
  });
  app.get('/api/auth/providers', (req, res) => res.json(providers()));
  function uniqueUsername(users, raw) {
    let base = String(raw || 'user').normalize('NFKC').replace(/[^\p{L}\p{N}_.-]/gu, '').slice(0, 18);
    if (base.length < 3) base = (base + 'user').slice(0, 18);
    let n = base, i = 0;
    while (users.some(u => u.usernameLower === n.toLowerCase())) { i++; n = base.slice(0, 24 - String(i).length - 1) + '_' + i; }
    return USERNAME_RE.test(n) ? n : 'user_' + crypto.randomBytes(3).toString('hex');
  }
  async function loginWith(req, res, prov, extId, profile) {
    const users = getUsers(), key = prov + 'Id', me = getUser(req);
    let rec = users.find(u => u[key] === extId);
    if (me && req.body && req.body.link) { // ربط بحساب مسجَّل الدخول
      if (rec && rec.id !== me.id) return res.status(409).json({ error: tr(req, 'oauth_failed'), code: 'already_linked' });
      const m = users.find(u => u.id === me.id); m[key] = extId; saveUsers(users); return res.json({ success: true, linked: true, user: c.publicUser(m) });
    }
    if (!rec && profile.email) { const e = users.find(u => u.email === profile.email); if (e) { e[key] = extId; if (profile.emailVerified) e.emailVerified = true; rec = e; } }
    if (!rec) {
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = (await scryptAsync(crypto.randomBytes(32).toString('hex'), salt, 64, SCRYPT_OPTS)).toString('hex'); // كلمة مرور عشوائية لا يعرفها أحد
      const name = uniqueUsername(users, profile.username || (profile.email || '').split('@')[0] || profile.name);
      rec = { id: crypto.randomUUID(), username: name, usernameLower: name.toLowerCase(), displayName: cleanLine(profile.name, 40) || name, email: profile.email || '', emailVerified: !!profile.emailVerified, avatarUrl: '', age: null, salt, hash, [key]: extId, createdAt: iso() };
      users.push(rec);
    }
    saveUsers(users);
    startUserSession(req, res, rec);
    res.json({ success: true, user: c.publicUser(rec) });
  }
  app.post('/api/auth/google', sameOrigin, async (req, res) => {
    const pv = providers().google; if (!pv) return res.status(501).json({ error: tr(req, 'oauth_failed'), code: 'not_configured' });
    if (hit(`oauth:${req.ip}`, 20, 15 * 60 * 1000)) return res.status(429).json({ error: tr(req, 'too_many') });
    const cred = req.body && req.body.credential; if (typeof cred !== 'string' || cred.length > 4096) return res.status(400).json({ error: tr(req, 'oauth_failed') });
    try {
      const base = process.env.GOOGLE_TOKENINFO_URL || 'https://oauth2.googleapis.com/tokeninfo';
      const r = await fetch(`${base}?id_token=${encodeURIComponent(cred)}`, { signal: AbortSignal.timeout(10000) });
      const j = await r.json();
      if (!r.ok || j.aud !== pv.clientId || !['accounts.google.com', 'https://accounts.google.com'].includes(j.iss) || Number(j.exp) * 1000 < now() || !j.sub) throw new Error('invalid token');
      await loginWith(req, res, 'google', String(j.sub), { email: String(j.email || '').toLowerCase(), emailVerified: String(j.email_verified) === 'true', name: j.name || '', username: (j.email || '').split('@')[0] });
    } catch (e) { if (!res.headersSent) res.status(401).json({ error: tr(req, 'oauth_failed'), code: 'oauth_failed' }); }
  });
  app.post('/api/auth/telegram', sameOrigin, async (req, res) => {
    const pv = providers().telegram; if (!pv) return res.status(501).json({ error: tr(req, 'oauth_failed'), code: 'not_configured' });
    if (hit(`oauth:${req.ip}`, 20, 15 * 60 * 1000)) return res.status(429).json({ error: tr(req, 'too_many') });
    const d = req.body && req.body.data;
    try {
      if (!d || typeof d !== 'object' || typeof d.hash !== 'string' || !d.id) throw new Error('bad');
      const check = Object.keys(d).filter(k => k !== 'hash').sort().map(k => `${k}=${d[k]}`).join('\n');
      const secret = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
      const mac = crypto.createHmac('sha256', secret).update(check).digest();
      const got = Buffer.from(d.hash, 'hex');
      if (got.length !== mac.length || !crypto.timingSafeEqual(got, mac)) throw new Error('bad hash');
      if (now() / 1000 - Number(d.auth_date) > 86400) throw new Error('expired');
      await loginWith(req, res, 'telegram', String(d.id), { email: '', name: [d.first_name, d.last_name].filter(Boolean).join(' '), username: d.username || d.first_name });
    } catch (e) { if (!res.headersSent) res.status(401).json({ error: tr(req, 'oauth_failed'), code: 'oauth_failed' }); }
  });

  /* =================== الإشراف التلقائي =================== */
  const modUrl = () => process.env.MODERATION_URL || (process.env.OPENAI_API_KEY ? 'https://api.openai.com/v1/moderations' : '');
  const modEnabled = () => getCfg().moderation.on && !!modUrl();
  async function callModeration(input) {
    const key = process.env.MODERATION_KEY || process.env.OPENAI_API_KEY || '';
    const r = await fetch(modUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) }, body: JSON.stringify({ model: 'omni-moderation-latest', input }), signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error('moderation http ' + r.status);
    const j = await r.json(); return !!(j.results && j.results.some(x => x.flagged));
  }
  ext.moderateText = async text => { if (!modEnabled()) return false; try { return await callModeration(text); } catch (e) { console.error('[moderation]', e.message); return false; } }; // يفشل مفتوحاً
  const getReports = () => readJSON(F('reports.json'), []);
  async function framesOf(s) {
    const file = path.join(SHORTS_DIR, path.basename(s.videoUrl)), out = [];
    if (!media.isAvailable() || !fs.existsSync(file)) return out;
    const info = await media.probe(file), d = (info && info.duration) || 3;
    for (const f of [0.15, 0.5, 0.85]) {
      const dst = path.join(SHORTS_DIR, `.mod-${crypto.randomBytes(4).toString('hex')}.jpg`);
      try { await media.posterFrame(file, dst, Math.max(0, d * f)); out.push({ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + fs.readFileSync(dst).toString('base64') } }); } catch {} finally { unlinkQuiet(dst); }
    }
    return out;
  }
  async function moderateShort(id) {
    let s = getShorts().find(x => x.id === id); if (!s) return;
    let reason = '';
    if (hasBanned(s.caption)) reason = 'banned_word';
    else if (modEnabled()) {
      try {
        if (s.caption && await callModeration(s.caption)) reason = 'text';
        if (!reason) {
          if (ext.whenShortProcessed) await ext.whenShortProcessed(id); // ننتظر انتهاء معالجة ffmpeg كي لا نقرأ ملفاً يُستبدل
          s = getShorts().find(x => x.id === id); if (!s) return;
          const frames = await framesOf(s);
          if (frames.length && await callModeration(frames)) reason = 'image';
        }
      } catch (e) { console.error('[moderation]', e.message); }
    }
    if (!reason) return;
    const list = getShorts(); const t = list.find(x => x.id === id); if (!t) return;
    t.hidden = true; t.modReason = reason; saveShorts(list);
    const rep = getReports();
    rep.unshift({ id: crypto.randomUUID(), type: 'short', targetId: id, reason: 'other', note: `auto-moderation: ${reason}`, userId: t.userId, status: 'open', auto: true, createdAt: iso() });
    writeJSONAtomic(F('reports.json'), rep.slice(0, 1000));
    if (ext.notify) ext.notify(t.userId, 'short_hidden', { targetType: 'short', targetId: id });
  }
  ext.moderateShort = id => { setImmediate(() => moderateShort(id).catch(e => console.error('[moderation]', e.message))); };
  c.__moderateShort = moderateShort;

  app.get('/api/admin/v11-settings', requireAdmin, (req, res) => {
    const g = getCfg();
    res.json({ bannedWords: g.bannedWords, moderation: { on: g.moderation.on, serviceConfigured: !!modUrl() }, report: g.report, smtp: mailer.configured(), push: { enabled: g.push.enabled !== false, devices: Object.values(getSubs()).reduce((a, x) => a + x.length, 0) }, providers: { google: !!providers().google, telegram: !!providers().telegram } });
  });
  app.put('/api/admin/v11-settings', requireAdmin, (req, res) => {
    const b = req.body || {}, g = getCfg();
    if (Array.isArray(b.bannedWords)) g.bannedWords = [...new Set(b.bannedWords.map(x => cleanLine(x, 40)).filter(Boolean))].slice(0, 500);
    if (b.moderation) g.moderation.on = !!b.moderation.on;
    if (b.push && 'enabled' in b.push) g.push.enabled = !!b.push.enabled;
    if (b.report) {
      const r = b.report;
      if ('on' in r) g.report.on = !!r.on;
      if ('to' in r) { const to = String(r.to || '').trim().toLowerCase(); if (to && !/^[^\s@]{1,64}@[^\s@.]+(?:\.[^\s@.]+)+$/.test(to)) return res.status(400).json({ error: 'بريد غير صالح' }); g.report.to = to; }
      if ('day' in r) g.report.day = Math.min(6, Math.max(0, parseInt(r.day, 10) || 0));
      if ('hour' in r) g.report.hour = Math.min(23, Math.max(0, parseInt(r.hour, 10) || 0));
    }
    saveCfg(g); ok(res);
  });

  /* =================== تصدير CSV =================== */
  const SECRET = /hash|salt|token|password|secret|receipt/i;
  const cell = v => {
    if (v === undefined || v === null) return '';
    let s = Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // حماية من حقن الصيغ في Excel
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  function toCsv(rows, preferred = []) {
    const keys = [...preferred]; for (const r of rows) for (const k of Object.keys(r)) if (!SECRET.test(k) && !keys.includes(k) && typeof r[k] !== 'object') keys.push(k); else if (Array.isArray(r[k]) && !SECRET.test(k) && !keys.includes(k)) keys.push(k);
    return '﻿' + [keys.join(','), ...rows.map(r => keys.map(k => cell(r[k])).join(','))].join('\r\n') + '\r\n';
  }
  const DATASETS = {
    users: () => getUsers().map(u => ({ id: u.id, username: u.username, displayName: u.displayName || '', email: u.email || '', age: u.age || '', emailVerified: !!u.emailVerified, createdAt: u.createdAt })),
    movies: () => getMovies().map(m => { const { renditions, sprite, transcribe, processing, subtitles, videoFile, ...r } = m; return r; }),
    shorts: () => { const us = userMap(); return getShorts().map(s => ({ id: s.id, author: (us.get(s.userId) || {}).username || '', caption: s.caption, views: s.views || 0, hidden: !!s.hidden, createdAt: s.createdAt })); },
    comments: () => { const us = userMap(); return getComments().map(x => ({ id: x.id, type: x.type, targetId: x.targetId, author: (us.get(x.userId) || {}).username || '', text: x.text, likes: (x.likes || []).length, pinned: !!x.pinned, createdAt: x.createdAt })); },
    payments: () => { const us = userMap(); return getPayments().map(p => { const { receipt, receiptNumber, ...r } = p; return { ...r, username: (us.get(p.userId) || {}).username || '' }; }); },
    reports: () => getReports(),
    ratings: () => { const us = userMap(), ms = new Map(getMovies().map(m => [m.id, m])), out = []; for (const [mid, e] of Object.entries(readJSON(F('ratings.json'), {}))) for (const [uid, r] of Object.entries(e)) out.push({ movie: (ms.get(mid) || {}).title || mid, username: (us.get(uid) || {}).username || '', stars: r.stars, review: r.review || '', updatedAt: r.updatedAt }); return out; }
  };
  app.get('/api/admin/export/:what', requireAdmin, (req, res) => {
    const name = String(req.params.what).replace(/\.csv$/, ''); const fn = DATASETS[name];
    if (!fn) return res.status(404).json({ error: 'غير موجود' });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', `attachment; filename="${name}-${iso().slice(0, 10)}.csv"`); res.setHeader('Cache-Control', 'no-store');
    res.send(toCsv(fn()));
  });
  c.__toCsv = toCsv;

  /* =================== التقرير الأسبوعي بالبريد =================== */
  function buildReport() {
    const since = now() - 7 * 86400e3, within = d => Date.parse(d) > since;
    const users = getUsers().filter(u => within(u.createdAt)).length;
    const shorts = getShorts().filter(s => within(s.createdAt)).length;
    const movies = getMovies().filter(m => within(m.createdAt)).length;
    const comments = getComments().filter(x => within(x.createdAt)).length;
    let reviews = 0; for (const e of Object.values(readJSON(F('ratings.json'), {}))) for (const r of Object.values(e)) if (within(r.createdAt)) reviews++;
    const pays = getPayments(); const paid = pays.filter(p => p.status === 'approved' && within(p.decidedAt || p.createdAt || 0)).length;
    const a = getAnalytics(); let views = 0; for (let i = 0; i < 7; i++) views += Number((a.dailyViews || {})[new Date(now() - i * 86400e3).toISOString().slice(0, 10)] || 0);
    const top = [...getMovies()].sort((x, y) => (y.views || 0) - (x.views || 0)).slice(0, 5);
    const openReports = getReports().filter(r => r.status === 'open').length;
    const lines = [['مستخدمون جدد', users], ['مشاهدات (7 أيام)', views], ['أفلام مضافة', movies], ['مقاطع Shorts جديدة', shorts], ['تعليقات جديدة', comments], ['تقييمات جديدة', reviews], ['مدفوعات موافق عليها', paid], ['بلاغات مفتوحة', openReports]];
    const text = ['تقرير سينما أسامة الأسبوعي', '', ...lines.map(([k, v]) => `${k}: ${v}`), '', 'الأكثر مشاهدة:', ...top.map((m, i) => `${i + 1}. ${m.title} — ${m.views || 0}`)].join('\n');
    const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif"><h2>تقرير سينما أسامة الأسبوعي</h2><table cellpadding="6" style="border-collapse:collapse">${lines.map(([k, v]) => `<tr><td style="border-bottom:1px solid #ddd">${k}</td><td style="border-bottom:1px solid #ddd"><b>${v}</b></td></tr>`).join('')}</table><h3>الأكثر مشاهدة</h3><ol>${top.map(m => `<li>${String(m.title).replace(/</g, '&lt;')} — ${m.views || 0}</li>`).join('')}</ol></div>`;
    return { text, html, lines };
  }
  async function sendReport(to) {
    const r = buildReport();
    return mailer.sendMail({ to, subject: 'تقرير سينما أسامة الأسبوعي', text: r.text, html: r.html });
  }
  app.post('/api/admin/report/send-now', requireAdmin, async (req, res) => {
    const to = String((req.body && req.body.to) || getCfg().report.to || process.env.ADMIN_EMAIL || '').trim();
    if (!/^[^\s@]{1,64}@[^\s@.]+(?:\.[^\s@.]+)+$/.test(to)) return res.status(400).json({ error: 'أدخل بريداً صالحاً أولاً.' });
    const r = await sendReport(to); res.json({ success: true, sent: !!r.sent, dev: !!r.dev, error: r.error || undefined });
  });
  app.get('/api/admin/report/preview', requireAdmin, (req, res) => res.json(buildReport()));
  async function reportTick() {
    const g = getCfg(), r = g.report; if (!r.on || !r.to) return;
    const d = new Date(), today = d.toISOString().slice(0, 10);
    if (d.getDay() !== r.day || d.getHours() < r.hour || r.lastSent === today) return;
    g.report.lastSent = today; saveCfg(g); // نحجز اليوم قبل الإرسال لمنع التكرار
    await sendReport(r.to).catch(() => {});
  }
  setInterval(() => reportTick().catch(() => {}), 10 * 60 * 1000).unref();
  c.__reportTick = reportTick;
};

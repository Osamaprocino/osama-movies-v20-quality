/* ===================================================================
   الإصدار 15 — دردشة وتفاعلات البث المباشر + استوديو القناة (إحصاءات صاحب القناة)
   =================================================================== */
const path = require('path');

module.exports = function registerV15(c) {
  const { app, ext, readJSON, getUser, requireUser, sameOrigin, hit, tr, cleanLine, getMovies, getShorts, DATA_DIR, hasBanned } = c;
  const F = n => path.join(DATA_DIR, n);
  const REACT = new Set(['❤️', '🔥', '👏', '😂', '😮', '🎉']);
  const MAX_CHAT = 200;
  const live = id => (ext.lives && ext.lives.get(id)) || null;

  app.get('/api/live/:id/chat', (req, res) => {
    const l = live(req.params.id); if (!l) return res.status(404).json({ error: tr(req, 'target_not_found') });
    const after = Number(req.query.after) || 0; l.chat = l.chat || []; l.chatSeq = l.chatSeq || 0;
    res.set('Cache-Control', 'no-store');
    res.json({ items: l.chat.filter(m => m.n > after).slice(-60), last: l.chatSeq, ended: l.ended });
  });
  app.post('/api/live/:id/chat', sameOrigin, requireUser, async (req, res) => {
    const l = live(req.params.id); if (!l || l.ended) return res.status(404).json({ error: tr(req, 'target_not_found') });
    const b = req.body || {}; const react = typeof b.react === 'string' && REACT.has(b.react) ? b.react : '';
    if (hit(`livechat:${req.user.id}`, react ? 60 : 20, 60 * 1000)) return res.status(429).json({ error: tr(req, 'too_many') });
    const text = react ? '' : cleanLine(b.text, 200);
    if (!react && !text) return res.status(400).json({ error: tr(req, 'movie_fields') });
    if (text && hasBanned(text)) return res.status(422).json({ error: tr(req, 'banned_word'), code: 'banned_word' });
    if (text && ext.moderateText && await ext.moderateText(text)) return res.status(422).json({ error: tr(req, 'moderated'), code: 'moderated' });
    l.chat = l.chat || []; l.chatSeq = (l.chatSeq || 0) + 1;
    const item = { n: l.chatSeq, id: l.chatSeq, user: req.user.username, name: req.user.displayName || req.user.username, avatarUrl: req.user.avatarUrl || '', verified: !!(ext.isVerified && ext.isVerified(req.user.id)), type: react ? 'r' : 'm', text: react || text, at: Date.now() };
    l.chat.push(item); while (l.chat.length > MAX_CHAT) l.chat.shift();
    res.status(201).json({ n: item.n });
  });
  app.delete('/api/live/:id/chat/:n', sameOrigin, (req, res) => {
    const l = live(req.params.id); if (!l) return res.status(404).json({ error: tr(req, 'target_not_found') });
    if (!(ext.liveCan && ext.liveCan(req, l))) return res.status(403).json({ error: tr(req, 'forbidden') });
    const n = Number(req.params.n); const m = (l.chat || []).find(x => x.n === n); if (m) { m.type = 'd'; m.text = ''; }
    res.json({ success: true });
  });

  /* ---------- استوديو القناة ---------- */
  app.get('/api/user/studio', requireUser, (req, res) => {
    const mine = getMovies().filter(m => m.userId === req.user.id);
    const shorts = getShorts().filter(s => s.userId === req.user.id);
    const followers = Object.values(readJSON(F('follows.json'), {})).filter(a => a.includes(req.user.id)).length;
    const sum = a => a.reduce((n, x) => n + Number(x.views || 0), 0);
    const items = mine.map(m => ({ id: m.id, title: m.title, posterUrl: m.posterUrl, views: Number(m.views || 0), createdAt: m.createdAt, pending: !!m.pending })).sort((a, b) => b.views - a.views);
    res.json({ followers, movies: mine.length, shorts: shorts.length, movieViews: sum(mine), shortViews: sum(shorts), totalViews: sum(mine) + sum(shorts), top: items.slice(0, 10), pending: items.filter(x => x.pending).length });
  });
};

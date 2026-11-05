/* ===================================================================
   الإصدار 17.2 — «الطيّار الآلي» + اقتراحات استباقية للمدير
   • يعمل تلقائياً كل 15 دقيقة (إن فُعّل): يكتب أوصافاً للأفلام الناقصة، يقبل أفلام المستخدمين الموثّقين،
     يضيف وسوماً مقترحة، ويحفظ ملخصاً بما ينتظر المراجعة. لا يقبل دفعات ولا يحذف شيئاً أبداً.
   =================================================================== */
const path = require('path');
module.exports = function registerV17c(c) {
  const { app, ext, readJSON, writeJSONAtomic, requireAdmin, sameOrigin, getMovies, saveMovies, getUsers, getPayments, recordEvent, DATA_DIR } = c;
  const F = n => path.join(DATA_DIR, n);
  const CFG = () => ({ enabled: false, fillDescriptions: true, addTags: true, approveVerified: false, ...readJSON(F('autopilot.json'), {}) });
  const LOG = () => readJSON(F('autopilot-log.json'), []);
  const norm = s => String(s || '').toLowerCase().replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const STOPW = new Set('الذي التي هذا هذه ذلك عندما بعد قبل خلال حيث كان كانت يكون لكن ايضا كما منذ الى على عن مع فيه فيها the and with that this from for'.split(' ').map(norm));
  const tagsFrom = text => { const f = {}; for (const w of norm(text).split(' ')) if (w.length > 3 && !STOPW.has(w)) f[w] = (f[w] || 0) + 1; return Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => x[0]); };
  const GEN = m => { const cat = m.category && m.category !== 'عام' ? `عمل ${m.category}ي` : 'عمل سينمائي', y = m.year ? ` (${m.year})` : '', d = m.director ? ` من إخراج ${m.director}` : '', cs = (m.cast || []).length ? ` بطولة ${m.cast.slice(0, 4).join('، ')}` : ''; return `${cat} بعنوان «${m.title}»${y}${d}${cs}. شاهده الآن على سينما أسامة.`.slice(0, 600); };
  const verifiedIds = () => new Set(Object.keys(readJSON(F('verified.json'), {})));

  function run(manual) {
    const k = CFG(), movies = getMovies(), res = { at: new Date().toISOString(), manual: !!manual, did: [] };
    let changed = false;
    if (k.fillDescriptions) { let n = 0; for (const m of movies) if (!m.pending && String(m.description || '').trim().length < 30) { m.description = GEN(m); n++; } if (n) { changed = true; res.did.push(`كتبتُ وصفاً لـ ${n} فيلم`); } }
    if (k.addTags) { let n = 0; for (const m of movies) if (!m.pending && !(m.tags || []).length && String(m.description || '').length > 40) { const t = tagsFrom(`${m.title} ${m.description}`); if (t.length) { m.tags = t; n++; } } if (n) { changed = true; res.did.push(`أضفتُ وسوماً لـ ${n} فيلم`); } }
    if (k.approveVerified) { const vid = verifiedIds(); let n = 0; for (const m of movies) if (m.pending && m.userId && vid.has(m.userId)) { delete m.pending; n++; } if (n) { changed = true; res.did.push(`قبلتُ ${n} فيلم من مستخدمين موثّقين`); } }
    if (changed) saveMovies(movies);
    res.waiting = { payments: getPayments().filter(p => p.status === 'pending').length, userMovies: getMovies().filter(m => m.pending).length, verify: (readJSON(F('verify-requests.json'), []) || []).filter(r => r.status === 'pending').length };
    if (res.did.length || manual) { const l = LOG(); l.unshift(res); writeJSONAtomic(F('autopilot-log.json'), l.slice(0, 40)); try { if (res.did.length) recordEvent('agent', { title: 'الطيّار الآلي: ' + res.did.join('، '), username: 'autopilot' }); } catch {} }
    return res;
  }
  setInterval(() => { try { if (CFG().enabled) run(false); } catch (e) { console.error('autopilot', e.message); } }, 15 * 60 * 1000).unref();

  app.get('/api/admin/autopilot', requireAdmin, (req, res) => res.json({ ...CFG(), log: LOG().slice(0, 10) }));
  app.put('/api/admin/autopilot', sameOrigin, requireAdmin, (req, res) => { const b = req.body || {}, k = CFG(); for (const x of ['enabled', 'fillDescriptions', 'addTags', 'approveVerified']) if (x in b) k[x] = !!b[x]; writeJSONAtomic(F('autopilot.json'), k); res.json(k); });
  app.post('/api/admin/autopilot/run', sameOrigin, requireAdmin, (req, res) => res.json(run(true)));

  /* اقتراحات استباقية: كل اقتراح أمر جاهز للوكيل */
  app.get('/api/admin/agent/suggest', requireAdmin, (req, res) => {
    const ms = getMovies(), out = [];
    const weak = ms.filter(m => !m.pending && String(m.description || '').trim().length < 30).length; if (weak) out.push({ text: `${weak} فيلم بلا وصف كافٍ`, cmd: 'ولّد وصفاً للأفلام الناقصة' });
    const pm = ms.filter(m => m.pending && m.userId).length; if (pm) out.push({ text: `${pm} فيلم مستخدم ينتظر مراجعتك`, cmd: 'وافق على كل أفلام المستخدمين المعلقة' });
    const vr = (readJSON(F('verify-requests.json'), []) || []).filter(r => r.status === 'pending').length; if (vr) out.push({ text: `${vr} طلب توثيق`, cmd: 'وافق على كل طلبات التوثيق' });
    const pp = getPayments().filter(p => p.status === 'pending').length; if (pp) out.push({ text: `${pp} دفعة بانتظار التحقق (راجع الإيصالات في شام كاش)`, cmd: 'وافق على كل الدفعات المعلقة', careful: true });
    res.json({ items: out });
  });
};

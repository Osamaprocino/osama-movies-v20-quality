/* ===================================================================
   الإصدار 17.3 — «البحث الذكي» لموقع العرض (محلي بلا API) — يتعلّم من المستخدمين ومن المدير
   • ترتيب BM25 مبسّط على العنوان/الوسوم/الممثلين/المخرج/الوصف + مرادفات + تسامح مع الأخطاء الإملائية
   • يفهم: «بعد 2015» «قبل 2010» «التسعينات» «مجاني/مدفوع» «مثل فيلم X» «الأحدث/الأكثر مشاهدة» والمزاج
   • يتعلّم: نقرات النتائج ترفع الفيلم لنفس البحث، وما لا نتيجة له يظهر للمدير ليعلّمه مرادفاً
   =================================================================== */
const path = require('path');
module.exports = function registerV17d(c) {
  const { app, ext, readJSON, writeJSONAtomic, requireAdmin, sameOrigin, hit, getMovies, getUser, publicMovie, DATA_DIR } = c;
  const F = n => path.join(DATA_DIR, n);
  const LF = F('assist-learn.json');
  const L = () => ({ clicks: {}, zero: {}, queries: {}, synonyms: {}, ...readJSON(LF, {}) });
  const save = d => writeJSONAtomic(LF, d);

  const norm = s => String(s || '').toLowerCase().replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ё/g, 'е')
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const stem = w => { w = w.replace(/^(وال|بال|لل|ال)/, ''); if (w.length > 5) w = w.replace(/(ات|ون|ين|ان|ها|هم)$/, ''); if (/^[a-z]+$/.test(w) && w.length > 3) w = w.replace(/s$/, ''); return w; };
  const STOP = new Set('في من على الى عن مع هل ما ماذا اريد ابي بدي ابغي اطلب اعطني اعطيني اقترح لي لو سمحت شو كم فيلم افلام فلم مسلسل the a an of for me show find movie movies film films please want some i to and or like с в на и по для мне хочу фильм фильмы покажи найди ابحث دور عن ورني'.split(' ').map(norm));
  const lev = (a, b, lim) => { if (Math.abs(a.length - b.length) > lim) return lim + 1; let prev = Array.from({ length: b.length + 1 }, (_, i) => i); for (let i = 1; i <= a.length; i++) { const cur = [i]; let mn = i; for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); mn = Math.min(mn, cur[j]); } if (mn > lim) return lim + 1; prev = cur; } return prev[b.length]; };

  /* مرادفات مدمجة: [محفّزات] → [توسعات] */
  const SYN = [
    [['مضحك', 'كوميدي', 'كوميديا', 'فكاهي', 'ضحك', 'funny', 'comedy', 'смешной', 'комедия'], ['كوميد', 'comedy', 'комед', 'ضحك']],
    [['رعب', 'مخيف', 'مرعب', 'ترويع', 'scary', 'horror', 'ужасы', 'страшный'], ['رعب', 'horror', 'ужас']],
    [['اكشن', 'قتال', 'حركه', 'مغامره', 'action', 'боевик', 'adventure'], ['اكشن', 'action', 'боевик', 'مغامر']],
    [['رومانسي', 'حب', 'عاطفي', 'غرام', 'romance', 'love', 'романтика'], ['رومانس', 'romance', 'حب', 'романт']],
    [['حزين', 'مؤثر', 'دراما', 'تبكي', 'drama', 'sad', 'драма'], ['دراما', 'drama', 'драма']],
    [['جريمه', 'بوليسي', 'غموض', 'تشويق', 'اثاره', 'thriller', 'crime', 'mystery', 'триллер', 'детектив'], ['جريم', 'thriller', 'crime', 'غموض', 'تشويق', 'триллер']],
    [['خيال', 'علمي', 'فضاء', 'مستقبل', 'scifi', 'fantasy', 'фантастика'], ['خيال', 'sci', 'fantasy', 'فضاء', 'фантаст']],
    [['كرتون', 'انمي', 'رسوم', 'اطفال', 'cartoon', 'anime', 'kids', 'animation', 'мультфильм'], ['كرتون', 'انمي', 'animation', 'اطفال', 'мульт']],
    [['وثائقي', 'documentary', 'документальный'], ['وثائق', 'documentary', 'документал']],
    [['حرب', 'war', 'عسكري', 'война'], ['حرب', 'war', 'война']],
    [['تاريخي', 'تاريخ', 'history', 'historical', 'исторический'], ['تاريخ', 'history', 'истор']],
    [['عائلي', 'عايلي', 'اسره', 'family'], ['عائل', 'family', 'اسر']],
  ].map(([t, e]) => [t.map(x => stem(norm(x))), e.map(x => stem(norm(x)))]);

  /* ---------- فهم الجملة: مرشّحات خارج النص ---------- */
  function understand(q) {
    let n = norm(q); const f = { notes: [] };
    const cut = re => { const m = n.match(re); if (m) n = n.replace(m[0], ' ').replace(/\s+/g, ' ').trim(); return m; };
    let m;
    if ((m = cut(/(?:بعد|من سنه|منذ|after|since|from|после)\s+(\d{4})/))) { f.yMin = +m[1]; f.notes.push(`بعد ${m[1]}`); }
    if ((m = cut(/(?:قبل|before|until|до)\s+(\d{4})/))) { f.yMax = +m[1]; f.notes.push(`قبل ${m[1]}`); }
    if ((m = cut(/(?:سنه|عام|في|in|year)\s+(\d{4})/))) { f.yMin = f.yMax = +m[1]; f.notes.push(`سنة ${m[1]}`); }
    if ((m = cut(/(?:ال)?(ثمانينات|80s|80)/))) { f.yMin = 1980; f.yMax = 1989; f.notes.push('الثمانينات'); }
    else if ((m = cut(/(?:ال)?(تسعينات|90s)/))) { f.yMin = 1990; f.yMax = 1999; f.notes.push('التسعينات'); }
    else if ((m = cut(/(?:ال)?(الفينات|2000s)/))) { f.yMin = 2000; f.yMax = 2009; f.notes.push('الألفينات'); }
    if (cut(/(?<![\\p{L}\\p{N}])(مجاني|مجانا|مجانيه|free|бесплатн\w*)(?![\\p{L}\\p{N}])/u)) { f.free = true; f.notes.push('مجاني'); }
    else if (cut(/(?<![\\p{L}\\p{N}])(مدفوع|مدفوعه|paid|платн\w*)(?![\\p{L}\\p{N}])/u)) { f.paid = true; f.notes.push('مدفوع'); }
    if (cut(/(?<![\\p{L}\\p{N}])(احدث|الاحدث|جديد|الجديد|اخر|new|latest|newest|новые|свежие)(?![\\p{L}\\p{N}])/u)) { f.sort = 'new'; f.notes.push('الأحدث'); }
    else if (cut(/(?<![\\p{L}\\p{N}])(اشهر|الاشهر|الاكثر مشاهده|الاكثر|مشهور|popular|top|trending|топ|популярные)(?![\\p{L}\\p{N}])/u)) { f.sort = 'views'; f.notes.push('الأكثر مشاهدة'); }
    if ((m = cut(/(?:مثل|شبه|زي|يشبه|مشابه ل|مشابه|similar to|like|похож на|как)\s+(?:فيلم\s+)?(.+)$/))) { f.like = m[1].trim(); }
    f.rest = n; return f;
  }

  const fieldsOf = m => ({
    title: norm(m.title), tags: norm([(m.tags || []).join(' '), m.category].join(' ')),
    people: norm([m.director, (m.cast || []).join(' '), m.country, m.series, m.language].join(' ')), desc: norm(m.description), year: String(m.year || ''),
  });
  const words = s => s.split(' ').filter(Boolean);
  function similarity(a, b) {
    let s = 0; if (a.category && a.category === b.category) s += 3; if (a.director && a.director === b.director) s += 3;
    for (const x of a.cast || []) if ((b.cast || []).includes(x)) s += 2;
    for (const x of a.tags || []) if ((b.tags || []).map(t => String(t).toLowerCase()).includes(String(x).toLowerCase())) s += 1.5;
    if (a.country && a.country === b.country) s += .5; if (a.year && b.year) s += Math.max(0, 1 - Math.abs(a.year - b.year) / 20); return s;
  }

  const F_exact = (m, rest) => { const t = norm(m.title), r = norm(rest); return r.length > 2 && (t === r || t.includes(r) || r.includes(t)) && t.length > 2; };
  function search(q, req, limit = 12) {
    const learn = L(), u = getUser ? getUser(req) : null;
    let pool = ext.filterMovies ? ext.filterMovies(getMovies(), req) : getMovies();
    pool = pool.filter(m => !(ext.isScheduled && ext.isScheduled(m)) && !m.pending);
    const f = understand(q), out = { items: [], notes: f.notes.slice(), didYouMean: '' };
    if (f.yMin) pool = pool.filter(m => m.year && m.year >= f.yMin); if (f.yMax) pool = pool.filter(m => m.year && m.year <= f.yMax);
    if (f.free) pool = pool.filter(m => !m.isPaid); if (f.paid) pool = pool.filter(m => m.isPaid);
    const key = norm(q);
    let like = null;
    if (f.like) { const lk = norm(f.like); const cand = pool.filter(m => norm(m.title).includes(lk)); const pick = cand[0] || getMovies().map(m => [m, lev(lk, norm(m.title), 3)]).filter(([, d]) => d <= 3).sort((a, b) => a[1] - b[1]).map(x => x[0])[0]; if (pick) { like = pick; out.notes.push(`مشابه لـ «${pick.title}»`); } }

    const base = words(f.rest).filter(w => !STOP.has(w)).map(stem).filter(w => w.length > 1);
    const taught = learn.synonyms || {};
    const terms = new Map(); for (const w of base) terms.set(w, 1);
    for (const w of base) {
      for (const [trig, exp] of SYN) if (trig.includes(w)) for (const e of exp) if (!terms.has(e)) terms.set(e, .7);
      const t = taught[w]; if (t) for (const e of t) { const s = stem(norm(e)); if (s && !terms.has(s)) terms.set(s, .9); }
    }
    const idx = pool.map(m => ({ m, f: fieldsOf(m) }));
    const N = idx.length || 1, df = new Map();
    for (const t of terms.keys()) { let d = 0; for (const x of idx) if ((x.f.title + ' ' + x.f.tags + ' ' + x.f.people + ' ' + x.f.desc).includes(t)) d++; df.set(t, d); }
    const hist = {}; if (u) { const lib = (readJSON(F('library.json'), {})[u.id] || {}).history || []; const byId = new Map(getMovies().map(m => [m.id, m])); for (const id of lib.slice(0, 30)) { const m = byId.get(id); if (m && m.category) hist[m.category] = (hist[m.category] || 0) + 1; } }
    const clicks = learn.clicks[key] || {};
    const tokMatch = (text, t) => { let best = 0; for (const w of words(text)) { const sw = w.length > 3 ? stem(w) : w; if (sw === t) { best = Math.max(best, 1); } else if (t.length >= 3 && sw.startsWith(t)) best = Math.max(best, .75); else if (t.length >= 4) { const d = lev(sw, t, t.length > 6 ? 2 : 1); if (d <= (t.length > 6 ? 2 : 1)) best = Math.max(best, .55); } } return best; };

    const scored = [];
    for (const { m, f: F2 } of idx) {
      let s = 0; const why = new Set();
      for (const [t, wt] of terms) {
        const idf = Math.log(1 + N / (1 + (df.get(t) || 0)));
        let a;
        if ((a = tokMatch(F2.title, t))) { s += 6 * a * wt * idf; why.add('العنوان'); }
        if ((a = tokMatch(F2.tags, t))) { s += 3 * a * wt * idf; why.add('التصنيف/الوسوم'); }
        if ((a = tokMatch(F2.people, t))) { s += 3 * a * wt * idf; why.add('الطاقم/البلد'); }
        if (t.length > 2 && F2.desc.includes(t)) { s += 1 * wt * idf; why.add('الوصف'); }
        if (F2.year === t) { s += 4; why.add('السنة'); }
      }
      if (key.length > 2 && F2.title.includes(norm(f.rest)) && f.rest.length > 2) { s += 8; why.add('العنوان'); }
      if (like && m.id !== like.id) { const sim = similarity(like, m); if (sim > 0) { s += sim * 2; why.add(`يشبه «${like.title}»`); } }
      if (like && m.id === like.id) continue;
      const matchedText = s > 0;
      if (!matchedText && (terms.size || like)) continue;
      s += Math.log10(1 + Number(m.views || 0)) * .3 + (clicks[m.id] ? Math.min(4, clicks[m.id]) : 0) + (hist[m.category] ? Math.min(1, hist[m.category] * .25) : 0);
      scored.push({ m, s, why: clicks[m.id] ? ['اختاره باحثون قبلك', ...why] : [...why] });
    }
    if (f.sort === 'new') scored.sort((a, b) => String(b.m.createdAt).localeCompare(String(a.m.createdAt)) || b.s - a.s);
    else if (f.sort === 'views') scored.sort((a, b) => Number(b.m.views || 0) - Number(a.m.views || 0) || b.s - a.s);
    else scored.sort((a, b) => b.s - a.s);
    out.confident = !!scored.length && (scored.length === 1 || scored[0].s >= scored[1].s * 1.6 || F_exact(scored[0].m, f.rest));
    out.items = scored.slice(0, limit).map(x => { const p = publicMovie(x.m); return { score: Math.round(x.s * 10) / 10, id: p.id, title: p.title, posterUrl: p.posterUrl, category: p.category, year: p.year || '', views: Number(p.views || 0), isPaid: !!p.isPaid, why: x.why.slice(0, 3) }; });
    if (!out.items.length && key.length > 2) {
      let best = null, bd = 99; for (const m of pool) for (const w of words(norm(m.title))) for (const t of base) { const d = lev(stem(w), t, 3); if (d < bd && d > 0) { bd = d; best = m.title; } }
      if (best && bd <= 3) out.didYouMean = best;
    }
    return out;
  }
  ext.smartSearch = search;

  /* ---------- قاعدة معرفة يعلّمها المدير للمساعد (سؤال ← جواب) + أسئلة لم يعرف جوابها ---------- */
  const KF = F('assist-kb.json');
  const KB = () => readJSON(KF, []);
  const kbToks = s => words(norm(s)).filter(w => !STOP.has(w)).map(stem).filter(w => w.length > 1);
  ext.kbMatch = q => {
    const qt = new Set(kbToks(q)); if (!qt.size) return null; let best = null, bs = 0;
    for (const e of KB()) {
      const et = [...new Set(kbToks(e.q))]; if (!et.length) continue;
      let hitn = 0; for (const t of et) { if (qt.has(t)) hitn++; else if (t.length >= 4) for (const w of qt) if (w.length >= 4 && lev(w, t, 1) <= 1) { hitn += .8; break; } }
      const cov = hitn / et.length, prec = hitn / Math.max(1, qt.size); const sc = cov * .75 + prec * .25;
      if (cov >= (et.length >= 3 ? .6 : 1) && hitn >= Math.min(2, et.length) && sc > bs) { bs = sc; best = e; }
    }
    return best;
  };
  ext.logUnanswered = q => { try { const d = L(); d.unanswered = d.unanswered || {}; const k = String(q).trim().slice(0, 120); if (k.length < 3) return; d.unanswered[k] = (d.unanswered[k] || 0) + 1; const e = Object.entries(d.unanswered); if (e.length > 200) d.unanswered = Object.fromEntries(e.sort((a, b) => b[1] - a[1]).slice(0, 150)); save(d); } catch {} };
  app.get('/api/admin/assist-kb', requireAdmin, (req, res) => { const d = L(); res.json({ items: KB(), unanswered: Object.entries(d.unanswered || {}).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([q, n]) => ({ q, n })) }); });
  app.post('/api/admin/assist-kb', sameOrigin, requireAdmin, (req, res) => {
    const b = req.body || {}, q = String(b.q || '').replace(/\s+/g, ' ').trim().slice(0, 200), a = String(b.answer || '').trim().slice(0, 1500);
    if (kbToks(q).length < 1 || a.length < 2) return res.status(400).json({ error: 'اكتب السؤال (أو كلماته المفتاحية) والجواب.' });
    const l = KB().filter(x => norm(x.q) !== norm(q)); l.unshift({ id: require('crypto').randomUUID(), q, answer: a, at: new Date().toISOString(), hits: 0 });
    writeJSONAtomic(KF, l.slice(0, 300)); const d = L(); if (d.unanswered) { for (const k of Object.keys(d.unanswered)) if (norm(k) === norm(q)) delete d.unanswered[k]; save(d); } res.status(201).json({ ok: true });
  });
  app.delete('/api/admin/assist-kb/:id', sameOrigin, requireAdmin, (req, res) => { writeJSONAtomic(KF, KB().filter(x => x.id !== req.params.id)); res.json({ ok: true }); });
  app.delete('/api/admin/assist-unanswered', sameOrigin, requireAdmin, (req, res) => { const d = L(); d.unanswered = {}; save(d); res.json({ ok: true }); });
  ext.kbHit = id => { try { const l = KB(), e = l.find(x => x.id === id); if (e) { e.hits = (e.hits || 0) + 1; writeJSONAtomic(KF, l); } } catch {} };

  /* ---------- نقاط النهاية العامة ---------- */
  app.get('/api/assist/search', (req, res) => {
    if (hit(`ssearch:${req.ip}`, 90, 60 * 1000)) return res.status(429).json({ error: 'too many requests' });
    const q = String(req.query.q || '').slice(0, 200).trim(); if (q.length < 2) return res.json({ items: [], notes: [], didYouMean: '' });
    const r = search(q, req);
    try { const d = L(), k = norm(q).slice(0, 80); d.queries[k] = (d.queries[k] || 0) + 1; if (!r.items.length) d.zero[k] = (d.zero[k] || 0) + 1;
      for (const o of ['queries', 'zero']) { const e = Object.entries(d[o]); if (e.length > 400) d[o] = Object.fromEntries(e.sort((a, b) => b[1] - a[1]).slice(0, 300)); } save(d); } catch {}
    res.json(r);
  });
  app.post('/api/assist/click', sameOrigin, (req, res) => {
    if (hit(`sclick:${req.ip}`, 40, 60 * 1000)) return res.status(429).json({ error: 'too many requests' });
    const b = req.body || {}, k = norm(String(b.q || '')).slice(0, 80), id = String(b.id || '');
    if (k.length < 2 || !getMovies().some(m => m.id === id)) return res.json({ ok: false });
    const d = L(); (d.clicks[k] = d.clicks[k] || {})[id] = (d.clicks[k][id] || 0) + 1; delete d.zero[k];
    const ks = Object.keys(d.clicks); if (ks.length > 500) for (const x of ks.slice(0, ks.length - 400)) delete d.clicks[x];
    save(d); res.json({ ok: true });
  });

  /* ---------- للمدير: ماذا يبحث الناس + تعليم مرادفات ---------- */
  app.get('/api/admin/search-insights', requireAdmin, (req, res) => {
    const d = L(), top = o => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([q, n]) => ({ q, n }));
    res.json({ top: top(d.queries), zero: top(d.zero), synonyms: Object.entries(d.synonyms).map(([w, t]) => ({ word: w, means: t })) });
  });
  app.put('/api/admin/search-synonyms', sameOrigin, requireAdmin, (req, res) => {
    const b = req.body || {}, w = stem(norm(b.word)); const means = (Array.isArray(b.means) ? b.means : String(b.means || '').split(/[,،]/)).map(x => String(x).trim().slice(0, 40)).filter(Boolean).slice(0, 10);
    if (!w || w.length < 2 || !means.length) return res.status(400).json({ error: 'اكتب الكلمة ومعناها (كلمة أو أكثر مفصولة بفاصلة).' });
    const d = L(); d.synonyms[w] = means; delete d.zero[norm(b.word)]; save(d); res.json({ ok: true });
  });
  app.delete('/api/admin/search-synonyms/:w', sameOrigin, requireAdmin, (req, res) => { const d = L(); delete d.synonyms[req.params.w]; save(d); res.json({ ok: true }); });
};

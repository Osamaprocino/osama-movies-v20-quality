/* ===================================================================
   الإصدار 17.1 — «وكيل أسامة»: يفهم أوامر مكتوبة بالعربية/English ويحوّلها إلى خطوات تنفيذ تراها وتوافق عليها
   • بلا API: محلل أوامر قواعدي. لا ينفّذ شيئاً بنفسه: يعرض خطة، وعند الموافقة يستدعي المتصفح (بجلسة الأدمن)
     نفس نقاط النهاية الموجودة أصلاً، فكل التحققات والصلاحيات كما هي.
   =================================================================== */
const path = require('path');
module.exports = function registerV17b(c) {
  const { app, ext, readJSON, requireAdmin, sameOrigin, getMovies, saveMovies, getUsers, getPayments, recordEvent, DATA_DIR } = c;
  const F = n => path.join(DATA_DIR, n);
  const norm = s => String(s || '').toLowerCase().replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/[^\p{L}\p{N}\s@_.-]/gu, ' ').replace(/\s+/g, ' ').trim();
  const has = (n, re) => re.test(n);
  const MAX = 50;

  // اسم/نص مستهدف: «..» أو ".." أو @user
  const quoted = q => { const m = String(q).match(/[«"“'‘]([^«»"”'’]{1,120})[»"”'’]/); return m ? m[1].trim() : ''; };
  const atUser = q => { const m = String(q).match(/@([\w.\-]{2,30})/); return m ? m[1] : ''; };
  const wordAfter = (q, re) => { const m = String(q).match(re); return m ? m[1].trim() : ''; };
  const findUser = q => {
    const cand = quoted(q) || atUser(q) || wordAfter(q, /(?:المستخدم|الحساب|صاحب|user|username)\s+@?([\w.\-]{2,30})/i);
    if (!cand) return null; const k = cand.toLowerCase();
    return getUsers().find(u => u.usernameLower === k) || null;
  };
  const findMovies = name => {
    const k = norm(name); if (!k) return [];
    const all = getMovies(); const ex = all.filter(m => norm(m.title) === k); if (ex.length) return ex;
    const inc = all.filter(m => norm(m.title).includes(k)); if (inc.length) return inc;
    if (k.length < 4) return [];
    const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
    const lim = k.length > 8 ? 3 : 2; const sc = all.map(m => [m, lev(k, norm(m.title))]).filter(([, d]) => d <= lim).sort((a, b) => a[1] - b[1]);
    return sc.length && (sc.length === 1 || sc[0][1] < sc[1][1]) ? [sc[0][0]] : sc.map(x => x[0]);
  };
  const movieName = (q, stripRe) => quoted(q) || String(q).replace(stripRe, ' ').replace(/\s+(الى|إلى|الي|to)\s+.*$/i, '').trim();
  const num = q => { const m = String(q).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).match(/(\d[\d.,]*)/g); return m ? m.map(x => Number(x.replace(/,/g, ''))) : []; };
  const afterTo = q => { const m = String(q).match(/(?:الى|إلى|الي|to|ب)\s+[«"“']?([^«»"”']+?)[»"”']?\s*$/i); return m ? m[1].trim() : ''; };

  const plan = (summary, steps, extra = {}) => ({ understood: true, summary, steps: steps.slice(0, MAX), danger: false, ...extra, truncated: steps.length > MAX });
  const no = (msg, options) => ({ understood: false, message: msg, options: options || [] });
  const post = (label, url, body, method = 'POST', undo) => ({ label, method, url, body, ...(undo ? { undo } : {}) });
  const U = (url, body, method = 'POST') => ({ method, url, body });
  const S14 = () => ({ userPublish: true, userLive: true, ...readJSON(F('settings14.json'), {}) });
  const S13 = () => ({ approveUserMovies: true, ...readJSON(F('settings13.json'), {}) });
  const PS = () => ({ verifyPrice: 0, ...readJSON(F('payment-settings.json'), {}) });

  function parseOne(q) {
    const n = norm(q); if (!n) return no('اكتب أمراً، مثل: «وافق على كل أفلام المستخدمين المعلقة».');
    const approve = has(n, /(وافق|اقبل|اعتمد|قبول|approve|accept)/), reject = has(n, /(ارفض|رفض|reject|decline)/), del = has(n, /(احذف|امسح|ازل|ازاله|delete|remove)/);

    /* ----- إعدادات الموقع ----- */
    const on = has(n, /(فعل|شغل|افتح|اسمح|enable|allow|turn on)/), off = has(n, /(اوقف|عطل|اقفل|امنع|ايقاف|disable|stop|turn off)/);
    if ((on || off) && has(n, /(نشر|رفع).{0,12}(المستخدمين|الاعضاء|الناس)|(المستخدمين|الاعضاء).{0,12}(نشر|رفع)/))
      return plan(`${on ? 'السماح' : 'منع'} المستخدمين من نشر الأفلام`, [post('تغيير إعداد النشر', '/api/admin/site-settings', { userPublish: !!on && !off }, 'PUT', U('/api/admin/site-settings', { userPublish: S14().userPublish }, 'PUT'))]);
    if ((on || off) && has(n, /بث.{0,10}(المستخدمين|الاعضاء|اصحاب)|(المستخدمين|اصحاب القنوات).{0,10}بث/))
      return plan(`${on ? 'السماح' : 'منع'} أصحاب القنوات من البث`, [post('تغيير إعداد البث', '/api/admin/site-settings', { userLive: !!on && !off }, 'PUT', U('/api/admin/site-settings', { userLive: S14().userLive }, 'PUT'))]);
    if ((on || off) && has(n, /مراجعه (ال)?مسبقه|الموافقه (ال)?مسبقه|مراجعه الافلام/))
      return plan(`${on ? 'تفعيل' : 'إيقاف'} المراجعة المسبقة لأفلام المستخدمين`, [post('تغيير المراجعة المسبقة', '/api/admin/user-movies/settings', { approveUserMovies: !!on && !off }, 'PUT', U('/api/admin/user-movies/settings', { approveUserMovies: S13().approveUserMovies }, 'PUT'))]);

    /* ----- سعر التوثيق ----- */
    if (has(n, /سعر.{0,8}توثيق|رسوم.{0,6}توثيق|verification price/)) { const v = num(q)[0]; if (v == null) return no('كم السعر؟ مثال: «غيّر سعر التوثيق إلى 25000».'); return plan(`ضبط سعر التوثيق إلى ${v}`, [post('حفظ السعر', '/api/admin/payment-settings', { verifyPrice: v }, 'PUT', U('/api/admin/payment-settings', { verifyPrice: PS().verifyPrice }, 'PUT'))]); }

    /* ----- التوثيق ----- */
    if (has(n, /(الغ|الغاء|سحب|ازال|ازاله).{0,10}توثيق|unverify|revoke/)) { const u = findUser(q); if (!u) return no('لم أجد المستخدم. اكتب اسمه بين علامتي تنصيص أو @اسم.'); return plan(`سحب التوثيق من ${u.username}`, [post('سحب التوثيق', '/api/admin/verification-user', { username: u.username, verified: false }, 'POST', U('/api/admin/verification-user', { username: u.username, verified: true }))], { danger: true }); }
    if (has(n, /(وثق|وثّق|منح.{0,6}توثيق|اعط.{0,8}توثيق|verify\b)/) && !has(n, /طلبات|الطلبات/)) { const u = findUser(q); if (!u) return no('لم أجد المستخدم. اكتب اسمه بين علامتي تنصيص أو @اسم.'); return plan(`توثيق ${u.username}`, [post('منح التوثيق', '/api/admin/verification-user', { username: u.username, verified: true }, 'POST', U('/api/admin/verification-user', { username: u.username, verified: false }))]); }
    if ((approve || reject) && has(n, /طلبات?.{0,6}توثيق|توثيق.{0,8}(المعلق|المنتظر)/)) {
      const rq = (readJSON(F('verify-requests.json'), []) || []).filter(r => r.status === 'pending');
      if (!rq.length) return no('لا توجد طلبات توثيق معلّقة.');
      return plan(`${approve ? 'قبول' : 'رفض'} ${rq.length} طلب توثيق`, rq.map(r => post(`${approve ? 'قبول' : 'رفض'} طلب ${r.username || r.userId}`, `/api/admin/verification/${r.id}/${approve ? 'approve' : 'reject'}`, {})), { danger: reject });
    }

    /* ----- حظر البث ----- */
    if (has(n, /بث|live/) && has(n, /(امنع|احظر|block|ban|فك|اسمح|unblock|allow)/)) {
      const u = findUser(q); if (!u) return no('من المستخدم؟ اكتب اسمه بين علامتي تنصيص أو @اسم.');
      const unblock = has(n, /(فك|اسمح|unblock|allow)/); return plan(`${unblock ? 'السماح لـ' : 'منع'} ${u.username} ${unblock ? 'بالبث' : 'من البث'}`, [post('تعديل صلاحية البث', '/api/admin/live/block', { username: u.username, blocked: !!unblock ? false : true }, 'POST', U('/api/admin/live/block', { username: u.username, blocked: !!unblock }))]);
    }

    /* ----- أفلام المستخدمين المعلقة ----- */
    if ((approve || reject || del) && has(n, /افلام.{0,12}(المستخدمين|الاعضاء)|(المستخدمين|الاعضاء).{0,10}افلام|الافلام المعلقه|user movies/)) {
      const pend = getMovies().filter(m => m.userId && m.pending);
      if (!pend.length) return no('لا توجد أفلام مستخدمين معلّقة.');
      const ok = approve && !reject && !del;
      return plan(`${ok ? 'قبول' : 'رفض وحذف'} ${pend.length} فيلم من أفلام المستخدمين المعلّقة`, pend.map(m => post(`${ok ? 'قبول' : 'رفض'}: ${m.title}`, `/api/admin/user-movies/${m.id}/${ok ? 'approve' : 'reject'}`, {})), { danger: !ok });
    }

    /* ----- المدفوعات ----- */
    if ((approve || reject) && has(n, /دفع|ايصال|payment|receipt|مدفوعات/)) {
      const pend = getPayments().filter(p => p.status === 'pending'); const act = approve && !reject ? 'approve' : 'reject';
      const rc = (String(q).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).match(/\b\d{6,14}\b/) || [])[0];
      let sel = pend, what = 'كل الدفعات المعلّقة';
      if (rc) { sel = pend.filter(p => String(p.receipt) === rc); what = `الدفعة ذات الإيصال ${rc}`; }
      else if (findUser(q)) { const u = findUser(q); sel = pend.filter(p => p.userId === u.id); what = `دفعات ${u.username} المعلّقة`; }
      else if (!has(n, /(كل|جميع|all)/)) return no('أي دفعة؟ اكتب رقم الإيصال (مثال: «وافق على الدفعة 123456») أو اسم المستخدم أو «كل الدفعات المعلقة».');
      if (!sel.length) return no(`لا توجد ${what}.`);
      return plan(`${act === 'approve' ? 'قبول' : 'رفض'} ${what} (${sel.length})`, sel.map(p => post(`${act === 'approve' ? 'قبول' : 'رفض'} ${p.username || ''} — ${p.movieTitle || (p.verify ? 'توثيق' : 'اشتراك')} — إيصال ${p.receipt}`, `/api/admin/payments/${p.id}/${act}`, {})),
        { danger: true, note: act === 'approve' ? 'تنبيه: قبول الدفعة يفتح المحتوى للمستخدم فعلاً. تأكد أن رقم الإيصال وصل في تطبيق شام كاش قبل المتابعة.' : '' });
    }

    /* ----- توليد وصف للأفلام الناقصة ----- */
    if (has(n, /(ولد|اكتب|املا|اضف|أضف|generate).{0,20}(وصف|اوصاف|وسوم)|(وصف|اوصاف).{0,20}(ناقص|الناقص|الفارغ)/)) {
      const weak = getMovies().filter(m => !m.pending && String(m.description || '').trim().length < 30);
      if (!weak.length) return no('كل الأفلام لها أوصاف كافية ✅');
      return plan(`كتابة وصف مقترح لـ ${weak.length} فيلم ناقص الوصف`, weak.map(m => post(`وصف: ${m.title}`, '/api/admin/agent/fill-description', { id: m.id }, 'POST', U('/api/admin/agent/edit-movie', { id: m.id, description: m.description || '' }))), { note: 'الأوصاف قوالب مولّدة آلياً — يفضّل مراجعتها وتحسينها.' });
    }

    /* ----- حذف فيلم ----- */
    if (del && has(n, /فيلم|movie/)) {
      const name = movieName(q, /(احذف|امسح|ازل|ازاله|delete|remove|فيلم|الفيلم|movie)/gi); const ms = findMovies(name);
      if (!name) return no('أي فيلم؟ اكتب اسمه بين علامتي تنصيص، مثل: «احذف فيلم «ليلة الرعب»».');
      if (!ms.length) return no(`لم أجد فيلماً باسم «${name}».`);
      if (ms.length > 1) return no(`وجدت ${ms.length} أفلاماً تطابق «${name}». اكتب الاسم كاملاً بين علامتي تنصيص:`, ms.slice(0, 8).map(m => m.title));
      return plan(`حذف الفيلم «${ms[0].title}» نهائياً مع ملفاته`, [post(`حذف: ${ms[0].title}`, `/api/movies/${ms[0].id}`, undefined, 'DELETE')], { danger: true });
    }

    /* ----- تعديل فيلم: تصنيف/عنوان/سعر/وصف ----- */
    const edit = has(n, /(غير|عدل|بدل|اجعل|ضع|change|set|rename)/);
    if (edit && has(n, /فيلم|movie/)) {
      const val = afterTo(q) || quoted(q);
      const field = has(n, /تصنيف|نوع|category/) ? 'category' : has(n, /سعر|price/) ? 'price' : has(n, /وصف|description/) ? 'description' : has(n, /(عنوان|اسم|title|rename)/) ? 'title' : '';
      if (!field) return no('ماذا أغيّر؟ (التصنيف أو السعر أو الوصف أو العنوان)');
      const stripped = String(q).replace(/(غير|عدل|بدل|اجعل|ضع|change|set|rename|تصنيف|نوع|category|سعر|price|وصف|description|عنوان|اسم|title|فيلم|الفيلم|movie|ال)/gi, ' ');
      const nameSrc = String(q).split(/\s+(?:الى|إلى|الي|to)\s+/i)[0];
      const name = quoted(q) && !/(?:الى|إلى|to)\s*[«"]/i.test(q) ? quoted(q) : movieName(nameSrc, /(غير|عدل|بدل|اجعل|ضع|change|set|rename|تصنيف|نوع|category|سعر|price|وصف|description|عنوان|اسم|title|فيلم|الفيلم|movie)/gi);
      const ms = findMovies(name);
      if (!ms.length) return no(`لم أجد فيلماً باسم «${name}». اكتب الأمر هكذا: «غيّر تصنيف فيلم «الاسم» إلى كوميديا».`);
      if (ms.length > 1) return no(`وجدت ${ms.length} أفلاماً. اكتب الاسم كاملاً:`, ms.slice(0, 8).map(m => m.title));
      if (!val) return no('إلى ماذا؟ مثال: «غيّر سعر فيلم «الاسم» إلى 15000».');
      const body = { id: ms[0].id, [field]: field === 'price' ? num(val)[0] : val };
      if (field === 'price' && !(body.price > 0)) return no('سعر غير صالح.');
      const L = { category: 'التصنيف', price: 'السعر', description: 'الوصف', title: 'العنوان' }[field];
      return plan(`تغيير ${L} للفيلم «${ms[0].title}» إلى «${val}»`, [post(`تعديل ${L}`, '/api/admin/agent/edit-movie', body, 'POST', U('/api/admin/agent/edit-movie', { id: ms[0].id, [field]: field === 'price' ? ms[0].price : (ms[0][field] == null ? '' : ms[0][field]) }))]);
    }
    return no('');
  }

  /* ---------- أوامر يعلّمها المدير: عبارة (قد تحوي * ) ← أمر أو عدة أوامر ---------- */
  const MF = F('agent-learned.json');
  const macros = () => readJSON(MF, []);
  const saveMacros = l => require('fs').writeFileSync(MF, JSON.stringify(l.slice(0, 200)));
  const patRe = phrase => { const parts = String(phrase).split('*').map(x => norm(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); return new RegExp('^' + parts.join('\\s*(.+?)\\s*') + '$'); };
  function matchMacro(q) {
    const nq = norm(q).replace(/[«»"]/g, '').trim(); if (!nq) return null;
    for (const m of macros()) { const r = patRe(m.phrase.replace(/[«»"]/g, '')).exec(nq); if (r) { const caps = r.slice(1); return { m, cmds: m.commands.map(c => c.replace(/\$(\d)/g, (_, i) => caps[+i - 1] != null ? caps[+i - 1] : '')) }; } }
    return null;
  }
  // تعلّم بالكتابة: «تعلّم: «عبارة» = أمر ثم أمر»
  const TEACH = /^\s*(?:تعلم|تعلّم|علمتك|علّمتك|learn|teach)\s*[:：]?\s*[«"“]?(.+?)[»"”]?\s*(?:=|←|=>|يعني|means)\s*(.+)$/is;
  function teach(phrase, cmdText) {
    phrase = String(phrase || '').replace(/\s+/g, ' ').trim().slice(0, 80); const np = norm(phrase.replace(/[«»"]/g, ''));
    if (np.length < 3) return no('العبارة قصيرة جداً (3 أحرف على الأقل).');
    const cmds = splitClauses(cmdText).slice(0, 8); if (!cmds.length) return no('اكتب الأمر الذي تريد ربطه بالعبارة.');
    // التحقق من أن كل أمر مفهوم (نختبر بقيم تجريبية للنجمات)
    for (const c of cmds) { const t = c.replace(/\$\d/g, 'تجربة'); const p = parseOne(t); if (!p.understood && !p.message) return no(`لم أفهم الأمر «${c}» — ${p.message || 'صيغة غير مدعومة'}. اربط العبارة بأمر أفهمه.`); }
    const l = macros().filter(x => norm(x.phrase.replace(/[«»"]/g, '')) !== np); l.unshift({ id: crypto.randomUUID(), phrase, commands: cmds, at: new Date().toISOString(), uses: 0 }); saveMacros(l);
    return { understood: false, learned: true, message: `✅ تعلّمتُ: «${phrase}» ← ${cmds.join(' ثم ')}` };
  }

  /* ---------- عدة أوامر في جملة واحدة ---------- */
  const VERB = '(?:وافق|اقبل|اعتمد|ارفض|احذف|امسح|غير|غيّر|عدل|وثق|وثّق|الغ|ألغ|امنع|احظر|اسمح|فعل|فعّل|اوقف|أوقف|عطل|ولد|ولّد|اجعل|ضع)';
  const splitClauses = q => String(q).split(new RegExp('\\s*(?:[;؛\\n]|(?:^|\\s)(?:ثم|وبعدها|وبعدين|بعدها|then)(?=\\s)|\\s+و(?=' + VERB + '))\\s*', 'i')).map(x => x.trim()).filter(Boolean).slice(0, 12);
  function parseAll(q, clauses) {
    if (!clauses) { const t = TEACH.exec(String(q)); if (t) return teach(t[1], t[2]); const mm = matchMacro(q); if (mm) { const r = parseAll(q, mm.cmds); if (r.understood) { r.macro = mm.m.phrase; r.macroId = mm.m.id; } return r; } }
    clauses = (clauses && clauses.length ? clauses : splitClauses(q)).slice(0, 12);
    if (!clauses.length) return no('اكتب أمراً، مثل: «وافق على كل أفلام المستخدمين المعلقة».');
    const res = clauses.map(c => ({ c, p: parseOne(c) })), okp = res.filter(x => x.p.understood), bad = res.filter(x => !x.p.understood).map(x => ({ c: x.c, p: x.p.message ? x.p : no('هذا الأمر غير مدعوم.') }));
    if (!okp.length) return res.length === 1 ? res[0].p : (bad[0] ? bad[0].p : no(''));
    if (okp.length === 1 && !bad.length) return okp[0].p;
    const steps = okp.flatMap(x => x.p.steps);
    return { understood: true, summary: okp.map(x => x.p.summary).join(' ← ثم ← '), steps: steps.slice(0, 80), truncated: steps.length > 80, danger: okp.some(x => x.p.danger),
      note: [...okp.map(x => x.p.note).filter(Boolean), ...bad.map(x => `لم أفهم: «${x.c}» — ${x.p.message}`)].join('\n'), multi: okp.length };
  }

  /* ---------- طبقة اختيارية: نموذج لغوي (OpenAI-compatible) يحوّل الجملة الحرة إلى أوامر قياسية ---------- */
  const LLMF = F('agent-llm.json');
  const llmCfg = () => ({ enabled: false, baseUrl: '', apiKey: '', model: '', ...readJSON(LLMF, {}) });
  const SYS = `أنت محلل أوامر لوحة إدارة موقع أفلام. حوّل طلب المدير إلى قائمة أوامر قياسية، أمراً في كل عنصر، دون شرح. الصيغ المسموحة فقط (اسم الفيلم/المستخدم بين « » أو @):
- أوقف نشر المستخدمين | فعّل نشر المستخدمين | أوقف بث المستخدمين | فعّل بث المستخدمين | أوقف المراجعة المسبقة | فعّل المراجعة المسبقة
- غيّر سعر التوثيق إلى <رقم>
- وثّق المستخدم @اسم | ألغِ توثيق @اسم | وافق على كل طلبات التوثيق | ارفض كل طلبات التوثيق
- امنع @اسم من البث | اسمح لـ @اسم بالبث
- وافق على كل أفلام المستخدمين المعلقة | ارفض كل أفلام المستخدمين المعلقة
- وافق على الدفعة <رقم الإيصال> | ارفض الدفعة <رقم الإيصال> | وافق على دفعات @اسم | وافق على كل الدفعات المعلقة
- احذف فيلم «الاسم»
- غيّر تصنيف فيلم «الاسم» إلى <قيمة> | غيّر عنوان فيلم «الاسم» إلى <قيمة> | غيّر سعر فيلم «الاسم» إلى <رقم> | غيّر وصف فيلم «الاسم» إلى <قيمة>
- ولّد وصفاً للأفلام الناقصة
أعد JSON فقط: مصفوفة نصوص. إن لم يطابق الطلب أي صيغة أعد [].`;
  async function canonicalize(q) {
    const k = llmCfg(); if (!k.enabled || !k.baseUrl || !k.model) return null;
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 12000);
    try {
      const r = await fetch(k.baseUrl.replace(/\/+$/, '') + '/chat/completions', { method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', ...(k.apiKey ? { authorization: 'Bearer ' + k.apiKey } : {}) },
        body: JSON.stringify({ model: k.model, temperature: 0, messages: [{ role: 'system', content: SYS }, { role: 'user', content: q }] }) });
      if (!r.ok) return null;
      const d = await r.json(); const txt = String((d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '');
      const m = txt.match(/\[[\s\S]*\]/); if (!m) return null;
      const arr = JSON.parse(m[0]); return Array.isArray(arr) ? arr.filter(x => typeof x === 'string').map(x => x.slice(0, 300)).slice(0, 12) : null;
    } catch { return null; } finally { clearTimeout(t); }
  }
  app.get('/api/admin/agent/llm', requireAdmin, (req, res) => { const k = llmCfg(); res.json({ enabled: !!k.enabled, baseUrl: k.baseUrl, model: k.model, hasKey: !!k.apiKey }); });
  app.put('/api/admin/agent/llm', sameOrigin, requireAdmin, (req, res) => {
    const b = req.body || {}, k = llmCfg();
    if ('baseUrl' in b) { const u = String(b.baseUrl || '').trim(); if (u && !/^https:\/\/[^\s]+$/i.test(u) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/[^\s]*)?$/i.test(u)) return res.status(400).json({ error: 'الرابط يجب أن يبدأ بـ https:// (أو http://localhost لنموذج محلي).' }); k.baseUrl = u.slice(0, 200); }
    if ('model' in b) k.model = String(b.model || '').trim().slice(0, 100);
    if (b.apiKey) k.apiKey = String(b.apiKey).trim().slice(0, 300); if (b.clearKey) k.apiKey = '';
    if ('enabled' in b) k.enabled = !!b.enabled;
    require('fs').writeFileSync(LLMF, JSON.stringify(k), { mode: 0o600 }); res.json({ enabled: !!k.enabled, baseUrl: k.baseUrl, model: k.model, hasKey: !!k.apiKey });
  });
  app.post('/api/admin/agent/llm/test', sameOrigin, requireAdmin, async (req, res) => { const r = await canonicalize('فعّل نشر المستخدمين'); res.json({ ok: Array.isArray(r) && r.length > 0, sample: r }); });

  app.get('/api/admin/agent/learned', requireAdmin, (req, res) => res.json({ items: macros() }));
  app.post('/api/admin/agent/learned', sameOrigin, requireAdmin, (req, res) => { const b = req.body || {}; const r = teach(b.phrase, Array.isArray(b.commands) ? b.commands.join(' ثم ') : String(b.commands || '')); res.status(r.learned ? 201 : 400).json(r.learned ? { ok: true, message: r.message } : { error: r.message }); });
  app.delete('/api/admin/agent/learned/:id', sameOrigin, requireAdmin, (req, res) => { saveMacros(macros().filter(x => x.id !== req.params.id)); res.json({ ok: true }); });
  app.post('/api/admin/agent/plan', sameOrigin, requireAdmin, async (req, res) => {
    const q = String((req.body && req.body.q) || '').slice(0, 600);
    let clauses = null, viaLLM = false;
    const local = parseAll(q); // القواعد أولاً (مجاناً وفورياً)
    if (!local.understood) { const c = await canonicalize(q); if (c && c.length) { clauses = c; viaLLM = true; } }
    const out = clauses ? parseAll(q, clauses) : local; if (viaLLM && out.understood) out.viaLLM = true;
    res.json(out);
  });

  /* ---- نقاط تنفيذ لا يغطيها شيء موجود: تعديل حقول أساسية + توليد وصف ---- */
  const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, n);
  app.post('/api/admin/agent/edit-movie', sameOrigin, requireAdmin, (req, res) => {
    const b = req.body || {}, list = getMovies(), m = list.find(x => x.id === b.id);
    if (!m) return res.status(404).json({ error: 'الفيلم غير موجود' });
    if ('title' in b) { const v = clean(b.title, 160); if (!v) return res.status(400).json({ error: 'عنوان فارغ.' }); m.title = v; }
    if ('category' in b) { const v = clean(b.category, 60); if (!v) return res.status(400).json({ error: 'تصنيف فارغ.' }); m.category = v; }
    if ('description' in b) m.description = clean(b.description, 4000);
    if ('price' in b) { const n = Number(b.price); if (!m.isPaid) return res.status(400).json({ error: 'هذا الفيلم مجاني — لا سعر له.' }); if (!(n > 0 && n <= 1e9)) return res.status(400).json({ error: 'سعر غير صالح.' }); m.price = n; }
    saveMovies(list); res.json({ ok: true, id: m.id });
  });
  const GEN = m => { const cat = m.category && m.category !== 'عام' ? `عمل ${m.category}ي` : 'عمل سينمائي', y = m.year ? ` (${m.year})` : '', d = m.director ? ` من إخراج ${m.director}` : '', cs = (m.cast || []).length ? ` بطولة ${m.cast.slice(0, 4).join('، ')}` : ''; return `${cat} بعنوان «${m.title}»${y}${d}${cs}. شاهده الآن على سينما أسامة.`.slice(0, 600); };
  app.post('/api/admin/agent/fill-description', sameOrigin, requireAdmin, (req, res) => {
    const list = getMovies(), m = list.find(x => x.id === (req.body || {}).id);
    if (!m) return res.status(404).json({ error: 'الفيلم غير موجود' });
    if (String(m.description || '').trim().length >= 30) return res.json({ ok: true, skipped: true });
    m.description = GEN(m); saveMovies(list); res.json({ ok: true });
  });
  /* ---------- سجل التراجع ---------- */
  const UF = F('agent-undo.json'), crypto = require('crypto');
  const OKU = /^\/api\/(admin\/|movies\/[\w-]+$)/;
  app.post('/api/admin/agent/done', sameOrigin, requireAdmin, (req, res) => {
    const b = req.body || {}; if (b.macroId) { const l = macros(), x = l.find(y => y.id === b.macroId); if (x) { x.uses = (x.uses || 0) + 1; saveMacros(l); } } try { recordEvent('agent', { title: clean(b.summary, 200), username: 'admin' }); } catch {}
    const und = (Array.isArray(b.undo) ? b.undo : []).filter(u => u && OKU.test(String(u.url)) && /^(POST|PUT|PATCH)$/.test(String(u.method))).slice(0, 80).map(u => ({ method: u.method, url: String(u.url), body: u.body }));
    if (und.length) { const l = readJSON(UF, []); l.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), summary: clean(b.summary, 200), steps: und.reverse() }); require('fs').writeFileSync(UF, JSON.stringify(l.slice(0, 30))); }
    res.json({ ok: true });
  });
  app.get('/api/admin/agent/undo', requireAdmin, (req, res) => res.json({ items: readJSON(UF, []).slice(0, 10) }));
  app.delete('/api/admin/agent/undo/:id', sameOrigin, requireAdmin, (req, res) => { const l = readJSON(UF, []).filter(x => x.id !== req.params.id); require('fs').writeFileSync(UF, JSON.stringify(l)); res.json({ ok: true }); });
};

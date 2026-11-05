/* ===================================================================
   الإصدار 16 — علامة التوثيق ✓ (طلب من المشترك + موافقة الإدارة، أو منح مباشر)
   =================================================================== */
const path = require('path');
const crypto = require('crypto');

module.exports = function registerV16(c) {
  const { app, ext, readJSON, writeJSONAtomic, getUser, requireUser, requireAdmin, sameOrigin, hit, tr, cleanBlock, getUsers, byUsername, DATA_DIR, getPayments, savePayments, autoVerifyReceipt, normalizeReceipt, recordEvent } = c;
  const F = n => path.join(DATA_DIR, n);
  const iso = () => new Date().toISOString();
  const V = () => readJSON(F('verified.json'), {});        // userId → {at, by}
  const R = () => readJSON(F('verify-requests.json'), []);  // طلبات
  const cfg = () => ({ requireSub: false, ...readJSON(F('settings16.json'), {}) });
  /* ---------- إعدادات الدفع عبر شام كاش (حساب افتراضي يُثبَّت على كل بطاقات الدفع + سعر التوثيق) ---------- */
  const DEFAULT_ACCOUNT = process.env.SHAMCASH_ACCOUNT || 'b4c2f0e644c420fbbfd60987af0251eb';
  const pay = () => ({ account: DEFAULT_ACCOUNT, verifyPrice: 0, verifyCurrency: 'SYP', ...readJSON(F('payment-settings.json'), {}) });
  ext.defaultAccount = () => pay().account;
  const prevExtras = ext.movieExtras;
  ext.movieExtras = m => { const out = prevExtras ? prevExtras(m) : {}; if (m.isPaid && !m.shamcashAccount) out.shamcashAccount = pay().account; return out; };
  app.get('/api/admin/payment-settings', requireAdmin, (req, res) => res.json(pay()));
  app.put('/api/admin/payment-settings', sameOrigin, requireAdmin, (req, res) => {
    const b = req.body || {}, cur = pay();
    if ('account' in b) { const a = String(b.account || '').trim().slice(0, 120); if (!a) return res.status(400).json({ error: 'أدخل حساب شام كاش.' }); cur.account = a; }
    if ('verifyPrice' in b) { const n = Number(b.verifyPrice); if (!(n >= 0 && n <= 1e9)) return res.status(400).json({ error: 'سعر غير صالح.' }); cur.verifyPrice = n; }
    if ('verifyCurrency' in b) cur.verifyCurrency = b.verifyCurrency === 'USD' ? 'USD' : 'SYP';
    writeJSONAtomic(F('payment-settings.json'), cur); res.json(cur);
  });
  const uname = id => (getUsers().find(u => u.id === id) || {}).username || '';
  ext.isVerified = uid => !!V()[uid];

  const state = u => {
    const reqs = R().filter(r => r.userId === u.id); const last = reqs[0] || null;
    const hasSub = !!(ext.hasSub && ext.hasSub(u)); const k = cfg();
    const P = pay(), payMode = P.verifyPrice > 0;
    const lastPay = (getPayments().find(p => p.userId === u.id && p.verify) || null);
    return { verified: !!V()[u.id], needSub: !payMode && k.requireSub, hasSub, eligible: payMode || !k.requireSub || hasSub,
      mode: payMode ? 'pay' : 'request', pay: payMode ? { price: P.verifyPrice, currency: P.verifyCurrency, account: P.account } : null,
      payment: lastPay ? { status: lastPay.status, createdAt: lastPay.createdAt } : null,
      request: last ? { status: last.status, createdAt: last.createdAt, note: last.note || '' } : null };
  };
  app.get('/api/user/verification', requireUser, (req, res) => res.json(state(req.user)));
  app.post('/api/user/verification/request', sameOrigin, requireUser, (req, res) => {
    if (hit(`verreq:${req.user.id}`, 5, 24 * 60 * 60 * 1000)) return res.status(429).json({ error: tr(req, 'too_many') });
    const s = state(req.user);
    if (s.verified) return res.status(400).json({ error: 'حسابك موثّق بالفعل.', code: 'already' });
    if (s.request && s.request.status === 'pending') return res.status(400).json({ error: 'لديك طلب قيد المراجعة.', code: 'pending' });
    if (s.mode === 'pay') return res.status(400).json({ error: 'التوثيق مدفوع: ادفع عبر شام كاش وأرسل رقم الإيصال.', code: 'pay_required' });
    if (!s.eligible) return res.status(403).json({ error: 'التوثيق متاح للمشتركين في إحدى الباقات فقط.', code: 'need_sub' });
    const list = R(); list.unshift({ id: crypto.randomUUID(), userId: req.user.id, note: cleanBlock((req.body || {}).note, 300), status: 'pending', createdAt: iso() });
    writeJSONAtomic(F('verify-requests.json'), list.slice(0, 1000)); res.status(201).json({ success: true });
  });

  /* ---------- دفع التوثيق عبر شام كاش ---------- */
  app.post('/api/user/verification/pay', sameOrigin, requireUser, async (req, res) => {
    const user = req.user, P = pay();
    if (!(P.verifyPrice > 0)) return res.status(400).json({ error: 'التوثيق غير مدفوع حالياً.' });
    if (hit(`verpay:${user.id}`, 8, 10 * 60 * 1000)) return res.status(429).json({ error: tr(req, 'too_many') });
    if (V()[user.id]) return res.status(400).json({ error: 'حسابك موثّق بالفعل.', code: 'already' });
    const receipt = normalizeReceipt((req.body || {}).receipt);
    if (!/^\d{6,14}$/.test(receipt)) return res.status(400).json({ error: 'رقم الإيصال يجب أن يتكوّن من أرقام فقط (من 6 إلى 14 رقماً).' });
    let list = getPayments();
    if (list.some(p => p.userId === user.id && p.verify && p.status === 'pending')) return res.status(202).json({ status: 'pending' });
    const dup = list.find(p => p.receipt === receipt); if (dup) return res.status(409).json({ error: 'رقم الإيصال هذا مستخدم من قبل.' });
    const auto = await autoVerifyReceipt(receipt, { price: P.verifyPrice, currency: P.verifyCurrency, shamcashAccount: P.account });
    if (auto.mode === 'auto' && !auto.paid) return res.status(402).json({ error: 'لم نعثر على عملية دفع بهذا الرقم. تأكد من الرقم والمبلغ والحساب.' });
    list = getPayments(); if (list.some(p => p.receipt === receipt)) return res.status(409).json({ error: 'رقم الإيصال هذا مستخدم من قبل.' });
    const status = auto.mode === 'auto' && auto.paid ? 'approved' : 'pending';
    const p = { id: crypto.randomUUID(), userId: user.id, username: user.username, movieId: '', movieTitle: 'توثيق الحساب ✓', receipt, amount: P.verifyPrice, currency: P.verifyCurrency,
      status, method: status === 'approved' ? 'auto' : 'manual', createdAt: iso(), decidedAt: status === 'approved' ? iso() : null, verify: true };
    list.unshift(p); savePayments(list);
    recordEvent(status === 'approved' ? 'payment_approved' : 'payment_submitted', { title: p.movieTitle, username: user.username });
    if (status === 'approved') decide(user.id, true, 'payment');
    res.status(status === 'approved' ? 200 : 202).json({ status });
  });
  // قرار الإدارة على دفعة توثيق (من قسم المدفوعات الحالي)
  const prevDecided = ext.onPaymentDecided;
  ext.onPaymentDecided = (p, status) => { if (p && p.verify) { decide(p.userId, status === 'approved', 'payment'); return; } if (prevDecided) prevDecided(p, status); };

  /* ---------- الإدارة ---------- */
  app.get('/api/admin/verification', requireAdmin, (req, res) => {
    const users = new Map(getUsers().map(u => [u.id, u]));
    const reqs = R().filter(r => r.status === 'pending').map(r => ({ id: r.id, username: (users.get(r.userId) || {}).username || '—', note: r.note, createdAt: r.createdAt, sub: !!(users.get(r.userId) && ext.hasSub && ext.hasSub(users.get(r.userId))) }));
    const verified = Object.entries(V()).map(([id, v]) => ({ username: (users.get(id) || {}).username || '—', at: v.at, by: v.by })).filter(x => x.username !== '—');
    res.json({ requireSub: cfg().requireSub, requests: reqs, verified });
  });
  app.put('/api/admin/verification/settings', sameOrigin, requireAdmin, (req, res) => { writeJSONAtomic(F('settings16.json'), { ...cfg(), requireSub: !!(req.body || {}).requireSub }); res.json({ success: true }); });
  const decide = (uid, ok, by) => {
    const v = V(); if (ok) v[uid] = { at: iso(), by }; else delete v[uid]; writeJSONAtomic(F('verified.json'), v);
    if (ext.notify && ok !== null) ext.notify(uid, ok ? 'verify_ok' : 'verify_no', { name: '' });
  };
  app.post('/api/admin/verification/:id/:action', sameOrigin, requireAdmin, (req, res) => {
    const list = R(); const r = list.find(x => x.id === req.params.id);
    if (!r || r.status !== 'pending') return res.status(404).json({ error: 'الطلب غير موجود' });
    const ok = req.params.action === 'approve'; if (!ok && req.params.action !== 'reject') return res.status(400).end();
    r.status = ok ? 'approved' : 'rejected'; r.decidedAt = iso(); writeJSONAtomic(F('verify-requests.json'), list);
    decide(r.userId, ok, 'admin'); res.json({ success: true });
  });
  // منح/سحب مباشر باسم المستخدم
  app.post('/api/admin/verification-user', sameOrigin, requireAdmin, (req, res) => {
    const u = byUsername(String((req.body || {}).username || '')); if (!u) return res.status(404).json({ error: 'المستخدم غير موجود' });
    const grant = (req.body || {}).verified !== false; decide(u.id, grant, 'admin'); res.json({ success: true });
  });
};

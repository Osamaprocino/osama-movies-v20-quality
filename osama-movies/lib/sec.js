/* lib/sec.js — v19: طبقة الأمان (إضافة فقط)
   ترويسات وCSP • كشف هجمات فوري • سجل مترابط بالتجزئة (مقاوم للتلاعب) • تنبيهات Telegram/بريد •
   حجب مؤقت آمن • قفل حساب الأدمن • مصادقة ثنائية TOTP • لوحة أمان للأدمن • فحص سلامة الملفات/البيانات.
   لا يلمس admin.json ولا بيانات المستخدمين. أسرار القنوات من متغيرات البيئة فقط. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let C = null; // سياق الخادم بعد init
const S = {
  cfg: null, blocks: {}, ring: [], alerts: [], lastHash: '0'.repeat(64), seq: 0,
  ipScore: new Map(), ipReq: new Map(), denied: new Map(), uploads: new Map(), loginFails: new Map(), userFails: new Map(),
  groups: new Map(), geo: new Map(), baseline: {}, started: Date.now(), globalReq: [], otpLast: 0
};
const SEV = { INFO: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
const DEFAULT_CFG = {
  enabled: true, minSeverity: 'MEDIUM', groupSec: 300, blockThreshold: 10, blockMinutes: 15, rps: 300,
  loginFail: 5, lockMinutes: 10, geo: true, allowIps: [], telegram: { on: false, chatId: '' }, email: { on: false, to: '' }
};
const now = () => Date.now();
const isoLocal = t => { const d = new Date(t); return d.toISOString() + ' (UTC)'; };

/* ---------- ملفات ---------- */
const F = n => path.join(C.DATA_DIR, n);
const readJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const writeJ = (f, v) => { const t = f + '.tmp' + process.pid; fs.writeFileSync(t, JSON.stringify(v, null, 1), { mode: 0o600 }); fs.renameSync(t, f); };
const EV = () => F('security-events.jsonl');

/* ---------- تنقية الأسرار ---------- */
function redact(s) {
  return String(s == null ? '' : s)
    .replace(/("?(?:password|pass|pwd|otp|token|secret|authorization|cookie|api[_-]?key|code)"?\s*[:=]\s*)("[^"]*"|[^&\s,}]+)/gi, '$1[REDACTED]')
    .replace(/\b[a-f0-9]{48,}\b/gi, '[REDACTED-TOKEN]')
    .replace(/Bearer\s+[\w.\-]+/gi, 'Bearer [REDACTED]')
    .replace(/(admin_session|user_session|session)=[^;\s]+/gi, '$1=[REDACTED]')
    .slice(0, 300);
}

/* ---------- سجل مترابط بالتجزئة ---------- */
function loadChain() {
  try {
    const f = EV(); if (!fs.existsSync(f)) return;
    const lines = fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean);
    if (lines.length) { const l = JSON.parse(lines[lines.length - 1]); S.lastHash = l.hash; S.seq = l.seq || lines.length; }
    S.ring = lines.slice(-500).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { /* سجل تالف: يُكتشف عبر verify */ }
}
function rotateIfBig() {
  try {
    const f = EV(); if (!fs.existsSync(f) || fs.statSync(f).size < 5 * 1024 * 1024) return;
    fs.renameSync(f, F(`security-events-${Date.now()}.jsonl`));
    const olds = fs.readdirSync(C.DATA_DIR).filter(x => /^security-events-\d+\.jsonl$/.test(x)).sort();
    while (olds.length > 6) fs.unlinkSync(F(olds.shift()));
  } catch { /* تجاهل */ }
}
function record(ev) {
  const e = { id: crypto.randomBytes(6).toString('hex'), seq: ++S.seq, ts: new Date().toISOString(), severity: 'INFO', action: 'detected', count: 1, ...ev };
  e.details = redact(e.details); e.url = redact(e.url); e.ua = redact(e.ua);
  if (e.ip && S.geo.has(e.ip)) e.geo = S.geo.get(e.ip);
  e.prev = S.lastHash; e.hash = crypto.createHash('sha256').update(e.prev + JSON.stringify({ ...e, hash: undefined })).digest('hex');
  S.lastHash = e.hash;
  try { rotateIfBig(); fs.appendFileSync(EV(), JSON.stringify(e) + '\n', { mode: 0o600 }); } catch { /* لا نكسر الطلب */ }
  S.ring.push(e); if (S.ring.length > 500) S.ring.shift();
  if (e.ip && S.cfg.geo && !S.geo.has(e.ip)) lookupGeo(e.ip).then(g => { e.geo = g; }).catch(() => {});
  if (SEV[e.severity] >= 2 && e.type !== 'admin_action') maybeAlert(e);
  scoreIp(e);
  return e;
}

/* ---------- الجغرافيا التقريبية (اختيارية) ---------- */
const PRIV = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1|fc|fd|fe80|::ffff:127\.)/i;
async function lookupGeo(ip) {
  if (S.geo.has(ip)) return S.geo.get(ip);
  let g = { note: 'تقريبي — لا يكشف هوية المهاجم' };
  if (!ip || PRIV.test(ip) || ip === 'unknown') g = { ...g, label: 'شبكة محلية/خاصة' };
  else if (S.cfg.geo && process.env.SEC_GEO !== 'off') {
    try {
      const url = (process.env.SEC_GEO_URL || 'http://ip-api.com/json/{ip}?fields=status,country,regionName,city,isp,org,as').replace('{ip}', encodeURIComponent(ip));
      const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 2500);
      const r = await fetch(url, { signal: ac.signal }); clearTimeout(t); const j = await r.json();
      if (j && j.status === 'success') g = { ...g, country: j.country, region: j.regionName, city: j.city, isp: j.isp, org: j.org, asn: j.as };
    } catch { /* بلا بيانات — لا نخترع */ }
  }
  S.geo.set(ip, g); if (S.geo.size > 2000) S.geo.delete(S.geo.keys().next().value);
  return g;
}

/* ---------- التنبيهات ---------- */
const ADVICE = {
  login_bruteforce: 'غيّر كلمة المرور وفعّل المصادقة الثنائية وراجع الحجب المؤقت.',
  admin_lockout: 'تحقق من أنك لست المحاول؛ فعّل 2FA وغيّر كلمة المرور فوراً.',
  login_after_fails: 'احتمال اختراق: أنهِ كل الجلسات من لوحة الأمان وغيّر كلمة المرور فوراً.',
  sqli: 'لا إجراء عاجل — الطلب حُجب. راجع المصدر وفكّر بحجبه.', nosqli: 'الطلب حُجب. راجع المصدر.',
  xss: 'تأكد أن المحتوى يُهرَّب عند العرض (مفعّل في الموقع). راجع المصدر.', csrf: 'حُجب طلب كتابة من موقع آخر؛ لا إجراء إن تكرر فاحجب المصدر.', traversal: 'الطلب حُجب. تأكد أن المجلدات الخاصة غير مكشوفة.',
  ssrf: 'الطلب حُجب. لا تسمح بجلب روابط داخلية.', cmdi: 'الطلب حُجب. راجع المصدر فوراً.', proto_pollution: 'الطلب حُجب.',
  scanner: 'أداة فحص آلي. الحجب التلقائي يعمل عند التكرار.', probe: 'محاولة الوصول لملفات حسّاسة. تأكد من الإعدادات.',
  traffic_spike: 'تحقق من الحمل؛ فعّل حماية Cloudflare إن استمر.', repeated_denied: 'محاولات وصول مرفوضة متكررة؛ راجع المصدر.',
  session_hijack: 'أُنهيت الجلسة تلقائياً. غيّر كلمة المرور وراجع الأجهزة.', file_changed: 'تغيّر ملف حسّاس أثناء التشغيل! إن لم تكن أنت فاعزل الخادم وأعد النشر من نسخة نظيفة.',
  db_integrity: 'ملف بيانات تالف؛ استرجع من آخر نسخة احتياطية سليمة.', log_tamper: 'سجل الأمان يبدو معدَّلاً؛ تعامل مع الخادم كمخترَق محتمل.',
  abnormal_upload: 'نشاط رفع غير معتاد؛ راجع الملفات المرفوعة وحساب المصدر.', ip_blocked: 'حُجب مصدر مؤقتاً؛ يمكنك رفع الحجب من اللوحة.',
  admin_password: 'إن لم تكن أنت من غيّرها فاعتبر الحساب مخترقاً.', twofa_changed: 'إن لم تكن أنت فاعتبر الحساب مخترقاً.', test: 'هذا تنبيه تجريبي.'
};
const sevIcon = { CRITICAL: '🚨', HIGH: '🔴', MEDIUM: '🟠', LOW: '🟡', INFO: 'ℹ️' };
function alertText(e, geo, extra) {
  const g = geo && (geo.country || geo.label) ? [geo.label, geo.country, geo.region, geo.city].filter(Boolean).join('، ') + (geo.isp ? ` — ${geo.isp}` : '') + (geo.asn ? ` (${geo.asn})` : '') + ' [تقريبي]' : 'غير متاح';
  return [
    `${sevIcon[e.severity] || ''} تنبيه أمني — سينما أسامة`,
    `النوع: ${e.type}   الخطورة: ${e.severity}`,
    `الحالة: ${e.action === 'blocked' ? 'تم الحجب ✅' : e.action === 'success' ? 'نجح ⚠️' : e.action === 'detected' ? 'رُصد (لم يُحجب)' : e.action}`,
    `IP: ${e.ip || '—'}`, `الموقع/الشبكة: ${g}`,
    `الهدف: ${e.method || ''} ${e.url || ''}`.trim(),
    e.user ? `الحساب المستهدف: ${e.user}` : null,
    `الوقت: ${isoLocal(Date.parse(e.ts))}`,
    `القاعدة: ${e.rule || e.type}   المرجع: #${e.seq}/${e.id}`,
    `التكرار: ${extra && extra.count ? extra.count : e.count} محاولة`,
    e.ua ? `المتصفح/الجهاز: ${e.ua}` : null,
    e.details ? `التفاصيل: ${e.details}` : null,
    `الإجراء الموصى به: ${ADVICE[e.type] || 'راجع لوحة الأمان.'}`
  ].filter(Boolean).join('\n');
}
function maybeAlert(e) {
  const cfg = S.cfg; if (!cfg.enabled) return;
  if (SEV[e.severity] < SEV[cfg.minSeverity] && e.severity !== 'CRITICAL') return;
  const key = e.type + '|' + (e.ip || '');
  if (e.severity !== 'CRITICAL') {
    const g = S.groups.get(key);
    if (g && now() - g.t0 < cfg.groupSec * 1000) { g.n++; g.last = e; return; }
    S.groups.set(key, { t0: now(), n: 1, last: e });
    setTimeout(() => { const gg = S.groups.get(key); if (gg && gg.n > 1) dispatch({ ...gg.last, count: gg.n }, `ملخّص: ${gg.n} محاولات من نفس المصدر خلال ${cfg.groupSec} ثانية`); S.groups.delete(key); }, cfg.groupSec * 1000).unref();
  }
  dispatch(e);
}
async function dispatch(e, note) {
  const geo = await lookupGeo(e.ip).catch(() => null);
  const text = alertText(e, geo, { count: e.count }) + (note ? `\n${note}` : '');
  const chans = [];
  if (S.cfg.telegram.on && S.cfg.telegram.chatId) chans.push('telegram');
  if (S.cfg.email.on && S.cfg.email.to) chans.push('email');
  if (!chans.length) { logDelivery(e, 'dashboard', true, 'لوحة الأمان فقط', 1); return; }
  for (const ch of chans) sendWithRetry(e, ch, text, 1);
}
const DELAYS = [0, 2000, 10000, 60000];
function sendWithRetry(e, ch, text, attempt) {
  const go = async () => {
    try {
      if (ch === 'telegram') await sendTelegram(text); else await sendEmail(e, text);
      logDelivery(e, ch, true, '', attempt);
    } catch (err) {
      logDelivery(e, ch, false, String(err.message || err).replace(/\d{6,}:[\w-]{20,}/g, '[token]').slice(0, 160), attempt);
      if (attempt < 3) sendWithRetry(e, ch, text, attempt + 1);
    }
  };
  if (DELAYS[attempt - 1]) setTimeout(go, DELAYS[attempt - 1]).unref(); else go();
}
function logDelivery(e, channel, ok, error, attempts) {
  S.alerts.push({ ts: new Date().toISOString(), eventId: e.id, seq: e.seq, type: e.type, severity: e.severity, channel, ok, error, attempts });
  if (S.alerts.length > 300) S.alerts.shift();
  try { writeJ(F('security-alerts.json'), S.alerts.slice(-200)); } catch { /* تجاهل */ }
}
async function sendTelegram(text) {
  const tok = process.env.SEC_TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  if (!tok) throw new Error('لا يوجد توكن بوت في متغيرات البيئة');
  const base = process.env.SEC_TG_URL || 'https://api.telegram.org';
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 8000);
  try {
    const r = await fetch(`${base}/bot${tok}/sendMessage`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: S.cfg.telegram.chatId, text: text.slice(0, 3900), disable_web_page_preview: true }), signal: ac.signal });
    if (!r.ok) throw new Error('Telegram HTTP ' + r.status);
  } finally { clearTimeout(t); }
}
async function sendEmail(e, text) {
  const mailer = C.mailer; if (!mailer || !mailer.configured()) throw new Error('SMTP غير مهيأ');
  await mailer.sendMail({ to: S.cfg.email.to, subject: `[${e.severity}] تنبيه أمني — ${e.type} — سينما أسامة`, text });
}

/* ---------- الحجب والتقييم ---------- */
const WEIGHT = { INFO: 0, LOW: .5, MEDIUM: 1, HIGH: 3, CRITICAL: 6 };
const isLoop = ip => !ip || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
function blocked(ip) {
  const b = S.blocks[ip]; if (!b) return false;
  if (b.until < now()) { delete S.blocks[ip]; persistBlocks(); return false; }
  return true;
}
const persistBlocks = () => { try { writeJ(F('security-blocks.json'), S.blocks); } catch { /* تجاهل */ } };
function blockIp(ip, minutes, reason, manual) {
  if (isLoop(ip) || (S.cfg.allowIps || []).includes(ip)) return false;
  const prev = S.blocks[ip]; const level = prev ? Math.min(prev.level + 1, 6) : 1;
  const mins = manual ? minutes : Math.min(minutes * Math.pow(2, level - 1), 1440);
  S.blocks[ip] = { until: now() + mins * 60000, level, reason, since: new Date().toISOString(), manual: !!manual };
  persistBlocks(); return mins;
}
function scoreIp(e) {
  if (!e.ip || isLoop(e.ip) || (S.cfg.allowIps || []).includes(e.ip) || e.type === 'ip_blocked' || e.type === 'admin_action') return;
  const w = WEIGHT[e.severity] || 0; if (!w) return;
  let x = S.ipScore.get(e.ip); if (!x || x.reset < now()) x = { s: 0, reset: now() + 10 * 60000 };
  x.s += w; S.ipScore.set(e.ip, x);
  if (x.s >= S.cfg.blockThreshold && !blocked(e.ip)) {
    const m = blockIp(e.ip, S.cfg.blockMinutes, 'تجاوز حد النقاط الأمنية');
    if (m) { x.s = 0; record({ type: 'ip_blocked', severity: 'HIGH', action: 'blocked', ip: e.ip, rule: 'auto-block', details: `حجب مؤقت ${m} دقيقة بعد تكرار نشاط مشبوه` }); }
  }
}

/* ---------- قواعد الكشف ---------- */
const RULES = [
  ['sqli', 'HIGH', /(\bunion\b[\s\S]{0,30}\bselect\b|\bor\b\s+\d+\s*=\s*\d+|'\s*or\s*'[^']*'\s*=\s*'|;\s*drop\s+table|\bsleep\s*\(\s*\d|information_schema|\bxp_cmdshell\b|\bbenchmark\s*\(|\bwaitfor\s+delay\b)/i, true],
  ['xss', 'MEDIUM', /(<\s*script\b|javascript\s*:|\bon(?:error|load|click|mouseover)\s*=|<\s*svg[^>]*\bon\w+\s*=|<\s*iframe\b)/i, false],
  ['traversal', 'HIGH', /(\.\.[\/\\]|%2e%2e(?:%2f|%5c|\/|\\)|%252e%252e|\.\.%2f|\.\.%5c)/i, true],
  ['cmdi', 'HIGH', /(?:[;|&`]|\$\()\s*(?:cat|ls|wget|curl|bash|sh|nc|ncat|powershell|cmd(?:\.exe)?|python|perl)\b\s/i, true],
  ['ssrf', 'HIGH', /(?:https?|file|gopher|ftp):\/\/(?:localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|169\.254\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|metadata\.google\.internal)|file:\/\/\//i, true]
];
const PROBE = /^\/(?:\.env|\.git|wp-login\.php|wp-admin|phpmyadmin|xmlrpc\.php|etc\/passwd|admin\.json|server\.js|package\.json|data\/|backups\/|cgi-bin|\.aws|\.ssh|vendor\/phpunit)/i;
const SCANNER = /(sqlmap|nikto|nmap|masscan|acunetix|dirbuster|gobuster|wpscan|nuclei|havij|zgrab|burp)/i;
function walk(o, f, depth = 0) {
  if (depth > 6 || o == null) return;
  if (typeof o === 'string') return f(null, o);
  if (typeof o !== 'object') return;
  for (const k of Object.keys(o).slice(0, 60)) { f(k, null); walk(o[k], f, depth + 1); }
}
function inspect(req) {
  const found = [];
  let url = req.originalUrl || req.url || ''; let dec = url;
  try { dec = decodeURIComponent(url); } catch { /* يبقى كما هو */ }
  const ua = String(req.headers['user-agent'] || '');
  if (SCANNER.test(ua)) found.push({ type: 'scanner', sev: 'MEDIUM', block: false, rule: 'scanner-ua', sample: ua });
  if (PROBE.test(dec.split('?')[0])) found.push({ type: 'probe', sev: 'MEDIUM', block: false, rule: 'sensitive-path', sample: dec.split('?')[0] });
  const strs = [dec];
  const bodies = [req.body, req.query];
  for (const b of bodies) walk(b, (k, s) => {
    if (k != null) {
      if (/^\$[a-z]+$/i.test(k)) found.push({ type: 'nosqli', sev: 'HIGH', block: true, rule: 'nosql-operator', sample: k });
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') found.push({ type: 'proto_pollution', sev: 'HIGH', block: true, rule: 'proto-key', sample: k });
    } else strs.push(s.slice(0, 2000));
  });
  const text = strs.join('\n').slice(0, 8000);
  for (const [type, sev, rx, blk] of RULES) { const m = text.match(rx); if (m && type === 'ssrf' && process.env.PUSH_ALLOW_ANY === '1' && /^\/api\/push\/subscribe/.test(dec)) continue; /* بيئة اختبار فقط */ if (m) found.push({ type, sev, block: blk, rule: 'rx-' + type, sample: m[0] }); }
  return found;
}

/* ---------- Middleware ---------- */
function early(app) {
  const tp = process.env.TRUST_PROXY;
  app.set('trust proxy', tp === 'true' ? true : tp === 'false' ? false : (tp && /^\d+$/.test(tp) ? Number(tp) : (tp || 'loopback')));
  app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    const mode = process.env.SEC_CSP || 'enforce';
    if (mode !== 'off') {
      const csp = ["default-src 'self'", "script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://accounts.google.com https://telegram.org https://www.youtube.com https://s.ytimg.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com", "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https:", "media-src 'self' blob: https:", "connect-src 'self' https:", "worker-src 'self' blob:",
        "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://accounts.google.com https://oauth.telegram.org",
        "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'self'", 'report-uri /api/csp-report'].join('; ');
      res.setHeader(mode === 'report' ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy', csp);
    }
    if ((req.secure || req.headers['x-forwarded-proto'] === 'https') && process.env.HSTS === '1') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
}

function init(ctx) {
  C = ctx;
  S.cfg = { ...DEFAULT_CFG, ...readJ(F('security-config.json'), {}) };
  S.cfg.telegram = { ...DEFAULT_CFG.telegram, ...(S.cfg.telegram || {}) }; S.cfg.email = { ...DEFAULT_CFG.email, ...(S.cfg.email || {}) };
  S.blocks = readJ(F('security-blocks.json'), {}); S.alerts = readJ(F('security-alerts.json'), []);
  loadChain();
  /* ضمان السلامة من تعديل السجل أثناء التشغيل */
  C.app.use((req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    req.secIp = ip;
    if (!S.cfg.enabled) return next();
    if (blocked(ip) && !(S.cfg.allowIps || []).includes(ip)) {
      res.setHeader('Retry-After', String(Math.ceil((S.blocks[ip].until - now()) / 1000)));
      return res.status(403).json({ error: 'تم حجب هذا العنوان مؤقتاً لأسباب أمنية.' });
    }
    /* CSRF شامل: أي طلب يغيّر الحالة من أصل/موقع مختلف يُرفض (يكمل SameSite=Lax وفحص sameOrigin) */
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS' && /^\/api\//.test(req.originalUrl || '') && !/^\/api\/csp-report/.test(req.originalUrl)) {
      const org = req.headers.origin, sfs = req.headers['sec-fetch-site']; let bad = sfs === 'cross-site';
      if (org && org !== 'null') { try { const oh = new URL(org).host; if (oh !== req.headers.host && oh !== req.headers['x-forwarded-host']) bad = true; } catch { bad = true; } } else if (org === 'null') bad = true;
      if (bad) { record({ type: 'csrf', severity: 'MEDIUM', action: 'blocked', ip, method: req.method, url: req.originalUrl, ua: req.headers['user-agent'], rule: 'cross-origin-write', details: 'Origin=' + String(org || '').slice(0, 80) + ' Sec-Fetch-Site=' + (sfs || '') }); return res.status(403).json({ error: 'طلب من أصل غير مسموح.' }); }
    }
    /* عدّاد الطلبات: حماية DoS بسيطة */
    const t = now(); let r = S.ipReq.get(ip); if (!r || r.reset < t) r = { n: 0, reset: t + 10000, warned: false };
    r.n++; S.ipReq.set(ip, r);
    if (!isLoop(ip) && r.n > S.cfg.rps) {
      if (!r.warned) { r.warned = true; record({ type: 'traffic_spike', severity: 'HIGH', action: 'blocked', ip, method: req.method, url: req.originalUrl, ua: req.headers['user-agent'], rule: 'rps', details: `>${S.cfg.rps} طلب/10ث` }); }
      res.setHeader('Retry-After', '10'); return res.status(429).json({ error: 'طلبات كثيرة جداً.' });
    }
    S.globalReq.push(t); if (S.globalReq.length > 5000) S.globalReq.splice(0, 2500);
    /* كشف الهجمات (يتجاوز الأدمن المسجَّل لتقليل الإنذارات الكاذبة) */
    let admin = null; try { admin = C.getSession && C.getSession(req); } catch { /* تجاهل */ }
    if (!admin) {
      const hits = inspect(req);
      let block = false;
      for (const h of hits) {
        record({ type: h.type, severity: h.sev, action: h.block ? 'blocked' : 'detected', ip, method: req.method, url: req.originalUrl, ua: req.headers['user-agent'], rule: h.rule, details: h.sample });
        if (h.block) block = true;
      }
      if (block) return res.status(403).json({ error: 'طلب مرفوض.' });
    }
    /* تدقيق وتتبّع حالات الرفض والرفع */
    res.on('finish', () => {
      try {
        const sc = res.statusCode, u = req.originalUrl || '';
        if ((sc === 401 || sc === 403) && !/^\/api\/(auth\/status|user\/me)/.test(u) && !isLoop(ip)) {
          let d = S.denied.get(ip); if (!d || d.reset < now()) d = { n: 0, reset: now() + 5 * 60000 }; d.n++; S.denied.set(ip, d);
          if (d.n === 15) record({ type: 'repeated_denied', severity: 'MEDIUM', action: 'detected', ip, method: req.method, url: u, ua: req.headers['user-agent'], rule: 'denied>=15/5m', details: 'رفض صلاحيات متكرر' });
        }
        if (req.method === 'POST' && /multipart\/form-data/.test(req.headers['content-type'] || '')) {
          let x = S.uploads.get(ip); if (!x || x.reset < now()) x = { ok: 0, bad: 0, reset: now() + 10 * 60000 }; if (sc >= 400) x.bad++; else x.ok++; S.uploads.set(ip, x);
          if (x.bad === 5 || x.ok === 25) record({ type: 'abnormal_upload', severity: 'MEDIUM', action: 'detected', ip, method: req.method, url: u, ua: req.headers['user-agent'], rule: x.bad === 5 ? 'upload-rejects' : 'upload-burst', details: `ناجح ${x.ok} / مرفوض ${x.bad} خلال 10 دقائق` });
        }
        if (req.method !== 'GET' && req.method !== 'HEAD' && /^\/api\/admin\//.test(u) && sc < 400)
          record({ type: 'admin_action', severity: /\/(password|security\/2fa)/.test(u) ? 'HIGH' : 'INFO', action: 'success', ip, method: req.method, url: u.split('?')[0], ua: req.headers['user-agent'], user: admin && admin.username, rule: 'audit', details: '' });
      } catch { /* لا نكسر الاستجابة */ }
    });
    next();
  });
  /* مراقبة سلامة الملفات والبيانات */
  baseline(); setInterval(integrityTick, 5 * 60000).unref();
  setInterval(() => { const t = now(); for (const m of [S.ipReq, S.denied, S.uploads, S.ipScore, S.loginFails]) for (const [k, v] of m) if ((v.reset || v.until || 0) < t) m.delete(k); }, 60000).unref();
}
function critFiles() {
  const out = [path.join(C.ROOT, 'server.js'), C.ADMIN_FILE];
  try { for (const f of fs.readdirSync(path.join(C.ROOT, 'lib'))) if (f.endsWith('.js')) out.push(path.join(C.ROOT, 'lib', f)); } catch { /* تجاهل */ }
  return out;
}
const hashFile = f => { try { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); } catch { return null; } };
function baseline() { S.baseline = {}; for (const f of critFiles()) S.baseline[f] = hashFile(f); }
function verifyChain() {
  const f = EV(); if (!fs.existsSync(f)) return { ok: true, lines: 0 };
  const lines = fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean); let prev = null;
  for (let i = 0; i < lines.length; i++) {
    let e; try { e = JSON.parse(lines[i]); } catch { return { ok: false, at: i + 1, why: 'سطر تالف' }; }
    if (prev !== null && e.prev !== prev) return { ok: false, at: i + 1, why: 'انقطاع السلسلة' };
    const h = crypto.createHash('sha256').update(e.prev + JSON.stringify({ ...e, hash: undefined })).digest('hex');
    if (h !== e.hash) return { ok: false, at: i + 1, why: 'تجزئة لا تطابق (تعديل)' };
    prev = e.hash;
  }
  return { ok: true, lines: lines.length };
}
function dbCheck() {
  const bad = [];
  try { for (const f of fs.readdirSync(C.DATA_DIR)) if (f.endsWith('.json')) { try { JSON.parse(fs.readFileSync(F(f), 'utf8') || 'null'); } catch { bad.push(f); } } } catch { /* تجاهل */ }
  return bad;
}
function integrityTick() {
  for (const f of critFiles()) {
    const h = hashFile(f);
    if (S.baseline[f] !== undefined && S.baseline[f] !== h) {
      record({ type: 'file_changed', severity: 'CRITICAL', action: 'detected', rule: 'file-hash', details: path.relative(C.ROOT, f) });
      S.baseline[f] = h;
    }
  }
  const v = verifyChain(); if (!v.ok && !S.tamperWarned) { S.tamperWarned = true; record({ type: 'log_tamper', severity: 'CRITICAL', action: 'detected', rule: 'chain', details: `السطر ${v.at}: ${v.why}` }); }
  const bad = dbCheck(); if (bad.length) { const k = bad.join(','); if (S.dbWarned !== k) { S.dbWarned = k; record({ type: 'db_integrity', severity: 'HIGH', action: 'detected', rule: 'json-parse', details: k }); } }
}

/* ---------- تسجيل الدخول: قفل + 2FA ---------- */
function loginGate(req, username) {
  const ip = req.secIp || req.ip; const u = String(username || '').slice(0, 60).toLowerCase();
  const l = S.userFails.get(u); if (l && l.lockedUntil > now()) return Math.ceil((l.lockedUntil - now()) / 1000);
  return 0;
}
function loginFail(req, username, how) {
  const ip = req.secIp || req.ip; const u = String(username || '').slice(0, 60).toLowerCase();
  let f = S.loginFails.get(ip); if (!f || f.reset < now()) f = { n: 0, reset: now() + 15 * 60000 }; f.n++; S.loginFails.set(ip, f);
  let l = S.userFails.get(u); if (!l || l.reset < now()) l = { n: 0, reset: now() + 15 * 60000, lockedUntil: 0 }; l.n++; S.userFails.set(u, l);
  const admin = C.adminName && C.adminName() === username;
  record({ type: admin ? 'login_bruteforce' : 'login_fail', severity: f.n >= S.cfg.loginFail ? 'HIGH' : 'LOW', action: 'blocked', ip, method: 'POST', url: '/api/auth/login', ua: req.headers['user-agent'], user: String(username || '').slice(0, 40), rule: how === 'otp' ? 'bad-otp' : 'bad-password', details: `محاولة فاشلة #${f.n}` });
  if (f.n === S.cfg.loginFail) record({ type: 'login_bruteforce', severity: 'HIGH', action: 'detected', ip, method: 'POST', url: '/api/auth/login', ua: req.headers['user-agent'], user: String(username || '').slice(0, 40), rule: `fails>=${S.cfg.loginFail}`, details: `${f.n} محاولات فاشلة متتالية` });
  if (admin && l.n >= 10 && l.lockedUntil < now()) {
    l.lockedUntil = now() + S.cfg.lockMinutes * 60000; l.n = 0;
    record({ type: 'admin_lockout', severity: 'CRITICAL', action: 'blocked', ip, method: 'POST', url: '/api/auth/login', user: String(username).slice(0, 40), rule: 'user-lock', details: `قُفل الدخول للأدمن ${S.cfg.lockMinutes} دقيقة بعد 10 محاولات فاشلة من مصادر مختلفة` });
  }
}
function loginOk(req, username) {
  const ip = req.secIp || req.ip; const f = S.loginFails.get(ip); S.userFails.delete(String(username || '').toLowerCase());
  const after = f && f.n >= S.cfg.loginFail;
  S.loginFails.delete(ip);
  record({ type: after ? 'login_after_fails' : 'admin_login', severity: after ? 'CRITICAL' : 'INFO', action: 'success', ip, method: 'POST', url: '/api/auth/login', ua: req.headers['user-agent'], user: String(username).slice(0, 40), rule: after ? 'success-after-fails' : 'login', details: after ? `نجح الدخول بعد ${f.n} محاولات فاشلة من نفس المصدر` : '' });
}

/* ---------- TOTP ---------- */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32enc = b => { let bits = '', out = ''; for (const x of b) bits += x.toString(2).padStart(8, '0'); for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]; return out; };
const b32dec = s => { let bits = ''; for (const c of s.replace(/=+$/, '').toUpperCase()) { const v = B32.indexOf(c); if (v < 0) continue; bits += v.toString(2).padStart(5, '0'); } const o = []; for (let i = 0; i + 8 <= bits.length; i += 8) o.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(o); };
function totp(secret, step) { const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(step)); const h = crypto.createHmac('sha1', b32dec(secret)).update(c).digest(); const o = h[19] & 15; return String(((h[o] & 127) << 24 | h[o + 1] << 16 | h[o + 2] << 8 | h[o + 3]) % 1e6).padStart(6, '0'); }
function totpCheck(secret, code) { const st = Math.floor(now() / 30000); code = String(code || '').replace(/\s/g, ''); if (!/^\d{6}$/.test(code)) return 0; for (const d of [0, -1, 1]) if (totp(secret, st + d) === code && st + d > S.otpLast) { S.otpLast = st + d; return st + d; } return 0; }
function seckey() {
  if (process.env.SEC_KEY && process.env.SEC_KEY.length >= 16) return crypto.createHash('sha256').update(process.env.SEC_KEY).digest();
  const f = F('.seckey'); try { return Buffer.from(fs.readFileSync(f, 'utf8'), 'hex'); } catch { const k = crypto.randomBytes(32); fs.writeFileSync(f, k.toString('hex'), { mode: 0o600 }); return k; }
}
const enc = t => { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', seckey(), iv); const ct = Buffer.concat([c.update(t, 'utf8'), c.final()]); return { iv: iv.toString('hex'), tag: c.getAuthTag().toString('hex'), ct: ct.toString('hex') }; };
const dec = o => { const d = crypto.createDecipheriv('aes-256-gcm', seckey(), Buffer.from(o.iv, 'hex')); d.setAuthTag(Buffer.from(o.tag, 'hex')); return Buffer.concat([d.update(Buffer.from(o.ct, 'hex')), d.final()]).toString('utf8'); };
const tf = () => readJ(F('admin-2fa.json'), null);
const hashRec = c => crypto.createHash('sha256').update(String(c).replace(/[\s-]/g, '').toLowerCase()).digest('hex');
/* نتيجة: 'off' | 'required' | 'ok' | 'bad' */
function checkOtp(code) {
  const t = tf(); if (!t || !t.enabled) return 'off';
  if (code == null || code === '') return 'required';
  let secret; try { secret = dec(t.enc); } catch { return 'bad'; }
  if (totpCheck(secret, code)) return 'ok';
  const h = hashRec(code); const i = (t.recovery || []).indexOf(h);
  if (i >= 0) { t.recovery.splice(i, 1); writeJ(F('admin-2fa.json'), t); record({ type: 'twofa_changed', severity: 'HIGH', action: 'success', rule: 'recovery-code-used', details: `استُخدم رمز استرجاع، المتبقي ${t.recovery.length}` }); return 'ok'; }
  return 'bad';
}

/* ---------- المسارات ---------- */
function routes(ctx) {
  const { app, requireAdmin, sameOrigin, sessions } = ctx; C = { ...C, ...ctx };
  const A = [requireAdmin];
  const W = [sameOrigin, requireAdmin];
  const clampN = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(b, Math.max(a, Math.round(v))) : d; };
  app.post('/api/csp-report', (req, res) => {
    const ip = req.secIp || req.ip; const x = S.ipReq.get('csp' + ip) || { n: 0, reset: now() + 600000 }; x.n++; S.ipReq.set('csp' + ip, x);
    if (x.n <= 3) { const r = (req.body && (req.body['csp-report'] || req.body)) || {}; record({ type: 'csp_violation', severity: 'LOW', action: 'detected', ip, rule: 'csp', url: r['document-uri'], details: `${r['violated-directive'] || ''} ${r['blocked-uri'] || ''}` }); }
    res.status(204).end();
  });
  app.get('/api/admin/security/events', ...A, (req, res) => {
    const lim = clampN(req.query.limit, 1, 500, 100); const q = String(req.query.q || '').toLowerCase().slice(0, 80); const sev = String(req.query.severity || ''); const type = String(req.query.type || '');
    let list = S.ring.filter(e => (req.query.audit === '1' || e.type !== 'admin_action' || type === 'admin_action'));
    if (sev && SEV[sev] !== undefined) list = list.filter(e => e.severity === sev);
    if (type) list = list.filter(e => e.type === type);
    if (q) list = list.filter(e => JSON.stringify(e).toLowerCase().includes(q));
    res.json({ total: list.length, items: list.slice(-lim).reverse().map(e => ({ ...e, geo: e.geo || S.geo.get(e.ip) })) });
  });
  app.get('/api/admin/security/stats', ...A, (req, res) => {
    const day = now() - 864e5, by = {}, sv = {}, ips = {}, hours = new Array(24).fill(0); let blockedN = 0, succ = 0;
    for (const e of S.ring) { const t = Date.parse(e.ts); if (t < day || e.type === 'admin_action') continue; by[e.type] = (by[e.type] || 0) + 1; sv[e.severity] = (sv[e.severity] || 0) + 1; if (e.ip) ips[e.ip] = (ips[e.ip] || 0) + 1; hours[Math.min(23, Math.floor((now() - t) / 36e5))]++; if (e.action === 'blocked') blockedN++; if (e.action === 'success' && SEV[e.severity] >= 3) succ++; }
    const top = Object.entries(ips).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([ip, n]) => ({ ip, n, geo: S.geo.get(ip) || null }));
    const rps = S.globalReq.filter(t => t > now() - 10000).length / 10;
    res.json({ last24h: { byType: by, bySeverity: sv, blocked: blockedN, successHigh: succ, hoursAgo: hours }, topIps: top, blocks: Object.keys(S.blocks).filter(blocked).length, rps, uptimeSec: Math.floor((now() - S.started) / 1000), twofa: !!(tf() && tf().enabled), chain: verifyChain().ok, events: S.seq });
  });
  app.get('/api/admin/security/config', ...A, (req, res) => res.json({ ...S.cfg, tokenConfigured: !!(process.env.SEC_TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN), smtpConfigured: !!(C.mailer && C.mailer.configured()) }));
  app.put('/api/admin/security/config', ...W, (req, res) => {
    const b = req.body || {}; const n = { ...S.cfg };
    if (typeof b.enabled === 'boolean') n.enabled = b.enabled;
    if (SEV[b.minSeverity] !== undefined && b.minSeverity !== 'INFO') n.minSeverity = b.minSeverity;
    n.groupSec = clampN(b.groupSec, 10, 3600, n.groupSec); n.blockThreshold = clampN(b.blockThreshold, 3, 100, n.blockThreshold); n.blockMinutes = clampN(b.blockMinutes, 1, 1440, n.blockMinutes);
    n.rps = clampN(b.rps, 30, 5000, n.rps); n.loginFail = clampN(b.loginFail, 3, 30, n.loginFail); n.lockMinutes = clampN(b.lockMinutes, 1, 240, n.lockMinutes);
    if (typeof b.geo === 'boolean') n.geo = b.geo;
    if (Array.isArray(b.allowIps)) n.allowIps = b.allowIps.filter(x => typeof x === 'string' && /^[0-9a-fA-F:.]{3,45}$/.test(x)).slice(0, 30);
    if (b.telegram) { const c = String(b.telegram.chatId || '').trim(); if (c && !/^-?\d{3,20}$/.test(c)) return res.status(400).json({ error: 'معرّف المحادثة (Chat ID) يجب أن يكون رقماً.' }); n.telegram = { on: !!b.telegram.on && !!c, chatId: c }; }
    if (b.email) { const e = String(b.email.to || '').trim(); if (e && !/^[^\s@]{1,64}@[^\s@]{1,120}\.[^\s@]{2,}$/.test(e)) return res.status(400).json({ error: 'بريد غير صالح.' }); n.email = { on: !!b.email.on && !!e, to: e }; }
    S.cfg = n; writeJ(F('security-config.json'), n); res.json({ success: true, config: n });
  });
  app.post('/api/admin/security/test-alert', ...W, async (req, res) => {
    const e = record({ type: 'test', severity: 'HIGH', action: 'detected', ip: req.secIp || req.ip, method: 'POST', url: '/api/admin/security/test-alert', ua: req.headers['user-agent'], rule: 'manual-test', details: 'تنبيه تجريبي من لوحة الأمان' });
    res.json({ success: true, id: e.id });
  });
  app.get('/api/admin/security/alerts', ...A, (req, res) => res.json({ items: S.alerts.slice(-100).reverse() }));
  app.get('/api/admin/security/blocks', ...A, (req, res) => res.json({ items: Object.entries(S.blocks).filter(([ip]) => blocked(ip)).map(([ip, b]) => ({ ip, ...b, geo: S.geo.get(ip) || null })) }));
  app.post('/api/admin/security/unblock', ...W, (req, res) => { const ip = String((req.body || {}).ip || ''); if (!S.blocks[ip]) return res.status(404).json({ error: 'غير محجوب.' }); delete S.blocks[ip]; S.ipScore.delete(ip); persistBlocks(); record({ type: 'admin_action', severity: 'INFO', action: 'success', ip: req.secIp || req.ip, rule: 'unblock', details: 'رفع حجب ' + ip }); res.json({ success: true }); });
  app.post('/api/admin/security/block', ...W, (req, res) => {
    const ip = String((req.body || {}).ip || ''); if (!/^[0-9a-fA-F:.]{3,45}$/.test(ip)) return res.status(400).json({ error: 'IP غير صالح.' });
    const m = blockIp(ip, clampN((req.body || {}).minutes, 1, 10080, 60), 'حجب يدوي', true); if (!m) return res.status(400).json({ error: 'لا يمكن حجب هذا العنوان (محلي/مسموح).' }); res.json({ success: true, minutes: m });
  });
  app.get('/api/admin/security/verify', ...A, (req, res) => {
    const chain = verifyChain(); const files = critFiles().map(f => ({ file: path.relative(C.ROOT, f), changed: S.baseline[f] !== hashFile(f) })).filter(x => x.changed);
    let backups = [];
    try { const d = path.join(C.ROOT, 'backups'); backups = fs.existsSync(d) ? fs.readdirSync(d).slice(-10).map(n => { const st = fs.statSync(path.join(d, n)); let ok = st.size > 0; if (n.endsWith('.json')) { try { JSON.parse(fs.readFileSync(path.join(d, n), 'utf8')); } catch { ok = false; } } return { name: n, size: st.size, ok }; }) : []; } catch { /* تجاهل */ }
    res.json({ chain, changedFiles: files, badJson: dbCheck(), backups, dataDirMode: (() => { try { return (fs.statSync(C.DATA_DIR).mode & 0o777).toString(8); } catch { return null; } })() });
  });
  app.post('/api/admin/security/revoke-sessions', ...W, (req, res) => {
    const mine = (String(req.headers.cookie || '').match(/admin_session=([^;]+)/) || [])[1]; const me = mine ? decodeURIComponent(mine) : null; let n = 0;
    for (const k of [...sessions.keys()]) if (k !== me) { sessions.delete(k); n++; }
    record({ type: 'admin_action', severity: 'HIGH', action: 'success', ip: req.secIp || req.ip, rule: 'revoke-sessions', details: `أُنهيت ${n} جلسة` }); res.json({ success: true, revoked: n });
  });
  /* 2FA */
  app.get('/api/admin/security/2fa', ...A, (req, res) => { const t = tf(); res.json({ enabled: !!(t && t.enabled), recoveryLeft: t && t.recovery ? t.recovery.length : 0, pending: !!(t && !t.enabled && t.enc) }); });
  app.post('/api/admin/security/2fa/setup', ...W, (req, res) => {
    const t = tf(); if (t && t.enabled) return res.status(400).json({ error: 'المصادقة الثنائية مفعّلة بالفعل.' });
    const secret = b32enc(crypto.randomBytes(20)); writeJ(F('admin-2fa.json'), { enabled: false, enc: enc(secret), recovery: [] }); fs.chmodSync(F('admin-2fa.json'), 0o600);
    const name = encodeURIComponent((C.adminName && C.adminName()) || 'admin');
    res.json({ secret, uri: `otpauth://totp/OsamaCinema:${name}?secret=${secret}&issuer=OsamaCinema&digits=6&period=30` });
  });
  app.post('/api/admin/security/2fa/enable', ...W, (req, res) => {
    const t = tf(); if (!t || !t.enc || t.enabled) return res.status(400).json({ error: 'ابدأ الإعداد أولاً.' });
    if (C.hit && C.hit(`2fa-en:${req.ip}`, 8, 15 * 60000)) return res.status(429).json({ error: 'محاولات كثيرة.' });
    let secret; try { secret = dec(t.enc); } catch { return res.status(500).json({ error: 'تعذر قراءة السر.' }); }
    if (!totpCheck(secret, (req.body || {}).code)) return res.status(400).json({ error: 'الرمز غير صحيح.' });
    const codes = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString('hex'));
    t.enabled = true; t.recovery = codes.map(hashRec); writeJ(F('admin-2fa.json'), t);
    record({ type: 'twofa_changed', severity: 'HIGH', action: 'success', ip: req.secIp || req.ip, rule: '2fa-enabled', details: 'فُعّلت المصادقة الثنائية' });
    res.json({ success: true, recoveryCodes: codes });
  });
  app.post('/api/admin/security/2fa/disable', ...W, (req, res) => {
    if (C.hit && C.hit(`2fa-dis:${req.ip}`, 8, 15 * 60000)) return res.status(429).json({ error: 'محاولات كثيرة.' });
    const t = tf(); if (!t || !t.enabled) return res.status(400).json({ error: 'غير مفعّلة.' });
    if (checkOtp((req.body || {}).code) !== 'ok') return res.status(403).json({ error: 'الرمز غير صحيح.' });
    try { fs.unlinkSync(F('admin-2fa.json')); } catch { /* تجاهل */ }
    record({ type: 'twofa_changed', severity: 'CRITICAL', action: 'success', ip: req.secIp || req.ip, rule: '2fa-disabled', details: 'أُلغيت المصادقة الثنائية' }); res.json({ success: true });
  });
}
function server(srv) {
  try { srv.requestTimeout = 120000; srv.headersTimeout = 20000; srv.keepAliveTimeout = 10000; srv.maxConnections = Number(process.env.MAX_CONNECTIONS) || 2000; } catch { /* تجاهل */ }
}
module.exports = { early, init, routes, server, loginGate, loginFail, loginOk, checkOtp, record, _S: S };

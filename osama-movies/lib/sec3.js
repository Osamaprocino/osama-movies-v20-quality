/* lib/sec3.js — v20.1: تقوية إضافية (ملف مستقل كي لا يتعارض مع sec.js)
   • ترويسات آمنة لـ /uploads (nosniff + CSP sandbox + تنزيل إجباري للأنواع الخطرة)
   • صلاحيات ملفات/مجلدات البيانات
   • /.well-known/security.txt
   • «فحص الصحة الأمنية» بدرجة وتوصيات في لوحة الأمان */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const DANGEROUS = /\.(html?|xhtml|svg|xml|js|mjs|php|phtml|exe|dll|sh|bat|cmd|msi|jar|swf|hta)$/i;

module.exports = function (ctx) {
  const { app, requireAdmin, ROOT, DATA_DIR, ADMIN_FILE, verifyPassword, readJSON, sec } = ctx;
  /* 1) /uploads: لا تنفيذ ولا استنشاق نوع ولا XSS مخزّن عبر ملف مرفوع */
  app.use('/uploads', (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (DANGEROUS.test((req.path || '').split('?')[0])) res.setHeader('Content-Disposition', 'attachment');
    next();
  });
  /* 2) صلاحيات */
  const tighten = () => {
    if (process.platform === 'win32') return;
    try { fs.chmodSync(DATA_DIR, 0o700); } catch { /* تجاهل */ }
    for (const d of ['private', 'backups']) { try { fs.chmodSync(path.join(DATA_DIR, d), 0o700); } catch { /* تجاهل */ } try { fs.chmodSync(path.join(ROOT, d), 0o700); } catch { /* تجاهل */ } }
    for (const f of [ADMIN_FILE, path.join(DATA_DIR, 'users.json'), path.join(DATA_DIR, 'user-sessions.json'), path.join(DATA_DIR, 'payments.json')]) { try { if (fs.existsSync(f)) fs.chmodSync(f, 0o600); } catch { /* تجاهل */ } }
  };
  tighten(); setInterval(tighten, 6 * 3600 * 1000).unref();
  /* 3) security.txt */
  app.get('/.well-known/security.txt', (req, res) => {
    const a = readJSON(path.join(DATA_DIR, 'about.json'), {}) || {};
    const c = (a.contacts || {}); const lines = [];
    if (c.telegram) lines.push('Contact: https://t.me/' + String(c.telegram).replace(/^@/, '').replace(/[^\w.]/g, ''));
    if (c.email) lines.push('Contact: mailto:' + String(c.email).replace(/[\r\n\s]/g, ''));
    if (!lines.length) lines.push('Contact: ' + (req.protocol || 'https') + '://' + (req.headers.host || 'localhost') + '/');
    lines.push('Expires: ' + new Date(Date.now() + 365 * 864e5).toISOString(), 'Preferred-Languages: ar, en, ru');
    res.type('text/plain').send(lines.join('\n') + '\n');
  });
  /* 4) فحص الصحة الأمنية */
  app.get('/api/admin/security/health', requireAdmin, (req, res) => {
    const S = sec._S; const checks = []; const add = (id, ok, w, title, fix) => checks.push({ id, ok: !!ok, weight: w, title, fix: ok ? '' : fix });
    const admin = readJSON(ADMIN_FILE, null);
    const weak = ['admin', 'admin123', 'password', '12345678', '123456789', 'osama123', 'Admin#12345', 'changeme', 'qwerty123'];
    let weakPw = false; try { weakPw = !!admin && weak.some(p => verifyPassword(p, admin)); } catch { /* تجاهل */ }
    const tf = readJSON(path.join(DATA_DIR, 'admin-2fa.json'), null);
    const nodeMajor = Number(process.versions.node.split('.')[0]);
    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    add('pw', !weakPw, 20, 'كلمة مرور الأدمن ليست شائعة/افتراضية', 'غيّر كلمة المرور فوراً من «الحساب والأمان».');
    add('2fa', tf && tf.enabled, 20, 'المصادقة الثنائية للأدمن مفعّلة', 'فعّلها من لوحة «الأمان» ← المصادقة الثنائية.');
    add('https', secure, 10, 'الاتصال الحالي عبر HTTPS', 'شغّل الموقع خلف HTTPS (Caddy في deploy.sh يفعل ذلك تلقائياً).');
    add('hsts', process.env.HSTS === '1', 5, 'HSTS مفعّل', 'ضع HSTS=1 في متغيرات البيئة بعد التأكد أن HTTPS يعمل.');
    add('tg', (process.env.SEC_TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN) && S.cfg.telegram.on && S.cfg.telegram.chatId, 10, 'تنبيهات تيليجرام جاهزة', 'ضع TELEGRAM_BOT_TOKEN وفعّل القناة وChat ID من لوحة الأمان.');
    add('monitor', S.cfg.enabled, 10, 'المراقبة والحجب التلقائي مفعّلان', 'فعّل المراقبة من إعدادات الأمان.');
    add('chain', sec.verifyChain ? sec.verifyChain().ok : true, 10, 'سجل الأمان سليم (لا تلاعب)', 'تعامل مع الخادم كمشتبه به واسترجع نسخة نظيفة.');
    add('csp', (process.env.SEC_CSP || 'enforce') === 'enforce', 5, 'سياسة CSP مفروضة', 'اترك SEC_CSP=enforce.');
    add('node', nodeMajor >= 20, 5, 'إصدار Node مدعوم (20+)', 'حدّث Node إلى إصدار LTS.');
    add('prod', process.env.NODE_ENV === 'production', 3, 'NODE_ENV=production', 'ضع NODE_ENV=production.');
    add('proxy', process.env.TRUST_PROXY !== 'true', 2, 'trust proxy ليس مفتوحاً على كل المصادر', 'لا تضع TRUST_PROXY=true إلا خلف وكيل موثوق وحيد.');
    let multerOld = false; try { const mv = JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', 'multer', 'package.json'), 'utf8')).version; multerOld = Number(String(mv).split('.')[0]) < 2; } catch { /* غير مثبّت محلياً */ }
    add('multer', !multerOld, 3, 'مكتبة رفع الملفات multer محدّثة (2.x)', 'نفّذ: npm i multer@^2 ثم اختبر الرفع.');
    { const st = ctx.sri ? ctx.sri.status() : { total: 0, covered: 0 }; add('sri', st.total === 0 || st.covered === st.total, 3, 'بصمات SRI لسكربتات CDN مفعّلة', 'شغّل «تحديث بصمات SRI» من لوحة الأمان (أو نفّذ deploy.sh) — يحتاج اتصال السيرفر بالإنترنت.'); }
    add('argon2', ctx.pwhash && ctx.pwhash.available(), 3, 'تجزئة كلمات المرور بـ Argon2id', 'نفّذ npm install (يثبّت @node-rs/argon2) ثم أعد التشغيل؛ تُرقّى الحسابات القديمة تلقائياً عند الدخول.');
    add('adminallow', !!process.env.ADMIN_ALLOW_IPS, 1, '(اختياري) قائمة سماح IP للوحة الإدارة', 'إن كان لديك IP ثابت ضع ADMIN_ALLOW_IPS=عنوانك في البيئة.');
    let backupOk = false; try { const d = path.join(ROOT, 'backups'); const fl = fs.existsSync(d) ? fs.readdirSync(d).map(n => fs.statSync(path.join(d, n)).mtimeMs) : []; backupOk = fl.some(t => Date.now() - t < 7 * 864e5); } catch { /* تجاهل */ }
    add('backup', backupOk, 5, 'توجد نسخة احتياطية حديثة (آخر 7 أيام)', 'أنشئ نسخة احتياطية من لوحة الإدارة ← النظام.');
    let perm = true; try { if (process.platform !== 'win32') perm = (fs.statSync(DATA_DIR).mode & 0o077) === 0; } catch { /* تجاهل */ }
    add('perm', perm, 5, 'مجلد البيانات خاص (700)', 'نفّذ: chmod 700 data');
    const total = checks.reduce((a, c) => a + c.weight, 0), got = checks.filter(c => c.ok).reduce((a, c) => a + c.weight, 0);
    res.json({ score: Math.round(got * 100 / total), grade: got * 100 / total >= 90 ? 'A' : got * 100 / total >= 75 ? 'B' : got * 100 / total >= 55 ? 'C' : 'D', checks });
  });
};

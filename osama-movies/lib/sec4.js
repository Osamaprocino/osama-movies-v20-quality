/* lib/sec4.js — v20: طبقة أمان إضافية مستقلة (لا تعدّل sec.js)
   • Cache-Control: no-store للاستجابات الحساسة (/api/admin /api/user /api/auth) كي لا تُخزَّن في المتصفح/الوكلاء.
   • قائمة سماح اختيارية لعناوين IP الخاصة بلوحة الإدارة (ADMIN_ALLOW_IPS=1.2.3.4,10.0.0.0/8) — مطفأة افتراضياً،
     وتُسجَّل المحاولات المرفوضة في سجل الأمان. تحذير: عناوين IP الديناميكية قد تحبسك خارج اللوحة؛ استخدمها بحذر. */
'use strict';
const norm = ip => String(ip || '').replace(/^::ffff:/, '');
const v4 = s => { const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s); if (!m) return null; const p = m.slice(1).map(Number); if (p.some(n => n > 255)) return null; return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3]; };
function parseList(str) {
  return String(str || '').split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const [a, b] = s.split('/'); const base = v4(norm(a));
    if (base !== null) { const bits = b === undefined ? 32 : Number(b); if (!(bits >= 0 && bits <= 32)) return null; const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0; return { t: 4, base: (base & mask) >>> 0, mask }; }
    return b === undefined && /^[0-9a-f:]+$/i.test(a) && a.includes(':') ? { t: 6, ip: a.toLowerCase() } : null;
  }).filter(Boolean);
}
function allowed(list, ip) {
  ip = norm(ip); const n = v4(ip);
  return list.some(r => r.t === 4 ? (n !== null && ((n & r.mask) >>> 0) === r.base) : r.ip === ip.toLowerCase());
}
const ADMIN_PATH = /^\/(api\/admin(\/|$)|admin(\.html)?\/?$|api\/auth\/login$)/;
const SENSITIVE = /^\/api\/(admin|user|auth)(\/|$)/;

// نُبقي الحقول المفيدة فقط ونجرّد المخطّط (http://) من العناوين، فلا يعدّها كاشف الهجمات «SSRF» عندما يعمل الموقع على localhost/شبكة محلية
const cleanReport = j => {
  const r = (j && typeof j === 'object' && (j['csp-report'] || j)) || {}, o = {};
  for (const k of ['document-uri', 'blocked-uri', 'source-file', 'violated-directive', 'effective-directive', 'disposition'])
    if (typeof r[k] === 'string') o[k] = r[k].slice(0, 200).replace(/^[a-z][a-z0-9+.-]*:\/\//i, '//');
  return { 'csp-report': o };
};
const STYLE_ELEM = "style-src-elem 'self' https://fonts.googleapis.com https://accounts.google.com";
module.exports.early = function (app, sec) {
  // المتصفحات ترسل تقارير CSP بنوع application/csp-report (لا يقرؤه express.json) — نحوّله إلى req.body قبل معالج التقارير
  app.use('/api/csp-report', (req, res, next) => {
    if (req.method !== 'POST' || !/csp-report/i.test(req.headers['content-type'] || '')) return next();
    let n = 0; const chunks = [];
    req.on('data', d => { n += d.length; if (n <= 16384) chunks.push(d); });
    req.on('end', () => { try { if (n <= 16384) req.body = cleanReport(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { /* تقرير تالف: يُتجاهل */ } next(); });
    req.on('error', () => next());
  });
  app.use((req, res, next) => {
    // style-src-elem: يمنع حقن عناصر <style> (تسريب بيانات بـ CSS / تزييف واجهة). وضع التقرير افتراضياً؛ SEC_CSP_STYLE_ELEM=enforce للفرض، =off للإيقاف.
    // ملاحظة: style-src-attr ما زال يسمح بالأنماط المضمّنة (يستخدمها كود الواجهة). مكتبة SweetAlert2 (.all) تحقن <style> بنفسها فجرّب الفرض على نسخة تجريبية أولاً.
    const csp = process.env.SEC_CSP || 'enforce', se = process.env.SEC_STYLE_ELEM_MODE || process.env.SEC_CSP_STYLE_ELEM || 'report';
    if (csp !== 'off' && se !== 'off' && req.method === 'GET' && !/^\/(api|uploads)\//.test(req.path)) {
      if (se === 'enforce') { const cur = res.getHeader('Content-Security-Policy'); res.setHeader('Content-Security-Policy', cur ? [].concat(cur, STYLE_ELEM) : STYLE_ELEM); }
      else if (csp !== 'report') res.setHeader('Content-Security-Policy-Report-Only', STYLE_ELEM + '; report-uri /api/csp-report');
    }
    if (SENSITIVE.test(req.path)) res.setHeader('Cache-Control', 'no-store');
    const raw = process.env.ADMIN_ALLOW_IPS;
    if (raw && ADMIN_PATH.test(req.path)) {
      const list = parseList(raw);
      if (list.length && !allowed(list, req.secIp || req.ip)) {
        try { sec.record({ type: 'admin_ip_denied', severity: 'HIGH', action: 'blocked', ip: req.secIp || req.ip, method: req.method, url: req.path, ua: req.headers['user-agent'], rule: 'admin-allowlist', details: 'محاولة وصول للوحة الإدارة من عنوان غير مسموح' }); } catch { /* تجاهل */ }
        return res.status(404).type('text/plain').send('Not found');
      }
    }
    next();
  });
};
module.exports._test = { parseList, allowed };

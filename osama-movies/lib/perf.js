/* lib/perf.js — v20: ضغط الاستجابات النصية (gzip) بلا تبعيات.
   • يشمل html/css/js/json/svg/manifest/text فقط؛ لا يمسّ الصور/الفيديو/SSE/الملفات المرفوعة/طلبات Range.
   • الاستجابات التي لها ETag (الملفات الثابتة) تُخزَّن مضغوطة في الذاكرة فلا يُعاد الضغط.
   • إيقاف: PERF_COMPRESS=0 */
'use strict';
const zlib = require('zlib');
const TYPES = /^(text\/(html|css|plain|javascript|xml)|application\/(javascript|json|manifest\+json|xml|x-javascript)|image\/svg\+xml)/i;
const MIN = 860, MAX = 8 * 1024 * 1024;
const cache = new Map(); let cacheBytes = 0; const CACHE_LIMIT = 24 * 1024 * 1024;
function remember(k, buf) {
  if (buf.length > 1024 * 1024) return;
  while (cacheBytes + buf.length > CACHE_LIMIT && cache.size) { const f = cache.keys().next().value; cacheBytes -= cache.get(f).length; cache.delete(f); }
  cache.set(k, buf); cacheBytes += buf.length;
}
module.exports.early = function (app) {
  if (process.env.PERF_COMPRESS === '0') return;
  app.use((req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.headers.range || !/\bgzip\b/i.test(req.headers['accept-encoding'] || '') || /^\/uploads\//.test(req.path)) return next();
    const write = res.write, end = res.end; let chunks = null, decided = false;
    const decide = () => {
      decided = true;
      const ct = String(res.getHeader('Content-Type') || ''), st = res.statusCode;
      const ok = !res.headersSent && TYPES.test(ct) && st !== 204 && st !== 304 && !res.getHeader('Content-Encoding') && !/no-transform/i.test(String(res.getHeader('Cache-Control') || ''));
      if (ok) { chunks = []; res.setHeader('Vary', [].concat(res.getHeader('Vary') || [], 'Accept-Encoding').join(', ')); }
      return ok;
    };
    res.write = function (c, enc, cb) {
      if (!decided) decide();
      if (!chunks) return write.call(res, c, enc, cb);
      if (c) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c, typeof enc === 'string' ? enc : 'utf8'));
      if (typeof enc === 'function') enc(); else if (typeof cb === 'function') cb();
      return true;
    };
    res.end = function (c, enc, cb) {
      if (typeof c === 'function') { cb = c; c = null; enc = null; } else if (typeof enc === 'function') { cb = enc; enc = null; }
      if (!decided) decide();
      if (!chunks) return end.call(res, c, enc, cb);
      if (c) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c, typeof enc === 'string' ? enc : 'utf8'));
      const body = Buffer.concat(chunks); chunks = null;
      if (req.method === 'HEAD' || body.length < MIN || body.length > MAX) { res.removeHeader('Vary'); if (req.method !== 'HEAD') res.setHeader('Content-Length', body.length); else if (body.length) res.setHeader('Content-Length', body.length); return end.call(res, req.method === 'HEAD' ? undefined : body, cb); }
      const etag = res.getHeader('ETag'), key = etag ? req.path + '|' + etag : null;
      let z = key && cache.get(key);
      if (!z) { try { z = zlib.gzipSync(body, { level: 6 }); } catch { z = null; } if (z && key) remember(key, z); }
      if (!z || z.length >= body.length) { res.setHeader('Content-Length', body.length); return end.call(res, body, cb); }
      res.setHeader('Content-Encoding', 'gzip'); res.setHeader('Content-Length', z.length);
      if (etag && !/^W\//.test(etag)) res.setHeader('ETag', 'W/' + etag);
      return end.call(res, z, cb);
    };
    next();
  });
};
module.exports._stats = () => ({ entries: cache.size, bytes: cacheBytes });

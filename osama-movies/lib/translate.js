/* ترجمة نصوص الترجمة آلياً (خادم وسيط + ذاكرة مؤقتة)
   المزودون بالترتيب (يمكن تغييره بالمتغير TRANSLATE_PROVIDERS=gtx,mymemory,libre):
   1) gtx      : نقطة Google Translate العامة (بدون مفتاح)، تُرسَل الأسطر دفعة واحدة
   2) mymemory : MyMemory (بدون مفتاح، بحد يومي) — أضف MYMEMORY_EMAIL لرفع الحد
   3) libre    : LibreTranslate إن وُفّر LIBRETRANSLATE_URL (و LIBRETRANSLATE_KEY)
*/
const fs = require('fs');
const path = require('path');

const TARGETS = new Set(['ar', 'en', 'ru', 'tr', 'fr', 'de', 'es', 'fa', 'it', 'zh-CN']);
const GTX_URL = process.env.GTX_URL || 'https://translate.googleapis.com/translate_a/single';
const MYMEMORY_URL = process.env.MYMEMORY_URL || 'https://api.mymemory.translated.net/get';

let cacheFile = null;
const cache = new Map();
let dirty = false, flushTimer = null;
const CACHE_MAX = 60000;

function initCache(file) {
  cacheFile = file;
  try {
    const o = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [k, v] of Object.entries(o)) cache.set(k, v);
  } catch { /* لا يوجد ملف بعد */ }
}
function remember(key, val) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, val);
  dirty = true;
  if (!flushTimer && cacheFile) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      if (!dirty) return;
      dirty = false;
      try { fs.writeFileSync(cacheFile + '.tmp', JSON.stringify(Object.fromEntries(cache))); fs.renameSync(cacheFile + '.tmp', cacheFile); } catch { /* تجاهل */ }
    }, 4000);
    flushTimer.unref();
  }
}

async function http(url, opts = {}) {
  const r = await fetch(url, { signal: AbortSignal.timeout(12000), ...opts });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

/* ---- gtx: دفعة أسطر (كل سطر = مقطع) ---- */
async function gtxBatch(lines, to, from) {
  const url = `${GTX_URL}?client=gtx&sl=${encodeURIComponent(from || 'auto')}&tl=${encodeURIComponent(to)}&dt=t`;
  const body = new URLSearchParams({ q: lines.join('\n') });
  const data = await http(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const segs = Array.isArray(data && data[0]) ? data[0] : [];
  const out = [];
  let buf = '';
  for (const seg of segs) {
    if (!seg || typeof seg[0] !== 'string') continue;
    const orig = typeof seg[1] === 'string' ? seg[1] : '';
    buf += seg[0].replace(/\n+$/, '');
    if (/\n$/.test(orig)) { out.push(buf.trim()); buf = ''; } else if (orig && !/\n$/.test(orig)) { buf += ' '; }
  }
  if (buf.trim()) out.push(buf.trim());
  if (out.length !== lines.length) throw new Error('segment mismatch');
  return out;
}
async function gtxOne(text, to, from) {
  const u = `${GTX_URL}?client=gtx&sl=${encodeURIComponent(from || 'auto')}&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(text)}`;
  const data = await http(u);
  const segs = Array.isArray(data && data[0]) ? data[0] : [];
  return segs.map(s => (s && typeof s[0] === 'string' ? s[0] : '')).join('').trim();
}

/* ---- MyMemory ---- */
async function myMemoryOne(text, to, from) {
  const lp = `${from && from !== 'auto' ? from : 'en'}|${to}`;
  let u = `${MYMEMORY_URL}?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(lp)}`;
  if (process.env.MYMEMORY_EMAIL) u += `&de=${encodeURIComponent(process.env.MYMEMORY_EMAIL)}`;
  const d = await http(u);
  if (!d || !d.responseData || typeof d.responseData.translatedText !== 'string' || (d.responseStatus && Number(d.responseStatus) !== 200)) throw new Error('mymemory');
  return d.responseData.translatedText;
}

/* ---- LibreTranslate ---- */
async function libreOne(text, to, from) {
  const base = process.env.LIBRETRANSLATE_URL;
  if (!base) throw new Error('libre not configured');
  const d = await http(base.replace(/\/$/, '') + '/translate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, source: from || 'auto', target: to === 'zh-CN' ? 'zh' : to, format: 'text', api_key: process.env.LIBRETRANSLATE_KEY || undefined })
  });
  if (!d || typeof d.translatedText !== 'string') throw new Error('libre');
  return d.translatedText;
}

async function pool(items, limit, fn) {
  const res = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; res[k] = await fn(items[k], k); }
  }));
  return res;
}

function providers() {
  return String(process.env.TRANSLATE_PROVIDERS || 'gtx,mymemory,libre').split(',').map(s => s.trim()).filter(Boolean);
}

/* يترجم قائمة نصوص؛ يعيد {translations, provider} ويرمي خطأ إن فشل كل شيء */
async function translateMany(texts, to, from = 'auto') {
  if (!TARGETS.has(to)) throw new Error('bad target');
  const out = new Array(texts.length);
  const todo = [];
  texts.forEach((t, i) => {
    const flat = String(t).replace(/\s*\n\s*/g, ' ').trim();
    if (!flat) { out[i] = ''; return; }
    const hit = cache.get(`${to}|${flat}`);
    if (hit !== undefined) out[i] = hit; else todo.push({ i, flat });
  });
  if (!todo.length) return { translations: out, provider: 'cache' };

  // إزالة التكرار
  const uniq = [...new Set(todo.map(x => x.flat))];
  const map = new Map();
  let used = null, lastErr = null;
  for (const p of providers()) {
    try {
      if (p === 'gtx') {
        // دفعات بحجم محدود، وعند عدم تطابق الأسطر نعود للترجمة المفردة
        const batches = [];
        let cur = [], len = 0;
        for (const u of uniq) { if (cur.length && (len + u.length > 3500 || cur.length >= 40)) { batches.push(cur); cur = []; len = 0; } cur.push(u); len += u.length + 1; }
        if (cur.length) batches.push(cur);
        await pool(batches, 3, async b => {
          let r;
          try { r = await gtxBatch(b, to, from); } catch { r = await pool(b, 4, x => gtxOne(x, to, from)); }
          b.forEach((src, k) => map.set(src, r[k]));
        });
      } else if (p === 'mymemory') {
        await pool(uniq, 4, async u => { map.set(u, await myMemoryOne(u.slice(0, 480), to, from)); });
      } else if (p === 'libre') {
        await pool(uniq, 4, async u => { map.set(u, await libreOne(u, to, from)); });
      } else continue;
      used = p; break;
    } catch (e) { lastErr = e; map.clear(); }
  }
  if (!used) throw lastErr || new Error('no provider');
  for (const { i, flat } of todo) {
    const v = map.get(flat) || flat;
    out[i] = v;
    remember(`${to}|${flat}`, v);
  }
  return { translations: out, provider: used };
}

module.exports = { translateMany, initCache, TARGETS };

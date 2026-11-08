/* lib/sri.js — v20: Subresource Integrity لسكربتات CDN (unpkg / jsDelivr)
   • generate(): يجلب كل سكربت CDN مذكور في صفحات الموقع، يثبّت إصداره (بدل @latest)، يحسب sha384، ويتحقق أن العنوان المثبّت يعطي
     البايتات نفسها، ثم يحفظ النتيجة في data/sri.json. أي فشل لا يكسر شيئاً: الإدخال غير الموثَّق يُتجاهل ويبقى الوسم كما هو.
   • apply(html): يضيف integrity + crossorigin للوسوم الموجودة في sri.json ويستبدل العنوان بالنسخة المثبّتة.
   • يُشغَّل من deploy.sh (node tools/make-sri.mjs) أو من لوحة الأمان (زر «تحديث بصمات SRI»). لا يمسّ أي بيانات أخرى. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const HOSTS = /^https:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//;
const TAG_RE = /<script\b[^>]*?\ssrc="(https:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net)\/[^"]+)"[^>]*>/g;
const PAGES = ['index.html', 'admin.html', 'admin-login.html'];
const MAX = 6 * 1024 * 1024;

module.exports = function ({ DATA_DIR, PUBLIC }) {
  const FILE = path.join(DATA_DIR, 'sri.json');
  let cache = null, cacheM = -1;
  const load = () => {
    try { const m = fs.statSync(FILE).mtimeMs; if (m === cacheM && cache) return cache; cache = JSON.parse(fs.readFileSync(FILE, 'utf8')).entries || {}; cacheM = m; return cache; }
    catch { cache = {}; cacheM = -1; return cache; }
  };
  const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  function apply(html) {
    const map = load(); if (!map || !Object.keys(map).length) return html;
    return html.replace(TAG_RE, (tag, url) => {
      const e = map[url]; if (!e || !HOSTS.test(e.url) || !/^sha384-[A-Za-z0-9+/]+={0,2}$/.test(e.integrity)) return tag;
      let t = tag.replace(`src="${url}"`, `src="${esc(e.url)}"`);
      t = t.replace(/\s(integrity|crossorigin)="[^"]*"/g, '');
      return t.replace(/<script\b/, `<script integrity="${e.integrity}" crossorigin="anonymous"`);
    });
  }
  const urlsInPages = () => {
    const set = new Set();
    for (const f of PAGES) { let h = ''; try { h = fs.readFileSync(path.join(PUBLIC, f), 'utf8'); } catch { continue; } let m; TAG_RE.lastIndex = 0; while ((m = TAG_RE.exec(h))) set.add(m[1]); }
    return [...set];
  };
  const fetchBuf = async (f, url) => {
    const r = await f(url, { redirect: 'follow' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const b = Buffer.from(await r.arrayBuffer()); if (!b.length || b.length > MAX) throw new Error('حجم غير مقبول');
    return { r, b, final: r.url || url };
  };
  const sha = b => 'sha384-' + crypto.createHash('sha384').update(b).digest('base64');
  async function generate(f = globalThis.fetch) {
    const out = {}, report = [];
    for (const url of urlsInPages()) {
      try {
        const { r, b, final } = await fetchBuf(f, url); const integrity = sha(b);
        let pinned = final;
        const v = r.headers && r.headers.get && r.headers.get('x-jsd-version');
        if (/cdn\.jsdelivr\.net/.test(url) && v && /^[\w.\-+]+$/.test(v)) pinned = /npm\/(@?[^/@]+(?:\/[^/@]+)?)@[^/]+/.test(url) ? url.replace(/(npm\/(?:@[^/@]+\/)?[^/@]+)@[^/]+/, `$1@${v}`) : url.replace(/(npm\/(?:@[^/@]+\/)?[^/@/]+)/, `$1@${v}`);
        if (!HOSTS.test(pinned)) throw new Error('عنوان مثبّت خارج المضيفين المسموحين');
        if (pinned !== url) { const again = await fetchBuf(f, pinned); if (sha(again.b) !== integrity) throw new Error('العنوان المثبّت يعطي محتوى مختلفاً'); }
        out[url] = { url: pinned, integrity }; report.push({ url, pinned, ok: true });
      } catch (e) { report.push({ url, ok: false, error: String(e.message || e).slice(0, 120) }); }
    }
    if (Object.keys(out).length) { fs.mkdirSync(DATA_DIR, { recursive: true }); const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify({ generatedAt: new Date().toISOString(), entries: out }, null, 1)); fs.renameSync(tmp, FILE); cacheM = -1; st = null; }
    return { report, saved: Object.keys(out).length };
  }
  let st = null, stT = 0;
  const status = () => { if (st && Date.now() - stT < 10000) return st; const urls = urlsInPages(), m = load(); st = { total: urls.length, covered: urls.filter(u => m[u]).length }; stT = Date.now(); return st; };
  return { apply, generate, status, FILE };
};

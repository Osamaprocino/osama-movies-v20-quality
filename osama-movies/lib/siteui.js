/* lib/siteui.js — v20: إعدادات واجهة الموقع من لوحة التحكم (الشريط السفلي: ألوان/حركة). افتراضية لكل الزوار،
   وللزائر تخصيص خاص بهاتفه فقط (يُحفظ في متصفحه ولا يُرسل للخادم). */
'use strict';
const path = require('path');
const HEX = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_NAV = {
  enabled: true, style: 'notch', mode: 'per-tab',
  colors: ['#3478f6', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981'], single: '#3478f6',
  barLight: '#ffffff', barDark: '#1a2434', anim: 'jelly', halo: true, haptic: true, labels: true, allowUserCustom: true
};
const FX_KEYS = ['splash', 'particles', 'cursor', 'tilt', 'ripple', 'progress', 'reveal', 'burst', 'glowborder', 'sparkles', 'cardexpand', 'rubber', 'cinemadim', 'clicksound', 'allowUserCustom'];
const DEFAULT_FX = { splash: true, particles: true, cursor: true, tilt: true, ripple: true, progress: true, reveal: true, burst: true, glowborder: false, sparkles: false, cardexpand: true, rubber: true, cinemadim: true, clicksound: false, allowUserCustom: true };
function cleanFx(b, base) { const n = { ...base }; b = b && typeof b === 'object' ? b : {}; for (const k of FX_KEYS) if (typeof b[k] === 'boolean') n[k] = b[k]; return n; }
function clean(b, base) {
  const n = { ...base }; b = b && typeof b === 'object' ? b : {};
  for (const k of ['enabled', 'halo', 'haptic', 'labels', 'allowUserCustom']) if (typeof b[k] === 'boolean') n[k] = b[k];
  if (['notch', 'classic'].includes(b.style)) n.style = b.style;
  if (['per-tab', 'single'].includes(b.mode)) n.mode = b.mode;
  if (['jelly', 'slide', 'none'].includes(b.anim)) n.anim = b.anim;
  if (Array.isArray(b.colors)) n.colors = base.colors.map((d, i) => HEX.test(b.colors[i]) ? b.colors[i].toLowerCase() : d);
  for (const k of ['single', 'barLight', 'barDark']) if (HEX.test(b[k])) n[k] = b[k].toLowerCase();
  return n;
}
module.exports = function (c) {
  const { app, requireAdmin, sameOrigin, readJSON, writeJSONAtomic, DATA_DIR } = c;
  const FILE = path.join(DATA_DIR, 'site-ui.json');
  const get = () => { const f = readJSON(FILE, {}) || {}; return { nav: clean(f.nav, DEFAULT_NAV), fx: cleanFx(f.fx, DEFAULT_FX) }; };
  app.get('/api/site-ui', (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.json(get()); });
  app.get('/api/admin/site-ui', requireAdmin, (req, res) => res.json({ ...get(), defaults: { nav: DEFAULT_NAV, fx: DEFAULT_FX } }));
  app.put('/api/admin/site-ui', sameOrigin, requireAdmin, (req, res) => {
    const cur = get(); const nav = clean((req.body || {}).nav, cur.nav); const fx = cleanFx((req.body || {}).fx, cur.fx);
    writeJSONAtomic(FILE, { nav, fx }); res.json({ success: true, nav, fx });
  });
  app.post('/api/admin/site-ui/reset', sameOrigin, requireAdmin, (req, res) => { const cur = get(); writeJSONAtomic(FILE, { nav: DEFAULT_NAV, fx: cur.fx }); res.json({ success: true, nav: DEFAULT_NAV, fx: cur.fx }); });
};
module.exports.clean = clean; module.exports.cleanFx = cleanFx; module.exports.DEFAULT_NAV = DEFAULT_NAV;

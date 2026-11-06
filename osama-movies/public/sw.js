/* Service Worker: يخزّن هيكل التطبيق فقط. لا يخزّن /api ولا الفيديوهات ولا لوحة الإدارة. */
const VER = 'osama-v20';
const SHELL = ['/', '/style.css', '/glass.css', '/extras.css', '/extras2.css', '/i18n-extra2.js', '/i18n.js', '/i18n-extra.js', '/script.js', '/social.js', '/player.js', '/shorts.js', '/profile.js', '/extras.js', '/extras2.js', '/youtube.css', '/extras5.js', '/extras5.css', '/liquid.css', '/extras8.js', '/extras9.js', '/extras10.js', '/extras11.js', '/extras11.css', '/extras12.js', '/extras12.css', '/extras13.js', '/icons-fallback.js', '/extras13.css', '/extras10.css', '/logo2.js', '/logo2.css', '/logo2.svg', '/extras9.css', '/logo.js', '/logo.css', '/logo.svg', '/extras8.css', '/extras7.js', '/extras7.css', '/i18n-extra7.js', '/extras6.js', '/extras6.css', '/i18n-extra6.js', '/admin-theme.css', '/admin-theme.js', '/admin-extra3.js', '/admin-extra4.js', '/admin-extra5.js', '/admin-extra6.js', '/admin-drawer.js', '/admin-drawer.css', '/i18n-extra5.js', '/youtube.js', '/extras3.css', '/extras3.js', '/extras4.js', '/extras4.css', '/i18n-extra4.js', '/i18n-extra3.js', '/offline.html', '/icons/icon-192.png', '/manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin') || url.pathname.startsWith('/uploads/') || req.headers.has('range')) return;
  // صفحات التنقل: الشبكة أولاً ثم النسخة المخزّنة ثم صفحة بلا اتصال
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { if (url.pathname === '/' && !url.search) { const c = r.clone(); caches.open(VER).then(x => x.put('/', c)); } return r; })
      .catch(() => caches.match('/').then(r => r || caches.match('/offline.html'))));
    return;
  }
  // الملفات الثابتة: من الذاكرة فوراً مع تحديثها في الخلفية
  e.respondWith(caches.open(VER).then(async cache => {
    const hit = await cache.match(req);
    const net = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});

/* Web Push: إظهار الإشعار والانتقال عند النقر */
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Osama Cinema', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Osama Cinema', { body: d.body || '', tag: d.tag || 'osama', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: d.url || '/' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) { c.navigate(url).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});

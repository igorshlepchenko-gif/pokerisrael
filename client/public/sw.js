// Service worker — התראות דחיפה בלבד (server/services/webPush.js).
// בכוונה בלי fetch handler / מטמון: האתר נטען תמיד מהשרת כרגיל.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'פוקר ישראל', {
    body: d.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: d.tag || 'pokerisrael',
    lang: 'he',
    dir: 'rtl',
    data: { url: d.url || '/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if ('focus' in w) {
        try { await w.navigate(url); } catch { /* חלון אחר */ }
        return w.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});

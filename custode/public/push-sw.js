// Gestione delle notifiche push nel service worker (importato da Workbox).
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(d.title || 'Custode', {
    body: d.body || '', tag: d.tag, renotify: true, requireInteraction: !!d.urgent,
    icon: '/icon-192.png', badge: '/icon-192.png', vibrate: d.urgent ? [300, 100, 300, 100, 300] : [150], data: { url: d.url || '/' },
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => 'focus' in c);
    return open ? open.focus() : self.clients.openWindow(event.notification.data.url || '/');
  }));
});

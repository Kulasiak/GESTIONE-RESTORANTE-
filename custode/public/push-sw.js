// Gestione delle notifiche push nel service worker (importato da Workbox).
// I percorsi partono dallo scope del service worker, cosi funziona anche sotto /custode/.
const HOME = self.registration.scope;
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(d.title || 'Custode', {
    body: d.body || '', tag: d.tag, renotify: true, requireInteraction: !!d.urgent,
    icon: HOME + 'icon-192.png', badge: HOME + 'icon-192.png', vibrate: d.urgent ? [300, 100, 300, 100, 300] : [150], data: { url: new URL(d.url || '.', HOME).href },
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => 'focus' in c);
    return open ? open.focus() : self.clients.openWindow(event.notification.data.url || HOME);
  }));
});

self.addEventListener('install', function (e) { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (event) {
  event.respondWith(fetch(event.request));
});
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var dataUrl = (event.notification.data && event.notification.data.url) || '';
  var tag = String(event.notification.tag || '');
  var riderClick = dataUrl.indexOf('rider.html') >= 0 || tag.indexOf('rider.html') >= 0 || tag.indexOf('rider_') >= 0;
  var url = riderClick ? '/rider.html' : (dataUrl || '/');
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (wins) {
    var i;
    if (riderClick) {
      for (i = 0; i < wins.length; i++) {
        if (wins[i].url.indexOf('/rider.html') >= 0 && 'focus' in wins[i]) return wins[i].focus();
      }
      if (clients.openWindow) return clients.openWindow('/rider.html');
      return;
    }
    if (url && url !== '/') {
      for (i = 0; i < wins.length; i++) {
        if (wins[i].url.indexOf(url) >= 0 && 'focus' in wins[i]) return wins[i].focus();
      }
    }
    for (i = 0; i < wins.length; i++) {
      if (wins[i].url.indexOf(self.location.origin) === 0 && 'focus' in wins[i]) return wins[i].focus();
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});

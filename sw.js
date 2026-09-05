/* sw.js — Service Worker 后台保活 */
/* 每15分钟通过 postMessage 通知主线程检查发帖 */

var KEEPALIVE_INTERVAL = 15 * 60 * 1000; // 15分钟

self.addEventListener('install', function (e) {
  console.log('[SW] install');
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  console.log('[SW] activate');
  e.waitUntil(self.clients.claim());
});

self.addEventListener('message', function (e) {
  if (e.data === 'start') {
    console.log('[SW] 收到启动指令，开始保活');
    startKeepAlive();
  }
});

function startKeepAlive() {
  setInterval(function () {
    self.clients.matchAll({ type: 'window' }).then(function (clients) {
      clients.forEach(function (client) {
        client.postMessage({ type: 'auto-moments-check' });
      });
      console.log('[SW] 已通知主线程检查发帖，客户端数:', clients.length);
    });
  }, KEEPALIVE_INTERVAL);
}

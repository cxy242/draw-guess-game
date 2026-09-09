/* sw.js — Service Worker 后台保活 + API保护 */
/* 每2分钟通过 postMessage 通知主线程保持活跃 */

var KEEPALIVE_INTERVAL = 2 * 60 * 1000; // 2分钟

self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('message', function (e) {
  if (e.data === 'start') {
    startKeepAlive();
  }
  // 处理主线程请求的后台fetch
  if (e.data && e.data.type === 'background-fetch') {
    handleBackgroundFetch(e.data);
  }
});

function startKeepAlive() {
  setInterval(function () {
    self.clients.matchAll({ type: 'window' }).then(function (clients) {
      clients.forEach(function (client) {
        client.postMessage({ type: 'keepalive-ping', time: Date.now() });
      });
    });
  }, KEEPALIVE_INTERVAL);
}

// 后台fetch：在Service Worker中执行API调用，不受主线程休眠影响
function handleBackgroundFetch(data) {
  var url = data.url;
  var options = data.options || {};
  options.keepalive = true; // 即使页面关闭也完成请求

  fetch(url, options).then(function (response) {
    return response.text().then(function (text) {
      // 回传结果给主线程
      self.clients.matchAll({ type: 'window' }).then(function (clients) {
        clients.forEach(function (client) {
          client.postMessage({
            type: 'background-fetch-result',
            requestId: data.requestId,
            ok: true,
            status: response.status,
            body: text
          });
        });
      });
    });
  }).catch(function (err) {
    self.clients.matchAll({ type: 'window' }).then(function (clients) {
      clients.forEach(function (client) {
        client.postMessage({
          type: 'background-fetch-result',
          requestId: data.requestId,
          ok: false,
          error: err.message
        });
      });
    });
  });
}

// 拦截fetch请求，给API调用加keepalive标记
self.addEventListener('fetch', function (event) {
  // 只拦截API调用（chat/completions）
  if (event.request.url && event.request.url.indexOf('chat/completions') !== -1) {
    // 不修改请求，只是确保它能完成
    // fetch API 本身在后台会继续运行
    return;
  }
});

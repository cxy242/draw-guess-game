// about.js — 关于本机页面
// 依赖：main.js（免责声明）、settings.js（子页面构建器）

var APP_VERSION = '2.2.0'

window.openAboutDevicePage = function() {
  var existing = document.getElementById('sub-about-device')
  if (existing) return

  var html =
    '<div class="setting-section">' +
      '<div class="list-row" id="row-app-version">' +
        '<div class="row-icon-box"><i class="fa-solid fa-circle-info"></i></div>' +
        '<div class="row-body">' +
          '<div class="row-label">当前版本</div>' +
          '<div class="row-value" id="val-app-version">v' + APP_VERSION + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="list-row clickable" id="row-check-update">' +
        '<div class="row-icon-box"><i class="fa-solid fa-arrow-up-right-from-square"></i></div>' +
        '<div class="row-body">' +
          '<div class="row-label">检查更新</div>' +
          '<div class="row-value" id="val-check-update">点击检查</div>' +
        '</div>' +
        '<i class="fa fa-angle-right row-chevron"></i>' +
      '</div>' +
      '<div class="list-row clickable" id="row-force-update">' +
        '<div class="row-icon-box"><i class="fa-solid fa-rotate-right"></i></div>' +
        '<div class="row-body"><div class="row-label">强制下载最新版本</div></div>' +
        '<i class="fa fa-angle-right row-chevron"></i>' +
      '</div>' +
    '</div>' +
    '<div class="setting-section">' +
      '<div class="list-row clickable" id="row-about-disclaimer">' +
        '<div class="row-icon-box"><i class="fa-solid fa-shield-halved"></i></div>' +
        '<div class="row-body"><div class="row-label">免责声明</div></div>' +
        '<i class="fa fa-angle-right row-chevron"></i>' +
      '</div>' +
    '</div>'

  var page = buildSubPage('sub-about-device', '关于本机', html)
  openSubPage(page)

  // 免责声明
  page.querySelector('#row-about-disclaimer').addEventListener('click', function() {
    if (window.showDisclaimer) window.showDisclaimer({ mode: 'view' })
  })

  // 检查更新
  page.querySelector('#row-check-update').addEventListener('click', function() {
    var valEl = page.querySelector('#val-check-update')
    valEl.textContent = '检查中...'
    valEl.style.color = '#8e8e93'
    fetch('https://draw-guess-game-production-0fdb.up.railway.app/version.json?' + Date.now())
      .then(function(r) { return r.json() })
      .then(function(data) {
        if (data.version && data.version !== APP_VERSION) {
          valEl.textContent = '有新版本 v' + data.version + '（当前 v' + APP_VERSION + '）'
          valEl.style.color = '#34c759'
        } else {
          valEl.textContent = '已是最新版本 v' + APP_VERSION
          valEl.style.color = '#8e8e93'
        }
      })
      .catch(function() {
        valEl.textContent = '检查失败，请重试'
        valEl.style.color = '#ff3b30'
      })
  })

  // 强制下载最新版本
  page.querySelector('#row-force-update').addEventListener('click', function() {
    window.toast && window.toast('正在获取最新版本...')
    var baseUrl = window.location.origin
    // 1. 先拉最新的version.json（不走缓存）
    fetch(baseUrl + '/version.json?' + Date.now(), { cache: 'no-store' })
      .then(function(r) { return r.json() })
      .then(function(ver) {
        var newVer = ver.version || Date.now()
        window.toast && window.toast('获取到 v' + newVer + '，正在清除缓存...')
        var tasks = []
        // 2. 清除所有 Cache Storage
        if ('caches' in window) {
          tasks.push(caches.keys().then(function(names) {
            return Promise.all(names.map(function(name) { return caches.delete(name) }))
          }))
        }
        // 3. 注销所有 Service Worker
        if ('serviceWorker' in navigator) {
          tasks.push(navigator.serviceWorker.getRegistrations().then(function(regs) {
            return Promise.all(regs.map(function(reg) { return reg.unregister() }))
          }))
        }
        Promise.all(tasks).then(function() {
          // 4. 显示加载遮罩，防止闪屏
          var overlay = document.createElement('div')
          overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0a0a1a;display:flex;align-items:center;justify-content:center;'
          overlay.innerHTML = '<div style="text-align:center;color:#fff;"><div style="font-size:17px;font-weight:700;margin-bottom:12px;">正在更新到 v' + newVer + '...</div><div style="font-size:13px;color:#888;">请稍候</div></div>'
          document.body.appendChild(overlay)
          // 5. 直接跳转（不改DOM，避免闪屏）
          setTimeout(function() {
            window.location.replace(window.location.pathname + '?v=' + newVer + '&t=' + Date.now())
          }, 300)
        }).catch(function() {
          window.location.replace(window.location.pathname + '?v=' + Date.now())
        })
      })
      .catch(function() {
        // version.json拉不到就用时间戳兜底
        window.toast && window.toast('获取版本失败，强制刷新...')
        window.location.replace(window.location.pathname + '?v=' + Date.now())
      })
  })
}

// tarot-page.js — 塔罗占卜页面（iframe嵌入tarot-ritual引擎）
(function() {
  'use strict'

  var TAROT_URL = '/tarot/'

  window.showTarotPage = function() {
    var existing = document.getElementById('tarot-page')
    if (existing) existing.remove()

    var page = document.createElement('div')
    page.id = 'tarot-page'
    page.className = 'full-page'
    page.style.cssText = 'position:fixed;inset:0;z-index:400;background:#1a1520;overflow:hidden;'

    page.innerHTML =
      '<iframe id="tarot-iframe" src="' + TAROT_URL + '" style="width:100%;height:100%;border:none;"></iframe>' +
      '<button id="tarot-close-btn" style="position:absolute;top:8px;left:8px;z-index:500;width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,0.4);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;">' +
        '<i class="fa-solid fa-xmark" style="color:#fff;font-size:14px;"></i>' +
      '</button>'

    document.getElementById('app').appendChild(page)

    // 关闭按钮
    page.querySelector('#tarot-close-btn').onclick = function() { page.remove() }
  }
})()
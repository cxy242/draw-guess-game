// music-page.js — 网易云音乐播放器（接入 Music-Mcp-Netease）
(function() {
  var MUSIC_URL = '/music/?token=166566a37e5c012a3f9579c815231cef423058f2911fbda9dadfbb86c5d93f4e';
  var COOKIE_API = '/api/music-cookie';

  window.showMusicPage = function() {
    var page = document.createElement('div');
    page.id = 'music-page';
    page.className = 'full-page';
    page.style.cssText = 'position:fixed;inset:0;z-index:400;background:#fbeff4;overflow:hidden;';
    page.innerHTML =
      '<iframe id="music-iframe" src="' + MUSIC_URL + '" style="width:100%;height:100%;border:none;"></iframe>' +
      '<div id="music-fab" style="position:absolute;bottom:80px;right:16px;z-index:500;width:44px;height:44px;border-radius:50%;background:rgba(210,110,136,0.85);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;cursor:grab;touch-action:none;box-shadow:0 4px 16px rgba(152,78,104,0.3);transition:transform 0.15s ease-out;"><i class="fa-solid fa-gear" style="color:#fff;font-size:16px;pointer-events:none;"></i></div>' +
      '<div id="music-close-btn" style="position:absolute;top:40px;left:8px;z-index:500;width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,0.3);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;cursor:pointer;"><i class="fa-solid fa-xmark" style="color:#fff;font-size:14px;"></i></div>';
    document.getElementById('app').appendChild(page);

    // 关闭按钮
    page.querySelector('#music-close-btn').onclick = function() { page.remove(); };

    // 悬浮球点击 → 设置弹窗
    var fab = page.querySelector('#music-fab');
    var dragging = false;
    var startX, startY, startLeft, startBottom;

    fab.addEventListener('touchstart', function(e) {
      var touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startLeft = parseInt(fab.style.right);
      startBottom = parseInt(fab.style.bottom);
      dragging = false;
    }, { passive: true });

    fab.addEventListener('touchmove', function(e) {
      var touch = e.touches[0];
      var dx = touch.clientX - startX;
      var dy = touch.clientY - startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        dragging = true;
        fab.style.right = Math.max(0, Math.min(window.innerWidth - 44, startLeft - dx)) + 'px';
        fab.style.bottom = Math.max(0, Math.min(window.innerHeight - 44, startBottom + dy)) + 'px';
      }
    }, { passive: true });

    fab.addEventListener('touchend', function() {
      if (!dragging) {
        fab.style.transform = 'scale(0.92)';
        setTimeout(function() { fab.style.transform = ''; }, 120);
        showCookieSettings(page);
      }
      dragging = false;
    });

    // 鼠标拖动（PC端）
    fab.addEventListener('mousedown', function(e) {
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(fab.style.right);
      startBottom = parseInt(fab.style.bottom);
      dragging = false;
      function onMove(e2) {
        var dx = e2.clientX - startX;
        var dy = e2.clientY - startY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) dragging = true;
        fab.style.right = Math.max(0, Math.min(window.innerWidth - 44, startLeft - dx)) + 'px';
        fab.style.bottom = Math.max(0, Math.min(window.innerHeight - 44, startBottom + dy)) + 'px';
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (!dragging) showCookieSettings(page);
        dragging = false;
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  };

  function showCookieSettings(parentPage) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10001;display:flex;align-items:center;justify-content:center;';
    var box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:16px;padding:24px;max-width:340px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);';
    box.innerHTML =
      '<h3 style="margin:0 0 16px;font-size:16px;color:#6b4a55;">网易云账号设置</h3>' +
      '<p style="margin:0 0 12px;font-size:13px;color:#85616f;">输入网易云MUSIC_U cookie，即可同步歌单/日推/红心。</p>' +
      '<textarea id="cookie-input" placeholder="粘贴完整cookie或MUSIC_U值" style="width:100%;height:80px;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:13px;box-sizing:border-box;resize:none;"></textarea>' +
      '<div style="display:flex;gap:10px;margin-top:16px;">' +
        '<button id="cookie-cancel" style="flex:1;padding:10px;border-radius:8px;border:1px solid #ddd;background:#fff;color:#666;font-size:14px;cursor:pointer;">取消</button>' +
        '<button id="cookie-save" style="flex:1;padding:10px;border-radius:8px;border:none;background:#D26E88;color:#fff;font-size:14px;cursor:pointer;">保存</button>' +
      '</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    box.querySelector('#cookie-cancel').onclick = function() { overlay.remove(); };
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    box.querySelector('#cookie-save').onclick = function() {
      var val = box.querySelector('#cookie-input').value.trim();
      if (!val) { window.toast && window.toast('请输入cookie'); return; }
      var match = val.match(/MUSIC_U=([^;\s]+)/);
      var cookie = match ? match[1] : val;
      fetch(COOKIE_API, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({cookie: cookie})
      }).then(function(r) { return r.json(); }).then(function(d) {
        if (d.ok) {
          window.toast && window.toast('cookie已保存');
          overlay.remove();
          var iframe = parentPage.querySelector('#music-iframe');
          if (iframe) iframe.src = iframe.src;
        } else {
          window.toast && window.toast('保存失败：' + (d.msg || '未知错误'));
        }
      }).catch(function() { window.toast && window.toast('保存失败：网络错误'); });
    };
  }
})();
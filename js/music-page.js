// music-page.js — 网易云音乐播放器（接入 Music-Mcp-Netease）
(function() {
  var MUSIC_URL = '/music/?token=166566a37e5c012a3f9579c815231cef423058f2911fbda9dadfbb86c5d93f4e';
  var COOKIE_API = '/api/music-cookie';

  window.showMusicPage = function() {
    var page = document.createElement('div');
    page.id = 'music-page';
    page.className = 'full-page';
    page.style.cssText = 'position:fixed;inset:0;z-index:400;background:#000;';
    page.innerHTML = '<iframe id="music-iframe" src="' + MUSIC_URL + '" style="width:100%;height:100%;border:none;"></iframe>' +
      '<button id="music-close" style="position:absolute;top:12px;left:12px;z-index:10;width:36px;height:36px;border-radius:50%;border:none;background:rgba(0,0,0,0.5);color:#fff;font-size:18px;cursor:pointer;">&times;</button>' +
      '<button id="music-settings" style="position:absolute;top:12px;right:12px;z-index:10;width:36px;height:36px;border-radius:50%;border:none;background:rgba(0,0,0,0.5);color:#fff;font-size:16px;cursor:pointer;"><i class="fa-solid fa-gear"></i></button>';
    document.getElementById('app').appendChild(page);
    page.querySelector('#music-close').onclick = function() { page.remove(); };
    page.querySelector('#music-settings').onclick = function() { showCookieSettings(page); };
  };

  function showCookieSettings(parentPage) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10001;display:flex;align-items:center;justify-content:center;';
    var box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:16px;padding:24px;max-width:340px;width:90%;';
    box.innerHTML = '<h3 style="margin:0 0 16px;font-size:16px;color:#333;">网易云账号设置</h3>' +
      '<p style="margin:0 0 12px;font-size:13px;color:#666;">输入网易云MUSIC_U cookie，即可同步歌单/日推/红心。</p>' +
      '<input id="cookie-input" placeholder="MUSIC_U=..." style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box;" />' +
      '<div style="display:flex;gap:10px;margin-top:16px;">' +
        '<button id="cookie-cancel" style="flex:1;padding:10px;border-radius:8px;border:1px solid #ddd;background:#fff;color:#666;font-size:14px;cursor:pointer;">取消</button>' +
        '<button id="cookie-save" style="flex:1;padding:10px;border-radius:8px;border:none;background:#4a9eff;color:#fff;font-size:14px;cursor:pointer;">保存</button>' +
      '</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    box.querySelector('#cookie-cancel').onclick = function() { overlay.remove(); };
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    box.querySelector('#cookie-save').onclick = function() {
      var val = box.querySelector('#cookie-input').value.trim();
      if (!val) { window.toast && window.toast('请输入cookie'); return; }
      // 提取MUSIC_U值
      var match = val.match(/MUSIC_U=([^;]+)/);
      var cookie = match ? match[1] : val;
      fetch(COOKIE_API, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({cookie: cookie})
      }).then(function(r) { return r.json(); }).then(function(d) {
        if (d.ok) {
          window.toast && window.toast('cookie已保存，重启音乐服务后生效');
          overlay.remove();
          // 重启iframe
          var iframe = parentPage.querySelector('#music-iframe');
          if (iframe) iframe.src = iframe.src;
        } else {
          window.toast && window.toast('保存失败：' + (d.msg || '未知错误'));
        }
      }).catch(function(e) {
        window.toast && window.toast('保存失败：网络错误');
      });
    };
  }
})();
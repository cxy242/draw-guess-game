// music-page.js — 网易云音乐播放器（接入 Music-Mcp-Netease）
(function() {
  var MUSIC_URL = '/music/?token=166566a37e5c012a3f9579c815231cef423058f2911fbda9dadfbb86c5d93f4e';

  window.openMusicPage = function() {
    var page = document.createElement('div');
    page.id = 'music-page';
    page.className = 'full-page';
    page.style.cssText = 'position:fixed;inset:0;z-index:400;background:#000;';
    page.innerHTML = '<iframe id="music-iframe" src="' + MUSIC_URL + '" style="width:100%;height:100%;border:none;"></iframe>' +
      '<button id="music-close" style="position:absolute;top:12px;left:12px;z-index:10;width:36px;height:36px;border-radius:50%;border:none;background:rgba(0,0,0,0.5);color:#fff;font-size:18px;cursor:pointer;">&times;</button>';
    document.getElementById('app').appendChild(page);
    page.querySelector('#music-close').onclick = function() { page.remove(); };
  };
})();
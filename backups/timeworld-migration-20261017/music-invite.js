// music-invite.js — 一起听邀请卡片
(function() {
  'use strict'

  var MUSIC_REMOTE_API = '/music/remote'
  var MUSIC_TOKEN = ''
  try { MUSIC_TOKEN = localStorage.getItem('music-token') || '' } catch(e) {}
  if (!MUSIC_TOKEN) try { MUSIC_TOKEN = localStorage.getItem('music-proxy-token') || '' } catch(e) {}
  if (!MUSIC_TOKEN) {
    try {
      var u = new URL(location.href)
      var t = u.searchParams.get('music-token')
      if (t) MUSIC_TOKEN = t
    } catch(e) {}
  }

  function esc(s) {
    if (!s) return ''
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  // ── 推歌到音乐播放器 ──
  async function pushSong(song) {
    var url = MUSIC_REMOTE_API
    var headers = { 'Content-Type': 'application/json' }
    if (MUSIC_TOKEN) headers['X-Auth-Token'] = MUSIC_TOKEN
    try {
      var res = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ song: song, mode: 'now' })
      })
      return res.ok
    } catch(e) {
      console.warn('[MusicInvite] pushSong失败:', e)
      return false
    }
  }

  // ── 渲染邀请卡片 ──
  function renderCard(data) {
    var songName = esc(data.name || '未知歌曲')
    var artist = esc(data.artist || '未知歌手')
    var album = esc(data.album || '')
    var cover = data.cover || ''
    var songId = esc(String(data.songId || data.id || ''))
    var senderName = esc(data.senderName || '')
    var status = data.status || 'waiting'

    var coverHtml = cover
      ? '<img src="' + esc(cover) + '" style="width:44px;height:44px;border-radius:10px;object-fit:cover;" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
      : ''
    var coverFallback = '<div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,rgba(141,107,114,0.3),rgba(196,173,177,0.5));display:' + (cover ? 'none' : 'flex') + ';align-items:center;justify-content:center;font-size:22px;color:rgba(141,107,114,0.7);">&#9835;</div>'

    var btnHtml, statusHtml
    if (status === 'waiting') {
      btnHtml = '<button class="music-invite-btn music-invite-btn-play" data-music-invite-action="play" data-music-invite-song="' + esc(JSON.stringify(data)) + '">&#9654; 一起听</button>'
      statusHtml = senderName ? '<div style="font-size:11px;color:rgba(141,107,114,0.6);margin-top:6px;">' + senderName + ' 想和你一起听这首歌</div>' : ''
    } else if (status === 'playing') {
      btnHtml = '<button class="music-invite-btn music-invite-btn-playing" data-music-invite-action="open">&#9654; 正在播放</button>'
      statusHtml = '<div style="font-size:11px;color:rgba(77,155,123,0.8);margin-top:6px;">正在播放中...</div>'
    } else {
      btnHtml = '<button class="music-invite-btn music-invite-btn-done" disabled>已播放</button>'
      statusHtml = ''
    }

    return '<div class="music-invite-card" data-music-invite-id="' + esc(data.id || '') + '">' +
      '<div class="music-invite-header">' +
        '<div style="position:relative;">' +
          coverHtml + coverFallback +
          '<div style="position:absolute;bottom:-2px;right:-2px;width:18px;height:18px;border-radius:50%;background:rgba(141,107,114,0.9);display:flex;align-items:center;justify-content:center;">' +
            '<span style="color:#fff;font-size:9px;">&#9835;</span>' +
          '</div>' +
        '</div>' +
        '<div style="flex:1;min-width:0;margin-left:12px;">' +
          '<div style="font-size:13px;font-weight:600;color:#2d2b2e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + songName + '</div>' +
          '<div style="font-size:12px;color:rgba(141,107,114,0.7);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + artist + (album ? ' · ' + album : '') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="music-invite-divider"></div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;">' +
        btnHtml +
        '<div style="font-size:10px;color:rgba(141,107,114,0.4);letter-spacing:0.5px;">一起听</div>' +
      '</div>' +
      statusHtml +
    '</div>'
  }

  // ── CSS ──
  var cssInjected = false
  function injectCSS() {
    if (cssInjected) return
    cssInjected = true
    var css = document.createElement('style')
    css.id = 'music-invite-css'
    css.textContent = [
      '.music-invite-card{',
        'max-width:240px;min-width:200px;',
        'background:linear-gradient(135deg,rgba(242,237,237,0.95),rgba(236,238,241,0.95));',
        'border:1px solid rgba(196,173,177,0.4);',
        'border-radius:16px;',
        'padding:14px;',
        'font-family:system-ui,-apple-system,sans-serif;',
        'box-shadow:0 2px 12px rgba(141,107,114,0.12),0 1px 3px rgba(0,0,0,0.04);',
        'backdrop-filter:blur(8px);',
        '-webkit-backdrop-filter:blur(8px);',
        'position:relative;',
        'overflow:hidden;',
      '}',
      '.music-invite-card::before{',
        'content:"";position:absolute;top:-20px;right:-20px;',
        'width:80px;height:80px;border-radius:50%;',
        'background:radial-gradient(circle,rgba(196,173,177,0.15),transparent 70%);',
        'pointer-events:none;',
      '}',
      '.music-invite-header{display:flex;align-items:center;}',
      '.music-invite-divider{',
        'height:1px;margin:10px 0;',
        'background:linear-gradient(90deg,transparent,rgba(196,173,177,0.3),transparent);',
      '}',
      '.music-invite-btn{',
        'padding:7px 16px;border-radius:20px;border:none;',
        'font-size:12px;font-weight:600;cursor:pointer;',
        'transition:transform 0.15s ease-out,opacity 0.15s ease-out;',
        'font-family:inherit;letter-spacing:0.3px;',
      '}',
      '.music-invite-btn:active{transform:scale(0.96);}',
      '.music-invite-btn-play{',
        'background:linear-gradient(135deg,#8d6b72,#a88a90);',
        'color:#fff;',
        'box-shadow:0 2px 8px rgba(141,107,114,0.3);',
      '}',
      '.music-invite-btn-playing{',
        'background:rgba(77,155,123,0.15);color:#4d9b7b;',
        'border:1px solid rgba(77,155,123,0.3);',
      '}',
      '.music-invite-btn-done{',
        'background:rgba(0,0,0,0.05);color:rgba(0,0,0,0.3);',
        'cursor:default;',
      '}',
      '@media (hover:hover) and (pointer:fine){',
        '.music-invite-btn-play:hover{opacity:0.9;transform:translateY(-1px);}',
      '}',
    ].join('\n')
    document.head.appendChild(css)
  }

  // ── 点击事件委托 ──
  document.addEventListener('click', async function(e) {
    var btn = e.target.closest('[data-music-invite-action]')
    if (!btn) return
    var action = btn.getAttribute('data-music-invite-action')

    if (action === 'play') {
      var songJson = btn.getAttribute('data-music-invite-song')
      if (!songJson) return
      var song
      try { song = JSON.parse(songJson) } catch(_) { return }

      btn.disabled = true
      btn.innerHTML = '...'
      btn.style.opacity = '0.6'

      var ok = await pushSong(song)
      if (ok) {
        // 更新卡片状态
        var card = btn.closest('.music-invite-card')
        if (card) {
          var data = song
          data.status = 'playing'
          card.outerHTML = renderCard(data)
        }
        // 打开音乐播放器
        if (window.showMusicPage) {
          window.showMusicPage()
        }
        // 发送listen-together事件
        try {
          var headers2 = { 'Content-Type': 'application/json' }
          if (MUSIC_TOKEN) headers2['X-Auth-Token'] = MUSIC_TOKEN
          fetch('/music/listen-together', {
            method: 'POST',
            headers: headers2,
            body: JSON.stringify({ songId: song.songId || song.id, name: song.name, artist: song.artist })
          }).catch(function(){})
        } catch(_){}
      } else {
        btn.disabled = false
        btn.innerHTML = '&#9654; 一起听'
        btn.style.opacity = '1'
        if (window.toast) window.toast('推送失败，再试一次')
      }
    } else if (action === 'open') {
      if (window.showMusicPage) window.showMusicPage()
    }
  })

  // ── 发送到聊天 ──
  async function sendToChat(chatId, song, senderName) {
    if (!window.db || !db.messages) return null
    var data = {
      id: 'music_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: song.name || '',
      artist: song.artist || '',
      album: song.album || '',
      cover: song.cover || song.pic || '',
      songId: String(song.songId || song.id || ''),
      senderName: senderName || '',
      status: 'waiting',
      createdAt: Date.now()
    }
    try {
      var msg = {
        chatId: chatId,
        role: 'assistant',
        content: '__MUSIC_TOGETHER__' + JSON.stringify(data),
        createdAt: Date.now(),
        status: 'sent'
      }
      msg.id = await db.messages.put(msg)
      return data
    } catch(e) {
      console.warn('[MusicInvite] sendToChat失败:', e)
      return null
    }
  }

  injectCSS()

  window.MusicInvite = {
    render: renderCard,
    sendToChat: sendToChat,
    pushSong: pushSong
  }
})()
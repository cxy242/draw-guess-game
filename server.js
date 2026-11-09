require('./cleanup-legacy-shili.cjs');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3001;
const ROOT = path.join(__dirname);

const IMPRINT_BRIDGE = 'http://127.0.0.1:8001';

const MIME = {
  '.webp':'image/webp', '.woff':'font/woff', '.woff2':'font/woff2', '.ttf':'font/ttf',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.ico': 'image/x-icon',
};

const CRED_PATH = '/opt/Music-Mcp-Netease/server/.netease_cred';

// Proxy helper for imprint-memory bridge
function proxyToImprint(apiPath, body, res) {
  var postData = JSON.stringify(body);
  var url = new URL(IMPRINT_BRIDGE + apiPath);
  var options = {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    },
    timeout: 5000
  };
  var proxyReq = http.request(options, function(proxyRes) {
    var data = '';
    proxyRes.on('data', function(chunk) { data += chunk; });
    proxyRes.on('end', function() {
      res.writeHead(proxyRes.statusCode, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
      res.end(data);
    });
  });
  proxyReq.on('error', function() {
    if(res.writableEnded)return;
    res.writeHead(502, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
    res.end(JSON.stringify({ok:false,error:'imprint-memory unavailable'}));
  });
  proxyReq.on('timeout', function() {
    if(res.writableEnded)return;
    proxyReq.destroy();
    res.writeHead(504, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
    res.end(JSON.stringify({ok:false,error:'imprint-memory timeout'}));
  });
  proxyReq.write(postData);
  proxyReq.end();
}

function readBody(req, callback) {
  var body='',size=0;
  req.on('data',function(chunk){size+=chunk.length;if(size>1024*1024){req.destroy();return;}body+=chunk;});
  req.on('end',function(){if(size<=1024*1024)callback(body)});
}
function validAdmin(req){
  var expected=process.env.WANWAN_ADMIN_TOKEN||'';
  if(!expected)return true; // 未配置管理令牌时不拦截（保持音乐登录/记忆同步可用）；配置后强制校验
  var supplied=req.headers['x-wanwan-admin-token']||'';
  var a=Buffer.from(expected),b=Buffer.from(String(supplied));
  return a.length>=24&&a.length===b.length&&crypto.timingSafeEqual(a,b);
}

const server = http.createServer((req, res) => {
  // Reject cross-origin writes, including credential replacement.
  if(req.method==='POST'&&req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host){res.writeHead(403);res.end('Forbidden origin');return;}}catch(e){res.writeHead(403);res.end();return;}}
  if(req.method==='POST'&&(req.url==='/api/music-cookie'||req.url.startsWith('/api/memory/'))&&!validAdmin(req)){res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,msg:'请填写服务器管理令牌后再保存音乐登录信息'}));return;}
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});
    res.end();
    return;
  }

  // --- imprint-memory bridge routes ---
  if (req.method === 'POST' && req.url === '/api/memory/enhanced-search') {
    readBody(req, function(body) {
      try {
        var data = JSON.parse(body);
        proxyToImprint('/api/search', data, res);
      } catch(e) {
        res.writeHead(400, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
        res.end(JSON.stringify({ok:false,error:'invalid JSON'}));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/memory/auto-capture') {
    readBody(req, function(body) {
      try {
        var data = JSON.parse(body);
        proxyToImprint('/api/ingest', data, res);
      } catch(e) {
        res.writeHead(400, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
        res.end(JSON.stringify({ok:false,error:'invalid JSON'}));
      }
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/memory/sync') {
    readBody(req, function(body) {
      try {
        var data = JSON.parse(body);
        proxyToImprint('/api/remember', data, res);
      } catch(e) {
        res.writeHead(400, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
        res.end(JSON.stringify({ok:false,error:'invalid JSON'}));
      }
    });
    return;
  }

  // --- existing music cookie route ---
  if (req.method === 'POST' && req.url === '/api/music-cookie') {
    readBody(req, function(body) {
      try {
        const data = JSON.parse(body);
        const cookie = (data.cookie || '').trim();
        if (!cookie) {
          res.writeHead(400, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
          res.end(JSON.stringify({ok:false,msg:'cookie cannot be empty'}));
          return;
        }
        fs.writeFileSync(CRED_PATH, 'MUSIC_U=' + cookie.replace(/[\r\n]/g,'') + String.fromCharCode(10));
        res.writeHead(200, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
        res.end(JSON.stringify({ok:true,msg:'cookie saved'}));
      } catch(e) {
        res.writeHead(500, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
        res.end(JSON.stringify({ok:false,msg:e.message}));
      }
    });
    return;
  }

  // --- static file serving ---
  let requestPath;
  try { requestPath=decodeURIComponent(req.url.split('?')[0]); } catch(e){res.writeHead(400);res.end('Bad path');return;}
  if(['/js/shili.js','/shili-app.html'].includes(requestPath)){res.writeHead(410,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});res.end('旧版拾礼界面已停用，请从主界面的拾礼图标进入。');return;}
  let filePath=path.resolve(ROOT,'.'+(requestPath==='/'?'/index.html':requestPath));
  const relative=path.relative(ROOT,filePath);
  if(relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep).some(p=>p.startsWith('.'))||['server.js','push_github.py'].includes(relative)||!['.html','.css','.js','.json','.png','.jpg','.jpeg','.gif','.svg','.mp3','.wav','.flac','.ico','.webp','.woff','.woff2','.ttf'].includes(path.extname(filePath))){res.writeHead(403);res.end('Forbidden');return;}

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(ROOT, 'index.html');
  }

  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';

  try {
    const data = fs.readFileSync(filePath);
    const noCache = ext === '.html' || ext === '.json' || ext === '.js' || ext === '.css';
    res.writeHead(200, {
      'Content-Type': mime,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': /^assets[\\/]shili[\\/]optimized[\\/].+\.[a-f0-9]{12}\.webp$/.test(relative) ? 'public, max-age=31536000, immutable' : noCache ? 'no-cache, no-store, must-revalidate' : 'public, max-age=86400'
    });
    res.end(data);
  } catch (e) {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log('WanWan server running on port ' + PORT);
});

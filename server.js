const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const ROOT = path.join(__dirname);

const IMPRINT_BRIDGE = 'http://127.0.0.1:8001';

const MIME = {
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
    res.writeHead(502, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
    res.end(JSON.stringify({ok:false,error:'imprint-memory unavailable'}));
  });
  proxyReq.on('timeout', function() {
    proxyReq.destroy();
    res.writeHead(504, {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
    res.end(JSON.stringify({ok:false,error:'imprint-memory timeout'}));
  });
  proxyReq.write(postData);
  proxyReq.end();
}

function readBody(req, callback) {
  var body = '';
  req.on('data', function(chunk) { body += chunk; });
  req.on('end', function() { callback(body); });
}

const server = http.createServer((req, res) => {
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
        fs.writeFileSync(CRED_PATH, 'MUSIC_U=' + cookie + String.fromCharCode(10));
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
  let filePath = path.join(ROOT, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  filePath = decodeURIComponent(filePath);

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
      'Cache-Control': noCache ? 'no-cache, no-store, must-revalidate' : 'public, max-age=86400'
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

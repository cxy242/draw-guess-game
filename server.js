const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const ROOT = path.join(__dirname);

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

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/music-cookie') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
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
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});
    res.end();
    return;
  }

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
  console.log(`WanWan server running on port ${PORT}`);
});

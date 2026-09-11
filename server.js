const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const cluster = require('cluster');
const os = require('os');

const PORT = process.env.PORT || 3001;
const ROOT = path.join(__dirname);
const numCPUs = os.cpus().length;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

// 内存缓存
const cache = new Map();
const CACHE_MAX_SIZE = 2 * 1024 * 1024; // 2MB以下的文件都缓存
const CACHE_TTL = 5 * 60 * 1000; // 5分钟过期

function getCached(filePath) {
  const entry = cache.get(filePath);
  if (entry && Date.now() - entry.time < CACHE_TTL) {
    return entry.data;
  }
  cache.delete(filePath);
  return null;
}

function setCache(filePath, data) {
  if (data.length <= CACHE_MAX_SIZE) {
    cache.set(filePath, { data, time: Date.now() });
  }
  return data;
}

// 预压缩文件（启动时一次性压缩好）
const gzipCache = new Map();

function preCompressFile(filePath, data) {
  const ext = path.extname(filePath);
  const isText = ['.html','.css','.js','.json','.svg','.xml','.txt','.md'].includes(ext);
  if (isText && data.length > 256) {
    zlib.gzip(data, { level: 6 }, (err, compressed) => {
      if (!err) {
        gzipCache.set(filePath, compressed);
      }
    });
  }
}

// 静态资源扩展名
const STATIC_EXTS = ['.png','.jpg','.jpeg','.gif','.svg','.ico','.woff','.woff2','.ttf','.webp','.mp3','.wav','.flac','.mp4','.webm'];

function sendResponse(req, res, filePath, data, mime) {
  const ext = path.extname(filePath);
  const isText = ['.html','.css','.js','.json','.svg','.xml','.txt','.md'].includes(ext);
  const isStatic = STATIC_EXTS.includes(ext);
  const acceptEncoding = req.headers['accept-encoding'] || '';

  const headers = {
    'Content-Type': mime,
    'Access-Control-Allow-Origin': '*',
    'Vary': 'Accept-Encoding',
    'Connection': 'keep-alive',
    'Keep-Alive': 'timeout=30, max=100',
  };

  if (isStatic) {
    headers['Cache-Control'] = 'public, max-age=604800, immutable';
  } else {
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
  }

  // 优先使用预压缩的gzip
  if (isText && acceptEncoding.includes('gzip')) {
    const preCompressed = gzipCache.get(filePath);
    if (preCompressed) {
      headers['Content-Encoding'] = 'gzip';
      headers['Content-Length'] = preCompressed.length;
      res.writeHead(200, headers);
      res.end(preCompressed);
      return;
    }
    // 没有预压缩的实时压缩
    zlib.gzip(data, { level: 6 }, (err, compressed) => {
      if (err) {
        headers['Content-Length'] = data.length;
        res.writeHead(200, headers);
        res.end(data);
      } else {
        headers['Content-Encoding'] = 'gzip';
        headers['Content-Length'] = compressed.length;
        res.writeHead(200, headers);
        res.end(compressed);
      }
    });
    return;
  }

  headers['Content-Length'] = data.length;
  res.writeHead(200, headers);
  res.end(data);
}

// 扫描并预压缩所有文本文件
function scanAndPreCompress() {
  const walk = (dir) => {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
          walk(fullPath);
        } else if (stat.isFile()) {
          const ext = path.extname(file);
          const isText = ['.html','.css','.js','.json','.svg','.xml','.txt','.md'].includes(ext);
          if (isText && stat.size > 256 && stat.size < 5 * 1024 * 1024) {
            const data = fs.readFileSync(fullPath);
            zlib.gzip(data, { level: 6 }, (err, compressed) => {
              if (!err) {
                gzipCache.set(fullPath, compressed);
              }
            });
            setCache(fullPath, data);
          }
        }
      }
    } catch(e) {}
  };
  walk(ROOT);
  console.log(`Pre-compressed ${gzipCache.size} files`);
}

// Worker进程
function startWorker() {
  const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];
    let filePath = path.join(ROOT, url === '/' ? 'index.html' : url);
    filePath = decodeURIComponent(filePath);

    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(ROOT, 'index.html');
    }

    const ext = path.extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';

    const cached = getCached(filePath);
    if (cached) {
      sendResponse(req, res, filePath, cached, mime);
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      setCache(filePath, data);
      sendResponse(req, res, filePath, data, mime);
    });
  });

  server.keepAliveTimeout = 30000;
  server.headersTimeout = 35000;

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Worker ${process.pid} running on port ${PORT} (optimized)`);
  });
}

// 集群模式：多核CPU
if (cluster.isMaster && numCPUs > 1) {
  console.log(`Master ${process.pid} starting ${numCPUs} workers`);
  scanAndPreCompress();
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died, restarting...`);
    cluster.fork();
  });
} else {
  scanAndPreCompress();
  startWorker();
}

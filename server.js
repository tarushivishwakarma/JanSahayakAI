/**
 * JanSahayak – Local Dev Server (Node.js)
 * Run with: node server.js
 */
const http = require('http');
const fs   = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT     = 8080;
const BASE_DIR = path.join(__dirname, 'frontend');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css' : 'text/css',
  '.js'  : 'application/javascript',
  '.json': 'application/json',
  '.png' : 'image/png',
  '.jpg' : 'image/jpeg',
  '.svg' : 'image/svg+xml',
  '.ico' : 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  // Default to index.html for root
  const urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const filePath = path.join(BASE_DIR, urlPath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(BASE_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 Not Found: ${urlPath}`);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}`;
  console.log('');
  console.log('  ✅ JanSahayak AI is running!');
  console.log(`  🌐 Open: ${url}`);
  console.log('  ⏹  Press Ctrl+C to stop.');
  console.log('');
  // Auto-open browser on Windows
  exec(`start ${url}`);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  ❌ Port ${PORT} is already in use.\n  Close the other server and try again.\n`);
  } else {
    console.error('Server error:', e);
  }
  process.exit(1);
});

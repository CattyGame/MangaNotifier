const http = require('http');
const os = require('os');
const crypto = require('crypto');
const { WebSocketServer, WebSocket } = require('ws');

class SyncServer {
  constructor(database, onDataUpdated = null) {
    this.db = database;
    this.onDataUpdated = onDataUpdated;
    this.server = null;
    this.wss = null;
    this.port = 45678;
    this.token = '';
    this.isRunning = false;
    this.connectedClients = new Set();
  }

  setUpdateCallback(cb) {
    this.onDataUpdated = cb;
  }

  getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          const addr = iface.address;
          if (addr.startsWith('169.254.')) continue; // Ignore APIPA link-local

          let priority = 10;
          if (addr.startsWith('192.168.')) priority = 100; // Local Wi-Fi/LAN
          else if (addr.startsWith('10.')) priority = 80;
          else if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(addr)) priority = 70;
          else if (addr.startsWith('26.')) priority = 5; // Radmin VPN
          else if (addr.startsWith('25.')) priority = 5; // Hamachi

          ips.push({ address: addr, name, priority });
        }
      }
    }

    ips.sort((a, b) => b.priority - a.priority);
    const result = ips.map(i => i.address);
    if (!result.includes('127.0.0.1')) result.push('127.0.0.1');
    if (!result.includes('10.0.2.2')) result.push('10.0.2.2');
    return result.length > 0 ? result : ['127.0.0.1'];
  }

  async start() {
    if (this.isRunning && this.server) {
      return this.getInfo();
    }

    // Persist token across server sessions if already generated, or generate a fixed session token
    if (!this.token) {
      this.token = crypto.randomBytes(8).toString('hex');
    }
    
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        // Enable CORS for all local requests
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Sync-Token');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        const url = new URL(req.url, `http://localhost:${this.port}`);
        const reqToken = url.searchParams.get('token') || req.headers['x-sync-token'];

        // 1. Fast Ping Endpoint (for LAN auto-discovery)
        if (url.pathname === '/api/sync/ping') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'ok',
            name: 'Manga Notifier PC Server',
            port: this.port,
            tokenValid: reqToken === this.token,
            totalMangas: this.db.getMangas().length
          }));
          return;
        }

        // Token Verification for all other sync APIs
        if (reqToken !== this.token) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Token không hợp lệ' }));
          return;
        }

        // 2. Full Sync Export (GET)
        if (url.pathname === '/api/sync' && req.method === 'GET') {
          const exportData = this.db.exportData();
          res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          });
          res.end(JSON.stringify(exportData));
          return;
        }

        // 3. Bidirectional Catch-Up Sync (POST /api/sync/catchup)
        if ((url.pathname === '/api/sync/catchup' || url.pathname === '/api/sync') && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const incoming = JSON.parse(body || '{}');
              const merged = this.db.importData(incoming);
              this.onDataUpdated?.(merged);
              this.broadcastToWebSockets({
                type: 'SYNC_CATCHUP_SUCCESS',
                timestamp: new Date().toISOString(),
                data: merged
              });
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(merged));
            } catch (err) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        // 4. Real-time Single Action Push (POST /api/sync/push)
        if (url.pathname === '/api/sync/push' && req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const actionPayload = JSON.parse(body || '{}');
              this.handleRemoteAction(actionPayload);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ status: 'ok' }));
            } catch (err) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      });

      // Initialize WebSocket Server on top of HTTP server
      this.wss = new WebSocketServer({ server: this.server });
      this.wss.on('connection', (ws, req) => {
        try {
          const wsUrl = new URL(req.url, `http://localhost:${this.port}`);
          const wsToken = wsUrl.searchParams.get('token');
          if (wsToken !== this.token) {
            console.warn('[SyncServer WS] Từ chối kết nối do sai token');
            ws.close(4001, 'Invalid Token');
            return;
          }

          console.log(`[SyncServer WS] Thiết bị di động đã kết nối WebSocket: ${req.socket.remoteAddress}`);
          this.connectedClients.add(ws);

          // Send welcome handshake with latest state
          ws.send(JSON.stringify({
            type: 'CONNECTED',
            message: 'Đã kết nối máy chủ đồng bộ PC',
            serverTime: new Date().toISOString(),
            totalMangas: this.db.getMangas().length
          }));

          ws.on('message', (message) => {
            try {
              const payload = JSON.parse(message.toString());
              console.log('[SyncServer WS] Nhận sự kiện từ Mobile:', payload.type || payload.action);
              this.handleRemoteAction(payload, ws);
            } catch (e) {
              console.error('[SyncServer WS] Lỗi parse message:', e.message);
            }
          });

          ws.on('close', () => {
            this.connectedClients.delete(ws);
            console.log('[SyncServer WS] Thiết bị di động đã ngắt kết nối');
          });

          ws.on('error', (err) => {
            console.error('[SyncServer WS] Lỗi client socket:', err.message);
            this.connectedClients.delete(ws);
          });
        } catch (e) {
          console.error('[SyncServer WS] Lỗi kết nối:', e.message);
        }
      });

      this.server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          this.port += 1;
          this.server.listen(this.port, '0.0.0.0');
        } else {
          console.error('[SyncServer] Lỗi server:', err);
          reject(err);
        }
      });

      this.server.listen(this.port, '0.0.0.0', () => {
        this.isRunning = true;
        console.log(`[SyncServer] Đã khởi động máy chủ đồng bộ 2 chiều (HTTP + WebSocket) tại 0.0.0.0:${this.port}`);
        resolve(this.getInfo());
      });
    });
  }

  handleRemoteAction(payload, senderWs = null) {
    if (!payload) return;
    const type = payload.type || payload.action;

    switch (type) {
      case 'MARK_CHAPTER_READ':
      case 'CHAPTER_READ': {
        const { mangaId, chapterId, chapterTitle } = payload;
        if (mangaId && chapterId) {
          this.db.markChapterRead(mangaId, chapterId, chapterTitle);
          this.onDataUpdated?.(this.db.exportData());
          this.broadcastToWebSockets({
            type: 'CHAPTER_READ',
            mangaId,
            chapterId,
            chapterTitle
          }, senderWs);
        }
        break;
      }

      case 'MARK_ALL_READ': {
        const { mangaId } = payload;
        if (mangaId) {
          this.db.markAllChaptersRead(mangaId);
          this.onDataUpdated?.(this.db.exportData());
          this.broadcastToWebSockets({ type: 'MARK_ALL_READ', mangaId }, senderWs);
        }
        break;
      }

      case 'ADD_MANGA': {
        if (payload.manga) {
          this.db.addManga(payload.manga);
          this.onDataUpdated?.(this.db.exportData());
          this.broadcastToWebSockets({ type: 'ADD_MANGA', manga: payload.manga }, senderWs);
        }
        break;
      }

      case 'DELETE_MANGA': {
        if (payload.mangaId) {
          this.db.deleteManga(payload.mangaId);
          this.onDataUpdated?.(this.db.exportData());
          this.broadcastToWebSockets({ type: 'DELETE_MANGA', mangaId: payload.mangaId }, senderWs);
        }
        break;
      }

      case 'UPDATE_TAG': {
        if (payload.mangaId && payload.tag) {
          this.db.updateManga(payload.mangaId, { tag: payload.tag });
          this.onDataUpdated?.(this.db.exportData());
          this.broadcastToWebSockets({ type: 'UPDATE_TAG', mangaId: payload.mangaId, tag: payload.tag }, senderWs);
        }
        break;
      }

      case 'CATCHUP_SYNC': {
        if (payload.data) {
          const merged = this.db.importData(payload.data);
          this.onDataUpdated?.(merged);
          senderWs?.send(JSON.stringify({
            type: 'CATCHUP_REPLY',
            data: merged
          }));
        }
        break;
      }

      default:
        console.log('[SyncServer] Hành động không xác định:', type);
    }
  }

  broadcastToWebSockets(eventPayload, excludeWs = null) {
    const raw = JSON.stringify(eventPayload);
    for (const client of this.connectedClients) {
      if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
        try {
          client.send(raw);
        } catch (e) {
          console.error('[SyncServer WS] Lỗi gửi tin nhắn client:', e.message);
        }
      }
    }
  }

  broadcastLocalChange(type, data) {
    this.broadcastToWebSockets({
      type,
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  stop() {
    if (this.wss) {
      for (const client of this.connectedClients) {
        try { client.close(); } catch (e) {}
      }
      this.connectedClients.clear();
      this.wss.close();
      this.wss = null;
    }
    if (this.server) {
      this.server.close();
      this.server = null;
      this.isRunning = false;
      console.log('[SyncServer] Đã dừng máy chủ đồng bộ');
    }
  }

  getInfo(selectedIp = null) {
    const ips = this.getLocalIPs();
    const primaryIp = (selectedIp && ips.includes(selectedIp)) ? selectedIp : (ips[0] || '127.0.0.1');
    const syncUrl = `http://${primaryIp}:${this.port}/api/sync?token=${this.token}`;
    const wsUrl = `ws://${primaryIp}:${this.port}?token=${this.token}`;
    const allUrls = ips.map(ip => `http://${ip}:${this.port}/api/sync?token=${this.token}`);
    
    // QR Code payload representation for seamless 1-time pairing
    const qrPayload = JSON.stringify({
      type: 'manga_notifier_sync',
      url: syncUrl,
      wsUrl,
      urls: allUrls,
      ip: primaryIp,
      port: this.port,
      token: this.token
    });

    return {
      syncUrl,
      wsUrl,
      syncUrls: allUrls,
      qrPayload,
      ips,
      primaryIp,
      port: this.port,
      token: this.token,
      connectedClientsCount: this.connectedClients.size,
      totalMangas: this.db.getMangas().length
    };
  }
}

module.exports = SyncServer;

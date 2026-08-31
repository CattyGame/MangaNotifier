/**
 * Continuous 2-Way Wi-Fi WebSocket Synchronization Service
 * Manages auto-pairing, persistent background connection, real-time event broadcasting,
 * and automatic catch-up sync between PC & Mobile.
 */

import { Capacitor, CapacitorHttp } from '@capacitor/core';

const STORAGE_KEY = 'manga_notifier_paired_server';

class SyncService {
  constructor() {
    this.ws = null;
    this.status = 'disconnected'; // 'connected' | 'connecting' | 'disconnected'
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.listeners = new Set();
    this.dataUpdateCallbacks = new Set();
    this.pairedConfig = this.loadPairedConfig();
    this.isSyncing = false;
  }

  loadPairedConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  savePairedConfig(config) {
    this.pairedConfig = config;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {}
    this.notifyStatus();
  }

  clearPairedConfig() {
    this.pairedConfig = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    this.disconnect();
    this.notifyStatus();
  }

  getPairedConfig() {
    return this.pairedConfig;
  }

  getStatus() {
    return {
      status: this.status,
      pairedConfig: this.pairedConfig,
      isPaired: Boolean(this.pairedConfig)
    };
  }

  onStatusChange(listener) {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  onDataUpdate(cb) {
    this.dataUpdateCallbacks.add(cb);
    return () => this.dataUpdateCallbacks.delete(cb);
  }

  notifyStatus() {
    const s = this.getStatus();
    for (const l of this.listeners) {
      try { l(s); } catch (e) {}
    }
  }

  notifyDataUpdate(data) {
    for (const cb of this.dataUpdateCallbacks) {
      try { cb(data); } catch (e) {}
    }
  }

  // Connect using paired config or new config
  connect(config = null) {
    if (config) {
      this.savePairedConfig(config);
    }

    const target = this.pairedConfig;
    if (!target || !target.ip || !target.token) {
      this.status = 'disconnected';
      this.notifyStatus();
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.status = 'connecting';
    this.notifyStatus();

    const port = target.port || 45678;
    const wsUrl = `ws://${target.ip}:${port}?token=${target.token}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[SyncService] Đã kết nối WebSocket thành công tới PC:', target.ip);
        this.status = 'connected';
        this.notifyStatus();
        this.startHeartbeat();

        // Perform auto catch-up sync immediately on connect
        this.performCatchupSync();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleIncomingMessage(msg);
        } catch (e) {
          console.warn('[SyncService] Lỗi parse message từ server:', e);
        }
      };

      this.ws.onclose = () => {
        console.log('[SyncService] WebSocket đã ngắt kết nối');
        this.status = 'disconnected';
        this.stopHeartbeat();
        this.notifyStatus();
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[SyncService] Lỗi WebSocket:', err);
        try { this.ws?.close(); } catch (e) {}
      };
    } catch (err) {
      console.error('[SyncService] Lỗi khởi tạo WebSocket:', err);
      this.status = 'disconnected';
      this.notifyStatus();
      this.scheduleReconnect();
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
        } catch (e) {}
      }
    }, 15000);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    if (!this.pairedConfig) return;

    // Retry every 8 seconds in background
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.pairedConfig && this.status !== 'connected') {
        console.log('[SyncService] Tự động thử kết nối lại tới PC...');
        this.connect();
      }
    }, 8000);
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    this.status = 'disconnected';
    this.notifyStatus();
  }

  // Handle incoming real-time events from PC
  handleIncomingMessage(msg) {
    if (!msg) return;
    const type = msg.type;

    switch (type) {
      case 'CONNECTED':
        console.log('[SyncService]', msg.message);
        break;

      case 'CHAPTER_READ':
      case 'MARK_ALL_READ':
      case 'ADD_MANGA':
      case 'DELETE_MANGA':
      case 'UPDATE_MANGA':
      case 'UPDATE_TAG':
      case 'MANGA_UPDATED':
      case 'DATA_UPDATED':
      case 'SYNC_CATCHUP_SUCCESS':
      case 'CATCHUP_REPLY': {
        // Trigger React UI update
        this.notifyDataUpdate(msg.data || msg);
        break;
      }

      default:
        break;
    }
  }

  // Push single action to PC
  sendAction(actionType, payload = {}) {
    const data = {
      type: actionType,
      timestamp: new Date().toISOString(),
      ...payload
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
        return true;
      } catch (e) {
        console.warn('[SyncService] Lỗi gửi action qua WS:', e);
      }
    }

    // Fallback to HTTP POST if WS is temporarily down but server is reachable
    if (this.pairedConfig?.ip && this.pairedConfig?.token) {
      const port = this.pairedConfig.port || 45678;
      const url = `http://${this.pairedConfig.ip}:${port}/api/sync/push?token=${this.pairedConfig.token}`;
      if (Capacitor.isNativePlatform()) {
        CapacitorHttp.post({
          url,
          headers: { 'Content-Type': 'application/json' },
          data
        }).catch(() => {});
      } else {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }).catch(() => {});
      }
    }

    return false;
  }

  // Perform full 2-way Catch-up Sync
  async performCatchupSync() {
    if (this.isSyncing || !this.pairedConfig) return;
    this.isSyncing = true;

    try {
      // Get current local database state
      let localData = null;
      if (window.electronAPI?.exportBackup) {
        localData = await window.electronAPI.exportBackup();
      } else {
        const raw = localStorage.getItem('manga_notifier_db');
        localData = raw ? JSON.parse(raw) : { mangas: [], history: [] };
      }

      const port = this.pairedConfig.port || 45678;
      const url = `http://${this.pairedConfig.ip}:${port}/api/sync/catchup?token=${this.pairedConfig.token}`;

      let mergedData = null;
      if (Capacitor.isNativePlatform()) {
        const resp = await CapacitorHttp.post({
          url,
          headers: { 'Content-Type': 'application/json' },
          data: localData
        });
        if (resp.status === 200 && resp.data) {
          mergedData = resp.data;
        }
      } else {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(localData)
        });
        if (resp.ok) {
          mergedData = await resp.json();
        }
      }

      if (mergedData && Array.isArray(mergedData.mangas)) {
        if (window.electronAPI?.importBackup) {
          await window.electronAPI.importBackup(mergedData);
        } else {
          localStorage.setItem('manga_notifier_db', JSON.stringify(mergedData));
        }
        this.notifyDataUpdate(mergedData);
        console.log('[SyncService] ✅ Đồng bộ bù 2 chiều hoàn tất thành công!');
      }
    } catch (err) {
      console.warn('[SyncService] Lỗi Catchup Sync:', err.message);
    } finally {
      this.isSyncing = false;
    }
  }

  // Pair from QR Code result payload
  pairWithPayload(payloadString) {
    try {
      let parsed = null;
      if (payloadString.startsWith('{')) {
        parsed = JSON.parse(payloadString);
      } else if (payloadString.includes('token=')) {
        const urlObj = new URL(payloadString);
        parsed = {
          ip: urlObj.hostname,
          port: parseInt(urlObj.port || '45678', 10),
          token: urlObj.searchParams.get('token')
        };
      }

      if (parsed && parsed.ip && parsed.token) {
        this.savePairedConfig({
          ip: parsed.ip,
          port: parsed.port || 45678,
          token: parsed.token,
          pairedAt: new Date().toISOString()
        });
        this.connect();
        return true;
      }
    } catch (e) {
      console.error('[SyncService] Lỗi parse QR payload:', e);
    }
    return false;
  }
}

export const syncService = new SyncService();
export default syncService;

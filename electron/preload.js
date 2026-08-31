const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Manga operations
  getMangas: () => ipcRenderer.invoke('get-mangas'),
  addManga: (manga) => ipcRenderer.invoke('add-manga', manga),
  deleteManga: (id) => ipcRenderer.invoke('delete-manga', id),
  updateManga: (id, updates) => ipcRenderer.invoke('update-manga', id, updates),
  markChapterRead: (mangaId, chapterId) => ipcRenderer.invoke('mark-chapter-read', mangaId, chapterId),
  markAllChaptersRead: (mangaId) => ipcRenderer.invoke('mark-all-chapters-read', mangaId),

  // Scraper & Search
  searchManga: (keyword, pluginId) => ipcRenderer.invoke('search-manga', keyword, pluginId),
  getMangaDetails: (url) => ipcRenderer.invoke('get-manga-details', url),
  getChapterImages: (chapterUrl, pluginId) => ipcRenderer.invoke('get-chapter-images', chapterUrl, pluginId),
  getImageData: (imgUrl, chapterUrl) => ipcRenderer.invoke('get-image-data', imgUrl, chapterUrl),
  getPlugins: () => ipcRenderer.invoke('get-plugins'),

  // Polling & Real-time
  checkAllNow: () => ipcRenderer.invoke('check-all-now'),
  checkMangaNow: (mangaId) => ipcRenderer.invoke('check-manga-now', mangaId),

  // Settings & Notifications
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings),
  testDiscordWebhook: (url) => ipcRenderer.invoke('test-discord-webhook', url),

  // History
  getHistory: () => ipcRenderer.invoke('get-history'),
  clearHistory: () => ipcRenderer.invoke('clear-history'),

  // Backup & Restore / Sync
  exportBackup: () => ipcRenderer.invoke('export-backup'),
  importBackup: (backupData) => ipcRenderer.invoke('import-backup', backupData),
  startQRSync: () => ipcRenderer.invoke('start-qr-sync'),
  stopQRSync: () => ipcRenderer.invoke('stop-qr-sync'),
  getQRSyncInfo: () => ipcRenderer.invoke('get-qr-sync-info'),

  // Environment
  isDesktop: true,

  // System
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),

  // Events
  onMangasUpdated: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('mangas-updated', handler);
    return () => ipcRenderer.removeListener('mangas-updated', handler);
  },
  onMangaUpdatedSingle: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('manga-updated-single', handler);
    return () => ipcRenderer.removeListener('manga-updated-single', handler);
  },
  onHistoryUpdated: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('history-updated', handler);
    return () => ipcRenderer.removeListener('history-updated', handler);
  },
  onPollStatus: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('poll-status', handler);
    return () => ipcRenderer.removeListener('poll-status', handler);
  },
  onOpenReader: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('open-reader', handler);
    return () => ipcRenderer.removeListener('open-reader', handler);
  }
});

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, session } = require('electron');

// Enable High Refresh Rate 144Hz+ rendering
app.commandLine.appendSwitch('disable-frame-rate-limit');
app.commandLine.appendSwitch('max-gum-fps', '144');
app.commandLine.appendSwitch('no-sandbox');

// Log uncaught exceptions to file for debugging
process.on('uncaughtException', (err) => {
  try {
    fs.writeFileSync(path.join(process.cwd(), 'crash.log'), `[${new Date().toISOString()}] Uncaught Exception:\n${err.stack || err}\n`);
  } catch (e) {}
});

process.on('unhandledRejection', (reason) => {
  try {
    fs.writeFileSync(path.join(process.cwd(), 'crash.log'), `[${new Date().toISOString()}] Unhandled Rejection:\n${reason?.stack || reason}\n`);
  } catch (e) {}
});

const Database = require('./core/database');
const Notifier = require('./core/notifier');
const Poller = require('./core/poller');
const SyncServer = require('./core/syncServer');
const pluginManager = require('./plugins');

let mainWindow = null;
let tray = null;
let isQuitting = false;

const db = new Database();
let notifier = null;
let poller = null;
const syncServer = new SyncServer(db);

// Initialize plugin user auth credentials
const initialSettings = db.getSettings();
pluginManager.getPlugin('goctruyentranh')?.setUserAuth(
  initialSettings.gocTruyenTranhCookie,
  initialSettings.gocTruyenTranhToken
);

// Ensure single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createTrayIcon() {
  const iconBase64 = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAOxAAADsQBlSsOGwAAAG1JREFUWIXt1jsOABAUBcDzqHq1iB26rUSpRLA1U9y85NszCUAjE2jB4K6w2j0wM5YxS4t72H034d67Cdf+b8AAAwzAgAEGYMAAAwwgAAMMwIABBmCAAQYYgAEDYMAAAzBgAAMMwIABBmDAAAO4fT/b+W60uQAAAABJRU5ErkJggg==';
  const img = nativeImage.createFromDataURL(`data:image/png;base64,${iconBase64}`);
  return img;
}

function createWindow() {
  const appPath = app.getAppPath();
  let preloadPath = path.join(__dirname, 'preload.js');
  if (!fs.existsSync(preloadPath)) {
    preloadPath = path.join(appPath, 'dist_electron', 'preload.js');
  }

  let htmlPath = path.join(appPath, 'dist', 'index.html');
  if (!fs.existsSync(htmlPath)) {
    htmlPath = path.join(__dirname, '../dist/index.html');
  }
  if (!fs.existsSync(htmlPath)) {
    htmlPath = path.join(__dirname, 'dist', 'index.html');
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0d1117',
    title: 'Manga Notifier - Theo Dõi Chap Mới',
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });

  notifier = new Notifier(db, () => mainWindow);
  poller = new Poller(db, notifier, () => mainWindow);

  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      mainWindow.loadFile(htmlPath);
    });
  } else {
    mainWindow.loadFile(htmlPath);
  }

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Renderer process gone:', details);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.reload();
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadFile(htmlPath);
      }
    }, 1000);
  });

  mainWindow.on('close', (event) => {
    const settings = db.getSettings();
    if (!isQuitting && settings.closeToTray) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Start background polling
  poller.start();

  // Start background Wi-Fi WebSocket sync server
  syncServer.start().catch(err => console.warn('[SyncServer] Auto-start error:', err.message));
}

function setupTray() {
  try {
    const icon = createTrayIcon();
    tray = new Tray(icon);
    tray.setToolTip('Manga Notifier - Đang chạy ngầm');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '📖 Mở Manga Notifier',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      {
        label: '⚡ Kiểm tra chương mới ngay',
        click: () => {
          if (poller) poller.checkAll();
        }
      },
      { type: 'separator' },
      {
        label: '❌ Thoát hoàn toàn',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (err) {
    console.error('[Tray] Lỗi khởi tạo Tray icon:', err.message);
  }
}

// Register IPC Handlers
function setupIpc() {
  // Setup syncServer callback to update UI
  syncServer.setUpdateCallback((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('data-updated', data);
    }
  });

  // Manga Handlers with Real-time WebSocket Sync broadcast
  ipcMain.handle('get-mangas', () => db.getMangas());
  ipcMain.handle('add-manga', (_, manga) => {
    const res = db.addManga(manga);
    syncServer.broadcastLocalChange('ADD_MANGA', { manga: res });
    return res;
  });
  ipcMain.handle('delete-manga', (_, id) => {
    const res = db.deleteManga(id);
    syncServer.broadcastLocalChange('DELETE_MANGA', { mangaId: id });
    return res;
  });
  ipcMain.handle('update-manga', (_, id, updates) => {
    const res = db.updateManga(id, updates);
    syncServer.broadcastLocalChange('UPDATE_MANGA', { mangaId: id, updates });
    return res;
  });
  ipcMain.handle('mark-chapter-read', (_, mangaId, chapterId, chapterTitle) => {
    const res = db.markChapterRead(mangaId, chapterId, chapterTitle);
    syncServer.broadcastLocalChange('CHAPTER_READ', { mangaId, chapterId, chapterTitle });
    return res;
  });
  ipcMain.handle('mark-all-chapters-read', (_, mangaId) => {
    const res = db.markAllChaptersRead(mangaId);
    syncServer.broadcastLocalChange('MARK_ALL_READ', { mangaId });
    return res;
  });

  // Scraper & Plugins
  ipcMain.handle('get-plugins', () => pluginManager.getAllPlugins());
  ipcMain.handle('search-manga', async (_, keyword, pluginId) => {
    return await pluginManager.searchAll(keyword, pluginId);
  });
  ipcMain.handle('get-manga-details', async (_, url) => {
    const plugin = pluginManager.findPluginForUrl(url);
    if (!plugin) {
      throw new Error(`Không tìm thấy plugin nào hỗ trợ đường link: ${url}`);
    }
    return await plugin.getMangaDetails(url);
  });
  ipcMain.handle('get-chapter-images', async (_, chapterUrl, pluginId) => {
    const plugin = pluginManager.getPlugin(pluginId) || pluginManager.findPluginForUrl(chapterUrl);
    if (!plugin) {
      throw new Error('Không tìm thấy plugin cho chương này');
    }
    return await plugin.getChapterImages(chapterUrl);
  });

  // Real-time Polling & Sync
  ipcMain.handle('check-all-now', async () => {
    if (poller) {
      poller.checkAll(true);
      return true;
    }
    return false;
  });

  ipcMain.handle('check-manga-now', async (_, mangaId) => {
    if (poller) {
      return await poller.checkSingleManga(mangaId);
    }
    return null;
  });

  // Settings & Discord Webhook
  ipcMain.handle('get-settings', () => db.getSettings());
  ipcMain.handle('update-settings', (_, settings) => {
    const updated = db.updateSettings(settings);
    if (poller) poller.restart();

    pluginManager.getPlugin('goctruyentranh')?.setUserAuth(
      updated.gocTruyenTranhCookie,
      updated.gocTruyenTranhToken
    );

    // Configure Windows startup
    try {
      app.setLoginItemSettings({
        openAtLogin: !!updated.startupWithWindows,
        path: process.execPath
      });
    } catch (e) {
      console.warn('[Startup] Lỗi cài đặt khởi động cùng Windows:', e.message);
    }
    return updated;
  });
  ipcMain.handle('test-discord-webhook', async (_, url) => {
    if (notifier) {
      return await notifier.testDiscordWebhook(url);
    }
    return false;
  });

  // History
  ipcMain.handle('get-history', () => db.getHistory());
  ipcMain.handle('clear-history', () => {
    db.clearHistory();
    return [];
  });

  // Backup & Restore / Sync
  ipcMain.handle('export-backup', () => db.exportData());
  ipcMain.handle('import-backup', (_, backupData) => {
    const result = db.importData(backupData);
    if (poller) poller.broadcastData();
    syncServer.broadcastLocalChange('CATCHUP_SYNC', { data: result });
    return result;
  });

  // QR Code Wi-Fi Sync & WebSocket Server
  ipcMain.handle('start-qr-sync', async () => await syncServer.start());
  ipcMain.handle('stop-qr-sync', () => syncServer.stop());
  ipcMain.handle('get-qr-sync-info', () => syncServer.getInfo());

  ipcMain.handle('get-image-data', async (_, imgUrl, chapterUrl) => {
    try {
      const fetched = await fetchImageWithFallback(imgUrl, chapterUrl);
      return `data:${fetched.contentType};base64,${fetched.buffer.toString('base64')}`;
    } catch (err) {
      console.error('[ImageProxy] Lỗi tải ảnh:', imgUrl, err.message);
      throw err;
    }
  });

  // Window Controls
  ipcMain.handle('open-external', (_, url) => shell.openExternal(url));
  ipcMain.handle('minimize-window', () => mainWindow?.minimize());
  ipcMain.handle('maximize-window', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.handle('close-window', () => mainWindow?.close());
}

const axios = require('axios');

async function fetchImageWithFallback(imgUrl, chapterUrl = '') {
  const urlsToTry = [imgUrl];

  if (imgUrl.includes('mangadex.network')) {
    const match = imgUrl.match(/\/(data(?:-saver)?\/[a-f0-9]+\/[^/?#]+)/i);
    if (match) {
      urlsToTry.push(`https://uploads.mangadex.org/${match[1]}`);
    }
  }

  const referersToTry = [];
  
  if (chapterUrl) {
    try {
      const parsed = new URL(chapterUrl);
      referersToTry.push(parsed.origin + '/');
      referersToTry.push(chapterUrl);
    } catch(e) {}
  }

  if (imgUrl.includes('cloud-zzz.com') || imgUrl.includes('nettruyen') || imgUrl.includes('truyentranhlh')) {
    referersToTry.push('https://nettruyenar.com/');
    referersToTry.push('https://nettruyennew.com/');
    referersToTry.push('https://nettruyenww.com/');
    referersToTry.push('https://nettruyenco.vn/');
  } else if (imgUrl.includes('truyenqq')) {
    referersToTry.push('https://truyenqq.com.vn/');
    referersToTry.push('https://truyenqqviet.com/');
  } else if (imgUrl.includes('blogtruyen') || imgUrl.includes('googleusercontent') || imgUrl.includes('blogspot')) {
    referersToTry.push('https://blogtruyenmoi.com/');
    referersToTry.push('https://blogtruyen.vn/');
  } else if (imgUrl.includes('goctruyentranh')) {
    referersToTry.push('https://goctruyentranhvui41.com/');
    referersToTry.push('https://goctruyentranhvui31.com/');
    referersToTry.push('https://goctruyentranhvui30.com/');
    referersToTry.push('https://goctruyentranhvui18.com/');
    referersToTry.push('https://goctruyentranhvui.com/');
    referersToTry.push('https://goctruyentranhvui2.com/');
  } else if (imgUrl.includes('truyen.moe') || imgUrl.includes('moetruyen')) {
    referersToTry.push('https://moetruyen.net/');
    referersToTry.push('https://moetruyen.net');
    referersToTry.push('https://truyen.moe/');
  }

  referersToTry.push(''); // No referer fallback

  for (const targetUrl of urlsToTry) {
    for (const ref of referersToTry) {
      try {
        const headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        };
        if (ref) headers['Referer'] = ref;

        const res = await axios.get(targetUrl, {
          headers,
          timeout: 8000,
          responseType: 'arraybuffer'
        });

        if (res.status === 200 && res.data && res.data.length > 0) {
          return {
            buffer: Buffer.from(res.data),
            contentType: res.headers['content-type'] || 'image/jpeg'
          };
        }
      } catch (err) {
        // try next
      }
    }
  }

  throw new Error('Không thể tải ảnh từ máy chủ gốc');
}

function setupWebRequestHeaders() {
  try {
    const filter = { urls: ['*://*/*'] };
    session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
      const requestUrl = (details.url || '').toLowerCase();
      const headers = { ...details.requestHeaders };

      headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

      if (requestUrl.includes('cloud-zzz.com') || requestUrl.includes('nettruyen') || requestUrl.includes('truyentranhlh')) {
        headers['Referer'] = 'https://nettruyenar.com/';
      } else if (requestUrl.includes('truyenqq')) {
        headers['Referer'] = 'https://truyenqq.com.vn/';
      } else if (requestUrl.includes('blogtruyen') || requestUrl.includes('googleusercontent') || requestUrl.includes('blogspot')) {
        headers['Referer'] = 'https://blogtruyenmoi.com/';
      } else if (requestUrl.includes('goctruyentranh') || requestUrl.includes('gtt-bk.pro')) {
        try {
          const u = new URL(details.url);
          headers['Referer'] = `${u.protocol}//${u.host}/`;
        } catch (e) {
          headers['Referer'] = 'https://goctruyentranhvui41.com/';
        }
        const gocCookie = db.getSettings()?.gocTruyenTranhCookie;
        if (gocCookie && gocCookie.includes('=')) {
          headers['Cookie'] = gocCookie;
        }
        const gocToken = db.getSettings()?.gocTruyenTranhToken || (gocCookie && !gocCookie.includes('=') ? gocCookie : '');
        if (gocToken) {
          headers['Authorization'] = gocToken;
        }
      } else if (requestUrl.includes('mangadex.org')) {
        headers['Referer'] = 'https://mangadex.org/';
      } else if (requestUrl.includes('truyen.moe') || requestUrl.includes('moetruyen')) {
        headers['Referer'] = 'https://moetruyen.net/';
      }

      callback({ cancel: false, requestHeaders: headers });
    });
  } catch (err) {
    console.error('[Session] Lỗi thiết lập onBeforeSendHeaders:', err.message);
  }
}

app.whenReady().then(() => {
  setupWebRequestHeaders();
  setupIpc();
  createWindow();
  setupTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    const settings = db.getSettings();
    if (!settings.closeToTray) {
      app.quit();
    }
  }
});

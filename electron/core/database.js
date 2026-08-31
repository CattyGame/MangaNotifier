const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function mapStatusToTag(status, existingTag = null) {
  if (existingTag === 'favorite') return 'favorite';
  if (!status) return existingTag || 'reading';
  const s = String(status).toLowerCase().trim();
  if (s.includes('hoàn thành') || s.includes('completed') || s.includes('end') || s.includes('trọn bộ') || s.includes('finished')) {
    return 'completed';
  }
  if (s.includes('tạm ngưng') || s.includes('tạm dừng') || s.includes('tạm hoãn') || s.includes('hiatus') || s.includes('cancelled') || s.includes('drop') || s.includes('on_hold')) {
    return 'on_hold';
  }
  return 'reading';
}

class Database {
  constructor() {
    try {
      if (app && app.isReady()) {
        this.dataDir = app.getPath('userData');
      } else if (process.env.APPDATA) {
        this.dataDir = path.join(process.env.APPDATA, 'manga-notifier-desktop');
      } else if (process.env.HOME) {
        this.dataDir = path.join(process.env.HOME, '.config', 'manga-notifier-desktop');
      } else {
        this.dataDir = path.join(process.cwd(), 'data');
      }
    } catch (e) {
      this.dataDir = path.join(process.cwd(), 'data');
    }

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    this.filePath = path.join(this.dataDir, 'manga_notifier_db.json');
    this.data = {
      mangas: [],
      history: [],
      settings: {
        pollIntervalMinutes: 15,
        discordWebhook: '',
        soundEnabled: true,
        startupWithWindows: false,
        closeToTray: true,
        autoOpenBrowser: false
      }
    };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        const mangas = (parsed.mangas || []).map(m => {
          const autoTag = mapStatusToTag(m.status, m.tag);
          return { ...m, tag: autoTag };
        });
        this.data = {
          mangas,
          history: parsed.history || [],
          settings: { ...this.data.settings, ...(parsed.settings || {}) }
        };
      } else {
        this.save();
      }
    } catch (err) {
      console.error('[Database] Lỗi khi đọc file DB:', err.message);
    }
  }

  save() {
    try {
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      console.error('[Database] Lỗi khi lưu file DB:', err.message);
    }
  }

  getMangas() {
    return this.data.mangas;
  }

  getMangaById(id) {
    return this.data.mangas.find(m => m.id === id);
  }

  addManga(manga) {
    const existingIndex = this.data.mangas.findIndex(m => m.id === manga.id || m.url === manga.url);
    const autoTag = mapStatusToTag(manga.status, manga.tag);
    const newEntry = {
      ...manga,
      addedAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      hasUnread: false,
      readChapters: manga.readChapters || [],
      tag: autoTag,
      latestChapter: manga.latestChapter || (manga.chapters && manga.chapters[0] ? manga.chapters[0].title : 'Chưa rõ')
    };

    if (existingIndex >= 0) {
      this.data.mangas[existingIndex] = { ...this.data.mangas[existingIndex], ...newEntry };
    } else {
      this.data.mangas.unshift(newEntry);
    }
    this.save();
    return newEntry;
  }

  updateManga(id, updates) {
    const index = this.data.mangas.findIndex(m => m.id === id);
    if (index >= 0) {
      const current = this.data.mangas[index];
      const newStatus = updates.status !== undefined ? updates.status : current.status;
      const newTag = updates.tag !== undefined ? updates.tag : mapStatusToTag(newStatus, current.tag);
      this.data.mangas[index] = { 
        ...current, 
        ...updates,
        tag: newTag
      };
      this.save();
      return this.data.mangas[index];
    }
    return null;
  }

  deleteManga(id) {
    this.data.mangas = this.data.mangas.filter(m => m.id !== id);
    this.save();
    return true;
  }

  markChapterRead(mangaId, chapterId) {
    const manga = this.data.mangas.find(m => m.id === mangaId);
    if (manga) {
      if (!manga.readChapters) manga.readChapters = [];
      if (!manga.readChapters.includes(chapterId)) {
        manga.readChapters.push(chapterId);
      }

      const foundChap = (manga.chapters || []).find(c => c.id === chapterId || c.url === chapterId);
      if (foundChap) {
        manga.lastReadChapter = {
          id: foundChap.id,
          title: foundChap.title,
          url: foundChap.url
        };
        manga.lastReadChapterId = foundChap.id;
        manga.lastReadChapterTitle = foundChap.title;
      } else {
        manga.lastReadChapterId = chapterId;
      }
      manga.lastReadAt = new Date().toISOString();

      // Check if all known chapters are read
      const unreadCount = (manga.chapters || []).filter(c => !manga.readChapters.includes(c.id)).length;
      manga.hasUnread = unreadCount > 0;
      this.save();
      return manga;
    }
    return null;
  }

  markAllChaptersRead(mangaId) {
    const manga = this.data.mangas.find(m => m.id === mangaId);
    if (manga) {
      manga.readChapters = (manga.chapters || []).map(c => c.id);
      manga.hasUnread = false;
      this.save();
      return manga;
    }
    return null;
  }

  getSettings() {
    return this.data.settings;
  }

  updateSettings(newSettings) {
    this.data.settings = { ...this.data.settings, ...newSettings };
    this.save();
    return this.data.settings;
  }

  getHistory() {
    return this.data.history;
  }

  addNotificationHistory(notif) {
    this.data.history.unshift({
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      ...notif
    });
    if (this.data.history.length > 200) {
      this.data.history = this.data.history.slice(0, 200);
    }
    this.save();
  }

  clearHistory() {
    this.data.history = [];
    this.save();
  }

  exportData() {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      mangas: this.data.mangas,
      history: this.data.history,
      settings: this.data.settings
    };
  }

  importData(imported) {
    if (!imported || !Array.isArray(imported.mangas)) {
      throw new Error('File sao lưu không hợp lệ');
    }

    const existingMap = new Map(this.data.mangas.map(m => [m.url || m.id, m]));
    for (const m of imported.mangas) {
      const key = m.url || m.id;
      if (existingMap.has(key)) {
        const old = existingMap.get(key);
        const readSet = new Set([...(old.readChapters || []), ...(m.readChapters || [])]);
        existingMap.set(key, {
          ...old,
          ...m,
          readChapters: Array.from(readSet),
          lastReadChapter: m.lastReadChapter || old.lastReadChapter,
          lastReadChapterTitle: m.lastReadChapterTitle || old.lastReadChapterTitle,
          tag: m.tag || old.tag
        });
      } else {
        existingMap.set(key, m);
      }
    }

    this.data.mangas = Array.from(existingMap.values());
    if (Array.isArray(imported.history)) {
      const historySet = new Set(this.data.history.map(h => h.id || `${h.mangaId}_${h.chapterTitle}`));
      for (const h of imported.history) {
        const key = h.id || `${h.mangaId}_${h.chapterTitle}`;
        if (!historySet.has(key)) {
          this.data.history.unshift(h);
          historySet.add(key);
        }
      }
    }

    this.save();
    return {
      mangas: this.data.mangas,
      history: this.data.history,
      settings: this.data.settings
    };
  }
}

module.exports = Database;

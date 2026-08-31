const pluginManager = require('../plugins');

// Helper to extract numeric chapter value
function extractChapterNum(title) {
  if (!title) return 0;
  const match = title.match(/(?:chap(?:ter)?|chương|tập)\s*([\d.]+)/i);
  return match ? parseFloat(match[1]) : 0;
}

// Helper to verify if chapter release time is truly recent (< 14 days)
function isChapterTrulyRecent(chapter) {
  if (!chapter) return false;
  const timeStr = (chapter.releaseTime || '').toLowerCase();
  
  if (
    timeStr.includes('vừa') ||
    timeStr.includes('phút') ||
    timeStr.includes('giờ') ||
    timeStr.includes('hôm nay') ||
    timeStr.includes('hôm qua') ||
    timeStr.includes('ngày') ||
    timeStr.includes('mins') ||
    timeStr.includes('hours') ||
    timeStr.includes('days') ||
    timeStr.includes('ago')
  ) {
    if (timeStr.includes('tháng') || timeStr.includes('năm') || timeStr.includes('month') || timeStr.includes('year')) {
      return false;
    }
    return true;
  }

  if (chapter.releaseTime && chapter.releaseTime !== 'Mới cập nhật') {
    const parts = chapter.releaseTime.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        const diffDays = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays <= 14;
      }
    } else {
      const d = new Date(chapter.releaseTime);
      if (!isNaN(d.getTime())) {
        const diffDays = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays <= 14;
      }
    }
  }

  return true;
}

class Poller {
  constructor(database, notifier, mainWindowGetter) {
    this.db = database;
    this.notifier = notifier;
    this.getMainWindow = mainWindowGetter;
    this.timer = null;
    this.isChecking = false;
    this.lastCheckedAt = null;
  }

  start() {
    this.stop();
    const settings = this.db.getSettings();
    const minutes = Math.max(1, settings.pollIntervalMinutes || 15);
    console.log(`[Poller] Bắt đầu chạy ngầm kiểm tra định kỳ mỗi ${minutes} phút`);

    this.timer = setInterval(() => {
      this.checkAll();
    }, minutes * 60 * 1000);

    // Initial check after 3s if mangas exist
    setTimeout(() => {
      this.checkAll();
    }, 3000);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  restart() {
    this.start();
  }

  async checkSingleManga(mangaId) {
    const manga = this.db.getMangaById(mangaId);
    if (!manga) return null;

    try {
      this.broadcastStatus({
        isChecking: true,
        current: 1,
        total: 1,
        currentManga: manga.title,
        message: `Đang cập nhật Real-time: ${manga.title}...`
      });

      const plugin = pluginManager.getPlugin(manga.pluginId) || pluginManager.findPluginForUrl(manga.url);
      if (!plugin) {
        throw new Error('Không tìm thấy nguồn hỗ trợ truyện này');
      }

      const details = await plugin.getMangaDetails(manga.url);
      if (!details || !Array.isArray(details.chapters)) return manga;

      const freshChapters = details.chapters;
      const oldChapters = manga.chapters || [];
      const oldChapterIds = new Set(oldChapters.map(c => c.id || c.url || c.title));
      const readChapterIds = new Set(manga.readChapters || []);
      const isFirstScan = oldChapters.length === 0;

      const newlyReleased = [];
      if (!isFirstScan) {
        const maxOldChapterNum = Math.max(0, ...oldChapters.map(c => extractChapterNum(c.title)));

        for (const ch of freshChapters) {
          const chId = ch.id || ch.url || ch.title;
          if (!oldChapterIds.has(chId) && !readChapterIds.has(chId)) {
            const chNum = extractChapterNum(ch.title);
            if ((chNum >= maxOldChapterNum && chNum > 0) || isChapterTrulyRecent(ch)) {
              newlyReleased.push(ch);
            }
          }
        }
      }

      const latestChapTitle = freshChapters[0] ? freshChapters[0].title : manga.latestChapter;
      const hasUnread = manga.hasUnread || newlyReleased.length > 0;

      const updated = this.db.updateManga(manga.id, {
        chapters: freshChapters,
        latestChapter: latestChapTitle,
        cover: details.cover || manga.cover,
        status: details.status || manga.status,
        description: details.description || manga.description,
        hasUnread,
        lastCheckedAt: new Date().toISOString()
      });

      if (newlyReleased.length > 0) {
        await this.notifier.notifyNewChapter(manga, newlyReleased[0], plugin.name);
      }

      this.broadcastSingleManga(updated);
      this.broadcastData();
      return updated;
    } catch (err) {
      console.error(`[Poller] Lỗi checkSingleManga "${manga.title}":`, err.message);
      throw err;
    } finally {
      this.broadcastStatus({
        isChecking: false,
        lastChecked: new Date().toISOString(),
        message: `Đã cập nhật: ${manga.title}`
      });
    }
  }

  async checkAll(forceAll = false) {
    if (this.isChecking) {
      console.log('[Poller] Đang trong quá trình quét, bỏ qua lượt này...');
      return;
    }

    this.isChecking = true;
    const allMangas = this.db.getMangas();
    // In background periodic checks, prioritize ongoing/reading mangas
    const mangas = forceAll 
      ? allMangas 
      : allMangas.filter(m => (m.status !== 'Hoàn thành' && m.status !== 'Completed') || m.tag === 'reading' || !m.status);

    this.broadcastStatus({
      isChecking: true,
      current: 0,
      total: mangas.length,
      currentManga: '',
      message: `Bắt đầu quét song song ${mangas.length} bộ truyện...`
    });

    try {
      console.log(`[Poller] Đang quét song song ${mangas.length} bộ truyện...`);
      let newChaptersCount = 0;
      let completedCount = 0;
      const CONCURRENCY = 6;

      const queue = [...mangas];
      const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length || 1) }, async () => {
        while (queue.length > 0) {
          const manga = queue.shift();
          if (!manga) break;

          try {
            const plugin = pluginManager.getPlugin(manga.pluginId) || pluginManager.findPluginForUrl(manga.url);
            if (!plugin) continue;

            const details = await plugin.getMangaDetails(manga.url);
            if (!details || !Array.isArray(details.chapters)) continue;

            const freshChapters = details.chapters;
            const oldChapters = manga.chapters || [];
            const oldChapterIds = new Set(oldChapters.map(c => c.id || c.url || c.title));
            const readChapterIds = new Set(manga.readChapters || []);
            const isFirstScan = oldChapters.length === 0;

            const newlyReleased = [];
            if (!isFirstScan) {
              const maxOldChapterNum = Math.max(0, ...oldChapters.map(c => extractChapterNum(c.title)));

              for (const ch of freshChapters) {
                const chId = ch.id || ch.url || ch.title;
                if (!oldChapterIds.has(chId) && !readChapterIds.has(chId)) {
                  const chNum = extractChapterNum(ch.title);
                  if ((chNum >= maxOldChapterNum && chNum > 0) || isChapterTrulyRecent(ch)) {
                    newlyReleased.push(ch);
                  }
                }
              }
            }

            const latestChapTitle = freshChapters[0] ? freshChapters[0].title : manga.latestChapter;
            const hasUnread = manga.hasUnread || newlyReleased.length > 0;

            const updated = this.db.updateManga(manga.id, {
              chapters: freshChapters,
              latestChapter: latestChapTitle,
              cover: details.cover || manga.cover,
              status: details.status || manga.status,
              description: details.description || manga.description,
              hasUnread,
              lastCheckedAt: new Date().toISOString()
            });

            // Real-time broadcast single manga immediately so card updates live
            this.broadcastSingleManga(updated);

            if (newlyReleased.length > 0) {
              console.log(`[Poller] 🔥 Phát hiện ${newlyReleased.length} chap mới cho "${manga.title}"!`);
              newChaptersCount += newlyReleased.length;
              await this.notifier.notifyNewChapter(manga, newlyReleased[0], plugin.name);
            }
          } catch (mangaErr) {
            console.error(`[Poller] Lỗi khi quét "${manga.title}":`, mangaErr.message);
          } finally {
            completedCount++;
            this.broadcastStatus({
              isChecking: true,
              current: completedCount,
              total: mangas.length,
              currentManga: manga.title,
              message: `Đang quét (${completedCount}/${mangas.length}): ${manga.title}...`
            });
          }
        }
      });

      await Promise.all(workers);
      this.lastCheckedAt = new Date().toISOString();
      console.log(`[Poller] Hoàn tất quét siêu tốc. Tổng số chương mới: ${newChaptersCount}`);
    } catch (err) {
      console.error('[Poller] Lỗi tổng thể:', err.message);
    } finally {
      this.isChecking = false;
      this.broadcastStatus({
        isChecking: false,
        lastChecked: this.lastCheckedAt || new Date().toISOString(),
        message: 'Đã hoàn tất đồng bộ Real-time'
      });
      this.broadcastData();
    }
  }

  broadcastStatus(status) {
    const win = this.getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('poll-status', status);
    }
  }

  broadcastSingleManga(manga) {
    const win = this.getMainWindow();
    if (win && !win.isDestroyed() && manga) {
      win.webContents.send('manga-updated-single', manga);
    }
  }

  broadcastData() {
    const win = this.getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('mangas-updated', this.db.getMangas());
      win.webContents.send('history-updated', this.db.getHistory());
    }
  }
}

module.exports = Poller;

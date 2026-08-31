const { Notification, shell } = require('electron');
const axios = require('axios');
const path = require('path');

class Notifier {
  constructor(database, mainWindowGetter) {
    this.db = database;
    this.getMainWindow = mainWindowGetter;
  }

  /**
   * Send notification across all active channels (Windows Toast + Discord Webhook)
   */
  async notifyNewChapter(manga, newChapter, pluginName) {
    const settings = this.db.getSettings();
    const title = `📖 ${manga.title}`;
    const body = `🎉 Ra mắt ${newChapter.title}!\nNguồn: ${pluginName}`;

    // 1. Windows Toast Notification
    try {
      if (Notification.isSupported()) {
        const toast = new Notification({
          title,
          body,
          silent: !settings.soundEnabled,
          urgency: 'normal'
        });

        toast.on('click', () => {
          const win = this.getMainWindow();
          if (win) {
            if (win.isMinimized()) win.restore();
            win.show();
            win.focus();
            win.webContents.send('open-reader', {
              mangaId: manga.id,
              chapterId: newChapter.id,
              chapterUrl: newChapter.url,
              chapterTitle: newChapter.title,
              pluginId: manga.pluginId
            });
          } else {
            shell.openExternal(newChapter.url);
          }
        });

        toast.show();
      }
    } catch (err) {
      console.error('[Notifier] Windows Notification error:', err.message);
    }

    // 2. Discord Webhook Notification
    if (settings.discordWebhook && settings.discordWebhook.trim().startsWith('http')) {
      try {
        await this.sendDiscordWebhook(settings.discordWebhook, manga, newChapter, pluginName);
      } catch (err) {
        console.error('[Notifier] Discord Webhook error:', err.message);
      }
    }

    // 3. Log into Database history
    this.db.addNotificationHistory({
      mangaId: manga.id,
      mangaTitle: manga.title,
      cover: manga.cover,
      chapterTitle: newChapter.title,
      chapterUrl: newChapter.url,
      pluginName: pluginName || manga.pluginId
    });
  }

  /**
   * Send Rich Embed to Discord Webhook
   */
  async sendDiscordWebhook(webhookUrl, manga, chapter, pluginName) {
    const embed = {
      title: `⚡ Chương mới: ${manga.title}`,
      description: `Đã có chương mới: **${chapter.title}**!\nNguồn: **${pluginName || 'Manga Notifier'}**`,
      url: chapter.url,
      color: 0x8b5cf6, // Violet Neon
      thumbnail: {
        url: manga.cover && manga.cover.startsWith('http') ? manga.cover : 'https://placehold.co/200x300/1e293b/a78bfa.png'
      },
      fields: [
        {
          name: '📖 Tên chương',
          value: chapter.title || 'Chương mới',
          inline: true
        },
        {
          name: '⏰ Thời gian phát hiện',
          value: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          inline: true
        },
        {
          name: '🔗 Đường dẫn đọc',
          value: `[Bấm vào đây để đọc trên web](${chapter.url})`,
          inline: false
        }
      ],
      footer: {
        text: 'Manga Notifier Desktop App • Tự động thông báo',
        icon_url: 'https://cdn-icons-png.flaticon.com/512/3504/3504104.png'
      },
      timestamp: new Date().toISOString()
    };

    await axios.post(webhookUrl, {
      username: 'Manga Notifier Bot',
      avatar_url: 'https://cdn-icons-png.flaticon.com/512/3504/3504104.png',
      embeds: [embed]
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });
  }

  /**
   * Test Discord Webhook connection
   */
  async testDiscordWebhook(webhookUrl) {
    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      throw new Error('URL Webhook không hợp lệ');
    }

    const testEmbed = {
      title: '🔔 Kiểm tra kết nối Webhook thành công!',
      description: 'Chúc mừng bạn! Ứng dụng Manga Notifier Desktop đã kết nối thành công với kênh Discord này. Bạn sẽ nhận được thông báo ngay khi có chương truyện mới.',
      color: 0x10b981, // Emerald Green
      fields: [
        {
          name: '📱 Ứng dụng',
          value: 'Manga Notifier Desktop',
          inline: true
        },
        {
          name: '⚡ Trạng thái',
          value: '✅ Đang hoạt động',
          inline: true
        }
      ],
      footer: {
        text: 'Manga Notifier Test Message'
      },
      timestamp: new Date().toISOString()
    };

    const resp = await axios.post(webhookUrl, {
      username: 'Manga Notifier Bot',
      avatar_url: 'https://cdn-icons-png.flaticon.com/512/3504/3504104.png',
      embeds: [testEmbed]
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    return resp.status === 204 || resp.status === 200;
  }
}

module.exports = Notifier;

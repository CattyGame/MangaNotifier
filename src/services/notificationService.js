import { LocalNotifications } from '@capacitor/local-notifications';

export const NotificationService = {
  isSupported() {
    return typeof window !== 'undefined' && typeof LocalNotifications !== 'undefined';
  },

  async requestPermission() {
    try {
      if (!this.isSupported()) return false;
      const status = await LocalNotifications.checkPermissions();
      if (status.display === 'granted') return true;
      const req = await LocalNotifications.requestPermissions();
      return req.display === 'granted';
    } catch (e) {
      console.warn('[NotificationService] Lỗi xin quyền thông báo:', e);
      return false;
    }
  },

  async createChannel() {
    try {
      if (!this.isSupported()) return;
      await LocalNotifications.createChannel({
        id: 'manga_updates',
        name: 'Thông báo chương mới',
        description: 'Thông báo khi có chương mới từ các bộ truyện bạn theo dõi',
        importance: 5,
        visibility: 1,
        sound: 'res_custom_notification.wav',
        vibration: true,
        lights: true
      });
    } catch (e) {
      console.warn('[NotificationService] Lỗi tạo notification channel:', e);
    }
  },

  async sendNewChapterNotification({ mangaTitle, chapterTitle, mangaId, chapterUrl, cover }) {
    try {
      const hasPerm = await this.requestPermission();
      if (!hasPerm) return;

      await this.createChannel();

      const notifId = Math.floor(Math.random() * 1000000);
      await LocalNotifications.schedule({
        notifications: [
          {
            title: `🔥 Chương mới: ${mangaTitle}`,
            body: chapterTitle,
            id: notifId,
            channelId: 'manga_updates',
            schedule: { at: new Date(Date.now() + 100) },
            sound: 'res_custom_notification.wav',
            extra: {
              mangaId,
              chapterUrl,
              cover
            },
            smallIcon: 'ic_stat_manga'
          }
        ]
      });
      console.log(`[NotificationService] Đã gửi thông báo cho ${mangaTitle}: ${chapterTitle}`);
    } catch (e) {
      console.warn('[NotificationService] Lỗi gửi thông báo:', e);
    }
  },

  setupListeners(onNotificationClick) {
    try {
      if (!this.isSupported()) return () => {};
      const sub = LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
        const extra = notification.notification?.extra;
        if (extra && onNotificationClick) {
          onNotificationClick(extra);
        }
      });
      return () => {
        sub.then(h => h.remove());
      };
    } catch (e) {
      return () => {};
    }
  }
};

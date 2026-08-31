import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  Clock, 
  Send, 
  Volume2, 
  VolumeX, 
  Monitor, 
  Minimize2, 
  Save, 
  Check, 
  Loader2, 
  AlertCircle,
  ShieldCheck,
  Download,
  Upload,
  QrCode,
  Camera,
  Bell,
  Smartphone,
  Laptop
} from 'lucide-react';
import { NotificationService } from '../services/notificationService';

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  onSaveSettings,
  onOpenQRSync,
  onOpenQRScanner
}) {
  const isDesktop = typeof window !== 'undefined' && !!(window.electronAPI?.isDesktop);

  const [settings, setSettings] = useState({
    pollIntervalMinutes: 15,
    discordWebhook: '',
    soundEnabled: true,
    startupWithWindows: false,
    closeToTray: true,
    mobileNotifications: true,
    gocTruyenTranhCookie: ''
  });

  const [testingWebhook, setTestingWebhook] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadSettings = async () => {
      try {
        if (window.electronAPI?.getSettings) {
          const data = await window.electronAPI.getSettings();
          if (data) setSettings(s => ({ ...s, ...data }));
        }
      } catch (err) {
        console.error('Load settings error:', err);
      }
    };

    loadSettings();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleTestWebhook = async () => {
    if (!settings.discordWebhook?.trim()) {
      setTestResult({ success: false, message: 'Vui lòng nhập đường link Discord Webhook trước' });
      return;
    }

    setTestingWebhook(true);
    setTestResult(null);

    try {
      if (window.electronAPI?.testDiscordWebhook) {
        await window.electronAPI.testDiscordWebhook(settings.discordWebhook.trim());
        setTestResult({ success: true, message: 'Đã gửi thông báo thử nghiệm vào kênh Discord thành công!' });
      }
    } catch (err) {
      setTestResult({ success: false, message: err.message || 'Không thể gửi webhook tới Discord' });
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    try {
      if (window.electronAPI?.updateSettings) {
        await window.electronAPI.updateSettings(settings);
      }
      onSaveSettings(settings);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Save settings error:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div 
        className="relative w-full max-w-xl bg-surface border border-surface-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scaleUp"
        onClick={e => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between bg-surface-header">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
              {isDesktop ? <Laptop className="w-5 h-5 text-primary-light" /> : <Smartphone className="w-5 h-5 text-accent-cyan" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">
                {isDesktop ? 'Cài đặt Manga Notifier PC' : 'Cài đặt Manga Notifier Mobile'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {isDesktop ? 'Tùy chỉnh Windows, Discord & Đồng bộ' : 'Tùy chỉnh thông báo Android & Đồng bộ QR'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-6 overflow-y-auto custom-scrollbar">
          
          {/* Section: QR Sync (Highlighted) */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/15 via-accent-cyan/10 to-transparent border border-primary/30 space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-white">
              <QrCode className="w-4 h-4 text-accent-cyan" />
              <span>{isDesktop ? 'Đồng bộ sang Điện thoại (QR Code)' : 'Đồng bộ dữ liệu từ Máy tính (PC)'}</span>
            </div>
            <p className="text-[11px] text-slate-300">
              {isDesktop 
                ? 'Phát mã QR để camera điện thoại quét và tự động nạp 100% danh sách truyện sang máy mà không cần cắm cáp.' 
                : 'Mở camera quét mã QR hiển thị trên màn hình máy tính để nạp toàn bộ truyện và tiến trình đọc.'}
            </p>

            <div className="flex flex-wrap gap-2.5 pt-1">
              {isDesktop ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onOpenQRSync) onOpenQRSync();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-glow-primary flex items-center space-x-2 transition-all active:scale-95"
                >
                  <QrCode className="w-4 h-4" />
                  <span>📷 Tạo mã QR Đồng bộ sang Mobile</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onOpenQRScanner) onOpenQRScanner();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-accent-cyan text-slate-900 hover:bg-cyan-300 text-xs font-bold shadow-lg flex items-center space-x-2 transition-all active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                  <span>📷 Quét mã QR từ Máy tính</span>
                </button>
              )}

              {/* JSON Export / Import buttons */}
              <button
                type="button"
                onClick={async () => {
                  try {
                    let backupData = null;
                    if (window.electronAPI?.exportBackup) {
                      backupData = await window.electronAPI.exportBackup();
                    } else {
                      const raw = localStorage.getItem('manga_notifier_db');
                      backupData = raw ? JSON.parse(raw) : { mangas: [] };
                    }
                    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    const dateStr = new Date().toISOString().split('T')[0];
                    a.href = url;
                    a.download = `manga_notifier_backup_${dateStr}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    alert('Lỗi xuất file sao lưu: ' + err.message);
                  }
                }}
                className="px-3 py-2 rounded-xl bg-surface-hover hover:bg-surface-border text-slate-200 border border-surface-border text-xs font-semibold flex items-center space-x-1.5 transition-all"
                title="Xuất file JSON sao lưu"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Xuất JSON</span>
              </button>

              <label className="px-3 py-2 rounded-xl bg-surface-hover hover:bg-surface-border text-slate-200 border border-surface-border text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer" title="Nhập file JSON sao lưu">
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>Nhập JSON</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async (evt) => {
                      try {
                        const parsed = JSON.parse(evt.target?.result);
                        if (window.electronAPI?.importBackup) {
                          await window.electronAPI.importBackup(parsed);
                        } else {
                          localStorage.setItem('manga_notifier_db', JSON.stringify(parsed));
                        }
                        alert('Đồng bộ dữ liệu thành công!');
                        window.location.reload();
                      } catch (err) {
                        alert('File sao lưu không hợp lệ: ' + err.message);
                      }
                    };
                    reader.readAsText(file);
                  }}
                />
              </label>
            </div>
          </div>

          {/* Section: Mobile Push Notifications (Only on Mobile) */}
          {!isDesktop && (
            <div className="space-y-3 pt-2 border-t border-surface-border/60">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-200">
                <Bell className="w-4 h-4 text-accent-rose" />
                <span>Thông báo đẩy Android</span>
              </div>
              
              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-background border border-surface-border hover:border-slate-600 transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <Bell className="w-5 h-5 text-accent-cyan" />
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">Thông báo khi có chap mới</span>
                    <span className="text-[11px] text-slate-400">Rung & hiển thị thông báo trên màn hình khóa điện thoại</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.mobileNotifications !== false}
                  onChange={async (e) => {
                    const enabled = e.target.checked;
                    setSettings(s => ({ ...s, mobileNotifications: enabled }));
                    if (enabled) {
                      await NotificationService.requestPermission();
                    }
                  }}
                  className="w-5 h-5 rounded-lg text-primary focus:ring-primary bg-surface border-surface-border"
                />
              </label>
            </div>
          )}

          {/* Section: Polling Frequency */}
          <div className="space-y-2 pt-2 border-t border-surface-border/60">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-200">
              <Clock className="w-4 h-4 text-primary-light" />
              <span>Tần suất tự động quét chương mới</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Chu kỳ quét ngầm tự động tìm kiếm chương mới từ các nguồn truyện.
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
              {[
                { value: 1, label: '1 phút ⚡' },
                { value: 3, label: '3 phút' },
                { value: 5, label: '5 phút' },
                { value: 15, label: '15 phút' },
                { value: 30, label: '30 phút' },
                { value: 60, label: '1 tiếng' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.value}
                  onClick={() => setSettings(s => ({ ...s, pollIntervalMinutes: item.value }))}
                  className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all text-center ${
                    settings.pollIntervalMinutes === item.value
                      ? 'bg-primary/20 border-primary text-primary-light shadow-glow-primary'
                      : 'bg-background border-surface-border text-slate-300 hover:bg-surface-hover'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section: Discord Webhook (Desktop only or optional) */}
          {isDesktop && (
            <div className="space-y-2 pt-2 border-t border-surface-border/60">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-200">
                <Send className="w-4 h-4 text-accent-cyan" />
                <span>Discord Webhook (Thông báo về kênh Discord)</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Gửi thông báo chương mới kèm ảnh bìa trực tiếp vào server Discord của bạn.
              </p>
              
              <div className="flex gap-2 pt-1">
                <input
                  type="url"
                  value={settings.discordWebhook || ''}
                  onChange={(e) => setSettings(s => ({ ...s, discordWebhook: e.target.value }))}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-background border border-surface-border focus:border-primary focus:ring-1 focus:ring-primary text-xs text-slate-100 placeholder-slate-500 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={handleTestWebhook}
                  disabled={testingWebhook || !settings.discordWebhook?.trim()}
                  className="px-4 py-2.5 rounded-xl bg-surface-hover hover:bg-surface-border text-slate-200 text-xs font-semibold border border-surface-border transition-all disabled:opacity-40 flex items-center space-x-1.5 active:scale-95"
                >
                  {testingWebhook ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Test</span>
                  )}
                </button>
              </div>

              {testResult && (
                <div className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                  testResult.success 
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                }`}>
                  {testResult.success ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          )}

          {/* Section: GocTruyenTranh VIP Account & Token Integration */}
          <div className="space-y-3 pt-2 border-t border-surface-border/60">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-200">
              <ShieldCheck className="w-4 h-4 text-accent-amber" />
              <span>Tài khoản Góc Truyện Tranh (Mã Authorization)</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Mã Authorization dùng để mở khóa tải các chương VIP trên Góc Truyện Tranh.
            </p>

            <div className="space-y-2">
              <input
                type="text"
                value={settings.gocTruyenTranhCookie || ''}
                onChange={(e) => setSettings(s => ({ ...s, gocTruyenTranhCookie: e.target.value }))}
                placeholder="Dán mã Authorization / Token của bạn..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-surface-border focus:border-primary focus:ring-1 focus:ring-primary text-xs text-slate-100 placeholder-slate-500 outline-none transition-all"
              />
            </div>
          </div>

          {/* Section: Windows Desktop Options (Desktop Only) */}
          {isDesktop && (
            <div className="space-y-3 pt-2 border-t border-surface-border/60">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-200">
                <Monitor className="w-4 h-4 text-accent-emerald" />
                <span>Tùy chọn hệ điều hành Windows</span>
              </div>

              {/* Sound notification */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-background border border-surface-border hover:border-slate-600 transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  {settings.soundEnabled ? <Volume2 className="w-4 h-4 text-primary-light" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">Âm thanh thông báo Windows</span>
                    <span className="text-[11px] text-slate-400">Phát âm thanh khi xuất hiện thông báo Windows</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.soundEnabled}
                  onChange={(e) => setSettings(s => ({ ...s, soundEnabled: e.target.checked }))}
                  className="w-4 h-4 rounded text-primary focus:ring-primary bg-surface border-surface-border"
                />
              </label>

              {/* Close to Tray */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-background border border-surface-border hover:border-slate-600 transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <Minimize2 className="w-4 h-4 text-accent-cyan" />
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">Thu nhỏ xuống khay hệ thống (System Tray)</span>
                    <span className="text-[11px] text-slate-400">Khi bấm tắt (X), app vẫn chạy ngầm góc phải màn hình</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.closeToTray}
                  onChange={(e) => setSettings(s => ({ ...s, closeToTray: e.target.checked }))}
                  className="w-4 h-4 rounded text-primary focus:ring-primary bg-surface border-surface-border"
                />
              </label>

              {/* Startup with Windows */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-background border border-surface-border hover:border-slate-600 transition-colors cursor-pointer">
                <div className="flex items-center space-x-3">
                  <ShieldCheck className="w-4 h-4 text-accent-amber" />
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">Khởi động cùng Windows</span>
                    <span className="text-[11px] text-slate-400">Tự động khởi chạy app khi mở máy tính</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.startupWithWindows}
                  onChange={(e) => setSettings(s => ({ ...s, startupWithWindows: e.target.checked }))}
                  className="w-4 h-4 rounded text-primary focus:ring-primary bg-surface border-surface-border"
                />
              </label>
            </div>
          )}

          {/* Footer Save Button */}
          <div className="pt-4 border-t border-surface-border flex items-center justify-end space-x-3 sticky bottom-0 bg-surface py-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-surface-hover hover:bg-surface-border text-slate-300 text-xs font-semibold transition-all"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-dark hover:from-primary-hover hover:to-primary text-white text-xs font-bold shadow-glow-primary active:scale-95 transition-all flex items-center space-x-1.5"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Đã lưu!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Lưu cài đặt</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

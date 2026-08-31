import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  X, 
  QrCode, 
  Wifi, 
  ShieldCheck, 
  Copy, 
  Check, 
  Loader2, 
  Smartphone,
  Laptop,
  Layers,
  Zap
} from 'lucide-react';

export default function QRSyncModal({ isOpen, onClose }) {
  const [syncMode, setSyncMode] = useState('wifi'); // 'wifi' | 'offline'
  const [selectedIp, setSelectedIp] = useState('');
  const [qrImage, setQrImage] = useState('');
  const [syncInfo, setSyncInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      if (window.electronAPI?.stopQRSync) {
        window.electronAPI.stopQRSync();
      }
      return;
    }

    let isMounted = true;
    const startSync = async () => {
      setLoading(true);
      try {
        let info = null;
        if (window.electronAPI?.startQRSync) {
          info = await window.electronAPI.startQRSync();
        } else {
          // Web fallback
          const raw = localStorage.getItem('manga_notifier_db');
          const data = raw ? JSON.parse(raw) : { mangas: [] };
          info = {
            syncUrl: '',
            syncUrls: [],
            qrPayload: JSON.stringify({ type: 'manga_notifier_offline', data }),
            ips: ['127.0.0.1'],
            primaryIp: '127.0.0.1',
            port: 45678,
            totalMangas: data.mangas?.length || 0
          };
        }

        if (isMounted && info) {
          setSyncInfo(info);
          setSelectedIp(info.primaryIp || (info.ips && info.ips[0]) || '127.0.0.1');
        }
      } catch (err) {
        console.error('Lỗi tạo máy chủ đồng bộ:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    startSync();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      isMounted = false;
      window.removeEventListener('keydown', handleKeyDown);
      if (window.electronAPI?.stopQRSync) {
        window.electronAPI.stopQRSync();
      }
    };
  }, [isOpen, onClose]);

  // Re-generate QR Code when mode or selected IP changes
  useEffect(() => {
    if (!syncInfo) return;

    const generateQR = async () => {
      try {
        let payload = '';

        if (syncMode === 'offline') {
          // Direct JSON offline payload
          let backupData = null;
          if (window.electronAPI?.exportBackup) {
            backupData = await window.electronAPI.exportBackup();
          } else {
            const raw = localStorage.getItem('manga_notifier_db');
            backupData = raw ? JSON.parse(raw) : { mangas: [] };
          }
          // Compact payload
          const compact = {
            type: 'manga_notifier_offline',
            data: {
              version: '1.0.0',
              mangas: (backupData.mangas || []).map(m => ({
                id: m.id,
                title: m.title,
                url: m.url,
                cover: m.cover,
                author: m.author,
                pluginId: m.pluginId,
                status: m.status,
                tag: m.tag,
                latestChapter: m.latestChapter,
                readChapters: m.readChapters || []
              }))
            }
          };
          payload = JSON.stringify(compact);
        } else {
          // Wi-Fi Local Server URL
          const currentIp = selectedIp || syncInfo.primaryIp;
          const currentUrl = `http://${currentIp}:${syncInfo.port}/api/sync?token=${syncInfo.token}`;
          payload = JSON.stringify({
            type: 'manga_notifier_sync',
            url: currentUrl,
            urls: syncInfo.syncUrls || [currentUrl],
            ip: currentIp,
            port: syncInfo.port,
            token: syncInfo.token
          });
        }

        const qrDataUrl = await QRCode.toDataURL(payload, {
          width: 320,
          margin: 2,
          errorCorrectionLevel: syncMode === 'offline' ? 'L' : 'M',
          color: {
            dark: '#0f172a',
            light: '#ffffff'
          }
        });
        setQrImage(qrDataUrl);
      } catch (err) {
        console.error('Lỗi tạo ảnh QR:', err);
      }
    };

    generateQR();
  }, [syncMode, selectedIp, syncInfo]);

  if (!isOpen) return null;

  const currentSyncUrl = syncInfo 
    ? `http://${selectedIp || syncInfo.primaryIp}:${syncInfo.port}/api/sync?token=${syncInfo.token}`
    : '';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fadeIn">
      <div 
        className="bg-surface border border-surface-border rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-scaleUp flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-surface-border flex items-center justify-between bg-surface-header">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-primary/20 text-primary-light border border-primary/30">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Đồng bộ sang Điện thoại (QR Code)</h3>
              <p className="text-[11px] text-slate-400">Chuyển toàn bộ truyện sang Mobile tức thì</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sync Mode Switcher */}
        <div className="flex border-b border-surface-border bg-background/50 p-1.5 gap-1.5 text-xs">
          <button
            onClick={() => setSyncMode('wifi')}
            className={`flex-1 py-1.5 rounded-xl font-semibold flex items-center justify-center space-x-1.5 transition-all ${
              syncMode === 'wifi' ? 'bg-primary text-white shadow-glow-primary' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>Đồng bộ Wi-Fi (Nhanh nhất)</span>
          </button>

          <button
            onClick={() => setSyncMode('offline')}
            className={`flex-1 py-1.5 rounded-xl font-semibold flex items-center justify-center space-x-1.5 transition-all ${
              syncMode === 'offline' ? 'bg-primary text-white shadow-glow-primary' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Mã QR Trực tiếp (Offline)</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 flex flex-col items-center text-center space-y-3.5 overflow-y-auto max-h-[70vh] custom-scrollbar">
          
          {loading ? (
            <div className="w-60 h-60 flex flex-col items-center justify-center space-y-3 bg-surface-hover/50 rounded-2xl border border-surface-border">
              <Loader2 className="w-8 h-8 text-primary-light animate-spin" />
              <p className="text-xs text-slate-400">Đang khởi tạo máy chủ...</p>
            </div>
          ) : qrImage ? (
            <div className="relative group">
              <div className="p-3 bg-white rounded-2xl shadow-xl border border-slate-300">
                <img src={qrImage} alt="Mã QR Đồng bộ" className="w-52 h-52 object-contain rounded-lg" />
              </div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-white text-[10px] font-bold rounded-full shadow-glow-primary flex items-center space-x-1 whitespace-nowrap">
                {syncMode === 'wifi' ? (
                  <>
                    <Wifi className="w-3 h-3 text-emerald-400" />
                    <span>Wi-Fi IP: {selectedIp}</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span>100% Offline (Không cần Wi-Fi)</span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-rose-400">Không thể tạo mã QR. Vui lòng thử lại.</div>
          )}

          {/* IP Selector if multiple network interfaces exist */}
          {syncMode === 'wifi' && syncInfo?.ips && syncInfo.ips.length > 1 && (
            <div className="w-full text-left bg-background/50 p-2.5 rounded-xl border border-surface-border text-xs space-y-1">
              <label className="text-[11px] text-slate-400 font-semibold block">
                Địa chỉ IP Wi-Fi của máy tính:
              </label>
              <select
                value={selectedIp}
                onChange={(e) => setSelectedIp(e.target.value)}
                className="w-full bg-surface border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-primary"
              >
                {syncInfo.ips.map(ip => (
                  <option key={ip} value={ip}>
                    {ip} {ip.startsWith('192.168.') ? '(Mạng Wi-Fi chính)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Step-by-step instructions */}
          <div className="w-full bg-background/60 p-3 rounded-xl border border-surface-border/60 text-left space-y-1.5">
            <div className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
              <Smartphone className="w-4 h-4 text-accent-cyan" />
              <span>Hướng dẫn trên điện thoại:</span>
            </div>
            <ol className="text-[11px] text-slate-300 space-y-1 list-decimal list-inside">
              <li>Mở app <b>Manga Notifier</b> trên điện thoại.</li>
              <li>Bấm nút <b>"Quét QR"</b> ở thanh điều hướng đáy.</li>
              <li>Hướng camera vào mã QR ở trên để hoàn tất.</li>
            </ol>
          </div>

          {/* Copy Link Section */}
          {syncMode === 'wifi' && currentSyncUrl && (
            <div className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-surface-border/40 text-[11px] text-slate-400">
              <span className="truncate max-w-[220px] font-mono text-[10px] text-slate-300">{currentSyncUrl}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(currentSyncUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="text-primary-light hover:underline flex items-center space-x-1 flex-shrink-0 ml-2 font-semibold"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Đã chép' : 'Sao chép Link'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-surface-border bg-surface-footer flex justify-end">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-surface-hover hover:bg-surface-border text-slate-200 text-xs font-semibold transition-all active:scale-95"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

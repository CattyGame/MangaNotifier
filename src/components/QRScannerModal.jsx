import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  X, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RefreshCw,
  Image,
  Link2,
  Download,
  Wifi
} from 'lucide-react';

export default function QRScannerModal({ isOpen, onClose, onSyncSuccess }) {
  const [activeTab, setActiveTab] = useState('camera'); // 'camera' | 'file' | 'link'
  const [scanning, setScanning] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);
  const [manualUrl, setManualUrl] = useState('');
  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const readerDivId = 'qr-reader-viewport-container';

  useEffect(() => {
    if (!isOpen || activeTab !== 'camera') {
      stopCameraScanner();
      return;
    }

    setErrorMsg(null);
    setSuccessInfo(null);
    setScanning(true);

    let html5QrCode = null;

    const startScanner = async () => {
      try {
        // Stop any previous instance
        if (scannerRef.current) {
          try {
            if (scannerRef.current.isScanning) await scannerRef.current.stop();
            await scannerRef.current.clear();
          } catch (e) {}
        }

        html5QrCode = new Html5Qrcode(readerDivId);
        scannerRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1.0
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          async (decodedText) => {
            console.log('[QRScanner] Đã quét được QR text:', decodedText);
            await handleDataSync(decodedText);
          },
          () => {}
        );
      } catch (err) {
        console.warn('[QRScanner] Lỗi khởi động camera:', err);
        setErrorMsg('Không thể mở camera. Bạn có thể chọn quét từ ảnh QR hoặc dán link đồng bộ bên dưới.');
        setScanning(false);
      }
    };

    const timer = setTimeout(() => {
      startScanner();
    }, 250);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      stopCameraScanner();
    };
  }, [isOpen, activeTab]);

  const stopCameraScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (e) {
        console.warn('[QRScanner] Lỗi stop scanner:', e);
      } finally {
        scannerRef.current = null;
      }
    }
  };

  const handleClose = async () => {
    await stopCameraScanner();
    onClose();
  };

  const handleDataSync = async (rawInput) => {
    await stopCameraScanner();
    setScanning(false);
    setSyncing(true);
    setErrorMsg(null);

    try {
      let backupData = null;
      const text = String(rawInput || '').trim();

      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        parsed = null;
      }

      // Get local Mobile database
      let localMobileData = null;
      if (window.electronAPI?.exportBackup) {
        localMobileData = await window.electronAPI.exportBackup();
      } else {
        const raw = localStorage.getItem('manga_notifier_db');
        localMobileData = raw ? JSON.parse(raw) : { mangas: [], history: [] };
      }

      let mergedData = null;

      // Smart Fetch function with Capacitor Native HTTP fallback
      const smartPost = async (url, payload) => {
        try {
          const { CapacitorHttp } = await import('@capacitor/core');
          if (CapacitorHttp) {
            const resp = await CapacitorHttp.request({
              url,
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              data: payload,
              connectTimeout: 4000,
              readTimeout: 6000
            });
            if (resp.status >= 200 && resp.status < 300) {
              return typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
            }
          }
        } catch (e) {}

        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(4000)
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      };

      if (parsed) {
        if (parsed.type === 'manga_notifier_offline' && parsed.data) {
          // 100% Offline QR code: local merge
          if (window.electronAPI?.importBackup) {
            mergedData = await window.electronAPI.importBackup(parsed.data);
          } else {
            mergedData = parsed.data;
            localStorage.setItem('manga_notifier_db', JSON.stringify(mergedData));
          }
        } else if (parsed.type === 'manga_notifier_sync') {
          // 2-Way Wi-Fi & USB Sync: Send Mobile DB to PC & get unified merged DB back
          const rawUrls = Array.isArray(parsed.urls) && parsed.urls.length > 0
            ? parsed.urls
            : [parsed.url];
          
          // Generate candidate URLs (including USB loopback and Wi-Fi IPs)
          const port = parsed.port || 45678;
          const token = parsed.token || '';
          const candidateSet = new Set(rawUrls.map(u => u.replace(/\/api\/sync(?:\?|$)/, '/api/sync/catchup$1')));
          candidateSet.add(`http://127.0.0.1:${port}/api/sync/catchup?token=${token}`);
          candidateSet.add(`http://localhost:${port}/api/sync/catchup?token=${token}`);
          candidateSet.add(`http://10.0.2.2:${port}/api/sync/catchup?token=${token}`);
          if (parsed.ip) {
            candidateSet.add(`http://${parsed.ip}:${port}/api/sync/catchup?token=${token}`);
          }

          const candidateList = Array.from(candidateSet).filter(Boolean);

          // Try candidates in fast parallel race
          try {
            mergedData = await Promise.any(
              candidateList.map(url => smartPost(url, localMobileData))
            );
          } catch (raceErr) {
            console.warn('[QRScanner] Thử nghiệm song song thất bại, thử tuần tự:', raceErr);
            for (const u of candidateList) {
              try {
                mergedData = await smartPost(u, localMobileData);
                if (mergedData) break;
              } catch (e) {}
            }
          }

          if (!mergedData) {
            throw new Error(`Không thể kết nối đến máy tính (${parsed.ip || 'Wi-Fi/USB'}). Hãy đảm bảo máy tính đã mở Manga Notifier và cùng mạng Wi-Fi.`);
          }
        } else if (parsed.mangas) {
          if (window.electronAPI?.importBackup) {
            mergedData = await window.electronAPI.importBackup(parsed);
          } else {
            mergedData = parsed;
          }
        }
      } else if (text.startsWith('http://') || text.startsWith('https://')) {
        try {
          const resp = await fetch(text, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localMobileData),
            signal: AbortSignal.timeout(8000)
          });
          if (resp.ok) {
            mergedData = await resp.json();
          } else {
            const getResp = await fetch(text, { signal: AbortSignal.timeout(6000) });
            if (getResp.ok) {
              const pcData = await getResp.json();
              if (window.electronAPI?.importBackup) {
                mergedData = await window.electronAPI.importBackup(pcData);
              }
            }
          }
        } catch (fetchErr) {
          throw new Error(`Không thể kết nối đến link: ${fetchErr.message}. Vui lòng kiểm tra IP máy tính.`);
        }
      } else {
        throw new Error('Mã QR hoặc Link không đúng định dạng Manga Notifier');
      }

      if (!mergedData || !Array.isArray(mergedData.mangas)) {
        throw new Error('Dữ liệu đồng bộ không hợp lệ');
      }

      // Save the merged data to LocalStorage / Database
      if (window.electronAPI?.importBackup) {
        await window.electronAPI.importBackup(mergedData);
      } else {
        localStorage.setItem('manga_notifier_db', JSON.stringify(mergedData));
      }

      // Automatically pair for continuous 2-way Wi-Fi WebSocket sync
      try {
        const { syncService } = await import('../services/syncService');
        syncService.pairWithPayload(text);
      } catch (e) {
        console.warn('[QRScanner] Lỗi lưu cấu hình ghép đôi:', e);
      }

      setSuccessInfo({
        count: mergedData.mangas.length,
        version: mergedData.version || '1.0.0'
      });

      if (onSyncSuccess) {
        onSyncSuccess(mergedData);
      }

      setTimeout(() => {
        handleClose();
      }, 1500);

    } catch (err) {
      console.error('[QRScanner] Lỗi đồng bộ dữ liệu:', err);
      setErrorMsg(err.message || 'Lỗi đồng bộ dữ liệu');
    } finally {
      setSyncing(false);
    }
  };

  const handleFileScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSyncing(true);
    setErrorMsg(null);
    try {
      const html5QrCode = new Html5Qrcode('qr-reader-file-temp');
      const decodedText = await html5QrCode.scanFile(file, true);
      await html5QrCode.clear();
      await handleDataSync(decodedText);
    } catch (err) {
      setSyncing(false);
      setErrorMsg('Không tìm thấy mã QR trong ảnh này. Vui lòng thử ảnh rõ nét hơn.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 select-none animate-fadeIn">
      <div 
        className="bg-surface border border-surface-border rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-scaleUp flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-surface-border flex items-center justify-between bg-surface-header">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Đồng bộ từ Máy tính</h3>
              <p className="text-[11px] text-slate-400">Quét QR hoặc dán link Wi-Fi nội bộ</p>
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-surface-border bg-background/50 p-1.5 gap-1 text-xs">
          <button
            onClick={() => { setErrorMsg(null); setActiveTab('camera'); }}
            className={`flex-1 py-1.5 rounded-xl font-semibold flex items-center justify-center space-x-1.5 transition-all ${
              activeTab === 'camera' ? 'bg-primary text-white shadow-glow-primary' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera</span>
          </button>

          <button
            onClick={() => { setErrorMsg(null); setActiveTab('file'); }}
            className={`flex-1 py-1.5 rounded-xl font-semibold flex items-center justify-center space-x-1.5 transition-all ${
              activeTab === 'file' ? 'bg-primary text-white shadow-glow-primary' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Image className="w-3.5 h-3.5" />
            <span>Chọn ảnh QR</span>
          </button>

          <button
            onClick={() => { setErrorMsg(null); setActiveTab('link'); }}
            className={`flex-1 py-1.5 rounded-xl font-semibold flex items-center justify-center space-x-1.5 transition-all ${
              activeTab === 'link' ? 'bg-primary text-white shadow-glow-primary' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Nhập link</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 flex flex-col items-center justify-center relative min-h-[260px] bg-black/30 overflow-y-auto">
          
          {/* Hidden element for file scanning */}
          <div id="qr-reader-file-temp" className="hidden"></div>

          {/* Syncing Loader */}
          {syncing && (
            <div className="flex flex-col items-center justify-center space-y-3 p-6 text-center animate-fadeIn">
              <Loader2 className="w-10 h-10 text-accent-cyan animate-spin" />
              <p className="text-xs font-semibold text-slate-100">Đang kéo dữ liệu từ máy tính...</p>
              <p className="text-[11px] text-slate-400">Vui lòng chờ trong giây lát</p>
            </div>
          )}

          {/* Success State */}
          {successInfo && (
            <div className="flex flex-col items-center justify-center space-y-3 p-6 text-center animate-scaleUp">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shadow-glow-emerald">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-base font-bold text-white">Đồng bộ thành công!</h4>
              <p className="text-xs text-slate-300">
                Đã nạp <b>{successInfo.count}</b> bộ truyện sang điện thoại.
              </p>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && !syncing && !successInfo && (
            <div className="flex flex-col items-center justify-center space-y-3 p-4 text-center animate-fadeIn w-full">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <p className="text-xs text-rose-300 font-medium px-2">{errorMsg}</p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    setErrorMsg(null);
                    if (activeTab === 'camera') setActiveTab('file');
                    else setActiveTab('camera');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-surface-hover hover:bg-surface-border text-slate-200 text-xs font-semibold flex items-center space-x-1.5 border border-surface-border"
                >
                  <Image className="w-3.5 h-3.5 text-accent-cyan" />
                  <span>Thử chọn ảnh QR</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 1: Camera Scanner */}
          {activeTab === 'camera' && !syncing && !successInfo && (
            <div className="w-full flex flex-col items-center">
              <div 
                id={readerDivId} 
                className="w-full max-w-[240px] rounded-2xl overflow-hidden border-2 border-primary/50 shadow-inner bg-black"
              ></div>
              <p className="text-[11px] text-slate-400 mt-3 text-center">
                Hướng camera vào mã QR hiển thị trên màn hình PC.
              </p>
            </div>
          )}

          {/* TAB 2: File Picker */}
          {activeTab === 'file' && !syncing && !successInfo && (
            <div className="w-full flex flex-col items-center space-y-3 p-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/20 text-primary-light border border-primary/30 flex items-center justify-center">
                <Image className="w-7 h-7" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">Chọn ảnh chụp mã QR</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Chụp màn hình mã QR trên PC gửi qua Zalo/Drive rồi chọn ảnh tại đây.
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileScan}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-glow-primary flex items-center space-x-2 active:scale-95 transition-all"
              >
                <Image className="w-4 h-4" />
                <span>Chọn ảnh từ Thư viện</span>
              </button>
            </div>
          )}

          {/* TAB 3: Manual Link Input */}
          {activeTab === 'link' && !syncing && !successInfo && (
            <div className="w-full flex flex-col space-y-3 p-2">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-200 block">
                  Dán link đồng bộ Wi-Fi từ máy tính:
                </label>
                <p className="text-[11px] text-slate-400">
                  (Trên PC, bấm nút <b>"Sao chép Link"</b> dưới mã QR rồi dán vào đây)
                </p>
              </div>
              <input
                type="text"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="http://192.168.1.X:45678/api/sync?token=..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-surface-border focus:border-primary text-xs text-slate-100 placeholder-slate-500 outline-none"
              />
              <button
                onClick={() => handleDataSync(manualUrl)}
                disabled={!manualUrl.trim()}
                className="w-full py-2.5 rounded-xl bg-accent-cyan text-slate-900 hover:bg-cyan-300 text-xs font-bold shadow-lg flex items-center justify-center space-x-1.5 disabled:opacity-40 transition-all active:scale-95"
              >
                <Wifi className="w-4 h-4" />
                <span>Bắt đầu đồng bộ</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-surface-border bg-surface-footer flex justify-end">
          <button
            onClick={handleClose}
            className="w-full py-2.5 rounded-xl bg-surface-hover hover:bg-surface-border text-slate-200 text-xs font-semibold transition-all active:scale-95"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

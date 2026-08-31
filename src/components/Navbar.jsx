import React from 'react';
import { 
  BookOpen, 
  Search, 
  RotateCw, 
  Settings, 
  Bell, 
  Plus, 
  Layers, 
  QrCode, 
  Camera,
  Undo2
} from 'lucide-react';

export default function Navbar({ 
  onOpenSearch, 
  onOpenSettings, 
  onOpenHistory, 
  onOpenQRSync,
  onOpenQRScanner,
  onCheckAll, 
  pollStatus,
  unreadNotificationsCount,
  canRollback,
  onRollback
}) {
  const isDesktop = typeof window !== 'undefined' && !!(window.electronAPI?.isDesktop);

  return (
    <header className="h-16 border-b border-surface-border bg-surface/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 select-none flex-shrink-0">
      {/* Brand Logo */}
      <div className="flex items-center space-x-2.5 sm:space-x-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-primary to-accent-cyan p-0.5 shadow-glow-primary flex items-center justify-center flex-shrink-0">
          <div className="w-full h-full bg-surface rounded-[10px] flex items-center justify-center">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-primary-light" />
          </div>
        </div>
        <div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-primary-light bg-clip-text text-transparent leading-tight">
            Manga Notifier
          </h1>
          <p className="hidden sm:block text-[11px] text-slate-400 font-medium">
            Theo dõi & Thông báo chương mới
          </p>
        </div>
      </div>

      {/* Action Center */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Polling Indicator (Desktop) */}
        <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-surface-border/50 border border-surface-border text-xs text-slate-400">
          <span className={`w-2 h-2 rounded-full ${pollStatus?.isChecking ? 'bg-accent-cyan animate-ping' : 'bg-accent-emerald'}`}></span>
          <span>{pollStatus?.message || 'Chạy ngầm sẵn sàng'}</span>
        </div>

        {/* QR Sync Trigger */}
        {isDesktop ? (
          <button
            onClick={onOpenQRSync}
            className="hidden sm:flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-surface-hover hover:bg-surface-border text-slate-200 border border-surface-border transition-all active:scale-95"
            title="Đồng bộ dữ liệu sang điện thoại qua mã QR"
          >
            <QrCode className="w-3.5 h-3.5 text-accent-cyan" />
            <span>Đồng bộ QR</span>
          </button>
        ) : (
          <button
            onClick={onOpenQRScanner}
            className="hidden sm:flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-accent-cyan/15 hover:bg-accent-cyan/25 text-accent-cyan border border-accent-cyan/30 transition-all active:scale-95"
            title="Quét mã QR từ máy tính"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Quét QR</span>
          </button>
        )}

        {/* Mobile Rollback Button */}
        {canRollback && (
          <button
            onClick={onRollback}
            className="flex md:hidden items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold active:scale-95 transition-all shadow-sm"
            title="Quay lại danh sách ban đầu"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Quay lại</span>
          </button>
        )}

        {/* Manual Refresh Button */}
        <button
          onClick={onCheckAll}
          disabled={pollStatus?.isChecking}
          className={`flex items-center space-x-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 ${
            pollStatus?.isChecking 
              ? 'bg-surface-border text-slate-400 border-surface-border cursor-not-allowed'
              : 'bg-surface-hover hover:bg-surface-border text-slate-200 border-surface-border hover:border-slate-600 active:scale-95'
          }`}
          title="Kiểm tra tất cả truyện ngay bây giờ"
        >
          <RotateCw className={`w-3.5 h-3.5 ${pollStatus?.isChecking ? 'animate-spin text-accent-cyan' : ''}`} />
          <span className="hidden sm:inline">Kiểm tra</span>
        </button>

        {/* Add Manga Button */}
        <button
          onClick={onOpenSearch}
          className="flex items-center space-x-1.5 px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-primary-dark hover:from-primary-hover hover:to-primary text-white text-xs font-semibold shadow-glow-primary active:scale-95 transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Thêm truyện</span>
        </button>

        {/* History Notifications */}
        <button
          onClick={onOpenHistory}
          className="relative p-2 sm:p-2.5 rounded-xl bg-surface-hover hover:bg-surface-border text-slate-300 hover:text-white border border-surface-border transition-all active:scale-95"
          title="Lịch sử thông báo"
        >
          <Bell className="w-4 h-4" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-accent-rose text-white text-[9px] sm:text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse-badge">
              {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
            </span>
          )}
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="p-2 sm:p-2.5 rounded-xl bg-surface-hover hover:bg-surface-border text-slate-300 hover:text-white border border-surface-border transition-all active:scale-95"
          title="Cài đặt hệ thống"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

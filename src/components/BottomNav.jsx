import React from 'react';
import { 
  Library, 
  Sparkles, 
  Plus, 
  Camera, 
  Settings, 
  Bell 
} from 'lucide-react';

export default function BottomNav({ 
  currentTab, 
  onSelectTab, 
  onOpenSearch, 
  onOpenQRScanner, 
  onOpenSettings,
  unreadCount = 0 
}) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-xl border-t border-surface-border px-3 py-2 flex items-center justify-around select-none safe-area-bottom shadow-2xl">
      
      {/* 1. All Manga */}
      <button
        onClick={() => onSelectTab('all')}
        className={`flex flex-col items-center justify-center p-1.5 rounded-2xl transition-all ${
          currentTab === 'all' ? 'text-primary-light scale-105' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <div className={`p-1.5 rounded-xl ${currentTab === 'all' ? 'bg-primary/20 shadow-glow-primary' : ''}`}>
          <Library className="w-5 h-5" />
        </div>
        <span className="text-[10px] font-semibold mt-0.5">Thư viện</span>
      </button>

      {/* 2. Unread / New */}
      <button
        onClick={() => onSelectTab('unread')}
        className={`flex flex-col items-center justify-center p-1.5 rounded-2xl relative transition-all ${
          currentTab === 'unread' ? 'text-accent-rose scale-105' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <div className={`p-1.5 rounded-xl ${currentTab === 'unread' ? 'bg-accent-rose/20' : ''}`}>
          <Sparkles className="w-5 h-5" />
        </div>
        <span className="text-[10px] font-semibold mt-0.5">Chap mới</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-2 w-4 h-4 bg-accent-rose text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* 3. Add Manga (Floating Center Button) */}
      <button
        onClick={onOpenSearch}
        className="flex flex-col items-center justify-center -mt-5"
        title="Thêm truyện mới"
      >
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-accent-cyan text-white flex items-center justify-center shadow-lg shadow-primary/40 active:scale-95 transition-transform">
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </div>
        <span className="text-[10px] font-bold text-slate-200 mt-1">Thêm</span>
      </button>

      {/* 4. QR Scanner */}
      <button
        onClick={onOpenQRScanner}
        className="flex flex-col items-center justify-center p-1.5 rounded-2xl text-slate-400 hover:text-accent-cyan transition-all"
        title="Quét mã QR từ máy tính"
      >
        <div className="p-1.5 rounded-xl hover:bg-accent-cyan/20">
          <Camera className="w-5 h-5" />
        </div>
        <span className="text-[10px] font-semibold mt-0.5">Quét QR</span>
      </button>

      {/* 5. Settings */}
      <button
        onClick={onOpenSettings}
        className="flex flex-col items-center justify-center p-1.5 rounded-2xl text-slate-400 hover:text-slate-200 transition-all"
      >
        <div className="p-1.5 rounded-xl">
          <Settings className="w-5 h-5" />
        </div>
        <span className="text-[10px] font-semibold mt-0.5">Cài đặt</span>
      </button>
    </nav>
  );
}

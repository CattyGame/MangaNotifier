import React from 'react';
import { 
  X, 
  Bell, 
  Trash2, 
  BookOpen, 
  Clock, 
  ExternalLink,
  Sparkles
} from 'lucide-react';

export default function HistoryModal({ 
  isOpen, 
  onClose, 
  history = [], 
  onClearHistory, 
  onOpenReaderFromHistory,
  onOpenExternal 
}) {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-xl bg-surface border border-surface-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-accent-rose/20 border border-accent-rose/30 flex items-center justify-center">
              <Bell className="w-4 h-4 text-accent-rose" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Lịch sử thông báo</h2>
              <p className="text-xs text-slate-400">Các chương truyện mới được phát hiện gần đây</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {history.length > 0 && (
              <button
                onClick={onClearHistory}
                className="p-1.5 rounded-lg text-slate-400 hover:text-accent-rose hover:bg-surface-hover transition-colors"
                title="Xóa tất cả lịch sử"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-hover transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-2.5">
          {history.length > 0 ? (
            history.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-xl bg-surface-hover/60 hover:bg-surface-hover border border-surface-border transition-all"
              >
                <div className="flex items-center space-x-3 overflow-hidden">
                  <img
                    src={item.cover || 'https://placehold.co/100x150/1e293b/a78bfa?text=No+Cover'}
                    alt={item.mangaTitle}
                    className="w-11 h-14 object-cover rounded-lg bg-slate-900 flex-shrink-0"
                    onError={(e) => { e.target.src = 'https://placehold.co/100x150/1e293b/a78bfa?text=Cover+Error'; }}
                  />

                  <div className="overflow-hidden">
                    <h4 className="text-xs font-bold text-slate-100 truncate" title={item.mangaTitle}>
                      {item.mangaTitle}
                    </h4>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className="text-xs font-semibold text-primary-light truncate">
                        {item.chapterTitle}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-surface-border text-slate-400">
                        {item.pluginName || 'Web'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 flex items-center space-x-1 mt-1">
                      <Clock className="w-3 h-3 inline" />
                      <span>{new Date(item.timestamp).toLocaleString('vi-VN')}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-3 flex-shrink-0">
                  <button
                    onClick={() => {
                      onOpenReaderFromHistory(item);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-primary/20 hover:bg-primary text-primary-light hover:text-white text-xs font-semibold transition-all flex items-center space-x-1"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Đọc</span>
                  </button>

                  <button
                    onClick={() => onOpenExternal(item.chapterUrl)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-accent-cyan hover:bg-surface-border transition-colors"
                    title="Mở trên web"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
              <Bell className="w-8 h-8 opacity-30" />
              <span>Chưa có thông báo chương mới nào</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

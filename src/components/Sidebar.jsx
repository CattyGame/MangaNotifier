import React from 'react';
import { 
  Library, 
  Sparkles, 
  Bookmark, 
  Heart, 
  CheckCircle2, 
  Clock, 
  PauseCircle,
  Globe2,
  Filter,
  Layers
} from 'lucide-react';

export default function Sidebar({ 
  currentTab, 
  onSelectTab, 
  selectedPluginFilter,
  onSelectPluginFilter,
  mangas = [], 
  plugins = [] 
}) {
  const isCompleted = (m) => m.tag === 'completed' || (m.status && /hoàn thành|completed|trọn bộ|end/i.test(m.status));
  const isOnHold = (m) => m.tag === 'on_hold' || (m.status && /tạm ngưng|tạm dừng|tạm hoãn|hiatus|cancelled|drop/i.test(m.status));
  const isFavorite = (m) => m.tag === 'favorite' || m.isFavorite;
  const isReading = (m) => !isCompleted(m) && !isOnHold(m);

  const countAll = mangas.length;
  const countUnread = mangas.filter(m => m.hasUnread).length;
  const countReading = mangas.filter(isReading).length;
  const countCompleted = mangas.filter(isCompleted).length;
  const countOnHold = mangas.filter(isOnHold).length;
  const countFavorite = mangas.filter(isFavorite).length;

  const navItems = [
    { id: 'all', label: 'Tất cả truyện', icon: Library, count: countAll, color: 'text-slate-300' },
    { 
      id: 'unread', 
      label: 'Có chap mới', 
      icon: Sparkles, 
      count: countUnread, 
      badgeColor: 'bg-accent-rose text-white animate-pulse-badge',
      color: 'text-accent-rose' 
    },
    { id: 'reading', label: 'Đang tiếp tục', icon: Bookmark, count: countReading, color: 'text-primary-light' },
    { id: 'completed', label: 'Đã hoàn thành', icon: CheckCircle2, count: countCompleted, color: 'text-accent-emerald' },
    { id: 'on_hold', label: 'Tạm ngưng / Tạm dừng', icon: PauseCircle, count: countOnHold, color: 'text-purple-400' },
    { id: 'favorite', label: 'Yêu thích', icon: Heart, count: countFavorite, color: 'text-rose-400' },
  ];

  const defaultPlugins = [
    { id: 'mangadex', name: 'MangaDex' },
    { id: 'truyenqq', name: 'TruyenQQ' },
    { id: 'goctruyentranh', name: 'Góc Truyện' },
    { id: 'moetruyen', name: 'MoeTruyen' }
  ];

  const activePlugins = plugins.length > 0 ? plugins : defaultPlugins;

  return (
    <aside className="hidden md:flex w-64 border-r border-surface-border bg-surface/50 p-4 flex-col justify-between h-[calc(100vh-4rem)] select-none overflow-y-auto custom-scrollbar flex-shrink-0">
      <div className="space-y-6">
        {/* Category Filter Section */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2 px-3 text-xs font-bold uppercase tracking-wider text-slate-400">
            <Filter className="w-3.5 h-3.5 text-primary-light" />
            <span>Phân loại theo dõi</span>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 ${
                    isActive
                      ? 'bg-primary/20 border border-primary/40 text-white shadow-glow-primary'
                      : 'text-slate-300 hover:bg-surface-hover hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-primary-light' : item.color}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.count > 0 && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.badgeColor 
                          ? item.badgeColor 
                          : isActive 
                            ? 'bg-primary text-white' 
                            : 'bg-surface-border text-slate-400'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Source Plugin Filter Section */}
        <div className="space-y-2 pt-2 border-t border-surface-border/60">
          <div className="flex items-center justify-between px-3 text-xs font-bold uppercase tracking-wider text-slate-400">
            <div className="flex items-center space-x-2">
              <Globe2 className="w-3.5 h-3.5 text-accent-cyan" />
              <span>Nguồn truyện</span>
            </div>
            {selectedPluginFilter && (
              <button
                onClick={() => onSelectPluginFilter('')}
                className="text-[10px] text-primary-light hover:underline font-semibold"
              >
                Xóa lọc
              </button>
            )}
          </div>

          <div className="space-y-1">
            <button
              onClick={() => onSelectPluginFilter('')}
              className={`w-full px-3 py-1.5 rounded-xl text-left text-xs font-semibold transition-all flex items-center justify-between ${
                !selectedPluginFilter 
                  ? 'bg-surface-hover text-primary-light border border-surface-border font-bold' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-surface-hover/50'
              }`}
            >
              <span>Tất cả nguồn</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-border text-slate-400">{mangas.length}</span>
            </button>

            {activePlugins.map(p => {
              const isSelected = selectedPluginFilter === p.id;
              const countForPlugin = mangas.filter(m => m.pluginId === p.id).length;

              return (
                <button
                  key={p.id}
                  onClick={() => onSelectPluginFilter(isSelected ? '' : p.id)}
                  className={`w-full px-3 py-1.5 rounded-xl text-left text-xs font-medium transition-all flex items-center justify-between ${
                    isSelected 
                      ? 'bg-primary/20 text-white border border-primary/30 font-bold' 
                      : 'text-slate-300 hover:text-white hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-emerald"></span>
                    <span>{p.name}</span>
                  </div>
                  {countForPlugin > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-border text-slate-400">
                      {countForPlugin}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-surface-border/60 text-[11px] text-slate-500 text-center space-y-1">
        <p className="font-semibold text-slate-400">Manga Notifier</p>
        <p>Hỗ trợ 4 nguồn truyện chính</p>
      </div>
    </aside>
  );
}

import React, { useState } from 'react';
import { 
  BookOpen, 
  ExternalLink, 
  Trash2, 
  Check, 
  Heart, 
  List,
  Sparkles,
  Bookmark,
  Clock,
  PauseCircle,
  CheckCircle2,
  RotateCw,
  Loader2
} from 'lucide-react';

function MangaCard({ 
  manga, 
  onOpenReader, 
  onOpenDetails, 
  onDelete, 
  onMarkAllRead,
  onUpdateTag,
  onOpenExternal,
  onRefreshManga
}) {
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const getPluginBadge = (pluginId) => {
    switch (pluginId) {
      case 'mangadex':
        return { text: 'MangaDex', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
      case 'truyenqq':
        return { text: 'TruyenQQ', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' };
      case 'goctruyentranh':
        return { text: 'Góc Truyện', color: 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30' };
      case 'moetruyen':
        return { text: 'MoeTruyen', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' };
      default:
        return { text: pluginId || 'Web', color: 'bg-slate-700/50 text-slate-300 border-slate-600' };
    }
  };

  const getTagInfo = (tag) => {
    switch (tag) {
      case 'favorite':
        return { label: 'Yêu thích', icon: Heart, color: 'text-rose-400 bg-rose-500/15 border-rose-500/30' };
      case 'completed':
        return { label: 'Hoàn thành', icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' };
      case 'plan_to_read':
        return { label: 'Dự định đọc', icon: Clock, color: 'text-amber-400 bg-amber-500/15 border-amber-500/30' };
      case 'on_hold':
        return { label: 'Tạm ngưng', icon: PauseCircle, color: 'text-purple-400 bg-purple-500/15 border-purple-500/30' };
      case 'reading':
      default:
        return { label: 'Đang đọc', icon: Bookmark, color: 'text-primary-light bg-primary/15 border-primary/30' };
    }
  };

  const tagList = [
    { id: 'reading', label: 'Đang đọc', icon: Bookmark, color: 'text-primary-light' },
    { id: 'favorite', label: 'Yêu thích', icon: Heart, color: 'text-rose-400' },
    { id: 'completed', label: 'Hoàn thành', icon: CheckCircle2, color: 'text-emerald-400' },
    { id: 'plan_to_read', label: 'Dự định đọc', icon: Clock, color: 'text-amber-400' },
    { id: 'on_hold', label: 'Tạm ngưng', icon: PauseCircle, color: 'text-purple-400' },
  ];

  const badge = getPluginBadge(manga.pluginId);
  const currentTagInfo = getTagInfo(manga.tag);
  const TagIcon = currentTagInfo.icon;
  const latestChap = manga.latestChapter || (manga.chapters && manga.chapters[0]?.title) || 'Đang cập nhật';

  const unreadCount = (manga.chapters || []).filter(
    c => !(manga.readChapters || []).includes(c.id)
  ).length;

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete(manga.id);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const handleRefreshClick = async (e) => {
    e.stopPropagation();
    if (isRefreshing || !onRefreshManga) return;
    setIsRefreshing(true);
    try {
      await onRefreshManga(manga.id);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  return (
    <div 
      style={{ contentVisibility: 'auto', containIntrinsicSize: '340px' }}
      className="group relative bg-surface border border-surface-border rounded-2xl overflow-hidden shadow-lg hover:border-primary/50 hover:shadow-glow-primary transition-all duration-300 flex flex-col justify-between will-change-transform"
    >
      {/* Poster Image Container */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-900">
        <img
          src={manga.cover || 'https://placehold.co/300x450/1e293b/a78bfa?text=No+Cover'}
          alt={manga.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 will-change-transform"
          onError={(e) => {
            e.target.src = 'https://placehold.co/300x450/1e293b/a78bfa?text=Cover+Error';
          }}
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-black/50 opacity-80 group-hover:opacity-90 transition-opacity"></div>

        {/* Top Badges & Action Buttons (High z-index to stay above hover overlay) */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-20 pointer-events-auto">
          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border backdrop-blur-md ${badge.color}`}>
            {badge.text}
          </span>

          <div className="flex items-center space-x-1.5">
            {manga.hasUnread && (
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-accent-rose text-white shadow-glow-rose animate-pulse-badge flex items-center space-x-1">
                <Sparkles className="w-3 h-3 inline" />
                <span>{unreadCount > 0 ? `${unreadCount} chap` : 'Mới'}</span>
              </span>
            )}

            {/* Quick Real-Time Refresh Button */}
            {onRefreshManga && (
              <button
                type="button"
                onClick={handleRefreshClick}
                disabled={isRefreshing}
                className="p-1.5 rounded-lg border backdrop-blur-md bg-black/60 text-slate-200 hover:text-white hover:bg-primary hover:border-primary border-white/20 transition-all duration-200 cursor-pointer disabled:opacity-50"
                title="Cập nhật trạng thái truyện này Real-time"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-primary-light' : ''}`} />
              </button>
            )}

            {/* Direct 1-Click Delete Button */}
            <button
              type="button"
              onClick={handleDeleteClick}
              className={`p-1.5 rounded-lg border backdrop-blur-md transition-all duration-200 cursor-pointer ${
                confirmDelete 
                  ? 'bg-rose-600 text-white border-rose-500 shadow-glow-rose scale-105' 
                  : 'bg-black/60 text-slate-200 hover:text-white hover:bg-rose-600 hover:border-rose-500 border-white/20'
              }`}
              title={confirmDelete ? 'Bấm lần nữa để xác nhận xóa' : 'Xóa truyện khỏi danh sách'}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Confirm Delete Banner */}
        {confirmDelete && (
          <div 
            onClick={handleDeleteClick}
            className="absolute inset-x-2 top-11 z-30 p-2 rounded-xl bg-rose-600/95 text-white text-[11px] font-bold text-center shadow-xl backdrop-blur-md cursor-pointer animate-fadeIn border border-rose-400 flex items-center justify-center space-x-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Nhấn để xác nhận XÓA!</span>
          </div>
        )}

        {/* Quick Read Overlay Button on Hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 bg-black/55 backdrop-blur-[2px]">
          <div className="flex flex-col gap-1.5 p-3 w-4/5">
            {/* Read Current / Ongoing Chapter or Newest */}
            {(() => {
              const currentReadChap = manga.lastReadChapter || (manga.lastReadChapterId ? (manga.chapters || []).find(c => c.id === manga.lastReadChapterId) : null);
              if (currentReadChap) {
                return (
                  <button
                    onClick={() => onOpenReader(manga, currentReadChap)}
                    className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-primary to-primary-dark hover:from-primary-hover hover:to-primary text-white text-[11px] font-bold shadow-glow-primary active:scale-95 transition-all flex items-center justify-center space-x-1.5"
                    title={`Đọc tiếp ${currentReadChap.title}`}
                  >
                    <Bookmark className="w-3.5 h-3.5 text-amber-300" />
                    <span className="truncate">Đọc tiếp ({currentReadChap.title})</span>
                  </button>
                );
              }
              return (
                <button
                  onClick={() => onOpenReader(manga)}
                  className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-primary to-primary-dark hover:from-primary-hover hover:to-primary text-white text-[11px] font-bold shadow-glow-primary active:scale-95 transition-all flex items-center justify-center space-x-1.5"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Đọc ngay</span>
                </button>
              );
            })()}

            {/* Read First Chapter */}
            {manga.chapters && manga.chapters.length > 0 && (
              <button
                onClick={() => {
                  const firstChap = manga.chapters[manga.chapters.length - 1];
                  onOpenReader(manga, firstChap);
                }}
                className="w-full py-1.5 px-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 text-white text-[11px] font-semibold transition-all flex items-center justify-center space-x-1.5"
                title="Đọc từ chương đầu tiên"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Đọc từ đầu (Chap 1)</span>
              </button>
            )}

            <button
              onClick={() => onOpenDetails(manga)}
              className="w-full py-1.5 px-3 rounded-xl bg-surface-hover/90 hover:bg-surface-border text-slate-200 text-[11px] font-semibold border border-surface-border transition-all flex items-center justify-center space-x-1.5"
            >
              <List className="w-3.5 h-3.5" />
              <span>Danh sách chap</span>
            </button>
          </div>
        </div>
      </div>

      {/* Manga Information */}
      <div className="p-3.5 flex flex-col justify-between flex-1">
        <div>
          <h3 
            onClick={() => onOpenDetails(manga)}
            className="font-bold text-sm text-slate-100 line-clamp-2 hover:text-primary-light transition-colors cursor-pointer" 
            title={manga.title}
          >
            {manga.title}
          </h3>

          <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
            {manga.author || 'Tác giả: Đang cập nhật'}
          </p>

          {/* Reading Chapter Status Banner */}
          <div className="mt-2 text-[11px] flex items-center space-x-1 text-slate-300 bg-surface-hover/60 px-2 py-1 rounded-lg border border-surface-border/40">
            <Bookmark className="w-3 h-3 text-amber-400 flex-shrink-0" />
            <span className="text-slate-400">Đang đọc:</span>
            <span className="font-semibold text-white truncate" title={manga.lastReadChapter?.title || (manga.lastReadChapterId ? (manga.chapters || []).find(c => c.id === manga.lastReadChapterId)?.title : 'Chưa đọc')}>
              {manga.lastReadChapter?.title || (manga.lastReadChapterId ? (manga.chapters || []).find(c => c.id === manga.lastReadChapterId)?.title : 'Chưa đọc')}
            </span>
          </div>

          {/* Quick Category / Tag Switcher Button */}
          <div className="relative mt-2">
            <button
              onClick={() => setShowTagMenu(!showTagMenu)}
              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${currentTagInfo.color} hover:brightness-110`}
              title="Nhấn để đổi phân loại truyện"
            >
              <TagIcon className="w-3 h-3" />
              <span>{currentTagInfo.label}</span>
            </button>

            {showTagMenu && (
              <>
                <div 
                  className="fixed inset-0 z-20" 
                  onClick={() => setShowTagMenu(false)}
                ></div>
                <div className="absolute left-0 bottom-8 w-40 bg-surface border border-surface-border rounded-xl shadow-2xl p-1 z-30 space-y-0.5 text-xs">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Phân loại truyện
                  </div>
                  {tagList.map(tagItem => {
                    const ItemIcon = tagItem.icon;
                    const isSelected = (manga.tag || 'reading') === tagItem.id;

                    return (
                      <button
                        key={tagItem.id}
                        onClick={() => {
                          onUpdateTag(manga.id, tagItem.id);
                          setShowTagMenu(false);
                        }}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-left flex items-center justify-between text-xs font-medium transition-colors ${
                          isSelected ? 'bg-primary/20 text-white font-bold' : 'text-slate-300 hover:bg-surface-hover'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <ItemIcon className={`w-3.5 h-3.5 ${tagItem.color}`} />
                          <span>{tagItem.label}</span>
                        </div>
                        {isSelected && <Check className="w-3 h-3 text-primary-light" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Latest Chapter Banner */}
        <div className="mt-3 pt-2.5 border-t border-surface-border/60 flex items-center justify-between">
          <div className="flex flex-col overflow-hidden pr-2">
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Chương mới nhất</span>
            <span 
              className="text-xs font-semibold text-primary-light line-clamp-1" 
              title={latestChap}
            >
              {latestChap}
            </span>
          </div>

          <button
            onClick={() => onOpenExternal(manga.url)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-accent-cyan hover:bg-surface-hover transition-colors flex-shrink-0"
            title="Mở trên trình duyệt"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(MangaCard);

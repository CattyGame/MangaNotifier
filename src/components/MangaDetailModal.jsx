import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  X, 
  BookOpen, 
  ExternalLink, 
  Check, 
  CheckCheck, 
  Search, 
  Clock, 
  Tag, 
  Layers,
  Sparkles,
  Trash2,
  Bookmark,
  Heart,
  CheckCircle2,
  PauseCircle,
  Globe, 
  RotateCw, 
  Loader2,
  Users,
  ArrowUpDown
} from 'lucide-react';

export default function MangaDetailModal({ 
  isOpen, 
  onClose, 
  manga, 
  onOpenReader, 
  onMarkChapterRead, 
  onMarkAllRead,
  onOpenExternal,
  onDelete,
  onUpdateTag,
  onRefreshManga
}) {
  const [searchChapter, setSearchChapter] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedLang, setSelectedLang] = useState('all'); // 'all' | 'vi' | 'en' | string
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' (mới nhất -> cũ nhất) | 'asc' (cũ nhất -> mới nhất)
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(60);
  const [selectedRange, setSelectedRange] = useState('all'); // 'all' | '0-50' | '50-100' ...
  const scrollContainerRef = useRef(null);

  // Keyboard shortcut: ESC to Close / Back
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Safe data extraction (called unconditionally)
  const chapters = Array.isArray(manga?.chapters) ? manga.chapters : [];
  const rawReadChapters = Array.isArray(manga?.readChapters) ? manga.readChapters : [];
  const readSet = useMemo(() => new Set(rawReadChapters.map(String)), [rawReadChapters]);

  // Sorted chapters based on user selection
  const sortedChapters = useMemo(() => {
    if (sortOrder === 'asc') {
      return [...chapters].reverse();
    }
    return chapters;
  }, [chapters, sortOrder]);

  // Detect available languages across chapters
  const { langCounts, availableLangCodes, hasMultipleLangs } = useMemo(() => {
    const counts = {};
    chapters.forEach(c => {
      if (!c) return;
      let code = c.lang;
      if (!code) {
        if (c.title?.includes('[VI]')) code = 'vi';
        else if (c.title?.includes('[EN]')) code = 'en';
        else if (c.title?.includes('[FR]')) code = 'fr';
        else if (c.title?.includes('[JA]')) code = 'ja';
      }
      if (code) {
        code = code.toLowerCase();
        counts[code] = (counts[code] || 0) + 1;
      }
    });
    const codes = Object.keys(counts);
    return { 
      langCounts: counts, 
      availableLangCodes: codes, 
      hasMultipleLangs: codes.length > 1 
    };
  }, [chapters]);

  // Filter chapters by language and search query
  const filteredChapters = useMemo(() => {
    return sortedChapters.filter(c => {
      if (!c) return false;
      if (selectedLang !== 'all') {
        let code = c.lang;
        if (!code) {
          if (c.title?.includes(`[${selectedLang.toUpperCase()}]`)) code = selectedLang;
        }
        if (code && code.toLowerCase() !== selectedLang.toLowerCase()) {
          return false;
        }
      }
      if (searchChapter.trim()) {
        return (c.title || '').toLowerCase().includes(searchChapter.toLowerCase());
      }
      return true;
    });
  }, [sortedChapters, selectedLang, searchChapter]);

  // Range chunking for long manga (e.g. > 70 chapters)
  const RANGE_SIZE = 50;
  const showRanges = filteredChapters.length > 70 && !searchChapter.trim();
  
  const ranges = useMemo(() => {
    if (!showRanges) return [];
    const total = filteredChapters.length;
    const result = [];
    for (let i = 0; i < total; i += RANGE_SIZE) {
      const end = Math.min(i + RANGE_SIZE, total);
      let label = '';
      if (sortOrder === 'desc') {
        // Newest first: e.g. 225 - 176, 175 - 126
        label = `${total - i} - ${total - end + 1}`;
      } else {
        // Oldest first: e.g. 1 - 50, 51 - 100
        label = `${i + 1} - ${end}`;
      }
      result.push({
        id: `${i}-${end}`,
        label,
        start: i,
        end
      });
    }
    return result;
  }, [filteredChapters.length, showRanges, sortOrder]);

  // Active chapters after range selection
  const rangeChapters = useMemo(() => {
    if (!showRanges || selectedRange === 'all') return filteredChapters;
    const foundRange = ranges.find(r => r.id === selectedRange);
    if (!foundRange) return filteredChapters;
    return filteredChapters.slice(foundRange.start, foundRange.end);
  }, [filteredChapters, selectedRange, showRanges, ranges]);

  const visibleChapters = useMemo(() => {
    return (rangeChapters || []).slice(0, visibleCount);
  }, [rangeChapters, visibleCount]);

  // Reset state when opening a new manga
  useEffect(() => {
    if (isOpen) {
      setVisibleCount(60);
      setSelectedRange('all');
      setSearchChapter('');
      setSelectedLang('all');
      setConfirmDelete(false);
      setSortOrder('desc');
    }
  }, [manga?.id, isOpen]);

  // Early return only AFTER all hooks have executed unconditionally
  if (!isOpen || !manga) return null;

  // Handle auto-load on scroll
  const handleScroll = (e) => {
    if (!e?.currentTarget) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 450) {
      if (visibleCount < rangeChapters.length) {
        setVisibleCount(prev => Math.min(prev + 60, rangeChapters.length));
      }
    }
  };

  const getLangLabel = (code) => {
    switch ((code || '').toLowerCase()) {
      case 'vi': return '🇻🇳 Tiếng Việt';
      case 'en': return '🇬🇧 English';
      case 'ja': return '🇯🇵 日本語';
      case 'fr': return '🇫🇷 Français';
      case 'es': return '🇪🇸 Español';
      case 'id': return '🇮🇩 Bahasa';
      case 'pt-br': return '🇧🇷 Português';
      case 'th': return '🇹🇭 ไทย';
      case 'de': return '🇩🇪 Deutsch';
      default: return `🌐 ${(code || '').toUpperCase()}`;
    }
  };

  const unreadCount = chapters.filter(c => {
    if (!c) return false;
    const id = String(c.id || c.url || '');
    return !readSet.has(id);
  }).length;

  const categories = [
    { id: 'reading', label: 'Đang theo dõi', icon: Bookmark, activeClass: 'bg-primary text-white border-primary shadow-glow-primary' },
    { id: 'favorite', label: 'Yêu thích', icon: Heart, activeClass: 'bg-rose-500 text-white border-rose-500 shadow-glow-rose' },
    { id: 'completed', label: 'Hoàn thành', icon: CheckCircle2, activeClass: 'bg-emerald-600 text-white border-emerald-500 shadow-glow-emerald' },
    { id: 'plan_to_read', label: 'Dự định đọc', icon: Clock, activeClass: 'bg-amber-600 text-white border-amber-500' },
    { id: 'on_hold', label: 'Tạm ngưng', icon: PauseCircle, activeClass: 'bg-purple-600 text-white border-purple-500' },
  ];

  const currentTag = manga.tag || 'reading';

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete?.(manga.id);
      onClose();
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 4000);
    }
  };

  const lastReadId = manga.lastReadChapterId || manga.lastReadChapter?.id || manga.lastReadChapter?.url;
  const currentReadChap = manga.lastReadChapter || (lastReadId ? chapters.find(c => (c.id && c.id === lastReadId) || (c.url && c.url === lastReadId)) : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="relative w-full max-w-4xl bg-surface border border-surface-border rounded-3xl shadow-2xl overflow-y-auto overscroll-contain max-h-[92vh] flex flex-col custom-scrollbar smooth-scroll-container"
      >
        {/* Header / Banner Area */}
        <div className="p-4 sm:p-6 border-b border-surface-border bg-gradient-to-b from-surface-hover/50 to-surface">
          <div className="flex flex-col sm:flex-row items-start space-y-4 sm:space-y-0 sm:space-x-6">
            {/* Poster Cover */}
            <div className="relative group flex-shrink-0 w-28 h-40 sm:w-36 sm:h-52 rounded-2xl overflow-hidden shadow-lg border border-surface-border bg-background mx-auto sm:mx-0">
              <img
                src={manga.cover || 'https://placehold.co/200x300/1e293b/a78bfa?text=No+Cover'}
                alt={manga.title || 'Manga Cover'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  e.target.src = 'https://placehold.co/200x300/1e293b/a78bfa?text=No+Cover';
                }}
              />
            </div>

            {/* Info & Actions */}
            <div className="flex-1 min-w-0 space-y-3 w-full">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    {/* Source Badge */}
                    {manga.pluginId && (
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide border ${
                        manga.pluginId === 'mangadex' 
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' 
                          : manga.pluginId === 'goctruyentranh'
                          ? 'bg-pink-500/15 text-pink-400 border-pink-500/30'
                          : manga.pluginId === 'moetruyen'
                          ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                          : manga.pluginId === 'truyenqq'
                          ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      }`}>
                        {manga.pluginId === 'mangadex' ? 'MangaDex' : manga.pluginId === 'goctruyentranh' ? 'Góc Truyện' : manga.pluginId === 'moetruyen' ? 'Mòe Truyện' : manga.pluginId === 'truyenqq' ? 'TruyenQQ' : manga.pluginId}
                      </span>
                    )}

                    {manga.status && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-surface-hover text-slate-400 border border-surface-border">
                        {manga.status}
                      </span>
                    )}
                  </div>

                  <h2 className="text-lg sm:text-xl font-bold text-slate-100 leading-tight">
                    {manga.title}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tác giả: <span className="text-slate-300 font-medium">{manga.author || 'Đang cập nhật'}</span>
                  </p>
                </div>

                <button
                  onClick={onClose}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-surface-hover transition-colors"
                  title="Đóng (ESC)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {manga.description && (
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed bg-background/50 p-2.5 rounded-xl border border-surface-border/50">
                  {manga.description}
                </p>
              )}

              {/* Tag Categories selector */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                  <Tag className="w-3 h-3 text-primary-light" />
                  <span>Phân loại truyện:</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => {
                    const Icon = cat.icon;
                    const isActive = currentTag === cat.id;

                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => onUpdateTag?.(manga.id, cat.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all border ${
                          isActive
                            ? cat.activeClass
                            : 'bg-surface-hover text-slate-400 hover:text-slate-200 border-surface-border'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Progress Counters & Quick Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
                {manga.lastReadChapterTitle ? (
                  <span className="px-2.5 py-1 rounded-lg bg-surface-hover text-slate-300 border border-surface-border flex items-center space-x-1">
                    <Bookmark className="w-3.5 h-3.5 text-primary-light" />
                    <span>Đang đọc: <b className="text-primary-light">{manga.lastReadChapterTitle}</b></span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-surface-hover text-slate-400 border border-surface-border">
                    Chưa bắt đầu đọc
                  </span>
                )}

                <span className="px-2.5 py-1 rounded-lg bg-surface-hover text-slate-300 border border-surface-border flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Mới nhất: <b className="text-slate-200">{manga.latestChapter || 'Đang cập nhật'}</b></span>
                </span>
              </div>

              {/* Main Action Buttons Bar */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {/* Continue reading or start reading */}
                {chapters.length > 0 && (
                  <button
                    onClick={() => {
                      const targetChapter = currentReadChap || chapters[chapters.length - 1];
                      if (targetChapter) {
                        onOpenReader(manga, targetChapter);
                        onClose();
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-glow-primary transition-all flex items-center space-x-1.5"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>{currentReadChap ? `Đọc tiếp (${currentReadChap.title})` : 'Bắt đầu đọc'}</span>
                  </button>
                )}

                {chapters.length > 0 && (
                  <button
                    onClick={() => {
                      const firstChapter = chapters[chapters.length - 1];
                      if (firstChapter) {
                        onOpenReader(manga, firstChapter);
                        onClose();
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-surface-hover hover:bg-surface-border text-slate-200 text-xs font-semibold transition-colors flex items-center space-x-1.5 border border-surface-border"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Đọc chương đầu tiên</span>
                  </button>
                )}

                {/* Read latest chap */}
                {chapters.length > 0 && (
                  <button
                    onClick={() => {
                      const latest = chapters[0];
                      if (latest) {
                        onOpenReader(manga, latest);
                        onClose();
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-surface-hover hover:bg-surface-border text-slate-200 text-xs font-semibold transition-colors flex items-center space-x-1.5 border border-surface-border"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-accent-rose" />
                    <span>Đọc chap mới nhất</span>
                  </button>
                )}

                {/* Refresh real-time */}
                <button
                  onClick={async () => {
                    if (isRefreshing) return;
                    setIsRefreshing(true);
                    try {
                      await onRefreshManga?.(manga.id);
                    } finally {
                      setIsRefreshing(false);
                    }
                  }}
                  disabled={isRefreshing}
                  className="px-3.5 py-1.5 rounded-xl bg-surface-hover hover:bg-surface-border text-slate-300 hover:text-white text-xs font-semibold transition-colors flex items-center space-x-1.5 border border-surface-border disabled:opacity-50"
                  title="Cào lại chương mới từ web ngay lập tức"
                >
                  <RotateCw className={`w-3.5 h-3.5 text-primary-light ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>{isRefreshing ? 'Đang cập nhật...' : 'Cập nhật Real-time'}</span>
                </button>

                {/* Mark all as read */}
                {unreadCount > 0 && (
                  <button
                    onClick={() => onMarkAllRead(manga.id)}
                    className="px-3.5 py-1.5 rounded-xl bg-accent-emerald/15 hover:bg-accent-emerald/25 text-accent-emerald text-xs font-semibold transition-colors flex items-center space-x-1.5 border border-accent-emerald/30"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Đánh dấu đọc hết</span>
                  </button>
                )}

                {/* Open in browser */}
                <button
                  onClick={() => onOpenExternal(manga.url)}
                  className="px-3.5 py-1.5 rounded-xl bg-surface-hover hover:bg-surface-border text-slate-300 hover:text-white text-xs font-semibold transition-colors flex items-center space-x-1.5 border border-surface-border"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
                  <span>Mở trên web gốc</span>
                </button>

                {/* Delete manga */}
                <button
                  onClick={handleDelete}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center space-x-1.5 border ${
                    confirmDelete
                      ? 'bg-rose-500 text-white border-rose-600 shadow-glow-rose animate-pulse'
                      : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/20'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{confirmDelete ? 'Xác nhận xóa?' : 'Xóa truyện'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Chapters Header & Search Toolbar */}
        <div className="p-4 sm:p-6 pb-2 border-b border-surface-border/80 flex flex-col space-y-3 sticky top-0 bg-surface/95 backdrop-blur-md z-20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-primary-light" />
              <h3 className="text-sm font-bold text-slate-200">
                Danh sách chương ({filteredChapters.length}/{chapters.length} chương)
              </h3>
            </div>

            {/* Fast chapter search & Sort Order Controls */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
                  setSelectedRange('all');
                  setVisibleCount(60);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-surface-hover hover:bg-surface-border text-slate-300 hover:text-white text-xs font-semibold transition-colors flex items-center space-x-1.5 border border-surface-border flex-shrink-0"
                title={sortOrder === 'desc' ? 'Đang xếp: Mới nhất trước. Bấm để đảo thứ tự' : 'Đang xếp: Cũ nhất trước. Bấm để đảo thứ tự'}
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-primary-light" />
                <span>{sortOrder === 'desc' ? 'Mới nhất trước' : 'Cũ nhất trước'}</span>
              </button>

              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Tìm nhanh chap..."
                  value={searchChapter}
                  onChange={(e) => {
                    setSearchChapter(e.target.value);
                    setVisibleCount(60);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 bg-background border border-surface-border rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:border-primary outline-none transition-colors"
                />
                {searchChapter && (
                  <button
                    onClick={() => setSearchChapter('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Chapter Ranges Bar for long manga (> 70 chapters) */}
          {showRanges && ranges.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto pb-1 custom-scrollbar text-xs">
              <span className="text-[11px] font-bold text-slate-400 flex-shrink-0 mr-1">
                Dải chương:
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedRange('all');
                  setVisibleCount(60);
                }}
                className={`px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap transition-all ${
                  selectedRange === 'all'
                    ? 'bg-primary text-white'
                    : 'bg-surface-hover text-slate-400 hover:text-slate-200 border border-surface-border'
                }`}
              >
                Tất cả
              </button>
              {ranges.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setSelectedRange(r.id);
                    setVisibleCount(60);
                  }}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium whitespace-nowrap transition-all ${
                    selectedRange === r.id
                      ? 'bg-primary text-white shadow-glow-primary font-bold'
                      : 'bg-surface-hover text-slate-300 hover:text-white border border-surface-border'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}

          {/* Language Filter Tabs Bar (Shown when manga has multiple languages or MangaDex) */}
          {(hasMultipleLangs || manga.pluginId === 'mangadex') && availableLangCodes.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 custom-scrollbar text-xs">
              <div className="text-[11px] font-bold text-slate-400 flex items-center space-x-1 pr-1 flex-shrink-0">
                <Globe className="w-3.5 h-3.5 text-primary-light" />
                <span>Bản dịch:</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedLang('all');
                  setVisibleCount(60);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  selectedLang === 'all'
                    ? 'bg-primary text-white shadow-glow-primary'
                    : 'bg-surface-hover text-slate-400 hover:text-slate-200 border border-surface-border'
                }`}
              >
                Tất cả ({chapters.length})
              </button>

              {availableLangCodes.map(code => (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setSelectedLang(code);
                    setVisibleCount(60);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-1 ${
                    selectedLang === code
                      ? 'bg-primary text-white shadow-glow-primary'
                      : 'bg-surface-hover text-slate-300 hover:text-white border border-surface-border'
                  }`}
                >
                  <span>{getLangLabel(code)}</span>
                  <span className="text-[10px] opacity-75">({langCounts[code]})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chapters List */}
        <div className="p-4 sm:p-6 space-y-1.5 flex-1">
          {visibleChapters.length > 0 ? (
            <>
              {visibleChapters.map((chapter, idx) => {
                if (!chapter) return null;
                const chapId = String(chapter.id || chapter.url || `chap_${idx}`);
                const isRead = readSet.has(chapId) || (chapter.id && readSet.has(String(chapter.id))) || (chapter.url && readSet.has(String(chapter.url)));

                return (
                  <div
                    key={chapId}
                    style={{ contentVisibility: 'auto', containIntrinsicSize: '54px' }}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                      isRead 
                        ? 'bg-surface/40 border-surface-border/50 opacity-70 hover:opacity-100 hover:bg-surface-hover/60'
                        : 'bg-surface-hover/80 border-primary/20 hover:border-primary/50 text-slate-100'
                    }`}
                  >
                    <div 
                      onClick={() => {
                        onOpenReader(manga, chapter);
                        onClose();
                      }}
                      className="flex-1 cursor-pointer pr-4"
                    >
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-semibold hover:text-primary-light transition-colors ${!isRead ? 'text-slate-100 font-bold' : 'text-slate-400'}`}>
                          {chapter.title}
                        </span>
                        {!isRead && (
                          <span className="w-2 h-2 rounded-full bg-accent-rose flex-shrink-0"></span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-0.5 text-[10px] text-slate-500">
                        {chapter.releaseTime && (
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3 inline text-slate-400" />
                            <span>{chapter.releaseTime}</span>
                          </span>
                        )}

                        {chapter.group && (
                          <span 
                            className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md bg-surface border border-surface-border text-primary-light font-medium"
                            title={`Nhóm dịch: ${chapter.group}`}
                          >
                            <Users className="w-2.5 h-2.5 opacity-80" />
                            <span className="truncate max-w-[130px] sm:max-w-[200px]">{chapter.group}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onMarkChapterRead(manga.id, chapter.id || chapter.url, chapter.title)}
                        className={`p-1.5 rounded-lg text-xs transition-colors ${
                          isRead 
                            ? 'text-accent-emerald bg-accent-emerald/10 hover:bg-accent-emerald/20' 
                            : 'text-slate-400 hover:text-slate-200 hover:bg-surface-border'
                        }`}
                        title={isRead ? 'Đã đọc' : 'Đánh dấu đã đọc'}
                      >
                        <Check className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          onOpenReader(manga, chapter);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-lg bg-primary/20 hover:bg-primary text-primary-light hover:text-white text-xs font-semibold transition-all flex items-center space-x-1"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Đọc</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Load More Button / Progress Indicator */}
              {visibleCount < rangeChapters.length && (
                <div className="pt-3 pb-1 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount(prev => Math.min(prev + 100, rangeChapters.length))}
                    className="px-4 py-2 rounded-xl bg-surface-hover hover:bg-surface-border text-slate-300 hover:text-white text-xs font-semibold border border-surface-border transition-colors shadow-sm"
                  >
                    Xem thêm các chương tiếp theo ({visibleCount}/{rangeChapters.length})
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="py-8 text-center text-slate-500 text-xs">
              Không tìm thấy chương nào phù hợp
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

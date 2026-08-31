import React, { useState } from 'react';
import { 
  X, 
  Search, 
  Link2, 
  Plus, 
  Check, 
  Loader2, 
  Globe, 
  Sparkles,
  BookOpen
} from 'lucide-react';

// Helper to get formatted source badge
const getPluginBadge = (pluginId, url = '') => {
  const pId = (pluginId || '').toLowerCase();
  const u = (url || '').toLowerCase();

  if (pId === 'mangadex' || u.includes('mangadex')) {
    return { name: 'MangaDex', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' };
  }
  if (pId === 'truyenqq' || u.includes('truyenqq')) {
    return { name: 'TruyenQQ', color: 'bg-sky-500/15 text-sky-400 border-sky-500/30' };
  }
  if (pId === 'goctruyentranh' || u.includes('goctruyentranh') || /goctruyentranhvui\d*/.test(u)) {
    return { name: 'Góc Truyện', color: 'bg-pink-500/15 text-pink-400 border-pink-500/30' };
  }
  if (pId === 'moetruyen' || u.includes('moetruyen') || u.includes('truyen.moe')) {
    return { name: 'Mòe Truyện', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
  }
  if (pId === 'blogtruyen' || u.includes('blogtruyen')) {
    return { name: 'BlogTruyen', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
  }
  if (pId === 'nettruyen' || u.includes('nettruyen')) {
    return { name: 'NetTruyen', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
  }
  return { name: pluginId || 'Web', color: 'bg-slate-700/40 text-slate-300 border-slate-600/30' };
};

export default function SearchModal({ 
  isOpen, 
  onClose, 
  onAddManga, 
  existingMangaUrls = [], 
  plugins = [] 
}) {
  const [activeTab, setActiveTab] = useState('search'); // 'search' | 'url'
  const [keyword, setKeyword] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [selectedPlugin, setSelectedPlugin] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [addedIds, setAddedIds] = useState(new Set());
  const [urlPreview, setUrlPreview] = useState(null);
  const [urlError, setUrlError] = useState('');

  // Keyboard shortcut: ESC to Close / Back
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

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!keyword.trim()) return;

    setIsSearching(true);
    setResults([]);
    try {
      if (window.electronAPI?.searchManga) {
        const data = await window.electronAPI.searchManga(keyword.trim(), selectedPlugin || null);
        setResults(data || []);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleFetchUrl = async (e) => {
    e?.preventDefault();
    if (!urlInput.trim()) return;

    setIsSearching(true);
    setUrlError('');
    setUrlPreview(null);

    try {
      if (window.electronAPI?.getMangaDetails) {
        const details = await window.electronAPI.getMangaDetails(urlInput.trim());
        setUrlPreview(details);
      }
    } catch (err) {
      setUrlError(err.message || 'Không thể lấy thông tin từ đường link này');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddFromSearch = async (item) => {
    try {
      let mangaToAdd = item;
      // If item does not have full chapters yet, fetch details
      if (!item.chapters && window.electronAPI?.getMangaDetails) {
        const fullDetails = await window.electronAPI.getMangaDetails(item.url);
        mangaToAdd = { ...item, ...fullDetails };
      }
      await onAddManga(mangaToAdd);
      setAddedIds(prev => new Set([...prev, item.id || item.url]));
    } catch (err) {
      console.error('Add manga error:', err);
    }
  };

  const handleAddFromUrl = async () => {
    if (!urlPreview) return;
    try {
      await onAddManga(urlPreview);
      setAddedIds(prev => new Set([...prev, urlPreview.id || urlPreview.url]));
      setUrlInput('');
      setUrlPreview(null);
      onClose();
    } catch (err) {
      setUrlError(err.message || 'Lỗi khi thêm truyện');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn select-none">
      <div className="relative w-full max-w-2xl bg-surface border border-surface-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-light" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Thêm truyện vào danh sách</h2>
              <p className="text-xs text-slate-400">Tìm kiếm trên các nguồn hoặc dán trực tiếp link truyện</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-surface-border px-6 bg-surface-hover/30">
          <button
            onClick={() => setActiveTab('search')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'search'
                ? 'border-primary text-primary-light'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Tìm kiếm từ khoá</span>
          </button>
          <button
            onClick={() => setActiveTab('url')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'url'
                ? 'border-primary text-primary-light'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Dán link truyện (URL)</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'search' ? (
            <div className="space-y-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="Nhập tên truyện (Ví dụ: One Piece, Solo Leveling, Conan...)"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-surface-border focus:border-primary focus:ring-1 focus:ring-primary text-xs text-slate-100 placeholder-slate-500 outline-none transition-all"
                    autoFocus
                  />
                </div>

                <select
                  value={selectedPlugin}
                  onChange={(e) => setSelectedPlugin(e.target.value)}
                  className="px-3 py-2.5 rounded-xl bg-background border border-surface-border text-xs text-slate-300 focus:border-primary outline-none cursor-pointer"
                >
                  <option value="">Tất cả nguồn</option>
                  {(plugins.length > 0 ? plugins : [
                    { id: 'mangadex', name: 'MangaDex' },
                    { id: 'truyenqq', name: 'TruyenQQ' },
                    { id: 'goctruyentranh', name: 'Góc Truyện' },
                    { id: 'moetruyen', name: 'MoeTruyen' }
                  ]).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-glow-primary active:scale-95 transition-all flex items-center space-x-1.5"
                >
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span>Tìm</span>
                  )}
                </button>
              </form>

              {/* Results List */}
              <div className="mt-4 space-y-2 max-h-96 overflow-y-auto pr-1">
                {results.length > 0 ? (
                  results.map((item) => {
                    const isAdded = addedIds.has(item.id || item.url) || existingMangaUrls.includes(item.url);
                    const sourceBadge = getPluginBadge(item.pluginId || item.pluginName, item.url);

                    return (
                      <div
                        key={item.id || item.url}
                        className="flex items-center justify-between p-3 rounded-xl bg-surface-hover/50 hover:bg-surface-hover border border-surface-border transition-all"
                      >
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <img
                            src={item.cover}
                            alt={item.title}
                            className="w-12 h-16 object-cover rounded-lg bg-slate-900 flex-shrink-0"
                            onError={(e) => { e.target.src = 'https://placehold.co/100x150/1e293b/a78bfa?text=No+Cover'; }}
                          />
                          <div className="overflow-hidden space-y-0.5">
                            <h4 className="text-xs font-bold text-slate-100 truncate" title={item.title}>
                              {item.title}
                            </h4>
                            <p className="text-[11px] text-slate-400 truncate">
                              {item.author ? `Tác giả: ${item.author}` : 'Tác giả: Đang cập nhật'}
                            </p>
                            
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                              {/* Source Badge */}
                              <span className={`text-[10px] px-2 py-0.5 rounded-md border font-bold flex items-center space-x-1 shadow-sm ${sourceBadge.color}`}>
                                <Globe className="w-2.5 h-2.5 opacity-80" />
                                <span>{sourceBadge.name}</span>
                              </span>

                              {/* Latest Chapter Badge */}
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary/20 text-primary-light border border-primary/30 font-semibold">
                                {item.latestChapter || 'Có sẵn'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleAddFromSearch(item)}
                          disabled={isAdded}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all flex-shrink-0 ml-3 ${
                            isAdded
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default'
                              : 'bg-primary hover:bg-primary-hover text-white shadow-glow-primary active:scale-95'
                          }`}
                        >
                          {isAdded ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Đã theo dõi</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>Theo dõi</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })
                ) : isSearching ? (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-primary-light" />
                    <span className="text-xs">Đang tìm kiếm trên các website truyện...</span>
                  </div>
                ) : keyword ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    Không tìm thấy truyện nào phù hợp với từ khóa "{keyword}". Bạn có thể thử dán link URL truyện trực tiếp.
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center space-y-2">
                    <BookOpen className="w-8 h-8 opacity-40" />
                    <span>Gõ tên truyện và bấm "Tìm" để khám phá</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <form onSubmit={handleFetchUrl} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Đường dẫn trang truyện (URL)</label>
                  <div className="relative">
                    <Link2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://truyenqq.com.vn/... hoặc https://goctruyentranhvui...com/... hoặc https://moetruyen.net/... hoặc MangaDex"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-background border border-surface-border focus:border-primary focus:ring-1 focus:ring-primary text-xs text-slate-100 placeholder-slate-500 outline-none transition-all"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Hỗ trợ: MangaDex, TruyenQQ, Góc Truyện Tranh (goctruyentranhvui41.com), MoeTruyen
                  </span>
                  <button
                    type="submit"
                    disabled={isSearching || !urlInput.trim()}
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-glow-primary active:scale-95 transition-all flex items-center space-x-1.5"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang nhận diện...</span>
                      </>
                    ) : (
                      <span>Kiểm tra link</span>
                    )}
                  </button>
                </div>
              </form>

              {urlError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {urlError}
                </div>
              )}

              {urlPreview && (
                <div className="mt-4 p-4 rounded-xl bg-surface-hover/60 border border-primary/30 space-y-4 animate-fadeIn">
                  <div className="flex space-x-4">
                    <img
                      src={urlPreview.cover}
                      alt={urlPreview.title}
                      className="w-20 h-28 object-cover rounded-lg bg-slate-900 flex-shrink-0"
                      onError={(e) => { e.target.src = 'https://placehold.co/100x150/1e293b/a78bfa?text=No+Cover'; }}
                    />
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-100">{urlPreview.title}</h4>
                      <p className="text-xs text-slate-400">Tác giả: {urlPreview.author || 'Đang cập nhật'}</p>
                      
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {(() => {
                          const previewBadge = getPluginBadge(urlPreview.pluginId, urlPreview.url || urlInput);
                          return (
                            <span className={`text-[10px] px-2 py-0.5 rounded-md border font-bold flex items-center space-x-1 shadow-sm ${previewBadge.color}`}>
                              <Globe className="w-2.5 h-2.5 opacity-80" />
                              <span>{previewBadge.name}</span>
                            </span>
                          );
                        })()}

                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-surface-hover text-slate-300 border border-surface-border font-semibold">
                          {urlPreview.status || 'Đang tiến hành'}
                        </span>

                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary/20 text-primary-light border border-primary/30 font-semibold">
                          {urlPreview.chapters ? `${urlPreview.chapters.length} chương` : 'Đang cập nhật'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleAddFromUrl}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-dark hover:from-primary-hover hover:to-primary text-white text-xs font-bold shadow-glow-primary active:scale-95 transition-all flex items-center justify-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Thêm vào danh sách theo dõi</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

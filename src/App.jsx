import React, { useState, useEffect, useRef, useCallback } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import MangaCard from './components/MangaCard';
import SearchModal from './components/SearchModal';
import MangaDetailModal from './components/MangaDetailModal';
import ReaderModal from './components/ReaderModal';
import SettingsModal from './components/SettingsModal';
import HistoryModal from './components/HistoryModal';
import BottomNav from './components/BottomNav';
import QRSyncModal from './components/QRSyncModal';
import QRScannerModal from './components/QRScannerModal';
import { NotificationService } from './services/notificationService';
import { App as CapApp } from '@capacitor/app';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Sparkles, 
  Filter, 
  Layers, 
  CheckCircle2,
  RefreshCw,
  Bookmark,
  Heart,
  Clock,
  PauseCircle,
  Globe2,
  ArrowUp,
  CheckCheck
} from 'lucide-react';

import { syncService } from './services/syncService';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const [mangas, setMangas] = useState([]);
  const [plugins, setPlugins] = useState([]);
  const [history, setHistory] = useState([]);
  const [settings, setSettings] = useState({});
  const [pollStatus, setPollStatus] = useState({ isChecking: false, message: 'Chạy ngầm sẵn sàng' });
  const [syncState, setSyncState] = useState({ status: 'disconnected', isPaired: false });

  // Filter & Search
  const [currentTab, setCurrentTab] = useState('all');
  const [selectedPluginFilter, setSelectedPluginFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // Modals state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isQRSyncOpen, setIsQRSyncOpen] = useState(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [selectedMangaDetails, setSelectedMangaDetails] = useState(null);
  
  // Reader state
  const [readerState, setReaderState] = useState({
    isOpen: false,
    manga: null,
    chapter: null
  });

  // Initial load & IPC listener subscriptions
  useEffect(() => {
    let unsubSyncStatus = null;
    let unsubSyncData = null;

    const initApp = async () => {
      // Connect 2-way Wi-Fi WebSocket sync in background
      try {
        syncService.connect();
        unsubSyncStatus = syncService.onStatusChange((st) => setSyncState(st));
        unsubSyncData = syncService.onDataUpdate((data) => {
          if (!data) return;
          if (Array.isArray(data.mangas)) {
            setMangas(data.mangas);
            if (window.electronAPI?.importBackup) {
              window.electronAPI.importBackup({ mangas: data.mangas });
            }
          } else if ((data.type === 'ADD_MANGA' || data.action === 'ADD_MANGA') && data.manga) {
            setMangas(prev => {
              const exists = prev.some(m => m.id === data.manga.id);
              if (exists) return prev.map(m => m.id === data.manga.id ? data.manga : m);
              return [data.manga, ...prev];
            });
            if (window.electronAPI?.addManga) {
              window.electronAPI.addManga(data.manga);
            }
          } else if ((data.type === 'DELETE_MANGA' || data.action === 'DELETE_MANGA') && data.mangaId) {
            setMangas(prev => prev.filter(m => m.id !== data.mangaId));
            if (window.electronAPI?.deleteManga) {
              window.electronAPI.deleteManga(data.mangaId);
            }
          } else if ((data.type === 'UPDATE_MANGA' || data.action === 'UPDATE_MANGA') && data.mangaId) {
            setMangas(prev => prev.map(m => m.id === data.mangaId ? { ...m, ...data.updates } : m));
            if (window.electronAPI?.updateManga) {
              window.electronAPI.updateManga(data.mangaId, data.updates);
            }
          } else if ((data.type === 'UPDATE_TAG' || data.action === 'UPDATE_TAG') && data.mangaId && data.tag) {
            setMangas(prev => prev.map(m => m.id === data.mangaId ? { ...m, tag: data.tag } : m));
            if (window.electronAPI?.updateManga) {
              window.electronAPI.updateManga(data.mangaId, { tag: data.tag });
            }
          } else if ((data.type === 'CHAPTER_READ' || data.action === 'CHAPTER_READ' || data.type === 'MARK_CHAPTER_READ') && data.mangaId && data.chapterId) {
            setMangas(prev => prev.map(m => {
              if (m.id === data.mangaId) {
                const readSet = new Set(m.readChapters || []);
                readSet.add(data.chapterId);
                return {
                  ...m,
                  readChapters: Array.from(readSet),
                  lastReadChapterId: data.chapterId,
                  lastReadChapterTitle: data.chapterTitle || m.lastReadChapterTitle,
                  hasUnread: (m.chapters || []).some(c => !readSet.has(c.id))
                };
              }
              return m;
            }));
            if (window.electronAPI?.markChapterRead) {
              window.electronAPI.markChapterRead(data.mangaId, data.chapterId, data.chapterTitle);
            }
          } else if ((data.type === 'MARK_ALL_READ' || data.action === 'MARK_ALL_READ') && data.mangaId) {
            setMangas(prev => prev.map(m => {
              if (m.id === data.mangaId) {
                const allIds = (m.chapters || []).map(c => c.id);
                return {
                  ...m,
                  readChapters: allIds,
                  hasUnread: false
                };
              }
              return m;
            }));
            if (window.electronAPI?.markAllChaptersRead) {
              window.electronAPI.markAllChaptersRead(data.mangaId);
            }
          } else {
            // Refresh from DB
            window.electronAPI?.getMangas().then(list => setMangas(list || []));
            window.electronAPI?.getHistory().then(hist => setHistory(hist || []));
          }
        });
      } catch (e) {
        console.warn('[App] Lỗi init syncService:', e);
      }

      if (window.electronAPI) {
        try {
          const [mangaList, pluginList, historyList, appSettings] = await Promise.all([
            window.electronAPI.getMangas(),
            window.electronAPI.getPlugins(),
            window.electronAPI.getHistory(),
            window.electronAPI.getSettings()
          ]);

          setMangas(mangaList || []);
          setPlugins(pluginList || []);
          setHistory(historyList || []);
          setSettings(appSettings || {});
        } catch (err) {
          console.error('Lỗi khi tải dữ liệu khởi tạo:', err);
        }

        // Subscriptions
        const unsubMangas = window.electronAPI.onMangasUpdated((updated) => setMangas(updated || []));
        const unsubSingleManga = window.electronAPI.onMangaUpdatedSingle?.((updatedManga) => {
          if (!updatedManga) return;
          setMangas(prev => prev.map(m => m.id === updatedManga.id ? updatedManga : m));
        });
        const unsubHistory = window.electronAPI.onHistoryUpdated((updated) => setHistory(updated || []));
        const unsubPoll = window.electronAPI.onPollStatus((status) => setPollStatus(status));
        const unsubOpenReader = window.electronAPI.onOpenReader((payload) => {
          const targetManga = mangas.find(m => m.id === payload.mangaId);
          if (targetManga) {
            const targetChap = (targetManga.chapters || []).find(c => c.id === payload.chapterId) || {
              id: payload.chapterId,
              url: payload.chapterUrl,
              title: payload.chapterTitle
            };
            setReaderState({
              isOpen: true,
              manga: targetManga,
              chapter: targetChap
            });
          }
        });

        return () => {
          unsubMangas?.();
          unsubSingleManga?.();
          unsubHistory?.();
          unsubPoll?.();
          unsubOpenReader?.();
          unsubSyncStatus?.();
          unsubSyncData?.();
        };
      } else {
        // Fallback demo data for browser preview
        console.log('Running in browser preview mode');
        setMangas([
          {
            id: 'mangadex_demo_1',
            title: 'Chainsaw Man',
            cover: 'https://uploads.mangadex.org/covers/a7774250-d072-4f10-aede-5e30fb271923/e8f1b26d-fb33-4f9e-a89e-26f68892f397.jpg.512.jpg',
            author: 'Fujimoto Tatsuki',
            pluginId: 'mangadex',
            latestChapter: 'Chapter 175',
            hasUnread: true,
            tag: 'reading',
            url: 'https://mangadex.org/title/a7774250-d072-4f10-aede-5e30fb271923',
            chapters: [
              { id: 'ch_175', title: 'Chapter 175: Massacre', url: 'https://mangadex.org', releaseTime: 'Hôm nay' },
              { id: 'ch_174', title: 'Chapter 174: Aging Devil', url: 'https://mangadex.org', releaseTime: 'Tuần trước' }
            ],
            readChapters: ['ch_174']
          }
        ]);
        setPlugins([
          { id: 'mangadex', name: 'MangaDex' },
          { id: 'truyenqq', name: 'TruyenQQ' },
          { id: 'goctruyentranh', name: 'Góc Truyện Tranh' },
          { id: 'moetruyen', name: 'MoeTruyen' }
        ]);
      }
    };

    initApp();
  }, []);

  // Android Hardware Back Button & Rollback Listener
  useEffect(() => {
    let listener = null;
    try {
      listener = CapApp.addListener('backButton', () => {
        if (readerState.isOpen) {
          setReaderState({ isOpen: false, manga: null, chapter: null });
        } else if (selectedMangaDetails) {
          setSelectedMangaDetails(null);
        } else if (isSettingsOpen) {
          setIsSettingsOpen(false);
        } else if (isHistoryOpen) {
          setIsHistoryOpen(false);
        } else if (isSearchOpen) {
          setIsSearchOpen(false);
        } else if (isQRScannerOpen) {
          setIsQRScannerOpen(false);
        } else if (isQRSyncOpen) {
          setIsQRSyncOpen(false);
        } else if (currentTab !== 'all' || searchFilter || selectedPluginFilter) {
          setCurrentTab('all');
          setSearchFilter('');
          setSelectedPluginFilter('');
        }
      });
    } catch (e) {}

    return () => {
      if (listener && typeof listener.remove === 'function') {
        listener.remove();
      }
    };
  }, [
    readerState.isOpen,
    selectedMangaDetails,
    isSettingsOpen,
    isHistoryOpen,
    isSearchOpen,
    isQRScannerOpen,
    isQRSyncOpen,
    currentTab,
    searchFilter,
    selectedPluginFilter
  ]);

  const canRollback = currentTab !== 'all' || searchFilter !== '' || selectedPluginFilter !== '';
  
  const handleRollback = () => {
    setCurrentTab('all');
    setSearchFilter('');
    setSelectedPluginFilter('');
  };

  // Manga Actions
  const handleAddManga = async (mangaData) => {
    if (window.electronAPI?.addManga) {
      const added = await window.electronAPI.addManga(mangaData);
      setMangas(prev => {
        const idx = prev.findIndex(m => m.id === added.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = added;
          return updated;
        }
        return [added, ...prev];
      });
    }
  };

  const handleDeleteManga = async (id) => {
    if (window.electronAPI?.deleteManga) {
      await window.electronAPI.deleteManga(id);
      setMangas(prev => prev.filter(m => m.id !== id));
      if (selectedMangaDetails?.id === id) {
        setSelectedMangaDetails(null);
      }
    }
  };

  const handleUpdateTag = async (id, tag) => {
    if (window.electronAPI?.updateManga) {
      const updated = await window.electronAPI.updateManga(id, { tag });
      setMangas(prev => prev.map(m => m.id === id ? { ...m, tag } : m));
      if (selectedMangaDetails?.id === id) {
        setSelectedMangaDetails(prev => prev ? { ...prev, tag } : null);
      }
    }
  };

  const handleMarkChapterRead = async (mangaId, chapterId) => {
    if (window.electronAPI?.markChapterRead) {
      const updated = await window.electronAPI.markChapterRead(mangaId, chapterId);
      if (updated && typeof updated === 'object') {
        setMangas(prev => prev.map(m => m.id === mangaId ? updated : m));
        if (selectedMangaDetails?.id === mangaId) {
          setSelectedMangaDetails(updated);
        }
      }
    }
  };

  const handleMarkAllRead = async (mangaId) => {
    if (window.electronAPI?.markAllChaptersRead) {
      const updated = await window.electronAPI.markAllChaptersRead(mangaId);
      if (updated && typeof updated === 'object') {
        setMangas(prev => prev.map(m => m.id === mangaId ? updated : m));
        if (selectedMangaDetails?.id === mangaId) {
          setSelectedMangaDetails(updated);
        }
      }
    }
  };

  const handleCheckAll = async () => {
    if (window.electronAPI?.checkAllNow) {
      await window.electronAPI.checkAllNow();
    }
  };

  const handleCheckSingleManga = async (mangaId) => {
    if (window.electronAPI?.checkMangaNow) {
      const updated = await window.electronAPI.checkMangaNow(mangaId);
      if (updated) {
        setMangas(prev => prev.map(m => m.id === mangaId ? updated : m));
        if (selectedMangaDetails?.id === mangaId) {
          setSelectedMangaDetails(updated);
        }
      }
      return updated;
    }
    return null;
  };

  // Reader Open Handler
  const handleOpenReader = (manga, chapter = null) => {
    const targetChap = chapter || (manga.chapters && manga.chapters[0]);
    if (!targetChap) return;

    // Automatically mark opened chapter as read
    handleMarkChapterRead(manga.id, targetChap.id);

    setReaderState({
      isOpen: true,
      manga,
      chapter: targetChap
    });
  };

  // Open Reader directly from History notification item
  const handleOpenReaderFromHistory = (historyItem) => {
    const targetManga = mangas.find(m => m.id === historyItem.mangaId) || {
      id: historyItem.mangaId,
      title: historyItem.mangaTitle,
      cover: historyItem.cover,
      pluginId: historyItem.pluginName,
      chapters: [{ id: historyItem.chapterUrl, title: historyItem.chapterTitle, url: historyItem.chapterUrl }]
    };

    const targetChap = {
      id: historyItem.chapterUrl,
      title: historyItem.chapterTitle,
      url: historyItem.chapterUrl
    };

    setReaderState({
      isOpen: true,
      manga: targetManga,
      chapter: targetChap
    });
  };

  const handleOpenExternal = useCallback((url) => {
    if (!url) return;
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  }, []);

  const handleCloseReader = useCallback(() => {
    setReaderState(s => ({ ...s, isOpen: false }));
  }, []);

  const handleChapterChange = useCallback((ch) => {
    setReaderState(s => {
      if (s.manga?.id && ch?.id) {
        handleMarkChapterRead(s.manga.id, ch.id);
      }
      return { ...s, chapter: ch };
    });
  }, []);

  const isCompleted = (m) => m.tag === 'completed' || (m.status && /hoàn thành|completed|trọn bộ|end/i.test(m.status));
  const isOnHold = (m) => m.tag === 'on_hold' || (m.status && /tạm ngưng|tạm dừng|tạm hoãn|hiatus|cancelled|drop/i.test(m.status));
  const isFavorite = (m) => m.tag === 'favorite' || m.isFavorite;
  const isReading = (m) => !isCompleted(m) && !isOnHold(m);

  // Filter manga list
  const filteredMangas = mangas.filter(manga => {
    // 1. Filter by Category Tab
    if (currentTab === 'unread' && !manga.hasUnread) return false;
    if (currentTab === 'reading' && !isReading(manga)) return false;
    if (currentTab === 'completed' && !isCompleted(manga)) return false;
    if (currentTab === 'on_hold' && !isOnHold(manga)) return false;
    if (currentTab === 'favorite' && !isFavorite(manga)) return false;

    // 2. Filter by Source Plugin
    if (selectedPluginFilter && manga.pluginId !== selectedPluginFilter) return false;

    // 3. Filter by search input
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      return (
        (manga.title || '').toLowerCase().includes(q) ||
        (manga.author || '').toLowerCase().includes(q) ||
        (manga.pluginId || '').toLowerCase().includes(q) ||
        (manga.status || '').toLowerCase().includes(q)
      );
    }

    return true;
  });

  const unreadNotificationsCount = mangas.filter(m => m.hasUnread).length;

  const mainDashboardRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleDashboardScroll = (e) => {
    if (e.target.scrollTop > 200) {
      setShowScrollTop(true);
    } else {
      setShowScrollTop(false);
    }
  };

  const scrollToDashboardTop = () => {
    if (mainDashboardRef.current) {
      mainDashboardRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleMarkEverythingRead = async () => {
    try {
      if (window.electronAPI) {
        for (const manga of mangas) {
          if (manga.hasUnread) {
            await window.electronAPI.markAllChaptersRead(manga.id);
          }
        }
        const updated = await window.electronAPI.getMangas();
        setMangas(updated || []);
      }
    } catch (err) {
      console.error('Lỗi khi đánh dấu đọc hết tất cả:', err);
    }
  };

  const categoryChips = [
    { id: 'all', label: 'Tất cả', icon: Layers },
    { id: 'unread', label: 'Có chap mới', icon: Sparkles, badgeColor: 'text-rose-400' },
    { id: 'reading', label: 'Đang tiếp tục', icon: Bookmark, badgeColor: 'text-primary-light' },
    { id: 'completed', label: 'Đã hoàn thành', icon: CheckCircle2, badgeColor: 'text-emerald-400' },
    { id: 'on_hold', label: 'Tạm ngưng / Tạm dừng', icon: PauseCircle, badgeColor: 'text-purple-400' },
    { id: 'favorite', label: 'Yêu thích', icon: Heart, badgeColor: 'text-rose-400' },
  ];

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-slate-100 flex flex-col select-none">
      
      {/* Top Navigation Bar */}
      <Navbar
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenQRSync={() => setIsQRSyncOpen(true)}
        onOpenQRScanner={() => setIsQRScannerOpen(true)}
        onCheckAll={handleCheckAll}
        pollStatus={pollStatus}
        unreadNotificationsCount={unreadNotificationsCount}
        canRollback={canRollback}
        onRollback={handleRollback}
      />

      {/* Main Content Layout */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        
        {/* Left Sidebar Filter */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          selectedPluginFilter={selectedPluginFilter}
          onSelectPluginFilter={setSelectedPluginFilter}
          mangas={mangas}
          plugins={plugins}
        />

        {/* Right Dashboard Area */}
        <main 
          ref={mainDashboardRef}
          onScroll={handleDashboardScroll}
          className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 custom-scrollbar smooth-scroll-container pb-24 relative"
        >
          
          {/* Header Action Bar inside Main */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center space-x-2">
                <span>
                  {currentTab === 'all' && 'Tất cả truyện đang theo dõi'}
                  {currentTab === 'unread' && '🔥 Truyện có chap mới chưa đọc'}
                  {currentTab === 'reading' && '📖 Truyện đang tiếp tục'}
                  {currentTab === 'completed' && '✅ Truyện đã hoàn thành'}
                  {currentTab === 'on_hold' && '⏸️ Truyện tạm ngưng / tạm dừng'}
                  {currentTab === 'favorite' && '❤️ Truyện yêu thích'}
                </span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-surface-border text-slate-300 font-semibold">
                  {filteredMangas.length} bộ
                </span>
                {selectedPluginFilter && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/20 text-primary-light border border-primary/30 font-semibold">
                    Nguồn: {plugins.find(p => p.id === selectedPluginFilter)?.name || selectedPluginFilter}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Cập nhật tự động & đồng bộ thông báo
              </p>
            </div>

            {/* Quick Filter & Mark All Read in library */}
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              {unreadNotificationsCount > 0 && (
                <button
                  onClick={handleMarkEverythingRead}
                  className="px-3.5 py-2 rounded-xl bg-surface hover:bg-surface-hover text-slate-200 hover:text-white border border-surface-border text-xs font-semibold flex items-center space-x-1.5 transition-all active:scale-95 shadow-sm whitespace-nowrap"
                  title="Đánh dấu tất cả truyện đã đọc"
                >
                  <CheckCheck className="w-4 h-4 text-accent-emerald" />
                  <span>Đọc hết ({unreadNotificationsCount})</span>
                </button>
              )}

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Lọc nhanh trong thư viện..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl bg-surface border border-surface-border focus:border-primary focus:ring-1 focus:ring-primary text-xs text-slate-200 placeholder-slate-500 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Quick Category Chips Filter Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {categoryChips.map((chip) => {
              const ChipIcon = chip.icon;
              const isSelected = currentTab === chip.id;
              let count = 0;
              if (chip.id === 'all') count = mangas.length;
              else if (chip.id === 'unread') count = mangas.filter(m => m.hasUnread).length;
              else if (chip.id === 'reading') count = mangas.filter(isReading).length;
              else if (chip.id === 'completed') count = mangas.filter(isCompleted).length;
              else if (chip.id === 'on_hold') count = mangas.filter(isOnHold).length;
              else if (chip.id === 'favorite') count = mangas.filter(isFavorite).length;

              return (
                <button
                  key={chip.id}
                  onClick={() => setCurrentTab(chip.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center space-x-1.5 transition-all flex-shrink-0 ${
                    isSelected
                      ? 'bg-primary text-white shadow-glow-primary'
                      : 'bg-surface hover:bg-surface-hover text-slate-300 border border-surface-border'
                  }`}
                >
                  <ChipIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : chip.badgeColor || 'text-slate-400'}`} />
                  <span>{chip.label}</span>
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-surface-border text-slate-400'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Manga Grid */}
          {filteredMangas.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
              {filteredMangas.map((manga) => (
                <MangaCard
                  key={manga.id}
                  manga={manga}
                  onOpenReader={handleOpenReader}
                  onOpenDetails={(m) => setSelectedMangaDetails(m)}
                  onDelete={handleDeleteManga}
                  onMarkAllRead={handleMarkAllRead}
                  onUpdateTag={handleUpdateTag}
                  onOpenExternal={handleOpenExternal}
                  onRefreshManga={handleCheckSingleManga}
                />
              ))}
            </div>
          ) : (
            /* Empty State */
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 border border-dashed border-surface-border rounded-2xl bg-surface/30">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary-light">
                <BookOpen className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="text-sm font-bold text-slate-200">
                  {searchFilter ? 'Không tìm thấy truyện phù hợp' : 'Chưa có truyện nào trong mục này'}
                </h3>
                <p className="text-xs text-slate-400">
                  {searchFilter 
                    ? `Không có truyện nào khớp với "${searchFilter}"` 
                    : 'Hãy bấm nút "Thêm truyện" để tìm kiếm hoặc dán URL truyện yêu thích vào danh sách theo dõi.'}
                </p>
              </div>
              {!searchFilter && (
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-dark hover:from-primary-hover hover:to-primary text-white text-xs font-bold shadow-glow-primary active:scale-95 transition-all flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm truyện ngay</span>
                </button>
              )}
            </div>
          )}

          {/* Floating Scroll to Top button for Main Library */}
          {showScrollTop && (
            <button
              onClick={scrollToDashboardTop}
              className="fixed bottom-6 right-6 z-30 px-3.5 py-2.5 rounded-2xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-glow-primary transition-all active:scale-95 flex items-center space-x-1.5 animate-fadeIn"
              title="Cuộn lên đầu trang"
            >
              <ArrowUp className="w-4 h-4" />
              <span className="hidden sm:inline">Lên đầu</span>
            </button>
          )}
        </main>
      </div>

      {/* Search & Add Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onAddManga={handleAddManga}
        existingMangaUrls={mangas.map(m => m.url)}
        plugins={plugins}
      />

      {/* Manga Detail Modal */}
      <ErrorBoundary onReset={() => setSelectedMangaDetails(null)}>
        <MangaDetailModal
          isOpen={!!selectedMangaDetails}
          onClose={() => setSelectedMangaDetails(null)}
          manga={selectedMangaDetails}
          onOpenReader={handleOpenReader}
          onMarkChapterRead={handleMarkChapterRead}
          onMarkAllRead={handleMarkAllRead}
          onOpenExternal={handleOpenExternal}
          onDelete={handleDeleteManga}
          onUpdateTag={handleUpdateTag}
          onRefreshManga={handleCheckSingleManga}
        />
      </ErrorBoundary>

      {/* In-App Reader Modal */}
      <ErrorBoundary onReset={handleCloseReader}>
        <ReaderModal
          isOpen={readerState.isOpen}
          onClose={handleCloseReader}
          manga={readerState.manga}
          chapter={readerState.chapter}
          onChapterChange={handleChapterChange}
          onOpenExternal={handleOpenExternal}
        />
      </ErrorBoundary>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaveSettings={(newSettings) => setSettings(newSettings)}
        onOpenQRSync={() => setIsQRSyncOpen(true)}
        onOpenQRScanner={() => setIsQRScannerOpen(true)}
      />

      {/* History Modal */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onClearHistory={async () => {
          if (window.electronAPI?.clearHistory) {
            await window.electronAPI.clearHistory();
            setHistory([]);
          }
        }}
        onOpenReaderFromHistory={handleOpenReaderFromHistory}
        onOpenExternal={handleOpenExternal}
      />

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenQRScanner={() => setIsQRScannerOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        unreadCount={unreadNotificationsCount}
      />

      {/* QR Sync Modal (PC) */}
      <QRSyncModal
        isOpen={isQRSyncOpen}
        onClose={() => setIsQRSyncOpen(false)}
      />

      {/* QR Scanner Modal (Mobile) */}
      <QRScannerModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        onSyncSuccess={(data) => {
          if (data?.mangas) setMangas(data.mangas);
        }}
      />
    </div>
  );
}

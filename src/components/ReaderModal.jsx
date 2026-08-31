import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  Minimize2, 
  ExternalLink, 
  Loader2, 
  RotateCw,
  LayoutList,
  FileText,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Zap,
  Image as ImageIcon,
  AlertTriangle,
  RefreshCw,
  Lock,
  BookOpen,
  Play,
  Pause,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  Move,
  Hand,
  Globe,
  Users
} from 'lucide-react';

/**
 * Individual Manga Page Image with Native Lazy Loading, Skeleton & Fallback
 */
const MangaImageItem = React.memo(function MangaImageItem({ src, index, alt, zoomLevel, readerMode, chapterUrl, onReloadRequested }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'loaded' | 'error'
  const [retryCount, setRetryCount] = useState(0);
  const [currentSrc, setCurrentSrc] = useState(src);
  const proxyAttemptedRef = useRef(false);
  const isLoadedRef = useRef(false);

  useEffect(() => {
    if (src !== currentSrc && !isLoadedRef.current) {
      setStatus('loading');
      setCurrentSrc(src);
      setRetryCount(0);
      proxyAttemptedRef.current = false;
      isLoadedRef.current = false;
    }
  }, [src]);

  const handleImageLoad = () => {
    isLoadedRef.current = true;
    setStatus('loaded');
  };

  const handleImageError = async () => {
    if (isLoadedRef.current) return;
    if (retryCount >= 2 || !src || src.startsWith('data:')) {
      setStatus('error');
      return;
    }

    if (!proxyAttemptedRef.current && window.electronAPI?.getImageData) {
      proxyAttemptedRef.current = true;
      try {
        const base64Data = await window.electronAPI.getImageData(src, chapterUrl);
        if (base64Data && base64Data !== src && (base64Data.startsWith('data:image') || base64Data.startsWith('http'))) {
          setCurrentSrc(base64Data);
          return;
        }
      } catch (err) {
        // Fall through to error
      }
    }
    setStatus('error');
  };

  const handleRetry = async (e) => {
    e?.stopPropagation();
    if (retryCount >= 3) return;
    setStatus('loading');
    setRetryCount(r => r + 1);
    isLoadedRef.current = false;

    if (window.electronAPI?.getImageData) {
      try {
        const base64Data = await window.electronAPI.getImageData(src, chapterUrl);
        if (base64Data && (base64Data.startsWith('data:image') || base64Data.startsWith('http'))) {
          setCurrentSrc(base64Data);
          return;
        }
      } catch (err) {}
    }

    const separator = src.includes('?') ? '&' : '?';
    setCurrentSrc(`${src}${separator}retry=${Date.now()}`);
    onReloadRequested?.(index);
  };

  const isWebtoon = readerMode === 'webtoon';

  return (
    <div 
      className={`w-full relative flex flex-col items-center justify-center ${
        isWebtoon 
          ? 'm-0 p-0 border-0 rounded-none bg-transparent' 
          : 'min-h-[250px] bg-slate-950/60 rounded-lg overflow-hidden border border-white/5 my-1'
      }`}
      style={isWebtoon && status !== 'loaded' ? { minHeight: '300px' } : undefined}
    >
      {/* Loading Skeleton */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/50 backdrop-blur-[2px] z-10 min-h-[300px]">
          <Loader2 className="w-6 h-6 text-primary-light animate-spin mb-2" />
          <span className="text-[11px] text-slate-400 font-medium">Đang tải trang {index + 1}...</span>
        </div>
      )}

      {/* Error Fallback */}
      {status === 'error' && (
        <div className="py-8 px-4 flex flex-col items-center justify-center text-center space-y-2 z-10 bg-surface/50 w-full border border-rose-500/20 my-2 rounded-xl">
          <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <p className="text-xs font-semibold text-slate-200">Không thể tải trang {index + 1}</p>
          <button
            onClick={handleRetry}
            className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-glow-primary active:scale-95 transition-all flex items-center space-x-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tải lại</span>
          </button>
        </div>
      )}

      {/* Actual Image with Native Lazy Loading */}
      <img
        src={currentSrc}
        alt={alt || `Trang ${index + 1}`}
        loading={index < 4 ? "eager" : "lazy"}
        decoding="async"
        onLoad={handleImageLoad}
        onError={handleImageError}
        className={`w-full h-auto object-contain select-none transition-opacity duration-200 block align-top m-0 p-0 border-0 outline-none ${
          status === 'loaded' ? 'opacity-100' : 'opacity-0 min-h-[300px]'
        }`}
        style={{
          display: status === 'error' ? 'none' : 'block',
          verticalAlign: 'top',
          margin: 0,
          padding: 0
        }}
      />
    </div>
  );
});

export default function ReaderModal({ 
  isOpen, 
  onClose, 
  manga, 
  chapter, 
  onChapterChange,
  onOpenExternal 
}) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [readerMode, setReaderMode] = useState('webtoon'); // 'webtoon' | 'single'
  const [currentPage, setCurrentPage] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  
  // Zoom Controls state
  const [zoomLevel, setZoomLevel] = useState(100); // 50 to 200 (%)
  const [useDataSaver, setUseDataSaver] = useState(false);
  const [failedImagesCount, setFailedImagesCount] = useState(0);

  // Auto Scroll & Drag-to-Scroll state
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(2); // 1: Chậm, 2: Vừa, 3: Nhanh
  const [isDragging, setIsDragging] = useState(false);
  const [enableDragScroll, setEnableDragScroll] = useState(true);

  const containerRef = useRef(null);
  const dragStartY = useRef(0);
  const dragStartScrollTop = useRef(0);
  const isDraggingRef = useRef(false);
  const autoScrollAnimRef = useRef(null);
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    hasRedirectedRef.current = false;
  }, [chapter?.id, chapter?.url]);

  const triggerExternalRedirect = useCallback((url) => {
    if (hasRedirectedRef.current || !url) return;
    hasRedirectedRef.current = true;
    console.log('[Reader] Triggering single external redirect for URL:', url);
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else if (onOpenExternal) {
      onOpenExternal(url);
    }
    onClose?.();
  }, [onOpenExternal, onClose]);

  // Helper to extract language code from chapter
  const getChapterLang = (ch) => {
    if (!ch) return 'all';
    if (ch.lang && ch.lang !== 'unknown' && ch.lang !== 'other') return ch.lang.toLowerCase();
    const match = (ch.title || '').match(/\[([A-Za-z0-9_-]+)\]/);
    if (match) return match[1].toLowerCase();
    return 'all';
  };

  const allChapters = manga?.chapters || [];
  const currentLang = getChapterLang(chapter);

  // Filter chapters list by current translation language so next/prev stays in the same language
  const chapters = React.useMemo(() => {
    if (currentLang === 'all') return allChapters;
    const sameLang = allChapters.filter(c => getChapterLang(c) === currentLang);
    return sameLang.length > 0 ? sameLang : allChapters;
  }, [allChapters, currentLang]);

  const currentIndex = chapters.findIndex(c => c.id === chapter?.id || c.url === chapter?.url);
  const hasNext = currentIndex > 0; // Usually chapters are sorted descending (idx 0 is newest)
  const hasPrev = currentIndex < chapters.length - 1 && currentIndex >= 0;

  const fetchedChapterKeyRef = useRef(null);

  // Load images whenever chapter or dataSaver setting changes
  const fetchImages = useCallback(async (forceReload = false) => {
    if (!isOpen || !chapter) return;

    const chapterKey = `${chapter.id || chapter.url}_${useDataSaver ? 'saver' : 'full'}`;
    if (!forceReload && fetchedChapterKeyRef.current === chapterKey && images.length > 0) {
      return;
    }

    fetchedChapterKeyRef.current = chapterKey;
    setLoading(true);
    setError('');
    if (forceReload) setImages([]);
    setCurrentPage(0);
    setFailedImagesCount(0);
    setIsAutoScrolling(false);

    try {
      if (window.electronAPI?.getChapterImages) {
        const imgs = await window.electronAPI.getChapterImages(chapter.url, manga?.pluginId, { dataSaver: useDataSaver });
        const validImgs = (imgs || []).filter(src => (
          typeof src === 'string' && 
          !src.startsWith('data:') && 
          !src.includes('svg+xml') && 
          !src.includes('${') && 
          !src.includes('escapeAttribute') &&
          src.trim().length > 0
        ));
        
        if (validImgs.length === 0) {
          if (chapter.url?.includes('moetruyen') || manga?.pluginId === 'moetruyen') {
            triggerExternalRedirect(chapter.url);
            return;
          }
          throw new Error('Không tìm thấy ảnh hợp lệ trong chương này.');
        }
        setImages(validImgs);
      }
    } catch (err) {
      let msg = err.message || 'Không thể tải ảnh cho chương này';
      msg = msg.replace(/^Error invoking remote method '[^']+': (Error: )?/i, '');
      
      // Auto-redirect to original web if MoeTruyen IMGX encryption is detected
      if (msg.includes('MOETRUYEN_IMGX_ENCRYPTED') || (chapter?.url?.includes('moetruyen') && msg.includes('IMGX'))) {
        triggerExternalRedirect(chapter.url);
        return;
      }

      if (msg.includes('429') || msg.includes('status code 429')) {
        msg = 'Máy chủ đang tạm thời giới hạn tần suất yêu cầu (429 - Too Many Requests). Vui lòng đợi 3-5 giây và bấm nút "Thử lại".';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [isOpen, chapter?.id, chapter?.url, manga?.pluginId, triggerExternalRedirect, useDataSaver, images.length]);

  useEffect(() => {
    if (!isOpen) {
      fetchedChapterKeyRef.current = null;
      return;
    }
    fetchImages(false);
  }, [isOpen, chapter?.id, chapter?.url, useDataSaver]);

  // Auto Scroll Engine using requestAnimationFrame
  useEffect(() => {
    if (!isAutoScrolling || !isOpen || readerMode !== 'webtoon') {
      if (autoScrollAnimRef.current) cancelAnimationFrame(autoScrollAnimRef.current);
      return;
    }

    let speedStep = 1.2;
    if (autoScrollSpeed === 1) speedStep = 1.0;
    else if (autoScrollSpeed === 2) speedStep = 2.2;
    else if (autoScrollSpeed === 3) speedStep = 4.2;

    const scrollLoop = () => {
      if (containerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        if (scrollTop + clientHeight >= scrollHeight - 5) {
          setIsAutoScrolling(false);
          return;
        }
        containerRef.current.scrollTop += speedStep;
      }
      autoScrollAnimRef.current = requestAnimationFrame(scrollLoop);
    };

    autoScrollAnimRef.current = requestAnimationFrame(scrollLoop);

    return () => {
      if (autoScrollAnimRef.current) cancelAnimationFrame(autoScrollAnimRef.current);
    };
  }, [isAutoScrolling, autoScrollSpeed, isOpen, readerMode]);

  // Quick Scroll Helpers
  const scrollToTop = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  const scrollByDelta = (deltaY) => {
    if (containerRef.current) {
      containerRef.current.scrollBy({ top: deltaY, behavior: 'smooth' });
    }
  };

  const toggleAutoScroll = () => {
    setIsAutoScrolling(prev => !prev);
  };

  // Mouse Drag-To-Scroll Handlers
  const handleMouseDown = (e) => {
    if (!enableDragScroll || readerMode !== 'webtoon') return;
    if (e.button !== 0) return; // Only left click
    if (e.target.closest('button, input, a, select, [data-interactive="true"]')) return;

    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartScrollTop.current = containerRef.current ? containerRef.current.scrollTop : 0;
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    e.preventDefault();
    const deltaY = e.clientY - dragStartY.current;
    containerRef.current.scrollTop = dragStartScrollTop.current - deltaY * 1.2;
  };

  const handleMouseUpOrLeave = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      setIsDragging(false);
    }
  };

  // Zoom handlers
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(200, prev + 15));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(50, prev - 15));
  };

  const handleZoomReset = () => {
    setZoomLevel(100);
  };

  // Keyboard navigation & Shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        if (readerMode === 'single') {
          if (currentPage < images.length - 1) {
            setCurrentPage(p => p + 1);
          } else if (hasNext) {
            onChapterChange(chapters[currentIndex - 1]);
          }
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        if (readerMode === 'single') {
          if (currentPage > 0) {
            setCurrentPage(p => p - 1);
          } else if (hasPrev) {
            onChapterChange(chapters[currentIndex + 1]);
          }
        }
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        scrollByDelta(180);
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        scrollByDelta(-180);
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        scrollByDelta(window.innerHeight * 0.75);
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        scrollByDelta(-window.innerHeight * 0.75);
      } else if (e.key === ' ') {
        e.preventDefault();
        if (readerMode === 'webtoon') {
          toggleAutoScroll();
        } else {
          if (currentPage < images.length - 1) setCurrentPage(p => p + 1);
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        scrollToTop();
      } else if (e.key === 'End') {
        e.preventDefault();
        scrollToBottom();
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        handleZoomReset();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, readerMode, currentPage, images.length, currentIndex, chapters, hasNext, hasPrev, isAutoScrolling, onClose, onChapterChange]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleNextChapter = () => {
    if (hasNext) {
      onChapterChange(chapters[currentIndex - 1]);
    }
  };

  const handlePrevChapter = () => {
    if (hasPrev) {
      onChapterChange(chapters[currentIndex + 1]);
    }
  };

  if (!isOpen || !manga || !chapter) return null;

  // Calculate webtoon container width based on zoom level
  // 100% zoom = 768px (max-w-3xl)
  const webtoonWidthPx = Math.round(768 * (zoomLevel / 100));

  return (
    <div className="fixed inset-0 z-50 bg-[#07090e] text-slate-100 flex flex-col select-none animate-fadeIn">
      {/* Top Floating Controls Bar */}
      <div className={`h-14 px-4 bg-surface/95 border-b border-surface-border backdrop-blur-md flex items-center justify-between z-30 transition-all duration-300 ${showControls ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
        
        {/* Left: Manga & Chapter Title */}
        <div className="flex items-center space-x-3 overflow-hidden">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-hover transition-colors"
            title="Đóng trình đọc (ESC)"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="overflow-hidden">
            <h3 className="text-xs font-bold text-slate-100 truncate max-w-xs sm:max-w-sm" title={manga.title}>
              {manga.title}
            </h3>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-primary-light font-medium truncate block">
                {chapter.title}
              </span>
              {chapter.group && (
                <span className="hidden sm:inline-flex items-center space-x-1 px-1.5 py-0.2 rounded bg-surface-hover text-slate-300 text-[10px] border border-surface-border" title={`Nhóm dịch: ${chapter.group}`}>
                  <Users className="w-2.5 h-2.5 text-primary-light" />
                  <span className="truncate max-w-[120px]">{chapter.group}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Chapter Navigation Dropdown */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          <button
            onClick={handlePrevChapter}
            disabled={!hasPrev}
            className="p-1.5 rounded-lg bg-surface-hover hover:bg-surface-border text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Chương trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <select
            value={chapter.id || chapter.url}
            onChange={(e) => {
              const selected = chapters.find(c => (c.id || c.url) === e.target.value);
              if (selected) onChapterChange(selected);
            }}
            className="px-2.5 py-1 rounded-lg bg-background border border-surface-border text-xs text-slate-200 focus:border-primary outline-none max-w-[130px] sm:max-w-[200px] truncate"
          >
            {chapters.map(c => (
              <option key={c.id || c.url} value={c.id || c.url}>
                {c.title}
              </option>
            ))}
          </select>

          <button
            onClick={handleNextChapter}
            disabled={!hasNext}
            className="p-1.5 rounded-lg bg-surface-hover hover:bg-surface-border text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Chương tiếp theo"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile: Prominent Reload Button */}
        <div className="flex md:hidden items-center space-x-1.5">
          <button
            onClick={() => fetchImages(true)}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary-light text-xs font-semibold border border-primary/30 active:scale-95 transition-all flex items-center space-x-1.5"
            title="Tải lại ảnh chương này"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary-light' : ''}`} />
            <span>Tải lại</span>
          </button>
        </div>

        {/* Desktop: Full Controls Bar */}
        <div className="hidden md:flex items-center space-x-1.5 sm:space-x-2">
          
          {/* Auto Scroll Controller (Webtoon Mode) */}
          {readerMode === 'webtoon' && (
            <div className="flex items-center bg-surface-hover rounded-lg p-0.5 border border-surface-border">
              <button
                onClick={toggleAutoScroll}
                className={`px-2 py-1 rounded text-[11px] font-bold flex items-center space-x-1 transition-all ${
                  isAutoScrolling 
                    ? 'bg-amber-500 text-slate-950 shadow-glow-amber animate-pulse' 
                    : 'text-slate-300 hover:text-white hover:bg-surface-border'
                }`}
                title="Bật/Tắt tự động cuộn xuống [Phím tắt: Space]"
              >
                {isAutoScrolling ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span className="hidden md:inline">{isAutoScrolling ? 'Dừng cuộn' : 'Tự cuộn'}</span>
              </button>

              {isAutoScrolling && (
                <div className="flex items-center space-x-0.5 pl-1 border-l border-surface-border ml-1">
                  {[1, 2, 3].map(speed => (
                    <button
                      key={speed}
                      onClick={() => setAutoScrollSpeed(speed)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold transition-colors ${
                        autoScrollSpeed === speed 
                          ? 'bg-primary text-white shadow-sm' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title={`Tốc độ cuộn ${speed}x`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Mouse Drag-to-scroll Toggle */}
          {readerMode === 'webtoon' && (
            <button
              onClick={() => setEnableDragScroll(p => !p)}
              className={`p-1.5 rounded-lg border text-xs font-semibold transition-all ${
                enableDragScroll
                  ? 'bg-primary/20 text-primary-light border-primary/40'
                  : 'bg-surface-hover text-slate-400 border-surface-border hover:text-slate-200'
              }`}
              title={enableDragScroll ? 'Đang bật Kéo chuột để cuộn (Giữ chuột trái để cuộn lên/xuống)' : 'Bật tính năng kéo chuột để cuộn'}
            >
              <Hand className="w-4 h-4" />
            </button>
          )}

          {/* Zoom Controls Bar */}
          <div className="flex items-center bg-surface-hover rounded-lg p-0.5 border border-surface-border">
            <button
              onClick={handleZoomOut}
              disabled={zoomLevel <= 50}
              className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-surface-border disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Thu nhỏ (-) [Phím tắt: -]"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleZoomReset}
              className="px-2 py-0.5 text-[11px] font-bold text-primary-light hover:text-white hover:bg-surface-border rounded transition-colors"
              title="Đặt lại tỉ lệ 100% [Phím tắt: 0]"
            >
              {zoomLevel}%
            </button>

            <button
              onClick={handleZoomIn}
              disabled={zoomLevel >= 200}
              className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-surface-border disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Phóng to (+) [Phím tắt: +]"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Reader Mode Toggle (Webtoon vs Single Page) */}
          <div className="hidden sm:flex items-center bg-surface-hover rounded-lg p-0.5 border border-surface-border">
            <button
              onClick={() => setReaderMode('webtoon')}
              className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center space-x-1 transition-colors ${
                readerMode === 'webtoon' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Cuộn dọc (Webtoon mode)"
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Cuộn dọc</span>
            </button>
            <button
              onClick={() => setReaderMode('single')}
              className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center space-x-1 transition-colors ${
                readerMode === 'single' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Từng trang (Single page)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Từng trang</span>
            </button>
          </div>

          {/* Reload All Images */}
          <button
            onClick={() => fetchImages(true)}
            disabled={loading}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-surface-hover transition-colors"
            title="Tải lại toàn bộ chương"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary-light' : ''}`} />
          </button>

          {/* Open Original Web Link */}
          <button
            onClick={() => onOpenExternal(chapter.url)}
            className="p-2 rounded-lg text-slate-400 hover:text-accent-cyan hover:bg-surface-hover transition-colors"
            title="Mở trên web gốc"
          >
            <ExternalLink className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-surface-hover transition-colors"
            title="Toàn màn hình [Phím tắt: F]"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Reader Content Area (with mouse drag-to-scroll & auto-scroll support) */}
      <div 
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className={`flex-1 overflow-y-auto overflow-x-hidden flex flex-col items-center relative custom-scrollbar ${
          readerMode === 'webtoon' && enableDragScroll 
            ? (isDragging ? 'cursor-grabbing select-none' : 'cursor-grab') 
            : 'cursor-default'
        }`}
      >
        {loading ? (
          <div className="m-auto flex flex-col items-center justify-center p-8 space-y-4 animate-fadeIn">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center animate-pulse">
                <Loader2 className="w-7 h-7 text-primary-light animate-spin" />
              </div>
            </div>
            <div className="text-center space-y-1">
              <h4 className="text-sm font-bold text-slate-100">Đang tải nội dung chương...</h4>
              <p className="text-xs text-slate-400">Vui lòng chờ trong giây lát</p>
            </div>
          </div>
        ) : error ? (
          <div className="m-auto max-w-md p-6 rounded-3xl bg-surface/90 border border-surface-border text-center space-y-4 shadow-2xl animate-fadeIn">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              {error.toLowerCase().includes('yêu cầu') || error.toLowerCase().includes('tài khoản') ? (
                <Lock className="w-6 h-6" />
              ) : (
                <AlertTriangle className="w-6 h-6" />
              )}
            </div>

            <div className="space-y-1.5">
              <h4 className="text-sm font-bold text-slate-100">
                {error.toLowerCase().includes('yêu cầu') || error.toLowerCase().includes('tài khoản') 
                  ? 'Chương yêu cầu tài khoản thành viên' 
                  : 'Không thể tải ảnh chương'}
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                {error}
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <button
                onClick={() => onOpenExternal(chapter?.url)}
                className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-glow-primary transition-all flex items-center space-x-1.5 active:scale-95"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Mở đọc trên Web gốc</span>
              </button>

              <button
                onClick={() => fetchImages(true)}
                className="px-3.5 py-2.5 rounded-xl bg-surface-hover hover:bg-surface-border text-slate-200 text-xs font-semibold border border-surface-border transition-all flex items-center space-x-1.5 active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thử lại</span>
              </button>
            </div>
          </div>
        ) : images.length > 0 ? (
          readerMode === 'webtoon' ? (
            /* Webtoon Mode: Vertical Continuous Strip with Custom Zoom Width */
            <div 
              className="w-full flex flex-col items-center p-0 m-0 space-y-0 transition-all duration-200"
              style={{ maxWidth: `${webtoonWidthPx}px` }}
            >
              {images.map((imgUrl, idx) => (
                <MangaImageItem
                  key={`${chapter.id}_${idx}_${imgUrl}`}
                  src={imgUrl}
                  index={idx}
                  zoomLevel={zoomLevel}
                  readerMode="webtoon"
                  chapterUrl={chapter?.url}
                />
              ))}

              {/* Bottom Chapter Navigation Bar */}
              <div className="w-full py-12 flex items-center justify-between px-4 border-t border-surface-border mt-8">
                <button
                  onClick={handlePrevChapter}
                  disabled={!hasPrev}
                  className="px-4 py-2.5 rounded-xl bg-surface-hover hover:bg-surface-border text-xs font-semibold text-slate-200 disabled:opacity-30 flex items-center space-x-1.5 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Chương trước</span>
                </button>

                <div className="text-center">
                  <span className="text-[11px] text-slate-400 block font-medium">Hết chương {chapter.title}</span>
                  <span className="text-[10px] text-slate-500">Tổng cộng {images.length} trang</span>
                </div>

                <button
                  onClick={handleNextChapter}
                  disabled={!hasNext}
                  className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-xs font-bold text-white shadow-glow-primary disabled:opacity-30 flex items-center space-x-1.5 transition-all"
                >
                  <span>Chương tiếp theo</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Single Page Mode */
            <div className="flex-1 flex flex-col items-center justify-center w-full max-w-5xl p-4">
              <div 
                className="relative flex items-center justify-center transition-transform duration-200"
                style={{
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: 'center center'
                }}
              >
                <MangaImageItem
                  key={`${chapter.id}_${currentPage}_${images[currentPage]}`}
                  src={images[currentPage]}
                  index={currentPage}
                  zoomLevel={zoomLevel}
                  readerMode="single"
                  chapterUrl={chapter?.url}
                />
              </div>

              {/* Single Page Pagination */}
              <div className="mt-4 flex items-center space-x-4 bg-surface/80 px-4 py-2 rounded-xl border border-surface-border backdrop-blur-md">
                <button
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="px-3 py-1.5 rounded-lg bg-surface-hover hover:bg-surface-border text-xs font-semibold disabled:opacity-30 transition-all flex items-center space-x-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Trang trước</span>
                </button>

                <span className="text-xs text-primary-light font-bold">
                  {currentPage + 1} / {images.length}
                </span>

                <button
                  onClick={() => setCurrentPage(p => Math.min(images.length - 1, p + 1))}
                  disabled={currentPage === images.length - 1}
                  className="px-3 py-1.5 rounded-lg bg-surface-hover hover:bg-surface-border text-xs font-semibold disabled:opacity-30 transition-all flex items-center space-x-1"
                >
                  <span>Trang sau</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        ) : (
          <div className="m-auto max-w-sm p-6 rounded-3xl bg-surface/90 border border-surface-border text-center space-y-4 shadow-2xl animate-fadeIn">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-100">Không tìm thấy ảnh của chương này</h4>
              <p className="text-xs text-slate-400">
                Chương có thể được bảo vệ hoặc mã hóa (như MoeTruyen IMGX). Bạn có thể bấm Mở web gốc để đọc.
              </p>
            </div>
            <div className="flex gap-2 pt-2 justify-center">
              <button
                onClick={() => onOpenExternal(chapter?.url)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-glow-primary transition-all flex items-center justify-center space-x-1.5 active:scale-95"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Mở đọc trên Web gốc</span>
              </button>
              <button
                onClick={fetchImages}
                className="px-3.5 py-2.5 rounded-xl bg-surface-hover hover:bg-surface-border text-slate-200 text-xs font-semibold border border-surface-border transition-all flex items-center justify-center space-x-1.5 active:scale-95"
              >
                <RotateCw className="w-4 h-4" />
                <span>Tải lại</span>
              </button>
            </div>
          </div>
        )}

        {/* Floating Quick Scroll Controls */}
        {readerMode === 'webtoon' && images.length > 0 && (
          <>
            {/* Mobile: Compact Sleek 2-Button Widget (Top & Bottom only, No Auto-Scroll) */}
            <div 
              data-interactive="true"
              className="flex md:hidden fixed bottom-6 right-3.5 z-40 flex-col items-center space-y-1.5 bg-surface/90 border border-surface-border p-1 rounded-2xl shadow-2xl backdrop-blur-md"
            >
              {/* Scroll to Top */}
              <button
                onClick={scrollToTop}
                className="w-8 h-8 rounded-xl bg-surface-hover active:bg-primary text-slate-300 active:text-white flex items-center justify-center transition-all shadow-sm active:scale-90"
                title="Lên đầu trang"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>

              {/* Scroll to Bottom */}
              <button
                onClick={scrollToBottom}
                className="w-8 h-8 rounded-xl bg-surface-hover active:bg-primary text-slate-300 active:text-white flex items-center justify-center transition-all shadow-sm active:scale-90"
                title="Xuống cuối trang"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Desktop: Full Multi-Function Quick Scroll Panel */}
            <div 
              data-interactive="true"
              className="hidden md:flex fixed bottom-6 right-6 z-40 flex-col items-center space-y-2 bg-surface/90 border border-surface-border p-1.5 rounded-2xl shadow-2xl backdrop-blur-md"
            >
              {/* Scroll to Top */}
              <button
                onClick={scrollToTop}
                className="p-2 rounded-xl bg-surface-hover hover:bg-primary hover:text-white text-slate-300 transition-all active:scale-95"
                title="Cuộn lên đầu trang [Phím tắt: Home]"
              >
                <ArrowUp className="w-4 h-4" />
              </button>

              {/* Scroll Up 1 Page */}
              <button
                onClick={() => scrollByDelta(-window.innerHeight * 0.65)}
                className="p-2 rounded-xl bg-surface-hover hover:bg-primary hover:text-white text-slate-300 transition-all active:scale-95"
                title="Cuộn lên 1 màn hình [Phím tắt: PageUp / W / K]"
              >
                <ChevronUp className="w-4 h-4" />
              </button>

              {/* Auto-Scroll Toggle Button */}
              <button
                onClick={toggleAutoScroll}
                className={`p-2.5 rounded-xl transition-all shadow-md active:scale-95 ${
                  isAutoScrolling
                    ? 'bg-amber-500 text-slate-950 shadow-glow-amber animate-pulse'
                    : 'bg-primary hover:bg-primary-hover text-white shadow-glow-primary'
                }`}
                title={isAutoScrolling ? 'Dừng tự cuộn [Phím tắt: Space]' : 'Bắt đầu tự cuộn xuống [Phím tắt: Space]'}
              >
                {isAutoScrolling ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              </button>

              {/* Scroll Down 1 Page */}
              <button
                onClick={() => scrollByDelta(window.innerHeight * 0.65)}
                className="p-2 rounded-xl bg-surface-hover hover:bg-primary hover:text-white text-slate-300 transition-all active:scale-95"
                title="Cuộn xuống 1 màn hình [Phím tắt: PageDown / S / J]"
              >
                <ChevronDown className="w-4 h-4" />
              </button>

              {/* Scroll to Bottom */}
              <button
                onClick={scrollToBottom}
                className="p-2 rounded-xl bg-surface-hover hover:bg-primary hover:text-white text-slate-300 transition-all active:scale-95"
                title="Cuộn xuống cuối trang [Phím tắt: End]"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

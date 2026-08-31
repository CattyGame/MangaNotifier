/**
 * Mobile Bridge for Manga Notifier
 * Provides a complete client-side implementation of window.electronAPI
 * when running inside Capacitor (Android/iOS) or standalone web.
 */

import { Capacitor, CapacitorHttp } from '@capacitor/core';

// Helper to get / set LocalStorage DB
const DB_KEY = 'manga_notifier_db';

function getLocalDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    mangas: [],
    history: [],
    settings: {
      pollIntervalMinutes: 15,
      discordWebhook: '',
      soundEnabled: true,
      startupWithWindows: false,
      closeToTray: true,
      autoOpenBrowser: false
    }
  };
}

function saveLocalDB(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (e) {
    console.error('[MobileBridge] Lỗi lưu DB vào LocalStorage:', e);
  }
}

function mapStatusToTag(status, existingTag = null) {
  if (existingTag === 'favorite') return 'favorite';
  if (!status) return existingTag || 'reading';
  const s = String(status).toLowerCase().trim();
  if (s.includes('hoàn thành') || s.includes('completed') || s.includes('end') || s.includes('trọn bộ') || s.includes('finished')) {
    return 'completed';
  }
  if (s.includes('tạm ngưng') || s.includes('tạm dừng') || s.includes('tạm hoãn') || s.includes('hiatus') || s.includes('cancelled') || s.includes('drop') || s.includes('on_hold')) {
    return 'on_hold';
  }
  return 'reading';
}

// Helper to parse any user input authorization format
function parseGocTruyenTranhAuth(rawInput) {
  if (!rawInput) return { token: '', cookie: '' };
  let str = String(rawInput).trim().replace(/^["']|["']$/g, '');
  if (!str) return { token: '', cookie: '' };

  let token = '';
  let cookie = '';

  if (/^Authorization:\s*/i.test(str)) {
    str = str.replace(/^Authorization:\s*/i, '').trim();
  }

  if (str.startsWith('Bearer ')) {
    token = str;
    cookie = `auth._token.local=${encodeURIComponent(str)}`;
  } else if (str.startsWith('eyJ') || (str.includes('.') && !str.includes('='))) {
    token = `Bearer ${str}`;
    cookie = `auth._token.local=Bearer%20${str}`;
  } else if (str.includes('=')) {
    cookie = str;
    const match = str.match(/auth\._token\.local=([^;]+)/);
    if (match) {
      const decoded = decodeURIComponent(match[1]);
      token = decoded.startsWith('Bearer ') ? decoded : `Bearer ${decoded}`;
    }
  } else {
    token = str.startsWith('Bearer ') ? str : `Bearer ${str}`;
    cookie = `auth._token.local=${encodeURIComponent(token)}`;
  }

  return { token, cookie };
}

// Native HTTP Helper for Android / Web
async function nativeGetFull(url, headers = {}) {
  const defaultUA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
  if (Capacitor.isNativePlatform()) {
    try {
      const resp = await CapacitorHttp.get({
        url,
        headers: {
          'User-Agent': defaultUA,
          ...headers
        }
      });
      const cookieHeader = resp.headers?.['Set-Cookie'] || resp.headers?.['set-cookie'] || '';
      return { data: resp.data, headers: resp.headers || {}, cookieHeader };
    } catch (err) {
      console.warn('[MobileBridge] CapacitorHttp GET error:', err);
    }
  }
  try {
    const resp = await fetch(url, { headers });
    const data = await resp.text();
    const rawCookies = resp.headers.getSetCookie ? resp.headers.getSetCookie() : [resp.headers.get('set-cookie')];
    const cookieHeader = (rawCookies || []).filter(Boolean).map(c => c.split(';')[0]).join('; ');
    return { data, headers: {}, cookieHeader };
  } catch (e) {
    return { data: '', headers: {}, cookieHeader: '' };
  }
}

async function nativeGet(url, headers = {}) {
  const res = await nativeGetFull(url, headers);
  return res.data;
}

async function nativePost(url, data, headers = {}) {
  const defaultUA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
  
  let dataObj = typeof data === 'object' && data !== null ? data : null;
  let dataStr = typeof data === 'string' ? data : '';

  if (typeof data === 'string') {
    try {
      const params = new URLSearchParams(data);
      dataObj = Object.fromEntries(params.entries());
    } catch (e) {
      dataObj = {};
    }
  } else if (typeof data === 'object' && data !== null) {
    try {
      dataStr = new URLSearchParams(data).toString();
    } catch (e) {
      dataStr = '';
    }
  }

  if (Capacitor.isNativePlatform()) {
    try {
      const resp = await CapacitorHttp.post({
        url,
        data: dataObj || dataStr,
        headers: {
          'User-Agent': defaultUA,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          ...headers
        }
      });
      return resp.data;
    } catch (err) {
      console.warn('[MobileBridge] CapacitorHttp POST error:', err);
    }
  }
  const resp = await fetch(url, {
    method: 'POST',
    body: dataStr,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      ...headers
    }
  });
  return await resp.json();
}

// Scraper implementation for Mobile (MangaDex, GocTruyenTranh, TruyenQQ, MoeTruyen)
const MobileScraper = {
  // 1. MangaDex
  async searchMangaDex(keyword) {
    const resp = await fetch(`https://api.mangadex.org/manga?title=${encodeURIComponent(keyword)}&limit=15&includes[]=cover_art&includes[]=author&order[relevance]=desc`);
    const data = await resp.json();
    const results = [];
    for (const manga of (data.data || [])) {
      const attr = manga.attributes || {};
      const titleObj = attr.title || {};
      let title = titleObj.vi || titleObj.en || titleObj['ja-ro'] || titleObj.ja || Object.values(titleObj)[0];
      if (!title && Array.isArray(attr.altTitles)) {
        for (const alt of attr.altTitles) {
          const val = alt.vi || alt.en || alt['ja-ro'] || Object.values(alt)[0];
          if (val) {
            title = val;
            break;
          }
        }
      }
      title = title || 'Chưa đặt tên';

      let coverFile = '';
      let authorName = 'Đang cập nhật';
      for (const rel of (manga.relationships || [])) {
        if (rel.type === 'cover_art' && rel.attributes?.fileName) coverFile = rel.attributes.fileName;
        if (rel.type === 'author' && rel.attributes?.name) authorName = rel.attributes.name;
      }
      const cover = coverFile ? `https://uploads.mangadex.org/covers/${manga.id}/${coverFile}.256.jpg` : '';
      results.push({
        id: `mangadex_${manga.id}`,
        rawId: manga.id,
        pluginId: 'mangadex',
        title,
        url: `https://mangadex.org/title/${manga.id}`,
        cover,
        author: authorName,
        latestChapter: attr.lastChapter ? `Chap ${attr.lastChapter}` : 'Mới cập nhật',
        status: attr.status === 'completed' ? 'Hoàn thành' : 'Đang tiến hành'
      });
    }
    return results;
  },

  async getMangaDexDetails(mangaId) {
    const cleanId = mangaId.replace('https://mangadex.org/title/', '').replace('mangadex_', '').split('/')[0];
    const mangaResp = await fetch(`https://api.mangadex.org/manga/${cleanId}?includes[]=cover_art&includes[]=author`);
    const data = await mangaResp.json();
    const manga = data.data;
    const attr = manga.attributes || {};
    const titleObj = attr.title || {};
    let title = titleObj.vi || titleObj.en || titleObj['ja-ro'] || titleObj.ja || Object.values(titleObj)[0];
    if (!title && Array.isArray(attr.altTitles)) {
      for (const alt of attr.altTitles) {
        const val = alt.vi || alt.en || alt['ja-ro'] || Object.values(alt)[0];
        if (val) {
          title = val;
          break;
        }
      }
    }
    title = title || 'Chưa đặt tên';

    const description = attr.description?.vi || attr.description?.en || Object.values(attr.description || {})[0] || 'Chưa có mô tả.';
    let coverFile = '';
    let authorName = 'Đang cập nhật';
    for (const rel of (manga.relationships || [])) {
      if (rel.type === 'cover_art' && rel.attributes?.fileName) coverFile = rel.attributes.fileName;
      if (rel.type === 'author' && rel.attributes?.name) authorName = rel.attributes.name;
    }
    const cover = coverFile ? `https://uploads.mangadex.org/covers/${cleanId}/${coverFile}.512.jpg` : '';

    // Get chapters feed
    const feedResp = await fetch(`https://api.mangadex.org/manga/${cleanId}/feed?order[chapter]=desc&order[volume]=desc&includes[]=scanlation_group&includes[]=user&limit=100`);
    const feedData = await feedResp.json();
    const chapters = [];
    for (const ch of (feedData.data || [])) {
      const chAttr = ch.attributes || {};
      const chNum = chAttr.chapter ? `Chapter ${chAttr.chapter}` : 'One-shot';
      const chTitle = chAttr.title ? `: ${chAttr.title}` : '';
      const lang = (chAttr.translatedLanguage || 'other').toUpperCase();
      const isExternal = Boolean(chAttr.externalUrl);

      // Extract group
      let groupName = '';
      for (const rel of ch.relationships || []) {
        if (rel.type === 'scanlation_group' && rel.attributes?.name) {
          groupName = rel.attributes.name;
          break;
        }
      }
      if (!groupName) {
        for (const rel of ch.relationships || []) {
          if (rel.type === 'user' && rel.attributes?.username) {
            groupName = rel.attributes.username;
            break;
          }
        }
      }

      chapters.push({
        id: ch.id,
        title: `${chNum}${chTitle} [${lang}]${isExternal ? ' 🔗' : ''}`,
        url: isExternal ? chAttr.externalUrl : `https://mangadex.org/chapter/${ch.id}`,
        releaseTime: chAttr.publishAt ? new Date(chAttr.publishAt).toLocaleDateString('vi-VN') : 'Mới cập nhật',
        lang: (chAttr.translatedLanguage || 'other').toLowerCase(),
        group: groupName || '',
        isExternal,
        externalUrl: chAttr.externalUrl || null
      });
    }

    return {
      id: `mangadex_${cleanId}`,
      rawId: cleanId,
      pluginId: 'mangadex',
      title,
      url: `https://mangadex.org/title/${cleanId}`,
      cover,
      author: authorName,
      status: attr.status === 'completed' ? 'Hoàn thành' : 'Đang tiến hành',
      description,
      chapters,
      latestChapter: chapters[0]?.title || 'Chưa có chap'
    };
  },

  async getMangaDexImages(chapterUrl) {
    const cleanId = chapterUrl.replace('https://mangadex.org/chapter/', '').split('?')[0].split('/')[0];
    const resp = await fetch(`https://api.mangadex.org/at-home/server/${cleanId}`);
    const data = await resp.json();
    const baseUrl = data.baseUrl;
    const hash = data.chapter.hash;
    const files = data.chapter.data;
    return files.map(f => `${baseUrl}/data/${hash}/${f}`);
  },

  // 2. Góc Truyện Tranh
  async searchGocTruyenTranh(keyword) {
    try {
      const mirrors = [
        'https://goctruyentranhvui41.com',
        'https://goctruyentranhvui31.com',
        'https://goctruyentranhvui30.com',
        'https://goctruyentranhvui18.com',
        'https://goctruyentranhvui.com',
        'https://goctruyentranhvui2.com'
      ];
      for (const mirror of mirrors) {
        try {
          const apiUrl = `${mirror}/api/comic/search?name=${encodeURIComponent(keyword)}`;
          const textData = await nativeGet(apiUrl, {
            'Referer': mirror + '/',
            'X-Requested-With': 'XMLHttpRequest'
          });
          const parsed = typeof textData === 'object' ? textData : (typeof textData === 'string' ? JSON.parse(textData) : null);
          if (parsed && Array.isArray(parsed.result)) {
            const results = [];
            for (const item of parsed.result) {
              if (item.display === false) continue;
              const slug = item.nameEn || item.slug || '';
              const title = item.name || item.title || '';
              if (!slug || !title) continue;

              const fullUrl = `${mirror}/truyen/${slug}`;
              let cover = item.photo ? (item.photo.startsWith('http') ? item.photo : `${mirror}${item.photo.startsWith('/') ? '' : '/'}${item.photo}`) : '';
              if (cover.includes('/c/code')) cover = cover.replace(/\/c\/code/g, '/c/web');
              const latest = Array.isArray(item.chapterLatest) && item.chapterLatest[0] ? `Chap ${item.chapterLatest[0]}` : 'Đang cập nhật';

              results.push({
                id: `goctruyentranh_${encodeURIComponent(fullUrl)}`,
                rawId: slug,
                pluginId: 'goctruyentranh',
                title: title.replace(/\s+/g, ' '),
                url: fullUrl,
                cover: cover || 'https://placehold.co/200x300/1e293b/a78bfa?text=GocTruyenTranh',
                latestChapter: latest,
                author: item.author && item.author !== 'Updating' ? item.author : 'Đang cập nhật',
                status: item.statusCode === 'CMP' ? 'Hoàn thành' : 'Đang tiến hành'
              });
            }
            if (results.length > 0) return results;
          }
        } catch (e) {}
      }
      return [];
    } catch (err) {
      console.warn('[MobileBridge] Goc search error:', err);
      return [];
    }
  },

  async getGocTruyenTranhImages(chapterUrl) {
    let targetUrl = chapterUrl;
    const domains = ['goctruyentranhvui41.com', 'goctruyentranhvui40.com', 'goctruyentranhvui39.com', 'goctruyentranh.com', 'goctruyentranhvui.com'];
    const activeBase = 'https://goctruyentranhvui41.com';
    for (const d of domains) {
      if (targetUrl.includes(d)) {
        targetUrl = targetUrl.replace(new RegExp(`https?:\\/\\/[^\\/]*${d}`, 'i'), activeBase);
        break;
      }
    }
    const domain = new URL(targetUrl).origin;
    const db = getLocalDB();
    const rawInput = db.settings?.gocTruyenTranhCookie || db.settings?.gocTruyenTranhAuthToken || db.settings?.gocTruyenTranhToken || db.settings?.authorization || '';
    const parsedAuth = parseGocTruyenTranhAuth(rawInput);

    const reqHeaders = {
      'Referer': domain + '/'
    };
    if (parsedAuth.token) reqHeaders['Authorization'] = parsedAuth.token;
    if (parsedAuth.cookie) reqHeaders['Cookie'] = parsedAuth.cookie;

    const pageRes = await nativeGetFull(targetUrl, reqHeaders);
    const htmlStr = typeof pageRes.data === 'string' ? pageRes.data : JSON.stringify(pageRes.data || '');
    const pageCookies = pageRes.cookieHeader || '';

    // 1. Try static HTML <img> tags
    const imgRegex = /<img[^>]+(?:src|data-src|data-original|data-cdn)=["']([^"']+)["'][^>]*>/gi;
    const staticImgs = [];
    let match;
    while ((match = imgRegex.exec(htmlStr)) !== null) {
      const src = match[1];
      if (src && !src.includes('banner') && !src.includes('quangcao') && !src.includes('logo') && !src.includes('icon') && !src.includes('facebook') && !src.includes('google')) {
        let clean = src.trim();
        if (clean.startsWith('//')) clean = 'https:' + clean;
        else if (clean.startsWith('/')) clean = domain + clean;
        staticImgs.push(clean);
      }
    }
    if (staticImgs.length > 3) return staticImgs;

    // 2. Try comic object and /api/chapter/loadAll
    const comicMatch = htmlStr.match(/comic\s*=\s*\{([\s\S]*?)\}/);
    if (comicMatch) {
      const comicIdMatch = comicMatch[1].match(/id\s*:\s*[`'"]?([0-9a-zA-Z_-]+)[`'"]?/);
      const nameEnMatch = comicMatch[1].match(/nameEn\s*:\s*[`'"]?([0-9a-zA-Z_-]+)[`'"]?/);
      const curNumMatch = comicMatch[1].match(/currentNumber\s*:\s*[`'"]?([0-9.]+)[`'"]?/);

      const comicId = comicIdMatch ? comicIdMatch[1] : '';
      const nameEn = nameEnMatch ? nameEnMatch[1] : '';
      const chapterNumber = curNumMatch ? curNumMatch[1] : '';

      if (comicId && chapterNumber) {
        const payloadObj = {
          comicId,
          chapterNumber,
          nameEn
        };

        const finalCookies = [pageCookies, parsedAuth.cookie].filter(Boolean).join('; ');

        const apiHeaders = {
          'Referer': targetUrl,
          'Origin': domain,
          'X-Requested-With': 'XMLHttpRequest'
        };
        if (finalCookies) apiHeaders['Cookie'] = finalCookies;
        if (parsedAuth.token) apiHeaders['Authorization'] = parsedAuth.token;

        const apiData = await nativePost(`${domain}/api/chapter/loadAll`, payloadObj, apiHeaders);
        const parsed = typeof apiData === 'object' ? apiData : (typeof apiData === 'string' ? JSON.parse(apiData) : null);
        const rawList = parsed?.result?.data || parsed?.result?.images || parsed?.result || parsed?.data;
        if (Array.isArray(rawList) && rawList.length > 0) {
          return rawList.map(src => {
            const str = typeof src === 'string' ? src : (src.src || src.url || src.image || '');
            let clean = str.trim();
            if (clean.startsWith('//')) clean = 'https:' + clean;
            else if (clean.startsWith('/')) clean = domain + clean;
            return clean;
          }).filter(Boolean);
        }

        if (parsed?.result?.codeState === '01') {
          if (parsedAuth.token) {
            throw new Error('Tài khoản Góc Truyện Tranh chưa đủ cấp độ (Level 2+) hoặc mã Authorization đã hết hạn. Vui lòng đăng nhập lại trên web và cập nhật mã mới vào Cài đặt.');
          } else {
            throw new Error('Chương yêu cầu tài khoản thành viên trên Góc Truyện Tranh. Bạn hãy vào Cài đặt (⚙️) dán mã Authorization tài khoản để mở khóa xem trực tiếp!');
          }
        }

        if (parsed?.messages?.length > 0) {
          throw new Error(`Góc Truyện Tranh: ${parsed.messages[0]}`);
        }
      }
    }

    if (staticImgs.length > 0) return staticImgs;

    throw new Error('Không tìm thấy ảnh của chương này. Hãy kiểm tra kết nối mạng hoặc thử lại.');
  },

  // 3. TruyenQQ
  async getTruyenQQImages(chapterUrl) {
    const domain = 'https://truyenqqto.com';
    const html = await nativeGet(chapterUrl, { 'Referer': domain + '/' });
    const htmlStr = typeof html === 'string' ? html : JSON.stringify(html);

    const imgRegex = /<img[^>]+(?:src|data-src|data-original|data-cdn)=["']([^"']+)["'][^>]*>/gi;
    const imgs = [];
    let match;
    while ((match = imgRegex.exec(htmlStr)) !== null) {
      const src = match[1];
      if (src && !src.includes('banner') && !src.includes('quangcao') && !src.includes('logo') && !src.includes('icon') && !src.includes('avatar')) {
        let clean = src.trim();
        if (clean.startsWith('//')) clean = 'https:' + clean;
        else if (clean.startsWith('/')) clean = domain + clean;
        imgs.push(clean);
      }
    }
    return imgs;
  },

  // 4. MoeTruyen
  async getMoeTruyenImages(chapterUrl) {
    const domain = 'https://moetruyen.net';
    const html = await nativeGet(chapterUrl, { 'Referer': domain + '/' });
    const htmlStr = typeof html === 'string' ? html : JSON.stringify(html);

    const isImgx = htmlStr.includes('IMGX') || htmlStr.includes('data-imgx-protected-canvas') || htmlStr.includes('data-reader-imgx');

    const imgRegex = /<img[^>]+(?:data-src|data-original|data-url|src)=["']([^"']+)["'][^>]*>/gi;
    const imgs = [];
    let match;
    while ((match = imgRegex.exec(htmlStr)) !== null) {
      const src = match[1];
      if (!src || src.startsWith('data:') || src.includes('svg+xml') || src.includes('${') || src.includes('escapeAttribute')) continue;
      if (
        src.includes('/avatars/') || 
        src.includes('/covers/') || 
        src.includes('logo') || 
        src.includes('banner') || 
        src.includes('icon') || 
        src.includes('comment') ||
        src.includes('googleusercontent')
      ) continue;

      let clean = src.trim();
      if (clean.startsWith('//')) clean = 'https:' + clean;
      else if (clean.startsWith('/')) clean = domain + clean;

      if (!clean.startsWith('http://') && !clean.startsWith('https://')) continue;
      if (!imgs.includes(clean)) imgs.push(clean);
    }

    if (imgs.length === 0) {
      if (isImgx) {
        throw new Error('MOETRUYEN_IMGX_ENCRYPTED: Chương này trên Mòe Truyện được bảo vệ bằng mã hóa IMGX. Tự động chuyển sang trang gốc.');
      }
      throw new Error('Không tìm thấy ảnh tĩnh trong chương này trên Mòe Truyện.');
    }

    return imgs;
  },

  // Universal Fallback
  async getGenericImages(chapterUrl) {
    const origin = new URL(chapterUrl).origin;
    const html = await nativeGet(chapterUrl, { 'Referer': origin + '/' });
    const htmlStr = typeof html === 'string' ? html : JSON.stringify(html);

    const imgRegex = /<img[^>]+(?:src|data-src|data-original|data-cdn)=["']([^"']+)["'][^>]*>/gi;
    const imgs = [];
    let match;
    while ((match = imgRegex.exec(htmlStr)) !== null) {
      const src = match[1];
      if (src && !src.includes('banner') && !src.includes('logo') && !src.includes('icon')) {
        let clean = src.trim();
        if (clean.startsWith('//')) clean = 'https:' + clean;
        else if (clean.startsWith('/')) clean = origin + clean;
        imgs.push(clean);
      }
    }
    return imgs;
  }
};

export function setupMobileBridge() {
  if (typeof window === 'undefined' || window.electronAPI) return;

  console.log('⚡ [MobileBridge] Khởi tạo cầu nối Mobile Android / Web cho Manga Notifier');

  const listeners = {
    mangas: new Set(),
    history: new Set(),
    poll: new Set()
  };

  const broadcastMangas = () => {
    const db = getLocalDB();
    listeners.mangas.forEach(cb => cb(db.mangas));
  };

  window.electronAPI = {
    getMangas: async () => getLocalDB().mangas,

    addManga: async (manga) => {
      const db = getLocalDB();
      const existingIdx = db.mangas.findIndex(m => m.id === manga.id || m.url === manga.url);
      const autoTag = mapStatusToTag(manga.status, manga.tag);
      const newEntry = {
        ...manga,
        addedAt: new Date().toISOString(),
        lastCheckedAt: new Date().toISOString(),
        hasUnread: false,
        readChapters: manga.readChapters || [],
        tag: autoTag,
        latestChapter: manga.latestChapter || (manga.chapters?.[0]?.title || 'Chưa rõ')
      };
      if (existingIdx >= 0) {
        db.mangas[existingIdx] = { ...db.mangas[existingIdx], ...newEntry };
      } else {
        db.mangas.unshift(newEntry);
      }
      saveLocalDB(db);
      broadcastMangas();
      try {
        const { syncService } = await import('./syncService');
        syncService.sendAction('ADD_MANGA', { manga: newEntry });
      } catch (e) {}
      return newEntry;
    },

    deleteManga: async (id) => {
      const db = getLocalDB();
      db.mangas = db.mangas.filter(m => m.id !== id);
      saveLocalDB(db);
      broadcastMangas();
      try {
        const { syncService } = await import('./syncService');
        syncService.sendAction('DELETE_MANGA', { mangaId: id });
      } catch (e) {}
      return true;
    },

    updateManga: async (id, updates) => {
      const db = getLocalDB();
      const idx = db.mangas.findIndex(m => m.id === id);
      if (idx >= 0) {
        db.mangas[idx] = { ...db.mangas[idx], ...updates };
        saveLocalDB(db);
        broadcastMangas();
        try {
          const { syncService } = await import('./syncService');
          syncService.sendAction('UPDATE_MANGA', { mangaId: id, updates });
        } catch (e) {}
        return db.mangas[idx];
      }
      return null;
    },

    markChapterRead: async (mangaId, chapterId, chapterTitle = '') => {
      const db = getLocalDB();
      const manga = db.mangas.find(m => m.id === mangaId);
      if (manga) {
        const readSet = new Set(manga.readChapters || []);
        readSet.add(chapterId);
        manga.readChapters = Array.from(readSet);
        manga.lastReadChapterId = chapterId;
        const chapObj = (manga.chapters || []).find(c => c.id === chapterId);
        if (chapObj) {
          manga.lastReadChapter = chapObj;
          manga.lastReadChapterTitle = chapObj.title;
        }
        manga.hasUnread = (manga.chapters || []).some(c => !readSet.has(c.id));
        saveLocalDB(db);
        broadcastMangas();
        try {
          const { syncService } = await import('./syncService');
          syncService.sendAction('CHAPTER_READ', { mangaId, chapterId, chapterTitle: chapObj?.title || chapterTitle });
        } catch (e) {}
        return manga;
      }
      return null;
    },

    markAllChaptersRead: async (mangaId) => {
      const db = getLocalDB();
      const manga = db.mangas.find(m => m.id === mangaId);
      if (manga && manga.chapters) {
        manga.readChapters = manga.chapters.map(c => c.id);
        manga.hasUnread = false;
        saveLocalDB(db);
        broadcastMangas();
        try {
          const { syncService } = await import('./syncService');
          syncService.sendAction('MARK_ALL_READ', { mangaId });
        } catch (e) {}
        return manga;
      }
      return null;
    },

    getHistory: async () => getLocalDB().history,

    addHistory: async (entry) => {
      const db = getLocalDB();
      const newHistory = {
        ...entry,
        id: `hist_${Date.now()}`,
        readAt: new Date().toISOString()
      };
      db.history = [newHistory, ...db.history.filter(h => h.chapterUrl !== entry.chapterUrl)].slice(0, 100);
      saveLocalDB(db);
      listeners.history.forEach(cb => cb(db.history));
      return newHistory;
    },

    clearHistory: async () => {
      const db = getLocalDB();
      db.history = [];
      saveLocalDB(db);
      listeners.history.forEach(cb => cb([]));
      return true;
    },

    getSettings: async () => getLocalDB().settings,

    updateSettings: async (settings) => {
      const db = getLocalDB();
      db.settings = { ...db.settings, ...settings };
      saveLocalDB(db);
      return db.settings;
    },

    saveSettings: async (settings) => {
      const db = getLocalDB();
      db.settings = { ...db.settings, ...settings };
      saveLocalDB(db);
      return db.settings;
    },

    exportBackup: async () => {
      const db = getLocalDB();
      return {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        mangas: db.mangas,
        history: db.history,
        settings: db.settings
      };
    },

    importBackup: async (backupData) => {
      if (!backupData || !Array.isArray(backupData.mangas)) {
        throw new Error('File sao lưu không hợp lệ');
      }
      const db = getLocalDB();
      const existingMap = new Map(db.mangas.map(m => [m.url || m.id, m]));
      for (const m of backupData.mangas) {
        const key = m.url || m.id;
        if (existingMap.has(key)) {
          const old = existingMap.get(key);
          const readSet = new Set([...(old.readChapters || []), ...(m.readChapters || [])]);
          existingMap.set(key, {
            ...old,
            ...m,
            readChapters: Array.from(readSet),
            lastReadChapter: m.lastReadChapter || old.lastReadChapter,
            lastReadChapterTitle: m.lastReadChapterTitle || old.lastReadChapterTitle,
            tag: m.tag || old.tag
          });
        } else {
          existingMap.set(key, m);
        }
      }
      db.mangas = Array.from(existingMap.values());
      if (backupData.settings && typeof backupData.settings === 'object') {
        db.settings = { ...db.settings, ...backupData.settings };
      }
      saveLocalDB(db);
      broadcastMangas();
      return db;
    },

    getPlugins: async () => [
      { id: 'mangadex', name: 'MangaDex' },
      { id: 'truyenqq', name: 'TruyenQQ' },
      { id: 'goctruyentranh', name: 'Góc Truyện Tranh' },
      { id: 'moetruyen', name: 'MoeTruyen' }
    ],

    searchManga: async (keyword, pluginId) => {
      try {
        let results = [];
        if (!pluginId || pluginId === 'mangadex') {
          const mdResults = await MobileScraper.searchMangaDex(keyword);
          results.push(...mdResults);
        }
        if (!pluginId || pluginId === 'goctruyentranh') {
          const gocResults = await MobileScraper.searchGocTruyenTranh(keyword);
          results.push(...gocResults);
        }

        const normalizeStr = (str) => (str || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const stopWords = new Set(['den', 'tu', 'va', 'cua', 'la', 'o', 'trong', 'cho', 'voi', 'nhung', 'cac', 'mot', 'ra', 'lai', 'duoc', 'se', 'da', 'dang', 'the', 'nay', 'do', 'nao']);

        const normKeyword = normalizeStr(keyword);
        const rawTokens = normKeyword.split(' ').filter(tok => tok.length >= 2);
        const significantTokens = rawTokens.filter(tok => !stopWords.has(tok));
        const tokensToCheck = significantTokens.length > 0 ? significantTokens : rawTokens;

        return results
          .filter(item => {
            if (!item || !item.title) return false;
            const u = (item.url || '').toLowerCase();
            const t = (item.title || '').toLowerCase();
            if (
              u.includes('/truyen/luot-su') || 
              u.includes('/truyen/theo-doi') || 
              u.includes('/truyen/lich-su') || 
              u.includes('/truyen/yeu-thich') ||
              t.includes('lượt sử') ||
              t.includes('lịch sử') ||
              t.includes('theo dõi') ||
              t.includes('yêu thích') ||
              t === 'truyện theo dõi' ||
              t === 'truyện đã đọc'
            ) return false;

            const normTitle = normalizeStr(item.title);
            const normUrl = normalizeStr(item.url);
            const normSlug = normalizeStr(item.rawId || item.id || '');
            const normAuthor = normalizeStr(item.author);

            if (
              normTitle.includes(normKeyword) || 
              normSlug.includes(normKeyword.replace(/\s+/g, '-')) || 
              normSlug.includes(normKeyword.replace(/\s+/g, ' ')) ||
              normAuthor.includes(normKeyword)
            ) {
              return true;
            }

            // Exact word tokens
            const titleWords = new Set([
              ...normTitle.split(/\s+/).filter(Boolean),
              ...normSlug.split(/[^a-z0-9]+/).filter(Boolean)
            ]);

            if (tokensToCheck.length === 1) {
              const singleTok = tokensToCheck[0];
              return titleWords.has(singleTok) || normTitle.includes(singleTok) || normSlug.includes(singleTok);
            }

            const matchedWords = tokensToCheck.filter(tok => titleWords.has(tok));
            const matchRatio = matchedWords.length / tokensToCheck.length;
            return matchedWords.length >= Math.min(2, tokensToCheck.length) && matchRatio >= 0.3;
          })
          .map(item => {
            const normTitle = normalizeStr(item.title);
            let score = 0;
            if (normTitle === normKeyword) score += 200;
            else if (normTitle.startsWith(normKeyword)) score += 150;
            else if (normTitle.includes(normKeyword)) score += 100;
            else {
              tokensToCheck.forEach(tok => {
                if (normTitle.includes(tok)) score += 25;
              });
            }
            return { ...item, _score: score };
          })
          .sort((a, b) => b._score - a._score);
      } catch (e) {
        console.error('[MobileBridge] Search error:', e);
        return [];
      }
    },

    getMangaDetails: async (url) => {
      if (url.includes('mangadex.org')) {
        return await MobileScraper.getMangaDexDetails(url);
      }
      throw new Error('Đang tải dữ liệu truyện trên Mobile...');
    },

    getChapterImages: async (chapterUrl, pluginId) => {
      try {
        if (chapterUrl.includes('mangadex.org') || pluginId === 'mangadex') {
          return await MobileScraper.getMangaDexImages(chapterUrl);
        }
        if (chapterUrl.includes('goctruyentranh') || pluginId === 'goctruyentranh') {
          return await MobileScraper.getGocTruyenTranhImages(chapterUrl);
        }
        if (chapterUrl.includes('truyenqq') || pluginId === 'truyenqq') {
          return await MobileScraper.getTruyenQQImages(chapterUrl);
        }
        if (chapterUrl.includes('moetruyen') || pluginId === 'moetruyen') {
          return await MobileScraper.getMoeTruyenImages(chapterUrl);
        }
        return await MobileScraper.getGenericImages(chapterUrl);
      } catch (err) {
        console.error('[MobileBridge] Lỗi lấy ảnh chương:', err);
        throw err;
      }
    },

    getImageData: async (imgUrl, chapterUrl) => {
      if (Capacitor.isNativePlatform()) {
        const urlsToTry = [imgUrl];
        if (imgUrl.includes('mangadex.network')) {
          const match = imgUrl.match(/\/(data(?:-saver)?\/[a-f0-9]+\/[^/?#]+)/i);
          if (match) {
            urlsToTry.push(`https://uploads.mangadex.org/${match[1]}`);
          }
        }

        for (const targetUrl of urlsToTry) {
          try {
            const domain = chapterUrl ? new URL(chapterUrl).origin : 'https://mangadex.org';
            const resp = await CapacitorHttp.get({
              url: targetUrl,
              responseType: 'blob',
              headers: {
                'Referer': domain + '/',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
              }
            });
            if (resp.data && (resp.status === 200 || !resp.status)) {
              return `data:image/jpeg;base64,${resp.data}`;
            }
          } catch (e) {}
        }
      }
      return imgUrl;
    },

    checkAllNow: async () => {
      const db = getLocalDB();
      let hasUpdates = false;
      for (const manga of db.mangas) {
        try {
          if (manga.pluginId === 'mangadex' && manga.rawId) {
            const details = await MobileScraper.getMangaDexDetails(manga.rawId);
            if (details && details.chapters && details.chapters.length > 0) {
              const latestChap = details.chapters[0];
              const oldChapters = manga.chapters || [];
              const isNew = oldChapters.length > 0 && !oldChapters.some(c => c.id === latestChap.id);
              manga.chapters = details.chapters;
              manga.latestChapter = latestChap.title;
              hasUpdates = true;

              if (isNew) {
                manga.hasUnread = true;

                // Send Mobile Local Notification
                try {
                  const { NotificationService } = await import('./notificationService');
                  await NotificationService.sendNewChapterNotification({
                    mangaTitle: manga.title,
                    chapterTitle: latestChap.title,
                    mangaId: manga.id,
                    chapterUrl: latestChap.url,
                    cover: manga.cover
                  });
                } catch (ne) {
                  console.warn('Lỗi gửi push notification:', ne);
                }
              }
            }
          }
        } catch (e) {
          console.warn('[MobileBridge] Lỗi quét truyện:', manga.title, e.message);
        }
      }
      if (hasUpdates) {
        saveLocalDB(db);
        broadcastMangas();
      }
      return true;
    },

    checkMangaNow: async (mangaId) => {
      const db = getLocalDB();
      return db.mangas.find(m => m.id === mangaId) || null;
    },

    openExternal: async (url) => {
      window.open(url, '_blank');
    },

    onMangasUpdated: (callback) => {
      listeners.mangas.add(callback);
      return () => listeners.mangas.delete(callback);
    },
    onHistoryUpdated: (callback) => {
      listeners.history.add(callback);
      return () => listeners.history.delete(callback);
    },
    onPollStatus: (callback) => {
      listeners.poll.add(callback);
      return () => listeners.poll.delete(callback);
    },
    onOpenReader: () => () => {},
    onMangaUpdatedSingle: () => () => {}
  };
}

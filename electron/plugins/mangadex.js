const axios = require('axios');
const BasePlugin = require('./base_plugin');

class MangaDexPlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'MangaDex';
    this.id = 'mangadex';
    this.baseUrl = 'https://mangadex.org';
    this.apiBase = 'https://api.mangadex.org';
    this.domains = ['mangadex.org', 'api.mangadex.org'];
  }

  extractMangaId(url) {
    if (!url) return '';
    // Format: https://mangadex.org/title/UUID/manga-title
    const match = url.match(/\/title\/([0-9a-fA-F-]{36})/i) || url.match(/([0-9a-fA-F-]{36})/i);
    return match ? match[1] : url.trim();
  }

  extractChapterId(url) {
    if (!url) return '';
    // Format: https://mangadex.org/chapter/UUID
    const match = url.match(/\/chapter\/([0-9a-fA-F-]{36})/i) || url.match(/([0-9a-fA-F-]{36})/i);
    return match ? match[1] : url.trim();
  }

  async search(keyword) {
    try {
      const resp = await axios.get(`${this.apiBase}/manga`, {
        params: {
          title: keyword,
          limit: 15,
          'includes[]': ['cover_art', 'author']
        },
        timeout: 10000
      });

      if (!resp.data || !resp.data.data) return [];

      return resp.data.data.map(manga => {
        const id = manga.id;
        const attributes = manga.attributes || {};
        const titleObj = attributes.title || {};
        let title = titleObj.vi || titleObj.en || titleObj['ja-ro'] || titleObj.ja || Object.values(titleObj)[0];
        
        if (!title && Array.isArray(attributes.altTitles)) {
          for (const alt of attributes.altTitles) {
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
        for (const rel of manga.relationships || []) {
          if (rel.type === 'cover_art' && rel.attributes?.fileName) {
            coverFile = rel.attributes.fileName;
          }
          if (rel.type === 'author' && rel.attributes?.name) {
            authorName = rel.attributes.name;
          }
        }

        const cover = coverFile 
          ? `https://uploads.mangadex.org/covers/${id}/${coverFile}.256.jpg`
          : 'https://placehold.co/200x300/1e293b/a78bfa?text=No+Cover';

        return {
          id: `mangadex_${id}`,
          rawId: id,
          pluginId: this.id,
          title,
          url: `https://mangadex.org/title/${id}`,
          cover,
          author: authorName,
          latestChapter: attributes.lastChapter ? `Chap ${attributes.lastChapter}` : 'Đang cập nhật',
          status: attributes.status === 'completed' ? 'Hoàn thành' : 'Đang tiến hành'
        };
      });
    } catch (err) {
      console.error('[MangaDex] Search error:', err.message);
      return [];
    }
  }

  async getMangaDetails(mangaUrl) {
    const mangaId = this.extractMangaId(mangaUrl);
    if (!mangaId) throw new Error('Không thể nhận diện MangaDex ID');

    try {
      // 1. Get manga info
      const mangaResp = await axios.get(`${this.apiBase}/manga/${mangaId}`, {
        params: {
          'includes[]': ['cover_art', 'author', 'artist']
        },
        timeout: 10000
      });

      const manga = mangaResp.data.data;
      const attributes = manga.attributes || {};
      const titleObj = attributes.title || {};
      let title = titleObj.vi || titleObj.en || titleObj['ja-ro'] || titleObj.ja || Object.values(titleObj)[0];
      if (!title && Array.isArray(attributes.altTitles)) {
        for (const alt of attributes.altTitles) {
          const val = alt.vi || alt.en || alt['ja-ro'] || Object.values(alt)[0];
          if (val) {
            title = val;
            break;
          }
        }
      }
      title = title || 'Chưa đặt tên';

      const description = attributes.description?.vi || attributes.description?.en || Object.values(attributes.description || {})[0] || 'Không có mô tả.';

      let coverFile = '';
      let authorName = 'Đang cập nhật';
      for (const rel of manga.relationships || []) {
        if (rel.type === 'cover_art' && rel.attributes?.fileName) {
          coverFile = rel.attributes.fileName;
        }
        if (rel.type === 'author' && rel.attributes?.name) {
          authorName = rel.attributes.name;
        }
      }

      const cover = coverFile 
        ? `https://uploads.mangadex.org/covers/${mangaId}/${coverFile}.512.jpg`
        : 'https://placehold.co/300x450/1e293b/a78bfa?text=No+Cover';

      // 2. Get chapter feed (paginated to fetch ALL chapters across all languages)
      const chapterList = [];
      let offset = 0;
      const limit = 100;
      let total = 100;

      while (offset < total && offset < 1000) {
        const feedResp = await axios.get(`${this.apiBase}/manga/${mangaId}/feed`, {
          params: {
            'order[chapter]': 'desc',
            'order[volume]': 'desc',
            'includes[]': ['scanlation_group', 'user'],
            limit,
            offset
          },
          timeout: 12000
        });

        total = feedResp.data?.total || 0;
        const pageData = feedResp.data?.data || [];
        if (pageData.length === 0) break;

        for (const ch of pageData) {
          const chAttr = ch.attributes || {};
          const chNum = chAttr.chapter ? `Chapter ${chAttr.chapter}` : 'One-shot';
          const chTitle = chAttr.title ? `: ${chAttr.title}` : '';
          const langCode = (chAttr.translatedLanguage || 'other').toLowerCase();
          const langTag = langCode.toUpperCase();
          const isExternal = Boolean(chAttr.externalUrl);

          // Extract scanlation group
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

          chapterList.push({
            id: ch.id,
            title: `${chNum}${chTitle} [${langTag}]${isExternal ? ' 🔗' : ''}`,
            chapterNumber: parseFloat(chAttr.chapter) || 0,
            url: isExternal ? chAttr.externalUrl : `https://mangadex.org/chapter/${ch.id}`,
            releaseTime: chAttr.publishAt ? new Date(chAttr.publishAt).toLocaleDateString('vi-VN') : 'Mới cập nhật',
            lang: langCode,
            langName: langCode === 'vi' ? 'Tiếng Việt' : (langCode === 'en' ? 'English' : langTag),
            group: groupName || '',
            isExternal,
            externalUrl: chAttr.externalUrl || null
          });
        }

        offset += limit;
        if (offset >= total) break;
      }

      return {
        id: `mangadex_${mangaId}`,
        rawId: mangaId,
        pluginId: this.id,
        title,
        url: `https://mangadex.org/title/${mangaId}`,
        cover,
        author: authorName,
        status: attributes.status === 'completed' 
          ? 'Hoàn thành' 
          : (attributes.status === 'hiatus' || attributes.status === 'cancelled' ? 'Tạm ngưng' : 'Đang tiến hành'),
        description,
        chapters: chapterList,
        latestChapter: chapterList[0] ? chapterList[0].title : 'Chưa có chap'
      };
    } catch (err) {
      console.error('[MangaDex] getMangaDetails error:', err.message);
      throw err;
    }
  }

  async getChapterImages(chapterUrl, options = {}) {
    if (!chapterUrl) throw new Error('URL chương không hợp lệ');

    // If chapter is hosted on external website (like MangaPlus)
    if (!chapterUrl.includes('mangadex.org/chapter/')) {
      throw new Error('Chương này được phát hành trên web đối tác (MangaPlus/Bilibili). Vui lòng bấm nút "Mở trên web" để đọc trực tiếp.');
    }

    const chapterId = this.extractChapterId(chapterUrl);
    if (!chapterId) throw new Error('Không thể nhận diện Chapter ID MangaDex');

    try {
      const resp = await axios.get(`${this.apiBase}/at-home/server/${chapterId}`, {
        timeout: 12000
      });

      const baseUrl = resp.data.baseUrl;
      const chapterData = resp.data.chapter;
      const hash = chapterData.hash;
      const useDataSaver = !!options.dataSaver || (!chapterData.data || chapterData.data.length === 0);
      const files = (useDataSaver ? chapterData.dataSaver : chapterData.data) || chapterData.data || chapterData.dataSaver || [];
      const subPath = (useDataSaver && chapterData.dataSaver?.length) ? 'data-saver' : 'data';

      return files.map(file => `${baseUrl}/${subPath}/${hash}/${file}`);
    } catch (err) {
      if (err.response?.status === 404) {
        throw new Error('Chương này không lưu trữ ảnh trên MangaDex (liên kết ngoài). Vui lòng bấm "Mở trên web" để đọc.');
      }
      console.error('[MangaDex] getChapterImages error:', err.message);
      throw err;
    }
  }
}

module.exports = MangaDexPlugin;

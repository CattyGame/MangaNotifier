const axios = require('axios');
const cheerio = require('cheerio');
const BasePlugin = require('./base_plugin');

class MoeTruyenPlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'Mòe Truyện';
    this.id = 'moetruyen';
    this.baseUrl = 'https://moetruyen.net';
    this.domains = [
      'moetruyen.net',
      'truyen.moe',
      'moetruyen.com'
    ];
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': this.baseUrl
    };
  }

  canHandle(url) {
    if (!url) return false;
    const lower = url.toLowerCase();
    return this.domains.some(d => lower.includes(d));
  }

  formatImageUrl(src, originUrl) {
    if (!src || src.startsWith('data:') || src.includes('${') || src.includes('escapeAttribute') || src.includes('svg+xml')) return '';
    let clean = src.trim();
    if (clean.startsWith('//')) {
      clean = 'https:' + clean;
    } else if (clean.startsWith('/')) {
      const base = originUrl ? new URL(originUrl).origin : this.baseUrl;
      clean = base + clean;
    }
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) return '';
    return clean;
  }

  async search(keyword) {
    try {
      const url = `${this.baseUrl}/manga?q=${encodeURIComponent(keyword)}`;
      const resp = await axios.get(url, {
        headers: this.headers,
        timeout: 12000
      });

      const $ = cheerio.load(resp.data);
      const results = [];
      const seen = new Set();

      $('a[href*="/manga/"], .manga-card, .story-item, .card').each((_, el) => {
        const item = $(el);
        const linkEl = item.is('a[href*="/manga/"]') ? item : item.find('a[href*="/manga/"]').first();
        const link = linkEl.attr('href');

        if (!link || link === '/manga' || link.includes('/chapters/')) return;

        let fullUrl = link;
        if (!fullUrl.startsWith('http')) {
          fullUrl = `${this.baseUrl}${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
        }

        if (seen.has(fullUrl)) return;
        seen.add(fullUrl);

        let title = linkEl.find('.title, h3, h2, strong').text().trim() || linkEl.text().trim();
        if (!title) {
          title = item.find('.title, h3, h2, strong').first().text().trim();
        }

        const imgEl = item.find('img').first();
        const coverSrc = imgEl.attr('data-src') || imgEl.attr('data-original') || imgEl.attr('src') || '';
        const cover = this.formatImageUrl(coverSrc, fullUrl);

        const latestChapEl = item.find('.latest-chapter, .chapter, .chap').first();
        const latestChapter = latestChapEl.text().trim() || 'Đang cập nhật';

        if (title && fullUrl) {
          results.push({
            id: `moetruyen_${encodeURIComponent(fullUrl)}`,
            rawId: fullUrl,
            pluginId: this.id,
            title: title.replace(/\s+/g, ' '),
            url: fullUrl,
            cover: cover || 'https://placehold.co/200x300/1e293b/a78bfa?text=MoeTruyen',
            latestChapter,
            author: 'Đang cập nhật',
            status: 'Đang tiến hành'
          });
        }
      });

      return results;
    } catch (err) {
      console.error('[MoeTruyen] Search error:', err.message);
      return [];
    }
  }

  async getMangaDetails(mangaUrl) {
    try {
      const domain = new URL(mangaUrl).origin;
      const resp = await axios.get(mangaUrl, {
        headers: {
          ...this.headers,
          Referer: domain
        },
        timeout: 15000
      });

      const $ = cheerio.load(resp.data);
      
      const title = $('h1').first().text().trim() || $('meta[property="og:title"]').attr('content') || 'Truyện Mòe Truyện';
      const ogImage = $('meta[property="og:image"]').attr('content');
      const imgEl = $('.poster img, .manga-poster img, .cover img, img[alt]').first();
      const coverSrc = ogImage || imgEl.attr('data-src') || imgEl.attr('data-original') || imgEl.attr('src') || '';
      const cover = this.formatImageUrl(coverSrc, mangaUrl);

      const author = $('.author, .manga-author, .creator').first().text().trim() || 'Đang cập nhật';
      let status = 'Đang tiến hành';
      $('.status, .manga-status, li, .meta-item').each((_, el) => {
        const text = $(el).text().trim();
        if (text.includes('Tình trạng') || text.includes('Trạng thái')) {
          const val = text.replace(/.*(Tình trạng|Trạng thái):\s*/i, '').trim();
          if (val && val.length < 50) status = val;
        } else if ($(el).hasClass('status') || $(el).hasClass('manga-status')) {
          const val = text.trim();
          if (val && val.length < 50) status = val;
        }
      });
      const description = $('.description, .manga-description, .summary').first().text().trim() || $('meta[property="og:description"]').attr('content') || 'Chưa có mô tả.';

      const chapters = [];
      const seenChap = new Set();

      $('a[href*="/chapters/"], a[href*="/chapter/"]').each((_, el) => {
        const linkEl = $(el);
        const chHref = linkEl.attr('href');
        if (!chHref || chHref === mangaUrl || chHref.startsWith('#')) return;

        let fullUrl = chHref;
        if (!fullUrl.startsWith('http')) {
          fullUrl = `${domain}${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
        }

        if (seenChap.has(fullUrl)) return;

        let chTitle = linkEl.text().trim().replace(/\s+/g, ' ');
        if (chTitle.includes('Đọc từ đầu') || chTitle.includes('Đọc mới nhất') || chTitle.includes('Đọc tiếp')) return;

        seenChap.add(fullUrl);

        const match = chTitle.match(/(?:Ch\.|Chương|Chap)\s*(\d+(\.\d+)?)/i);
        const num = match ? parseFloat(match[1]) : (parseFloat(fullUrl.split('/').pop()) || 0);

        if (match) {
          chTitle = `Chương ${match[1]}`;
        } else if (chTitle.length > 40) {
          chTitle = `Chương ${num || chTitle.slice(0, 30)}`;
        }

        chapters.push({
          id: fullUrl,
          title: chTitle || `Chương ${num}`,
          chapterNumber: num,
          url: fullUrl,
          releaseTime: 'Mới cập nhật'
        });
      });

      // Sort chapters descending by chapter number
      chapters.sort((a, b) => (b.chapterNumber || 0) - (a.chapterNumber || 0));

      // Attempt to load 100% complete chapters list from reader dropdown
      if (chapters.length > 0 && chapters[0].url) {
        try {
          const sampleChResp = await axios.get(chapters[0].url, {
            headers: {
              ...this.headers,
              Referer: mangaUrl
            },
            timeout: 10000
          });

          const ch$ = cheerio.load(sampleChResp.data);
          const fullChapters = [];
          const fullSeen = new Set();

          ch$('button.reader-dropdown-option, .reader-dropdown-option, [data-reader-option]').each((_, el) => {
            const btn = ch$(el);
            const href = btn.attr('data-href') || btn.data('href');
            if (!href) return;

            let fullUrl = href;
            if (!fullUrl.startsWith('http')) {
              fullUrl = `${domain}${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
            }

            if (fullSeen.has(fullUrl)) return;
            fullSeen.add(fullUrl);

            let chText = btn.text().trim().replace(/\s+/g, ' ');
            const match = chText.match(/(?:Ch\.|Chương|Chap)\s*(\d+(\.\d+)?)/i);
            const num = match ? parseFloat(match[1]) : (parseFloat(fullUrl.split('/').pop()) || 0);

            if (match) {
              chText = `Chương ${match[1]}`;
            } else if (chText.length > 40) {
              chText = `Chương ${num || chText.slice(0, 30)}`;
            }

            fullChapters.push({
              id: fullUrl,
              title: chText || `Chương ${num}`,
              chapterNumber: num,
              url: fullUrl,
              releaseTime: 'Mới cập nhật'
            });
          });

          if (fullChapters.length > chapters.length) {
            fullChapters.sort((a, b) => (b.chapterNumber || 0) - (a.chapterNumber || 0));
            chapters.length = 0;
            chapters.push(...fullChapters);
          }
        } catch (e) {
          // If reader page fails, fallback to standard chapters list
        }
      }

      return {
        id: `moetruyen_${encodeURIComponent(mangaUrl)}`,
        rawId: mangaUrl,
        pluginId: this.id,
        title: title.replace(/\s+/g, ' '),
        url: mangaUrl,
        cover: cover || 'https://placehold.co/300x450/1e293b/a78bfa?text=MoeTruyen',
        author: author.replace(/\s+/g, ' '),
        status: status.replace(/\s+/g, ' '),
        description,
        chapters,
        latestChapter: chapters[0] ? chapters[0].title : 'Chưa có chap'
      };
    } catch (err) {
      console.error('[MoeTruyen] getMangaDetails error:', err.message);
      throw err;
    }
  }

  async getChapterImages(chapterUrl) {
    try {
      const domain = new URL(chapterUrl).origin;
      const resp = await axios.get(chapterUrl, {
        headers: {
          ...this.headers,
          Referer: domain
        },
        timeout: 15000
      });

      const html = resp.data;
      const $ = cheerio.load(html);
      const isImgx = html.includes('IMGX') || $('[data-reader-imgx-initial-pages]').length > 0 || $('[data-imgx-protected-canvas]').length > 0;
      const images = [];

      $('img').each((_, el) => {
        const img = $(el);
        const dataSrc = img.attr('data-src') || img.attr('data-original') || img.attr('data-url');
        const src = img.attr('src') || '';
        
        let candidate = dataSrc || src;
        if (!candidate || candidate.startsWith('data:') || candidate.includes('svg+xml')) {
          candidate = dataSrc || '';
        }

        if (!candidate || candidate.startsWith('data:')) return;

        const lower = candidate.toLowerCase();
        // Strictly filter out non-chapter images (avatars, covers, comment icons, logos, banners)
        if (
          lower.includes('/avatars/') ||
          lower.includes('/covers/') ||
          lower.includes('/comment') ||
          lower.includes('googleusercontent') ||
          lower.includes('logo') ||
          lower.includes('banner') ||
          lower.includes('icon')
        ) {
          return;
        }

        const clean = this.formatImageUrl(candidate, chapterUrl);
        if (clean && !images.includes(clean)) {
          images.push(clean);
        }
      });

      if (images.length === 0) {
        if (isImgx) {
          throw new Error('MOETRUYEN_IMGX_ENCRYPTED: Chương này trên Mòe Truyện được bảo vệ bằng mã hóa IMGX. Tự động mở đọc trên Web gốc.');
        }
        throw new Error('Không tìm thấy ảnh nào trong chương này trên Mòe Truyện');
      }

      return images;
    } catch (err) {
      console.error('[MoeTruyen] getChapterImages error:', err.message);
      throw err;
    }
  }
}

module.exports = MoeTruyenPlugin;

const axios = require('axios');
const cheerio = require('cheerio');
const BasePlugin = require('./base_plugin');

class NetTruyenPlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'NetTruyen';
    this.id = 'nettruyen';
    this.baseUrl = 'https://nettruyenww.com';
    this.domains = [
      'nettruyen.com',
      'nettruyenco.vn',
      'nettruyenco.com',
      'nettruyenww.com',
      'nettruyenhq.com',
      'nettruyenaa.com',
      'nettruyenbb.com',
      'nettruyencc.com',
      'nettruyenplus.com',
      'nettruyenviet.com',
      'nettruyentv.com',
      'nettruyenmax.com'
    ];
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': this.baseUrl
    };
  }

  formatImageUrl(src, originUrl) {
    if (!src) return '';
    let clean = src.trim();
    if (clean.startsWith('//')) {
      clean = 'https:' + clean;
    } else if (clean.startsWith('/')) {
      const base = originUrl ? new URL(originUrl).origin : this.baseUrl;
      clean = base + clean;
    }
    return clean;
  }

  async search(keyword) {
    try {
      const url = `${this.baseUrl}/tim-truyen?keyword=${encodeURIComponent(keyword)}`;
      const resp = await axios.get(url, {
        headers: this.headers,
        timeout: 12000
      });

      const $ = cheerio.load(resp.data);
      const results = [];

      $('.items .item, .list-stories .story-item').each((_, el) => {
        const item = $(el);
        const titleEl = item.find('h3 a, .title a, figcaption h3 a').first();
        const title = titleEl.text().trim();
        const link = titleEl.attr('href');
        
        const imgEl = item.find('img').first();
        const coverSrc = imgEl.attr('data-original') || imgEl.attr('data-src') || imgEl.attr('src') || '';
        const cover = this.formatImageUrl(coverSrc, link);

        const latestChapEl = item.find('.comic-item-chapter a, .chapter a, .list-chapter a').first();
        const latestChapter = latestChapEl.text().trim() || 'Đang cập nhật';

        if (title && link) {
          results.push({
            id: `nettruyen_${encodeURIComponent(link)}`,
            rawId: link,
            pluginId: this.id,
            title,
            url: link.startsWith('http') ? link : `${this.baseUrl}${link}`,
            cover: cover || 'https://placehold.co/200x300/1e293b/a78bfa?text=No+Cover',
            latestChapter,
            author: 'Đang cập nhật',
            status: 'Đang tiến hành'
          });
        }
      });

      return results;
    } catch (err) {
      console.error('[NetTruyen] Search error:', err.message);
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
      
      const title = $('h1.title-detail, .title-manga, h1.title').first().text().trim() || 'Không rõ tên truyện';
      const imgEl = $('.col-image img, .detail-info img, .book_avatar img').first();
      const coverSrc = imgEl.attr('data-original') || imgEl.attr('data-src') || imgEl.attr('src') || '';
      const cover = this.formatImageUrl(coverSrc, mangaUrl);

      const author = $('.author .col-xs-8, .author-detail').first().text().trim() || 'Đang cập nhật';
      const status = $('.status .col-xs-8, .status-detail').first().text().trim() || 'Đang tiến hành';
      const description = $('.detail-content p, .comic-description, .shortened').text().trim() || 'Chưa có mô tả.';

      let chapters = [];
      let comicSlug = '';
      let comicId = '';

      const slugMatch = resp.data.match(/gOpts\.comicSlug\s*=\s*['"]([^'"]+)['"]/);
      const idMatch = resp.data.match(/gOpts\.comicId\s*=\s*['"]([^'"]+)['"]/);

      if (slugMatch && idMatch) {
        comicSlug = slugMatch[1];
        comicId = idMatch[1];
      } else {
        const urlMatch = mangaUrl.match(/\/([a-zA-Z0-9_-]+?)-(\d+)(?:\/|\?|$)/);
        if (urlMatch) {
          comicSlug = urlMatch[1];
          comicId = urlMatch[2];
        }
      }

      // Try fetching ALL chapters from NetTruyen ChapterList API service
      if (comicSlug && comicId) {
        try {
          const apiResp = await axios.get(`${domain}/Comic/Services/ComicService.asmx/ChapterList`, {
            params: { slug: comicSlug, comicId: comicId },
            headers: {
              ...this.headers,
              Referer: mangaUrl,
              'X-Requested-With': 'XMLHttpRequest'
            },
            timeout: 10000
          });

          const apiChapters = apiResp.data?.data || apiResp.data;
          if (Array.isArray(apiChapters) && apiChapters.length > 0) {
            chapters = apiChapters.map(item => {
              const chSlug = item.chapter_slug || `chapter-${item.chapter_num || item.chapter_id}`;
              const chUrl = `${domain}/truyen-tranh/${comicSlug}/${chSlug}/${item.chapter_id}`;
              return {
                id: chUrl,
                title: item.chapter_name || `Chapter ${item.chapter_num}`,
                url: chUrl,
                releaseTime: item.updated_at || 'Mới cập nhật'
              };
            });
          }
        } catch (apiErr) {
          console.warn('[NetTruyen] ChapterList API failed, falling back to HTML parsing:', apiErr.message);
        }
      }

      // Fallback: parse initial HTML list if API was unavailable
      if (chapters.length === 0) {
        $('#nt_listchapter nav ul li.row, .list-chapter li.row, .list-chapter li').each((_, el) => {
          const row = $(el);
          const linkEl = row.find('a').first();
          const chUrl = linkEl.attr('href');
          const chTitle = linkEl.text().trim();
          const time = row.find('.col-xs-4, .time, .chapter-time').first().text().trim() || 'Mới cập nhật';

          if (chUrl && chTitle && !chTitle.includes('Xem thêm')) {
            const fullUrl = chUrl.startsWith('http') ? chUrl : `${domain}${chUrl}`;
            chapters.push({
              id: fullUrl,
              title: chTitle,
              url: fullUrl,
              releaseTime: time
            });
          }
        });
      }

      return {
        id: `nettruyen_${encodeURIComponent(mangaUrl)}`,
        rawId: mangaUrl,
        pluginId: this.id,
        title,
        url: mangaUrl,
        cover: cover || 'https://placehold.co/300x450/1e293b/a78bfa?text=No+Cover',
        author,
        status,
        description,
        chapters,
        latestChapter: chapters[0] ? chapters[0].title : 'Chưa có chap'
      };
    } catch (err) {
      console.error('[NetTruyen] getMangaDetails error:', err.message);
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

      const $ = cheerio.load(resp.data);
      const images = [];

      $('.page-chapter img, .reading-detail img, .reading-detail .page-chapter').each((_, el) => {
        const img = $(el).is('img') ? $(el) : $(el).find('img');
        const src = img.attr('data-original') || img.attr('data-src') || img.attr('data-cdn') || img.attr('src') || '';
        const clean = this.formatImageUrl(src, chapterUrl);
        if (clean && !clean.includes('banner') && !clean.includes('quangcao') && !clean.includes('logo')) {
          images.push(clean);
        }
      });

      return images;
    } catch (err) {
      console.error('[NetTruyen] getChapterImages error:', err.message);
      throw err;
    }
  }
}

module.exports = NetTruyenPlugin;

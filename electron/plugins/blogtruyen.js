const axios = require('axios');
const cheerio = require('cheerio');
const BasePlugin = require('./base_plugin');

class BlogTruyenPlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'BlogTruyen';
    this.id = 'blogtruyen';
    this.baseUrl = 'https://blogtruyenmoi.com';
    this.domains = [
      'blogtruyen.vn',
      'blogtruyenmoi.com',
      'blogtruyen.top',
      'blogtruyen.info',
      'blogtruyen.com'
    ];
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
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
      const url = `${this.baseUrl}/tim-kiem?keyword=${encodeURIComponent(keyword)}`;
      const resp = await axios.get(url, {
        headers: this.headers,
        timeout: 12000
      });

      const $ = cheerio.load(resp.data);
      const results = [];

      $('.list-stories .story-item, .list .story, .grid-stories .item').each((_, el) => {
        const item = $(el);
        const linkEl = item.find('h3 a, .title a').first();
        const title = linkEl.text().trim();
        const link = linkEl.attr('href');

        const imgEl = item.find('img').first();
        const coverSrc = imgEl.attr('src') || imgEl.attr('data-src') || '';
        const cover = this.formatImageUrl(coverSrc, link);

        const latestChapEl = item.find('.chapter-link a, .latest-chapter a').first();
        const latestChapter = latestChapEl.text().trim() || 'Đang cập nhật';

        if (title && link) {
          const fullUrl = link.startsWith('http') ? link : `${this.baseUrl}${link}`;
          results.push({
            id: `blogtruyen_${encodeURIComponent(fullUrl)}`,
            rawId: fullUrl,
            pluginId: this.id,
            title,
            url: fullUrl,
            cover: cover || 'https://placehold.co/200x300/1e293b/a78bfa?text=No+Cover',
            latestChapter,
            author: 'Đang cập nhật',
            status: 'Đang tiến hành'
          });
        }
      });

      return results;
    } catch (err) {
      console.error('[BlogTruyen] Search error:', err.message);
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
      const title = $('h1.entry-title, .title h1, h1.title').first().text().trim() || 'Truyện BlogTruyen';
      
      const imgEl = $('.thumbnail img, .avatar img, .manga-avatar img').first();
      const coverSrc = imgEl.attr('src') || imgEl.attr('data-src') || '';
      const cover = this.formatImageUrl(coverSrc, mangaUrl);

      const author = $('.author a, .description-author').first().text().trim() || 'Đang cập nhật';
      const status = $('.status, .manga-status').first().text().trim() || 'Đang tiến hành';
      const description = $('.detail .content, .manga-summary, .description').text().trim() || 'Chưa có mô tả.';

      const chapters = [];
      $('#list-chapters p, #list-chapters .title, .list-wrap p').each((_, el) => {
        const item = $(el);
        const linkEl = item.find('a').first();
        const chUrl = linkEl.attr('href');
        const chTitle = linkEl.text().trim();
        const time = item.find('.published-date, .date').text().trim() || 'Mới cập nhật';

        if (chUrl && chTitle) {
          const fullUrl = chUrl.startsWith('http') ? chUrl : `${domain}${chUrl}`;
          chapters.push({
            id: fullUrl,
            title: chTitle,
            url: fullUrl,
            releaseTime: time
          });
        }
      });

      return {
        id: `blogtruyen_${encodeURIComponent(mangaUrl)}`,
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
      console.error('[BlogTruyen] getMangaDetails error:', err.message);
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

      $('#content img, article#content img, .chapter-content img').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-original') || '';
        const clean = this.formatImageUrl(src, chapterUrl);
        if (clean && !clean.includes('banner') && !clean.includes('quangcao')) {
          images.push(clean);
        }
      });

      return images;
    } catch (err) {
      console.error('[BlogTruyen] getChapterImages error:', err.message);
      throw err;
    }
  }
}

module.exports = BlogTruyenPlugin;

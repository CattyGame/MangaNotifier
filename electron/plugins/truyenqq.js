const axios = require('axios');
const cheerio = require('cheerio');
const BasePlugin = require('./base_plugin');

class TruyenQQPlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'TruyenQQ';
    this.id = 'truyenqq';
    this.baseUrl = 'https://truyenqq.com.vn';
    this.domains = [
      'truyenqq.com.vn',
      'truyenqqviet.com',
      'truyenqqto.com',
      'truyenqqvn.com',
      'truyenqq.net',
      'truyenqq.com',
      'truyenqqpro.com',
      'truyenqqtv.com',
      'truyenqqmoi.com'
    ];
    this.headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': this.baseUrl
    };
  }

  canHandle(url) {
    if (!url) return false;
    return url.toLowerCase().includes('truyenqq');
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
      const mirrors = [
        'https://truyenqqviet.com',
        'https://truyenqqto.com',
        'https://truyenqq.com.vn',
        'https://truyenqqvn.com'
      ];

      let $ = null;
      let usedBase = this.baseUrl;

      for (const mirror of mirrors) {
        const searchUrls = [
          `${mirror}/tim-kiem/trang-1.html?q=${encodeURIComponent(keyword)}`,
          `${mirror}/tim-kiem.html?q=${encodeURIComponent(keyword)}`,
          `${mirror}/tim-kiem?q=${encodeURIComponent(keyword)}`
        ];

        for (const url of searchUrls) {
          try {
            const resp = await axios.get(url, {
              headers: {
                ...this.headers,
                Referer: mirror
              },
              timeout: 8000
            });
            if (resp.status === 200 && resp.data && resp.data.length > 500) {
              $ = cheerio.load(resp.data);
              usedBase = mirror;
              break;
            }
          } catch (e) {
            // Try next
          }
        }
        if ($) break;
      }

      if (!$) return [];

      const results = [];
      const seenUrls = new Set();

      // Scrape manga items from search results
      $('.list_grid li, .list-stories li, .story-item, .item, .book_avatar').each((_, el) => {
        const item = $(el);
        const linkEl = item.is('a') ? item : item.find('h3 a, .title a, .book_info h3 a, a').first();
        let link = linkEl.attr('href') || '';
        let title = linkEl.attr('title') || item.find('h3 a, .title a, .book_info h3 a, h3').first().text().trim() || linkEl.text().trim();

        if (!link || link === '/' || link.startsWith('#') || link.includes('/the-loai') || link.includes('/contact')) return;

        // Normalize story link (strip chapter if chapter link)
        let storyUrl = link;
        if (storyUrl.includes('/chapter-')) {
          storyUrl = storyUrl.substring(0, storyUrl.lastIndexOf('/chapter-'));
        }
        if (!storyUrl.startsWith('http')) {
          storyUrl = `${usedBase}${storyUrl.startsWith('/') ? '' : '/'}${storyUrl}`;
        }

        if (seenUrls.has(storyUrl)) return;
        seenUrls.add(storyUrl);

        const imgEl = item.find('img').first().length ? item.find('img').first() : $(el).closest('li, .item, .story-item').find('img').first();
        const coverSrc = imgEl.attr('data-src') || imgEl.attr('data-original') || imgEl.attr('src') || '';
        const cover = this.formatImageUrl(coverSrc, usedBase);

        const latestChapEl = item.find('.last_chapter a, .chapter a, .comic-item-chapter a').first();
        const latestChapter = latestChapEl.text().trim() || 'Đang cập nhật';

        if (title && storyUrl) {
          results.push({
            id: `truyenqq_${encodeURIComponent(storyUrl)}`,
            rawId: storyUrl,
            pluginId: this.id,
            title: title.replace(/\s+/g, ' '),
            url: storyUrl,
            cover: cover || 'https://placehold.co/200x300/1e293b/a78bfa?text=TruyenQQ',
            latestChapter,
            author: 'Đang cập nhật',
            status: 'Đang tiến hành'
          });
        }
      });

      return results;
    } catch (err) {
      console.error('[TruyenQQ] Search error:', err.message);
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
      const title = $('h1.title-detail, h1.title, h1, .book_other h1').first().text().trim() || 'Truyện TruyenQQ';
      
      const imgEl = $('.book_avatar img, .col-image img, .detail-info img, .block01 img').first();
      const coverSrc = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-original') || '';
      const cover = this.formatImageUrl(coverSrc, mangaUrl);

      const author = $('.author .col-xs-9, .author .col-xs-8, .org, .author a, .book_info .author').first().text().trim() || 'Đang cập nhật';
      
      let status = 'Đang tiến hành';
      $('.status .col-xs-9, .status .col-xs-8, .status p, .book_info li, .detail-info li, .list-info li').each((_, el) => {
        const text = $(el).text().trim();
        if (text.includes('Tình trạng') || text.includes('Trạng thái')) {
          const val = text.replace(/.*(Tình trạng|Trạng thái):\s*/i, '').trim();
          if (val && val.length < 50) status = val;
        } else if ($(el).hasClass('status') || $(el).parent().hasClass('status')) {
          const val = text.trim();
          if (val && val.length < 50) status = val;
        }
      });
      const description = $('.story-detail-info, .detail-content p, .comic-description, .story-detail').text().trim() || 'Chưa có mô tả.';

      const chapters = [];
      const seenChap = new Set();

      // Find all chapter links
      $('a[href*="/chapter-"], .works-chapter-list a, .list_chapter a, #list-chapters a').each((_, el) => {
        const linkEl = $(el);
        const chHref = linkEl.attr('href');
        const chTitle = linkEl.text().trim() || linkEl.attr('title') || 'Chương';

        if (!chHref) return;

        let fullUrl = chHref;
        if (!fullUrl.startsWith('http')) {
          fullUrl = `${domain}${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
        }

        if (seenChap.has(fullUrl)) return;
        seenChap.add(fullUrl);

        // Find time
        const parentRow = linkEl.closest('li, .row, .item');
        const time = parentRow.find('.col-xs-4, .time, .published-date').first().text().trim() || 'Mới cập nhật';

        chapters.push({
          id: fullUrl,
          title: chTitle.replace(/\s+/g, ' '),
          url: fullUrl,
          releaseTime: time
        });
      });

      return {
        id: `truyenqq_${encodeURIComponent(mangaUrl)}`,
        rawId: mangaUrl,
        pluginId: this.id,
        title: title.replace(/\s+/g, ' '),
        url: mangaUrl,
        cover: cover || 'https://placehold.co/300x450/1e293b/a78bfa?text=TruyenQQ',
        author: author.replace(/\s+/g, ' '),
        status: status.replace(/\s+/g, ' '),
        description,
        chapters,
        latestChapter: chapters[0] ? chapters[0].title : 'Chưa có chap'
      };
    } catch (err) {
      console.error('[TruyenQQ] getMangaDetails error:', err.message);
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

      $('.story-see-content img, #content_chap img, .page-chapter img, .chapter-content img, .reading-detail img, .story-detail-content img').each((_, el) => {
        const img = $(el);
        const src = img.attr('src') || img.attr('data-src') || img.attr('data-original') || img.attr('data-cdn') || '';
        const clean = this.formatImageUrl(src, chapterUrl);
        if (clean && !clean.includes('logo') && !clean.includes('banner') && !clean.includes('quangcao') && !clean.includes('icon')) {
          images.push(clean);
        }
      });

      // Fallback: If no images found in specific containers, search all content images
      if (images.length === 0) {
        $('img').each((_, el) => {
          const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-original') || '';
          const clean = this.formatImageUrl(src, chapterUrl);
          if (clean && (clean.includes('/media/images/') || clean.includes('/data/images/') || clean.includes('/truyen/')) && !clean.includes('logo')) {
            images.push(clean);
          }
        });
      }

      return images;
    } catch (err) {
      console.error('[TruyenQQ] getChapterImages error:', err.message);
      throw err;
    }
  }
}

module.exports = TruyenQQPlugin;

const axios = require('axios');
const cheerio = require('cheerio');
const BasePlugin = require('./base_plugin');

class GocTruyenTranhPlugin extends BasePlugin {
  constructor() {
    super();
    this.name = 'Góc Truyện Tranh';
    this.id = 'goctruyentranh';
    this.baseUrl = 'https://goctruyentranhvui41.com';
    this.domains = [
      'goctruyentranhvui41.com',
      'goctruyentranhvui31.com',
      'goctruyentranhvui30.com',
      'goctruyentranhvui18.com',
      'goctruyentranhvui.com',
      'goctruyentranhvui1.com',
      'goctruyentranhvui2.com',
      'goctruyentranhvui3.com',
      'goctruyentranhmoi.com',
      'goctruyentranh.com'
    ];
    // Googlebot UA allows passing through Cloudflare Anti-DDoS challenges on GocTruyenTranh
    this.botHeaders = {
      'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
    };
    this.userCookie = '';
    this.userToken = '';
  }

  setUserAuth(cookie = '', token = '') {
    const raw = (cookie || token || '').trim().replace(/^["']|["']$/g, '');
    if (!raw) {
      this.userCookie = '';
      this.userToken = '';
      return;
    }

    let authVal = '';
    let cookieVal = '';

    let clean = raw;
    if (/^Authorization:\s*/i.test(clean)) {
      clean = clean.replace(/^Authorization:\s*/i, '').trim();
    }

    if (clean.startsWith('Bearer ')) {
      authVal = clean;
      cookieVal = `auth._token.local=${encodeURIComponent(clean)}`;
    } else if (clean.startsWith('eyJ') || (clean.includes('.') && !clean.includes('='))) {
      authVal = `Bearer ${clean}`;
      cookieVal = `auth._token.local=Bearer%20${clean}`;
    } else if (clean.includes('=')) {
      cookieVal = clean;
      const m = clean.match(/auth\._token\.local=([^;]+)/);
      if (m) {
        const decoded = decodeURIComponent(m[1]);
        authVal = decoded.startsWith('Bearer ') ? decoded : `Bearer ${decoded}`;
      }
    } else {
      authVal = clean.startsWith('Bearer ') ? clean : `Bearer ${clean}`;
      cookieVal = `auth._token.local=${encodeURIComponent(authVal)}`;
    }

    this.userCookie = cookieVal;
    this.userToken = authVal;
  }

  canHandle(url) {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.includes('goctruyentranh') || /goctruyentranhvui\d*\.com/i.test(lower);
  }

  formatImageUrl(src, originUrl) {
    if (!src) return '';
    let clean = src.trim();
    if (clean.includes('/c/code')) {
      clean = clean.replace(/\/c\/code/g, '/c/web');
    }
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
        'https://goctruyentranhvui41.com',
        'https://goctruyentranhvui31.com',
        'https://goctruyentranhvui30.com',
        'https://goctruyentranhvui18.com',
        'https://goctruyentranhvui.com',
        'https://goctruyentranhvui2.com',
        'https://goctruyentranh.com'
      ];

      for (const mirror of mirrors) {
        try {
          const apiUrl = `${mirror}/api/comic/search?name=${encodeURIComponent(keyword)}`;
          const resp = await axios.get(apiUrl, {
            headers: {
              ...this.botHeaders,
              'Referer': mirror + '/',
              'X-Requested-With': 'XMLHttpRequest'
            },
            timeout: 5000
          });

          if (resp.status === 200 && resp.data && Array.isArray(resp.data.result)) {
            const results = [];
            for (const item of resp.data.result) {
              if (item.display === false) continue;
              const slug = item.nameEn || item.slug || '';
              const title = item.name || item.title || '';
              if (!slug || !title) continue;

              const fullUrl = `${mirror}/truyen/${slug}`;
              const cover = item.photo ? this.formatImageUrl(item.photo, fullUrl) : '';
              const latest = Array.isArray(item.chapterLatest) && item.chapterLatest[0] ? `Chap ${item.chapterLatest[0]}` : 'Đang cập nhật';

              results.push({
                id: `goctruyentranh_${encodeURIComponent(fullUrl)}`,
                rawId: slug,
                pluginId: this.id,
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
        } catch (e) {
          // Try next mirror
        }
      }

      return [];
    } catch (err) {
      console.error('[GocTruyenTranh] Search error:', err.message);
      return [];
    }
  }

  async getMangaDetails(mangaUrl) {
    try {
      const domain = new URL(mangaUrl).origin;
      const resp = await axios.get(mangaUrl, {
        headers: {
          ...this.botHeaders,
          Referer: domain + '/'
        },
        timeout: 15000
      });

      const $ = cheerio.load(resp.data);
      
      let title = $('h1.title-detail, h1.entry-title, h1.title, h1, .story-info h1, .post-title').first().text().trim();
      if (!title) {
        const imgAlt = $('img.image').attr('alt');
        if (imgAlt) {
          title = imgAlt.trim();
        } else {
          const pageTitle = $('title').text().trim();
          title = pageTitle.replace(/\[Tới Chương.*\]/i, '').replace(/^Truyện\s+/i, '').trim();
        }
      }

      const imgEl = $('img.image, .thumbnail img, .avatar img, .book_avatar img, .detail-info img, .story-info img').first();
      const coverSrc = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-original') || '';
      const cover = this.formatImageUrl(coverSrc, mangaUrl);

      const author = $('.author, .author-detail, .org, .author a').first().text().trim() || 'Đang cập nhật';
      
      let status = 'Đang tiến hành';
      $('.row, li, p, div, .meta, .status').each((_, el) => {
        const text = $(el).text().trim();
        if (text.startsWith('Trạng thái:') || text.startsWith('Tình trạng:')) {
          const val = text.replace(/^(Trạng thái|Tình trạng):/i, '').trim();
          if (val && val.length < 50) {
            status = val;
          }
        }
      });
      const description = $('.detail-content p, .story-summary, .comic-description, .description, .detail .content, .content-desc').text().trim() || 'Chưa có mô tả.';

      const chapters = [];
      const seenChap = new Set();

      // Find all chapter links (supports /chuong-123 and chap/chapter formats)
      $('a[href*="/chuong-"], a[href*="chap"], a[href*="chapter"], .list-chapter li a, #list-chapters a, .chapters a, .chapter-list a').each((_, el) => {
        const linkEl = $(el);
        const chHref = linkEl.attr('href');
        if (!chHref || chHref === mangaUrl || chHref.startsWith('#')) return;

        let fullUrl = chHref;
        if (!fullUrl.startsWith('http')) {
          fullUrl = `${domain}${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
        }

        if (seenChap.has(fullUrl)) return;
        seenChap.add(fullUrl);

        let chTitle = linkEl.text().trim();
        chTitle = chTitle.replace(/\s+/g, ' ');
        const numMatch = chTitle.match(/#?(\d+(\.\d+)?)/);
        if (numMatch) {
          chTitle = `Chương ${numMatch[1]}`;
        } else {
          chTitle = chTitle.slice(0, 40) || 'Chương';
        }

        chapters.push({
          id: fullUrl,
          title: chTitle,
          url: fullUrl,
          releaseTime: 'Mới cập nhật'
        });
      });

      // Fetch ALL remaining chapters from GocTruyenTranh Chapter API if comicId exists
      const comicMatch = resp.data.match(/comic\s*=\s*\{([\s\S]*?)\}/);
      if (comicMatch) {
        const idMatch = comicMatch[1].match(/id\s*:\s*[`'"]?([0-9a-zA-Z_-]+)[`'"]?/);
        const nameEnMatch = comicMatch[1].match(/nameEn\s*:\s*[`'"]?([0-9a-zA-Z_-]+)[`'"]?/);
        const comicId = idMatch ? idMatch[1] : '';

        if (comicId) {
          try {
            const rawCookies = resp.headers['set-cookie'] || [];
            const serverCookies = rawCookies.map(c => c.split(';')[0]).join('; ');

            const apiUrl = `${domain}/api/comic/${comicId}/chapter?offset=${chapters.length}&limit=-1`;
            const apiResp = await axios.get(apiUrl, {
              headers: {
                ...this.botHeaders,
                'Referer': mangaUrl,
                'Origin': domain,
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Cookie': serverCookies
              },
              timeout: 12000
            });

            const apiChapters = apiResp.data?.result?.chapters;
            if (Array.isArray(apiChapters) && apiChapters.length > 0) {
              const baseCleanUrl = mangaUrl.split('?')[0].replace(/\/$/, '');
              for (const item of apiChapters) {
                if (item.display === false) continue;
                const chUrl = `${baseCleanUrl}/chuong-${item.numberChapter}`;
                if (seenChap.has(chUrl)) continue;
                seenChap.add(chUrl);

                let chTitle = `Chương ${item.numberChapter}`;
                if (item.name && item.name !== 'N/A') {
                  chTitle += `: ${item.name}`;
                }

                chapters.push({
                  id: chUrl,
                  title: chTitle,
                  url: chUrl,
                  releaseTime: item.stringUpdateTime || 'Mới cập nhật'
                });
              }
            }
          } catch (apiErr) {
            console.warn('[GocTruyenTranh] Failed fetching extra chapters from API:', apiErr.message);
          }
        }
      }

      return {
        id: `goctruyentranh_${encodeURIComponent(mangaUrl)}`,
        rawId: mangaUrl,
        pluginId: this.id,
        title: (title || 'Truyện Góc Truyện Tranh').replace(/\s+/g, ' '),
        url: mangaUrl,
        cover: cover || 'https://placehold.co/300x450/1e293b/a78bfa?text=GocTruyenTranh',
        author: author.replace(/\s+/g, ' '),
        status: status.replace(/\s+/g, ' '),
        description,
        chapters,
        latestChapter: chapters[0] ? chapters[0].title : 'Chưa có chap'
      };
    } catch (err) {
      console.error('[GocTruyenTranh] getMangaDetails error:', err.message);
      throw err;
    }
  }

  async getChapterImages(chapterUrl) {
    try {
      // Normalize domain in chapterUrl to current active baseUrl
      let targetUrl = chapterUrl;
      for (const d of this.domains) {
        if (targetUrl.includes(d) && d !== new URL(this.baseUrl).hostname) {
          targetUrl = targetUrl.replace(new RegExp(`https?:\\/\\/[^\\/]*${d}`, 'i'), this.baseUrl);
          break;
        }
      }

      const domain = new URL(targetUrl).origin;
      const initialHeaders = {
        ...this.botHeaders,
        Referer: domain + '/'
      };
      if (this.userCookie && this.userCookie.includes('=')) {
        initialHeaders['Cookie'] = this.userCookie;
      }
      if (this.userToken) {
        initialHeaders['Authorization'] = this.userToken;
      }

      let resp = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          resp = await axios.get(targetUrl, {
            headers: initialHeaders,
            timeout: 15000
          });
          if (resp && resp.status === 200) break;
        } catch (e) {
          if (e.response?.status === 429 && attempt < 2) {
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
          throw e;
        }
      }

      if (!resp || !resp.data) {
        throw new Error('Không nhận được phản hồi từ máy chủ Góc Truyện Tranh');
      }

      const html = resp.data;
      const $ = cheerio.load(html);

      // Method 1: Check static HTML <img> tags first
      const staticImages = [];
      $('#content img, .chapter-content img, .page-chapter img, .reading-detail img, .reading-content img, article#content img, .read-content img, .image-section .img-block img').each((_, el) => {
        const img = $(el);
        const src = img.attr('src') || img.attr('data-src') || img.attr('data-original') || img.attr('data-cdn') || '';
        const clean = this.formatImageUrl(src, targetUrl);
        if (clean && !clean.includes('banner') && !clean.includes('quangcao') && !clean.includes('logo') && !clean.includes('google_icon')) {
          staticImages.push(clean);
        }
      });

      if (staticImages.length > 0) {
        return staticImages;
      }

      // Method 2: Extract comic object and call /api/chapter/loadAll
      const comicMatch = html.match(/comic\s*=\s*\{([\s\S]*?)\}/);
      if (comicMatch) {
        const comicIdMatch = comicMatch[1].match(/id\s*:\s*[`'"]?([0-9a-zA-Z_-]+)[`'"]?/);
        const nameEnMatch = comicMatch[1].match(/nameEn\s*:\s*[`'"]?([0-9a-zA-Z_-]+)[`'"]?/);
        const curNumMatch = comicMatch[1].match(/currentNumber\s*:\s*[`'"]?([0-9.]+)[`'"]?/);

        const comicId = comicIdMatch ? comicIdMatch[1] : '';
        const nameEn = nameEnMatch ? nameEnMatch[1] : '';
        const chapterNumber = curNumMatch ? curNumMatch[1] : '';

        if (comicId && chapterNumber) {
          const rawCookies = resp.headers['set-cookie'] || [];
          const serverCookies = rawCookies.map(c => c.split(';')[0]).join('; ');

          let finalCookie = serverCookies || '';
          if (this.userCookie && this.userCookie.includes('=')) {
            finalCookie = finalCookie ? `${finalCookie}; ${this.userCookie}` : this.userCookie;
          }

          const payload = new URLSearchParams({
            comicId,
            chapterNumber,
            nameEn
          }).toString();

          const apiHeaders = {
            ...this.botHeaders,
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Referer': targetUrl,
            'Origin': domain,
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Cookie': finalCookie
          };

          if (this.userToken) {
            apiHeaders['Authorization'] = this.userToken;
          }

          let apiResp = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              apiResp = await axios.post(`${domain}/api/chapter/loadAll`, payload, {
                headers: apiHeaders,
                timeout: 12000
              });
              if (apiResp && apiResp.status === 200) break;
            } catch (e) {
              if (e.response?.status === 429 && attempt < 2) {
                await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
                continue;
              }
              throw e;
            }
          }

          const rawList = apiResp.data?.result?.data || apiResp.data?.result?.images || apiResp.data?.result || apiResp.data?.data;
          if (Array.isArray(rawList) && rawList.length > 0) {
            const apiImages = rawList.map(src => {
              const str = typeof src === 'string' ? src : (src.src || src.url || src.image || '');
              return this.formatImageUrl(str, targetUrl);
            }).filter(Boolean);
            if (apiImages.length > 0) return apiImages;
          }

          if (apiResp.data?.result?.codeState === '01') {
            if (this.userCookie || this.userToken) {
              throw new Error('Tài khoản Góc Truyện Tranh chưa đủ cấp độ (Level 2+) hoặc phiên đăng nhập đã hết hạn. Vui lòng cập nhật lại mã Authorization trong Cài đặt.');
            } else {
              throw new Error('Chương này mới phát hành và yêu cầu tài khoản thành viên trên Góc Truyện Tranh. Bạn có thể vào Cài đặt (⚙️) của App để dán mã Authorization tài khoản để mở khóa xem trực tiếp!');
            }
          }

          if (apiResp.data?.status === false && apiResp.data?.messages?.length > 0) {
            const msg = apiResp.data.messages[0];
            if (msg.includes('hết hạn')) {
              throw new Error('Phiên làm việc (mã Authorization) trên Góc Truyện Tranh đã hết hạn hoặc được tạo từ tên miền cũ. Vui lòng mở https://goctruyentranhvui41.com, đăng nhập lại và copy mã Authorization mới dán vào Cài Đặt (⚙️).');
            }
            throw new Error(`Góc Truyện Tranh: ${msg}`);
          }
        }
      }

      // Fallback: check all image tags
      const fallbackImages = [];
      $('img').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-original') || '';
        const clean = this.formatImageUrl(src, targetUrl);
        if (clean && !clean.includes('logo') && !clean.includes('avatar') && !clean.includes('banner') && !clean.includes('google_icon')) {
          fallbackImages.push(clean);
        }
      });

      if (fallbackImages.length > 0) {
        return fallbackImages;
      }

      throw new Error('Không thể tải danh sách ảnh chương này từ Góc Truyện Tranh');
    } catch (err) {
      console.error('[GocTruyenTranh] getChapterImages error:', err.message);
      throw err;
    }
  }
}

module.exports = GocTruyenTranhPlugin;

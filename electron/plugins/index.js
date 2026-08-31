const MangaDexPlugin = require('./mangadex');
const TruyenQQPlugin = require('./truyenqq');
const GocTruyenTranhPlugin = require('./goctruyentranh');
const MoeTruyenPlugin = require('./moetruyen');

function normalizeStr(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set(['den', 'tu', 'va', 'cua', 'la', 'o', 'trong', 'cho', 'voi', 'nhung', 'cac', 'mot', 'ra', 'lai', 'duoc', 'se', 'da', 'dang', 'the', 'nay', 'do', 'nao']);

function filterAndRankResults(results, keyword) {
  if (!Array.isArray(results)) return [];
  if (!keyword || !keyword.trim()) return results;

  const normKeyword = normalizeStr(keyword);
  const rawTokens = normKeyword.split(' ').filter(tok => tok.length >= 2);
  const significantTokens = rawTokens.filter(tok => !STOP_WORDS.has(tok));
  const tokensToCheck = significantTokens.length > 0 ? significantTokens : rawTokens;

  return results
    .filter(item => {
      if (!item || !item.title) return false;

      // 1. Blacklist system URLs and profile navigation links
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
      ) {
        return false;
      }

      // 2. Exact substring match
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

      // Exact word-level tokens
      const titleWords = new Set([
        ...normTitle.split(/\s+/).filter(Boolean),
        ...normSlug.split(/[^a-z0-9]+/).filter(Boolean)
      ]);

      // If single token search (e.g. "conan")
      if (tokensToCheck.length === 1) {
        const singleTok = tokensToCheck[0];
        return titleWords.has(singleTok) || normTitle.includes(singleTok) || normSlug.includes(singleTok);
      }

      // Multi-word search: Must match at least 2 exact words or >= 50% of tokens
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
}

class PluginManager {
  constructor() {
    this.plugins = new Map();
    this.registerPlugin(new MangaDexPlugin());
    this.registerPlugin(new TruyenQQPlugin());
    this.registerPlugin(new GocTruyenTranhPlugin());
    this.registerPlugin(new MoeTruyenPlugin());
  }

  registerPlugin(plugin) {
    this.plugins.set(plugin.id, plugin);
    console.log(`[PluginManager] Đã tải plugin nguồn: ${plugin.name} (${plugin.id})`);
  }

  getPlugin(id) {
    return this.plugins.get(id);
  }

  getAllPlugins() {
    return Array.from(this.plugins.values()).map(p => ({
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl,
      supportsSearch: p.supportsSearch,
      supportsReader: p.supportsReader
    }));
  }

  findPluginForUrl(url) {
    if (!url) return null;
    for (const plugin of this.plugins.values()) {
      if (plugin.canHandle(url)) {
        return plugin;
      }
    }
    // Fallback based on text if domain matched partially
    const lower = url.toLowerCase();
    if (lower.includes('mangadex')) return this.getPlugin('mangadex');
    if (lower.includes('truyenqq')) return this.getPlugin('truyenqq');
    if (lower.includes('goctruyentranh') || /goctruyentranhvui\d*/.test(lower)) return this.getPlugin('goctruyentranh');
    if (lower.includes('moetruyen') || lower.includes('truyen.moe')) return this.getPlugin('moetruyen');
    return null;
  }

  async searchAll(keyword, pluginId = null) {
    if (pluginId && this.plugins.has(pluginId)) {
      const plugin = this.plugins.get(pluginId);
      const results = await plugin.search(keyword);
      const mapped = (results || []).map(r => ({
        ...r,
        pluginId: r.pluginId || plugin.id,
        pluginName: r.pluginName || plugin.name
      }));
      return filterAndRankResults(mapped, keyword);
    }

    const tasks = Array.from(this.plugins.values()).map(async (plugin) => {
      try {
        const results = await plugin.search(keyword);
        return (results || []).map(r => ({
          ...r,
          pluginId: r.pluginId || plugin.id,
          pluginName: r.pluginName || plugin.name
        }));
      } catch (err) {
        console.warn(`[PluginManager] Lỗi search từ ${plugin.name}:`, err.message);
        return [];
      }
    });

    const allResults = await Promise.allSettled(tasks);
    const combined = [];
    for (const res of allResults) {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        combined.push(...res.value);
      }
    }
    return filterAndRankResults(combined, keyword);
  }
}

module.exports = new PluginManager();

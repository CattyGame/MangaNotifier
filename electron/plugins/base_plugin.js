/**
 * BasePlugin - Abstract base class for all manga source plugins
 */
class BasePlugin {
  constructor() {
    this.name = 'Base Plugin';
    this.id = 'base';
    this.baseUrl = '';
    this.domains = [];
    this.supportsSearch = true;
    this.supportsReader = true;
  }

  /**
   * Check if this plugin can handle the given URL
   * @param {string} url 
   * @returns {boolean}
   */
  canHandle(url) {
    if (!url) return false;
    return this.domains.some(domain => url.toLowerCase().includes(domain.toLowerCase()));
  }

  /**
   * Search manga by keyword
   * @param {string} keyword 
   * @returns {Promise<Array<{ id: string, title: string, url: string, cover: string, latestChapter: string, author?: string }>>}
   */
  async search(keyword) {
    throw new Error(`search() not implemented in ${this.name}`);
  }

  /**
   * Get full details of a manga including all chapters
   * @param {string} mangaUrl 
   * @returns {Promise<{ id: string, title: string, url: string, cover: string, author?: string, status?: string, description?: string, chapters: Array<{ id: string, title: string, url: string, releaseTime?: string, index?: number }> }>}
   */
  async getMangaDetails(mangaUrl) {
    throw new Error(`getMangaDetails() not implemented in ${this.name}`);
  }

  /**
   * Quick check for latest chapters of a manga
   * @param {string} mangaUrl 
   * @returns {Promise<Array<{ id: string, title: string, url: string, releaseTime?: string }>>}
   */
  async getLatestChapters(mangaUrl) {
    const details = await this.getMangaDetails(mangaUrl);
    return details.chapters || [];
  }

  /**
   * Get image URLs for a chapter (for in-app reader)
   * @param {string} chapterUrl 
   * @returns {Promise<Array<string>>}
   */
  async getChapterImages(chapterUrl) {
    throw new Error(`getChapterImages() not implemented in ${this.name}`);
  }
}

module.exports = BasePlugin;

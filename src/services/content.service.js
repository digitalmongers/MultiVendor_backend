import SiteContentRepository from '../repositories/siteContent.repository.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Cache from '../utils/cache.js';

const CONTENT_CACHE_KEY = 'multi_vendor:content';

class ContentService {
  /**
   * Update site content.
   * @param {Object} data - The content fields to update.
   * @returns {Promise<Object>} The updated content document.
   */
  async updateContent(data) {
    const content = await SiteContentRepository.update(data);
    // Invalidate data cache
    await Cache.del(CONTENT_CACHE_KEY);
    // Invalidate all response caches for content routes
    await Cache.delByPattern('response:/api/v1/content*');
    return content;
  }

  /**
   * Get all site content.
   * @returns {Promise<Object>} The content document.
   */
  async getContent() {
    // 1. Try to get from cache
    const cachedContent = await Cache.get(CONTENT_CACHE_KEY);
    if (cachedContent) return cachedContent;

    // 2. Fetch from DB if miss
    let content = await SiteContentRepository.findOne();
    
    if (!content) {
      content = {
        aboutUs: '',
        termsAndConditions: '',
        privacyPolicy: '',
        refundPolicy: '',
        returnPolicy: '',
        shippingPolicy: '',
        cancellationPolicy: '',
      };
    }
    
    // 3. Store in cache for next time
    await Cache.set(CONTENT_CACHE_KEY, content);
    
    return content;
  }
}

export default new ContentService();

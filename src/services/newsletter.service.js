import { NewsletterRepository } from '../repositories/newsletter.repository.js';
import MailchimpService from '../services/mailchimp.service.js';
import Cache from '../utils/cache.js';
import Logger from '../utils/logger.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';

const NEWSLETTER_CACHE_PREFIX = 'newsletter:list:';
const NEWSLETTER_RESPONSE_PATTERN = 'response:/api/v1/newsletter/admin*';

class NewsletterService {
  async invalidateCache() {
    await Cache.delByPattern(`${NEWSLETTER_CACHE_PREFIX}*`);
    await Cache.delByPattern(NEWSLETTER_RESPONSE_PATTERN);
    Logger.debug('Newsletter Cache Invalidated');
  }

  async subscribe(email) {
    // 1. Local storage
    const subscription = await NewsletterRepository.subscribe(email);

    // 2. Mailchimp sync (Fire and forget, but with logging)
    MailchimpService.addSubscriber(email).catch(err => {
      Logger.error('Scheduled Mailchimp sync failed', { email, error: err.message });
    });

    // 3. Invalidate admin list caches
    await this.invalidateCache();
    
    return subscription;
  }

  async getSubscribers(queryOptions) {
    // We only data-cache the default view (first page, newest first, no search)
    const isDefaultView = !queryOptions.search && !queryOptions.startDate && !queryOptions.endDate && 
                          (!queryOptions.sortBy || queryOptions.sortBy === 'newestFirst') && 
                          queryOptions.skip === 0;

    const cacheKey = `${NEWSLETTER_CACHE_PREFIX}default`;
    
    if (isDefaultView) {
      const cached = await Cache.get(cacheKey);
      if (cached) {
        Logger.debug('Newsletter List Data Cache Hit');
        return cached;
      }
    }

    const data = await NewsletterRepository.findAll(queryOptions);

    if (isDefaultView) {
      await Cache.set(cacheKey, data, 1800); // 30 min cache for default view
    }

    return data;
  }
}

export default new NewsletterService();

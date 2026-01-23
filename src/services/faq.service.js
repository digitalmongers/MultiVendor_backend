import FAQRepository from '../repositories/faq.repository.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Cache from '../utils/cache.js';

const FAQ_CACHE_KEY = 'multi_vendor:faqs';

class FAQService {
  async createFAQ(data) {
    const faq = await FAQRepository.create(data);
    await Cache.del(FAQ_CACHE_KEY); // Invalidate data cache
    await Cache.delByPattern('response:/api/v1/faqs*'); // Invalidate all FAQ response caches
    return faq;
  }

  async getAllFAQs() {
    // 1. Try to get from cache
    const cachedFaqs = await Cache.get(FAQ_CACHE_KEY);
    if (cachedFaqs) return cachedFaqs;

    // 2. Fetch from DB if miss
    const faqs = await FAQRepository.findAll({});
    
    // 3. Store in cache
    await Cache.set(FAQ_CACHE_KEY, faqs);
    
    return faqs;
  }

  async getFAQById(id) {
    const faq = await FAQRepository.findById(id);
    if (!faq) {
      throw new AppError('FAQ not found', HTTP_STATUS.NOT_FOUND, 'FAQ_NOT_FOUND');
    }
    return faq;
  }

  async updateFAQ(id, data) {
    const faq = await FAQRepository.update(id, data);
    if (!faq) {
      throw new AppError('FAQ not found', HTTP_STATUS.NOT_FOUND, 'FAQ_NOT_FOUND');
    }
    await Cache.del(FAQ_CACHE_KEY); // Invalidate data cache
    await Cache.delByPattern('response:/api/v1/faqs*'); // Invalidate response caches
    return faq;
  }

  async deleteFAQ(id) {
    const faq = await FAQRepository.delete(id);
    if (!faq) {
      throw new AppError('FAQ not found', HTTP_STATUS.NOT_FOUND, 'FAQ_NOT_FOUND');
    }
    await Cache.del(FAQ_CACHE_KEY); // Invalidate data cache
    await Cache.delByPattern('response:/api/v1/faqs*'); // Invalidate response caches
    return true;
  }
}

export default new FAQService();

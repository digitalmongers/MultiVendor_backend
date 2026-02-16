import FAQRepository from '../repositories/faq.repository.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Cache from '../utils/cache.js';
import L1Cache from '../utils/l1Cache.js';

const FAQ_CACHE_KEY = 'multi_vendor:faqs';

class FAQService {
  async createFAQ(data) {
    const faq = await FAQRepository.create(data);
    await Cache.del(FAQ_CACHE_KEY);
    await Cache.delByPattern('response:/api/v1/faqs*');
    L1Cache.delByPattern('faq');
    return faq;
  }

  async getAllFAQs() {
    // Try L1 first
    const l1Cached = L1Cache.get(FAQ_CACHE_KEY);
    if (l1Cached) return l1Cached;

    // Try L2
    const l2Cached = await Cache.get(FAQ_CACHE_KEY);
    if (l2Cached) {
      L1Cache.set(FAQ_CACHE_KEY, l2Cached, 600);
      return l2Cached;
    }

    // Fetch from DB
    const faqs = await FAQRepository.findAll({});
    
    // Store in both caches
    await Cache.set(FAQ_CACHE_KEY, faqs, 3600);
    L1Cache.set(FAQ_CACHE_KEY, faqs, 600); // L1: 10min
    
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
    await Cache.del(FAQ_CACHE_KEY);
    await Cache.delByPattern('response:/api/v1/faqs*');
    L1Cache.delByPattern('faq');
    return faq;
  }

  async deleteFAQ(id) {
    const faq = await FAQRepository.delete(id);
    if (!faq) {
      throw new AppError('FAQ not found', HTTP_STATUS.NOT_FOUND, 'FAQ_NOT_FOUND');
    }
    await Cache.del(FAQ_CACHE_KEY);
    await Cache.delByPattern('response:/api/v1/faqs*');
    L1Cache.delByPattern('faq');
    return true;
  }
}

export default new FAQService();

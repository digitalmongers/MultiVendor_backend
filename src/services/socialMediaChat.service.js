import SocialMediaChatRepository from '../repositories/socialMediaChat.repository.js';
import Cache from '../utils/cache.js';
import L1Cache from '../utils/l1Cache.js';

const SOCIAL_CHAT_CACHE_KEY = 'social:chat:platforms';

class SocialMediaChatService {
  async getAllPlatforms() {
    return await SocialMediaChatRepository.getAll();
  }

  async getPublicPlatforms() {
    // Try L1 first
    const l1Cached = L1Cache.get(SOCIAL_CHAT_CACHE_KEY);
    if (l1Cached) {
      return l1Cached;
    }

    // Try L2
    const l2Cached = await Cache.get(SOCIAL_CHAT_CACHE_KEY);
    if (l2Cached) {
      L1Cache.set(SOCIAL_CHAT_CACHE_KEY, l2Cached, 600);
      return l2Cached;
    }

    const platforms = await SocialMediaChatRepository.getActive();
    const result = platforms.map(p => ({
      platform: p.platform,
      value: p.value,
    }));

    // Cache results
    await Cache.set(SOCIAL_CHAT_CACHE_KEY, result, 3600);
    L1Cache.set(SOCIAL_CHAT_CACHE_KEY, result, 600); // L1: 10min

    return result;
  }

  async updatePlatform(platform, data, adminId, role) {
    const updateData = {
      ...data,
      updatedBy: adminId,
      updatedByModel: role,
    };
    const result = await SocialMediaChatRepository.update(platform, updateData);
    
    // Invalidate cache
    await Cache.del(SOCIAL_CHAT_CACHE_KEY);
    L1Cache.delByPattern('social:chat');
    
    return result;
  }
}

export default new SocialMediaChatService();

import SocialMediaRepository from '../repositories/socialMedia.repository.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Cache from '../utils/cache.js';

class SocialMediaService {
  /**
   * Helper to invalidate public social media cache
   */
  async invalidateCache() {
    await Cache.delByPattern('response:/api/v1/social-media/public*');
  }

  async saveLink(platform, link) {
    const saved = await SocialMediaRepository.upsertByPlatform(platform, link);
    await this.invalidateCache();
    return saved;
  }

  async getAllLinks(filter = {}) {
    return await SocialMediaRepository.findAll(filter);
  }

  async getLinkById(id) {
    const social = await SocialMediaRepository.findById(id);
    if (!social) {
      throw new AppError('Social media link not found', HTTP_STATUS.NOT_FOUND, 'SOCIAL_LINK_NOT_FOUND');
    }
    return social;
  }

  async updateLink(id, updateData) {
    const updated = await SocialMediaRepository.update(id, updateData);
    await this.invalidateCache();
    return updated;
  }

  async deleteLink(id) {
    const deleted = await SocialMediaRepository.delete(id);
    await this.invalidateCache();
    return deleted;
  }

  async toggleStatus(id) {
    const social = await this.getLinkById(id);
    const toggled = await SocialMediaRepository.updateStatus(id, !social.status);
    await this.invalidateCache();
    return toggled;
  }

  async getPublicLinks() {
    return await SocialMediaRepository.findAll({ status: true });
  }
}

export default new SocialMediaService();

import SocialMediaChatRepository from '../repositories/socialMediaChat.repository.js';

class SocialMediaChatService {
  async getAllPlatforms() {
    return await SocialMediaChatRepository.getAll();
  }

  async getPublicPlatforms() {
    const platforms = await SocialMediaChatRepository.getActive();
    return platforms.map(p => ({
      platform: p.platform,
      value: p.value,
    }));
  }

  async updatePlatform(platform, data, adminId, role) {
    const updateData = {
      ...data,
      updatedBy: adminId,
      updatedByModel: role,
    };
    return await SocialMediaChatRepository.update(platform, updateData);
  }
}

export default new SocialMediaChatService();

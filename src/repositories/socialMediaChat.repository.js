import SocialMediaChat from '../models/socialMediaChat.model.js';

class SocialMediaChatRepository {
  async getAll() {
    return await SocialMediaChat.find().populate('updatedBy', 'name email').lean();
  }

  async getActive() {
    return await SocialMediaChat.find({ isActive: true }).lean();
  }

  async findByPlatform(platform) {
    return await SocialMediaChat.findOne({ platform }).populate('updatedBy', 'name email').lean();
  }

  async update(platform, updateData) {
    return await SocialMediaChat.findOneAndUpdate(
      { platform },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    ).populate('updatedBy', 'name email').lean();
  }
}

export default new SocialMediaChatRepository();

import SocialMedia from '../models/socialMedia.model.js';

class SocialMediaRepository {
  async upsertByPlatform(platform, link) {
    return await SocialMedia.findOneAndUpdate(
      { platform },
      { link, platform },
      { new: true, upsert: true, runValidators: true }
    ).lean();
  }

  async findById(id) {
    return await SocialMedia.findById(id).lean();
  }

  async findAll(filter = {}, sort = { platform: 1 }) {
    return await SocialMedia.find(filter).sort(sort).lean();
  }

  async update(id, data) {
    return await SocialMedia.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    }).lean();
  }

  async delete(id) {
    return await SocialMedia.findByIdAndDelete(id);
  }

  async updateStatus(id, status) {
    return await SocialMedia.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
  }
}

export default new SocialMediaRepository();

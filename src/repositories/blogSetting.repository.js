import BlogSetting from '../models/blogSetting.model.js';

class BlogSettingRepository {
  async getSettings() {
    let settings = await BlogSetting.findOne().lean();
    if (!settings) {
      settings = await BlogSetting.create({ isBlogEnabled: true });
    }
    return settings;
  }

  async updateSettings(data) {
    let settings = await BlogSetting.findOne();
    if (!settings) {
      return await BlogSetting.create(data);
    }
    return await BlogSetting.findOneAndUpdate({}, data, { new: true });
  }
}

export default new BlogSettingRepository();

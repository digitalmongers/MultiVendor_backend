import LoginSetting from '../models/loginSetting.model.js';

class LoginSettingRepository {
  async getSettings() {
    let settings = await LoginSetting.findOne().populate('updatedBy', 'name email').lean();
    if (!settings) {
      settings = await LoginSetting.create({});
    }
    return settings;
  }

  async updateSettings(updateData) {
    return await LoginSetting.findOneAndUpdate(
      {},
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    ).populate('updatedBy', 'name email').lean();
  }
}

export default new LoginSettingRepository();

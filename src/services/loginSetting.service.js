import LoginSettingRepository from '../repositories/loginSetting.repository.js';

class LoginSettingService {
  async getSettings() {
    return await LoginSettingRepository.getSettings();
  }

  async updateSettings(data, adminId, role) {
    const updateData = {
      ...data,
      updatedBy: adminId,
      updatedByModel: role,
    };
    return await LoginSettingRepository.updateSettings(updateData);
  }
}

export default new LoginSettingService();

import PaymentSettingRepository from '../repositories/paymentSetting.repository.js';

class PaymentSettingService {
  async getSettings() {
    return await PaymentSettingRepository.getSettings();
  }

  async updateSettings(data, adminId, role) {
    const updateData = {
      ...data,
      updatedBy: adminId,
      updatedByModel: role
    };
    return await PaymentSettingRepository.updateSettings(updateData);
  }
}

export default new PaymentSettingService();

import PaymentSetting from '../models/paymentSetting.model.js';

class PaymentSettingRepository {
  async getSettings() {
    let settings = await PaymentSetting.findOne().populate('updatedBy', 'name email').lean();
    if (!settings) {
      // Initialize with defaults if not exists
      settings = await PaymentSetting.create({});
    }
    return settings;
  }

  async updateSettings(updateData) {
    return await PaymentSetting.findOneAndUpdate(
      {},
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    ).populate('updatedBy', 'name email').lean();
  }
}

export default new PaymentSettingRepository();

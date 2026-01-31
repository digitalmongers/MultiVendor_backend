import SystemSettingRepository from '../repositories/systemSetting.repository.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import AuditLogger from '../utils/audit.js';

class SystemSettingService {
  /**
   * Get current environment settings
   */
  async getSettings() {
    return await SystemSettingRepository.getSettings();
  }

  /**
   * Update environment settings
   */
  async updateSettings(data, userId, userModel) {
    // Basic validation logic if needed
    if (data.appMode === 'Dev' && !data.appDebug) {
      // Optional: Force debug on if mode is Dev? Or keep them separate?
      // Keeping separate for granular control as requested.
    }

    const updated = await SystemSettingRepository.updateSettings(data, userId, userModel);

    // Audit Log
    AuditLogger.log('SYSTEM_SETTINGS_UPDATE', userModel.toUpperCase(), { 
      userId, 
      changes: Object.keys(data),
      newMode: updated.appMode,
      debug: updated.appDebug
    });

    return updated;
  }
}

export default new SystemSettingService();

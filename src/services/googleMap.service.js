import GoogleMapRepository from '../repositories/googleMap.repository.js';
import { encrypt, decrypt } from '../utils/encryption.util.js';

class GoogleMapService {
  async getSettings() {
    const settings = await GoogleMapRepository.getSettings();
    return this._prepareAdminSettings(settings);
  }

  async updateSettings(data, adminId, role) {
    const updatePayload = {
      isActive: data.isActive,
      updatedBy: adminId,
      updatedByModel: role,
      config: { ...data.config }
    };

    // Encrypt keys
    if (data.config) {
      if (data.config.clientKey) updatePayload.config.clientKey = encrypt(String(data.config.clientKey));
      if (data.config.serverKey) updatePayload.config.serverKey = encrypt(String(data.config.serverKey));
    }

    const settings = await GoogleMapRepository.updateSettings(updatePayload);
    return this._prepareAdminSettings(settings);
  }

  /**
   * Get public map settings for frontend
   */
  async getPublicSettings() {
    const settings = await GoogleMapRepository.getSettings();
    if (!settings.isActive) {
      return { isActive: false };
    }

    return {
      isActive: true,
      clientKey: decrypt(settings.config?.clientKey),
    };
  }

  /**
   * Get server key for backend operations (e.g., Geocoding)
   */
  async getServerKey() {
    const settings = await GoogleMapRepository.getSettings();
    if (!settings.isActive) return null;
    return decrypt(settings.config?.serverKey);
  }

  _prepareAdminSettings(settings) {
    if (!settings) return null;
    const s = { ...settings };
    if (s.config) {
      const maskedConfig = { ...s.config };
      if (maskedConfig.clientKey) maskedConfig.clientKey = '********';
      if (maskedConfig.serverKey) maskedConfig.serverKey = '********';
      s.config = maskedConfig;
    }
    return s;
  }
}

export default new GoogleMapService();

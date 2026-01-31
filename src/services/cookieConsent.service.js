import CookieConsentRepository from '../repositories/cookieConsent.repository.js';
import AuditLogger from '../utils/audit.js';

class CookieConsentService {
  /**
   * Get Settings
   */
  async getSettings() {
    return await CookieConsentRepository.getSettings();
  }

  /**
   * Update Settings
   */
  async updateSettings(data, userId, userModel, ipAddress, userAgent) {
    const previous = await CookieConsentRepository.getSettings();
    const updated = await CookieConsentRepository.updateSettings(data, userId, userModel);

    // Audit Log
    await AuditLogger.log(
      'COOKIE_CONSENT_UPDATE',
      {
        userId,
        userModel,
        ipAddress,
        userAgent,
        details: {
          previous: { isActive: previous.isActive, contentLength: previous.content?.length },
          updated: { isActive: updated.isActive, contentLength: updated.content?.length },
        },
        status: 'SUCCESS'
      }
    );

    return updated;
  }
}

export default new CookieConsentService();

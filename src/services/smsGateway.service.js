import SmsGatewayRepository from '../repositories/smsGateway.repository.js';
import { encrypt, decrypt } from '../utils/encryption.util.js';

class SmsGatewayService {
  async getAllGateways() {
    const gateways = await SmsGatewayRepository.getAll();
    return gateways.map(g => this._prepareAdminGateway(g));
  }

  async updateGateway(name, data, adminId, role) {
    const updatePayload = {
      isActive: data.isActive,
      updatedBy: adminId,
      updatedByModel: role,
      config: { ...data.config }
    };

    // Encrypt sensitive fields
    if (data.config) {
      if (data.config.apiKey) updatePayload.config.apiKey = encrypt(String(data.config.apiKey));
      if (data.config.sid) updatePayload.config.sid = encrypt(String(data.config.sid));
      if (data.config.token) updatePayload.config.token = encrypt(String(data.config.token));
      if (data.config.messagingServiceSid) updatePayload.config.messagingServiceSid = encrypt(String(data.config.messagingServiceSid));
    }

    const gateway = await SmsGatewayRepository.update(name, updatePayload);
    return this._prepareAdminGateway(gateway);
  }

  /**
   * Internal method to get decrypted credentials for actual SMS sending logic
   */
  async getActiveGatewayCredentials() {
    const activeGateways = await SmsGatewayRepository.getActive();
    if (activeGateways.length === 0) return null;

    // Return the first active gateway with decrypted secrets
    const g = activeGateways[0];
    return {
      name: g.name,
      config: {
        apiKey: decrypt(g.config?.apiKey),
        sid: decrypt(g.config?.sid),
        token: decrypt(g.config?.token),
        messagingServiceSid: decrypt(g.config?.messagingServiceSid),
        from: g.config?.from,
        otpTemplate: g.config?.otpTemplate,
      }
    };
  }

  _prepareAdminGateway(gateway) {
    if (!gateway) return null;
    const g = { ...gateway };
    if (g.config) {
      const maskedConfig = { ...g.config };
      if (maskedConfig.apiKey) maskedConfig.apiKey = '********';
      if (maskedConfig.sid) maskedConfig.sid = '********';
      if (maskedConfig.token) maskedConfig.token = '********';
      if (maskedConfig.messagingServiceSid) maskedConfig.messagingServiceSid = '********';
      g.config = maskedConfig;
    }
    return g;
  }
}

export default new SmsGatewayService();

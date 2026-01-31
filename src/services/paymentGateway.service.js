import PaymentGatewayRepository from '../repositories/paymentGateway.repository.js';
import { encrypt, decrypt } from '../utils/encryption.util.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';

class PaymentGatewayService {
  /**
   * Get all gateways for Admin (includes encrypted fields as placeholder)
   */
  async getAllGateways() {
    const gateways = await PaymentGatewayRepository.getAll();
    return gateways.map(g => this._prepareAdminGateway(g));
  }

  /**
   * Get public active gateways (No sensitive data)
   * Hierarchical check: Global Digital Toggle > Individual Gateway Toggle
   */
  async getPublicGateways() {
    const PaymentSettingRepository = (await import('../repositories/paymentSetting.repository.js')).default;
    const settings = await PaymentSettingRepository.getSettings();

    // If global digital payment is OFF, return empty array for digital gateways
    if (!settings.isDigitalPaymentActive) {
      return [];
    }

    const gateways = await PaymentGatewayRepository.getActive();
    return gateways.map(g => ({
      name: g.name,
      title: g.title,
      logo: g.logo,
    }));
  }

  /**
   * Update gateway configuration and encrypt secrets
   */
  async updateGateway(name, data, adminId, role) {
    const updatePayload = {
      title: data.title,
      logo: data.logo,
      isActive: data.isActive,
      updatedBy: adminId,
      updatedByModel: role,
      config: { ...data.config }
    };

    // Encrypt sensitive fields ONLY if they are provided and non-empty
    if (data.config) {
      if (data.config.apiKey) updatePayload.config.apiKey = encrypt(String(data.config.apiKey));
      if (data.config.apiSecret) updatePayload.config.apiSecret = encrypt(String(data.config.apiSecret));
      if (data.config.webhookSecret) updatePayload.config.webhookSecret = encrypt(String(data.config.webhookSecret));
      if (data.config.clientId) updatePayload.config.clientId = encrypt(String(data.config.clientId));
    }

    const gateway = await PaymentGatewayRepository.update(name, updatePayload);
    return this._prepareAdminGateway(gateway);
  }

  /**
   * Get decrypted credentials for internal use (e.g., when processing payments)
   */
  async getGatewayCredentials(name) {
    const gateway = await PaymentGatewayRepository.findByName(name);
    if (!gateway || !gateway.isActive) {
      throw new AppError(`Payment gateway ${name} is not active or not found`, HTTP_STATUS.BAD_REQUEST);
    }

    return {
      name: gateway.name,
      config: {
        apiKey: decrypt(gateway.config?.apiKey),
        apiSecret: decrypt(gateway.config?.apiSecret),
        webhookSecret: decrypt(gateway.config?.webhookSecret),
        clientId: decrypt(gateway.config?.clientId)
      }
    };
  }

  /**
   * Private helper to mask encrypted fields for Admin UI
   */
  _prepareAdminGateway(gateway) {
    if (!gateway) return null;
    
    // If it's a lean object, we don't need toObject()
    const g = gateway._id ? gateway : { ...gateway };
    
    if (g.config) {
      const maskedConfig = { ...g.config };
      if (maskedConfig.apiKey) maskedConfig.apiKey = '********';
      if (maskedConfig.apiSecret) maskedConfig.apiSecret = '********';
      if (maskedConfig.webhookSecret) maskedConfig.webhookSecret = '********';
      if (maskedConfig.clientId) maskedConfig.clientId = '********';
      g.config = maskedConfig;
    }
    return g;
  }
}

export default new PaymentGatewayService();

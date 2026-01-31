import SocialLoginRepository from '../repositories/socialLogin.repository.js';
import { encrypt, decrypt } from '../utils/encryption.util.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';

class SocialLoginService {
  async getAllProviders() {
    const providers = await SocialLoginRepository.getAll();
    return providers.map(p => this._maskCredentials(p));
  }

  async getPublicProviders() {
    const providers = await SocialLoginRepository.getActive();
    return providers.map(p => ({
      provider: p.provider,
      isActive: p.isActive,
    }));
  }

  async updateProvider(provider, data, adminId, role) {
    const updatePayload = {
      isActive: data.isActive,
      updatedBy: adminId,
      updatedByModel: role,
      config: { ...data.config }
    };

    // Encrypt sensitive fields if provided
    if (data.config) {
      if (data.config.clientId) updatePayload.config.clientId = encrypt(String(data.config.clientId));
      if (data.config.clientSecret) updatePayload.config.clientSecret = encrypt(String(data.config.clientSecret));
      if (data.config.teamId) updatePayload.config.teamId = encrypt(String(data.config.teamId));
      if (data.config.keyId) updatePayload.config.keyId = encrypt(String(data.config.keyId));
    }

    const updated = await SocialLoginRepository.update(provider, updatePayload);
    return this._maskCredentials(updated);
  }

  async getProviderCredentials(provider) {
    const data = await SocialLoginRepository.findByProvider(provider);
    if (!data || !data.isActive) {
      throw new AppError(`Social provider ${provider} is not active`, HTTP_STATUS.BAD_REQUEST);
    }

    return {
      provider: data.provider,
      config: {
        callbackUrl: data.config?.callbackUrl,
        clientId: decrypt(data.config?.clientId),
        clientSecret: decrypt(data.config?.clientSecret),
        teamId: decrypt(data.config?.teamId),
        keyId: decrypt(data.config?.keyId),
      }
    };
  }

  _maskCredentials(data) {
    if (!data) return null;
    const p = { ...data };
    if (p.config) {
      const masked = { ...p.config };
      if (masked.clientId) masked.clientId = '********';
      if (masked.clientSecret) masked.clientSecret = '********';
      if (masked.teamId) masked.teamId = '********';
      if (masked.keyId) masked.keyId = '********';
      p.config = masked;
    }
    return p;
  }
}

export default new SocialLoginService();

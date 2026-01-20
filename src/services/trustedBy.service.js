import TrustedByRepository from '../repositories/trustedBy.repository.js';
import { deleteFromCloudinary } from '../utils/cloudinary.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Cache from '../utils/cache.js';

class TrustedByService {
  /**
   * Helper to invalidate public trusted-by cache
   */
  async invalidateCache() {
    await Cache.delByPattern('response:/api/v1/trusted-by/public*');
  }

  async createLogo(data) {
    const logo = await TrustedByRepository.create(data);
    await this.invalidateCache();
    return logo;
  }

  async getAllLogos(filter = {}) {
    return await TrustedByRepository.findAll(filter);
  }

  async getLogoById(id) {
    const logo = await TrustedByRepository.findById(id);
    if (!logo) {
      throw new AppError('Logo not found', HTTP_STATUS.NOT_FOUND, 'LOGO_NOT_FOUND');
    }
    return logo;
  }

  async updateLogo(id, updateData) {
    const logo = await this.getLogoById(id);

    // If new image is provided, delete the old one from Cloudinary
    if (updateData.image && logo.image && updateData.image.publicId !== logo.image.publicId) {
      await deleteFromCloudinary(logo.image.publicId);
    }

    const updated = await TrustedByRepository.update(id, updateData);
    await this.invalidateCache();
    return updated;
  }

  async deleteLogo(id) {
    const logo = await this.getLogoById(id);

    // Delete image from Cloudinary
    if (logo.image && logo.image.publicId) {
      await deleteFromCloudinary(logo.image.publicId);
    }

    const deleted = await TrustedByRepository.delete(id);
    await this.invalidateCache();
    return deleted;
  }

  async toggleStatus(id) {
    const logo = await this.getLogoById(id);
    const newStatus = logo.status === 'active' ? 'inactive' : 'active';
    const toggled = await TrustedByRepository.updateStatus(id, newStatus);
    await this.invalidateCache();
    return toggled;
  }

  async getPublicLogos() {
    return await TrustedByRepository.findAll({ status: 'active' });
  }
}

export default new TrustedByService();

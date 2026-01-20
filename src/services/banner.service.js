import BannerRepository from '../repositories/banner.repository.js';
import { deleteFromCloudinary } from '../utils/cloudinary.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Cache from '../utils/cache.js';

class BannerService {
  /**
   * Helper to invalidate public banner cache
   */
  async invalidateCache() {
    await Cache.delByPattern('response:/api/v1/banners/public*');
  }

  async createBanner(bannerData) {
    const banner = await BannerRepository.create(bannerData);
    await this.invalidateCache();
    return banner;
  }

  async getAllBanners(filter = {}) {
    return await BannerRepository.findAll(filter);
  }

  async getBannerById(id) {
    const banner = await BannerRepository.findById(id);
    if (!banner) {
      throw new AppError('Banner not found', HTTP_STATUS.NOT_FOUND, 'BANNER_NOT_FOUND');
    }
    return banner;
  }

  async updateBanner(id, updateData) {
    const banner = await this.getBannerById(id);

    // If new image is provided, delete the old one from Cloudinary
    if (updateData.image && banner.image && updateData.image.publicId !== banner.image.publicId) {
      await deleteFromCloudinary(banner.image.publicId);
    }

    const updated = await BannerRepository.update(id, updateData);
    await this.invalidateCache();
    return updated;
  }

  async deleteBanner(id) {
    const banner = await this.getBannerById(id);

    // Delete image from Cloudinary
    if (banner.image && banner.image.publicId) {
      await deleteFromCloudinary(banner.image.publicId);
    }

    const deleted = await BannerRepository.delete(id);
    await this.invalidateCache();
    return deleted;
  }

  async toggleBannerStatus(id) {
    const banner = await this.getBannerById(id);
    const toggled = await BannerRepository.updateStatus(id, !banner.published);
    await this.invalidateCache();
    return toggled;
  }

  async getPublicBanners() {
    return await BannerRepository.findAll({ published: true });
  }
}

export default new BannerService();

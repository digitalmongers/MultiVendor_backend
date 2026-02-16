import BannerRepository from '../repositories/banner.repository.js';
import { deleteFromCloudinary } from '../utils/cloudinary.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Cache from '../utils/cache.js';
import L1Cache from '../utils/l1Cache.js';

const BANNER_CACHE_KEY = 'banners:public';

class BannerService {
  /**
   * Helper to invalidate public banner cache
   */
  async invalidateCache() {
    await Cache.delByPattern('response:/api/v1/banners/public*');
    await Cache.del(BANNER_CACHE_KEY);
    L1Cache.delByPattern('banner');
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
    // Try L1 first
    const l1Cached = L1Cache.get(BANNER_CACHE_KEY);
    if (l1Cached) {
      return l1Cached;
    }

    // Try L2
    const l2Cached = await Cache.get(BANNER_CACHE_KEY);
    if (l2Cached) {
      L1Cache.set(BANNER_CACHE_KEY, l2Cached, 600);
      return l2Cached;
    }

    const banners = await BannerRepository.findAll({ published: true });
    
    // Cache results
    await Cache.set(BANNER_CACHE_KEY, banners, 3600);
    L1Cache.set(BANNER_CACHE_KEY, banners, 600); // L1: 10min
    
    return banners;
  }
}

export default new BannerService();

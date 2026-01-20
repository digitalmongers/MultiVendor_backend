import ReliabilityRepository from '../repositories/reliability.repository.js';
import { deleteFromCloudinary } from '../utils/cloudinary.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Cache from '../utils/cache.js';

class ReliabilityService {
  /**
   * Helper to invalidate public reliability cache
   */
  async invalidateCache() {
    await Cache.delByPattern('response:/api/v1/company-reliability/public*');
  }

  async saveReliability(key, data) {
    const existing = await ReliabilityRepository.findByKey(key);

    // If new image is provided and it's different from the existing one, delete the old one
    if (existing && data.image && existing.image && data.image.publicId !== existing.image.publicId) {
      await deleteFromCloudinary(existing.image.publicId);
    }

    const saved = await ReliabilityRepository.upsertByKey(key, data);
    await this.invalidateCache();
    return saved;
  }

  async getAllReliabilities() {
    return await ReliabilityRepository.findAll();
  }

  async getReliabilityByKey(key) {
    const reliability = await ReliabilityRepository.findByKey(key);
    if (!reliability) {
      throw new AppError('Reliability badge not found', HTTP_STATUS.NOT_FOUND, 'RELIABILITY_NOT_FOUND');
    }
    return reliability;
  }

  async toggleStatus(key) {
    const reliability = await this.getReliabilityByKey(key);
    const newStatus = reliability.status === 'active' ? 'inactive' : 'active';
    const toggled = await ReliabilityRepository.updateStatus(key, newStatus);
    await this.invalidateCache();
    return toggled;
  }

  async getPublicReliabilities() {
    return await ReliabilityRepository.findAll({ status: 'active' });
  }
}

export default new ReliabilityService();

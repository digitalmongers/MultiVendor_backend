import SliderRepository from '../repositories/slider.repository.js';
import { deleteFromCloudinary } from '../utils/cloudinary.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Cache from '../utils/cache.js';
import L1Cache from '../utils/l1Cache.js';

const SLIDER_CACHE_KEY = 'sliders:public';

class SliderService {
  /**
   * Helper to invalidate public slider cache
   */
  async invalidateCache() {
    await Cache.delByPattern('response:/api/v1/sliders/public*');
    await Cache.del(SLIDER_CACHE_KEY);
    L1Cache.delByPattern('slider');
  }

  async createSlider(sliderData) {
    const slider = await SliderRepository.create(sliderData);
    await this.invalidateCache();
    return slider;
  }

  async getAllSliders(filter = {}) {
    return await SliderRepository.findAll(filter);
  }

  async getSliderById(id) {
    const slider = await SliderRepository.findById(id);
    if (!slider) {
      throw new AppError('Slider not found', HTTP_STATUS.NOT_FOUND, 'SLIDER_NOT_FOUND');
    }
    return slider;
  }

  async updateSlider(id, updateData) {
    const slider = await this.getSliderById(id);

    // If new image is provided, delete the old one from Cloudinary
    if (updateData.image && slider.image && updateData.image.publicId !== slider.image.publicId) {
      await deleteFromCloudinary(slider.image.publicId);
    }

    const updated = await SliderRepository.update(id, updateData);
    await this.invalidateCache();
    return updated;
  }

  async deleteSlider(id) {
    const slider = await this.getSliderById(id);

    // Delete image from Cloudinary
    if (slider.image && slider.image.publicId) {
      await deleteFromCloudinary(slider.image.publicId);
    }

    const deleted = await SliderRepository.delete(id);
    await this.invalidateCache();
    return deleted;
  }

  async toggleSliderStatus(id) {
    const slider = await this.getSliderById(id);
    const toggled = await SliderRepository.updateStatus(id, !slider.published);
    await this.invalidateCache();
    return toggled;
  }

  async getPublicSliders() {
    // Try L1 first
    const l1Cached = L1Cache.get(SLIDER_CACHE_KEY);
    if (l1Cached) {
      return l1Cached;
    }

    // Try L2
    const l2Cached = await Cache.get(SLIDER_CACHE_KEY);
    if (l2Cached) {
      L1Cache.set(SLIDER_CACHE_KEY, l2Cached, 600);
      return l2Cached;
    }

    const sliders = await SliderRepository.findAll({ published: true });
    
    // Cache results
    await Cache.set(SLIDER_CACHE_KEY, sliders, 3600);
    L1Cache.set(SLIDER_CACHE_KEY, sliders, 600); // L1: 10min
    
    return sliders;
  }
}

export default new SliderService();

import ProductSubCategoryRepository from '../repositories/productSubCategory.repository.js';
import ProductCategoryRepository from '../repositories/productCategory.repository.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Cache from '../utils/cache.js';
import Logger from '../utils/logger.js';
import L1Cache from '../utils/l1Cache.js';

const SUBCATEGORY_CACHE_PREFIX = 'product:subcategories:';
const SUBCATEGORY_RESPONSE_PATTERN = 'response:/api/v1/subcategories*';

class ProductSubCategoryService {
  async invalidateCache(categoryId) {
    if (categoryId) {
      await Cache.del(`${SUBCATEGORY_CACHE_PREFIX}${categoryId}`);
      L1Cache.del(`${SUBCATEGORY_CACHE_PREFIX}${categoryId}`);
    } else {
      await Cache.delByPattern(`${SUBCATEGORY_CACHE_PREFIX}*`);
      L1Cache.delByPattern('subcategory');
    }
    await Cache.delByPattern(SUBCATEGORY_RESPONSE_PATTERN);
    Logger.debug('Product SubCategory Cache Invalidated (L1 + L2)');
  }

  async createSubCategory(data) {
    const { name, category } = data;

    const catExists = await ProductCategoryRepository.findById(category);
    if (!catExists) {
      throw new AppError('Parent category not found', HTTP_STATUS.BAD_REQUEST, 'PARENT_CATEGORY_NOT_FOUND');
    }

    const existing = await ProductSubCategoryRepository.findByNameAndCategory(name, category);
    if (existing) {
      throw new AppError('Subcategory already exists under this category', HTTP_STATUS.BAD_REQUEST, 'SUBCATEGORY_EXISTS');
    }

    const sub = await ProductSubCategoryRepository.create(data);
    await this.invalidateCache(category);
    return sub;
  }

  async getAllSubCategories() {
    return await ProductSubCategoryRepository.findAll();
  }

  async getSubCategoriesByCategory(categoryId) {
    const cacheKey = `${SUBCATEGORY_CACHE_PREFIX}${categoryId}`;
    
    // Try L1 first
    const l1Cached = L1Cache.get(cacheKey);
    if (l1Cached) {
      Logger.debug(`Subcategories L1 Cache Hit: ${categoryId}`);
      return l1Cached;
    }

    // Try L2 (Redis)
    const l2Cached = await Cache.get(cacheKey);
    if (l2Cached) {
      Logger.debug(`Subcategories L2 Cache Hit: ${categoryId}`);
      L1Cache.set(cacheKey, l2Cached, 600); // Populate L1
      return l2Cached;
    }

    const subs = await ProductSubCategoryRepository.findByCategoryId(categoryId);
    await Cache.set(cacheKey, subs, 3600);
    L1Cache.set(cacheKey, subs, 600); // L1: 10min
    return subs;
  }

  async updateSubCategory(id, updateData) {
    const sub = await ProductSubCategoryRepository.findById(id);
    if (!sub) {
      throw new AppError('Subcategory not found', HTTP_STATUS.NOT_FOUND, 'SUBCATEGORY_NOT_FOUND');
    }

    const updated = await ProductSubCategoryRepository.updateById(id, updateData);
    // Invalidate both old and potentially new category cache
    await this.invalidateCache(sub.category._id);
    if (updateData.category && updateData.category !== sub.category._id.toString()) {
      await this.invalidateCache(updateData.category);
    }
    
    return updated;
  }

  async deleteSubCategory(id) {
    const sub = await ProductSubCategoryRepository.findById(id);
    if (!sub) {
      throw new AppError('Subcategory not found', HTTP_STATUS.NOT_FOUND, 'SUBCATEGORY_NOT_FOUND');
    }

    await ProductSubCategoryRepository.deleteById(id);
    await this.invalidateCache(sub.category._id);
    return true;
  }
}

export default new ProductSubCategoryService();

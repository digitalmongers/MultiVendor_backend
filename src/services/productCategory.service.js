import ProductCategoryRepository from '../repositories/productCategory.repository.js';
import ProductSubCategoryRepository from '../repositories/productSubCategory.repository.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Cache from '../utils/cache.js';
import Logger from '../utils/logger.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';

const CATEGORY_CACHE_KEY = 'product:categories:all';
const CATEGORY_RESPONSE_PATTERN = 'response:/api/v1/categories*';

class ProductCategoryService {
  async invalidateCache() {
    await Cache.del(CATEGORY_CACHE_KEY);
    await Cache.delByPattern(CATEGORY_RESPONSE_PATTERN);
    Logger.debug('Product Category Cache Invalidated');
  }

  async createCategory(data, file) {
    const existing = await ProductCategoryRepository.findByName(data.name);
    if (existing) {
      throw new AppError('Category already exists', HTTP_STATUS.BAD_REQUEST, 'CATEGORY_EXISTS');
    }

    let logoData = null;
    if (file) {
      const result = await uploadToCloudinary(file, 'categories');
      logoData = {
        url: result.secure_url,
        publicId: result.public_id,
      };
    }

    const category = await ProductCategoryRepository.create({
      ...data,
      logo: logoData,
    });

    await this.invalidateCache();
    return category;
  }

  async getAllCategories(filter = {}) {
    // Try data cache first
    const cached = await Cache.get(CATEGORY_CACHE_KEY);
    if (cached && Object.keys(filter).length === 0) {
      Logger.debug('Product Categories Data Cache Hit');
      return cached;
    }

    const categories = await ProductCategoryRepository.findAll(filter);
    
    if (Object.keys(filter).length === 0) {
      await Cache.set(CATEGORY_CACHE_KEY, categories, 3600);
    }
    
    return categories;
  }

  async updateCategory(id, updateData, file) {
    const category = await ProductCategoryRepository.findById(id);
    if (!category) {
      throw new AppError('Category not found', HTTP_STATUS.NOT_FOUND, 'CATEGORY_NOT_FOUND');
    }

    if (file) {
      if (category.logo?.publicId) {
        await deleteFromCloudinary(category.logo.publicId);
      }
      const result = await uploadToCloudinary(file, 'categories');
      updateData.logo = {
        url: result.secure_url,
        publicId: result.public_id,
      };
    }

    const updated = await ProductCategoryRepository.updateById(id, updateData);
    await this.invalidateCache();
    return updated;
  }

  async deleteCategory(id) {
    const category = await ProductCategoryRepository.findById(id);
    if (!category) {
      throw new AppError('Category not found', HTTP_STATUS.NOT_FOUND, 'CATEGORY_NOT_FOUND');
    }

    if (category.logo?.publicId) {
      await deleteFromCloudinary(category.logo.publicId);
    }

    // Delete subcategories as well
    await ProductSubCategoryRepository.deleteByCategoryId(id);
    await ProductCategoryRepository.deleteById(id);

    await this.invalidateCache();
    // Also invalidate subcategory cache since they are deleted/linked
    await Cache.delByPattern('product:subcategories:*');
    await Cache.delByPattern('response:/api/v1/subcategories*');
    
    return true;
  }
}

export default new ProductCategoryService();

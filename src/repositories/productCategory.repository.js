import ProductCategory from '../models/productCategory.model.js';

class ProductCategoryRepository {
  async create(data) {
    return await ProductCategory.create(data);
  }

  async findAll(filter = {}, sort = { createdAt: -1 }) {
    return await ProductCategory.find(filter).sort(sort).lean();
  }

  async findById(id) {
    return await ProductCategory.findById(id).lean();
  }

  async findByName(name) {
    return await ProductCategory.findOne({ name }).lean();
  }

  async updateById(id, updateData) {
    return await ProductCategory.findByIdAndUpdate(id, updateData, { new: true }).lean();
  }

  async deleteById(id) {
    return await ProductCategory.findByIdAndDelete(id);
  }

  async count(filter = {}) {
    return await ProductCategory.countDocuments(filter);
  }
}

export default new ProductCategoryRepository();

import ProductCategory from '../models/productCategory.model.js';

class ProductCategoryRepository {
  async create(data) {
    return await ProductCategory.create(data);
  }

  async findAll(filter = {}, sort = { createdAt: -1 }) {
    return await ProductCategory.find(filter).sort(sort);
  }

  async findById(id) {
    return await ProductCategory.findById(id);
  }

  async findByName(name) {
    return await ProductCategory.findOne({ name });
  }

  async updateById(id, updateData) {
    return await ProductCategory.findByIdAndUpdate(id, updateData, { new: true });
  }

  async deleteById(id) {
    return await ProductCategory.findByIdAndDelete(id);
  }

  async count(filter = {}) {
    return await ProductCategory.countDocuments(filter);
  }
}

export default new ProductCategoryRepository();

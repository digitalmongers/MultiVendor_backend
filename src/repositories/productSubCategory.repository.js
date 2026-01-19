import ProductSubCategory from '../models/productSubCategory.model.js';

class ProductSubCategoryRepository {
  async create(data) {
    return await ProductSubCategory.create(data);
  }

  async findAll(filter = {}, sort = { createdAt: -1 }) {
    return await ProductSubCategory.find(filter).populate('category', 'name').sort(sort);
  }

  async findById(id) {
    return await ProductSubCategory.findById(id).populate('category', 'name');
  }

  async findByNameAndCategory(name, categoryId) {
    return await ProductSubCategory.findOne({ name, category: categoryId });
  }

  async findByCategoryId(categoryId) {
    return await ProductSubCategory.find({ category: categoryId }).populate('category', 'name').sort({ createdAt: -1 });
  }

  async updateById(id, updateData) {
    return await ProductSubCategory.findByIdAndUpdate(id, updateData, { new: true }).populate('category', 'name');
  }

  async deleteById(id) {
    return await ProductSubCategory.findByIdAndDelete(id);
  }

  async deleteByCategoryId(categoryId) {
    return await ProductSubCategory.deleteMany({ category: categoryId });
  }
}

export default new ProductSubCategoryRepository();

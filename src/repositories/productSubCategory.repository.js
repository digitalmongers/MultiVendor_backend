import ProductSubCategory from '../models/productSubCategory.model.js';

class ProductSubCategoryRepository {
  async create(data) {
    return await ProductSubCategory.create(data);
  }

  async findAll(filter = {}, sort = { createdAt: -1 }) {
    return await ProductSubCategory.find(filter).populate('category', 'name').sort(sort).lean();
  }

  async findById(id) {
    return await ProductSubCategory.findById(id).populate('category', 'name').lean();
  }

  async findByNameAndCategory(name, categoryId) {
    return await ProductSubCategory.findOne({ name, category: categoryId }).lean();
  }

  async findByCategoryId(categoryId) {
    return await ProductSubCategory.find({ category: categoryId }).populate('category', 'name').sort({ createdAt: -1 }).lean();
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

import BlogCategory from '../models/blogCategory.model.js';

class BlogCategoryRepository {
  async create(data) {
    return await BlogCategory.create(data);
  }

  async findAll(filter = {}, sort = { createdAt: -1 }) {
    return await BlogCategory.find(filter).sort(sort).lean();
  }

  async findById(id) {
    return await BlogCategory.findById(id).lean();
  }

  async findByName(name) {
    return await BlogCategory.findOne({ name }).lean();
  }

  async updateById(id, updateData) {
    return await BlogCategory.findByIdAndUpdate(id, updateData, { new: true });
  }

  async deleteById(id) {
    return await BlogCategory.findByIdAndDelete(id);
  }

  async count(filter = {}) {
    return await BlogCategory.countDocuments(filter);
  }
}

export default new BlogCategoryRepository();

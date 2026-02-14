import Blog from '../models/blog.model.js';

class BlogRepository {
  async create(data) {
    return await Blog.create(data);
  }

  async findAll(filter = {}, options = {}) {
    const { 
      page = 1, 
      limit = 10, 
      sort = { createdAt: -1 }, 
      populate = 'category' 
    } = options;

    const skip = (page - 1) * limit;

    const [blogs, total] = await Promise.all([
      Blog.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate(populate)
        .lean(),
      Blog.countDocuments(filter)
    ]);

    return { blogs, total, page, limit };
  }

  async findActiveBlogs(filter = {}, sort = { createdAt: -1 }) {
    // Only fetch blogs with active status and populate category
    return await Blog.find({ ...filter, status: 'active' })
      .sort(sort)
      .populate({
        path: 'category',
        match: { status: 'active' }
      })
      .lean()
      .then(blogs => blogs.filter(blog => blog.category)); // Filter out blogs where category is not active (match returns null)
  }

  async findBySlug(slug, populate = 'category') {
    return await Blog.findOne({ slug }).populate(populate).lean();
  }

  async findById(id, populate = 'category') {
    return await Blog.findById(id).populate(populate).lean();
  }

  async updateById(id, updateData) {
    return await Blog.findByIdAndUpdate(id, updateData, { new: true }).populate('category');
  }

  async deleteById(id) {
    return await Blog.findByIdAndDelete(id);
  }

  async count(filter = {}) {
    return await Blog.countDocuments(filter);
  }
}

export default new BlogRepository();

import Blog from '../models/blog.model.js';

class BlogRepository {
  async create(data) {
    return await Blog.create(data);
  }

  /**
   * Find all blogs with OFFSET pagination (for admin/fixed pages)
   */
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

  /**
   * Find blogs with CURSOR pagination (for public APIs - fast & scalable)
   * Use for infinite scroll, mobile apps, large datasets
   */
  async findAllCursor(filter = {}, cursor = null, limit = 10, sortDirection = 'desc') {
    // Build query with cursor
    const query = { ...filter };
    if (cursor) {
      const operator = sortDirection === 'desc' ? '$lt' : '$gt';
      query._id = { [operator]: cursor };
    }

    const sort = sortDirection === 'desc' ? { _id: -1 } : { _id: 1 };

    // Fetch one extra to determine if there's a next page
    const blogs = await Blog.find(query)
      .sort(sort)
      .limit(limit + 1)
      .populate('category')
      .lean();

    // Check if there's a next page
    const hasNextPage = blogs.length > limit;
    const items = hasNextPage ? blogs.slice(0, limit) : blogs;

    // Get next cursor from last item
    const nextCursor = items.length > 0 && hasNextPage 
      ? items[items.length - 1]._id 
      : null;

    return {
      blogs: items,
      pagination: {
        nextCursor,
        hasNextPage,
        limit,
        count: items.length
      }
    };
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

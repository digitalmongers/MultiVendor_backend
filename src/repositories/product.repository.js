import Product from '../models/product.model.js';

class ProductRepository {
  async create(data) {
    return await Product.create(data);
  }

  /**
   * Find all products with OFFSET pagination (for admin/fixed pages)
   */
  async findAll(filter = {}, sort = { createdAt: -1 }, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    // Support Text Search if 'search' is in filter
    if (filter.search) {
      filter.$text = { $search: filter.search };
      delete filter.search;
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('category', 'name')
        .populate('subCategory', 'name')
        .populate('vendor', 'businessName businessAddress status')
        .lean(),
      Product.countDocuments(filter)
    ]);

    // Filter out products from blocked/inactive vendors
    const filteredProducts = products.filter(product => {
      if (product.vendor && product.vendor.status) {
        return product.vendor.status === 'active';
      }
      return true;
    });

    return {
      products: filteredProducts,
      pagination: {
        total: filteredProducts.length,
        page,
        limit,
        pages: Math.ceil(filteredProducts.length / limit)
      }
    };
  }

  /**
   * Find products with CURSOR pagination (for public APIs - fast & scalable)
   * Use for infinite scroll, mobile apps, large datasets
   */
  async findAllCursor(filter = {}, cursor = null, limit = 20, sortDirection = 'desc') {
    // Support Text Search if 'search' is in filter
    if (filter.search) {
      filter.$text = { $search: filter.search };
      delete filter.search;
    }

    // Build query with cursor
    const query = { ...filter };
    if (cursor) {
      const operator = sortDirection === 'desc' ? '$lt' : '$gt';
      query._id = { [operator]: cursor };
    }

    const sort = sortDirection === 'desc' ? { _id: -1 } : { _id: 1 };

    // Fetch one extra to determine if there's a next page
    const products = await Product.find(query)
      .sort(sort)
      .limit(limit + 1)
      .populate('category', 'name')
      .populate('subCategory', 'name')
      .populate('vendor', 'businessName businessAddress status')
      .lean();

    // Check if there's a next page
    const hasNextPage = products.length > limit;
    const items = hasNextPage ? products.slice(0, limit) : products;

    // Filter out products from blocked/inactive vendors
    const filteredItems = items.filter(product => {
      if (product.vendor && product.vendor.status) {
        return product.vendor.status === 'active';
      }
      return true;
    });

    // Get next cursor from last item
    const nextCursor = filteredItems.length > 0 && hasNextPage
      ? filteredItems[filteredItems.length - 1]._id
      : null;

    return {
      products: filteredItems,
      pagination: {
        nextCursor,
        hasNextPage,
        limit,
        count: filteredItems.length
      }
    };
  }

  async findById(id) {
    return await Product.findById(id)
      .populate('category', 'name')
      .populate('subCategory', 'name')
      .populate('vendor', 'firstName lastName businessName businessAddress businessLogo email phoneNumber') // Full vendor details
      .populate('attributes.attribute', 'name')
      .lean();
  }

  async findOne(filter) {
    return await Product.findOne(filter).lean();
  }

  async update(id, data) {
    return await Product.findByIdAndUpdate(id, data, {
      returnDocument: 'after',
      runValidators: true,
    }).lean();
  }

  async delete(id) {
    return await Product.findByIdAndDelete(id);
  }

  async count(filter = {}) {
    return await Product.countDocuments(filter);
  }

  async updateStatus(id, status) {
    return await Product.findByIdAndUpdate(id, { status }, { returnDocument: 'after' }).lean();
  }
}

export default new ProductRepository();

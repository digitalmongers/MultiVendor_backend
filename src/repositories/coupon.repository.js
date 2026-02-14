import Coupon from '../models/coupon.model.js';
import BaseRepository from './base.repository.js';

class CouponRepository extends BaseRepository {
    constructor() {
        super(Coupon);
    }

    async findByCode(code) {
        return await this.model.findOne({ code: code.toUpperCase() }).lean();
    }

    /**
   * Find coupons by vendor with OFFSET pagination (for admin/vendor panels)
   */
  async findByVendor(vendorId, options = {}) {
    const query = { vendor: vendorId };

    // Handle basic filters if any
    if (options.search) {
        query.$or = [
            { title: { $regex: options.search, $options: 'i' } },
            { code: { $regex: options.search, $options: 'i' } }
        ];
    }

    if (options.isActive !== undefined) {
        query.isActive = options.isActive;
    }

    const sort = options.sort || { createdAt: -1 };
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const [coupons, total] = await Promise.all([
        this.model.find(query).sort(sort).skip(skip).limit(limit).lean(),
        this.model.countDocuments(query)
    ]);

    return {
        coupons,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Find coupons with CURSOR pagination (for public APIs - fast & scalable)
   * Use for infinite scroll, mobile apps, large datasets
   */
  async findAllWithCursor(filter = {}, cursor = null, limit = 20, sortDirection = 'desc') {
    const query = { ...filter };

    // Handle text search
    if (query.search) {
        query.$or = [
            { title: { $regex: query.search, $options: 'i' } },
            { code: { $regex: query.search, $options: 'i' } }
        ];
        delete query.search;
    }

    // Build query with cursor
    if (cursor) {
        const operator = sortDirection === 'desc' ? '$lt' : '$gt';
        query._id = { [operator]: cursor };
    }

    const sort = sortDirection === 'desc' ? { _id: -1 } : { _id: 1 };

    // Fetch one extra to determine if there's a next page
    const coupons = await this.model.find(query)
        .sort(sort)
        .limit(limit + 1)
        .lean();

    // Check if there's a next page
    const hasNextPage = coupons.length > limit;
    const items = hasNextPage ? coupons.slice(0, limit) : coupons;

    // Get next cursor from last item
    const nextCursor = items.length > 0 && hasNextPage 
        ? items[items.length - 1]._id 
        : null;

    return {
        coupons: items,
        pagination: {
            nextCursor,
            hasNextPage,
            limit,
            count: items.length
        }
    };
  }

    async isCodeExists(code, excludeId = null) {
        const query = { code: code.toUpperCase() };
        if (excludeId) {
            query._id = { $ne: excludeId };
        }
        const exists = await this.model.exists(query);
        return !!exists;
    }
}

export default new CouponRepository();

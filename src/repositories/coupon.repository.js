import Coupon from '../models/coupon.model.js';
import BaseRepository from './base.repository.js';

class CouponRepository extends BaseRepository {
    constructor() {
        super(Coupon);
    }

    async findByCode(code) {
        return await this.model.findOne({ code: code.toUpperCase() }).lean();
    }

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

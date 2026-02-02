import CouponRepository from '../repositories/coupon.repository.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Cache from '../utils/cache.js';

class AdminCouponService {
    async createCoupon(data) {
        // 1. Validation: If bearer is vendor, vendorId must be provided
        if (data.bearer === 'vendor' && !data.vendor) {
            throw new AppError('Vendor must be selected when bearer is vendor', HTTP_STATUS.BAD_REQUEST, 'VENDOR_REQUIRED');
        }

        // 2. Clear vendor field if bearer is admin to ensure clean data
        if (data.bearer === 'admin') {
            data.vendor = null;
        }

        // 3. Date Validation
        const start = new Date(data.startDate);
        const end = new Date(data.expireDate);
        if (end <= start) {
            throw new AppError('Expire date must be after start date', HTTP_STATUS.BAD_REQUEST, 'INVALID_DATE_RANGE');
        }

        // 4. Unique Code Validation
        const isExists = await CouponRepository.isCodeExists(data.code);
        if (isExists) {
            throw new AppError('Coupon code already exists', HTTP_STATUS.CONFLICT, 'DUPLICATE_CODE');
        }

        // 5. Create
        const coupon = await CouponRepository.create({
            ...data,
            code: data.code.toUpperCase(),
            startDate: start,
            expireDate: end
        });

        await this.invalidateCache();
        return coupon;
    }

    async getCoupons(query) {
        return await CouponRepository.findAll(query);
    }

    async getCouponById(id) {
        const coupon = await CouponRepository.findById(id);
        if (!coupon) {
            throw new AppError('Coupon not found', HTTP_STATUS.NOT_FOUND, 'COUPON_NOT_FOUND');
        }
        return coupon;
    }

    async updateCoupon(id, data) {
        const coupon = await this.getCouponById(id);

        if (data.bearer === 'vendor' && !data.vendor && !coupon.vendor) {
            throw new AppError('Vendor must be selected when bearer is vendor', HTTP_STATUS.BAD_REQUEST, 'VENDOR_REQUIRED');
        }

        if (data.startDate || data.expireDate) {
            const start = data.startDate ? new Date(data.startDate) : new Date(coupon.startDate);
            const end = data.expireDate ? new Date(data.expireDate) : new Date(coupon.expireDate);
            if (end <= start) {
                throw new AppError('Expire date must be after start date', HTTP_STATUS.BAD_REQUEST, 'INVALID_DATE_RANGE');
            }
        }

        if (data.code && data.code.toUpperCase() !== coupon.code) {
            const isExists = await CouponRepository.isCodeExists(data.code, id);
            if (isExists) {
                throw new AppError('Coupon code already exists', HTTP_STATUS.CONFLICT, 'DUPLICATE_CODE');
            }
            data.code = data.code.toUpperCase();
        }

        const updated = await CouponRepository.update(id, data);
        await this.invalidateCache();
        return updated;
    }

    async toggleStatus(id, isActive) {
        await this.getCouponById(id);
        const updated = await CouponRepository.update(id, { isActive });
        await this.invalidateCache();
        return updated;
    }

    async deleteCoupon(id) {
        await this.getCouponById(id);
        const deleted = await CouponRepository.delete(id);
        await this.invalidateCache();
        return deleted;
    }

    async exportCoupons() {
        const result = await CouponRepository.findAll({ limit: 0 });
        return result.coupons;
    }

    async invalidateCache() {
        await Cache.delByPattern('coupons*');
    }
}

export default new AdminCouponService();

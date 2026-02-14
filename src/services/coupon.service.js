import CouponRepository from '../repositories/coupon.repository.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Cache from '../utils/cache.js';
import L1Cache from '../utils/l1Cache.js';

class CouponService {
    async createCoupon(data, vendorId) {
        // 1. Validate Date Range
        const start = new Date(data.startDate);
        const end = new Date(data.expireDate);
        const now = new Date();

        if (end <= start) {
            throw new AppError('Expire date must be after start date', HTTP_STATUS.BAD_REQUEST, 'INVALID_DATE_RANGE');
        }

        // 2. Validate Code Uniqueness
        const isExists = await CouponRepository.isCodeExists(data.code);
        if (isExists) {
            throw new AppError('Coupon code already exists', HTTP_STATUS.CONFLICT, 'DUPLICATE_CODE');
        }

        // 3. Prepare data
        const couponData = {
            ...data,
            vendor: vendorId,
            code: data.code.toUpperCase(),
            startDate: start,
            expireDate: end
        };

        // 4. Create
        const coupon = await CouponRepository.create(couponData);
        await this.invalidateCache(vendorId);
        return coupon;
    }

    async invalidateCache(vendorId) {
        // Invalidate public coupon lists and vendor specific lists
        await Cache.delByPattern('coupons*');
        L1Cache.delByPattern('coupon');
    }

    async getVendorCoupons(vendorId, query) {
        return await CouponRepository.findByVendor(vendorId, query);
    }

    async getCouponById(id, vendorId) {
        const coupon = await CouponRepository.findById(id);
        if (!coupon) {
            throw new AppError('Coupon not found', HTTP_STATUS.NOT_FOUND, 'COUPON_NOT_FOUND');
        }

        if (coupon.vendor.toString() !== vendorId.toString()) {
            throw new AppError('Not authorized to access this coupon', HTTP_STATUS.FORBIDDEN, 'FORBIDDEN_ACCESS');
        }

        return coupon;
    }

    async updateCoupon(id, data, vendorId) {
        const coupon = await this.getCouponById(id, vendorId);

        // Validations if fields are changing
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
        await this.invalidateCache(vendorId);
        return updated;
    }

    async toggleStatus(id, isActive, vendorId) {
        const coupon = await this.getCouponById(id, vendorId);

        // Basic check: You can't activate an expired coupon? 
        // Or user can activate it but it won't be valid. Let's allow toggle but validaton logic handles date.

        const updated = await CouponRepository.update(id, { isActive });
        await this.invalidateCache(vendorId);
        return updated;
    }

    async deleteCoupon(id, vendorId) {
        await this.getCouponById(id, vendorId); // Ensure ownership
        const deleted = await CouponRepository.delete(id);
        await this.invalidateCache(vendorId);
        return deleted;
    }

    async exportVendorCoupons(vendorId) {
        // Fetch ALL coupons for the vendor (no pagination)
        const result = await CouponRepository.findByVendor(vendorId, { limit: 0 });
        return result.coupons;
    }
}

export default new CouponService();

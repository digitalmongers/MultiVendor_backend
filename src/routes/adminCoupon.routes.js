import express from 'express';
import { z } from 'zod';
import { SYSTEM_PERMISSIONS } from '../constants.js';
import validate from '../middleware/validate.middleware.js';
import { authorizeStaff } from '../middleware/employeeAuth.middleware.js';
import AdminCouponController from '../controllers/adminCoupon.controller.js';
import lockRequest from '../middleware/idempotency.middleware.js';

const router = express.Router();

const couponSchema = z.object({
    body: z.object({
        title: z.string().min(1),
        code: z.string().min(3),
        type: z.enum(['discount_on_purchase', 'free_delivery', 'first_order']),
        bearer: z.enum(['admin', 'vendor']),
        vendor: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Vendor ID").optional().nullable(),
        discountType: z.enum(['amount', 'percent']).optional(),
        discountAmount: z.number().min(0).optional(),
        minPurchase: z.number().min(0).optional(),
        limitForSameUser: z.number().min(1).optional(),
        startDate: z.string().min(1),
        expireDate: z.string().min(1),
        customerScope: z.enum(['all', 'specific']).optional()
    })
});

// Admin/Staff Protection
router.use(authorizeStaff(SYSTEM_PERMISSIONS.OFFERS_AND_DEALS));

router.route('/')
    .get(AdminCouponController.getCoupons)
    .post(lockRequest(), validate(couponSchema), AdminCouponController.createCoupon);

router.get('/export', AdminCouponController.exportCoupons);

router.route('/:id')
    .get(AdminCouponController.getCouponById)
    .patch(lockRequest(), validate(couponSchema.partial()), AdminCouponController.updateCoupon)
    .delete(lockRequest(), AdminCouponController.deleteCoupon);

router.patch('/:id/status', lockRequest(), AdminCouponController.updateStatus);

export default router;

import express from 'express';
import { z } from 'zod';
import { SYSTEM_PERMISSIONS } from '../constants.js';
import validate from '../middleware/validate.middleware.js';
import { authorizeStaff } from '../middleware/employeeAuth.middleware.js';
import AdminFeaturedDealController from '../controllers/adminFeaturedDeal.controller.js';
import lockRequest from '../middleware/idempotency.middleware.js';

const router = express.Router();

const dealSchema = z.object({
    body: z.object({
        title: z.string().min(1),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
        image: z.string().url(),
        metaTitle: z.string().optional(),
        metaDescription: z.string().optional(),
        metaImage: z.string().optional()
    })
});

const publishSchema = z.object({
    body: z.object({
        isPublished: z.boolean()
    })
});

const addProductsSchema = z.object({
    body: z.object({
        products: z.array(z.object({
            product: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Product ID"),
            discount: z.number().min(0),
            discountType: z.enum(['flat', 'percent'])
        })).min(1)
    })
});

// Admin/Staff Protection
router.use(authorizeStaff(SYSTEM_PERMISSIONS.OFFERS_AND_DEALS));

router.route('/')
    .get(AdminFeaturedDealController.getDeals)
    .post(lockRequest(), validate(dealSchema), AdminFeaturedDealController.createDeal);

router.route('/:id')
    .get(AdminFeaturedDealController.getDeal)
    .patch(lockRequest(), validate(dealSchema.partial()), AdminFeaturedDealController.updateDeal)
    .delete(lockRequest(), AdminFeaturedDealController.deleteDeal);

router.patch('/:id/publish', lockRequest(), validate(publishSchema), AdminFeaturedDealController.togglePublish);

router.post('/:id/products', lockRequest(), validate(addProductsSchema), AdminFeaturedDealController.addProducts);

router.patch('/:id/products/:productId/status', lockRequest(), AdminFeaturedDealController.toggleProductStatus);

router.delete('/:id/products/:productId', lockRequest(), AdminFeaturedDealController.removeProduct);

export default router;

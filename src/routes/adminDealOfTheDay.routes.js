import express from 'express';
import { z } from 'zod';
import { SYSTEM_PERMISSIONS } from '../constants.js';
import validate from '../middleware/validate.middleware.js';
import { authorizeStaff } from '../middleware/employeeAuth.middleware.js';
import AdminDealOfTheDayController from '../controllers/adminDealOfTheDay.controller.js';
import lockRequest from '../middleware/idempotency.middleware.js';

const router = express.Router();

const dealSchema = z.object({
    body: z.object({
        title: z.string().min(1)
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
            product: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Product ID")
        })).min(1)
    })
});

// Admin/Staff Protection
router.use(authorizeStaff(SYSTEM_PERMISSIONS.OFFERS_AND_DEALS));

router.route('/')
    .get(AdminDealOfTheDayController.getDeals)
    .post(lockRequest(), validate(dealSchema), AdminDealOfTheDayController.createDeal);

router.route('/:id')
    .get(AdminDealOfTheDayController.getDeal)
    .patch(lockRequest(), validate(dealSchema.partial()), AdminDealOfTheDayController.updateDeal)
    .delete(lockRequest(), AdminDealOfTheDayController.deleteDeal);

router.patch('/:id/publish', lockRequest(), validate(publishSchema), AdminDealOfTheDayController.togglePublish);

router.post('/:id/products', lockRequest(), validate(addProductsSchema), AdminDealOfTheDayController.addProducts);

router.patch('/:id/products/:productId/status', lockRequest(), AdminDealOfTheDayController.toggleProductStatus);

router.delete('/:id/products/:productId', lockRequest(), AdminDealOfTheDayController.removeProduct);

export default router;

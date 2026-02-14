import express from 'express';
import FeaturedDealController from '../controllers/featuredDeal.controller.js';
import cacheMiddleware from '../middleware/cache.middleware.js';

const router = express.Router();

// Public routes with 5-minute cache
router.get('/active', cacheMiddleware(300), FeaturedDealController.getActiveDeals);
router.get('/:id', cacheMiddleware(300), FeaturedDealController.getDeal);

export default router;

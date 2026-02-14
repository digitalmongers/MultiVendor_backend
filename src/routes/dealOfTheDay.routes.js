import express from 'express';
import DealOfTheDayController from '../controllers/dealOfTheDay.controller.js';
import cacheMiddleware from '../middleware/cache.middleware.js';

const router = express.Router();

// Public routes with 5-minute cache
router.get('/active', cacheMiddleware(300), DealOfTheDayController.getActiveDeals);
router.get('/:id', cacheMiddleware(300), DealOfTheDayController.getDeal);

export default router;

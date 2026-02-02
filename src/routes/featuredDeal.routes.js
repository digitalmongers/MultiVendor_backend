import express from 'express';
import FeaturedDealController from '../controllers/featuredDeal.controller.js';

const router = express.Router();

router.get('/active', FeaturedDealController.getActiveDeals);
router.get('/:id', FeaturedDealController.getDeal);

export default router;

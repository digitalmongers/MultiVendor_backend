import FeaturedDealService from '../services/featuredDeal.service.js';
import ApiResponse from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants.js';

class FeaturedDealController {
    getActiveDeals = async (req, res) => {
        // Use cursor-based pagination for public APIs (fast & scalable)
        const cursor = req.query.cursor || null;
        const limit = parseInt(req.query.limit) || 10;
        const sortDirection = req.query.sort === 'asc' ? 'asc' : 'desc';
        
        const result = await FeaturedDealService.getActiveFeaturedDealsCursor(cursor, limit, sortDirection);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, 'Active featured deals fetched successfully'));
    };

    getDeal = async (req, res) => {
        const result = await FeaturedDealService.getPublicFeaturedDealById(req.params.id);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, 'Featured deal fetched successfully'));
    };
}

export default new FeaturedDealController();

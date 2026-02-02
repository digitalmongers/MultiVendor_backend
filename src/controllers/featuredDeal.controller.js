import FeaturedDealService from '../services/featuredDeal.service.js';
import ApiResponse from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants.js';

class FeaturedDealController {
    getActiveDeals = async (req, res) => {
        const limit = parseInt(req.query.limit) || 10;
        const result = await FeaturedDealService.getActiveFeaturedDeals(limit);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, 'Active featured deals fetched successfully'));
    };

    getDeal = async (req, res) => {
        const result = await FeaturedDealService.getPublicFeaturedDealById(req.params.id);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, 'Featured deal fetched successfully'));
    };
}

export default new FeaturedDealController();

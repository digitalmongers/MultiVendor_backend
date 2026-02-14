import DealOfTheDayService from '../services/dealOfTheDay.service.js';
import ApiResponse from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants.js';

class DealOfTheDayController {
    getActiveDeals = async (req, res) => {
        // Use cursor-based pagination for public APIs (fast & scalable)
        const cursor = req.query.cursor || null;
        const limit = parseInt(req.query.limit) || 10;
        const sortDirection = req.query.sort === 'asc' ? 'asc' : 'desc';
        
        const result = await DealOfTheDayService.getActiveDealsCursor(cursor, limit, sortDirection);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, 'Active deals fetched successfully'));
    };

    getDeal = async (req, res) => {
        const result = await DealOfTheDayService.getPublicDealById(req.params.id);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, 'Deal fetched successfully'));
    };
}

export default new DealOfTheDayController();

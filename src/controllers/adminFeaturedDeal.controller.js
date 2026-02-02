import FeaturedDealService from '../services/featuredDeal.service.js';
import ApiResponse from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants.js';

class AdminFeaturedDealController {
    createDeal = async (req, res) => {
        const result = await FeaturedDealService.createFeaturedDeal(req.body);
        return res.status(HTTP_STATUS.CREATED).json(new ApiResponse(HTTP_STATUS.CREATED, result, 'Featured deal created successfully'));
    };

    getDeals = async (req, res) => {
        const result = await FeaturedDealService.getAllFeaturedDeals(req.query);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, 'Featured deals fetched successfully'));
    };

    getDeal = async (req, res) => {
        const result = await FeaturedDealService.getFeaturedDealById(req.params.id);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, 'Featured deal fetched successfully'));
    };

    updateDeal = async (req, res) => {
        const result = await FeaturedDealService.updateFeaturedDeal(req.params.id, req.body);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, 'Featured deal updated successfully'));
    };

    deleteDeal = async (req, res) => {
        await FeaturedDealService.deleteFeaturedDeal(req.params.id);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, null, 'Featured deal deleted successfully'));
    };

    togglePublish = async (req, res) => {
        const result = await FeaturedDealService.togglePublishStatus(req.params.id, req.body.isPublished);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, `Deal ${req.body.isPublished ? 'published' : 'unpublished'} successfully`));
    };

    addProducts = async (req, res) => {
        const result = await FeaturedDealService.addProductsToDeal(req.params.id, req.body.products);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, 'Products added to featured deal successfully'));
    };

    removeProduct = async (req, res) => {
        const result = await FeaturedDealService.removeProductFromDeal(req.params.id, req.params.productId);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, 'Product removed from featured deal successfully'));
    };

    toggleProductStatus = async (req, res) => {
        const { id, productId } = req.params;
        const { isActive } = req.body;
        const result = await FeaturedDealService.toggleProductStatus(id, productId, isActive);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, 'Product status updated in featured deal'));
    };
}

export default new AdminFeaturedDealController();

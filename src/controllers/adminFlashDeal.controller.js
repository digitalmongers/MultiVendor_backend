import FlashDealService from '../services/flashDeal.service.js';
import ApiResponse from '../utils/apiResponse.js';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '../constants.js';

class AdminFlashDealController {
    createDeal = async (req, res) => {
        const deal = await FlashDealService.createFlashDeal(req.body);
        return res.status(HTTP_STATUS.CREATED).json(new ApiResponse(HTTP_STATUS.CREATED, deal, SUCCESS_MESSAGES.CREATED));
    };

    getDeals = async (req, res) => {
        const result = await FlashDealService.getAllFlashDeals(req.query);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, SUCCESS_MESSAGES.FETCHED));
    };

    getDeal = async (req, res) => {
        const deal = await FlashDealService.getFlashDealById(req.params.id);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, deal, SUCCESS_MESSAGES.FETCHED));
    };

    updateDeal = async (req, res) => {
        const deal = await FlashDealService.updateFlashDeal(req.params.id, req.body);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, deal, SUCCESS_MESSAGES.UPDATED));
    };

    deleteDeal = async (req, res) => {
        await FlashDealService.deleteFlashDeal(req.params.id);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, null, SUCCESS_MESSAGES.DELETED));
    };

    togglePublish = async (req, res) => {
        const { isPublished } = req.body;
        const deal = await FlashDealService.togglePublishStatus(req.params.id, isPublished);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, deal, 'Flash deal publish status updated'));
    };

    addProducts = async (req, res) => {
        const { products } = req.body;
        const deal = await FlashDealService.addProductsToDeal(req.params.id, products);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, deal, 'Products added to flash deal'));
    };

    removeProduct = async (req, res) => {
        const { id, productId } = req.params;
        const deal = await FlashDealService.removeProductFromDeal(id, productId);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, deal, 'Product removed from flash deal'));
    };

    toggleProductStatus = async (req, res) => {
        const { id, productId } = req.params;
        const { isActive } = req.body;
        const deal = await FlashDealService.toggleProductStatus(id, productId, isActive);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, deal, 'Product status updated in flash deal'));
    };
}

export default new AdminFlashDealController();

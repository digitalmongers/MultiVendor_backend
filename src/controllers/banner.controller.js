import BannerService from '../services/banner.service.js';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '../constants.js';
import { ApiResponse } from '../utils/apiResponse.js';

class BannerController {
  createBanner = async (req, res) => {
    const banner = await BannerService.createBanner(req.body);
    return ApiResponse.success(res, HTTP_STATUS.CREATED, SUCCESS_MESSAGES.CREATED, banner);
  };

  getAllBanners = async (req, res) => {
    const banners = await BannerService.getAllBanners();
    return ApiResponse.success(res, HTTP_STATUS.OK, SUCCESS_MESSAGES.FETCHED, banners);
  };

  getBannerById = async (req, res) => {
    const banner = await BannerService.getBannerById(req.params.id);
    return ApiResponse.success(res, HTTP_STATUS.OK, SUCCESS_MESSAGES.FETCHED, banner);
  };

  updateBanner = async (req, res) => {
    const banner = await BannerService.updateBanner(req.params.id, req.body);
    return ApiResponse.success(res, HTTP_STATUS.OK, SUCCESS_MESSAGES.UPDATED, banner);
  };

  deleteBanner = async (req, res) => {
    await BannerService.deleteBanner(req.params.id);
    return ApiResponse.success(res, HTTP_STATUS.OK, SUCCESS_MESSAGES.DELETED);
  };

  toggleStatus = async (req, res) => {
    const banner = await BannerService.toggleBannerStatus(req.params.id);
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Banner status toggled successfully', banner);
  };

  getPublicBanners = async (req, res) => {
    const banners = await BannerService.getPublicBanners();
    return ApiResponse.success(res, HTTP_STATUS.OK, SUCCESS_MESSAGES.FETCHED, banners);
  };
}

export default new BannerController();

import TrustedByService from '../services/trustedBy.service.js';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '../constants.js';
import { ApiResponse } from '../utils/apiResponse.js';

class TrustedByController {
  createLogo = async (req, res) => {
    const logo = await TrustedByService.createLogo(req.body);
    return ApiResponse.success(res, HTTP_STATUS.CREATED, SUCCESS_MESSAGES.CREATED, logo);
  };

  getAllLogos = async (req, res) => {
    const logos = await TrustedByService.getAllLogos();
    return ApiResponse.success(res, HTTP_STATUS.OK, SUCCESS_MESSAGES.FETCHED, logos);
  };

  getLogoById = async (req, res) => {
    const logo = await TrustedByService.getLogoById(req.params.id);
    return ApiResponse.success(res, HTTP_STATUS.OK, SUCCESS_MESSAGES.FETCHED, logo);
  };

  updateLogo = async (req, res) => {
    const logo = await TrustedByService.updateLogo(req.params.id, req.body);
    return ApiResponse.success(res, HTTP_STATUS.OK, SUCCESS_MESSAGES.UPDATED, logo);
  };

  deleteLogo = async (req, res) => {
    await TrustedByService.deleteLogo(req.params.id);
    return ApiResponse.success(res, HTTP_STATUS.OK, SUCCESS_MESSAGES.DELETED);
  };

  toggleStatus = async (req, res) => {
    const logo = await TrustedByService.toggleStatus(req.params.id);
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Logo status toggled successfully', logo);
  };

  getPublicLogos = async (req, res) => {
    const logos = await TrustedByService.getPublicLogos();
    return ApiResponse.success(res, HTTP_STATUS.OK, SUCCESS_MESSAGES.FETCHED, logos);
  };
}

export default new TrustedByController();

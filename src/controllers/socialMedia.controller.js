import SocialMediaService from '../services/socialMedia.service.js';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '../constants.js';
import { ApiResponse } from '../utils/apiResponse.js';

class SocialMediaController {
  saveLink = async (req, res) => {
    const { platform, link } = req.body;
    const social = await SocialMediaService.saveLink(platform, link);
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Social media link saved successfully', social);
  };

  getAllLinks = async (req, res) => {
    const links = await SocialMediaService.getAllLinks();
    return ApiResponse.success(res, HTTP_STATUS.OK, SUCCESS_MESSAGES.FETCHED, links);
  };

  updateLink = async (req, res) => {
    const social = await SocialMediaService.updateLink(req.params.id, req.body);
    return ApiResponse.success(res, HTTP_STATUS.OK, SUCCESS_MESSAGES.UPDATED, social);
  };

  deleteLink = async (req, res) => {
    await SocialMediaService.deleteLink(req.params.id);
    return ApiResponse.success(res, HTTP_STATUS.OK, SUCCESS_MESSAGES.DELETED);
  };

  toggleStatus = async (req, res) => {
    const social = await SocialMediaService.toggleStatus(req.params.id);
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Social media status toggled successfully', social);
  };

  getPublicLinks = async (req, res) => {
    const links = await SocialMediaService.getPublicLinks();
    return ApiResponse.success(res, HTTP_STATUS.OK, SUCCESS_MESSAGES.FETCHED, links);
  };
}

export default new SocialMediaController();

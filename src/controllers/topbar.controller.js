import TopbarService from '../services/topbar.service.js';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '../constants.js';
import { ApiResponse } from '../utils/apiResponse.js';

class TopbarController {
  saveTopbar = async (req, res) => {
    const topbar = await TopbarService.saveTopbar(req.body);
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Topbar settings saved successfully', topbar);
  };

  getTopbar = async (req, res) => {
    const topbar = await TopbarService.getTopbar();
    return ApiResponse.success(res, HTTP_STATUS.OK, SUCCESS_MESSAGES.FETCHED, topbar);
  };

  getPublicTopbar = async (req, res) => {
    const topbar = await TopbarService.getPublicTopbar();
    return ApiResponse.success(res, HTTP_STATUS.OK, SUCCESS_MESSAGES.FETCHED, topbar);
  };
}

export default new TopbarController();

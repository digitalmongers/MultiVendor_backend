import CookieConsentService from '../services/cookieConsent.service.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '../constants.js';

class CookieConsentController {
  /**
   * @desc    Get Cookie Consent Settings (Public)
   * @route   GET /api/v1/cookie-consent
   * @access  Public
   */
  getSettings = async (req, res) => {
    const settings = await CookieConsentService.getSettings();
    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, settings, SUCCESS_MESSAGES.FETCHED));
  };

  /**
   * @desc    Update Cookie Consent Settings (Admin/Employee)
   * @route   PATCH /api/v1/cookie-consent
   * @access  Private
   */
  updateSettings = async (req, res) => {
    const result = await CookieConsentService.updateSettings(
      req.body,
      req.user._id,
      req.userModel,
      req.ip,
      req.headers['user-agent']
    );
    return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, SUCCESS_MESSAGES.UPDATED));
  };
}

export default new CookieConsentController();

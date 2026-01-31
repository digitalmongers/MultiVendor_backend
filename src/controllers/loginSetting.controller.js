import LoginSettingService from '../services/loginSetting.service.js';
import catchAsync from '../utils/catchAsync.js';
import ApiResponse from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants.js';
import Cache from '../utils/cache.js';

class LoginSettingController {
  getSettings = catchAsync(async (req, res) => {
    const settings = await LoginSettingService.getSettings();
    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, settings));
  });

  updateSettings = catchAsync(async (req, res) => {
    const settings = await LoginSettingService.updateSettings(
      req.body,
      req.user?._id || req.admin?._id,
      req.role === 'admin' ? 'Admin' : 'Employee'
    );

    // Invalidate relevant cache if any
    await Cache.delByPattern('*login-settings*');

    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, settings, 'Login settings updated successfully'));
  });
}

export default new LoginSettingController();

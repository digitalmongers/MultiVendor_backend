import SystemSettingService from '../services/systemSetting.service.js';
import ApiResponse from '../utils/apiResponse.js';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '../constants.js';
import catchAsync from '../utils/catchAsync.js';

class SystemSettingController {
  
  /**
   * @desc    Get System Environment Settings
   * @route   GET /api/v1/system-settings
   * @access  Private (Admin/Staff)
   */
  getSettings = catchAsync(async (req, res) => {
    const settings = await SystemSettingService.getSettings();
    res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, settings, SUCCESS_MESSAGES.OPERATION_SUCCESS)
    );
  });

  /**
   * @desc    Update System Environment Settings
   * @route   PATCH /api/v1/system-settings
   * @access  Private (Admin with Permission)
   */
  updateSettings = catchAsync(async (req, res) => {
    // Determine user (Admin or Employee)
    const userId = req.admin?._id || req.employee?._id;
    const userModel = req.admin ? 'Admin' : 'Employee';

    const updated = await SystemSettingService.updateSettings(req.body, userId, userModel);
    
    res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, updated, 'System environment settings updated.')
    );
  });
}

export default new SystemSettingController();

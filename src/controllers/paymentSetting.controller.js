import PaymentSettingService from '../services/paymentSetting.service.js';
import catchAsync from '../utils/catchAsync.js';
import ApiResponse from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants.js';
import Cache from '../utils/cache.js';

class PaymentSettingController {
  /**
   * @desc    Get global payment settings
   * @route   GET /api/v1/payment-settings
   */
  getSettings = catchAsync(async (req, res) => {
    const settings = await PaymentSettingService.getSettings();
    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, settings));
  });

  /**
   * @desc    Update global payment settings (Admin)
   * @route   PATCH /api/v1/payment-settings
   */
  updateSettings = catchAsync(async (req, res) => {
    const settings = await PaymentSettingService.updateSettings(
      req.body,
      req.user?._id || req.admin?._id,
      req.role === 'admin' ? 'Admin' : 'Employee'
    );

    // Invalidate Cache
    await Cache.delByPattern('*payment-settings*');

    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, settings, 'Payment settings updated successfully'));
  });
}

export default new PaymentSettingController();

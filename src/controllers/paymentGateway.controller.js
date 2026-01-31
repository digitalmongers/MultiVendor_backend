import PaymentGatewayService from '../services/paymentGateway.service.js';
import catchAsync from '../utils/catchAsync.js';
import ApiResponse from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants.js';
import Cache from '../utils/cache.js';

class PaymentGatewayController {
  /**
   * @desc    Get all gateways (Admin)
   * @route   GET /api/v1/payment-gateways
   */
  getAllGateways = catchAsync(async (req, res) => {
    const gateways = await PaymentGatewayService.getAllGateways();
    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, gateways));
  });

  /**
   * @desc    Update gateway config (Admin)
   * @route   PATCH /api/v1/payment-gateways/:name
   */
  updateGateway = catchAsync(async (req, res) => {
    const gateway = await PaymentGatewayService.updateGateway(
      req.params.name,
      req.body,
      req.user?._id || req.admin?._id,
      req.role === 'admin' ? 'Admin' : 'Employee'
    );

    // Invalidate Cache
    await Cache.delByPattern('*payment-gateways*');

    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, gateway, 'Gateway updated successfully'));
  });

  /**
   * @desc    Get active gateways for homepage (Public)
   * @route   GET /api/v1/payment-gateways/public
   */
  getPublicGateways = catchAsync(async (req, res) => {
    const gateways = await PaymentGatewayService.getPublicGateways();
    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, gateways));
  });
}

export default new PaymentGatewayController();

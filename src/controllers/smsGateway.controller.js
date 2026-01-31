import SmsGatewayService from '../services/smsGateway.service.js';
import catchAsync from '../utils/catchAsync.js';
import ApiResponse from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants.js';

class SmsGatewayController {
  getAllGateways = catchAsync(async (req, res) => {
    const gateways = await SmsGatewayService.getAllGateways();
    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, gateways));
  });

  updateGateway = catchAsync(async (req, res) => {
    const gateway = await SmsGatewayService.updateGateway(
      req.params.name,
      req.body,
      req.user?._id || req.admin?._id,
      req.role === 'admin' ? 'Admin' : 'Employee'
    );
    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, gateway, 'SMS Gateway updated successfully'));
  });
}

export default new SmsGatewayController();

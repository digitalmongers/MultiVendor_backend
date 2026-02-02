import AdminCouponService from '../services/adminCoupon.service.js';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '../constants.js';
import ApiResponse from '../utils/apiResponse.js';
import { convertToCSV, couponCSVHeaders } from '../utils/csvExport.js';

class AdminCouponController {
    createCoupon = async (req, res) => {
        const coupon = await AdminCouponService.createCoupon(req.body);
        return res.status(HTTP_STATUS.CREATED).json(new ApiResponse(HTTP_STATUS.CREATED, coupon, SUCCESS_MESSAGES.CREATED));
    };

    getCoupons = async (req, res) => {
        const result = await AdminCouponService.getCoupons(req.query);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, result, SUCCESS_MESSAGES.FETCHED));
    };

    getCouponById = async (req, res) => {
        const coupon = await AdminCouponService.getCouponById(req.params.id);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, coupon, SUCCESS_MESSAGES.FETCHED));
    };

    updateCoupon = async (req, res) => {
        const coupon = await AdminCouponService.updateCoupon(req.params.id, req.body);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, coupon, SUCCESS_MESSAGES.UPDATED));
    };

    updateStatus = async (req, res) => {
        const { isActive } = req.body;
        const coupon = await AdminCouponService.toggleStatus(req.params.id, isActive);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, coupon, 'Coupon status updated successfully'));
    };

    deleteCoupon = async (req, res) => {
        await AdminCouponService.deleteCoupon(req.params.id);
        return res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, null, SUCCESS_MESSAGES.DELETED));
    };

    exportCoupons = async (req, res) => {
        const coupons = await AdminCouponService.exportCoupons();
        const csv = convertToCSV(coupons, couponCSVHeaders);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="admin-coupons-${Date.now()}.csv"`);
        return res.send(csv);
    };
}

export default new AdminCouponController();

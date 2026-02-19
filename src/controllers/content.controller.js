import ContentService from '../services/content.service.js';
import { HTTP_STATUS } from '../constants.js';
import { ApiResponse } from '../utils/apiResponse.js';

class ContentController {
  /**
   * @desc    Update About Us content
   */
  updateAboutUs = async (req, res) => {
    const { aboutUs } = req.body;
    const content = await ContentService.updateContent({ aboutUs });
    return ApiResponse.success(res, HTTP_STATUS.OK, 'About Us content updated successfully', content);
  };

  /**
   * @desc    Update Terms & Conditions
   */
  updateTermsAndConditions = async (req, res) => {
    const { termsAndConditions } = req.body;
    const content = await ContentService.updateContent({ termsAndConditions });
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Terms & Conditions updated successfully', content);
  };

  /**
   * @desc    Update Privacy Policy
   */
  updatePrivacyPolicy = async (req, res) => {
    const { privacyPolicy } = req.body;
    const content = await ContentService.updateContent({ privacyPolicy });
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Privacy Policy updated successfully', content);
  };


  updateRefundPolicy = async (req, res) => {
    const { refundPolicy } = req.body;
    const content = await ContentService.updateContent({ refundPolicy });
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Refund Policy updated successfully', content);
  };

  /**
   * @desc    Update Return Policy
   */
  updateReturnPolicy = async (req, res) => {
    const { returnPolicy } = req.body;
    const content = await ContentService.updateContent({ returnPolicy });
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Return Policy updated successfully', content);
  };

  /**
   * @desc    Update Shipping Policy
   */
  updateShippingPolicy = async (req, res) => {
    const { shippingPolicy } = req.body;
    const content = await ContentService.updateContent({ shippingPolicy });
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Shipping Policy updated successfully', content);
  };

  /**
   * @desc    Update Cancellation Policy
   */
  updateCancellationPolicy = async (req, res) => {
    const { cancellationPolicy } = req.body;
    const content = await ContentService.updateContent({ cancellationPolicy });
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Cancellation Policy updated successfully', content);
  };

  /**
   * @desc    Get all site content
   */
  getContent = async (req, res) => {
    const content = await ContentService.getContent();
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Site content fetched successfully', content);
  };

  /**
   * @desc    Get About Us content
   */
  getAboutUs = async (req, res) => {
    const content = await ContentService.getContent();
    return ApiResponse.success(res, HTTP_STATUS.OK, 'About Us content fetched successfully', { aboutUs: content.aboutUs });
  };

  /**
   * @desc    Get Terms & Conditions
   */
  getTermsAndConditions = async (req, res) => {
    const content = await ContentService.getContent();
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Terms & Conditions fetched successfully', { termsAndConditions: content.termsAndConditions });
  };

  /**
   * @desc    Get Privacy Policy
   */
  getPrivacyPolicy = async (req, res) => {
    const content = await ContentService.getContent();
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Privacy Policy fetched successfully', { privacyPolicy: content.privacyPolicy });
  };

  /**
   * @desc    Get Refund Policy
   */
  getRefundPolicy = async (req, res) => {
    const content = await ContentService.getContent();
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Refund Policy fetched successfully', { refundPolicy: content.refundPolicy });
  };

  /**
   * @desc    Get Return Policy
   */
  getReturnPolicy = async (req, res) => {
    const content = await ContentService.getContent();
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Return Policy fetched successfully', { returnPolicy: content.returnPolicy });
  };

  /**
   * @desc    Get Shipping Policy
   */
  getShippingPolicy = async (req, res) => {
    const content = await ContentService.getContent();
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Shipping Policy fetched successfully', { shippingPolicy: content.shippingPolicy });
  };

  /**
   * @desc    Get Cancellation Policy
   */
  getCancellationPolicy = async (req, res) => {
    const content = await ContentService.getContent();
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Cancellation Policy fetched successfully', { cancellationPolicy: content.cancellationPolicy });
  };
}

export default new ContentController();

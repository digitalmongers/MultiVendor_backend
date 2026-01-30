import CustomerEmailTemplateService from '../services/customerEmailTemplate.service.js';
import catchAsync from '../utils/catchAsync.js';
import ApiResponse from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants.js';

/**
 * @desc    Get all customer email templates
 * @route   GET /api/v1/admin/customer-template
 * @access  Private (Admin)
 */
export const getAllTemplates = catchAsync(async (req, res) => {
  const templates = await CustomerEmailTemplateService.getAllTemplates();
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, templates));
});

/**
 * @desc    Get customer template by event
 * @route   GET /api/v1/admin/customer-template/:event
 * @access  Private (Admin)
 */
export const getTemplateByEvent = catchAsync(async (req, res) => {
  const template = await CustomerEmailTemplateService.getTemplateByEvent(req.params.event);
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, template));
});

/**
 * @desc    Update customer template configuration
 * @route   PATCH /api/v1/admin/customer-template/:event
 * @access  Private (Admin)
 */
export const updateTemplate = catchAsync(async (req, res) => {
  const template = await CustomerEmailTemplateService.updateTemplate(req.params.event, req.body);
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, template, 'Template updated successfully'));
});

/**
 * @desc    Update customer template logo
 * @route   PATCH /api/v1/admin/customer-template/:event/logo
 * @access  Private (Admin)
 */
export const updateLogo = catchAsync(async (req, res) => {
  if (!req.file) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(new ApiResponse(HTTP_STATUS.BAD_REQUEST, null, 'Please upload a logo'));
    return;
  }
  const template = await CustomerEmailTemplateService.updateTemplateLogo(req.params.event, req.file);
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, template, 'Logo updated successfully'));
});

/**
 * @desc    Update customer template main icon
 * @route   PATCH /api/v1/admin/customer-template/:event/icon
 * @access  Private (Admin)
 */
export const updateIcon = catchAsync(async (req, res) => {
  if (!req.file) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(new ApiResponse(HTTP_STATUS.BAD_REQUEST, null, 'Please upload an icon'));
    return;
  }
  const template = await CustomerEmailTemplateService.updateTemplateIcon(req.params.event, req.file);
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, template, 'Icon updated successfully'));
});

/**
 * @desc    Toggle customer template active status
 * @route   PATCH /api/v1/admin/customer-template/:event/toggle
 * @access  Private (Admin)
 */
export const toggleTemplate = catchAsync(async (req, res) => {
  const template = await CustomerEmailTemplateService.toggleTemplateStatus(req.params.event);
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, template, 'Status toggled successfully'));
});

export default {
  getAllTemplates,
  getTemplateByEvent,
  updateTemplate,
  updateLogo,
  updateIcon,
  toggleTemplate,
};

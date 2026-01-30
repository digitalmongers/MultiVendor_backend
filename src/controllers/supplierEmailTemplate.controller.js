import SupplierEmailTemplateService from '../services/supplierEmailTemplate.service.js';
import catchAsync from '../utils/catchAsync.js';
import ApiResponse from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants.js';

/**
 * @desc    Get all email templates
 * @route   GET /api/v1/admin/email-templates
 * @access  Private (Admin)
 */
export const getAllTemplates = catchAsync(async (req, res) => {
  const templates = await SupplierEmailTemplateService.getAllTemplates();
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, templates));
});

/**
 * @desc    Get template by event
 * @route   GET /api/v1/admin/email-templates/:event
 * @access  Private (Admin)
 */
export const getTemplateByEvent = catchAsync(async (req, res) => {
  const template = await SupplierEmailTemplateService.getTemplateByEvent(req.params.event);
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, template));
});

/**
 * @desc    Update template configuration
 * @route   PATCH /api/v1/admin/email-templates/:event
 * @access  Private (Admin)
 */
export const updateTemplate = catchAsync(async (req, res) => {
  const template = await SupplierEmailTemplateService.updateTemplate(req.params.event, req.body);
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, template, 'Template updated successfully'));
});

/**
 * @desc    Update template logo
 * @route   PATCH /api/v1/admin/email-templates/:event/logo
 * @access  Private (Admin)
 */
export const updateLogo = catchAsync(async (req, res) => {
  if (!req.file) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(new ApiResponse(HTTP_STATUS.BAD_REQUEST, null, 'Please upload a logo'));
    return;
  }
  const template = await SupplierEmailTemplateService.updateTemplateLogo(req.params.event, req.file);
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, template, 'Logo updated successfully'));
});

/**
 * @desc    Update template main icon
 * @route   PATCH /api/v1/admin/email-templates/:event/icon
 * @access  Private (Admin)
 */
export const updateIcon = catchAsync(async (req, res) => {
  if (!req.file) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(new ApiResponse(HTTP_STATUS.BAD_REQUEST, null, 'Please upload an icon'));
    return;
  }
  const template = await SupplierEmailTemplateService.updateTemplateIcon(req.params.event, req.file);
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, template, 'Icon updated successfully'));
});

/**
 * @desc    Toggle template active status
 * @route   PATCH /api/v1/admin/email-templates/:event/toggle
 * @access  Private (Admin)
 */
export const toggleTemplate = catchAsync(async (req, res) => {
  const template = await SupplierEmailTemplateService.toggleTemplateStatus(req.params.event);
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

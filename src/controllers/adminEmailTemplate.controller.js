import AdminEmailTemplateService from '../services/adminEmailTemplate.service.js';
import catchAsync from '../utils/catchAsync.js';
import ApiResponse from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants.js';

export const getAllTemplates = catchAsync(async (req, res) => {
  const templates = await AdminEmailTemplateService.getAllTemplates();
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, templates));
});

export const getTemplateByEvent = catchAsync(async (req, res) => {
  const template = await AdminEmailTemplateService.getTemplateByEvent(req.params.event);
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, template));
});

export const updateTemplate = catchAsync(async (req, res) => {
  const template = await AdminEmailTemplateService.updateTemplate(req.params.event, req.body);
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, template, 'Template updated successfully'));
});

export const updateLogo = catchAsync(async (req, res) => {
  if (!req.file) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(new ApiResponse(HTTP_STATUS.BAD_REQUEST, null, 'Please upload a logo'));
    return;
  }
  const template = await AdminEmailTemplateService.updateTemplateLogo(req.params.event, req.file);
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, template, 'Logo updated successfully'));
});

export const updateIcon = catchAsync(async (req, res) => {
  if (!req.file) {
    res.status(HTTP_STATUS.BAD_REQUEST).json(new ApiResponse(HTTP_STATUS.BAD_REQUEST, null, 'Please upload an icon'));
    return;
  }
  const template = await AdminEmailTemplateService.updateTemplateIcon(req.params.event, req.file);
  res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, template, 'Icon updated successfully'));
});

export const toggleTemplate = catchAsync(async (req, res) => {
  const template = await AdminEmailTemplateService.toggleTemplateStatus(req.params.event);
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

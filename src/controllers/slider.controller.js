import SliderService from '../services/slider.service.js';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '../constants.js';
import { ApiResponse } from '../utils/apiResponse.js';

class SliderController {
  createSlider = async (req, res) => {
    const slider = await SliderService.createSlider(req.body);
    return ApiResponse.success(res, HTTP_STATUS.CREATED, SUCCESS_MESSAGES.CREATED, slider);
  };

  getAllSliders = async (req, res) => {
    const sliders = await SliderService.getAllSliders();
    return ApiResponse.success(res, HTTP_STATUS.OK, SUCCESS_MESSAGES.FETCHED, sliders);
  };

  getSliderById = async (req, res) => {
    const slider = await SliderService.getSliderById(req.params.id);
    return ApiResponse.success(res, HTTP_STATUS.OK, SUCCESS_MESSAGES.FETCHED, slider);
  };

  updateSlider = async (req, res) => {
    const slider = await SliderService.updateSlider(req.params.id, req.body);
    return ApiResponse.success(res, HTTP_STATUS.OK, SUCCESS_MESSAGES.UPDATED, slider);
  };

  deleteSlider = async (req, res) => {
    await SliderService.deleteSlider(req.params.id);
    return ApiResponse.success(res, HTTP_STATUS.OK, SUCCESS_MESSAGES.DELETED);
  };

  toggleStatus = async (req, res) => {
    const slider = await SliderService.toggleSliderStatus(req.params.id);
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Slider status toggled successfully', slider);
  };

  getPublicSliders = async (req, res) => {
    const sliders = await SliderService.getPublicSliders();
    return ApiResponse.success(res, HTTP_STATUS.OK, SUCCESS_MESSAGES.FETCHED, sliders);
  };
}

export default new SliderController();

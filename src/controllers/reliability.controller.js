import ReliabilityService from '../services/reliability.service.js';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '../constants.js';
import { ApiResponse } from '../utils/apiResponse.js';

class ReliabilityController {
  saveReliability = async (req, res) => {
    const { key } = req.body;
    const reliability = await ReliabilityService.saveReliability(key, req.body);
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Reliability badge saved successfully', reliability);
  };

  getAllReliabilities = async (req, res) => {
    const reliabilities = await ReliabilityService.getAllReliabilities();
    return ApiResponse.success(res, HTTP_STATUS.OK, SUCCESS_MESSAGES.FETCHED, reliabilities);
  };

  toggleStatus = async (req, res) => {
    const reliability = await ReliabilityService.toggleStatus(req.params.key);
    return ApiResponse.success(res, HTTP_STATUS.OK, 'Reliability status toggled successfully', reliability);
  };

  getPublicReliabilities = async (req, res) => {
    const reliabilities = await ReliabilityService.getPublicReliabilities();
    return ApiResponse.success(res, HTTP_STATUS.OK, SUCCESS_MESSAGES.FETCHED, reliabilities);
  };
}

export default new ReliabilityController();

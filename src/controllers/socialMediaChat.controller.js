import SocialMediaChatService from '../services/socialMediaChat.service.js';
import catchAsync from '../utils/catchAsync.js';
import ApiResponse from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants.js';
import Cache from '../utils/cache.js';

class SocialMediaChatController {
  getAllPlatforms = catchAsync(async (req, res) => {
    const platforms = await SocialMediaChatService.getAllPlatforms();
    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, platforms));
  });

  getPublicPlatforms = catchAsync(async (req, res) => {
    const platforms = await SocialMediaChatService.getPublicPlatforms();
    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, platforms));
  });

  updatePlatform = catchAsync(async (req, res) => {
    const platform = await SocialMediaChatService.updatePlatform(
      req.params.platform,
      req.body,
      req.user?._id || req.admin?._id,
      req.role === 'admin' ? 'Admin' : 'Employee'
    );

    // Invalidate Cache
    await Cache.delByPattern('*social-media-chat*');

    res.status(HTTP_STATUS.OK).json(new ApiResponse(HTTP_STATUS.OK, platform, 'Chat platform updated successfully'));
  });
}

export default new SocialMediaChatController();

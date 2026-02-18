import BlogService from '../services/blog.service.js';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '../constants.js';
import { ApiResponse } from '../utils/apiResponse.js';

class PublicBlogController {
  getBlogs = async (req, res) => {
    const { category } = req.query;
    const filter = category ? { category } : {};
    
    const blogs = await BlogService.getPublicBlogs(filter);
    return res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, blogs, SUCCESS_MESSAGES.FETCHED)
    );
  };

  getBlogBySlug = async (req, res) => {
    const blog = await BlogService.getPublicBlogBySlug(req.params.slug);
    return res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, blog, SUCCESS_MESSAGES.FETCHED)
    );
  };
  getSettings = async (req, res) => {
    const settings = await BlogService.getSettings();
    return res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, settings, SUCCESS_MESSAGES.FETCHED)
    );
  };
}

export default new PublicBlogController();

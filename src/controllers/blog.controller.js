import BlogService from '../services/blog.service.js';
import { HTTP_STATUS, SUCCESS_MESSAGES } from '../constants.js';
import { ApiResponse } from '../utils/apiResponse.js';

class BlogController {
  createBlog = async (req, res) => {
    const blog = await BlogService.createBlog(req.body, req.files);
    return res.status(HTTP_STATUS.CREATED).json(
      new ApiResponse(HTTP_STATUS.CREATED, blog, 'Blog created successfully')
    );
  };

  getPublicBlogs = async (req, res) => {
    // Use cursor-based pagination for public APIs (fast & scalable)
    const { cursor, category, startDate, endDate } = req.query;
    const limit = parseInt(req.query.limit) || 10;
    const sortDirection = req.query.sort === 'asc' ? 'asc' : 'desc';

    const result = await BlogService.getPublicBlogsCursor({
      cursor,
      limit,
      sortDirection,
      category,
      startDate,
      endDate
    });

    return res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, result, SUCCESS_MESSAGES.FETCHED)
    );
  };

  getAllBlogs = async (req, res) => {
    const { blogs, total, page, limit } = await BlogService.getAllBlogs(req.query);
    
    return res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, {
        blogs,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      }, SUCCESS_MESSAGES.FETCHED)
    );
  };

  getBlogById = async (req, res) => {
    const blog = await BlogService.getBlogById(req.params.id);
    return res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, blog, SUCCESS_MESSAGES.FETCHED)
    );
  };

  updateBlog = async (req, res) => {
    const blog = await BlogService.updateBlog(req.params.id, req.body, req.files);
    return res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, blog, SUCCESS_MESSAGES.UPDATED)
    );
  };

  deleteBlog = async (req, res) => {
    await BlogService.deleteBlog(req.params.id);
    return res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, null, 'Blog deleted successfully')
    );
  };

  toggleStatus = async (req, res) => {
    const blog = await BlogService.toggleStatus(req.params.id, req.body.status);
    return res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, blog, `Blog status changed to ${blog.status}`)
    );
  };

  getSettings = async (req, res) => {
    const settings = await BlogService.getSettings();
    return res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, settings, SUCCESS_MESSAGES.FETCHED)
    );
  };

  updateSettings = async (req, res) => {
    const settings = await BlogService.updateSettings(req.body);
    return res.status(HTTP_STATUS.OK).json(
      new ApiResponse(HTTP_STATUS.OK, settings, 'Blog settings updated successfully')
    );
  };
}

export default new BlogController();

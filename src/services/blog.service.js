import BlogRepository from '../repositories/blog.repository.js';
import BlogCategoryRepository from '../repositories/blogCategory.repository.js';
import BlogSettingRepository from '../repositories/blogSetting.repository.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants.js';
import Cache from '../utils/cache.js';
import Logger from '../utils/logger.js';
import MultiLayerCache from '../utils/multiLayerCache.js';
import L1Cache from '../utils/l1Cache.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';

const BLOG_CACHE_KEY = 'blog:all';
const PUBLIC_BLOG_CACHE_KEY = 'blog:public:all';
const BLOG_RESPONSE_PATTERN = 'response:/api/v1/blogs*';
const PUBLIC_BLOG_RESPONSE_PATTERN = 'response:/api/v1/public/blogs*';
const BLOG_SETTING_CACHE_KEY = 'blog:settings';

class BlogService {
  async invalidateCache() {
    await Cache.del(BLOG_CACHE_KEY);
    await Cache.del(PUBLIC_BLOG_CACHE_KEY);
    await Cache.del(BLOG_SETTING_CACHE_KEY);
    await Cache.delByPattern(BLOG_RESPONSE_PATTERN);
    await Cache.delByPattern(PUBLIC_BLOG_RESPONSE_PATTERN);
    // Also invalidate L1 cache
    L1Cache.delByPattern('blog');
    Logger.debug('Blog Cache Invalidated (L1 + L2)');
  }

  async createBlog(data, files) {
    // 1. Validate Category
    const category = await BlogCategoryRepository.findById(data.category);
    if (!category) {
      throw new AppError('Blog category not found', HTTP_STATUS.NOT_FOUND, 'CATEGORY_NOT_FOUND');
    }
    if (category.status !== 'active') {
      throw new AppError('Cannot create blog in an inactive category', HTTP_STATUS.BAD_REQUEST, 'INACTIVE_CATEGORY');
    }

    // 2. Handle Image Uploads
    let blogImageData = null;
    let metaImageData = null;

    if (files) {
      if (files.blogImage) {
        const result = await uploadToCloudinary(files.blogImage[0], 'blogs');
        blogImageData = { url: result.secure_url, publicId: result.public_id };
      }
      if (files.metaImage) {
        const result = await uploadToCloudinary(files.metaImage[0], 'blogs/seo');
        metaImageData = { url: result.secure_url, publicId: result.public_id };
      }
    }

    // 3. Prepare Data
    const blogData = {
      ...data,
      blogImage: blogImageData,
      seo: {
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        metaImage: metaImageData,
      },
    };

    const blog = await BlogRepository.create(blogData);
    await this.invalidateCache();
    return blog;
  }

  async getAllBlogs(query = {}) {
    const { page, limit, status, category, startDate, endDate } = query;
    const filter = {};

    if (status) filter.status = status;
    if (category) filter.category = category;
    
    // Date Filtering
    if (startDate || endDate) {
      filter.publishDate = {};
      if (startDate) filter.publishDate.$gte = new Date(startDate);
      if (endDate) filter.publishDate.$lte = new Date(endDate);
    }

    // Usually, we don't cache complex admin listings with many filter permutations
    // but we can if needed. For now, let's fetch fresh data for admin.
    return await BlogRepository.findAll(filter, { 
      page: parseInt(page) || 1, 
      limit: parseInt(limit) || 10 
    });
  }

  /**
   * Get public blogs with CURSOR pagination (fast & scalable)
   * With Multi-Layer Caching (L1 + L2)
   */
  async getPublicBlogsCursor(query = {}) {
    // 0. Check Global Visibility with caching
    const settings = await this.getSettings();
    if (!settings.isBlogEnabled) {
      return { blogs: [], pagination: { nextCursor: null, hasNextPage: false, limit: query.limit || 10, count: 0 } };
    }

    const { cursor, limit = 10, sortDirection = 'desc', category, startDate, endDate } = query;
    
    // Generate cache key
    const cacheKey = `blogs:cursor:${JSON.stringify({ cursor, limit, sortDirection, category, startDate, endDate })}`;
    
    return await MultiLayerCache.get(cacheKey, async () => {
      const filter = { status: 'active' };
      
      if (category) filter.category = category;
      
      if (startDate || endDate) {
        filter.publishDate = {};
        if (startDate) filter.publishDate.$gte = new Date(startDate);
        if (endDate) filter.publishDate.$lte = new Date(endDate);
      }

      const result = await BlogRepository.findAllCursor(filter, cursor, limit, sortDirection);
      
      // Filter out blogs where category is not active
      result.blogs = result.blogs.filter(blog => blog.category && blog.category.status === 'active');
      
      return result;
    }, { l1TTL: 60, l2TTL: 300 }); // L1: 1min, L2: 5min
  }

  async getPublicBlogs(filter = {}) {
    // 0. Check Global Visibility
    const settings = await this.getSettings();
    if (!settings.isBlogEnabled) {
      return [];
    }

    // Try cache for full list
    if (Object.keys(filter).length === 0) {
      const cached = await Cache.get(PUBLIC_BLOG_CACHE_KEY);
      if (cached) return cached;
    }

    const blogs = await BlogRepository.findActiveBlogs(filter);
    
    if (Object.keys(filter).length === 0) {
      await Cache.set(PUBLIC_BLOG_CACHE_KEY, blogs, 3600);
    }
    
    return blogs;
  }

  async getBlogById(id) {
    const blog = await BlogRepository.findById(id);
    if (!blog) {
      throw new AppError('Blog not found', HTTP_STATUS.NOT_FOUND, 'BLOG_NOT_FOUND');
    }
    return blog;
  }

  async getPublicBlogBySlug(slug) {
    // 0. Check Global Visibility
    const settings = await this.getSettings();
    if (!settings.isBlogEnabled) {
      throw new AppError('Blogs are currently disabled', HTTP_STATUS.FORBIDDEN, 'BLOGS_DISABLED');
    }

    // Multi-layer cache for individual blog
    const cacheKey = `blog:slug:${slug}`;
    
    return await MultiLayerCache.get(cacheKey, async () => {
      const blog = await BlogRepository.findBySlug(slug);
      if (!blog || blog.status !== 'active' || blog.category?.status !== 'active') {
        throw new AppError('Blog not found or inactive', HTTP_STATUS.NOT_FOUND, 'BLOG_NOT_FOUND');
      }
      return blog;
    }, { l1TTL: 300, l2TTL: 1800 }); // L1: 5min, L2: 30min
  }

  async updateBlog(id, updateData, files) {
    const blog = await BlogRepository.findById(id);
    if (!blog) {
      throw new AppError('Blog not found', HTTP_STATUS.NOT_FOUND, 'BLOG_NOT_FOUND');
    }

    // Handle Category update
    if (updateData.category) {
      const category = await BlogCategoryRepository.findById(updateData.category);
      if (!category) {
        throw new AppError('Blog category not found', HTTP_STATUS.NOT_FOUND, 'CATEGORY_NOT_FOUND');
      }
      if (category.status !== 'active') {
        throw new AppError('Cannot move blog to an inactive category', HTTP_STATUS.BAD_REQUEST, 'INACTIVE_CATEGORY');
      }
    }

    // Handle Image Updates
    if (files) {
      if (files.blogImage) {
        if (blog.blogImage?.publicId) {
          await deleteFromCloudinary(blog.blogImage.publicId);
        }
        const result = await uploadToCloudinary(files.blogImage[0], 'blogs');
        updateData.blogImage = { url: result.secure_url, publicId: result.public_id };
      }
      if (files.metaImage) {
        if (blog.seo?.metaImage?.publicId) {
          await deleteFromCloudinary(blog.seo.metaImage.publicId);
        }
        const result = await uploadToCloudinary(files.metaImage[0], 'blogs/seo');
        // Ensure seo nested structure is handled
        if (!updateData.seo) updateData.seo = {};
        updateData.seo.metaImage = { url: result.secure_url, publicId: result.public_id };
      }
    }

    // Merge SEO data if provided
    if (updateData.metaTitle || updateData.metaDescription) {
       updateData.seo = {
         ...blog.seo,
         ...updateData.seo,
         metaTitle: updateData.metaTitle || blog.seo?.metaTitle,
         metaDescription: updateData.metaDescription || blog.seo?.metaDescription,
       };
    }

    const updated = await BlogRepository.updateById(id, updateData);
    await this.invalidateCache();
    return updated;
  }

  async deleteBlog(id) {
    const blog = await BlogRepository.findById(id);
    if (!blog) {
      throw new AppError('Blog not found', HTTP_STATUS.NOT_FOUND, 'BLOG_NOT_FOUND');
    }

    // Delete images from Cloudinary
    if (blog.blogImage?.publicId) {
      await deleteFromCloudinary(blog.blogImage.publicId);
    }
    if (blog.seo?.metaImage?.publicId) {
      await deleteFromCloudinary(blog.seo.metaImage.publicId);
    }

    await BlogRepository.deleteById(id);
    await this.invalidateCache();
    return true;
  }

  async toggleStatus(id, forcedStatus = null) {
    const blog = await BlogRepository.findById(id);
    if (!blog) {
      throw new AppError('Blog not found', HTTP_STATUS.NOT_FOUND, 'BLOG_NOT_FOUND');
    }

    const newStatus = forcedStatus || (blog.status === 'active' ? 'inactive' : 'active');
    
    // If activating, check if category is active
    if (newStatus === 'active') {
      const category = await BlogCategoryRepository.findById(blog.category._id);
      if (category.status !== 'active') {
        throw new AppError('Cannot activate blog in an inactive category', HTTP_STATUS.BAD_REQUEST, 'INACTIVE_CATEGORY');
      }
    }

    const updated = await BlogRepository.updateById(id, { status: newStatus });
    await this.invalidateCache();
    return updated;
  }

  async getSettings() {
    // Multi-layer cache for settings
    const l1Cached = L1Cache.get(BLOG_SETTING_CACHE_KEY);
    if (l1Cached) return l1Cached;

    const l2Cached = await Cache.get(BLOG_SETTING_CACHE_KEY);
    if (l2Cached) {
      L1Cache.set(BLOG_SETTING_CACHE_KEY, l2Cached, 300); // Cache in L1 too
      return l2Cached;
    }

    const settings = await BlogSettingRepository.getSettings();
    await Cache.set(BLOG_SETTING_CACHE_KEY, settings, 3600);
    L1Cache.set(BLOG_SETTING_CACHE_KEY, settings, 300);
    return settings;
  }

  async updateSettings(data) {
    const settings = await BlogSettingRepository.updateSettings(data);
    await this.invalidateCache();
    return settings;
  }
}

export default new BlogService();

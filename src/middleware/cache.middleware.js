import Cache from '../utils/cache.js';
import Logger from '../utils/logger.js';

/**
 * Enterprise Cache Middleware
 * Caches the entire JSON response for GET requests.
 * @param {number} ttl - Time to live in seconds
 */
const cacheMiddleware = (ttl = 3600) => {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Key Strategy: Add userId/adminId prefix for protected routes to prevent data leakage
    let key = `response:${req.originalUrl}`;
    
    if (req.admin && req.admin._id) {
      key = `response:admin:${req.admin._id}:${req.originalUrl}`;
    } else if (req.user && req.user._id) {
      // For customers (req.user)
      key = `response:customer:${req.user._id}:${req.originalUrl}`;
    }

    try {
      const cachedResponse = await Cache.get(key);
      if (cachedResponse) {
        Logger.debug(`Middleware Cache Hit: ${key}`);
        return res.json(cachedResponse);
      }

      // Override res.json to capture the response and store it in cache
      const originalJson = res.json;
      res.json = function (body) {
        // Only cache successful standard responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          Cache.set(key, body, ttl);
        }
        return originalJson.call(this, body);
      };

      next();
    } catch (error) {
      Logger.error('Cache Middleware Error', { error: error.message });
      next();
    }
  };
};

export default cacheMiddleware;

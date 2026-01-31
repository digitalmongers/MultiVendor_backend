import crypto from 'crypto';
import Cache from '../utils/cache.js';
import ApiResponse from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants.js';
import Logger from '../utils/logger.js';

/**
 * Idempotency Middleware (Double Hit Prevention)
 * Locks a specific request for a user for a short duration.
 * @param {number} ttl - Lock duration in seconds (default 5s)
 */
const lockRequest = (ttl = 5) => {
  return async (req, res, next) => {
    // Only apply to state-changing methods (POST, PATCH, PUT, DELETE)
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // 1. Generate a unique key for the request
    // Strategy: userId + path + hash(body)
    const userId = req.user?._id || req.admin?._id || 'guest';
    const bodyHash = crypto
      .createHash('md5')
      .update(JSON.stringify(req.body || {}))
      .digest('hex');
    
    const lockKey = `lock:${userId}:${req.originalUrl}:${bodyHash}`;

    try {
      // 2. Check if lock exists in Redis
      const isLocked = await Cache.get(lockKey);
      
      if (isLocked) {
        Logger.warn(`Double-hit prevented: ${lockKey}`);
        return res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json(
          new ApiResponse(
            HTTP_STATUS.TOO_MANY_REQUESTS, 
            null, 
            'Request is already being processed. Please wait a moment.'
          )
        );
      }

      // 3. Set lock for TTL (seconds)
      // Implementation: We use a simple value '1' to indicate locked
      await Cache.set(lockKey, 'locked', ttl);
      
      // 4. Proceed to next
      next();
    } catch (error) {
      Logger.error('Idempotency Middleware Error', { error: error.message });
      next(); // Don't block if cache fails, but log it
    }
  };
};

export default lockRequest;

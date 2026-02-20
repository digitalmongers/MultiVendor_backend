import crypto from 'crypto';
import Cache from '../utils/cache.js';
import ApiResponse from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../constants.js';
import Logger from '../utils/logger.js';

/**
 * Idempotency Middleware (Double Hit Prevention)
 * Locks a specific request based on user, path, and body hash.
 * @param {string|number} actionOrTtl - Custom action string or TTL in seconds
 * @param {number} ttlSeconds - TTL in seconds (if first param is action string)
 */
const lockRequest = (actionOrTtl = 5, ttlSeconds = 5) => {
  return async (req, res, next) => {
    // Only apply to state-changing methods (POST, PATCH, PUT, DELETE)
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // Determine TTL and Action Name
    const ttl = typeof actionOrTtl === 'number' ? actionOrTtl : ttlSeconds;
    const actionName = typeof actionOrTtl === 'string' ? actionOrTtl : 'default';

    // 1. Generate a unique key for the request
    // Strategy: userId + actionName + path + hash(body)
    let userId = 'guest';

    if (req.user?._id) {
      userId = req.user._id.toString();
    } else if (req.customer?._id) {
      userId = req.customer._id.toString(); // For authenticated customers
    } else if (req.headers['x-guest-id']) {
      userId = req.headers['x-guest-id'];
    } else if (req.query.guestId) {
      userId = req.query.guestId;
    } else {
      // Fallback to IP if no ID is present (last resort to prevent global blocking)
      userId = req.ip || 'unknown_user';
    }

    const bodyHash = crypto
      .createHash('md5')
      .update(JSON.stringify(req.body || {}))
      .digest('hex');

    const lockKey = `lock:${userId}:${actionName}:${req.originalUrl}:${bodyHash}`;

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

import redisClient from '../config/redis.js';
import Logger from './logger.js';

class Cache {
  /**
   * Set value in cache
   * @param {string} key
   * @param {any} value
   * @param {number} ttl - Time to live in seconds (default 1 hour)
   */
  async set(key, value, ttl = 3600) {
    try {
      const stringValue = JSON.stringify(value);
      await redisClient.set(key, stringValue, 'EX', ttl);
      Logger.debug(`Cache Set: ${key}`);
    } catch (error) {
      Logger.error(`Cache Set Error: ${key}`, { error: error.message });
    }
  }

  /**
   * Get value from cache
   * @param {string} key
   * @returns {Promise<any|null>}
   */
  async get(key) {
    try {
      const value = await redisClient.get(key);
      if (value) {
        Logger.debug(`Cache Hit: ${key}`);
        return JSON.parse(value);
      }
      Logger.debug(`Cache Miss: ${key}`);
      return null;
    } catch (error) {
      Logger.error(`Cache Get Error: ${key}`, { error: error.message });
      return null;
    }
  }

  /**
   * Delete value from cache (Invalidation)
   * @param {string} key
   */
  async del(key) {
    try {
      await redisClient.del(key);
      Logger.info(`Cache Invalidated: ${key}`);
    } catch (error) {
      Logger.error(`Cache Delete Error: ${key}`, { error: error.message });
    }
  }

  /**
   * Delete keys by pattern (SCAN implementation for production safety)
   * @param {string} pattern
   */
  async delByPattern(pattern) {
    try {
      let cursor = '0';
      let keysDeleted = 0;

      do {
        const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;

        if (keys.length > 0) {
          await redisClient.del(...keys);
          keysDeleted += keys.length;
        }
      } while (cursor !== '0');

      if (keysDeleted > 0) {
        Logger.info(`Cache Pattern Invalidated: ${pattern} (${keysDeleted} keys deleted)`);
      }
    } catch (error) {
      Logger.error(`Cache Pattern Delete Error: ${pattern}`, { error: error.message });
    }
  }
}

export default new Cache();

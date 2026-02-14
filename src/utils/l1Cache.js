import NodeCache from 'node-cache';
import Logger from './logger.js';

/**
 * L1 Cache - In-Memory Cache (Ultra Fast)
 * Use for: Hot data, frequent reads, same-request caching
 * TTL: Short (seconds to minutes)
 */
class L1Cache {
  constructor() {
    this.cache = new NodeCache({
      stdTTL: 300,        // 5 minutes default
      checkperiod: 60,    // Check expired keys every 60s
      useClones: true,   // Return copies (safer)
      deleteOnExpire: true
    });

    // Handle cache errors
    this.cache.on('error', (error) => {
      Logger.error('L1 Cache Error:', error);
    });
  }

  /**
   * Get from L1 cache
   * @param {string} key
   * @returns {any|null}
   */
  get(key) {
    try {
      const value = this.cache.get(key);
      if (value !== undefined) {
        Logger.debug(`L1 Cache Hit: ${key}`);
        return value;
      }
      Logger.debug(`L1 Cache Miss: ${key}`);
      return null;
    } catch (error) {
      Logger.error(`L1 Cache Get Error: ${key}`, { error: error.message });
      return null;
    }
  }

  /**
   * Set in L1 cache
   * @param {string} key
   * @param {any} value
   * @param {number} ttl - Time to live in seconds (default: 300)
   */
  set(key, value, ttl = 300) {
    try {
      this.cache.set(key, value, ttl);
      Logger.debug(`L1 Cache Set: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      Logger.error(`L1 Cache Set Error: ${key}`, { error: error.message });
    }
  }

  /**
   * Delete from L1 cache
   * @param {string} key
   */
  del(key) {
    try {
      this.cache.del(key);
      Logger.info(`L1 Cache Invalidated: ${key}`);
    } catch (error) {
      Logger.error(`L1 Cache Delete Error: ${key}`, { error: error.message });
    }
  }

  /**
   * Delete multiple keys by pattern
   * @param {string} pattern - String pattern to match
   */
  delByPattern(pattern) {
    try {
      const keys = this.cache.keys();
      const matchingKeys = keys.filter(key => key.includes(pattern));
      
      if (matchingKeys.length > 0) {
        this.cache.del(matchingKeys);
        Logger.info(`L1 Cache Pattern Invalidated: ${pattern} (${matchingKeys.length} keys)`);
      }
    } catch (error) {
      Logger.error(`L1 Cache Pattern Delete Error: ${pattern}`, { error: error.message });
    }
  }

  /**
   * Get cache stats
   * @returns {object}
   */
  getStats() {
    return {
      keys: this.cache.keys().length,
      hits: this.cache.getStats().hits,
      misses: this.cache.getStats().misses,
      hitRate: this.cache.getStats().hits / (this.cache.getStats().hits + this.cache.getStats().misses) || 0
    };
  }

  /**
   * Flush all data
   */
  flush() {
    this.cache.flushAll();
    Logger.info('L1 Cache flushed');
  }
}

export default new L1Cache();

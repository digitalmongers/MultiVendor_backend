import L1Cache from './l1Cache.js';
import L2Cache from './cache.js';  // Redis cache
import Logger from './logger.js';

/**
 * Multi-Layer Cache (L1 + L2)
 * 
 * Strategy: Cache-Aside (Lazy Loading)
 * 1. Check L1 (In-Memory) - Fastest
 * 2. Check L2 (Redis) - Fast
 * 3. Fetch from DB - Slow
 * 4. Populate L1 and L2
 * 
 * L1 TTL: Short (seconds to minutes) - Ultra hot data
 * L2 TTL: Medium (minutes to hours) - Shared data
 */
class MultiLayerCache {
  /**
   * Get data with multi-layer caching
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Function to fetch data from DB if cache miss
   * @param {object} options - Cache options
   * @param {number} options.l1TTL - L1 cache TTL in seconds (default: 60)
   * @param {number} options.l2TTL - L2 cache TTL in seconds (default: 600)
   * @returns {Promise<any>}
   */
  async get(key, fetchFn, options = {}) {
    const { l1TTL = 60, l2TTL = 600 } = options;

    // 1. Try L1 Cache (In-Memory)
    const l1Data = L1Cache.get(key);
    if (l1Data !== null) {
      return l1Data;
    }

    // 2. Try L2 Cache (Redis)
    const l2Data = await L2Cache.get(key);
    if (l2Data !== null) {
      // Populate L1 for faster subsequent access
      L1Cache.set(key, l2Data, l1TTL);
      return l2Data;
    }

    // 3. Fetch from DB
    Logger.info(`Cache Miss (L1+L2): ${key} - Fetching from DB`);
    const data = await fetchFn();

    // 4. Populate both caches
    if (data !== null && data !== undefined) {
      L1Cache.set(key, data, l1TTL);
      await L2Cache.set(key, data, l2TTL);
    }

    return data;
  }

  /**
   * Set data in both caches
   * @param {string} key
   * @param {any} value
   * @param {object} options
   * @param {number} options.l1TTL - L1 cache TTL
   * @param {number} options.l2TTL - L2 cache TTL
   */
  async set(key, value, options = {}) {
    const { l1TTL = 60, l2TTL = 600 } = options;
    
    L1Cache.set(key, value, l1TTL);
    await L2Cache.set(key, value, l2TTL);
  }

  /**
   * Delete from both caches
   * @param {string} key
   */
  async del(key) {
    L1Cache.del(key);
    await L2Cache.del(key);
  }

  /**
   * Delete by pattern from both caches
   * @param {string} pattern
   */
  async delByPattern(pattern) {
    L1Cache.delByPattern(pattern);
    await L2Cache.delByPattern(pattern);
  }

  /**
   * Get or set with tags for selective invalidation
   * @param {string} key
   * @param {Function} fetchFn
   * @param {Array<string>} tags - Tags for cache invalidation groups
   * @param {object} options
   */
  async getWithTags(key, fetchFn, tags = [], options = {}) {
    // Store tags mapping for selective invalidation
    const tagKey = `_tags:${key}`;
    const data = await this.get(key, fetchFn, options);
    
    if (tags.length > 0) {
      await L2Cache.set(tagKey, tags, 86400); // Store tags for 24h
    }
    
    return data;
  }

  /**
   * Invalidate cache by tag
   * @param {string} tag
   */
  async invalidateByTag(tag) {
    // Pattern-based deletion for simplicity
    await this.delByPattern(`*${tag}*`);
    Logger.info(`Cache invalidated by tag: ${tag}`);
  }

  /**
   * Get cache statistics
   * @returns {object}
   */
  getStats() {
    return {
      l1: L1Cache.getStats(),
      // L2 stats would require Redis INFO command
    };
  }
}

export default new MultiLayerCache();

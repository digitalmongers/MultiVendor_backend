import redisClient from '../config/redis.js';
import Logger from './logger.js';

/**
 * Enterprise Vendor Cache Service
 * Implements Redis caching with automatic invalidation for real-time updates
 */
class VendorCacheService {
  constructor() {
    this.TTL = {
      VENDOR_LIST: 300, // 5 minutes for vendor list
      VENDOR_DETAIL: 600, // 10 minutes for individual vendor
      VENDOR_COUNT: 300, // 5 minutes for counts
    };

    this.KEYS = {
      VENDOR_LIST: (page, limit, status, search, version) => 
        `vendor:list:v${version || 0}:${page}:${limit}:${status || 'all'}:${search || 'none'}`,
      VENDOR_DETAIL: (vendorId) => `vendor:detail:${vendorId}`,
      VENDOR_COUNT: (status) => `vendor:count:${status || 'all'}`,
      VENDOR_VERSION: 'vendor:version:list',
      VENDOR_ALL_KEYS: 'vendor:*',
    };
  }

  /**
   * Get current vendor list version
   */
  async getVendorListVersion() {
    try {
      const version = await redisClient.get(this.KEYS.VENDOR_VERSION);
      return version ? parseInt(version, 10) : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Increment vendor list version (Invalidates ALL lists instantly)
   */
  async incrementVendorListVersion() {
    try {
      await redisClient.incr(this.KEYS.VENDOR_VERSION);
      Logger.debug('Vendor list version incremented');
    } catch (error) {
      Logger.error('Redis INCR error', { error: error.message });
    }
  }

  /**
   * Get cached vendor list
   */
  async getVendorList(page, limit, status, search) {
    try {
      const version = await this.getVendorListVersion();
      const key = this.KEYS.VENDOR_LIST(page, limit, status, search, version);
      const cached = await redisClient.get(key);
      
      if (cached) {
        Logger.debug(`Cache HIT: ${key}`);
        return JSON.parse(cached);
      }
      
      Logger.debug(`Cache MISS: ${key}`);
      return null;
    } catch (error) {
      Logger.error('Redis GET error', { error: error.message });
      return null; // Fail gracefully
    }
  }

  /**
   * Cache vendor list
   */
  async setVendorList(page, limit, status, search, data) {
    try {
      const version = await this.getVendorListVersion();
      const key = this.KEYS.VENDOR_LIST(page, limit, status, search, version);
      await redisClient.setex(key, this.TTL.VENDOR_LIST, JSON.stringify(data));
      Logger.debug(`Cache SET: ${key}`);
    } catch (error) {
      Logger.error('Redis SET error', { error: error.message });
    }
  }

  /**
   * Get cached vendor detail
   */
  async getVendorDetail(vendorId) {
    try {
      const key = this.KEYS.VENDOR_DETAIL(vendorId);
      const cached = await redisClient.get(key);
      
      if (cached) {
        Logger.debug(`Cache HIT: ${key}`);
        return JSON.parse(cached);
      }
      
      Logger.debug(`Cache MISS: ${key}`);
      return null;
    } catch (error) {
      Logger.error('Redis GET error', { error: error.message });
      return null;
    }
  }

  /**
   * Cache vendor detail
   */
  async setVendorDetail(vendorId, data) {
    try {
      const key = this.KEYS.VENDOR_DETAIL(vendorId);
      await redisClient.setex(key, this.TTL.VENDOR_DETAIL, JSON.stringify(data));
      Logger.debug(`Cache SET: ${key}`);
    } catch (error) {
      Logger.error('Redis SET error', { error: error.message });
    }
  }

  /**
   * CRITICAL: Invalidate ALL vendor caches
   * Called when ANY vendor data changes to ensure real-time updates
   */
  async invalidateAllVendorCaches() {
    try {
      let cursor = '0';
      let keysDeleted = 0;
      const pattern = this.KEYS.VENDOR_ALL_KEYS;

      do {
        const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;

        if (keys.length > 0) {
          await redisClient.del(...keys);
          keysDeleted += keys.length;
        }
      } while (cursor !== '0');

      if (keysDeleted > 0) {
        Logger.info(`Cache INVALIDATED: ${keysDeleted} vendor cache keys deleted`);
      }
    } catch (error) {
      Logger.error('Redis cache invalidation error', { error: error.message });
    }
  }

  /**
   * Invalidate specific vendor cache
   * Called when a specific vendor is updated
   */
  async invalidateVendorCache(vendorId) {
    try {
      // Delete specific vendor detail cache
      const detailKey = this.KEYS.VENDOR_DETAIL(vendorId);
      await redisClient.del(detailKey);
      
      // OPTIMIZED: Increment version to invalidate all lists in O(1)
      await this.incrementVendorListVersion();
      
      Logger.info(`Cache INVALIDATED: Vendor ${vendorId} and all lists (via version bump)`);
    } catch (error) {
      Logger.error('Redis cache invalidation error', { error: error.message });
    }
  }

  /**
   * Get vendor count (cached)
   */
  async getVendorCount(status) {
    try {
      const key = this.KEYS.VENDOR_COUNT(status);
      const cached = await redisClient.get(key);
      
      if (cached) {
        Logger.debug(`Cache HIT: ${key}`);
        return parseInt(cached, 10);
      }
      
      return null;
    } catch (error) {
      Logger.error('Redis GET error', { error: error.message });
      return null;
    }
  }

  /**
   * Cache vendor count
   */
  async setVendorCount(status, count) {
    try {
      const key = this.KEYS.VENDOR_COUNT(status);
      await redisClient.setex(key, this.TTL.VENDOR_COUNT, count.toString());
      Logger.debug(`Cache SET: ${key}`);
    } catch (error) {
      Logger.error('Redis SET error', { error: error.message });
    }
  }
}

export default new VendorCacheService();

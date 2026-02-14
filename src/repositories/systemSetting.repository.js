import SystemSetting from '../models/systemSetting.model.js';
import Cache from '../utils/cache.js';
import Logger from '../utils/logger.js';

class SystemSettingRepository {
  constructor() {
    this.CACHE_KEY = 'system_settings';
    this.CACHE_TTL = 3600; // 1 hour (auto-invalidated on update)
  }

  /**
   * Get Settings (Cached)
   * Uses "Cache-Aside" pattern.
   */
  async getSettings() {
    // 1. Check Cache
    const cached = await Cache.get(this.CACHE_KEY);
    if (cached) return cached;

    // 2. Database Fallback (Upsert Pattern)
    // We try to find one, if not exists, we return default structure (but don't save unless needed)
    let settings = await SystemSetting.findOne().lean();
    
    if (!settings) {
      // Create default if completely missing
      settings = await SystemSetting.create({
        appName: 'Multi Vendor App',
        appDebug: true,
        appMode: 'Live',
        appUrl: 'http://localhost:3000'
      });
      Logger.info('Initialized Default System Settings');
    }

    // 3. Set Cache
    await Cache.set(this.CACHE_KEY, settings, this.CACHE_TTL);
    
    return settings;
  }

  /**
   * Update Settings (Atomic + Cache Invalidation by Pattern)
   */
  async updateSettings(data, userId, userModel) {
    const settings = await SystemSetting.findOne();
    const id = settings ? settings._id : new mongoose.Types.ObjectId();

    const updated = await SystemSetting.findByIdAndUpdate(
      id,
      {
        $set: {
          ...data,
          updatedBy: userId,
          updatedByModel: userModel
        }
      },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    // Invalidate Cache
    await Cache.del(this.CACHE_KEY);
    
    return updated;
  }
}

export default new SystemSettingRepository();

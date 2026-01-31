import CookieConsent from '../models/cookieConsent.model.js';
import Cache from '../utils/cache.js';
import Logger from '../utils/logger.js';
import mongoose from 'mongoose';

class CookieConsentRepository {
  constructor() {
    this.CACHE_KEY = 'cookie_consent_settings';
    this.CACHE_TTL = 3600; // 1 hour
  }

  /**
   * Get Settings (Cached)
   */
  async getSettings() {
    // 1. Check Cache
    const cached = await Cache.get(this.CACHE_KEY);
    if (cached) return cached;

    // 2. Database Fallback
    let settings = await CookieConsent.findOne().lean();

    if (!settings) {
      // Return default structure without saving if it doesn't exist
      // Only save when user actually updates it to keep DB clean, 
      // OR save default now. Let's save default for consistency.
      settings = await CookieConsent.create({
        isActive: false,
        content: '<p>This website uses cookies to ensure you get the best experience on our website.</p>'
      });
      // Convert to plain object since create returns document
      settings = settings.toObject();
      Logger.info('Initialized Default Cookie Consent Settings');
    }

    // 3. Set Cache
    await Cache.set(this.CACHE_KEY, settings, this.CACHE_TTL);
    
    return settings;
  }

  /**
   * Update Settings
   */
  async updateSettings(data, userId, userModel) {
    const settings = await CookieConsent.findOne();
    const id = settings ? settings._id : new mongoose.Types.ObjectId();

    const updated = await CookieConsent.findByIdAndUpdate(
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

export default new CookieConsentRepository();

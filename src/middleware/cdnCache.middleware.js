/**
 * CDN Cache Middleware (L3 Caching)
 * Adds Cache-Control headers for CloudFlare/CDN caching
 * 
 * Cache Strategies:
 * - Public APIs: Cache for short duration (1-5 minutes)
 * - Static data: Cache for longer (1 hour)
 * - User-specific: No caching (private)
 */

/**
 * Set cache headers for public APIs
 * @param {number} maxAge - Cache duration in seconds (default: 300 = 5 min)
 * @param {boolean} staleWhileRevalidate - Allow serving stale while revalidating
 */
export const publicCache = (maxAge = 300, staleWhileRevalidate = 60) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      return next();
    }

    // Public cache with revalidation
    // s-maxage = CDN cache duration
    // max-age = Browser cache duration (shorter)
    // stale-while-revalidate = Serve stale content while fetching fresh
    const cacheControl = `public, s-maxage=${maxAge}, max-age=60, stale-while-revalidate=${staleWhileRevalidate}`;
    
    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('Vary', 'Accept-Encoding, Accept-Language'); // Vary based on compression and language
    
    next();
  };
};

/**
 * Long-term cache for static/frequently accessed data
 * @param {number} maxAge - Cache duration in seconds (default: 3600 = 1 hour)
 */
export const longTermCache = (maxAge = 3600) => {
  return (req, res, next) => {
    if (req.method !== 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      return next();
    }

    const cacheControl = `public, s-maxage=${maxAge}, max-age=300, immutable`;
    
    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('Vary', 'Accept-Encoding');
    
    next();
  };
};

/**
 * No cache for user-specific or sensitive data
 */
export const noCache = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

/**
 * Private cache for authenticated user data (browser only, no CDN)
 * @param {number} maxAge - Cache duration in seconds (default: 60)
 */
export const privateCache = (maxAge = 60) => {
  return (req, res, next) => {
    if (req.method !== 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      return next();
    }

    // Private = Only browser caches, CDN doesn't cache
    const cacheControl = `private, max-age=${maxAge}`;
    
    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('Vary', 'Authorization, Accept-Encoding');
    
    next();
  };
};

/**
 * Conditional cache based on query params
 * - Cursor pagination: Short cache
 * - Page pagination: No cache (for admin)
 */
export const smartPublicCache = (req, res, next) => {
  if (req.method !== 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    return next();
  }

  // If cursor-based pagination, cache for 5 minutes
  if (req.query.cursor !== undefined) {
    res.setHeader('Cache-Control', 'public, s-maxage=300, max-age=60, stale-while-revalidate=60');
  } 
  // If page-based (admin), don't cache
  else if (req.query.page !== undefined) {
    res.setHeader('Cache-Control', 'no-store');
  }
  // Default: Short cache
  else {
    res.setHeader('Cache-Control', 'public, s-maxage=300, max-age=60');
  }
  
  res.setHeader('Vary', 'Accept-Encoding');
  next();
};

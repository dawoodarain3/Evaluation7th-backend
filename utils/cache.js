const redisClient = require('../config/redis');

class CacheService {
  constructor() {
    this.defaultTTL = 300; // 5 minutes default TTL
  }

  // Generate cache key from request parameters
  generateKey(prefix, params) {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((result, key) => {
        result[key] = params[key];
        return result;
      }, {});
    
    const paramString = JSON.stringify(sortedParams);
    return `${prefix}:${Buffer.from(paramString).toString('base64')}`;
  }

  // Get data from cache
  async get(key) {
    try {
      const cached = await redisClient.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  // Set data in cache (automatically expires after 5 minutes)
  async set(key, data) {
    try {
      await redisClient.setEx(key, this.defaultTTL, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }
}

module.exports = new CacheService();

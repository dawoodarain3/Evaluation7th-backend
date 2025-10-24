const redisClient = require('../config/redis');

// Rate limits - per minute for each service
const RATE_LIMITS = {
  FREE: 10,  // 10 requests per minute
  PRO: 100   // 100 requests per minute
};

// Generic rate limiting middleware
const rateLimiter = (service) => {
  return async (req, res, next) => {
    try {
      const userId = req.user._id.toString();
      const userPlan = req.user.plan;
      // Normalize plan name to uppercase for consistent lookup
      const normalizedPlan = userPlan ? userPlan.toUpperCase() : 'FREE';
      const limit = RATE_LIMITS[normalizedPlan] || RATE_LIMITS.FREE;
      
      // Create rate limit key for this user and service
      const rateLimitKey = `rate_limit:${service}:${userId}`;
      const analyticsKey = `analytics:${service}:${userId}`;
      
      // Get current request count
      const currentCount = await redisClient.get(rateLimitKey);
      const count = currentCount ? parseInt(currentCount) : 0;
      
      // Check if user has exceeded their limit
      if (count >= limit) {
        return res.status(429).json({
          success: false,
          message: `Rate limit exceeded. You have reached the maximum of ${limit} requests per minute for ${service} service.`,
          error: 'Rate limit exceeded',
          rateLimit: {
            used_requests: count,
            plan: normalizedPlan,
            total_requests: limit,
            service: service
          }
        });
      }
      
      // Increment the counter
      if (count === 0) {
        // First request in this minute, set with 60 second expiration
        await redisClient.setEx(rateLimitKey, 60, '1');
      } else {
        // Increment existing counter
        await redisClient.incr(rateLimitKey);
      }
      
      // Update analytics
      const analyticsData = await redisClient.get(analyticsKey);
      let analytics = analyticsData ? JSON.parse(analyticsData) : {
        totalRequests: 0,
        requestsThisMinute: 0,
        limit: limit,
        plan: normalizedPlan,
        service: service,
        lastRequest: null,
        requestsHistory: []
      };
      
      // Update analytics
      analytics.totalRequests += 1;
      analytics.requestsThisMinute = count + 1;
      analytics.lastRequest = new Date().toISOString();
      analytics.requestsHistory.push({
        timestamp: new Date().toISOString(),
        count: count + 1,
        limit: limit
      });
      
      // Keep only last 100 requests in history
      if (analytics.requestsHistory.length > 100) {
        analytics.requestsHistory = analytics.requestsHistory.slice(-100);
      }
      
      // Store updated analytics (expires in 24 hours)
      await redisClient.setEx(analyticsKey, 86400, JSON.stringify(analytics));
      
      // Add simplified rate limit info to request
      req.rateLimitInfo = {
        used_requests: count + 1,
        plan: normalizedPlan,
        total_requests: limit,
        service: service
      };
      
      next();
    } catch (error) {
      console.error('Rate limiter error:', error);
      // If Redis is down, allow the request but log the error
      console.warn('Rate limiter failed, allowing request due to Redis error');
      next();
    }
  };
};

module.exports = {
  rateLimiter,
  RATE_LIMITS
};

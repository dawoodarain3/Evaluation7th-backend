const redisClient = require('../config/redis');

// Analytics endpoint - provides real-time analytics data
const getCombinedData = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const userPlan = req.user.plan || 'FREE';
    const normalizedPlan = userPlan.toUpperCase();
    
    // Get rate limits for the user's plan
    const { RATE_LIMITS } = require('../middleware/rateLimiter');
    const limit = RATE_LIMITS[normalizedPlan] || RATE_LIMITS.FREE;

    // Get current usage for each service from Redis
    const services = ['weather', 'news', 'crypto'];
    const serviceData = {};

    for (const service of services) {
      try {
        const rateLimitKey = `rate_limit:${service}:${userId}`;
        const currentCount = await redisClient.get(rateLimitKey);
        const current = currentCount ? parseInt(currentCount) : 0;
        
        serviceData[service] = {
          rateLimit: {
            current: current,
            limit: limit,
            remaining: Math.max(0, limit - current),
            service: service,
            status: current >= limit ? 'limited' : 'active'
          }
        };
      } catch (error) {
        console.error(`Error fetching ${service} data:`, error);
        serviceData[service] = {
          rateLimit: {
            current: 0,
            limit: limit,
            remaining: limit,
            service: service,
            status: 'error'
          }
        };
      }
    }

    res.json({
      success: true,
      message: 'Analytics data fetched successfully',
      data: serviceData,
      user: {
        plan: normalizedPlan,
        rateLimit: limit,
        status: 'active'
      }
    });

  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to fetch analytics data',
      error: error.message
    });
  }
};

module.exports = {
  getCombinedData
};

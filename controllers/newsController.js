const axios = require('axios');
const redisClient = require('../config/redis');
const CircuitBreaker = require('../utils/circuitBreaker');
const { rateLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

const NEWS_API_KEY = '3f69a9f4918544f0bd697a85dea3257b';
const NEWS_API_BASE_URL = 'https://newsapi.org/v2';
const cacheTTL = parseInt(process.env.REDIS_TTL) || 300;


// Initialize circuit breaker for news API
const newsCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 30000, // 30 seconds
  timeout: 15000 // 15 seconds
});

// Get latest headlines - single endpoint with caching
const getNews = async (req, res) => {
  const startTime = Date.now();
  console.log('📰 NEWS PAGE LOGGER - Request received:', {
    query: req.query,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
  logger.info('News API request received', { query: req.query });
  
  try {
    const { 
      q = '', 
      sources = '', 
      category = '',
      country = 'us',
    } = req.query;

    // Build query parameters for top-headlines only
    const params = {
      apiKey: NEWS_API_KEY,
    };

    // Add optional parameters if provided
    if (q) params.q = q;
    if (sources) params.sources = sources;
    if (category) params.category = category;
    if (country) params.country = country;

    // Generate cache key
    const cacheKey = `news:${Buffer.from(JSON.stringify(params)).toString('base64')}`;
    
    // Try to get data from cache first
    const cachedData = await redisClient.get(cacheKey);
    
    if (cachedData) {
      logger.info('News data served from cache');
      const responseTime = Date.now() - startTime;
      console.log('📰 NEWS PAGE LOGGER - Cache hit response:', {
        responseTime: `${responseTime}ms`,
        cacheHit: true,
        dataLength: JSON.parse(cachedData).articles?.length || 0
      });
      await logger.api('/api/v1/news', 'GET', 200, responseTime, {
        jwt: req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null,
        cacheHit: true,
        query: req.query
      });
      return res.json({
        success: true,
        message: 'Latest headlines fetched successfully (from cache)',
        data: JSON.parse(cachedData),
        cached: true,
        rateLimit: req.rateLimitInfo || null
      });
    }

    // If not in cache, fetch from API with circuit breaker
    logger.info('News data fetched from API');
    const endpoint = `${NEWS_API_BASE_URL}/top-headlines`;
    const operation = () => axios.get(endpoint, { params });
    const response = await newsCircuitBreaker.execute(operation);

    const responseData = {
      totalResults: response.data.totalResults,
      articles: response.data.articles,
      type: 'headlines'
    };

    // Cache the response (expires after configured TTL)
    await redisClient.setEx(cacheKey, cacheTTL, JSON.stringify(responseData));

    const responseTime = Date.now() - startTime;
    console.log('📰 NEWS PAGE LOGGER - API response:', {
      responseTime: `${responseTime}ms`,
      cacheHit: false,
      dataLength: responseData.articles?.length || 0,
      totalResults: responseData.totalResults
    });
    await logger.api('/api/v1/news', 'GET', 200, responseTime, {
      jwt: req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null,
      cacheHit: false,
      query: req.query
    });
    res.json({
      success: true,
      message: 'Latest headlines fetched successfully',
      data: responseData,
      cached: false,
      rateLimit: req.rateLimitInfo || null
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('News API error', { error: error.message, responseTime });
    
    // Handle circuit breaker errors
    if (error.message.includes('Circuit breaker is OPEN')) {
      return res.status(503).json({
        success: false,
        message: 'News service is temporarily unavailable. Please try again later.',
        error: 'Service temporarily down',
        retryAfter: Math.ceil((newsCircuitBreaker.nextAttempt - Date.now()) / 1000)
      });
    }

    // Handle different types of errors
    if (error.response?.status === 400) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request parameters. Please check your query parameters.',
        error: 'Bad request'
      });
    }

    if (error.response?.status === 401) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key. Please contact support.',
        error: 'Invalid API key'
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        error: 'Rate limit exceeded'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Unable to fetch news data at the moment. Please try again later.',
      error: error.response?.data?.message || 'News service unavailable'
    });
  }
};

module.exports = {
  getNews,
  rateLimiter: rateLimiter('news')
};
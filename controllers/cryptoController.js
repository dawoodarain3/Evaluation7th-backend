const axios = require('axios');
const redisClient = require('../config/redis');
const CircuitBreaker = require('../utils/circuitBreaker');
const { rateLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

const COINGECKO_API_BASE_URL = 'https://api.coingecko.com/api/v3';
const cacheTTL = parseInt(process.env.REDIS_TTL) || 300;

// Initialize circuit breaker for crypto API
const cryptoCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 30000, // 30 seconds
  timeout: 15000 // 15 seconds
});

// Get crypto market data with caching
const getCryptoData = async (req, res) => {
  const startTime = Date.now();
  console.log('💰 CRYPTO PAGE LOGGER - Request received:', {
    query: req.query,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
  logger.info('Crypto API request received', { query: req.query });
  
  try {
    // Simple parameters - only vs_currency
    const { vs_currency = 'usd' } = req.query;

    // Build query parameters
    const params = {
      vs_currency,
    };

    // Generate cache key
    const cacheKey = `crypto:${vs_currency}`;
    
    // Try to get data from cache first
    const cachedData = await redisClient.get(cacheKey);
    
    if (cachedData) {
      logger.info('Crypto data served from cache');
      const responseTime = Date.now() - startTime;
      console.log('💰 CRYPTO PAGE LOGGER - Cache hit response:', {
        responseTime: `${responseTime}ms`,
        cacheHit: true,
        dataLength: JSON.parse(cachedData).coins?.length || 0
      });
      await logger.api('/api/v1/crypto', 'GET', 200, responseTime, {
        jwt: req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null,
        cacheHit: true,
        query: req.query
      });
      return res.json({
        success: true,
        message: 'Crypto market data fetched successfully (from cache)',
        data: JSON.parse(cachedData),
        cached: true,
        rateLimit: req.rateLimitInfo || null
      });
    }

    // If not in cache, fetch from API with circuit breaker
    logger.info('Crypto data fetched from API');
    let response;
    try {
      const operation = () => axios.get(`${COINGECKO_API_BASE_URL}/coins/markets`, { params });
      response = await cryptoCircuitBreaker.execute(operation);
    } catch (error) {
      logger.error('Crypto API error', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Unable to fetch crypto data at the moment. Please try again later.',
        error: error.response?.data?.message || 'Crypto service unavailable'
      });
    }

    const data = response.data;

    // Format the response for better readability
    const responseData = {
      coins: data.map(coin => ({
        id: coin.id,
        symbol: coin.symbol,
        name: coin.name,
        image: coin.image,
        currentPrice: coin.current_price,
        marketCap: coin.market_cap,
        marketCapRank: coin.market_cap_rank,
        fullyDilutedValuation: coin.fully_diluted_valuation,
        totalVolume: coin.total_volume,
        high24h: coin.high_24h,
        low24h: coin.low_24h,
        priceChange24h: coin.price_change_24h,
        priceChangePercentage24h: coin.price_change_percentage_24h,
        marketCapChange24h: coin.market_cap_change_24h,
        marketCapChangePercentage24h: coin.market_cap_change_percentage_24h,
        circulatingSupply: coin.circulating_supply,
        totalSupply: coin.total_supply,
        maxSupply: coin.max_supply,
        ath: coin.ath,
        athChangePercentage: coin.ath_change_percentage,
        athDate: coin.ath_date,
        atl: coin.atl,
        atlChangePercentage: coin.atl_change_percentage,
        atlDate: coin.atl_date,
        roi: coin.roi,
        lastUpdated: coin.last_updated
      }))
    };

    // Cache the response (expires after configured TTL)
    await redisClient.setEx(cacheKey, cacheTTL, JSON.stringify(responseData));

    const responseTime = Date.now() - startTime;
    console.log('💰 CRYPTO PAGE LOGGER - API response:', {
      responseTime: `${responseTime}ms`,
      cacheHit: false,
      dataLength: responseData.coins?.length || 0
    });
    await logger.api('/api/v1/crypto', 'GET', 200, responseTime, {
      jwt: req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null,
      cacheHit: false,
      query: req.query
    });
    res.json({
      success: true,
      message: 'Crypto market data fetched successfully',
      data: responseData,
      cached: false,
      rateLimit: req.rateLimitInfo || null
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Crypto API error', { error: error.message, responseTime });
    
    // Handle circuit breaker errors
    if (error.message.includes('Circuit breaker is OPEN')) {
      return res.status(503).json({
        success: false,
        message: 'Crypto service is temporarily unavailable. Please try again later.',
        error: 'Service temporarily down',
        retryAfter: Math.ceil((cryptoCircuitBreaker.nextAttempt - Date.now()) / 1000)
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

    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please try again later.',
        error: 'Rate limit exceeded'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Unable to fetch crypto data at the moment. Please try again later.',
      error: error.response?.data?.message || 'Crypto service unavailable'
    });
  }
};

module.exports = {
  getCryptoData,
  rateLimiter: rateLimiter('crypto')
};

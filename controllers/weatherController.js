const axios = require('axios');
const redisClient = require('../config/redis');
const CircuitBreaker = require('../utils/circuitBreaker');
const { rateLimiter } = require('../middleware/rateLimiter');
const logger = require('../utils/logger');

const OPENWEATHER_API_KEY = '564a688b37916ef39ec3f4eba83ee1bb';
const OPENWEATHER_API_BASE_URL = 'https://api.openweathermap.org/data/2.5';
const cacheTTL = parseInt(process.env.REDIS_TTL) || 300;

// Initialize circuit breaker for weather API
const weatherCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 30000, // 30 seconds
  timeout: 15000 // 15 seconds
});

// Get weather for a selected city
const getWeather = async (req, res) => {
  const startTime = Date.now();
  console.log('🌤️ WEATHER PAGE LOGGER - Request received:', {
    query: req.query,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
  logger.info('Weather API request received', { query: req.query });
  
  try {
    const { 
      q = '', 
      units = 'metric'
    } = req.query;

    // Validate required city parameter
    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Please provide city name (q parameter)',
        error: 'Missing required parameter: q'
      });
    }

    // Build query parameters
    const params = {
      appid: OPENWEATHER_API_KEY,
      q,
      units
    };

    // Generate cache key
    const cacheKey = `weather:${Buffer.from(JSON.stringify(params)).toString('base64')}`;
    
    // Try to get data from cache first
    const cachedData = await redisClient.get(cacheKey);
    
    if (cachedData) {
      logger.info('Weather data served from cache');
      const responseTime = Date.now() - startTime;
      const weatherData = JSON.parse(cachedData);
      console.log('🌤️ WEATHER PAGE LOGGER - Cache hit response:', {
        responseTime: `${responseTime}ms`,
        cacheHit: true,
        location: weatherData.location?.name || 'Unknown',
        temperature: weatherData.temperature?.current || 'N/A'
      });
      await logger.api('/api/v1/weather', 'GET', 200, responseTime, {
        jwt: req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null,
        cacheHit: true,
        query: req.query
      });
      return res.json({
        success: true,
        message: 'Weather data fetched successfully (from cache)',
        data: weatherData,
        cached: true,
        rateLimit: req.rateLimitInfo || null
      });
    }

    // If not in cache, fetch from API with circuit breaker
    logger.info('Weather data fetched from API');
    const operation = () => axios.get(`${OPENWEATHER_API_BASE_URL}/weather`, { params });
    const response = await weatherCircuitBreaker.execute(operation);

    const data = response.data;

    // Format the response for better readability
    const responseData = {
      location: {
        name: data.name,
        country: data.sys.country,
        coordinates: {
          lat: data.coord.lat,
          lon: data.coord.lon
        }
      },
      weather: {
        main: data.weather[0].main,
        description: data.weather[0].description,
        icon: data.weather[0].icon,
        iconUrl: `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`
      },
      temperature: {
        current: data.main.temp,
        feelsLike: data.main.feels_like,
        min: data.main.temp_min,
        max: data.main.temp_max,
        humidity: data.main.humidity,
        pressure: data.main.pressure
      },
      wind: {
        speed: data.wind.speed,
        direction: data.wind.deg
      },
      visibility: data.visibility,
      clouds: data.clouds.all,
      sunrise: new Date(data.sys.sunrise * 1000).toISOString(),
      sunset: new Date(data.sys.sunset * 1000).toISOString(),
      lastUpdated: new Date(data.dt * 1000).toISOString()
    };

    // Cache the response (expires after configured TTL)
    await redisClient.setEx(cacheKey, cacheTTL, JSON.stringify(responseData));

    const responseTime = Date.now() - startTime;
    console.log('🌤️ WEATHER PAGE LOGGER - API response:', {
      responseTime: `${responseTime}ms`,
      cacheHit: false,
      location: responseData.location?.name || 'Unknown',
      temperature: responseData.temperature?.current || 'N/A',
      weather: responseData.weather?.main || 'Unknown'
    });
    await logger.api('/api/v1/weather', 'GET', 200, responseTime, {
      jwt: req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null,
      cacheHit: false,
      query: req.query
    });
    res.json({
      success: true,
      message: 'Weather data fetched successfully',
      data: responseData,
      cached: false,
      rateLimit: req.rateLimitInfo || null
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Weather API error', { error: error.message, responseTime });
    
    // Handle circuit breaker errors
    if (error.message.includes('Circuit breaker is OPEN')) {
      return res.status(503).json({
        success: false,
        message: 'Weather service is temporarily unavailable. Please try again later.',
        error: 'Service temporarily down',
        retryAfter: Math.ceil((weatherCircuitBreaker.nextAttempt - Date.now()) / 1000)
      });
    }

    // Handle different types of errors
    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        message: 'City not found. Please check the city name and try again.',
        error: 'City not found'
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
      message: 'Unable to fetch weather data at the moment. Please try again later.',
      error: error.response?.data?.message || 'Weather service unavailable'
    });
  }
};

module.exports = {
  getWeather,
  rateLimiter: rateLimiter('weather')
};

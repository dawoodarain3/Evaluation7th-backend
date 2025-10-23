const ApiClient = require('../utils/apiClient');
const cacheService = require('../utils/cache');

const OPENWEATHER_API_KEY = '564a688b37916ef39ec3f4eba83ee1bb';
const OPENWEATHER_API_BASE_URL = 'https://api.openweathermap.org/data/2.5';

// Initialize API client for weather
const weatherApiClient = new ApiClient('Weather');

// Get weather for a selected city
const getWeather = async (req, res) => {
  try {
    const { 
      q = '', 
      units = 'metric',
      lang = 'en'
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
      units,
      lang
    };

    // Generate cache key
    const cacheKey = cacheService.generateKey('weather', params);
    
    // Try to get data from cache first
    const cachedData = await cacheService.get(cacheKey);
    
    if (cachedData) {
      console.log('Weather data served from cache');
      return res.json({
        success: true,
        message: 'Weather data fetched successfully (from cache)',
        data: cachedData,
        cached: true
      });
    }

    // If not in cache, fetch from API
    console.log('Weather data fetched from API');
    const response = await weatherApiClient.makeRequest(
      `${OPENWEATHER_API_BASE_URL}/weather`,
      params,
      'Get Weather Data'
    );

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

    // Cache the response (automatically expires after 5 minutes)
    await cacheService.set(cacheKey, responseData);

    res.json({
      success: true,
      message: 'Weather data fetched successfully',
      data: responseData,
      cached: false
    });
  } catch (error) {
    return weatherApiClient.handleError(error, res);
  }
};

module.exports = {
  getWeather
};

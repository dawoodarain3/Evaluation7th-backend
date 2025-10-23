const ApiClient = require('../utils/apiClient');
const cacheService = require('../utils/cache');

const NEWS_API_KEY = '3f69a9f4918544f0bd697a85dea3257b';
const NEWS_API_BASE_URL = 'https://newsapi.org/v2';

// Initialize API client for news
const newsApiClient = new ApiClient('News');

// Get latest headlines - single endpoint with caching
const getNews = async (req, res) => {
  try {
    const { 
      q = '', 
      sources = '', 
      category = '',
      country = 'us',
      page = 1,
      pageSize = 20
    } = req.query;

    // Build query parameters for top-headlines only
    const params = {
      apiKey: NEWS_API_KEY,
      page: parseInt(page),
      pageSize: Math.min(parseInt(pageSize), 100) // Max 100 per request
    };

    // Add optional parameters if provided
    if (q) params.q = q;
    if (sources) params.sources = sources;
    if (category) params.category = category;
    if (country) params.country = country;

    // Generate cache key
    const cacheKey = cacheService.generateKey('news', params);
    
    // Try to get data from cache first
    const cachedData = await cacheService.get(cacheKey);
    
    if (cachedData) {
      console.log('News data served from cache');
      return res.json({
        success: true,
        message: 'Latest headlines fetched successfully (from cache)',
        data: cachedData,
        cached: true
      });
    }

    // If not in cache, fetch from API
    console.log('News data fetched from API');
    const endpoint = `${NEWS_API_BASE_URL}/top-headlines`;
    const response = await newsApiClient.makeRequest(endpoint, params, 'Get Latest Headlines');

    const responseData = {
      totalResults: response.data.totalResults,
      articles: response.data.articles,
      currentPage: parseInt(page),
      pageSize: parseInt(pageSize),
      type: 'headlines'
    };

    // Cache the response (automatically expires after 5 minutes)
    await cacheService.set(cacheKey, responseData);

    res.json({
      success: true,
      message: 'Latest headlines fetched successfully',
      data: responseData,
      cached: false
    });
  } catch (error) {
    return newsApiClient.handleError(error, res);
  }
};

module.exports = {
  getNews
};
const ApiClient = require('../utils/apiClient');
const cacheService = require('../utils/cache');

const COINGECKO_API_BASE_URL = 'https://api.coingecko.com/api/v3';

// Initialize API client for crypto
const cryptoApiClient = new ApiClient('Crypto');

// Get crypto market data with pagination and caching
const getCryptoData = async (req, res) => {
  try {
    const { 
      page = 1, 
      per_page = 20, 
      vs_currency = 'usd',
      order = 'market_cap_desc',
      sparkline = false
    } = req.query;

    // Build query parameters
    const params = {
      vs_currency,
      order,
      per_page: Math.min(parseInt(per_page), 250), // Max 250 per request
      page: parseInt(page),
      sparkline: sparkline === 'true'
    };

    // Generate cache key
    const cacheKey = cacheService.generateKey('crypto', params);
    
    // Try to get data from cache first
    const cachedData = await cacheService.get(cacheKey);
    
    if (cachedData) {
      console.log('Crypto data served from cache');
      return res.json({
        success: true,
        message: 'Crypto market data fetched successfully (from cache)',
        data: cachedData,
        cached: true
      });
    }

    // If not in cache, fetch from API
    console.log('Crypto data fetched from API');
    const response = await cryptoApiClient.makeRequest(
      `${COINGECKO_API_BASE_URL}/coins/markets`,
      params,
      'Get Crypto Market Data'
    );

    const data = response.data;

    // Format the response for better readability
    const responseData = {
      currentPage: parseInt(page),
      perPage: parseInt(per_page),
      totalResults: data.length,
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
      })),
      rawData: data // Include raw data for advanced usage
    };

    // Cache the response (automatically expires after 5 minutes)
    await cacheService.set(cacheKey, responseData);

    res.json({
      success: true,
      message: 'Crypto market data fetched successfully',
      data: responseData,
      cached: false
    });
  } catch (error) {
    return cryptoApiClient.handleError(error, res);
  }
};

module.exports = {
  getCryptoData
};

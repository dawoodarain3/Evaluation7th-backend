const express = require('express');
const router = express.Router();
const authRoutes = require('./auth');
const { getNews } = require('../controllers/newsController');
const { getCryptoData } = require('../controllers/cryptoController');
const { getWeather } = require('../controllers/weatherController');
const { getCombinedData } = require('../controllers/combinedController');
const { rateLimiter } = require('../middleware/rateLimiter');
const auth = require('../middleware/auth');

// API v1 routes
router.use('/v1/auth', authRoutes);

// News endpoint with rate limiting
router.get('/v1/news', auth, rateLimiter('news'), getNews);

// Crypto endpoint with rate limiting
router.get('/v1/crypto', auth, rateLimiter('crypto'), getCryptoData);

// Weather endpoint with rate limiting
router.get('/v1/weather', auth, rateLimiter('weather'), getWeather);

// Analytics endpoint - weather, news, and crypto in one request with rate limiting
router.get('/v1/analytics', auth, getCombinedData);

module.exports = router;

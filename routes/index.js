const express = require('express');
const router = express.Router();
const authRoutes = require('./auth');
const { getNews } = require('../controllers/newsController');
const { getCryptoData } = require('../controllers/cryptoController');
const { getWeather } = require('../controllers/weatherController');
const auth = require('../middleware/auth');

// API v1 routes
router.use('/v1/auth', authRoutes);

// News endpoint - direct implementation
// GET /api/v1/news?q=apple&category=technology&country=us&page=1&pageSize=20
router.get('/v1/news', getNews);

// Crypto endpoint - direct implementation
// GET /api/v1/crypto - Get global crypto market data
router.get('/v1/crypto', auth, getCryptoData);

// Weather endpoint - direct implementation
// GET /api/v1/weather - Show weather for a selected city
router.get('/v1/weather', getWeather);

module.exports = router;
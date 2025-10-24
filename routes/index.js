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
router.get('/v1/news',auth, getNews);

// Crypto endpoint - direct implementation
router.get('/v1/crypto',auth, getCryptoData);

// Weather endpoint - direct implementation
router.get('/v1/weather',auth, getWeather);

module.exports = router;
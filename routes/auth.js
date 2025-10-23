const express = require('express');
const router = express.Router();
const { signup, login, upgradePlan } = require('../controllers/authController');
const auth = require('../middleware/auth');

router.post('/signup', signup);
router.post('/login', login);

router.put('/upgrade-plan', auth, upgradePlan);

module.exports = router;

const express = require('express');
const router = express.Router();
const startupController = require('../controllers/startupController');

// App launch decision endpoint.
router.post('/startup', startupController.appStartup);

// Enter-number step endpoint.
router.post('/enter-number', startupController.enterNumber);

// Store OTP endpoint.
router.post('/store-otp', startupController.storeOTP);

// Verify OTP endpoint.
router.post('/verify-otp', startupController.verifyOTP);

module.exports = router;

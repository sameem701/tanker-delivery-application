const express = require('express');
const router = express.Router();
const startupController = require('../controllers/startupController');
const { createPhoneRateLimiter } = require('../middleware/phoneRateLimiter');

const otpStoreRateLimiter = createPhoneRateLimiter({
	windowMs: 15 * 60 * 1000,
	max: 20,
	keyName: 'store-otp',
	message: 'Too many OTP store requests. Please try again later.'
});

const otpVerifyRateLimiter = createPhoneRateLimiter({
	windowMs: 15 * 60 * 1000,
	max: 40,
	keyName: 'verify-otp',
	message: 'Too many OTP verify requests. Please try again later.'
});

// App launch decision endpoint.
router.post('/startup', startupController.appStartup);

// Enter-number step endpoint.
router.post('/enter-number', startupController.enterNumber);

// Store OTP endpoint.
router.post('/store-otp', otpStoreRateLimiter, startupController.storeOTP);

// Verify OTP endpoint.
router.post('/verify-otp', otpVerifyRateLimiter, startupController.verifyOTP);

module.exports = router;

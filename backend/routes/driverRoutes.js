const express = require('express');
const router = express.Router();
const startupController = require('../controllers/startupController');

// Driver profile completion endpoint.
router.post('/enter-details', startupController.enterDetailsDriver);

module.exports = router;

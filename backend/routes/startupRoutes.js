const express = require('express');
const router = express.Router();
const startupController = require('../controllers/startupController');

// App launch decision endpoint.
router.post('/startup', startupController.appStartup);

module.exports = router;

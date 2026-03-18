const express = require('express');
const router = express.Router();
const startupController = require('../controllers/startupController');

// Supplier profile completion endpoint.
router.post('/enter-details', startupController.enterDetailsSupplier);

module.exports = router;

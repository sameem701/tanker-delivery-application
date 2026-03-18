const express = require('express');
const router = express.Router();
const startupController = require('../controllers/startupController');

// Customer profile completion endpoint.
router.post('/enter-details', startupController.enterDetailsCustomer);

module.exports = router;

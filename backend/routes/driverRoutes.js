const express = require('express');
const router = express.Router();
const startupController = require('../controllers/startupController');

// Driver profile completion endpoint.
router.post('/enter-details', startupController.enterDetailsDriver);
router.post('/orders/:orderId/accept', startupController.acceptAssignedOrderForDriver);
router.post('/orders/:orderId/reject', startupController.rejectAssignedOrderForDriver);

module.exports = router;

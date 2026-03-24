const express = require('express');
const router = express.Router();
const startupController = require('../controllers/startupController');

// Driver profile completion endpoint.
router.post('/enter-details', startupController.enterDetailsDriver);
router.post('/orders/:orderId/accept', startupController.acceptAssignedOrderForDriver);
router.post('/orders/:orderId/reject', startupController.rejectAssignedOrderForDriver);
router.post('/orders/:orderId/start-ride', startupController.startRideForDriver);
router.post('/orders/:orderId/reached', startupController.markOrderReachedForDriver);
router.post('/orders/:orderId/finish', startupController.finishOrderForDriver);

module.exports = router;

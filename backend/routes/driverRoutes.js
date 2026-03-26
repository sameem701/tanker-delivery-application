const express = require('express');
const router = express.Router();
const startupController = require('../controllers/startupController');

// Driver profile completion endpoint.
router.post('/enter-details', startupController.enterDetailsDriver);
router.get('/orders/:orderId/details', startupController.getOrderDetailsDriver);
router.post('/orders/:orderId/accept', startupController.acceptAssignedOrderForDriver);
router.post('/orders/:orderId/reject', startupController.rejectAssignedOrderForDriver);
router.post('/orders/:orderId/start-ride', startupController.startRideForDriver);
router.post('/orders/:orderId/reached', startupController.markOrderReachedForDriver);

// Cancel order (driver)
router.post('/orders/:orderId/cancel', startupController.cancelOrderDriver);
router.post('/orders/:orderId/finish', startupController.finishOrderForDriver);
router.get('/history', startupController.viewPastOrders);
router.get('/history/:orderId', startupController.viewPastOrderDetailsDriver);

module.exports = router;

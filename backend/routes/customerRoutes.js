const express = require('express');
const router = express.Router();
const startupController = require('../controllers/startupController');

// Customer profile completion endpoint.
router.post('/enter-details', startupController.enterDetailsCustomer);

// Customer dashboard: order creation and pricing options.
router.get('/orders/quantities', startupController.getCustomerQuantityPricing);
router.post('/orders/start', startupController.startCustomerOrder);
router.get('/orders/:orderId/bids', startupController.listBidsForCustomerOpenOrder);
router.patch('/orders/:orderId/bid', startupController.updateCustomerOpenOrderBid);
router.post('/orders/:orderId/accept-bid', startupController.acceptSupplierBidForCustomer);

// Cancel order (customer)
router.get('/orders/:orderId/open', startupController.orderOpen);
router.get('/orders/:orderId/details', startupController.getOrderDetailsCustomer);
router.post('/orders/:orderId/cancel', startupController.cancelOrderCustomer);
router.post('/orders/:orderId/rating', startupController.submitOrderRatingForCustomer);
router.get('/history', startupController.viewPastOrders);
router.get('/history/:orderId', startupController.viewPastOrderDetailsCustomer);

module.exports = router;

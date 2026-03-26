const express = require('express');
const router = express.Router();
const startupController = require('../controllers/startupController');

// Customer profile completion endpoint.
router.post('/enter-details', startupController.enterDetailsCustomer);

// Customer dashboard: order creation and pricing options.
router.get('/orders/quantities', startupController.getCustomerQuantityPricing);
router.post('/orders/start', startupController.startCustomerOrder);
router.get('/orders/:orderId/open', startupController.orderOpen);
router.get('/orders/:orderId/bids', startupController.listBidsForCustomerOpenOrder);
router.patch('/orders/:orderId/bid', startupController.updateCustomerOpenOrderBid);
router.post('/orders/:orderId/accept-bid', startupController.acceptSupplierBidForCustomer);
router.get('/orders/:orderId/details', startupController.getOrderDetailsCustomer);

// Cancel order
router.post('/orders/:orderId/cancel', startupController.cancelOrderCustomer);

// Submit rating
router.post('/orders/:orderId/rating', startupController.submitOrderRatingForCustomer);

// Viewing past orders
router.get('/history', startupController.viewPastOrders);
router.get('/history/:orderId', startupController.viewPastOrderDetailsCustomer);

//Logout
router.post('/logout', startupController.logoutCustomer);
router.delete('/', startupController.deleteCustomerAccount);

module.exports = router;

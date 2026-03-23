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

module.exports = router;

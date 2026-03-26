const express = require('express');
const router = express.Router();
const startupController = require('../controllers/startupController');

// Supplier profile completion endpoint.
router.post('/enter-details', startupController.enterDetailsSupplier);

// Supplier dashboard: driver roster management.
router.post('/drivers/add', startupController.addSupplierDriver);
router.get('/drivers', startupController.listSupplierDrivers);
router.delete('/drivers/remove', startupController.removeSupplierDriver);
router.get('/supplierdriverready', startupController.getSupplierDriverReadiness);

// Supplier marketplace: available orders, details, and bidding.
router.get('/orders/available', startupController.listAvailableOrdersForSupplier);
router.get('/orders/available/:orderId', startupController.viewOneAvailableOrderSupplier);
router.post('/orders/:orderId/bids', startupController.placeSupplierBid);

// Supplier dashboard: active assigned orders.
router.get('/orders/active', startupController.listActiveOrdersSupplier);
router.get('/orders/active/:orderId', startupController.viewOneActiveOrderSupplier);
router.get('/orders/active/:orderId/drivers', startupController.listAssignableDriversForSupplierOrder);

// Cancel order (supplier)
router.post('/orders/active/:orderId/cancel', startupController.cancelOrderSupplier);
router.post('/orders/active/:orderId/assign-driver', startupController.assignDriverForSupplierOrder);
router.get('/history', startupController.viewPastOrders);
router.get('/history/:orderId', startupController.viewPastOrderDetailsSupplier);

module.exports = router;

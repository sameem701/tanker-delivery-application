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
router.get('/orders/available/:orderId', startupController.getAvailableOrderDetailsForSupplier);
router.post('/orders/:orderId/bids', startupController.placeSupplierBid);

// Supplier dashboard: active assigned orders.
router.get('/orders/active', startupController.listActiveOrdersForSupplier);
router.get('/orders/active/:orderId', startupController.getActiveOrderDetailsForSupplier);
router.get('/orders/active/:orderId/drivers', startupController.listAssignableDriversForSupplierOrder);
router.post('/orders/active/:orderId/assign-driver', startupController.assignDriverForSupplierOrder);

module.exports = router;

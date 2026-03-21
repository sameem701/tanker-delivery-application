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

module.exports = router;

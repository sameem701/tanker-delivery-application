const express = require('express');
const router = express.Router();
const { authMiddleware, roleCheck } = require('../middleware/authMiddleware');
const driverController = require('../controllers/driverController');

// @route   GET /api/drivers
// @desc    Get all drivers
// @access  Private
router.get('/', authMiddleware, driverController.getAllDrivers);

// @route   GET /api/drivers/:id
// @desc    Get driver by ID
// @access  Private
router.get('/:id', authMiddleware, driverController.getDriverById);

// @route   PUT /api/drivers/:id
// @desc    Update driver
// @access  Private
router.put('/:id', authMiddleware, driverController.updateDriver);

// @route   PUT /api/drivers/:id/status
// @desc    Update driver status
// @access  Private
router.put('/:id/status', authMiddleware, driverController.updateDriverStatus);

module.exports = router;

const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authMiddleware, roleCheck } = require('../middleware/authMiddleware');
const supplierController = require('../controllers/supplierController');

// @route   GET /api/suppliers/check-drivers
// @desc    Check if supplier has any drivers
// @access  Private (Supplier)
router.get('/check-drivers', authMiddleware, roleCheck(['supplier']), supplierController.checkHasDrivers);

// @route   GET /api/suppliers/check-active-drivers
// @desc    Check if supplier has active drivers
// @access  Private (Supplier)
router.get('/check-active-drivers', authMiddleware, roleCheck(['supplier']), supplierController.checkHasActiveDrivers);

// @route   GET /api/suppliers/available-orders
// @desc    View all available open orders
// @access  Private (Supplier)
router.get('/available-orders', authMiddleware, roleCheck(['supplier']), supplierController.viewAvailableOrders);

// @route   GET /api/suppliers/order-details/:order_id
// @desc    View specific order details (for bidding)
// @access  Private (Supplier)
router.get('/order-details/:order_id', authMiddleware, roleCheck(['supplier']), supplierController.viewOrderDetails);

// @route   POST /api/suppliers/send-bid
// @desc    Send bid for an order
// @access  Private (Supplier)
router.post('/send-bid', authMiddleware, roleCheck(['supplier']), [
  body('order_id').isInt().withMessage('Order ID is required'),
  body('bid_price').isFloat({ min: 0 }).withMessage('Bid price must be a positive number')
], supplierController.sendBid);

// @route   GET /api/suppliers/available-drivers/:order_id
// @desc    Get available drivers for supplier with order status
// @access  Private (Supplier)
router.get('/available-drivers/:order_id', authMiddleware, roleCheck(['supplier']), supplierController.getAvailableDrivers);

// @route   POST /api/suppliers/assign-driver
// @desc    Assign driver to order
// @access  Private (Supplier)
router.post('/assign-driver', authMiddleware, roleCheck(['supplier']), [
  body('order_id').isInt().withMessage('Order ID is required'),
  body('driver_id').isInt().withMessage('Driver ID is required')
], supplierController.assignDriver);

// @route   GET /api/suppliers/supplier-order-details/:order_id
// @desc    Get order details for supplier
// @access  Private (Supplier)
router.get('/supplier-order-details/:order_id', authMiddleware, roleCheck(['supplier']), supplierController.getOrderDetails);

// @route   GET /api/suppliers/active-orders
// @desc    Get active orders for supplier
// @access  Private (Supplier)
router.get('/active-orders', authMiddleware, roleCheck(['supplier']), supplierController.getActiveOrders);

// @route   POST /api/suppliers/cancel-order
// @desc    Cancel order
// @access  Private (Supplier)
router.post('/cancel-order', authMiddleware, roleCheck(['supplier']), [
  body('order_id').isInt().withMessage('Order ID is required'),
  body('reason').optional()
], supplierController.cancelOrder);

// @route   GET /api/suppliers/past-orders
// @desc    View past orders
// @access  Private (Supplier)
router.get('/past-orders', authMiddleware, roleCheck(['supplier']), supplierController.viewPastOrders);

// @route   GET /api/suppliers/past-order-details/:order_id
// @desc    View past order details
// @access  Private (Supplier)
router.get('/past-order-details/:order_id', authMiddleware, roleCheck(['supplier']), supplierController.viewPastOrderDetails);

// @route   POST /api/suppliers/add-driver-phones
// @desc    Add driver phone numbers to supplier_drivers table
// @access  Private (Supplier)
router.post('/add-driver-phones', authMiddleware, roleCheck(['supplier']), [
  body('driver_phones').isArray({ min: 1 }).withMessage('At least one driver phone required')
], supplierController.addDriverPhones);

module.exports = router;

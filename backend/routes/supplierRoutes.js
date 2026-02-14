const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const supplierController = require('../controllers/supplierController');

// @route   GET /api/suppliers/check-drivers/:supplier_id
// @desc    Check if supplier has any drivers
// @access  Public
router.get('/check-drivers/:supplier_id', supplierController.checkHasDrivers);

// @route   GET /api/suppliers/check-active-drivers/:supplier_id
// @desc    Check if supplier has active drivers
// @access  Public
router.get('/check-active-drivers/:supplier_id', supplierController.checkHasActiveDrivers);

// @route   GET /api/suppliers/available-orders
// @desc    View all available open orders
// @access  Public
router.get('/available-orders', supplierController.viewAvailableOrders);

// @route   GET /api/suppliers/order-details/:order_id
// @desc    View specific order details (for bidding)
// @access  Public
router.get('/order-details/:order_id', supplierController.viewOrderDetails);

// @route   POST /api/suppliers/send-bid
// @desc    Send bid for an order
// @access  Public
router.post('/send-bid', [
  body('order_id').isInt().withMessage('Order ID is required'),
  body('supplier_id').isInt().withMessage('Supplier ID is required'),
  body('bid_price').isFloat({ min: 0 }).withMessage('Bid price must be a positive number')
], supplierController.sendBid);

// @route   GET /api/suppliers/available-drivers/:supplier_id/:order_id
// @desc    Get available drivers for supplier with order status
// @access  Public
router.get('/available-drivers/:supplier_id/:order_id', supplierController.getAvailableDrivers);

// @route   POST /api/suppliers/assign-driver
// @desc    Assign driver to order
// @access  Public
router.post('/assign-driver', [
  body('order_id').isInt().withMessage('Order ID is required'),
  body('supplier_id').isInt().withMessage('Supplier ID is required'),
  body('driver_id').isInt().withMessage('Driver ID is required')
], supplierController.assignDriver);

// @route   GET /api/suppliers/supplier-order-details/:supplier_id/:order_id
// @desc    Get order details for supplier
// @access  Public
router.get('/supplier-order-details/:supplier_id/:order_id', supplierController.getOrderDetails);

// @route   GET /api/suppliers/active-orders/:supplier_id
// @desc    Get active orders for supplier
// @access  Public
router.get('/active-orders/:supplier_id', supplierController.getActiveOrders);

// @route   POST /api/suppliers/cancel-order
// @desc    Cancel order
// @access  Public
router.post('/cancel-order', [
  body('order_id').isInt().withMessage('Order ID is required'),
  body('user_id').isInt().withMessage('User ID is required'),
  body('reason').optional()
], supplierController.cancelOrder);

// @route   GET /api/suppliers/past-orders/:user_id
// @desc    View past orders
// @access  Public
router.get('/past-orders/:user_id', supplierController.viewPastOrders);

// @route   GET /api/suppliers/past-order-details/:supplier_id/:order_id
// @desc    View past order details
// @access  Public
router.get('/past-order-details/:supplier_id/:order_id', supplierController.viewPastOrderDetails);

// @route   POST /api/suppliers/add-driver-phones
// @desc    Add driver phone numbers to supplier_drivers table
// @access  Public
router.post('/add-driver-phones', [
  body('supplier_id').isInt().withMessage('Supplier ID is required'),
  body('driver_phones').isArray({ min: 1 }).withMessage('At least one driver phone required')
], supplierController.addDriverPhones);

module.exports = router;

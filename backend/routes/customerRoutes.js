const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const customerController = require('../controllers/customerController');

// @route   POST /api/customers/start-order
// @desc    Start a new order
// @access  Public
router.post('/start-order', [
  body('p_customer_id').isInt().withMessage('Customer ID is required'),
  body('p_delivery_address').notEmpty().withMessage('Delivery address is required'),
  body('p_special_instructions').optional(),
  body('p_quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1')
], customerController.startOrder);

// @route   POST /api/customers/accept-bid
// @desc    Accept a bid for an order
// @access  Public
router.post('/accept-bid', [
  body('order_id').isInt().withMessage('Order ID is required'),
  body('customer_id').isInt().withMessage('Customer ID is required'),
  body('supplier_id').isInt().withMessage('Supplier ID is required')
], customerController.acceptBid);

// @route   GET /api/customers/order-details/:user_id/:order_id
// @desc    Get order details for customer
// @access  Public
router.get('/order-details/:user_id/:order_id', customerController.getOrderDetails);

// @route   POST /api/customers/submit-rating
// @desc    Submit rating for completed order
// @access  Public
router.post('/submit-rating', [
  body('order_id').isInt().withMessage('Order ID is required'),
  body('customer_id').isInt().withMessage('Customer ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('feedback').optional()
], customerController.submitRating);

// @route   POST /api/customers/cancel-order
// @desc    Cancel an order
// @access  Public
router.post('/cancel-order', [
  body('order_id').isInt().withMessage('Order ID is required'),
  body('user_id').isInt().withMessage('User ID is required'),
  body('reason').optional()
], customerController.cancelOrder);

// @route   GET /api/customers/past-orders/:user_id
// @desc    View past orders
// @access  Public
router.get('/past-orders/:user_id', customerController.viewPastOrders);

// @route   GET /api/customers/past-order-details/:user_id/:order_id
// @desc    View past order details
// @access  Public
router.get('/past-order-details/:user_id/:order_id', customerController.viewPastOrderDetails);

module.exports = router;

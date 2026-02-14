const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authMiddleware, roleCheck } = require('../middleware/authMiddleware');
const customerController = require('../controllers/customerController');

// @route   POST /api/customers/start-order
// @desc    Start a new order
// @access  Private (Customer)
router.post('/start-order', authMiddleware, roleCheck(['customer']), [
  body('delivery_location').notEmpty().withMessage('Delivery address is required'),
  body('requested_capacity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('customer_bid_price').isFloat({ min: 0 }).withMessage('Valid bid price required')
], customerController.startOrder);

// @route   POST /api/customers/accept-bid
// @desc    Accept a bid for an order
// @access  Private (Customer)
router.post('/accept-bid', authMiddleware, roleCheck(['customer']), [
  body('bid_id').isInt().withMessage('Bid ID is required')
], customerController.acceptBid);

// @route   GET /api/customers/order-details/:order_id
// @desc    Get order details for customer
// @access  Private (Customer)
router.get('/order-details/:order_id', authMiddleware, roleCheck(['customer']), customerController.getOrderDetails);

// @route   POST /api/customers/submit-rating
// @desc    Submit rating for completed order
// @access  Private (Customer)
router.post('/submit-rating', authMiddleware, roleCheck(['customer']), [
  body('order_id').isInt().withMessage('Order ID is required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('feedback').optional()
], customerController.submitRating);

// @route   POST /api/customers/cancel-order
// @desc    Cancel an order
// @access  Private (Customer)
router.post('/cancel-order', authMiddleware, roleCheck(['customer']), [
  body('order_id').isInt().withMessage('Order ID is required'),
  body('reason').optional()
], customerController.cancelOrder);

// @route   GET /api/customers/past-orders
// @desc    View past orders
// @access  Private (Customer)
router.get('/past-orders', authMiddleware, roleCheck(['customer']), customerController.viewPastOrders);

// @route   GET /api/customers/past-order-details/:order_id
// @desc    View past order details
// @access  Private (Customer)
router.get('/past-order-details/:order_id', authMiddleware, roleCheck(['customer']), customerController.viewPastOrderDetails);

module.exports = router;

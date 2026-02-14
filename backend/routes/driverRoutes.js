const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authMiddleware, roleCheck } = require('../middleware/authMiddleware');
const driverController = require('../controllers/driverController');

// @route   POST /api/drivers/confirm-order
// @desc    Confirm order (race-safe)
// @access  Private (Driver)
router.post('/confirm-order', authMiddleware, roleCheck(['driver']), [
  body('order_id').isInt().withMessage('Order ID is required')
], driverController.confirmOrder);

// @route   POST /api/drivers/reject-order
// @desc    Reject assigned order
// @access  Private (Driver)
router.post('/reject-order', authMiddleware, roleCheck(['driver']), [
  body('order_id').isInt().withMessage('Order ID is required'),
  body('reason').optional()
], driverController.rejectOrder);

// @route   GET /api/drivers/order-details/:order_id
// @desc    Get order details for driver
// @access  Private (Driver)
router.get('/order-details/:order_id', authMiddleware, roleCheck(['driver']), driverController.getOrderDetails);

// @route   POST /api/drivers/start-ride
// @desc    Start ride for order
// @access  Private (Driver)
router.post('/start-ride', authMiddleware, roleCheck(['driver']), [
  body('order_id').isInt().withMessage('Order ID is required')
], driverController.startRide);

// @route   POST /api/drivers/mark-reached
// @desc    Mark order as reached destination
// @access  Private (Driver)
router.post('/mark-reached', authMiddleware, roleCheck(['driver']), [
  body('order_id').isInt().withMessage('Order ID is required')
], driverController.markReached);

// @route   POST /api/drivers/finish-order
// @desc    Finish order
// @access  Private (Driver)
router.post('/finish-order', authMiddleware, roleCheck(['driver']), [
  body('order_id').isInt().withMessage('Order ID is required')
], driverController.finishOrder);

// @route   POST /api/drivers/cancel-order
// @desc    Cancel order
// @access  Private (Driver)
router.post('/cancel-order', authMiddleware, roleCheck(['driver']), [
  body('order_id').isInt().withMessage('Order ID is required'),
  body('reason').optional()
], driverController.cancelOrder);

// @route   GET /api/drivers/past-orders
// @desc    View past orders
// @access  Private (Driver)
router.get('/past-orders', authMiddleware, roleCheck(['driver']), driverController.viewPastOrders);

// @route   GET /api/drivers/past-order-details/:order_id
// @desc    View past order details
// @access  Private (Driver)
router.get('/past-order-details/:order_id', authMiddleware, roleCheck(['driver']), driverController.viewPastOrderDetails);

module.exports = router;

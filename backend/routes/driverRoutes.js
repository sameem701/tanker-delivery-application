const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const driverController = require('../controllers/driverController');

// @route   POST /api/drivers/confirm-order
// @desc    Confirm order (race-safe)
// @access  Public
router.post('/confirm-order', [
  body('order_id').isInt().withMessage('Order ID is required'),
  body('driver_id').isInt().withMessage('Driver ID is required')
], driverController.confirmOrder);

// @route   POST /api/drivers/reject-order
// @desc    Reject assigned order
// @access  Public
router.post('/reject-order', [
  body('order_id').isInt().withMessage('Order ID is required'),
  body('driver_id').isInt().withMessage('Driver ID is required'),
  body('reason').optional()
], driverController.rejectOrder);

// @route   GET /api/drivers/order-details/:driver_id/:order_id
// @desc    Get order details for driver
// @access  Public
router.get('/order-details/:driver_id/:order_id', driverController.getOrderDetails);

// @route   POST /api/drivers/start-ride
// @desc    Start ride for order
// @access  Public
router.post('/start-ride', [
  body('order_id').isInt().withMessage('Order ID is required'),
  body('driver_id').isInt().withMessage('Driver ID is required')
], driverController.startRide);

// @route   POST /api/drivers/mark-reached
// @desc    Mark order as reached destination
// @access  Public
router.post('/mark-reached', [
  body('order_id').isInt().withMessage('Order ID is required'),
  body('driver_id').isInt().withMessage('Driver ID is required')
], driverController.markReached);

// @route   POST /api/drivers/finish-order
// @desc    Finish order
// @access  Public
router.post('/finish-order', [
  body('order_id').isInt().withMessage('Order ID is required'),
  body('driver_id').isInt().withMessage('Driver ID is required')
], driverController.finishOrder);

// @route   POST /api/drivers/cancel-order
// @desc    Cancel order
// @access  Public
router.post('/cancel-order', [
  body('order_id').isInt().withMessage('Order ID is required'),
  body('user_id').isInt().withMessage('User ID is required'),
  body('reason').optional()
], driverController.cancelOrder);

// @route   GET /api/drivers/past-orders/:user_id
// @desc    View past orders
// @access  Public
router.get('/past-orders/:user_id', driverController.viewPastOrders);

// @route   GET /api/drivers/past-order-details/:driver_id/:order_id
// @desc    View past order details
// @access  Public
router.get('/past-order-details/:driver_id/:order_id', driverController.viewPastOrderDetails);

module.exports = router;

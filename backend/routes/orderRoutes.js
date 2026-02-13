const express = require('express');
const router = express.Router();
const { authMiddleware, roleCheck } = require('../middleware/authMiddleware');
const orderController = require('../controllers/orderController');

// @route   POST /api/orders
// @desc    Create a new order
// @access  Private (Customer)
router.post('/', authMiddleware, orderController.createOrder);

// @route   GET /api/orders
// @desc    Get all orders
// @access  Private
router.get('/', authMiddleware, orderController.getAllOrders);

// @route   GET /api/orders/:id
// @desc    Get order by ID
// @access  Private
router.get('/:id', authMiddleware, orderController.getOrderById);

// @route   PUT /api/orders/:id
// @desc    Update order
// @access  Private
router.put('/:id', authMiddleware, orderController.updateOrder);

// @route   PUT /api/orders/:id/status
// @desc    Update order status
// @access  Private
router.put('/:id/status', authMiddleware, orderController.updateOrderStatus);

// @route   DELETE /api/orders/:id
// @desc    Cancel order
// @access  Private
router.delete('/:id', authMiddleware, orderController.cancelOrder);

module.exports = router;

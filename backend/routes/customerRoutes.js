const express = require('express');
const router = express.Router();
const { authMiddleware, roleCheck } = require('../middleware/authMiddleware');
const customerController = require('../controllers/customerController');

// @route   GET /api/customers
// @desc    Get all customers
// @access  Private (Admin)
router.get('/', authMiddleware, customerController.getAllCustomers);

// @route   GET /api/customers/:id
// @desc    Get customer by ID
// @access  Private
router.get('/:id', authMiddleware, customerController.getCustomerById);

// @route   PUT /api/customers/:id
// @desc    Update customer
// @access  Private
router.put('/:id', authMiddleware, customerController.updateCustomer);

// @route   DELETE /api/customers/:id
// @desc    Delete customer
// @access  Private (Admin)
router.delete('/:id', authMiddleware, customerController.deleteCustomer);

module.exports = router;

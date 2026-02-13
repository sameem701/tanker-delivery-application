const express = require('express');
const router = express.Router();
const { authMiddleware, roleCheck } = require('../middleware/authMiddleware');
const supplierController = require('../controllers/supplierController');

// @route   GET /api/suppliers
// @desc    Get all suppliers
// @access  Private
router.get('/', authMiddleware, supplierController.getAllSuppliers);

// @route   GET /api/suppliers/:id
// @desc    Get supplier by ID
// @access  Private
router.get('/:id', authMiddleware, supplierController.getSupplierById);

// @route   PUT /api/suppliers/:id
// @desc    Update supplier
// @access  Private
router.put('/:id', authMiddleware, supplierController.updateSupplier);

module.exports = router;

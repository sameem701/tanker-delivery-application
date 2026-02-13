const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
  body('phone').isMobilePhone().withMessage('Please enter a valid phone number'),
  body('name').notEmpty().withMessage('Name is required'),
  body('role').isIn(['customer', 'driver', 'supplier']).withMessage('Invalid role')
], authController.register);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('phone').isMobilePhone().withMessage('Please enter a valid phone number')
], authController.login);

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', authController.logout);

module.exports = router;

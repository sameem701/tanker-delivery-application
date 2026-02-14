const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');

// @route   POST /api/auth/check-phone
// @desc    Check if phone number exists in system
// @access  Public
router.post('/check-phone', [
  body('phone_number').isMobilePhone().withMessage('Please enter a valid phone number')
], authController.checkPhoneNumber);

// @route   POST /api/auth/store-otp
// @desc    Store OTP for phone number
// @access  Public
router.post('/store-otp', [
  body('phone_number').isMobilePhone().withMessage('Please enter a valid phone number'),
  body('otp').isLength({ min: 4, max: 6 }).withMessage('OTP must be 4-6 digits')
], authController.storeOTP);

// @route   POST /api/auth/verify-otp
// @desc    Verify OTP and create/activate user session
// @access  Public
router.post('/verify-otp', [
  body('phone_number').isMobilePhone().withMessage('Please enter a valid phone number'),
  body('otp').notEmpty().withMessage('OTP is required')
], authController.verifyOTP);

// @route   POST /api/auth/check-session
// @desc    Check if session token is valid
// @access  Public
router.post('/check-session', [
  body('session_token').notEmpty().withMessage('Session token is required')
], authController.checkSession);

// @route   POST /api/auth/enter-details-customer
// @desc    Enter additional details for customer
// @access  Public
router.post('/enter-details-customer', [
  body('user_id').isInt().withMessage('User ID is required'),
  body('name').notEmpty().withMessage('Name is required'),
  body('address').notEmpty().withMessage('Address is required')
], authController.enterCustomerDetails);

// @route   POST /api/auth/enter-details-driver
// @desc    Enter additional details for driver
// @access  Public
router.post('/enter-details-driver', [
  body('user_id').isInt().withMessage('User ID is required'),
  body('name').notEmpty().withMessage('Name is required'),
  body('supplier_user_id').isInt().withMessage('Supplier ID is required'),
  body('vehicle_registration').notEmpty().withMessage('Vehicle registration is required')
], authController.enterDriverDetails);

// @route   POST /api/auth/enter-details-supplier
// @desc    Enter additional details for supplier
// @access  Public
router.post('/enter-details-supplier', [
  body('user_id').isInt().withMessage('User ID is required'),
  body('name').notEmpty().withMessage('Name is required'),
  body('yard_location').notEmpty().withMessage('Yard location is required'),
  body('business_contact').isMobilePhone().withMessage('Valid business contact is required')
], authController.enterSupplierDetails);

// @route   POST /api/auth/upload-cnic
// @desc    Upload CNIC images for supplier
// @access  Public
router.post('/upload-cnic', [
  body('user_id').isInt().withMessage('User ID is required'),
  body('cnic_front_path').notEmpty().withMessage('CNIC front path is required'),
  body('cnic_back_path').notEmpty().withMessage('CNIC back path is required')
], authController.uploadCNIC);

module.exports = router;

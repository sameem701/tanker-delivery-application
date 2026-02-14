const { query } = require('../config/database');
const { validationResult } = require('express-validator');
const { sendSuccess, sendError, sendValidationError } = require('../utils/responseHelper');

// @desc    Check if phone number exists (Step 1: Phone entry)
const checkPhoneNumber = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, errors.array());
    }

    const { phone } = req.body;

    // Call phone_number_exists function
    const result = await query(
      'SELECT phone_number_exists($1) as result',
      [phone]
    );

    const response = result.rows[0].result;

    return sendSuccess(res, 200, 'Phone number checked', response);

  } catch (error) {
    console.error('Check phone number error:', error);
    return sendError(res, 500, 'Error checking phone number', error.message);
  }
};

// @desc    Store OTP (Step 2: After sending OTP via Twilio/etc)
const storeOTP = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, errors.array());
    }

    const { phone, otp } = req.body;

    // Call store_otp function
    const result = await query(
      'SELECT store_otp($1, $2) as result',
      [phone, otp]
    );

    const response = result.rows[0].result;

    if (!response.success) {
      return sendError(res, 400, response.message);
    }

    return sendSuccess(res, 200, response.message);

  } catch (error) {
    console.error('Store OTP error:', error);
    return sendError(res, 500, 'Error storing OTP', error.message);
  }
};

// @desc    Verify OTP and activate user (Step 3: OTP verification)
const verifyOTP = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, errors.array());
    }

    const { phone, otp } = req.body;

    // Call verify_otp_and_activate_user function
    const result = await query(
      'SELECT verify_otp_and_activate_user($1, $2) as result',
      [phone, otp]
    );

    const response = result.rows[0].result;

    if (response.code === 0) {
      // Success - return session token and user info
      return sendSuccess(res, 200, response.message, {
        user_id: response.user_id,
        session_token: response.session_token,
        role: response.role
      });
    } else {
      return sendError(res, 400, response.message);
    }

  } catch (error) {
    console.error('Verify OTP error:', error);
    return sendError(res, 500, 'Error verifying OTP', error.message);
  }
};

// @desc    Check session token validity (App startup)
const checkSession = async (req, res) => {
  try {
    const { session_token } = req.body;

    if (!session_token) {
      return sendError(res, 400, 'Session token is required');
    }

    // Call check_session function
    const result = await query(
      'SELECT check_session($1) as result',
      [session_token]
    );

    const response = result.rows[0].result;

    if (response.code === 1) {
      // Session exists - get user details
      const userResult = await query(
        'SELECT user_id, name, phone, role, verified FROM users WHERE user_id = $1',
        [response.user_id]
      );

      if (userResult.rows.length === 0) {
        return sendError(res, 404, 'User not found');
      }

      const user = userResult.rows[0];

      return sendSuccess(res, 200, 'Session valid', {
        user_id: user.user_id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        verified: user.verified
      });
    } else {
      return sendError(res, 401, 'Invalid session');
    }

  } catch (error) {
    console.error('Check session error:', error);
    return sendError(res, 500, 'Error checking session', error.message);
  }
};

// @desc    Enter customer details (Step 4: After role selection)
const enterCustomerDetails = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, errors.array());
    }

    const { user_id, name, home_address } = req.body;

    // Call enter_details_customer function
    const result = await query(
      'SELECT enter_details_customer($1, $2, $3) as result',
      [user_id, name, home_address || null]
    );

    const response = result.rows[0].result;

    if (response.code === 1) {
      return sendSuccess(res, 200, response.message);
    } else {
      return sendError(res, 400, response.message);
    }

  } catch (error) {
    console.error('Enter customer details error:', error);
    return sendError(res, 500, 'Error saving customer details', error.message);
  }
};

// @desc    Enter driver details (Step 4: After role selection)
const enterDriverDetails = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, errors.array());
    }

    const { user_id, name } = req.body;

    // Call enter_details_driver function
    const result = await query(
      'SELECT enter_details_driver($1, $2) as result',
      [user_id, name]
    );

    const response = result.rows[0].result;

    if (response.code === 1) {
      return sendSuccess(res, 200, response.message);
    } else {
      return sendError(res, 400, response.message);
    }

  } catch (error) {
    console.error('Enter driver details error:', error);
    return sendError(res, 500, 'Error saving driver details', error.message);
  }
};

// @desc    Enter supplier details (Step 4a: After role selection)
const enterSupplierDetails = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, errors.array());
    }

    const { user_id, name, yard_location, business_contact } = req.body;

    // Call enter_details_supplier function
    const result = await query(
      'SELECT enter_details_supplier($1, $2, $3, $4) as result',
      [user_id, name, yard_location, business_contact]
    );

    const response = result.rows[0].result;

    if (response.code === 1) {
      return sendSuccess(res, 200, response.message, {
        supplier_id: response.supplier_id
      });
    } else {
      return sendError(res, 400, response.message);
    }

  } catch (error) {
    console.error('Enter supplier details error:', error);
    return sendError(res, 500, 'Error saving supplier details', error.message);
  }
};

// @desc    Upload CNIC images (Step 4b: Complete supplier registration)
const uploadCNIC = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, errors.array());
    }

    const { user_id, cnic_front_path, cnic_back_path } = req.body;

    // Call upload_cnic_supplier function
    const result = await query(
      'SELECT upload_cnic_supplier($1, $2, $3) as result',
      [user_id, cnic_front_path, cnic_back_path]
    );

    const response = result.rows[0].result;

    if (response.code === 1) {
      return sendSuccess(res, 200, response.message);
    } else {
      return sendError(res, 400, response.message);
    }

  } catch (error) {
    console.error('Upload CNIC error:', error);
    return sendError(res, 500, 'Error uploading CNIC', error.message);
  }
};

module.exports = {
  checkPhoneNumber,
  storeOTP,
  verifyOTP,
  checkSession,
  enterCustomerDetails,
  enterDriverDetails,
  enterSupplierDetails,
  uploadCNIC
};

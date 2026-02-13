const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { validationResult } = require('express-validator');
const { sendSuccess, sendError, sendValidationError } = require('../utils/responseHelper');

// @desc    Register a new user
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, errors.array());
    }

    const { phone, name, role, home_address, yard_location, business_contact } = req.body;

    // Check if user already exists
    const userExists = await query(
      'SELECT user_id, role FROM users WHERE phone = $1',
      [phone]       // safe from sql injection
    );

    if (userExists.rows.length > 0) {
      return sendError(res, 400, 'User with this phone number already exists');
    }

    // Create user with 'undefined' role initially
    const newUser = await query(
      `INSERT INTO users (name, phone, role, verified, created_at) 
       VALUES ($1, $2, 'undefined', false, NOW()) 
       RETURNING user_id, name, phone, role, verified`,
      [name, phone]
    );

    const user = newUser.rows[0];

    // Call appropriate detail entry function based on role
    let detailsResult;
    if (role === 'customer') {
      detailsResult = await query(
        'SELECT enter_details_customer($1, $2, $3)',
        [user.user_id, name, home_address || null]
      );
    } else if (role === 'driver') {
      detailsResult = await query(
        'SELECT enter_details_driver($1, $2)',
        [user.user_id, name]
      );
    } else if (role === 'supplier') {
      detailsResult = await query(
        'SELECT enter_details_supplier($1, $2, $3, $4)',
        [user.user_id, name, yard_location, business_contact]
      );
    }

    // Generate JWT token
    const token = jwt.sign(
      { user_id: user.user_id, phone: user.phone, role: role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    return sendSuccess(res, 201, 'User registered successfully', {
      token,
      user: {
        user_id: user.user_id,
        name: user.name,
        phone: user.phone,
        role: role
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    return sendError(res, 500, 'Error registering user', error.message);
  }
};

// @desc    Login user
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendValidationError(res, errors.array());
    }

    const { phone } = req.body;

    // Check if user exists
    const userResult = await query(
      'SELECT user_id, name, phone, role, verified FROM users WHERE phone = $1',
      [phone]
    );

    if (userResult.rows.length === 0) {
      return sendError(res, 404, 'User not found');
    }

    const user = userResult.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { user_id: user.user_id, phone: user.phone, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    return sendSuccess(res, 200, 'Login successful', {
      token,
      user: {
        user_id: user.user_id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        verified: user.verified
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return sendError(res, 500, 'Error logging in', error.message);
  }
};

// @desc    Logout user
const logout = async (req, res) => {
  try {
    // With JWT, logout is handled client-side by removing the token
    // Optionally, you can implement token blacklisting here
    return sendSuccess(res, 200, 'Logout successful');
  } catch (error) {
    console.error('Logout error:', error);
    return sendError(res, 500, 'Error logging out', error.message);
  }
};

module.exports = {
  register,
  login,
  logout
};

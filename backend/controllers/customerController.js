const { query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// @desc    Get all customers
const getAllCustomers = async (req, res) => {
  try {
    const result = await query(
      `SELECT u.user_id, u.name, u.phone, u.verified, ca.home_address
       FROM users u
       LEFT JOIN customer_address ca ON u.user_id = ca.user_id
       WHERE u.role = 'customer'
       ORDER BY u.created_at DESC`
    );

    return sendSuccess(res, 200, 'Customers retrieved successfully', result.rows);
  } catch (error) {
    console.error('Get all customers error:', error);
    return sendError(res, 500, 'Error retrieving customers', error.message);
  }
};

// @desc    Get customer by ID
const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT u.user_id, u.name, u.phone, u.verified, u.created_at, ca.home_address
       FROM users u
       LEFT JOIN customer_address ca ON u.user_id = ca.user_id
       WHERE u.user_id = $1 AND u.role = 'customer'`,
      [id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 404, 'Customer not found');
    }

    return sendSuccess(res, 200, 'Customer retrieved successfully', result.rows[0]);
  } catch (error) {
    console.error('Get customer by ID error:', error);
    return sendError(res, 500, 'Error retrieving customer', error.message);
  }
};

// @desc    Update customer
const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, home_address } = req.body;

    // Update user name if provided
    if (name) {
      await query(
        'UPDATE users SET name = $1 WHERE user_id = $2 AND role = $3',
        [name, id, 'customer']
      );
    }

    // Update home address if provided
    if (home_address) {
      await query(
        `INSERT INTO customer_address (user_id, home_address)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET home_address = $2`,
        [id, home_address]
      );
    }

    return sendSuccess(res, 200, 'Customer updated successfully');
  } catch (error) {
    console.error('Update customer error:', error);
    return sendError(res, 500, 'Error updating customer', error.message);
  }
};

// @desc    Delete customer
const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM users WHERE user_id = $1 AND role = $2 RETURNING user_id',
      [id, 'customer']
    );

    if (result.rowCount === 0) {
      return sendError(res, 404, 'Customer not found');
    }

    return sendSuccess(res, 200, 'Customer deleted successfully');
  } catch (error) {
    console.error('Delete customer error:', error);
    return sendError(res, 500, 'Error deleting customer', error.message);
  }
};

module.exports = {
  getAllCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer
};

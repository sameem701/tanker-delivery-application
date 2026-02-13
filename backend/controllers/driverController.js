const { query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// @desc    Get all drivers
const getAllDrivers = async (req, res) => {
  try {
    const result = await query(
      `SELECT u.user_id, u.name, u.phone, u.verified, 
              sd.driver_phone_num, sd.supplier_user_id, sd.available, sd.joined_at
       FROM users u
       LEFT JOIN supplier_drivers sd ON u.user_id = sd.driver_user_id
       WHERE u.role = 'driver'
       ORDER BY u.created_at DESC`
    );

    return sendSuccess(res, 200, 'Drivers retrieved successfully', result.rows);
  } catch (error) {
    console.error('Get all drivers error:', error);
    return sendError(res, 500, 'Error retrieving drivers', error.message);
  }
};

// @desc    Get driver by ID
const getDriverById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT u.user_id, u.name, u.phone, u.verified, u.created_at,
              sd.driver_phone_num, sd.supplier_user_id, sd.available, sd.joined_at
       FROM users u
       LEFT JOIN supplier_drivers sd ON u.user_id = sd.driver_user_id
       WHERE u.user_id = $1 AND u.role = 'driver'`,
      [id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 404, 'Driver not found');
    }

    return sendSuccess(res, 200, 'Driver retrieved successfully', result.rows[0]);
  } catch (error) {
    console.error('Get driver by ID error:', error);
    return sendError(res, 500, 'Error retrieving driver', error.message);
  }
};

// @desc    Update driver
const updateDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (name) {
      const result = await query(
        'UPDATE users SET name = $1 WHERE user_id = $2 AND role = $3 RETURNING user_id',
        [name, id, 'driver']
      );

      if (result.rowCount === 0) {
        return sendError(res, 404, 'Driver not found');
      }
    }

    return sendSuccess(res, 200, 'Driver updated successfully');
  } catch (error) {
    console.error('Update driver error:', error);
    return sendError(res, 500, 'Error updating driver', error.message);
  }
};

// @desc    Update driver status (available/unavailable)
const updateDriverStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { available } = req.body;

    if (typeof available !== 'boolean') {
      return sendError(res, 400, 'Available status must be a boolean');
    }

    const result = await query(
      'UPDATE supplier_drivers SET available = $1 WHERE driver_user_id = $2 RETURNING driver_user_id',
      [available, id]
    );

    if (result.rowCount === 0) {
      return sendError(res, 404, 'Driver not found in supplier_drivers');
    }

    return sendSuccess(res, 200, 'Driver status updated successfully');
  } catch (error) {
    console.error('Update driver status error:', error);
    return sendError(res, 500, 'Error updating driver status', error.message);
  }
};

module.exports = {
  getAllDrivers,
  getDriverById,
  updateDriver,
  updateDriverStatus
};

const { query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// @desc    Get all suppliers
const getAllSuppliers = async (req, res) => {
  try {
    const result = await query(
      `SELECT u.user_id, u.name, u.phone, u.verified, u.created_at,
              s.yard_location, s.business_contact, s.rating, s.total_orders
       FROM users u
       INNER JOIN suppliers s ON u.user_id = s.user_id
       WHERE u.role = 'supplier'
       ORDER BY s.rating DESC, u.created_at DESC`
    );

    return sendSuccess(res, 200, 'Suppliers retrieved successfully', result.rows);
  } catch (error) {
    console.error('Get all suppliers error:', error);
    return sendError(res, 500, 'Error retrieving suppliers', error.message);
  }
};

// @desc    Get supplier by ID
const getSupplierById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT u.user_id, u.name, u.phone, u.verified, u.created_at,
              s.yard_location, s.business_contact, s.cnic_front_path, 
              s.cnic_back_path, s.rating, s.total_orders
       FROM users u
       INNER JOIN suppliers s ON u.user_id = s.user_id
       WHERE u.user_id = $1 AND u.role = 'supplier'`,
      [id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 404, 'Supplier not found');
    }

    // Get supplier's drivers
    const drivers = await query(
      `SELECT sd.driver_phone_num, sd.driver_user_id, sd.available, sd.joined_at,
              u.name as driver_name
       FROM supplier_drivers sd
       LEFT JOIN users u ON sd.driver_user_id = u.user_id
       WHERE sd.supplier_user_id = $1`,
      [id]
    );

    const supplierData = {
      ...result.rows[0],
      drivers: drivers.rows
    };

    return sendSuccess(res, 200, 'Supplier retrieved successfully', supplierData);
  } catch (error) {
    console.error('Get supplier by ID error:', error);
    return sendError(res, 500, 'Error retrieving supplier', error.message);
  }
};

// @desc    Update supplier
const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, yard_location, business_contact } = req.body;

    // Update user name if provided
    if (name) {
      await query(
        'UPDATE users SET name = $1 WHERE user_id = $2 AND role = $3',
        [name, id, 'supplier']
      );
    }

    // Update supplier details if provided
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (yard_location) {
      updates.push(`yard_location = $${paramCount++}`);
      values.push(yard_location);
    }
    if (business_contact) {
      updates.push(`business_contact = $${paramCount++}`);
      values.push(business_contact);
    }

    if (updates.length > 0) {
      values.push(id);
      await query(
        `UPDATE suppliers SET ${updates.join(', ')} WHERE user_id = $${paramCount}`,
        values
      );
    }

    return sendSuccess(res, 200, 'Supplier updated successfully');
  } catch (error) {
    console.error('Update supplier error:', error);
    return sendError(res, 500, 'Error updating supplier', error.message);
  }
};

module.exports = {
  getAllSuppliers,
  getSupplierById,
  updateSupplier
};

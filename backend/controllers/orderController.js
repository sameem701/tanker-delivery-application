const { query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// @desc    Create a new order
const createOrder = async (req, res) => {
  try {
    const { customer_id, delivery_location, requested_capacity, customer_bid_price } = req.body;

    if (!customer_id || !delivery_location || !requested_capacity || !customer_bid_price) {
      return sendError(res, 400, 'Missing required fields');
    }

    const result = await query(
      `INSERT INTO orders (customer_id, delivery_location, requested_capacity, customer_bid_price, status, created_at)
       VALUES ($1, $2, $3, $4, 'open', NOW())
       RETURNING order_id, customer_id, delivery_location, requested_capacity, customer_bid_price, status, created_at`,
      [customer_id, delivery_location, requested_capacity, customer_bid_price]
    );

    return sendSuccess(res, 201, 'Order created successfully', result.rows[0]);
  } catch (error) {
    console.error('Create order error:', error);
    return sendError(res, 500, 'Error creating order', error.message);
  }
};

// @desc    Get all orders
const getAllOrders = async (req, res) => {
  try {
    const { status, customer_id, supplier_id } = req.query;

    let queryText = `
      SELECT o.*, 
             c.name as customer_name, c.phone as customer_phone,
             s.name as supplier_name,
             d.name as driver_name
      FROM orders o
      INNER JOIN users c ON o.customer_id = c.user_id
      LEFT JOIN users s ON o.supplier_id = s.user_id
      LEFT JOIN users d ON o.driver_id = d.user_id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (status) {
      queryText += ` AND o.status = $${paramCount++}`;
      params.push(status);
    }
    if (customer_id) {
      queryText += ` AND o.customer_id = $${paramCount++}`;
      params.push(customer_id);
    }
    if (supplier_id) {
      queryText += ` AND o.supplier_id = $${paramCount++}`;
      params.push(supplier_id);
    }

    queryText += ' ORDER BY o.created_at DESC';

    const result = await query(queryText, params);

    return sendSuccess(res, 200, 'Orders retrieved successfully', result.rows);
  } catch (error) {
    console.error('Get all orders error:', error);
    return sendError(res, 500, 'Error retrieving orders', error.message);
  }
};

// @desc    Get order by ID
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT o.*, 
              c.name as customer_name, c.phone as customer_phone,
              s.name as supplier_name, s.phone as supplier_phone,
              d.name as driver_name, d.phone as driver_phone
       FROM orders o
       INNER JOIN users c ON o.customer_id = c.user_id
       LEFT JOIN users s ON o.supplier_id = s.user_id
       LEFT JOIN users d ON o.driver_id = d.user_id
       WHERE o.order_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return sendError(res, 404, 'Order not found');
    }

    return sendSuccess(res, 200, 'Order retrieved successfully', result.rows[0]);
  } catch (error) {
    console.error('Get order by ID error:', error);
    return sendError(res, 500, 'Error retrieving order', error.message);
  }
};

// @desc    Update order
const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { supplier_id, driver_id, accepted_price } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (supplier_id) {
      updates.push(`supplier_id = $${paramCount++}`);
      values.push(supplier_id);
    }
    if (driver_id) {
      updates.push(`driver_id = $${paramCount++}`);
      values.push(driver_id);
    }
    if (accepted_price) {
      updates.push(`accepted_price = $${paramCount++}`);
      values.push(accepted_price);
    }

    if (updates.length === 0) {
      return sendError(res, 400, 'No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await query(
      `UPDATE orders SET ${updates.join(', ')} WHERE order_id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return sendError(res, 404, 'Order not found');
    }

    return sendSuccess(res, 200, 'Order updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Update order error:', error);
    return sendError(res, 500, 'Error updating order', error.message);
  }
};

// @desc    Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['open', 'supplier_timer', 'accepted', 'ride_started', 'reached', 'finished'];
    if (!validStatuses.includes(status)) {
      return sendError(res, 400, 'Invalid status value');
    }

    const result = await query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE order_id = $2 RETURNING *',
      [status, id]
    );

    if (result.rowCount === 0) {
      return sendError(res, 404, 'Order not found');
    }

    return sendSuccess(res, 200, 'Order status updated successfully', result.rows[0]);
  } catch (error) {
    console.error('Update order status error:', error);
    return sendError(res, 500, 'Error updating order status', error.message);
  }
};

// @desc    Cancel order
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM orders WHERE order_id = $1 RETURNING order_id',
      [id]
    );

    if (result.rowCount === 0) {
      return sendError(res, 404, 'Order not found');
    }

    return sendSuccess(res, 200, 'Order cancelled successfully');
  } catch (error) {
    console.error('Cancel order error:', error);
    return sendError(res, 500, 'Error cancelling order', error.message);
  }
};

module.exports = {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrder,
  updateOrderStatus,
  cancelOrder
};

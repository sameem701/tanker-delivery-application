const { query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// @desc    Check if supplier has any drivers registered
const checkHasDrivers = async (req, res) => {
  try {
    const { supplier_id } = req.params;

    if (!supplier_id) {
      return sendError(res, 400, 'Supplier ID is required');
    }

    // Call check_supplier_has_drivers function
    const result = await query(
      'SELECT check_supplier_has_drivers($1) as result',
      [parseInt(supplier_id)]
    );

    const response = result.rows[0].result;

    return sendSuccess(res, 200, response.message, { has_drivers: response.code === 1 });

  } catch (error) {
    console.error('Check has drivers error:', error);
    return sendError(res, 500, 'Error checking drivers', error.message);
  }
};

// @desc    Check if supplier has active drivers
const checkHasActiveDrivers = async (req, res) => {
  try {
    const { supplier_id } = req.params;

    if (!supplier_id) {
      return sendError(res, 400, 'Supplier ID is required');
    }

    // Call check_supplier_has_active_drivers function
    const result = await query(
      'SELECT check_supplier_has_active_drivers($1) as result',
      [parseInt(supplier_id)]
    );

    const response = result.rows[0].result;

    return sendSuccess(res, 200, response.message, { has_active_drivers: response.code === 1 });

  } catch (error) {
    console.error('Check has active drivers error:', error);
    return sendError(res, 500, 'Error checking active drivers', error.message);
  }
};

// @desc    View all available open orders
const viewAvailableOrders = async (req, res) => {
  try {
    // Call view_available_orders function
    const result = await query('SELECT view_available_orders() as result');

    const orders = result.rows[0].result;

    return sendSuccess(res, 200, 'Available orders retrieved', orders);

  } catch (error) {
    console.error('View available orders error:', error);
    return sendError(res, 500, 'Error retrieving orders', error.message);
  }
};

// @desc    View specific order details
const viewOrderDetails = async (req, res) => {
  try {
    const { order_id } = req.params;

    if (!order_id) {
      return sendError(res, 400, 'Order ID is required');
    }

    // Call view_order_details function
    const result = await query(
      'SELECT view_order_details($1) as result',
      [parseInt(order_id)]
    );

    const response = result.rows[0].result;

    if (response.code === 1) {
      return sendSuccess(res, 200, 'Order details retrieved', response);
    } else {
      return sendError(res, 404, response.message);
    }

  } catch (error) {
    console.error('View order details error:', error);
    return sendError(res, 500, 'Error retrieving order details', error.message);
  }
};

// @desc    Send bid for an order
const sendBid = async (req, res) => {
  try {
    const { order_id, supplier_id, bid_price } = req.body;

    if (!order_id || !supplier_id || !bid_price) {
      return sendError(res, 400, 'Missing required fields');
    }

    // Call send_bid function
    const result = await query(
      'SELECT send_bid($1, $2, $3) as result',
      [order_id, supplier_id, bid_price]
    );

    const response = result.rows[0].result;

    if (response.code === 1) {
      return sendSuccess(res, 200, response.message);
    } else {
      return sendError(res, 400, response.message);
    }

  } catch (error) {
    console.error('Send bid error:', error);
    return sendError(res, 500, 'Error sending bid', error.message);
  }
};

// @desc    Get available drivers for supplier with order status
const getAvailableDrivers = async (req, res) => {
  try {
    const { supplier_id, order_id } = req.params;

    if (!supplier_id || !order_id) {
      return sendError(res, 400, 'Missing required parameters');
    }

    // Call get_available_drivers_for_supplier function
    const result = await query(
      'SELECT get_available_drivers_for_supplier($1, $2) as result',
      [parseInt(supplier_id), parseInt(order_id)]
    );

    const response = result.rows[0].result;

    if (response.code === 1) {
      return sendSuccess(res, 200, 'Drivers retrieved', response.drivers);
    } else {
      return sendError(res, 400, response.message);
    }

  } catch (error) {
    console.error('Get available drivers error:', error);
    return sendError(res, 500, 'Error retrieving drivers', error.message);
  }
};

// @desc    Assign driver to order
const assignDriver = async (req, res) => {
  try {
    const { order_id, supplier_id, driver_id } = req.body;

    if (!order_id || !supplier_id || !driver_id) {
      return sendError(res, 400, 'Missing required fields');
    }

    // Call assign_driver_to_order function
    const result = await query(
      'SELECT assign_driver_to_order($1, $2, $3) as result',
      [order_id, supplier_id, driver_id]
    );

    const response = result.rows[0].result;

    if (response.code === 1) {
      return sendSuccess(res, 200, response.message);
    } else {
      return sendError(res, 400, response.message);
    }

  } catch (error) {
    console.error('Assign driver error:', error);
    return sendError(res, 500, 'Error assigning driver', error.message);
  }
};

// @desc    Get order details for supplier
const getOrderDetails = async (req, res) => {
  try {
    const { supplier_id, order_id } = req.params;

    if (!supplier_id || !order_id) {
      return sendError(res, 400, 'Missing required parameters');
    }

    // Call get_order_details_supplier function
    const result = await query(
      'SELECT get_order_details_supplier($1, $2) as result',
      [parseInt(supplier_id), parseInt(order_id)]
    );

    const response = result.rows[0].result;

    if (response.code === 1) {
      return sendSuccess(res, 200, 'Order details retrieved', response);
    } else {
      return sendError(res, 404, response.message);
    }

  } catch (error) {
    console.error('Get order details error:', error);
    return sendError(res, 500, 'Error retrieving order details', error.message);
  }
};

// @desc    Get active orders for supplier
const getActiveOrders = async (req, res) => {
  try {
    const { supplier_id } = req.params;

    if (!supplier_id) {
      return sendError(res, 400, 'Supplier ID is required');
    }

    // Call get_active_orders_supplier function
    const result = await query(
      'SELECT get_active_orders_supplier($1) as result',
      [parseInt(supplier_id)]
    );

    const response = result.rows[0].result;

    if (response.code === 1) {
      return sendSuccess(res, 200, 'Active orders retrieved', response.orders);
    } else {
      return sendError(res, 400, response.message);
    }

  } catch (error) {
    console.error('Get active orders error:', error);
    return sendError(res, 500, 'Error retrieving active orders', error.message);
  }
};

// @desc    Cancel order
const cancelOrder = async (req, res) => {
  try {
    const { order_id, user_id, reason } = req.body;

    if (!order_id || !user_id) {
      return sendError(res, 400, 'Missing required fields');
    }

    // Call cancel_order function
    const result = await query(
      'SELECT cancel_order($1, $2, $3) as result',
      [order_id, user_id, reason || null]
    );

    const response = result.rows[0].result;

    if (response.code === 1) {
      return sendSuccess(res, 200, response.message);
    } else {
      return sendError(res, 400, response.message);
    }

  } catch (error) {
    console.error('Cancel order error:', error);
    return sendError(res, 500, 'Error cancelling order', error.message);
  }
};

// @desc    View past orders
const viewPastOrders = async (req, res) => {
  try {
    const { user_id } = req.params;

    if (!user_id) {
      return sendError(res, 400, 'User ID is required');
    }

    // Call view_past_orders function
    const result = await query(
      'SELECT view_past_orders($1) as result',
      [parseInt(user_id)]
    );

    const response = result.rows[0].result;

    if (response.code === 1) {
      return sendSuccess(res, 200, 'Past orders retrieved', response.orders);
    } else {
      return sendError(res, 400, response.message);
    }

  } catch (error) {
    console.error('View past orders error:', error);
    return sendError(res, 500, 'Error retrieving past orders', error.message);
  }
};

// @desc    View past order details
const viewPastOrderDetails = async (req, res) => {
  try {
    const { supplier_id, order_id } = req.params;

    if (!supplier_id || !order_id) {
      return sendError(res, 400, 'Missing required parameters');
    }

    // Call view_past_order_details_supplier function
    const result = await query(
      'SELECT view_past_order_details_supplier($1, $2) as result',
      [parseInt(supplier_id), parseInt(order_id)]
    );

    const response = result.rows[0].result;

    if (response.code === 1) {
      return sendSuccess(res, 200, 'Order details retrieved', response.order);
    } else {
      return sendError(res, 404, response.message);
    }

  } catch (error) {
    console.error('View past order details error:', error);
    return sendError(res, 500, 'Error retrieving order details', error.message);
  }
};

// @desc    Add driver phone numbers to supplier_drivers table
const addDriverPhones = async (req, res) => {
  try {
    const { supplier_id, driver_phones } = req.body;

    if (!supplier_id || !driver_phones || !Array.isArray(driver_phones)) {
      return sendError(res, 400, 'Supplier ID and driver phones array required');
    }

    // Insert driver phone numbers
    const insertPromises = driver_phones.map(phone =>
      query(
        `INSERT INTO supplier_drivers (driver_phone_num, supplier_user_id, driver_user_id, available)
         VALUES ($1, $2, NULL, TRUE)
         ON CONFLICT (driver_phone_num, supplier_user_id) DO NOTHING`,
        [phone, supplier_id]
      )
    );

    await Promise.all(insertPromises);

    return sendSuccess(res, 201, 'Driver phone numbers added successfully');

  } catch (error) {
    console.error('Add driver phones error:', error);
    return sendError(res, 500, 'Error adding driver phones', error.message);
  }
};

module.exports = {
  checkHasDrivers,
  checkHasActiveDrivers,
  viewAvailableOrders,
  viewOrderDetails,
  sendBid,
  getAvailableDrivers,
  assignDriver,
  getOrderDetails,
  getActiveOrders,
  cancelOrder,
  viewPastOrders,
  viewPastOrderDetails,
  addDriverPhones
};

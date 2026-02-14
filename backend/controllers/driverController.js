const { query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// @desc    Confirm order assignment
const confirmOrder = async (req, res) => {
  try {
    const driver_id = req.user.user_id; // From auth middleware
    const { order_id } = req.body;

    if (!order_id) {
      return sendError(res, 400, 'Missing required fields');
    }

    // Call confirm_order_driver function
    const result = await query(
      'SELECT confirm_order_driver($1, $2) as result',
      [driver_id, order_id]
    );

    const response = result.rows[0].result;

    if (response.code === 1) {
      return sendSuccess(res, 200, response.message);
    } else {
      return sendError(res, 400, response.message);
    }

  } catch (error) {
    console.error('Confirm order error:', error);
    return sendError(res, 500, 'Error confirming order', error.message);
  }
};

// @desc    Reject order assignment
const rejectOrder = async (req, res) => {
  try {
    const driver_id = req.user.user_id; // From auth middleware
    const { order_id } = req.body;

    if (!order_id) {
      return sendError(res, 400, 'Missing required fields');
    }

    // Call reject_order_driver function
    const result = await query(
      'SELECT reject_order_driver($1, $2) as result',
      [driver_id, order_id]
    );

    const response = result.rows[0].result;

    if (response.code === 1) {
      return sendSuccess(res, 200, response.message);
    } else {
      return sendError(res, 400, response.message);
    }

  } catch (error) {
    console.error('Reject order error:', error);
    return sendError(res, 500, 'Error rejecting order', error.message);
  }
};

// @desc    Get order details for driver
const getOrderDetails = async (req, res) => {
  try {
    const driver_id = req.user.user_id; // From auth middleware
    const { order_id } = req.params;

    if (!order_id) {
      return sendError(res, 400, 'Missing required parameters');
    }

    // Call get_order_details_driver function
    const result = await query(
      'SELECT get_order_details_driver($1, $2) as result',
      [driver_id, parseInt(order_id)]
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

// @desc    Start ride
const startRide = async (req, res) => {
  try {
    const driver_id = req.user.user_id; // From auth middleware
    const { order_id } = req.body;

    if (!order_id) {
      return sendError(res, 400, 'Missing required fields');
    }

    // Call start_ride function
    const result = await query(
      'SELECT start_ride($1, $2) as result',
      [driver_id, order_id]
    );

    const response = result.rows[0].result;

    if (response.code === 1) {
      return sendSuccess(res, 200, response.message);
    } else {
      return sendError(res, 400, response.message);
    }

  } catch (error) {
    console.error('Start ride error:', error);
    return sendError(res, 500, 'Error starting ride', error.message);
  }
};

// @desc    Mark order as reached
const markReached = async (req, res) => {
  try {
    const driver_id = req.user.user_id; // From auth middleware
    const { order_id } = req.body;

    if (!order_id) {
      return sendError(res, 400, 'Missing required fields');
    }

    // Call mark_order_reached function
    const result = await query(
      'SELECT mark_order_reached($1, $2) as result',
      [driver_id, order_id]
    );

    const response = result.rows[0].result;

    if (response.code === 1) {
      return sendSuccess(res, 200, response.message);
    } else {
      return sendError(res, 400, response.message);
    }

  } catch (error) {
    console.error('Mark reached error:', error);
    return sendError(res, 500, 'Error marking as reached', error.message);
  }
};

// @desc    Finish order/delivery
const finishOrder = async (req, res) => {
  try {
    const driver_id = req.user.user_id; // From auth middleware
    const { order_id } = req.body;

    if (!order_id) {
      return sendError(res, 400, 'Missing required fields');
    }

    // Call finish_order function
    const result = await query(
      'SELECT finish_order($1, $2) as result',
      [driver_id, order_id]
    );

    const response = result.rows[0].result;

    if (response.code === 1) {
      return sendSuccess(res, 200, response.message);
    } else {
      return sendError(res, 400, response.message);
    }

  } catch (error) {
    console.error('Finish order error:', error);
    return sendError(res, 500, 'Error finishing order', error.message);
  }
};

// @desc    Cancel order
const cancelOrder = async (req, res) => {
  try {
    const user_id = req.user.user_id; // From auth middleware
    const { order_id, reason } = req.body;

    if (!order_id) {
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
    const user_id = req.user.user_id; // From auth middleware

    // Call view_past_orders function
    const result = await query(
      'SELECT view_past_orders($1) as result',
      [user_id]
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
    const driver_id = req.user.user_id; // From auth middleware
    const { order_id } = req.params;

    if (!order_id) {
      return sendError(res, 400, 'Missing required parameters');
    }

    // Call view_past_order_details_driver function
    const result = await query(
      'SELECT view_past_order_details_driver($1, $2) as result',
      [driver_id, parseInt(order_id)]
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

module.exports = {
  confirmOrder,
  rejectOrder,
  getOrderDetails,
  startRide,
  markReached,
  finishOrder,
  cancelOrder,
  viewPastOrders,
  viewPastOrderDetails
};

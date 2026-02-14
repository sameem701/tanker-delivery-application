const { query } = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');

// @desc    Create/Start a new order
const startOrder = async (req, res) => {
  try {
    const { customer_id, delivery_location, requested_capacity, customer_bid_price } = req.body;

    if (!customer_id || !delivery_location || !requested_capacity || !customer_bid_price) {
      return sendError(res, 400, 'Missing required fields');
    }

    // Call START_ORDER function
    const result = await query(
      'SELECT START_ORDER($1, $2, $3, $4) as result',
      [customer_id, delivery_location, requested_capacity, customer_bid_price]
    );

    const response = result.rows[0].result;

    if (response.code === 1) {
      return sendSuccess(res, 201, response.message, {
        order_id: response.order_id
      });
    } else {
      return sendError(res, 400, response.message);
    }

  } catch (error) {
    console.error('Start order error:', error);
    return sendError(res, 500, 'Error creating order', error.message);
  }
};

// @desc    Accept a supplier's bid
const acceptBid = async (req, res) => {
  try {
    const { bid_id, customer_id } = req.body;

    if (!bid_id || !customer_id) {
      return sendError(res, 400, 'Missing required fields');
    }

    // Call accept_bid function
    const result = await query(
      'SELECT accept_bid($1, $2) as result',
      [bid_id, customer_id]
    );

    const response = result.rows[0].result;

    if (response.code === 1) {
      return sendSuccess(res, 200, response.message);
    } else {
      return sendError(res, 400, response.message);
    }

  } catch (error) {
    console.error('Accept bid error:', error);
    return sendError(res, 500, 'Error accepting bid', error.message);
  }
};

// @desc    Get order details for customer
const getOrderDetails = async (req, res) => {
  try {
    const { customer_id, order_id } = req.params;

    if (!customer_id || !order_id) {
      return sendError(res, 400, 'Missing required parameters');
    }

    // Call get_order_details_customer function
    const result = await query(
      'SELECT get_order_details_customer($1, $2) as result',
      [parseInt(customer_id), parseInt(order_id)]
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

// @desc    Submit rating for completed order
const submitRating = async (req, res) => {
  try {
    const { customer_id, order_id, rating } = req.body;

    if (!customer_id || !order_id || !rating) {
      return sendError(res, 400, 'Missing required fields');
    }

    if (rating < 1 || rating > 5) {
      return sendError(res, 400, 'Rating must be between 1 and 5');
    }

    // Call submit_rating function
    const result = await query(
      'SELECT submit_rating($1, $2, $3) as result',
      [customer_id, order_id, parseInt(rating)]
    );

    const response = result.rows[0].result;

    if (response.code === 1) {
      return sendSuccess(res, 200, response.message);
    } else {
      return sendError(res, 400, response.message);
    }

  } catch (error) {
    console.error('Submit rating error:', error);
    return sendError(res, 500, 'Error submitting rating', error.message);
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
    const { customer_id, order_id } = req.params;

    if (!customer_id || !order_id) {
      return sendError(res, 400, 'Missing required parameters');
    }

    // Call view_past_order_details_customer function
    const result = await query(
      'SELECT view_past_order_details_customer($1, $2) as result',
      [parseInt(customer_id), parseInt(order_id)]
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
  startOrder,
  acceptBid,
  getOrderDetails,
  submitRating,
  cancelOrder,
  viewPastOrders,
  viewPastOrderDetails
};

const { query } = require('../config/database');

const getAuthenticatedUserId = async (req) => {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const sessionToken = bearerToken || req.headers['x-session-token'] || null;

  if (!sessionToken) {
    return {
      ok: false,
      status: 401,
      message: 'Unauthorized: missing session token'
    };
  }

  const sessionResult = await query('SELECT check_session($1) AS result', [sessionToken]);
  const sessionResponse = sessionResult.rows[0].result;

  if (!sessionResponse || sessionResponse.code !== 1 || !sessionResponse.user_id) {
    return {
      ok: false,
      status: 401,
      message: 'Unauthorized: invalid session'
    };
  }

  return {
    ok: true,
    userId: sessionResponse.user_id
  };
};

const getSupplierUserId = async (req) => {
  const auth = await getAuthenticatedUserId(req);
  if (!auth.ok) {
    return auth;
  }

  const roleResult = await query('SELECT role FROM users WHERE user_id = $1', [auth.userId]);
  const role = roleResult.rows[0]?.role;

  if (role !== 'supplier') {
    return {
      ok: false,
      status: 403,
      message: 'Forbidden: supplier access required'
    };
  }

  return {
    ok: true,
    userId: auth.userId
  };
};

const getCustomerUserId = async (req) => {
  const auth = await getAuthenticatedUserId(req);
  if (!auth.ok) {
    return auth;
  }

  const roleResult = await query('SELECT role FROM users WHERE user_id = $1', [auth.userId]);
  const role = roleResult.rows[0]?.role;

  if (role !== 'customer') {
    return {
      ok: false,
      status: 403,
      message: 'Forbidden: customer access required'
    };
  }

  return {
    ok: true,
    userId: auth.userId
  };
};

const getDriverUserId = async (req) => {
  const auth = await getAuthenticatedUserId(req);
  if (!auth.ok) {
    return auth;
  }

  const roleResult = await query('SELECT role FROM users WHERE user_id = $1', [auth.userId]);
  const role = roleResult.rows[0]?.role;

  if (role !== 'driver') {
    return {
      ok: false,
      status: 403,
      message: 'Forbidden: driver access required'
    };
  }

  return {
    ok: true,
    userId: auth.userId
  };
};


// On app Start up

const appStartup = async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const sessionToken = req.body.session_token || req.headers['x-session-token'] || bearerToken || null;

    // No token means user must go to phone entry screen.
    if (!sessionToken) {
      return res.status(200).json({
        success: true,
        next_screen: 'enter_number',
        reason: 'missing_session_token'
      });
    }

    const sessionResult = await query('SELECT check_session($1) AS result', [sessionToken]);
    const sessionResponse = sessionResult.rows[0].result;

    if (!sessionResponse || sessionResponse.code !== 1) {
      return res.status(200).json({
        success: true,
        next_screen: 'enter_number',
        reason: 'invalid_session'
      });
    }

    const userResult = await query(
      'SELECT user_id, role, verified FROM users WHERE user_id = $1',
      [sessionResponse.user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(200).json({
        success: true,
        next_screen: 'enter_number',
        reason: 'user_not_found'
      });
    }

    const user = userResult.rows[0];

    // Route by onboarding state: undefined role must complete details first.
    return res.status(200).json({
      success: true,
      next_screen: user.role === 'undefined' ? 'enter_details' : 'dashboard',
      user: {
        user_id: user.user_id,
        role: user.role,
        verified: user.verified
      }
    });
  } catch (error) {
    console.error('Startup check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process app startup',
      error: error.message
    });
  }
};


// Enter number endpoint: If the session doesn't exist

const enterNumber = async (req, res) => {
  try {
    const phone = (req.body.phone || req.body.phone_number || '').toString().trim();

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    // Validate phone number length (10-20 digits)
    if (phone.length < 10 || phone.length > 20) {
      return res.status(400).json({
        success: false,
        message: 'Phone number must be between 10 and 20 characters'
      });
    }

    const dbResult = await query('SELECT phone_number_exists($1) AS result', [phone]);
    const response = dbResult.rows[0].result;

    if (!response || response.code === 2) {
      return res.status(400).json({
        success: false,
        message: response?.message || 'Failed to process phone number'
      });
    }

    return res.status(200).json({
      success: true,
      message: response.message,
      data: {
        phone: response.phone || phone,
        registration_state: response.code === 0 ? 'new_user_pending_otp' : 'existing_user_pending_otp',
        next_screen: 'otp_verification'
      }
    });
  } catch (error) {
    console.error('Enter number error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process phone number',
      error: error.message
    });
  }
};


// Store OTP endpoint: Save OTP to database for verification

const storeOTP = async (req, res) => {
  try {
    const phone = (req.body.phone || req.body.phone_number || '').toString().trim();
    const otp = (req.body.otp || '').toString().trim();

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: 'OTP is required'
      });
    }

    const dbResult = await query('SELECT store_otp($1, $2) AS result', [phone, otp]);
    const response = dbResult.rows[0].result;

    // store_otp returns { success: true/false, message: ... }
    if (!response || response.success !== true) {
      return res.status(400).json({
        success: false,
        message: response?.message || 'Failed to store OTP'
      });
    }

    return res.status(200).json({
      success: true,
      message: response.message || 'OTP stored successfully',
      data: {
        phone: response.phone || phone,
        otp_sent: response.otp_sent || true,
        next_screen: 'otp_verification_confirm'
      }
    });
  } catch (error) {
    console.error('Store OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to store OTP',
      error: error.message
    });
  }
};


// Verify OTP endpoint: Validate OTP and activate user session


const verifyOTP = async (req, res) => {
  try {
    const phone = (req.body.phone || req.body.phone_number || '').toString().trim();
    const otp = (req.body.otp || '').toString().trim();

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
    }

    if (!otp) {
      return res.status(400).json({
        success: false,
        message: 'OTP is required'
      });
    }

    const dbResult = await query('SELECT verify_otp_and_activate_user($1, $2) AS result', [phone, otp]);
    const response = dbResult.rows[0].result;

    // verify_otp_and_activate_user contract: 0=success, 1=invalid OTP, 2=error
    if (!response || response.code !== 0) {
      return res.status(400).json({
        success: false,
        message: response?.message || 'OTP verification failed'
      });
    }

    // Code 0: OTP verified successfully
    return res.status(200).json({
      success: true,
      message: response.message || 'OTP verified successfully',
      data: {
        session_token: response.session_token,
        user_id: response.user_id,
        phone: response.phone || phone,
        role: response.role,
        next_screen: response.role === 'undefined' ? 'enter_details' : 'dashboard'
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify OTP',
      error: error.message
    });
  }
};


// Profile completion: customer

const enterDetailsCustomer = async (req, res) => {
  try {
    const auth = await getAuthenticatedUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message
      });
    }

    const userId = auth.userId;
    const name = (req.body.name || '').toString().trim();
    const homeAddress = req.body.home_address || null;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    const dbResult = await query('SELECT enter_details_customer($1, $2, $3) AS result', [userId, name, homeAddress]);
    const response = dbResult.rows[0].result;

    if (!response || response.code !== 1) {
      return res.status(400).json({
        success: false,
        message: response?.message || 'Failed to save customer details'
      });
    }

    return res.status(200).json({
      success: true,
      message: response.message || 'Customer details saved successfully',
      data: {
        user_id: userId,
        role: 'customer',
        next_screen: 'dashboard'
      }
    });
  } catch (error) {
    console.error('Enter customer details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save customer details',
      error: error.message
    });
  }
};


// Profile completion: driver

const enterDetailsDriver = async (req, res) => {
  try {
    const auth = await getAuthenticatedUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message
      });
    }

    const userId = auth.userId;
    const name = (req.body.name || '').toString().trim();

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    const dbResult = await query('SELECT enter_details_driver($1, $2) AS result', [userId, name]);
    const response = dbResult.rows[0].result;

    if (!response || response.code !== 1) {
      if (response?.force_reonboard) {
        return res.status(401).json({
          success: false,
          message: response.message,
          data: {
            next_screen: response.next_screen || 'enter_number'
          }
        });
      }

      return res.status(400).json({
        success: false,
        message: response?.message || 'Failed to save driver details'
      });
    }

    return res.status(200).json({
      success: true,
      message: response.message || 'Driver details saved successfully',
      data: {
        user_id: userId,
        role: 'driver',
        next_screen: 'dashboard'
      }
    });
  } catch (error) {
    console.error('Enter driver details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save driver details',
      error: error.message
    });
  }
};


// Profile completion: supplier basic details

const enterDetailsSupplier = async (req, res) => {
  try {
    const auth = await getAuthenticatedUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message
      });
    }

    const userId = auth.userId;
    const name = (req.body.name || '').toString().trim();
    const yardLocation = (req.body.yard_location || '').toString().trim();
    const businessContact = (req.body.business_contact || '').toString().trim();

    if (!name || !yardLocation || !businessContact) {
      return res.status(400).json({
        success: false,
        message: 'Name, yard_location, and business_contact are required'
      });
    }

    // Validate business_contact phone number length (10-20 digits)
    if (businessContact.length < 10 || businessContact.length > 20) {
      return res.status(400).json({
        success: false,
        message: 'Business contact must be a valid phone number (10-20 characters)'
      });
    }

    const dbResult = await query('SELECT enter_details_supplier($1, $2, $3, $4) AS result', [
      userId,
      name,
      yardLocation,
      businessContact
    ]);
    const response = dbResult.rows[0].result;

    if (!response || response.code !== 1) {
      return res.status(400).json({
        success: false,
        message: response?.message || 'Failed to save supplier details'
      });
    }

    return res.status(200).json({
      success: true,
      message: response.message || 'Supplier details saved successfully',
      data: {
        user_id: userId,
        supplier_id: response.supplier_id || userId,
        next_screen: 'dashboard'
      }
    });
  } catch (error) {
    console.error('Enter supplier details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save supplier details',
      error: error.message
    });
  }
};




// Supplier dashboard: add a driver phone to roster.
const addSupplierDriver = async (req, res) => {
  try {
    const auth = await getSupplierUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message
      });
    }

    const supplierId = auth.userId;
    const driverPhone = (req.body.driver_phone_num || '').toString().trim();

    if (!driverPhone) {
      return res.status(400).json({
        success: false,
        message: 'driver_phone_num is required'
      });
    }

    if (driverPhone.length < 10 || driverPhone.length > 20) {
      return res.status(400).json({
        success: false,
        message: 'Driver phone number must be between 10 and 20 characters'
      });
    }

    const dbResult = await query('SELECT add_driver_phone_for_supplier($1, $2) AS result', [
      supplierId,
      driverPhone
    ]);
    const response = dbResult.rows[0].result;

    if (!response || response.code !== 1) {
      return res.status(400).json({
        success: false,
        message: response?.message || 'Failed to add driver'
      });
    }

    return res.status(200).json({
      success: true,
      message: response.message || 'Driver added successfully'
    });
  } catch (error) {
    console.error('Add supplier driver error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add supplier driver',
      error: error.message
    });
  }
};

// Supplier dashboard: list roster drivers.
const listSupplierDrivers = async (req, res) => {
  try {
    const auth = await getSupplierUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message
      });
    }

    const supplierId = auth.userId;

    const dbResult = await query(
      `
      SELECT
        sd.driver_phone_num,
        sd.driver_user_id,
        sd.available,
        sd.joined_at,
        u.name AS driver_name,
        u.phone AS linked_phone
      FROM supplier_drivers sd
      LEFT JOIN users u ON u.user_id = sd.driver_user_id
      WHERE sd.supplier_user_id = $1
      ORDER BY sd.joined_at DESC NULLS LAST, sd.driver_phone_num ASC
      `,
      [supplierId]
    );

    const drivers = dbResult.rows.map((row) => ({
      driver_phone_num: row.driver_phone_num,
      driver_user_id: row.driver_user_id,
      linked: Boolean(row.driver_user_id),
      available: row.available,
      joined_at: row.joined_at,
      driver_name: row.driver_name || null,
      linked_phone: row.linked_phone || null
    }));

    return res.status(200).json({
      success: true,
      data: {
        supplier_user_id: supplierId,
        total_drivers: drivers.length,
        drivers
      }
    });
  } catch (error) {
    console.error('List supplier drivers error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to list supplier drivers',
      error: error.message
    });
  }
};

// Supplier dashboard: remove driver phone from roster.
const removeSupplierDriver = async (req, res) => {
  try {
    const auth = await getSupplierUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message
      });
    }

    const supplierId = auth.userId;
    const driverPhone = (req.body.driver_phone_num || '').toString().trim();

    if (!driverPhone) {
      return res.status(400).json({
        success: false,
        message: 'driver_phone_num is required'
      });
    }

    const dbResult = await query('SELECT remove_driver_for_supplier($1, $2) AS result', [
      supplierId,
      driverPhone
    ]);
    const response = dbResult.rows[0].result;

    if (!response || response.code !== 1) {
      return res.status(400).json({
        success: false,
        message: response?.message || 'Failed to remove driver'
      });
    }

    return res.status(200).json({
      success: true,
      message: response.message || 'Driver removed successfully'
    });
  } catch (error) {
    console.error('Remove supplier driver error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove supplier driver',
      error: error.message
    });
  }
};

// Supplier dashboard: readiness checks for order screen.
const getSupplierDriverReadiness = async (req, res) => {
  try {
    const auth = await getSupplierUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message
      });
    }

    const supplierId = auth.userId;

    const [hasAnyResult, hasActiveResult] = await Promise.all([
      query('SELECT check_supplier_has_drivers($1) AS result', [supplierId]),
      query('SELECT check_supplier_has_active_drivers($1) AS result', [supplierId])
    ]);

    const hasAny = hasAnyResult.rows[0].result;
    const hasActive = hasActiveResult.rows[0].result;

    return res.status(200).json({
      success: true,
      data: {
        has_defined_drivers: hasAny?.code === 1,
        has_active_drivers: hasActive?.code === 1,
        has_defined_drivers_message: hasAny?.message || null,
        has_active_drivers_message: hasActive?.message || null
      }
    });
  } catch (error) {
    console.error('Supplier readiness check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check supplier driver readiness',
      error: error.message
    });
  }
};




// Customer dashboard: fetch available quantity-price options.
const getCustomerQuantityPricing = async (req, res) => {
  try {
    const auth = await getCustomerUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message
      });
    }

    const pricingResult = await query(
      `
      SELECT quantity_in_gallon, base_price
      FROM quantity_pricing
      ORDER BY quantity_in_gallon ASC
      `
    );

    return res.status(200).json({
      success: true,
      data: {
        quantities: pricingResult.rows
      }
    });
  } catch (error) {
    console.error('Get quantity pricing error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch quantity pricing',
      error: error.message
    });
  }
};

// Customer dashboard: create order when customer has no active order.
const startCustomerOrder = async (req, res) => {
  try {
    const auth = await getCustomerUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message
      });
    }

    const customerId = auth.userId;
    await query('SELECT cleanup_expired_failures()');

    const deliveryLocation = (req.body.delivery_location || '').toString().trim();
    const requestedCapacityRaw = req.body.requested_capacity;
    const customerBidPriceRaw = req.body.customer_bid_price;

    if (!deliveryLocation) {
      return res.status(400).json({
        success: false,
        message: 'delivery_location is required'
      });
    }

    if (requestedCapacityRaw === undefined || requestedCapacityRaw === null || requestedCapacityRaw === '') {
      return res.status(400).json({
        success: false,
        message: 'requested_capacity is required'
      });
    }

    if (customerBidPriceRaw === undefined || customerBidPriceRaw === null || customerBidPriceRaw === '') {
      return res.status(400).json({
        success: false,
        message: 'customer_bid_price is required'
      });
    }

    const requestedCapacity = Number(requestedCapacityRaw);
    const customerBidPrice = Number(customerBidPriceRaw);

    if (!Number.isFinite(requestedCapacity) || requestedCapacity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'requested_capacity must be a positive number'
      });
    }

    if (!Number.isFinite(customerBidPrice) || customerBidPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'customer_bid_price must be a positive number'
      });
    }

    const activeOrderCheckResult = await query(
      `SELECT order_id, status
       FROM orders
       WHERE customer_id = $1
         AND status IN ('open', 'supplier_timer', 'accepted', 'ride_started', 'reached')
       ORDER BY created_at DESC
       LIMIT 1`,
      [customerId]
    );

    const existingActiveOrder = activeOrderCheckResult.rows[0] || null;
    if (existingActiveOrder) {
      return res.status(409).json({
        success: false,
        message: 'You already have an active order. Complete or cancel it before placing a new one',
        data: {
          active_order_id: existingActiveOrder.order_id,
          active_order_status: existingActiveOrder.status
        }
      });
    }

    const dbResult = await query('SELECT START_ORDER($1, $2, $3, $4) AS result', [
      customerId,
      deliveryLocation,
      requestedCapacity,
      customerBidPrice
    ]);
    const response = dbResult.rows[0].result;

    if (!response || response.code !== 1) {
      return res.status(400).json({
        success: false,
        message: response?.message || 'Failed to create order'
      });
    }

    return res.status(200).json({
      success: true,
      message: response.message || 'Order created successfully',
      data: {
        order_id: response.order_id,
        next_screen: 'orders_marketplace'
      }
    });
  } catch (error) {
    console.error('Start customer order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create customer order',
      error: error.message
    });
  }
};

// Customer marketplace: view valid supplier bids for own open order.
const listBidsForCustomerOpenOrder = async (req, res) => {
  try {
    const auth = await getCustomerUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message
      });
    }

    const customerId = auth.userId;
    const orderId = Number(req.params.orderId);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'orderId must be a positive integer'
      });
    }

    const dbResult = await query('SELECT view_order_bids_customer($1, $2) AS result', [
      customerId,
      orderId
    ]);
    const response = dbResult.rows[0].result;

    if (!response || response.code !== 1) {
      const message = (response?.message || '').toString().toLowerCase();
      const statusCode = message.includes('does not belong to you') ? 403 : 400;

      return res.status(statusCode).json({
        success: false,
        message: response?.message || 'Failed to fetch bids'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        order_id: response.order_id,
        bids: Array.isArray(response.bids) ? response.bids : []
      }
    });
  } catch (error) {
    console.error('List customer order bids error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch order bids',
      error: error.message
    });
  }
};

// Customer marketplace: update own bid on open order.
const updateCustomerOpenOrderBid = async (req, res) => {
  try {
    const auth = await getCustomerUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message
      });
    }

    const customerId = auth.userId;
    const orderId = Number(req.params.orderId);
    const customerBidPrice = Number(req.body.customer_bid_price);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'orderId must be a positive integer'
      });
    }

    if (!Number.isFinite(customerBidPrice) || customerBidPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'customer_bid_price must be a positive number'
      });
    }

    const dbResult = await query('SELECT update_customer_open_order_bid($1, $2, $3) AS result', [
      customerId,
      orderId,
      customerBidPrice
    ]);
    const response = dbResult.rows[0].result;

    if (!response || response.code !== 1) {
      const message = (response?.message || '').toString().toLowerCase();
      const statusCode = message.includes('does not belong to you')
        ? 403
        : message.includes('cannot update bid')
          ? 409
          : 400;

      return res.status(statusCode).json({
        success: false,
        message: response?.message || 'Failed to update bid'
      });
    }

    return res.status(200).json({
      success: true,
      message: response.message || 'Order bid updated successfully',
      data: {
        order_id: response.order_id,
        customer_bid_price: response.customer_bid_price
      }
    });
  } catch (error) {
    console.error('Update customer open order bid error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update order bid',
      error: error.message
    });
  }
};

// Customer marketplace: accept supplier bid for own open order.
const acceptSupplierBidForCustomer = async (req, res) => {
  try {
    const auth = await getCustomerUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message
      });
    }

    const customerId = auth.userId;
    const orderId = Number(req.params.orderId);
    const bidId = Number(req.body.bid_id);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'orderId must be a positive integer'
      });
    }

    if (!Number.isInteger(bidId) || bidId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'bid_id must be a positive integer'
      });
    }

    const bidBelongsResult = await query(
      'SELECT 1 FROM bids WHERE bid_id = $1 AND order_id = $2',
      [bidId, orderId]
    );

    if (bidBelongsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bid not found for this order'
      });
    }

    const dbResult = await query('SELECT accept_bid($1, $2) AS result', [
      bidId,
      customerId
    ]);
    const response = dbResult.rows[0].result;

    if (!response || response.code !== 1) {
      const message = (response?.message || '').toString().toLowerCase();
      const statusCode = message.includes('expired')
        ? 410
        : message.includes('capacity') || message.includes('not available') || message.includes('no available drivers')
          ? 409
          : 400;

      return res.status(statusCode).json({
        success: false,
        message: response?.message || 'Failed to accept bid'
      });
    }

    return res.status(200).json({
      success: true,
      message: response.message || 'Bid accepted successfully',
      data: {
        order_id: orderId,
        bid_id: bidId,
        next_screen: 'active_order'
      }
    });
  } catch (error) {
    console.error('Accept supplier bid for customer error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to accept supplier bid',
      error: error.message
    });
  }
};

// Customer post-delivery: submit rating or explicitly skip rating (null).
const submitOrderRatingForCustomer = async (req, res) => {
  try {
    const auth = await getCustomerUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message
      });
    }

    const customerId = auth.userId;
    const orderId = Number(req.params.orderId);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'orderId must be a positive integer'
      });
    }

    let rating = null;
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'rating')) {
      const rawRating = req.body.rating;
      if (rawRating !== null && rawRating !== undefined && rawRating !== '') {
        rating = Number(rawRating);
      }
    }

    if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        message: 'rating must be null or an integer between 1 and 5'
      });
    }

    const dbResult = await query('SELECT submit_rating($1, $2, $3) AS result', [
      customerId,
      orderId,
      rating
    ]);
    const response = dbResult.rows[0].result;

    if (!response || response.code !== 1) {
      const msg = (response?.message || '').toString().toLowerCase();
      const statusCode = msg.includes('already submitted') ? 409 : 400;

      return res.status(statusCode).json({
        success: false,
        message: response?.message || 'Failed to submit rating'
      });
    }

    return res.status(200).json({
      success: true,
      message: response.message || 'Rating submitted successfully',
      data: {
        order_id: orderId,
        rating: rating
      }
    });
  } catch (error) {
    console.error('Submit rating error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit rating',
      error: error.message
    });
  }
};



// Supplier marketplace: view currently open orders.
const listAvailableOrdersForSupplier = async (req, res) => {
  try {
    const auth = await getSupplierUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message
      });
    }

    const dbResult = await query('SELECT view_available_orders() AS result');
    const response = dbResult.rows[0].result;

    if (response && !Array.isArray(response) && response.error) {
      return res.status(400).json({
        success: false,
        message: response.error
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        orders: Array.isArray(response) ? response : []
      }
    });
  } catch (error) {
    console.error('List available orders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch available orders',
      error: error.message
    });
  }
};

// Supplier marketplace: view details of one open order.
const getAvailableOrderDetailsForSupplier = async (req, res) => {
  try {
    const auth = await getSupplierUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message
      });
    }

    const orderId = Number(req.params.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'orderId must be a positive integer'
      });
    }

    const dbResult = await query('SELECT view_order_details($1, $2) AS result', [orderId, auth.userId]);
    const response = dbResult.rows[0].result;

    if (!response || response.code !== 1) {
      const message = (response?.message || '').toString().toLowerCase();
      const statusCode = message.includes('available linked driver') ? 403 : 400;

      return res.status(statusCode).json({
        success: false,
        message: response?.message || 'Failed to fetch order details'
      });
    }

    return res.status(200).json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Get available order details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch order details',
      error: error.message
    });
  }
};

// Supplier marketplace: place bid on open order.
const placeSupplierBid = async (req, res) => {
  try {
    const auth = await getSupplierUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message
      });
    }

    const supplierId = auth.userId;
    const orderId = Number(req.params.orderId);
    const bidPrice = Number(req.body.bid_price);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'orderId must be a positive integer'
      });
    }

    if (!Number.isFinite(bidPrice) || bidPrice <= 0) {
      return res.status(400).json({
        success: false,
        message: 'bid_price must be a positive number'
      });
    }

    const supplierDriverAvailabilityResult = await query(
      `SELECT COUNT(*)::int AS available_driver_count
       FROM supplier_drivers
       WHERE supplier_user_id = $1
         AND driver_user_id IS NOT NULL
         AND available = TRUE`,
      [supplierId]
    );

    const availableDriverCount = supplierDriverAvailabilityResult.rows[0]?.available_driver_count || 0;
    if (availableDriverCount <= 0) {
      return res.status(409).json({
        success: false,
        message: 'You need at least one available linked driver before placing bids'
      });
    }

    const dbResult = await query('SELECT send_bid($1, $2, $3) AS result', [
      orderId,
      supplierId,
      bidPrice
    ]);
    const response = dbResult.rows[0].result;

    if (!response || response.code !== 1) {
      const message = (response?.message || '').toString().toLowerCase();
      const statusCode = response?.retry_after_seconds
        ? 429
        : message.includes('not available') || message.includes('capacity')
          ? 409
          : 400;

      return res.status(statusCode).json({
        success: false,
        message: response?.message || 'Failed to place bid',
        data: response?.retry_after_seconds
          ? { retry_after_seconds: response.retry_after_seconds }
          : undefined
      });
    }

    return res.status(200).json({
      success: true,
      message: response.message || 'Bid placed successfully',
      data: {
        order_id: orderId,
        supplier_id: supplierId,
        expires_at: response.expires_at || null
      }
    });
  } catch (error) {
    console.error('Place supplier bid error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to place supplier bid',
      error: error.message
    });
  }
};

// Supplier dashboard: view all active orders assigned to supplier.
const listActiveOrdersForSupplier = async (req, res) => {
  try {
    const auth = await getSupplierUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message
      });
    }

    const supplierId = auth.userId;
    const dbResult = await query('SELECT get_active_orders_supplier($1) AS result', [supplierId]);
    const response = dbResult.rows[0].result;

    if (!response || response.code !== 1) {
      return res.status(400).json({
        success: false,
        message: response?.message || 'Failed to fetch active supplier orders'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        supplier_user_id: supplierId,
        orders: Array.isArray(response.orders) ? response.orders : []
      }
    });
  } catch (error) {
    console.error('List active supplier orders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch active supplier orders',
      error: error.message
    });
  }
};

// Supplier dashboard: view details for one active/assigned order.
const getActiveOrderDetailsForSupplier = async (req, res) => {
  try {
    const auth = await getSupplierUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message
      });
    }

    const supplierId = auth.userId;
    const orderId = Number(req.params.orderId);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'orderId must be a positive integer'
      });
    }

    const dbResult = await query('SELECT get_order_details_supplier($1, $2) AS result', [
      supplierId,
      orderId
    ]);
    const response = dbResult.rows[0].result;

    if (!response || response.code !== 1) {
      const msg = (response?.message || '').toString().toLowerCase();
      const statusCode = msg.includes('supplier time limit has expired') ? 410 : 400;
      return res.status(statusCode).json({
        success: false,
        message: response?.message || 'Failed to fetch supplier order details'
      });
    }

    return res.status(200).json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Get active supplier order details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch supplier order details',
      error: error.message
    });
  }
};

// Supplier dashboard: list assignable drivers for one active order.
const listAssignableDriversForSupplierOrder = async (req, res) => {
  try {
    const auth = await getSupplierUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message
      });
    }

    const supplierId = auth.userId;
    const orderId = Number(req.params.orderId);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'orderId must be a positive integer'
      });
    }

    // Check if supplier time limit has passed
    const orderCheckResult = await query(
      'SELECT time_limit_for_supplier FROM orders WHERE order_id = $1 AND supplier_id = $2',
      [orderId, supplierId]
    );

    if (orderCheckResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or does not belong to you'
      });
    }

    const timeLimitForSupplier = orderCheckResult.rows[0].time_limit_for_supplier;
    const now = new Date();

    if (timeLimitForSupplier && new Date(timeLimitForSupplier) < now) {
      return res.status(410).json({
        success: false,
        message: 'Supplier time limit has expired for this order'
      });
    }

    const dbResult = await query('SELECT get_available_drivers_for_supplier($1, $2) AS result', [
      supplierId,
      orderId
    ]);
    const response = dbResult.rows[0].result;

    if (!response || response.code !== 1) {
      return res.status(400).json({
        success: false,
        message: response?.message || 'Failed to fetch assignable drivers'
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        order_id: orderId,
        drivers: Array.isArray(response.drivers) ? response.drivers : []
      }
    });
  } catch (error) {
    console.error('List assignable drivers error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch assignable drivers',
      error: error.message
    });
  }
};

// Supplier dashboard: assign one driver to one active order.
const assignDriverForSupplierOrder = async (req, res) => {
  try {
    const auth = await getSupplierUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message
      });
    }

    const supplierId = auth.userId;
    const orderId = Number(req.params.orderId);
    const driverId = Number(req.body.driver_id);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'orderId must be a positive integer'
      });
    }

    if (!Number.isInteger(driverId) || driverId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'driver_id must be a positive integer'
      });
    }

    // Check if supplier time limit has passed
    const orderCheckResult = await query(
      'SELECT time_limit_for_supplier FROM orders WHERE order_id = $1 AND supplier_id = $2',
      [orderId, supplierId]
    );

    if (orderCheckResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or does not belong to you'
      });
    }

    const timeLimitForSupplier = orderCheckResult.rows[0].time_limit_for_supplier;
    const now = new Date();

    if (timeLimitForSupplier && new Date(timeLimitForSupplier) < now) {
      return res.status(410).json({
        success: false,
        message: 'Supplier time limit has expired for this order'
      });
    }

    const dbResult = await query('SELECT assign_driver_to_order($1, $2, $3) AS result', [
      orderId,
      supplierId,
      driverId
    ]);
    const response = dbResult.rows[0].result;

    if (!response || response.code !== 1) {
      const message = (response?.message || '').toString().toLowerCase();
      const statusCode = message.includes('pending assignment')
        ? 409
        : message.includes('not available') || message.includes('does not belong')
          ? 400
          : 400;

      return res.status(statusCode).json({
        success: false,
        message: response?.message || 'Failed to assign driver'
      });
    }

    return res.status(200).json({
      success: true,
      message: response.message || 'Driver assigned successfully',
      data: {
        order_id: orderId,
        driver_id: driverId
      }
    });
  } catch (error) {
    console.error('Assign driver error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign driver',
      error: error.message
    });
  }
};

// Driver flow: accept assigned order.
const acceptAssignedOrderForDriver = async (req, res) => {
  try {
    const auth = await getDriverUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message
      });
    }

    const driverId = auth.userId;
    const orderId = Number(req.params.orderId);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'orderId must be a positive integer'
      });
    }

    const dbResult = await query('SELECT confirm_order_driver($1, $2) AS result', [
      driverId,
      orderId
    ]);
    const response = dbResult.rows[0].result;

    if (!response || response.code !== 1) {
      const message = (response?.message || '').toString().toLowerCase();
      const statusCode = message.includes('expired') ? 410 : 409;

      return res.status(statusCode).json({
        success: false,
        message: response?.message || 'Failed to accept assigned order'
      });
    }

    return res.status(200).json({
      success: true,
      message: response.message || 'Order confirmed successfully',
      data: {
        order_id: orderId,
        next_screen: 'driver_active_order'
      }
    });
  } catch (error) {
    console.error('Driver accept order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to accept assigned order',
      error: error.message
    });
  }
};

// Driver flow: reject assigned order.
const rejectAssignedOrderForDriver = async (req, res) => {
  try {
    const auth = await getDriverUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message
      });
    }

    const driverId = auth.userId;
    const orderId = Number(req.params.orderId);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'orderId must be a positive integer'
      });
    }

    const dbResult = await query('SELECT reject_order_driver($1, $2) AS result', [
      driverId,
      orderId
    ]);
    const response = dbResult.rows[0].result;

    if (!response || response.code !== 1) {
      const message = (response?.message || '').toString().toLowerCase();
      const statusCode = message.includes('expired') ? 410 : 409;

      return res.status(statusCode).json({
        success: false,
        message: response?.message || 'Failed to reject assigned order'
      });
    }

    return res.status(200).json({
      success: true,
      message: response.message || 'Order rejected successfully',
      data: {
        order_id: orderId
      }
    });
  } catch (error) {
    console.error('Driver reject order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reject assigned order',
      error: error.message
    });
  }
};

// Driver flow: move accepted order to ride_started.
const startRideForDriver = async (req, res) => {
  try {
    const auth = await getDriverUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message
      });
    }

    const driverId = auth.userId;
    const orderId = Number(req.params.orderId);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'orderId must be a positive integer'
      });
    }

    const dbResult = await query('SELECT start_ride($1, $2) AS result', [driverId, orderId]);
    const response = dbResult.rows[0].result;

    if (!response || response.code !== 1) {
      return res.status(409).json({
        success: false,
        message: response?.message || 'Failed to start ride'
      });
    }

    return res.status(200).json({
      success: true,
      message: response.message || 'Ride started successfully',
      data: {
        order_id: orderId,
        status: 'ride_started'
      }
    });
  } catch (error) {
    console.error('Driver start ride error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to start ride',
      error: error.message
    });
  }
};

// Driver flow: mark ride as reached.
const markOrderReachedForDriver = async (req, res) => {
  try {
    const auth = await getDriverUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message
      });
    }

    const driverId = auth.userId;
    const orderId = Number(req.params.orderId);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'orderId must be a positive integer'
      });
    }

    const dbResult = await query('SELECT mark_order_reached($1, $2) AS result', [driverId, orderId]);
    const response = dbResult.rows[0].result;

    if (!response || response.code !== 1) {
      return res.status(409).json({
        success: false,
        message: response?.message || 'Failed to mark order as reached'
      });
    }

    return res.status(200).json({
      success: true,
      message: response.message || 'Marked as reached successfully',
      data: {
        order_id: orderId,
        status: 'reached'
      }
    });
  } catch (error) {
    console.error('Driver mark reached error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark order as reached',
      error: error.message
    });
  }
};

// Driver flow: finish delivery and archive order snapshot.
const finishOrderForDriver = async (req, res) => {
  try {
    const auth = await getDriverUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        message: auth.message
      });
    }

    const driverId = auth.userId;
    const orderId = Number(req.params.orderId);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'orderId must be a positive integer'
      });
    }

    const dbResult = await query('SELECT finish_order($1, $2) AS result', [driverId, orderId]);
    const response = dbResult.rows[0].result;

    if (!response || response.code !== 1) {
      return res.status(409).json({
        success: false,
        message: response?.message || 'Failed to finish order'
      });
    }

    return res.status(200).json({
      success: true,
      message: response.message || 'Order completed successfully',
      data: {
        order_id: orderId,
        status: 'completed'
      }
    });
  } catch (error) {
    console.error('Driver finish order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to finish order',
      error: error.message
    });
  }
};

module.exports = {
  appStartup,
  enterNumber,
  storeOTP,
  verifyOTP,
  enterDetailsCustomer,
  enterDetailsDriver,
  enterDetailsSupplier,
  addSupplierDriver,
  listSupplierDrivers,
  removeSupplierDriver,
  getSupplierDriverReadiness,
  getCustomerQuantityPricing,
  startCustomerOrder,
  listBidsForCustomerOpenOrder,
  updateCustomerOpenOrderBid,
  acceptSupplierBidForCustomer,
  submitOrderRatingForCustomer,
  listAvailableOrdersForSupplier,
  getAvailableOrderDetailsForSupplier,
  placeSupplierBid,
  listActiveOrdersForSupplier,
  getActiveOrderDetailsForSupplier,
  listAssignableDriversForSupplierOrder,
  assignDriverForSupplierOrder,
  acceptAssignedOrderForDriver,
  rejectAssignedOrderForDriver,
  startRideForDriver,
  markOrderReachedForDriver,
  finishOrderForDriver
};

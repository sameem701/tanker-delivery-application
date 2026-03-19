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

module.exports = {
  appStartup,
  enterNumber,
  storeOTP,
  verifyOTP,
  enterDetailsCustomer,
  enterDetailsDriver,
  enterDetailsSupplier
};

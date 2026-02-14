const { query } = require('../config/database');

// Middleware to verify session token using check_session stored procedure
const authMiddleware = async (req, res, next) => {
  try {
    // Extract token from Authorization header (Bearer token format)
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No session token provided.' 
      });
    }

    // Call check_session stored procedure
    const result = await query(
      'SELECT check_session($1) as result',
      [token]
    );

    const response = result.rows[0].result;

    // Check if session is valid
    if (response.code === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired session token.' 
      });
    }

    // Session is valid, get user details
    const userResult = await query(
      'SELECT user_id, role, verified FROM users WHERE user_id = $1',
      [response.user_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found.' 
      });
    }

    const user = userResult.rows[0];

    // Check if user is verified
    if (!user.verified) {
      return res.status(403).json({ 
        success: false, 
        message: 'Account not verified. Please complete OTP verification.' 
      });
    }

    // Attach user info to request object
    req.user = {
      user_id: user.user_id,
      role: user.role,
      verified: user.verified
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Authentication error.' 
    });
  }
};

// Middleware to check user role
const roleCheck = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required.' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Insufficient permissions.' 
      });
    }

    next();
  };
};

module.exports = { authMiddleware, roleCheck };

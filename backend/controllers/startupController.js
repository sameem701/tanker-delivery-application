const { query } = require('../config/database');

const appStartup = async (req, res) => {
  try {
    const sessionToken = req.body.session_token || req.headers['x-session-token'] || null;

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

    // Existing valid session goes to dashboard according to requested behavior.
    return res.status(200).json({
      success: true,
      next_screen: 'dashboard',
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

module.exports = {
  appStartup
};

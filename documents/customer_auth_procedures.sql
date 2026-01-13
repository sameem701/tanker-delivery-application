-- ============================================================================
-- CUSTOMER AUTHENTICATION PROCEDURES, FUNCTIONS & TRIGGERS
-- ============================================================================
-- Created: January 11, 2026
-- Purpose: Handle customer registration, verification, and login
-- ============================================================================


-- ============================================================================
-- SESSIONS TABLE: Store authentication tokens
-- ============================================================================
CREATE TABLE IF NOT EXISTS sessions (
    session_id SERIAL PRIMARY KEY,
    session_token VARCHAR(64) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);


-- ============================================================================
-- HELPER FUNCTION: Generate secure session token
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_session_token()
RETURNS VARCHAR(64) AS $$
BEGIN
    -- Generate 32 random bytes and encode as 64-character hex string
    RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- HELPER FUNCTION: Generate 6-digit verification code
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_verification_code()
RETURNS VARCHAR(6) AS $$
BEGIN
    RETURN LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- TRIGGER: Auto-update UPDATED_AT timestamp on orders
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.UPDATED_AT = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON ORDERS
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- FUNCTION: Customer Registration
-- ============================================================================
-- Purpose: Register a new customer and generate verification code
-- Parameters:
--   p_name: Customer's full name
--   p_phone: Customer's phone number (must be unique)
-- Returns: JSON object with user_id, verification_code, and status
-- ============================================================================
CREATE OR REPLACE FUNCTION register_customer(
    p_name VARCHAR(100),
    p_phone VARCHAR(20)
)
RETURNS JSON AS $$
DECLARE
    v_user_id INTEGER;
    v_verification_code VARCHAR(6);
    v_phone_exists BOOLEAN;
BEGIN
    -- Check if phone number already exists
    SELECT EXISTS(SELECT 1 FROM users WHERE phone = p_phone) INTO v_phone_exists;
    
    IF v_phone_exists THEN
        RETURN json_build_object(
            'success', false,
            'error', 'PHONE_ALREADY_EXISTS',
            'message', 'This phone number is already registered'
        );
    END IF;
    
    -- Validate inputs
    IF p_name IS NULL OR TRIM(p_name) = '' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'INVALID_NAME',
            'message', 'Name cannot be empty'
        );
    END IF;
    
    IF p_phone IS NULL OR TRIM(p_phone) = '' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'INVALID_PHONE',
            'message', 'Phone number cannot be empty'
        );
    END IF;
    
    -- Generate verification code
    v_verification_code := generate_verification_code();
    
    -- Insert new customer
    INSERT INTO users (name, phone, role, verification_code, verified, CREATED_AT)
    VALUES (TRIM(p_name), TRIM(p_phone), 'customer', v_verification_code, FALSE, CURRENT_TIMESTAMP)
    RETURNING user_id INTO v_user_id;
    
    -- Return success response
    RETURN json_build_object(
        'success', true,
        'user_id', v_user_id,
        'verification_code', v_verification_code,
        'message', 'Customer registered successfully. Please verify your phone number.'
    );
    
EXCEPTION
    WHEN unique_violation THEN
        RETURN json_build_object(
            'success', false,
            'error', 'PHONE_ALREADY_EXISTS',
            'message', 'This phone number is already registered'
        );
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'REGISTRATION_FAILED',
            'message', 'Registration failed: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: Verify Customer Phone Number
-- ============================================================================
-- Purpose: Verify customer's phone number using verification code
-- Parameters:
--   p_phone: Customer's phone number
--   p_verification_code: 6-digit verification code sent to customer
-- Returns: JSON object with verification status
-- ============================================================================
CREATE OR REPLACE FUNCTION verify_customer(
    p_phone VARCHAR(20),
    p_verification_code VARCHAR(6)
)
RETURNS JSON AS $$
DECLARE
    v_user RECORD;
BEGIN
    -- Find user with matching phone and role
    SELECT user_id, verification_code, verified, role
    INTO v_user
    FROM users
    WHERE phone = p_phone AND role = 'customer';
    
    -- Check if user exists
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'USER_NOT_FOUND',
            'message', 'No customer account found with this phone number'
        );
    END IF;
    
    -- Check if already verified
    IF v_user.verified THEN
        RETURN json_build_object(
            'success', true,
            'message', 'Phone number is already verified',
            'user_id', v_user.user_id
        );
    END IF;
    
    -- Verify the code
    IF v_user.verification_code = p_verification_code THEN
        -- Update user as verified
        UPDATE users
        SET verified = TRUE,
            verification_code = NULL
        WHERE user_id = v_user.user_id;
        
        RETURN json_build_object(
            'success', true,
            'user_id', v_user.user_id,
            'message', 'Phone number verified successfully'
        );
    ELSE
        RETURN json_build_object(
            'success', false,
            'error', 'INVALID_CODE',
            'message', 'Invalid verification code'
        );
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'VERIFICATION_FAILED',
            'message', 'Verification failed: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: Resend Verification Code
-- ============================================================================
-- Purpose: Generate and return a new verification code for unverified customer
-- Parameters:
--   p_phone: Customer's phone number
-- Returns: JSON object with new verification code
-- ============================================================================
CREATE OR REPLACE FUNCTION resend_verification_code(
    p_phone VARCHAR(20)
)
RETURNS JSON AS $$
DECLARE
    v_user RECORD;
    v_new_code VARCHAR(6);
BEGIN
    -- Find unverified user
    SELECT user_id, verified, role
    INTO v_user
    FROM users
    WHERE phone = p_phone AND role = 'customer';
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'USER_NOT_FOUND',
            'message', 'No customer account found with this phone number'
        );
    END IF;
    
    IF v_user.verified THEN
        RETURN json_build_object(
            'success', false,
            'error', 'ALREADY_VERIFIED',
            'message', 'This phone number is already verified'
        );
    END IF;
    
    -- Generate new code
    v_new_code := generate_verification_code();
    
    -- Update verification code
    UPDATE users
    SET verification_code = v_new_code
    WHERE user_id = v_user.user_id;
    
    RETURN json_build_object(
        'success', true,
        'verification_code', v_new_code,
        'message', 'New verification code generated'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'RESEND_FAILED',
            'message', 'Failed to resend code: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: Customer Login
-- ============================================================================
-- Purpose: Authenticate customer and return session token
-- Parameters:
--   p_phone: Customer's phone number
-- Returns: JSON object with user details and session token
-- ============================================================================
CREATE OR REPLACE FUNCTION login_customer(
    p_phone VARCHAR(20)
)
RETURNS JSON AS $$
DECLARE
    v_user RECORD;
    v_session_token VARCHAR(64);
    v_expires_at TIMESTAMP;
BEGIN
    -- Find user with matching phone and role
    SELECT user_id, name, phone, verified, role, CREATED_AT
    INTO v_user
    FROM users
    WHERE phone = p_phone AND role = 'customer';
    
    -- Check if user exists
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'USER_NOT_FOUND',
            'message', 'No customer account found with this phone number'
        );
    END IF;
    
    -- Check if user is verified
    IF NOT v_user.verified THEN
        RETURN json_build_object(
            'success', false,
            'error', 'NOT_VERIFIED',
            'message', 'Please verify your phone number before logging in'
        );
    END IF;
    
    -- Generate session token
    v_session_token := generate_session_token();
    v_expires_at := CURRENT_TIMESTAMP + INTERVAL '30 days';
    
    -- Store session in database
    INSERT INTO sessions (session_token, user_id, expires_at)
    VALUES (v_session_token, v_user.user_id, v_expires_at);
    
    -- Return user details with token
    RETURN json_build_object(
        'success', true,
        'session_token', v_session_token,
        'expires_at', v_expires_at,
        'user', json_build_object(
            'user_id', v_user.user_id,
            'name', v_user.name,
            'phone', v_user.phone,
            'role', v_user.role,
            'created_at', v_user.CREATED_AT
        ),
        'message', 'Login successful'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'LOGIN_FAILED',
            'message', 'Login failed: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: Validate Session Token
-- ============================================================================
-- Purpose: Check if token is valid and return user details
-- Parameters:
--   p_token: Session token from device
-- Returns: JSON object with user details if valid
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_session(
    p_token VARCHAR(64)
)
RETURNS JSON AS $$
DECLARE
    v_session RECORD;
    v_user RECORD;
BEGIN
    -- Find active session
    SELECT session_id, user_id, expires_at
    INTO v_session
    FROM sessions
    WHERE session_token = p_token
    AND expires_at > CURRENT_TIMESTAMP;
    
    -- Check if session exists and is valid
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'INVALID_TOKEN',
            'message', 'Session expired or invalid. Please login again.'
        );
    END IF;
    
    -- Update last used timestamp
    UPDATE sessions
    SET last_used_at = CURRENT_TIMESTAMP
    WHERE session_id = v_session.session_id;
    
    -- Get user details
    SELECT user_id, name, phone, role, CREATED_AT
    INTO v_user
    FROM users
    WHERE user_id = v_session.user_id;
    
    -- Return user details
    RETURN json_build_object(
        'success', true,
        'user', json_build_object(
            'user_id', v_user.user_id,
            'name', v_user.name,
            'phone', v_user.phone,
            'role', v_user.role,
            'created_at', v_user.CREATED_AT
        ),
        'message', 'Session valid'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'VALIDATION_FAILED',
            'message', 'Session validation failed: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: Logout (Invalidate Session)
-- ============================================================================
-- Purpose: Delete session token to log out user
-- Parameters:
--   p_token: Session token to invalidate
-- Returns: JSON object with logout status
-- ============================================================================
CREATE OR REPLACE FUNCTION logout_customer(
    p_token VARCHAR(64)
)
RETURNS JSON AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Delete the session
    DELETE FROM sessions
    WHERE session_token = p_token;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    IF v_deleted_count > 0 THEN
        RETURN json_build_object(
            'success', true,
            'message', 'Logged out successfully'
        );
    ELSE
        RETURN json_build_object(
            'success', false,
            'error', 'TOKEN_NOT_FOUND',
            'message', 'Session not found'
        );
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'LOGOUT_FAILED',
            'message', 'Logout failed: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- EXAMPLE USAGE
-- ============================================================================

-- 1. Register a new customer
-- SELECT register_customer('John Doe', '+923001234567');

-- 2. Verify customer phone
-- SELECT verify_customer('+923001234567', '123456');

-- 3. Resend verification code
-- SELECT resend_verification_code('+923001234567');

-- 4. Login customer (returns session token)
-- SELECT login_customer('+923001234567');

-- 5. Validate session token (when app opens)
-- SELECT validate_session('a8f7d9e2c4b3f1a0...');

-- 6. Logout customer
-- SELECT logout_customer('a8f7d9e2c4b3f1a0...');


-- ============================================================================
-- CLEANUP: Remove expired sessions (run periodically via cron/scheduler)
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM sessions
    WHERE expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Usage: SELECT cleanup_expired_sessions();

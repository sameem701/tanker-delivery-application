CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('customer', 'supplier', 'driver', 'undefined')),
    verified BOOLEAN DEFAULT FALSE,
    CREATED_AT TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_address (
    user_id INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    home_address TEXT
);

-- Pending users table for new registrations (before OTP verification)
CREATE TABLE IF NOT EXISTS pending_users (
    phone VARCHAR(20) PRIMARY KEY,
    otp VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE IF NOT EXISTS SUPPLIERS (
    USER_ID INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    YARD_LOCATION TEXT NOT NULL,
    BUSINESS_CONTACT VARCHAR(20) NOT NULL,
    CNIC_FRONT_PATH TEXT NOT NULL,
    CNIC_BACK_PATH  TEXT NOT NULL,
    CREATED_AT TIMESTAMP NOT NULL
);


CREATE TABLE IF NOT EXISTS SUPPLIER_DRIVERS(
    DRIVER_PHONE_NUM VARCHAR(20) UNIQUE NOT NULL,       -- as specified by supplier
    SUPPLIER_USER_ID INT REFERENCES SUPPLIERS(USER_ID) ON DELETE CASCADE,
    DRIVER_USER_ID INTEGER UNIQUE  REFERENCES USERS(USER_ID) ON DELETE SET NULL DEFAULT NULL,
    AVAILABLE BOOLEAN DEFAULT TRUE,
    JOINED_AT TIMESTAMP,
    PRIMARY KEY (DRIVER_PHONE_NUM, SUPPLIER_USER_ID)
);


CREATE TABLE IF NOT EXISTS QUANTITY_PRICING (
    quantity_in_gallon INTEGER PRIMARY KEY,
    base_price INTEGER NOT NULL CHECK (base_price > 0)
);

-- Insert fixed pricing data for 7 available quantities
INSERT INTO QUANTITY_PRICING (quantity_in_gallon, base_price) VALUES
    (1000, 6500),
    (2000, 10000),
    (3000, 15000),
    (4000, 22000),
    (5000, 25000),
    (6000, 30000),
    (7000, 35000)
ON CONFLICT (quantity_in_gallon) DO UPDATE SET base_price = EXCLUDED.base_price;
-- ON CONFLICT updates pricing if quantity already exists



CREATE TABLE IF NOT EXISTS ORDERS (
    ORDER_ID SERIAL PRIMARY KEY,
    CUSTOMER_ID INTEGER NOT NULL REFERENCES USERS(USER_ID) ON DELETE CASCADE,
    SUPPLIER_ID INTEGER REFERENCES SUPPLIERS(USER_ID) ON DELETE CASCADE,
    DRIVER_ID INTEGER REFERENCES USERS(USER_ID)ON DELETE CASCADE,
    DELIVERY_LOCATION TEXT NOT NULL,
    REQUESTED_CAPACITY NUMERIC(5,0) NOT NULL CHECK (REQUESTED_CAPACITY > 0),
    CUSTOMER_BID_PRICE NUMERIC(10,0) NOT NULL CHECK (CUSTOMER_BID_PRICE > 0),
    TIME_LIMIT_FOR_SUPPLIER TIMESTAMP,
    ACCEPTED_PRICE NUMERIC(10,0),
    ORDER_CONFIRMED_AT TIMESTAMP,
    STATUS VARCHAR(20) DEFAULT 'open' NOT NULL CHECK (STATUS IN ('open', 'supplier_timer','accepted','ride_started','finished')),
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT DRIVER_REQUIRES_SUPPLIER CHECK ((DRIVER_ID IS NULL) OR (SUPPLIER_ID IS NOT NULL))
);


CREATE TABLE IF NOT EXISTS DRIVER_ASSIGNMENT (
    ORDER_ID INTEGER NOT NULL REFERENCES ORDERS(ORDER_ID) ON DELETE CASCADE,
    DRIVER_ID INTEGER NOT NULL REFERENCES USERS(USER_ID) ON DELETE CASCADE,
    SUPPLIER_ID INTEGER NOT NULL REFERENCES SUPPLIERS(USER_ID) ON DELETE CASCADE,
    TIME_LIMIT_FOR_DRIVER TIMESTAMP,
    order_rejected BOOLEAN DEFAULT FALSE,    
    PRIMARY KEY (ORDER_ID, DRIVER_ID)
);



CREATE TABLE IF NOT EXISTS BIDS (
    BID_ID SERIAL PRIMARY KEY,
    ORDER_ID INTEGER NOT NULL REFERENCES ORDERS(ORDER_ID) ON DELETE CASCADE,
    SUPPLIER_ID INTEGER NOT NULL REFERENCES SUPPLIERS(USER_ID) ON DELETE CASCADE,
    BID_PRICE INTEGER NOT NULL CHECK (BID_PRICE > 0),
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );



CREATE TABLE IF NOT EXISTS RATINGS (
    RATING_ID SERIAL PRIMARY KEY,
    ORDER_ID INTEGER NOT NULL UNIQUE REFERENCES ORDERS(ORDER_ID) ON DELETE CASCADE,
    SUPPLIER_ID INTEGER REFERENCES SUPPLIERS(USER_ID) ON DELETE SET NULL,
    DRIVER_ID INTEGER REFERENCES USERS(USER_ID) ON DELETE SET NULL,
    SUPPLIER_RATING INTEGER CHECK (SUPPLIER_RATING BETWEEN 1 AND 5),
    DRIVER_RATING INTEGER CHECK (DRIVER_RATING BETWEEN 1 AND 5),
    REASON TEXT,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE IF NOT EXISTS ORDER_HISTORY (
    HISTORY_ID SERIAL PRIMARY KEY,
    CUSTOMER_ID INTEGER NOT NULL REFERENCES USERS(USER_ID) ON DELETE SET NULL,
    ORDER_ID INTEGER NOT NULL REFERENCES ORDERS(ORDER_ID) ON DELETE CASCADE,
    SUPPLIER_ID INTEGER REFERENCES SUPPLIERS(USER_ID) ON DELETE SET NULL,
    YARD_LOCATION TEXT NOT NULL,
    PRICE INTEGER NOT NULL CHECK (PRICE >= 0),
    QUANTITY INTEGER NOT NULL CHECK (QUANTITY > 0),
    STATUS VARCHAR(20) NOT NULL CHECK (STATUS IN ('completed', 'cancelled')),
    ORDER_DATE TIMESTAMP NOT NULL
);


-- For local storage of tokens
CREATE TABLE IF NOT EXISTS sessions (
    token VARCHAR(255) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE
);


-- ============================================================================
-- TRIGGER: Auto set driver_user_id to NULL when driver's session is deleted
-- ============================================================================
-- Purpose: When a driver logs out (session deleted), automatically mark them
--          as inactive in supplier_drivers table by setting driver_user_id to NULL
--          This allows seamless re-linking when driver returns
-- ============================================================================
CREATE OR REPLACE FUNCTION on_session_delete_unlink_driver()
RETURNS TRIGGER AS $$
DECLARE
    v_user_role VARCHAR(20);
BEGIN
    -- Get the role of the user whose session is being deleted
    SELECT role INTO v_user_role
    FROM users
    WHERE user_id = OLD.user_id;
    
    -- If the user is a driver, unlink them from supplier_drivers
    IF v_user_role = 'driver' THEN
        UPDATE supplier_drivers
        SET driver_user_id = NULL
        WHERE driver_user_id = OLD.user_id;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_unlink_driver_on_session_delete ON sessions;
CREATE TRIGGER trigger_unlink_driver_on_session_delete
    AFTER DELETE ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION on_session_delete_unlink_driver();


--------------------------------------------------------
--FUNCTIONS AND PROCEDURES
--------------------------------------------------------

-- Purpose: Check if a session token exists and return user_id if it does
-- Parameters:
--   p_token: Session token to check
-- Returns: JSON object
-- Code: 0=Session doesn't exist, 1=Session exists (with user_id)
CREATE OR REPLACE FUNCTION check_session(
    p_token VARCHAR(255)
)
RETURNS JSON AS $$
DECLARE
    v_user_id INTEGER;
BEGIN
    
    -- Check if session exists and get user_id
    SELECT user_id INTO v_user_id
    FROM sessions
    WHERE token = p_token;
    
    IF v_user_id IS NULL THEN
        -- Session doesn't exist
        RETURN json_build_object(
            'code', 0
        );
    ELSE
        -- Session exists, return user_id
        RETURN json_build_object(
            'code', 1,
            'user_id', v_user_id
        );
    END IF;
    
END;
$$ LANGUAGE plpgsql;


-- Purpose: Checks if the entered phone number already exists, 
-- code:
-- 0: Phone number registered (new user, pending OTP),  1: Phone number exists, 2: Error
CREATE OR REPLACE FUNCTION phone_number_exists(
    p_phone IN VARCHAR(20)
)
RETURNS JSON AS $$
DECLARE
    v_existing_user_id INTEGER;
    v_pending_phone VARCHAR(20);
BEGIN
    -- Validate phone number
    IF p_phone IS NULL OR TRIM(p_phone) = '' THEN
        RETURN json_build_object(
            'code', 2,
            'message', 'Phone number cannot be empty'
        );
    END IF;
    
    -- Check if phone number already exists in users table
    SELECT user_id INTO v_existing_user_id 
    FROM users 
    WHERE phone = p_phone;
    
    IF v_existing_user_id IS NOT NULL THEN
        UPDATE USERS
        SET VERIFIED = FALSE
        WHERE USER_ID = v_existing_user_id;
    END IF;

    -- Check if phone number exists in pending_users
    SELECT phone INTO v_pending_phone
    FROM pending_users
    WHERE phone = p_phone;
    
    IF v_pending_phone IS NOT NULL THEN
        -- Phone already in pending, just return
        RETURN json_build_object(
            'code', 1,
            'phone', v_pending_phone,
            'message', 'New phone number registered (pending verification)'
        );
    ELSE
        -- Insert new pending user (only phone)
        INSERT INTO pending_users (phone)
        VALUES (TRIM(p_phone));
        
        -- Return success response
        RETURN json_build_object(
            'code', 0,
            'phone', TRIM(p_phone),
            'message', 'New phone number registered (pending verification)'
        );
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 2,
            'message', 'Registration failed: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- Purpose: Store or udpate OTP in pending_users table
-- Parameters:
--   p_phone: Phone number
--   p_otp: Plain text OTP
-- Returns: JSON object with success status
CREATE OR REPLACE FUNCTION store_otp(
    p_phone VARCHAR(20),
    p_otp VARCHAR(6)
)
RETURNS JSON AS $$
DECLARE
    v_pending_exists BOOLEAN;
BEGIN
    -- Validate inputs
    IF p_phone IS NULL OR TRIM(p_phone) = '' THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Phone number cannot be empty'
        );
    END IF;
    
    IF p_otp IS NULL OR LENGTH(p_otp) != 6 THEN
        RETURN json_build_object(
            'success', false,
            'message', 'OTP must be 6 digits'
        );
    END IF;
    
    -- Check if pending user exists
    SELECT EXISTS(SELECT 1 FROM pending_users WHERE phone = p_phone) INTO v_pending_exists;
    
    IF NOT v_pending_exists THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Phone number not found in pending users'
        );
    END IF;
    
    -- Update OTP in pending_users and set created_at
    UPDATE pending_users
    SET otp = p_otp,
        created_at = CURRENT_TIMESTAMP
    WHERE phone = p_phone;
    
    RETURN json_build_object(
        'success', true,
        'message', 'OTP stored successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Failed to store OTP: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- Purpose: Create a session token for a user
-- Parameters:
--   p_user_id: User ID to create session for
-- Returns: Session token (VARCHAR)
CREATE OR REPLACE FUNCTION create_session(
    p_user_id INTEGER
)
RETURNS VARCHAR(255) AS $$
DECLARE
    v_token VARCHAR(255);
BEGIN
    -- Generate random 64-character hex token
    v_token := encode(gen_random_bytes(32), 'hex');
    
    -- Delete any existing sessions for this user (one session per user)
    DELETE FROM sessions WHERE user_id = p_user_id;
    
    -- Insert new session
    INSERT INTO sessions (token, user_id)
    VALUES (v_token, p_user_id);
    
    RETURN v_token;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to create session: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;


-- Purpose: Verify OTP from pending_users and move to users table
--          If user already exists, then set verified boolean to true
-- Parameters:
--   p_phone: Phone number
--   p_otp: Plain text OTP to verify
-- Returns: JSON object with success status and user_id
-- Code: 0=Success, 1=Invalid OTP, 2=Error

CREATE OR REPLACE FUNCTION verify_otp_and_activate_user(
    p_phone VARCHAR(20),
    p_otp VARCHAR(6)
)
RETURNS JSON AS $$
DECLARE
    v_pending_record RECORD;
    v_existing_user_id INTEGER;
    v_new_user_id INTEGER;
    v_session_token VARCHAR(255);
    v_user_role VARCHAR(20);
BEGIN
    -- Validate inputs
    IF p_phone IS NULL OR TRIM(p_phone) = '' THEN
        RETURN json_build_object(
            'code', 2,
            'message', 'Phone number cannot be empty'
        );
    END IF;
    
    IF p_otp IS NULL OR LENGTH(p_otp) != 6 THEN
        RETURN json_build_object(
            'code', 2,
            'message', 'OTP must be 6 digits'
        );
    END IF;
    
    -- Get pending user record
    SELECT * INTO v_pending_record
    FROM pending_users
    WHERE phone = p_phone;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 2,
            'message', 'Phone number not found in pending users'
        );
    END IF;
    
    -- Verify OTP (plain text comparison)
    IF p_otp != v_pending_record.otp THEN
        RETURN json_build_object(
            'code', 1,
            'message', 'Invalid OTP'
        );
    END IF;
    
    -- OTP is correct, check if user already exists
    SELECT user_id INTO v_existing_user_id
    FROM users
    WHERE phone = p_phone;
    
    IF v_existing_user_id IS NOT NULL THEN
        -- User exists, just update verified status
        UPDATE users
        SET verified = TRUE
        WHERE user_id = v_existing_user_id;
        
        v_new_user_id := v_existing_user_id;
    ELSE
        -- User doesn't exist, insert new user
        INSERT INTO users (name, phone, role, verified, CREATED_AT)
        VALUES ('', p_phone, 'undefined', TRUE, CURRENT_TIMESTAMP)
        RETURNING user_id INTO v_new_user_id;
    END IF;
    
    -- Delete from pending_users after successful verification
    DELETE FROM pending_users WHERE phone = p_phone;
    
    -- Create session token
    v_session_token := create_session(v_new_user_id);
    
    -- Get user role
    SELECT role INTO v_user_role
    FROM users
    WHERE user_id = v_new_user_id;
    
    RETURN json_build_object(
        'code', 0,
        'user_id', v_new_user_id,
        'session_token', v_session_token,
        'role', v_user_role,
        'message', 'OTP verified successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 2,
            'message', 'Verification failed: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- Purpose: Cancel/remove an order - can be called by any user
-- Parameters:
--   p_order_id: Order ID to cancel
--   p_user_id: User ID who is cancelling (for authorization)
-- Returns: JSON object with code field
-- Code: 1=Success, 0=Failure
-- If status='accepted', inserts into order_history before deletion
CREATE OR REPLACE FUNCTION cancel_order(
    p_order_id INTEGER,
    p_user_id INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_order_record RECORD;
    v_yard_location TEXT;
BEGIN
    -- Validate inputs
    IF p_order_id IS NULL OR p_user_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order ID and User ID cannot be null'
        );
    END IF;
    
    -- Get order details
    SELECT * INTO v_order_record
    FROM orders
    WHERE order_id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order not found'
        );
    END IF;
    
    -- If status is 'accepted', insert into order_history
    IF v_order_record.status = 'accepted' THEN
        -- Get supplier yard location
        SELECT yard_location INTO v_yard_location
        FROM suppliers
        WHERE user_id = v_order_record.supplier_id;
        
        -- Insert into order_history
        INSERT INTO order_history (
            customer_id,
            order_id,
            supplier_id,
            yard_location,
            price,
            quantity,
            status,
            order_date,
            created_at
        ) VALUES (
            v_order_record.customer_id,
            v_order_record.order_id,
            v_order_record.supplier_id,
            COALESCE(v_yard_location, ''),
            0,
            v_order_record.requested_capacity,
            'cancelled',
            v_order_record.created_at,
            CURRENT_TIMESTAMP
        );
    END IF;
    
    -- If driver was assigned, set them as available again
    IF v_order_record.driver_id IS NOT NULL THEN
        UPDATE supplier_drivers
        SET available = TRUE
        WHERE driver_user_id = v_order_record.driver_id;
    END IF;
    
    -- Delete from driver_assignment if exists
    DELETE FROM driver_assignment
    WHERE order_id = p_order_id;
    
    -- Delete the order
    DELETE FROM orders
    WHERE order_id = p_order_id;
    
    RETURN json_build_object(
        'code', 1,
        'message', 'Order cancelled successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to cancel order: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

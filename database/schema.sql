-- ============================================================================
-- CREATE TABLES
-- ============================================================================

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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    otp_attempt_count INTEGER NOT NULL DEFAULT 0,
    otp_sent_count INTEGER NOT NULL DEFAULT 0,
    first_otp_sent_at TIMESTAMP,
    last_otp_sent_at TIMESTAMP
);



CREATE TABLE IF NOT EXISTS SUPPLIERS (
    USER_ID INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    YARD_LOCATION TEXT NOT NULL,
    BUSINESS_CONTACT VARCHAR(20) NOT NULL,
    RATING DECIMAL(3,2) DEFAULT 0.00,
    TOTAL_ORDERS INTEGER DEFAULT 0,
    CREATED_AT TIMESTAMP NOT NULL
);


CREATE TABLE IF NOT EXISTS SUPPLIER_DRIVERS(
    DRIVER_PHONE_NUM VARCHAR(20) UNIQUE NOT NULL,       -- as specified by supplier
    SUPPLIER_USER_ID INT REFERENCES SUPPLIERS(USER_ID) ON DELETE CASCADE,
    DRIVER_USER_ID INTEGER UNIQUE  REFERENCES USERS(USER_ID) ON DELETE SET NULL DEFAULT NULL,
    AVAILABLE BOOLEAN DEFAULT FALSE,
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
    DRIVER_ID INTEGER REFERENCES USERS(USER_ID) ON DELETE CASCADE,
    DELIVERY_LOCATION TEXT NOT NULL,
    REQUESTED_CAPACITY NUMERIC(5,0) NOT NULL CHECK (REQUESTED_CAPACITY > 0),
    CUSTOMER_BID_PRICE NUMERIC(10,0) NOT NULL CHECK (CUSTOMER_BID_PRICE > 0),
    TIME_LIMIT_FOR_SUPPLIER TIMESTAMP,
    ACCEPTED_PRICE NUMERIC(10,0),
    ORDER_CONFIRMED_AT TIMESTAMP,
    STATUS VARCHAR(20) DEFAULT 'open' NOT NULL CHECK (STATUS IN ('open', 'supplier_timer','accepted','ride_started','reached','finished')),
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

-- Keep only the latest bid row per (order_id, supplier_id) before enforcing uniqueness.
DELETE FROM bids b
USING bids keep
WHERE b.order_id = keep.order_id
    AND b.supplier_id = keep.supplier_id
    AND (
        b.created_at < keep.created_at
        OR (b.created_at = keep.created_at AND b.bid_id < keep.bid_id)
    );

CREATE UNIQUE INDEX IF NOT EXISTS ux_bids_order_supplier
ON bids(order_id, supplier_id);



CREATE TABLE IF NOT EXISTS ORDER_HISTORY (
    HISTORY_ID SERIAL PRIMARY KEY,
    ORDER_ID INTEGER NOT NULL,
    SUPPLIER_ID INTEGER REFERENCES SUPPLIERS(USER_ID) ON DELETE SET NULL,
    CUSTOMER_NAME TEXT NOT NULL,
    CUSTOMER_PHONE VARCHAR(20) NOT NULL,
    SUPPLIER_NAME TEXT,
    SUPPLIER_PHONE VARCHAR(20),
    DRIVER_NAME TEXT,
    DRIVER_PHONE VARCHAR(20),
    CUSTOMER_LOCATION TEXT NOT NULL,
    YARD_LOCATION TEXT NOT NULL,
    PRICE INTEGER NOT NULL CHECK (PRICE >= 0),
    QUANTITY INTEGER NOT NULL CHECK (QUANTITY > 0),
    STATUS VARCHAR(20) NOT NULL CHECK (STATUS IN ('completed', 'cancelled')),
    ORDER_DATE TIMESTAMP NOT NULL,
    REASON TEXT,
    CUSTOMER_RATING INTEGER,
    RATED_AT TIMESTAMP,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backfill-safe migration for existing environments.
ALTER TABLE order_history
    ADD COLUMN IF NOT EXISTS customer_rating INTEGER;

ALTER TABLE order_history
    ADD COLUMN IF NOT EXISTS rated_at TIMESTAMP;


-- For local storage of tokens
CREATE TABLE IF NOT EXISTS sessions (
    token VARCHAR(255) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE
);


-- ============================================================================
-- TRIGGER: Auto set driver_user_id to NULL when driver's session is deleted
-- ============================================================================
-- Purpose: When a driver deletes app (session deleted), automatically mark them
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
    v_pending_record RECORD;
    v_new_sent_count INTEGER;
    v_window_start TIMESTAMP;
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
    
    -- Get pending user row
    SELECT * INTO v_pending_record
    FROM pending_users
    WHERE phone = p_phone;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Phone number not found in pending users'
        );
    END IF;

    -- Enforce 1 minute resend cooldown per phone
    IF v_pending_record.last_otp_sent_at IS NOT NULL
       AND CURRENT_TIMESTAMP < (v_pending_record.last_otp_sent_at + INTERVAL '1 minute') THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Please wait at least 1 minute before requesting a new OTP'
        );
    END IF;

    -- Enforce max 3 OTP generations in a rolling 24-hour window
    IF v_pending_record.first_otp_sent_at IS NULL
       OR CURRENT_TIMESTAMP >= (v_pending_record.first_otp_sent_at + INTERVAL '24 hours') THEN
        v_window_start := CURRENT_TIMESTAMP;
        v_new_sent_count := 1;
    ELSE
        v_window_start := v_pending_record.first_otp_sent_at;
        v_new_sent_count := v_pending_record.otp_sent_count + 1;
    END IF;

    IF v_new_sent_count > 3 THEN
        RETURN json_build_object(
            'success', false,
            'message', 'OTP request limit reached for this phone in 24 hours'
        );
    END IF;
    
    -- Update OTP, timestamps, and reset wrong-attempt counter for this new OTP
    UPDATE pending_users
    SET otp = p_otp,
        created_at = CURRENT_TIMESTAMP,
        otp_attempt_count = 0,
        otp_sent_count = v_new_sent_count,
        first_otp_sent_at = v_window_start,
        last_otp_sent_at = CURRENT_TIMESTAMP
    WHERE phone = p_phone;
    
    RETURN json_build_object(
        'success', true,
        'message', 'OTP stored successfully',
        'remaining_otp_requests_in_24h', (3 - v_new_sent_count)
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
    v_current_attempt_count INTEGER;
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

    -- Enforce OTP expiry window (10 minutes)
    IF v_pending_record.created_at IS NULL
       OR CURRENT_TIMESTAMP > (v_pending_record.created_at + INTERVAL '10 minutes') THEN
        RETURN json_build_object(
            'code', 2,
            'message', 'OTP expired. Please request a new OTP'
        );
    END IF;

    -- Enforce max 3 wrong attempts per issued OTP
    IF v_pending_record.otp_attempt_count >= 3 THEN
        RETURN json_build_object(
            'code', 2,
            'message', 'Maximum OTP attempts reached. Please request a new OTP'
        );
    END IF;
    
    -- Verify OTP (plain text comparison)
    IF p_otp != v_pending_record.otp THEN
        UPDATE pending_users
        SET otp_attempt_count = otp_attempt_count + 1
        WHERE phone = p_phone;

        SELECT otp_attempt_count INTO v_current_attempt_count
        FROM pending_users
        WHERE phone = p_phone;

        IF v_current_attempt_count >= 3 THEN
            UPDATE pending_users
            SET otp = NULL,
                created_at = CURRENT_TIMESTAMP
            WHERE phone = p_phone;

            RETURN json_build_object(
                'code', 2,
                'message', 'Maximum OTP attempts reached. Please request a new OTP'
            );
        END IF;

        RETURN json_build_object(
            'code', 1,
            'message', 'Invalid OTP',
            'remaining_attempts', (3 - v_current_attempt_count)
        );
    END IF;
    
    -- OTP is correct, check if user already exists
    SELECT user_id, role INTO v_existing_user_id, v_user_role
    FROM users
    WHERE phone = p_phone;

    IF v_existing_user_id IS NOT NULL THEN
        UPDATE users SET verified = TRUE 
        WHERE user_id = v_existing_user_id;

    -- If the existing user is a driver, also mark them as available in supplier_drivers    
        IF v_user_role = 'driver' THEN
            UPDATE supplier_drivers 
            SET available = TRUE 
            WHERE driver_user_id = v_existing_user_id;
        END IF;
    
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


-- Purpose: Cleanup failed timeout states.
-- Behavior:
--   1) Delete expired pending driver assignments.
--   2) Delete supplier_timer orders whose supplier window has expired.
-- Notes:
--   - Expired supplier failures are hard-deleted from orders.
--   - They are NOT inserted into order_history.
--   - Deleting an order cascades to driver_assignment rows for that order.
CREATE OR REPLACE FUNCTION cleanup_expired_failures()
RETURNS VOID AS $$
BEGIN
        -- Remove pending driver assignments that are past their own time limit.
        DELETE FROM driver_assignment
        WHERE order_rejected = FALSE
            AND time_limit_for_driver IS NOT NULL
            AND CURRENT_TIMESTAMP > time_limit_for_driver;

        -- Remove assignments where supplier timer is already expired for the order.
        DELETE FROM driver_assignment da
        USING orders o
        WHERE da.order_id = o.order_id
            AND o.status = 'supplier_timer'
            AND o.time_limit_for_supplier IS NOT NULL
            AND CURRENT_TIMESTAMP > o.time_limit_for_supplier;

        -- Remove expired supplier-timer orders (failure cleanup, no history logging).
        DELETE FROM orders
        WHERE status = 'supplier_timer'
            AND time_limit_for_supplier IS NOT NULL
            AND CURRENT_TIMESTAMP > time_limit_for_supplier;
END;
$$ LANGUAGE plpgsql;


-- Purpose: Cancel/remove an order - can be called by any user
-- Parameters:
--   p_order_id: Order ID to cancel
--   p_user_id: User ID who is cancelling (for authorization)
--   p_reason: Reason for cancellation (optional)
-- Returns: JSON object with code field
-- Code: 1=Success, 0=Failure
-- If status is NOT IN ('open', 'supplier_timer'), inserts into order_history with reason
-- If supplier/driver cancels 'accepted'/'ride_started'/'reached', supplier rating -0.2
CREATE OR REPLACE FUNCTION cancel_order(
    p_order_id INTEGER,
    p_user_id INTEGER,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_order_record RECORD;
    v_yard_location TEXT;
    v_customer_name TEXT;
    v_customer_phone VARCHAR(20);
    v_supplier_name TEXT;
    v_supplier_phone VARCHAR(20);
    v_driver_name TEXT;
    v_driver_phone VARCHAR(20);
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
    
    -- Check if order status is 'finished' - cannot cancel finished orders
    IF v_order_record.status = 'finished' THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Cannot cancel a finished order'
        );
    END IF;
    
    -- If status is NOT 'open' or 'supplier_timer', insert into order_history
    IF v_order_record.status NOT IN ('open', 'supplier_timer') THEN
        -- Snapshot user names and phones for immutable history
        SELECT name, phone INTO v_customer_name, v_customer_phone
        FROM users
        WHERE user_id = v_order_record.customer_id;

        IF v_order_record.supplier_id IS NOT NULL THEN
            SELECT name, phone INTO v_supplier_name, v_supplier_phone
            FROM users
            WHERE user_id = v_order_record.supplier_id;
        END IF;

        IF v_order_record.driver_id IS NOT NULL THEN
            SELECT name, phone INTO v_driver_name, v_driver_phone
            FROM users
            WHERE user_id = v_order_record.driver_id;
        END IF;

        -- Get supplier yard location
        SELECT yard_location INTO v_yard_location
        FROM suppliers
        WHERE user_id = v_order_record.supplier_id;
        
        -- Insert into order_history
        INSERT INTO order_history (
            order_id,
            supplier_id,
            customer_name,
            customer_phone,
            supplier_name,
            supplier_phone,
            driver_name,
            driver_phone,
            customer_location,
            yard_location,
            price,
            quantity,
            status,
            order_date,
            reason,
            created_at
        ) VALUES (
            v_order_record.order_id,
            v_order_record.supplier_id,
            COALESCE(v_customer_name, ''),
            COALESCE(v_customer_phone, ''),
            v_supplier_name,
            v_supplier_phone,
            v_driver_name,
            v_driver_phone,
            v_order_record.delivery_location,
            COALESCE(v_yard_location, ''),
            0,
            v_order_record.requested_capacity,
            'cancelled',
            v_order_record.created_at,
            p_reason,
            CURRENT_TIMESTAMP
        );
        
        -- If status is 'accepted' or 'ride_started' or 'reached', penalize supplier if not customer
        IF v_order_record.status IN ('accepted', 'ride_started', 'reached') THEN
            -- If canceller is NOT the customer, penalize supplier (rating -0.2)
            IF p_user_id != v_order_record.customer_id THEN
                UPDATE suppliers
                SET rating = GREATEST(rating - 0.2, 0.00)
                WHERE user_id = v_order_record.supplier_id;
            END IF;
        END IF;
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


-- ============================================================================
-- FUNCTION: View past orders
-- ============================================================================
-- Purpose: Retrieve past orders from order_history for a user based on their role
--          Returns orders where user was customer, supplier, or driver
-- Parameters:
--   p_user_id: User ID to get past orders for
-- Returns: JSON array of past orders with order_id, price, quantity, status, order_date
-- ============================================================================
CREATE OR REPLACE FUNCTION view_past_orders(
    p_user_id INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_user_role VARCHAR(20);
    v_user_phone VARCHAR(20);
    v_orders JSON;
BEGIN
    -- Validate input
    IF p_user_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'User ID cannot be null'
        );
    END IF;
    
    -- Get user role from users table
    SELECT role INTO v_user_role
    FROM users
    WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'User not found'
        );
    END IF;

    SELECT phone INTO v_user_phone
    FROM users
    WHERE user_id = p_user_id;
    
    -- Query order_history based on user role
    IF v_user_role = 'customer' THEN
        SELECT json_agg(
            json_build_object(
                'order_id', order_id,
                'price', price,
                'quantity', quantity,
                'status', status,
                'order_date', order_date
            ) ORDER BY order_date DESC
        ) INTO v_orders
        FROM order_history
        WHERE customer_phone = v_user_phone;
        
    ELSIF v_user_role = 'supplier' THEN
        SELECT json_agg(
            json_build_object(
                'order_id', order_id,
                'price', price,
                'quantity', quantity,
                'status', status,
                'order_date', order_date
            ) ORDER BY order_date DESC
        ) INTO v_orders
        FROM order_history
        WHERE supplier_phone = v_user_phone;
        
    ELSIF v_user_role = 'driver' THEN
        SELECT json_agg(
            json_build_object(
                'order_id', order_id,
                'price', price,
                'quantity', quantity,
                'status', status,
                'order_date', order_date
            ) ORDER BY order_date DESC
        ) INTO v_orders
        FROM order_history
        WHERE driver_phone = v_user_phone;
        
    ELSE
        RETURN json_build_object(
            'code', 0,
            'message', 'Invalid user role'
        );
    END IF;
    
    -- Return orders (will be null if no orders found)
    RETURN json_build_object(
        'code', 1,
        'orders', COALESCE(v_orders, '[]'::json)
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to retrieve past orders: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

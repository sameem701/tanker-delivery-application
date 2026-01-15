-- Purpose: Enter driver details (name only)
--          Checks if driver is registered in supplier_drivers table
--          If found, updates driver_user_id, joined_at, and sets role
--          If role already 'driver', just re-links driver_user_id (seamless return)
-- Parameters:
--   p_driver_id: User ID (driver)
--   p_name: Driver name
-- Returns: JSON object with success status
-- Code: 1=Success, 0=Failure/Not enlisted
CREATE OR REPLACE FUNCTION enter_details_driver(
    p_driver_id INTEGER,
    p_name VARCHAR(100)
)
RETURNS JSON AS $$
DECLARE
    v_phone_number VARCHAR(20);
    v_current_role VARCHAR(20);
    v_supplier_driver_exists BOOLEAN;
BEGIN
    -- Validate user_id
    IF p_driver_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'User ID cannot be null'
        );
    END IF;
    
    -- Get current role and phone number
    SELECT role, phone INTO v_current_role, v_phone_number
    FROM users
    WHERE user_id = p_driver_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'User not found'
        );
    END IF;
    
    -- Check if role is already set to 'driver'
    IF v_current_role = 'driver' THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Driver details already exist'
        );
    END IF;
    
    -- Check if this phone number exists in supplier_drivers table
    SELECT EXISTS(
        SELECT 1 
        FROM supplier_drivers 
        WHERE driver_phone_num = v_phone_number
    ) INTO v_supplier_driver_exists;
    
    IF NOT v_supplier_driver_exists THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'You are not enlisted as a driver by any supplier'
        );
    END IF;
    
    -- New driver: Update supplier_drivers table with driver_user_id and joined_at
    UPDATE supplier_drivers
    SET driver_user_id = p_driver_id,
        joined_at = CURRENT_TIMESTAMP
    WHERE driver_phone_num = v_phone_number;
    
    -- Update users table with name and role
    UPDATE users
    SET name = TRIM(p_name),
        role = 'driver'
    WHERE user_id = p_driver_id;
    
    RETURN json_build_object(
        'code', 1,
        'message', 'Driver details saved successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to save details: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================


-- ============================================================================
-- TRIGGER: Auto re-link returning driver on session creation
-- ============================================================================
-- Purpose: Automatically called when a new session is inserted
--          Checks if user's role is 'driver', and if so, automatically
--          re-links their driver_user_id in supplier_drivers table
--          This provides seamless return without requiring form resubmission
-- ============================================================================
CREATE OR REPLACE FUNCTION on_session_insert_relink_driver()
RETURNS TRIGGER AS $$
DECLARE
    v_phone_number VARCHAR(20);
    v_user_role VARCHAR(20);
    v_supplier_driver_exists BOOLEAN;
BEGIN
    -- Get role and phone number of the user whose session was created
    SELECT role, phone INTO v_user_role, v_phone_number
    FROM users
    WHERE user_id = NEW.user_id;
    
    -- Only proceed if role is 'driver'
    IF v_user_role = 'driver' THEN
        -- Check if this phone number exists in supplier_drivers table
        SELECT EXISTS(
            SELECT 1 
            FROM supplier_drivers 
            WHERE driver_phone_num = v_phone_number
        ) INTO v_supplier_driver_exists;
        
        -- If driver is enlisted, re-link them
        IF v_supplier_driver_exists THEN
            UPDATE supplier_drivers
            SET driver_user_id = NEW.user_id,
                joined_at = CURRENT_TIMESTAMP
            WHERE driver_phone_num = v_phone_number;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_relink_driver_on_session_insert ON sessions;
CREATE TRIGGER trigger_relink_driver_on_session_insert
    AFTER INSERT ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION on_session_insert_relink_driver();


-- ============================================================================
-- FUNCTION: confirm_order_driver
-- ============================================================================
-- Purpose: Driver confirms acceptance of an assigned order
--          Uses race-safe UPDATE to prevent multiple drivers accepting same order
--          First driver to confirm wins, others get rejected
-- Parameters:
--   p_driver_id: Driver user_id confirming the order
--   p_order_id: Order ID to confirm
-- Returns: JSON object with code field
-- Code: 1=Success, 0=Failure
-- ============================================================================
CREATE OR REPLACE FUNCTION confirm_order_driver(
    p_driver_id INTEGER,
    p_order_id INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_assignment_exists BOOLEAN;
    v_time_limit TIMESTAMP;
    v_supplier_time_limit TIMESTAMP;
    v_rows_updated INTEGER;
BEGIN
    -- Validate inputs
    IF p_driver_id IS NULL OR p_order_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Driver ID and Order ID cannot be null'
        );
    END IF;
    
    -- Check if driver was assigned to this order and get time limit
    SELECT time_limit_for_driver INTO v_time_limit
    FROM driver_assignment
    WHERE order_id = p_order_id
      AND driver_id = p_driver_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'You were not assigned to this order'
        );
    END IF;
    
    -- Check if driver timer expired
    IF CURRENT_TIMESTAMP > v_time_limit THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Time limit expired for this order'
        );
    END IF;
    
    -- Check supplier time limit
    SELECT time_limit_for_supplier INTO v_supplier_time_limit
    FROM orders
    WHERE order_id = p_order_id;
    
    IF CURRENT_TIMESTAMP > v_supplier_time_limit THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Supplier time limit expired for this order'
        );
    END IF;
    
    -- RACE-SAFE UPDATE: Try to claim the order
    -- This will only succeed if driver_id IS NULL (no one else claimed it yet)
    UPDATE orders
    SET driver_id = p_driver_id
    WHERE order_id = p_order_id
      AND driver_id IS NULL;
    
    -- Check how many rows were updated
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    
    IF v_rows_updated = 0 THEN
        -- Someone else already accepted this order
        RETURN json_build_object(
            'code', 0,
            'message', 'Order already accepted by another driver'
        );
    END IF;
    
    -- This driver won! Complete the acceptance
    
    -- Mark driver as unavailable
    UPDATE supplier_drivers
    SET available = FALSE
    WHERE driver_user_id = p_driver_id;
    
    -- Update order status to 'accepted' and set confirmation timestamp
    UPDATE orders
    SET status = 'accepted',
        order_confirmed_at = CURRENT_TIMESTAMP
    WHERE order_id = p_order_id;
    
    -- Delete all other pending driver assignments for this order
    DELETE FROM driver_assignment
    WHERE order_id = p_order_id;
    
    RETURN json_build_object(
        'code', 1,
        'message', 'Order confirmed successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to confirm order: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: reject_order_driver
-- ============================================================================
-- Purpose: Driver rejects an assigned order
--          Sets order_rejected = TRUE in driver_assignment
--          Driver will appear greyed out in supplier's driver list for this order
-- Parameters:
--   p_driver_id: Driver user_id rejecting the order
--   p_order_id: Order ID to reject
-- Returns: JSON object with code field
-- Code: 1=Success, 0=Failure
-- ============================================================================
CREATE OR REPLACE FUNCTION reject_order_driver(
    p_driver_id INTEGER,
    p_order_id INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_time_limit TIMESTAMP;
BEGIN
    -- Validate inputs
    IF p_driver_id IS NULL OR p_order_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Driver ID and Order ID cannot be null'
        );
    END IF;
    
    -- Check if driver was assigned to this order and get time limit
    SELECT time_limit_for_driver INTO v_time_limit
    FROM driver_assignment
    WHERE order_id = p_order_id
      AND driver_id = p_driver_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'You were not assigned to this order'
        );
    END IF;
    
    -- Check if timer expired (can't reject expired assignments)
    IF CURRENT_TIMESTAMP > v_time_limit THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Time limit expired, assignment already expired'
        );
    END IF;
    
    -- Mark as rejected
    UPDATE driver_assignment
    SET order_rejected = TRUE
    WHERE order_id = p_order_id
      AND driver_id = p_driver_id;
    
    RETURN json_build_object(
        'code', 1,
        'message', 'Order rejected successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to reject order: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: Get order details for driver
-- ============================================================================
-- Purpose: Returns order details with customer information for delivery
--          Driver gets customer contact and delivery location
-- Parameters:
--   p_driver_id: Driver user_id (for authorization)
--   p_order_id: Order ID to get details for
-- Returns: JSON object with order details
-- Code: 1=Success with data, 0=Failure/Not authorized
-- ============================================================================
CREATE OR REPLACE FUNCTION get_order_details_driver(
    p_driver_id INTEGER,
    p_order_id INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_order_record RECORD;
BEGIN
    -- Validate inputs
    IF p_driver_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Driver ID cannot be null'
        );
    END IF;
    
    IF p_order_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order ID cannot be null'
        );
    END IF;
    
    -- Get order details with customer info
    SELECT 
        o.order_id,
        o.delivery_location,
        o.requested_capacity,
        o.accepted_price,
        o.status,
        cu.name AS customer_name,
        cu.phone AS customer_phone
    INTO v_order_record
    FROM orders o
    LEFT JOIN users cu ON o.customer_id = cu.user_id
    WHERE o.order_id = p_order_id
      AND o.driver_id = p_driver_id;
    
    -- Check if order exists and belongs to driver
    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order not found or not assigned to you'
        );
    END IF;
    
    -- Return order details
    RETURN json_build_object(
        'code', 1,
        'order_id', v_order_record.order_id,
        'delivery_location', v_order_record.delivery_location,
        'quantity', v_order_record.requested_capacity,
        'price', v_order_record.accepted_price,
        'status', v_order_record.status,
        'customer_name', v_order_record.customer_name,
        'customer_phone', v_order_record.customer_phone
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to get order details: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: Start ride for accepted order
-- ============================================================================
-- Purpose: Driver starts the delivery ride after accepting order
--          Changes status from 'accepted' to 'ride_started'
-- Parameters:
--   p_driver_id: Driver user_id starting the ride
--   p_order_id: Order ID to start ride for
-- Returns: JSON object with code field
-- Code: 1=Success, 0=Failure
-- ============================================================================
CREATE OR REPLACE FUNCTION start_ride(
    p_driver_id INTEGER,
    p_order_id INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_order_status VARCHAR(20);
    v_order_driver_id INTEGER;
BEGIN
    -- Validate inputs
    IF p_driver_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Driver ID cannot be null'
        );
    END IF;
    
    IF p_order_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order ID cannot be null'
        );
    END IF;
    
    -- Get order status and driver_id
    SELECT status, driver_id INTO v_order_status, v_order_driver_id
    FROM orders
    WHERE order_id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order not found'
        );
    END IF;
    
    -- Check if this driver owns the order
    IF v_order_driver_id != p_driver_id THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'This order is not assigned to you'
        );
    END IF;
    
    -- Check if order status is 'accepted'
    IF v_order_status != 'accepted' THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order status must be accepted to start ride. Current status: ' || v_order_status
        );
    END IF;
    
    -- Update order status to 'ride_started'
    UPDATE orders
    SET status = 'ride_started'
    WHERE order_id = p_order_id;
    
    RETURN json_build_object(
        'code', 1,
        'message', 'Ride started successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to start ride: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: Mark order as reached
-- ============================================================================
-- Purpose: Driver marks that they have arrived at delivery location
--          Changes status from 'ride_started' to 'reached'
-- Parameters:
--   p_driver_id: Driver user_id marking arrival
--   p_order_id: Order ID to mark as reached
-- Returns: JSON object with code field
-- Code: 1=Success, 0=Failure
-- ============================================================================
CREATE OR REPLACE FUNCTION mark_order_reached(
    p_driver_id INTEGER,
    p_order_id INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_order_status VARCHAR(20);
    v_order_driver_id INTEGER;
BEGIN
    -- Validate inputs
    IF p_driver_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Driver ID cannot be null'
        );
    END IF;
    
    IF p_order_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order ID cannot be null'
        );
    END IF;
    
    -- Get order status and driver_id
    SELECT status, driver_id INTO v_order_status, v_order_driver_id
    FROM orders
    WHERE order_id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order not found'
        );
    END IF;
    
    -- Check if this driver owns the order
    IF v_order_driver_id != p_driver_id THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'This order is not assigned to you'
        );
    END IF;
    
    -- Check if order status is 'ride_started'
    IF v_order_status != 'ride_started' THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order status must be ride_started to mark as reached. Current status: ' || v_order_status
        );
    END IF;
    
    -- Update order status to 'reached'
    UPDATE orders
    SET status = 'reached'
    WHERE order_id = p_order_id;
    
    RETURN json_build_object(
        'code', 1,
        'message', 'Marked as reached successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to mark as reached: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: Finish order/delivery
-- ============================================================================
-- Purpose: Driver completes the delivery
--          Updates order_history, sets status to 'finished', makes driver available
-- Parameters:
--   p_driver_id: Driver user_id finishing the order
--   p_order_id: Order ID to finish
-- Returns: JSON object with code field
-- Code: 1=Success, 0=Failure
-- ============================================================================
CREATE OR REPLACE FUNCTION finish_order(
    p_driver_id INTEGER,
    p_order_id INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_order_record RECORD;
    v_yard_location TEXT;
BEGIN
    -- Validate inputs
    IF p_driver_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Driver ID cannot be null'
        );
    END IF;
    
    IF p_order_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order ID cannot be null'
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
    
    -- Check if this driver owns the order
    IF v_order_record.driver_id != p_driver_id THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'This order is not assigned to you'
        );
    END IF;
    
    -- Check if order status is 'ride_started'
    IF v_order_record.status != 'reached' THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order must be in reached status to finish. Current status: ' || v_order_record.status
        );
    END IF;
    
    -- Get supplier yard location
    SELECT yard_location INTO v_yard_location
    FROM suppliers
    WHERE user_id = v_order_record.supplier_id;
    
    -- Insert into order_history
    INSERT INTO order_history (
        customer_id,
        order_id,
        supplier_id,
        driver_id,
        customer_location,
        yard_location,
        price,
        quantity,
        status,
        order_date,
        reason
    ) VALUES (
        v_order_record.customer_id,
        v_order_record.order_id,
        v_order_record.supplier_id,
        v_order_record.driver_id,
        v_order_record.delivery_location,
        COALESCE(v_yard_location, ''),
        v_order_record.accepted_price,
        v_order_record.requested_capacity,
        'completed',
        v_order_record.order_confirmed_at,
        NULL
    );
    
    -- Update order status to 'finished'
    UPDATE orders
    SET status = 'finished'
    WHERE order_id = p_order_id;
    
    -- Set driver as available again
    UPDATE supplier_drivers
    SET available = TRUE
    WHERE driver_user_id = p_driver_id;
    
    RETURN json_build_object(
        'code', 1,
        'message', 'Order completed successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to finish order: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: View past order details for driver
-- ============================================================================
-- Purpose: Get detailed information for a single past order from order_history
-- Parameters:
--   p_driver_id: Driver user_id (for authorization)
--   p_order_id: Order ID to view details for
-- Returns: JSON object with order details
-- ============================================================================
CREATE OR REPLACE FUNCTION view_past_order_details_driver(
    p_driver_id INTEGER,
    p_order_id INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_order_record RECORD;
BEGIN
    -- Validate inputs
    IF p_driver_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Driver ID cannot be null'
        );
    END IF;
    
    IF p_order_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order ID cannot be null'
        );
    END IF;
    
    -- Get order from order_history
    SELECT * INTO v_order_record
    FROM order_history
    WHERE order_id = p_order_id AND driver_id = p_driver_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order not found in your history'
        );
    END IF;
    
    -- Return order details
    RETURN json_build_object(
        'code', 1,
        'order', json_build_object(
            'order_date', v_order_record.order_date,
            'price', v_order_record.price,
            'quantity', v_order_record.quantity,
            'customer_location', v_order_record.customer_location,
            'status', v_order_record.status
        )
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to retrieve order details: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;
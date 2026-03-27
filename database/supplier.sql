-- Purpose: Enter supplier details (name, yard location, business contact)
--          Sets role to supplier immediately
-- Parameters:
--   p_user_id: User ID
--   p_name: Supplier name
--   p_yard_location: Yard location
--   p_business_contact: Business contact (same as phone)
-- Returns: JSON object with success status
-- Code: 1=Success, 0=Failure/Already exists
CREATE OR REPLACE FUNCTION enter_details_supplier(
    p_user_id INTEGER,
    p_name VARCHAR(100),
    p_yard_location TEXT,
    p_business_contact VARCHAR(20)
)
RETURNS JSON AS $$
DECLARE
    v_current_role VARCHAR(20);
    v_supplier_exists BOOLEAN;
BEGIN
    -- Validate user_id
    IF p_user_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'User ID cannot be null'
        );
    END IF;
    
    -- Strict role lock: details can only be submitted once when role is undefined
    SELECT role INTO v_current_role
    FROM users
    WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'User not found'
        );
    END IF;
    
    IF v_current_role != 'undefined' THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Role already assigned. Details update is not allowed.'
        );
    END IF;
    
    -- Update user name and set supplier role immediately
    UPDATE users
    SET name = TRIM(p_name),
        role = 'supplier'
    WHERE user_id = p_user_id;
    
    -- Check if supplier record already exists
    SELECT EXISTS(SELECT 1 FROM SUPPLIERS WHERE USER_ID = p_user_id) INTO v_supplier_exists;
    
    IF v_supplier_exists THEN
        -- Update existing supplier record
        UPDATE SUPPLIERS
        SET YARD_LOCATION = TRIM(p_yard_location),
            BUSINESS_CONTACT = TRIM(p_business_contact)
        WHERE USER_ID = p_user_id;
    ELSE
        -- Insert new supplier record
        INSERT INTO SUPPLIERS (USER_ID, YARD_LOCATION, BUSINESS_CONTACT, CREATED_AT)
        VALUES (p_user_id, TRIM(p_yard_location), TRIM(p_business_contact), CURRENT_TIMESTAMP);
    END IF;
    
    RETURN json_build_object(
        'code', 1,
        'supplier_id', p_user_id,
        'message', 'Supplier details saved successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to save details: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS upload_cnic_supplier(INTEGER, TEXT, TEXT);






-----------------------------------------------------------------
--          SUPPLIER SETUP
-----------------------------------------------------------------


-- ============================================================================
-- FUNCTION: Check if supplier has registered any drivers
-- ============================================================================
-- Purpose: Checks if supplier has any drivers in supplier_drivers table
--          Used to determine if supplier can access orders page
--          or needs to add drivers first
-- Parameters:
--   p_supplier_id: Supplier user_id
-- Returns: JSON object with status
-- Code: 1=Has drivers (can access orders), 0=No drivers (needs to add drivers)
-- ============================================================================
CREATE OR REPLACE FUNCTION check_supplier_has_drivers(
    p_supplier_id INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_has_drivers BOOLEAN;
BEGIN
    -- Validate supplier_id
    IF p_supplier_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Supplier ID cannot be null'
        );
    END IF;
    
    -- Check if any drivers exist for this supplier
    SELECT EXISTS(
        SELECT 1 
        FROM supplier_drivers 
        WHERE supplier_user_id = p_supplier_id
    ) INTO v_has_drivers;
    
    IF v_has_drivers THEN
        RETURN json_build_object(
            'code', 1,
            'message', 'Supplier has defined drivers'
        );
    ELSE
        RETURN json_build_object(
            'code', 0,
            'message', 'No drivers found. Please add drivers first.'
        );
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to check drivers: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;






CREATE OR REPLACE FUNCTION check_supplier_has_active_drivers(
    p_supplier_id INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_has_drivers BOOLEAN;
BEGIN
    -- Validate supplier_id
    IF p_supplier_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Supplier ID cannot be null'
        );
    END IF;
    
    -- Check if any drivers exist for this supplier
    SELECT EXISTS(
        SELECT 1 
        FROM supplier_drivers 
        WHERE supplier_user_id = p_supplier_id
            AND DRIVER_USER_ID IS NOT NULL
    ) INTO v_has_drivers;
    
    IF v_has_drivers THEN
        RETURN json_build_object(
            'code', 1,
            'message', 'Supplier has active drivers. Can access orders'
        );
    ELSE
        RETURN json_build_object(
            'code', 0,
            'message', 'No active drivers. Cannot access login page'
        );
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to check drivers: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: Add driver phone for supplier
-- ============================================================================
-- Purpose: Supplier adds a driver phone to their roster
-- Parameters:
--   p_supplier_id: Supplier user_id
--   p_driver_phone_num: Driver phone number
-- Returns: JSON object with status
-- ============================================================================
CREATE OR REPLACE FUNCTION add_driver_phone_for_supplier(
    p_supplier_id INTEGER,
    p_driver_phone_num VARCHAR(20)
)
RETURNS JSON AS $$
DECLARE
    v_supplier_role VARCHAR(20);
    v_row_exists_same_supplier BOOLEAN;
    v_row_exists_other_supplier BOOLEAN;
BEGIN
    IF p_supplier_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Supplier ID cannot be null'
        );
    END IF;

    IF p_driver_phone_num IS NULL OR TRIM(p_driver_phone_num) = '' THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Driver phone number cannot be empty'
        );
    END IF;

    SELECT role INTO v_supplier_role
    FROM users
    WHERE user_id = p_supplier_id;

    IF NOT FOUND OR v_supplier_role != 'supplier' THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Only suppliers can add drivers'
        );
    END IF;

    SELECT EXISTS(
        SELECT 1
        FROM supplier_drivers
        WHERE supplier_user_id = p_supplier_id
          AND driver_phone_num = TRIM(p_driver_phone_num)
    ) INTO v_row_exists_same_supplier;

    IF v_row_exists_same_supplier THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Driver phone already added to your list'
        );
    END IF;

    SELECT EXISTS(
        SELECT 1
        FROM supplier_drivers
        WHERE driver_phone_num = TRIM(p_driver_phone_num)
          AND supplier_user_id != p_supplier_id
    ) INTO v_row_exists_other_supplier;

    IF v_row_exists_other_supplier THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Driver phone is already linked with another supplier'
        );
    END IF;

    INSERT INTO supplier_drivers (
        driver_phone_num,
        supplier_user_id,
        driver_user_id,
        available,
        joined_at
    ) VALUES (
        TRIM(p_driver_phone_num),
        p_supplier_id,
        NULL,
        TRUE,
        NULL
    );

    RETURN json_build_object(
        'code', 1,
        'message', 'Driver phone added successfully'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to add driver phone: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: Remove driver for supplier
-- ============================================================================
-- Purpose: Supplier removes a driver from their roster
-- Behavior:
--   - If not linked (driver_user_id IS NULL): delete supplier_drivers row only
--   - If linked: ensure no active orders; then clean driver data from all relevant
--     tables while preserving order_history rows
-- Parameters:
--   p_supplier_id: Supplier user_id
--   p_driver_phone_num: Driver phone number
-- Returns: JSON object with status
-- ============================================================================
CREATE OR REPLACE FUNCTION remove_driver_for_supplier(
    p_supplier_id INTEGER,
    p_driver_phone_num VARCHAR(20)
)
RETURNS JSON AS $$
DECLARE
    v_supplier_role VARCHAR(20);
    v_driver_user_id INTEGER;
    v_active_order_exists BOOLEAN;
BEGIN
    IF p_supplier_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Supplier ID cannot be null'
        );
    END IF;

    IF p_driver_phone_num IS NULL OR TRIM(p_driver_phone_num) = '' THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Driver phone number cannot be empty'
        );
    END IF;

    SELECT role INTO v_supplier_role
    FROM users
    WHERE user_id = p_supplier_id;

    IF NOT FOUND OR v_supplier_role != 'supplier' THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Only suppliers can remove drivers'
        );
    END IF;

    -- Ownership/link check: driver row must belong to this supplier
    SELECT driver_user_id INTO v_driver_user_id
    FROM supplier_drivers
    WHERE supplier_user_id = p_supplier_id
      AND driver_phone_num = TRIM(p_driver_phone_num);

    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Driver does not belong to this supplier'
        );
    END IF;

    -- If not linked yet, delete supplier row only
    IF v_driver_user_id IS NULL THEN
        DELETE FROM supplier_drivers
        WHERE supplier_user_id = p_supplier_id
          AND driver_phone_num = TRIM(p_driver_phone_num);

        RETURN json_build_object(
            'code', 1,
            'message', 'Unlinked driver phone removed successfully'
        );
    END IF;

    -- Guard: driver must not appear in orders table at all
    SELECT EXISTS(
        SELECT 1
        FROM orders
        WHERE driver_id = v_driver_user_id
    ) INTO v_active_order_exists;

    IF v_active_order_exists THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Driver exists in orders and cannot be removed'
        );
    END IF;

    -- Remove any outstanding assignment rows for this driver.
    DELETE FROM driver_assignment
    WHERE driver_id = v_driver_user_id;

    -- Delete session tokens for this driver.
    DELETE FROM sessions
    WHERE user_id = v_driver_user_id;

    -- Remove supplier mapping row.
    DELETE FROM supplier_drivers
    WHERE supplier_user_id = p_supplier_id
      AND driver_phone_num = TRIM(p_driver_phone_num);

    -- Delete driver user record after references are cleaned.
    DELETE FROM users
    WHERE user_id = v_driver_user_id;

    RETURN json_build_object(
        'code', 1,
        'message', 'Linked driver removed and data cleaned successfully'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to remove driver: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;



--------------------------------------
--          GETTING ORDERS
--------------------------------------


-- ============================================================================
-- FUNCTION: View all available orders for suppliers
-- ============================================================================
-- Purpose: Returns all orders with status='open' that haven't been accepted
--          Used by suppliers to see orders they can bid on
-- Parameters: None
-- Returns: JSON array with all available orders
-- ============================================================================
CREATE OR REPLACE FUNCTION view_available_orders()
RETURNS JSON AS $$
DECLARE
    v_orders JSON;
BEGIN
    -- Query open orders with marketplace-safe summary fields only.
    SELECT json_agg(
        json_build_object(
            'order_id', o.order_id,
            'requested_capacity', o.requested_capacity,
            'customer_bid_price', o.customer_bid_price
                )
                ORDER BY o.created_at DESC
    ) INTO v_orders
    FROM orders o
    WHERE o.status = 'open'
      AND o.supplier_id IS NULL
            AND o.driver_id IS NULL;
    
    -- Return empty array if no orders found
    IF v_orders IS NULL THEN
        RETURN '[]'::json;
    END IF;
    
    RETURN v_orders;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'error', 'Failed to fetch orders: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- TRIGGER FUNCTION: Notify when orders table changes
-- ============================================================================
-- Purpose: Sends PostgreSQL NOTIFY signal whenever orders are created/updated
--          Node.js listens for this signal and broadcasts to suppliers via WebSocket
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_orders_updated()
RETURNS TRIGGER AS $$
BEGIN
    -- Send notification on orders_channel
    PERFORM pg_notify('orders_channel', 'update');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Fire notification on orders table changes
-- ============================================================================
-- Fires: After INSERT, UPDATE, or DELETE on orders table
-- Action: Sends NOTIFY signal to Node.js backend
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_notify_orders_updated ON orders;
CREATE TRIGGER trigger_notify_orders_updated
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION notify_orders_updated();





-- ============================================================================
-- FUNCTION: View specific order details for supplier
-- ============================================================================
-- Purpose: Returns details of a specific order if it has status 'open'
--          Used when supplier clicks on an order to see full details
-- Parameters:
--   p_order_id: Order ID to view
-- Returns: JSON object with order details or error
-- Code: 1=Success, 0=Order not found or not open
-- ============================================================================
CREATE OR REPLACE FUNCTION view_one_available_order_supplier(
    p_order_id INTEGER,
    p_supplier_id INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_order_record RECORD;
    v_available_driver_count INTEGER;
BEGIN
    -- Validate order_id
    IF p_order_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order ID cannot be null'
        );
    END IF;

    IF p_supplier_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Supplier ID cannot be null'
        );
    END IF;

    -- Only suppliers with at least one linked and available driver can view full details.
    SELECT COUNT(*)
    INTO v_available_driver_count
    FROM supplier_drivers
    WHERE supplier_user_id = p_supplier_id
      AND driver_user_id IS NOT NULL
      AND available = TRUE;

    IF v_available_driver_count <= 0 THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'You need at least one available linked driver to view full order details'
        );
    END IF;
    
    -- Get order details
    SELECT 
        o.order_id,
        o.customer_id,
        u.name AS customer_name,
        o.delivery_location,
        o.requested_capacity,
        o.customer_bid_price,
        o.status
    INTO v_order_record
    FROM orders o
    INNER JOIN users u ON u.user_id = o.customer_id
    WHERE o.order_id = p_order_id;
    
    -- Check if order exists
    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order not found'
        );
    END IF;
    
    -- Return order details
    RETURN json_build_object(
        'code', 1,
        'order_id', v_order_record.order_id,
        'customer_id', v_order_record.customer_id,
        'customer_name', v_order_record.customer_name,
        'delivery_location', v_order_record.delivery_location,
        'requested_capacity', v_order_record.requested_capacity,
        'customer_bid_price', v_order_record.customer_bid_price
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to fetch order details: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: Send bid for an order
-- ============================================================================
-- Purpose: Supplier places a bid on an open order
--          Validates order is available (status='open' and supplier_id is NULL)
-- Parameters:
--   p_order_id: Order ID to bid on
--   p_supplier_id: Supplier user_id placing the bid
--   p_bid_price: Supplier's bid price
-- Returns: JSON object with success status
-- Code: 1=Success, 0=Failure/Order not available
-- ============================================================================
CREATE OR REPLACE FUNCTION send_bid(
    p_order_id INTEGER,
    p_supplier_id INTEGER,
    p_bid_price INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_order_status VARCHAR(20);
    v_order_supplier_id INTEGER;
    v_existing_bid_created_at TIMESTAMP;
    v_wait_seconds INTEGER;
    v_available_driver_count INTEGER;
BEGIN
    -- Validate inputs
    IF p_order_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order ID cannot be null'
        );
    END IF;
    
    IF p_supplier_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Supplier ID cannot be null'
        );
    END IF;
    
    IF p_bid_price IS NULL OR p_bid_price <= 0 THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Bid price must be greater than 0'
        );
    END IF;

    -- Supplier must have at least one linked and currently available driver.
    SELECT COUNT(*)
    INTO v_available_driver_count
    FROM supplier_drivers
    WHERE supplier_user_id = p_supplier_id
      AND driver_user_id IS NOT NULL
      AND available = TRUE;

    IF v_available_driver_count <= 0 THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'You need at least one available linked driver before placing bids'
        );
    END IF;
    
    -- Check order status and supplier_id
    SELECT status, supplier_id INTO v_order_status, v_order_supplier_id
    FROM orders
    WHERE order_id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order not found'
        );
    END IF;
    
    -- Check if order is open OR supplier_id is NULL
    IF v_order_status != 'open' OR v_order_supplier_id IS NOT NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order is not available for bidding'
        );
    END IF;
    
        -- Expire old bids from this supplier on this order after 90 seconds.
    DELETE FROM bids
    WHERE order_id = p_order_id
      AND supplier_id = p_supplier_id
            AND created_at < (CURRENT_TIMESTAMP - INTERVAL '90 seconds');

        -- Enforce cooldown: one bid per 90 seconds per supplier per order.
    SELECT created_at
    INTO v_existing_bid_created_at
    FROM bids
    WHERE order_id = p_order_id
      AND supplier_id = p_supplier_id
            AND created_at >= (CURRENT_TIMESTAMP - INTERVAL '90 seconds')
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
                v_wait_seconds := CEIL(EXTRACT(EPOCH FROM ((v_existing_bid_created_at + INTERVAL '90 seconds') - CURRENT_TIMESTAMP)));
        v_wait_seconds := GREATEST(v_wait_seconds, 1);

        RETURN json_build_object(
            'code', 0,
                        'message', 'You can send only one bid every 90 seconds for this order',
            'retry_after_seconds', v_wait_seconds
        );
    END IF;

    -- Keep only one current bid row per supplier per order.
    INSERT INTO bids (
        order_id,
        supplier_id,
        bid_price,
        created_at
    ) VALUES (
        p_order_id,
        p_supplier_id,
        p_bid_price,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (order_id, supplier_id)
    DO UPDATE SET
        bid_price = EXCLUDED.bid_price,
        created_at = EXCLUDED.created_at;
    
    RETURN json_build_object(
        'code', 1,
        'message', 'Bid placed successfully',
        'expires_at', (CURRENT_TIMESTAMP + INTERVAL '90 seconds')
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to place bid: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- TRIGGER: Delete all bids when order status changes to 'supplier_timer'
-- ============================================================================
-- Purpose: When customer accepts a bid and order status becomes 'supplier_timer',
--          automatically delete all other bids for that order
-- ============================================================================
CREATE OR REPLACE FUNCTION delete_bids_on_acceptance()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if status changed to 'supplier_timer'
    IF NEW.status = 'supplier_timer' AND OLD.status != 'supplier_timer' THEN
        -- Delete all bids for this order
        DELETE FROM bids
        WHERE order_id = NEW.order_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_delete_bids_on_acceptance ON orders;
CREATE TRIGGER trigger_delete_bids_on_acceptance
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION delete_bids_on_acceptance();


-- ============================================================================
-- TRIGGER: Notify when driver_assignment table changes
-- ============================================================================
-- Purpose: Sends PostgreSQL NOTIFY signal for real-time driver assignment updates
--          Backend listens and broadcasts to supplier's screen via WebSocket
-- ============================================================================
CREATE OR REPLACE FUNCTION notify_driver_assignment_updated()
RETURNS TRIGGER AS $$
BEGIN
    -- Send notification on driver_assignment_channel with order_id
    IF TG_OP = 'DELETE' THEN
        PERFORM pg_notify('driver_assignment_channel', OLD.order_id::text);
        RETURN OLD;
    ELSE
        PERFORM pg_notify('driver_assignment_channel', NEW.order_id::text);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_driver_assignment_updated ON driver_assignment;
DROP TRIGGER IF EXISTS trigger_notify_driver_assignment_updated ON driver_assignment;
CREATE TRIGGER trigger_notify_driver_assignment_updated
    AFTER INSERT OR UPDATE OR DELETE ON driver_assignment
    FOR EACH ROW
    EXECUTE FUNCTION notify_driver_assignment_updated();


-- ============================================================================
-- FUNCTION: get_available_drivers_for_supplier
-- ============================================================================
-- Purpose: Get list of drivers with their assignment status for a specific order
--          Shows: available, pending (assigned but not accepted), rejected
-- Parameters:
--   p_supplier_id: Supplier ID to get drivers for
--   p_order_id: Order ID to check assignment status
-- Returns: JSON array with driver details and assignment status
-- ============================================================================
CREATE OR REPLACE FUNCTION get_available_drivers_for_supplier(
    p_supplier_id INTEGER,
    p_order_id INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_drivers JSON;
    v_order_eligible BOOLEAN;
BEGIN
    PERFORM cleanup_expired_failures();

    -- Validate input
    IF p_supplier_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Supplier ID cannot be null'
        );
    END IF;
    
    IF p_order_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order ID cannot be null'
        );
    END IF;

    -- Order must belong to supplier and still be within supplier timer window.
    SELECT EXISTS(
        SELECT 1 FROM orders
        WHERE order_id = p_order_id
          AND supplier_id = p_supplier_id
          AND status = 'supplier_timer'
          AND (time_limit_for_supplier IS NULL OR CURRENT_TIMESTAMP <= time_limit_for_supplier)
    ) INTO v_order_eligible;

    IF NOT v_order_eligible THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Supplier time limit has expired for this order'
        );
    END IF;
    
    -- Get drivers with their assignment status for this order
    SELECT COALESCE(json_agg(json_build_object(
        'driver_user_id', sd.driver_user_id,
        'driver_name', u.name,
        'driver_phone', u.phone,
        'status', CASE
            WHEN da.order_rejected = TRUE THEN 'rejected'
            WHEN da.driver_id IS NOT NULL AND CURRENT_TIMESTAMP <= da.time_limit_for_driver THEN 'pending'
            ELSE 'available'
        END,
        'time_limit', da.time_limit_for_driver
    )), '[]'::json) INTO v_drivers
    FROM supplier_drivers sd
    JOIN users u ON sd.driver_user_id = u.user_id
    LEFT JOIN driver_assignment da ON da.driver_id = sd.driver_user_id AND da.order_id = p_order_id
    WHERE sd.supplier_user_id = p_supplier_id
      AND sd.driver_user_id IS NOT NULL
      AND sd.available = TRUE;
    
    RETURN json_build_object(
        'code', 1,
        'drivers', v_drivers
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to get drivers: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: assign_driver_to_order
-- ============================================================================
-- Purpose: Supplier assigns a driver to an accepted order
-- Parameters:
--   p_order_id: Order ID to assign driver to
--   p_supplier_id: Supplier ID (for authorization)
--   p_driver_id: Driver user_id to assign
-- Returns: JSON object with code field
-- Code: 1=Success, 0=Failure
-- ============================================================================
CREATE OR REPLACE FUNCTION assign_driver_to_order(
    p_order_id INTEGER,
    p_supplier_id INTEGER,
    p_driver_id INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_driver_belongs BOOLEAN;
    v_order_valid BOOLEAN;
    v_assignment_exists BOOLEAN;
    v_other_pending_assignment_exists BOOLEAN;
BEGIN
    PERFORM cleanup_expired_failures();

    -- Validate inputs
    IF p_order_id IS NULL OR p_supplier_id IS NULL OR p_driver_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order ID, Supplier ID, and Driver ID cannot be null'
        );
    END IF;
    
    -- Check if driver belongs to this supplier
    SELECT EXISTS(
        SELECT 1 FROM supplier_drivers
        WHERE supplier_user_id = p_supplier_id 
        AND driver_user_id = p_driver_id
    ) INTO v_driver_belongs;
    
    IF NOT v_driver_belongs THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Driver does not belong to this supplier'
        );
    END IF;

    -- Check if the driver already has an active order (accepted, ride_started, reached)
    IF EXISTS(
    SELECT 1 FROM orders
    WHERE driver_id = p_driver_id
    AND status IN ('accepted', 'ride_started', 'reached')
) THEN
    RETURN json_build_object(
        'code', 0,
        'message', 'Driver already has an active order'
    );
END IF;

    -- Cleanup expired pending assignments for this driver.
    DELETE FROM driver_assignment
    WHERE driver_id = p_driver_id
      AND order_rejected = FALSE
      AND CURRENT_TIMESTAMP > time_limit_for_driver;

    -- A driver can only have one live pending assignment at a time.
    SELECT EXISTS(
        SELECT 1 FROM driver_assignment
        WHERE driver_id = p_driver_id
          AND order_rejected = FALSE
          AND CURRENT_TIMESTAMP <= time_limit_for_driver
    ) INTO v_other_pending_assignment_exists;

    IF v_other_pending_assignment_exists THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Driver already has a pending assignment'
        );
    END IF;
    
    -- Check if driver rejected this order
    SELECT EXISTS(
        SELECT 1 FROM driver_assignment
        WHERE order_id = p_order_id
        AND driver_id = p_driver_id
        AND order_rejected = TRUE
    ) INTO v_assignment_exists;
    
    IF v_assignment_exists THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Driver has rejected this order'
        );
    END IF;
    
    -- Check if order is valid for driver assignment
    -- Must have: correct supplier_id, status='supplier_timer', not expired, and driver_id IS NULL
    SELECT EXISTS(
        SELECT 1 FROM orders
        WHERE order_id = p_order_id
        AND supplier_id = p_supplier_id
        AND status = 'supplier_timer'
        AND (time_limit_for_supplier IS NULL OR CURRENT_TIMESTAMP <= time_limit_for_supplier)
        AND driver_id IS NULL
    ) INTO v_order_valid;
    
    IF NOT v_order_valid THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order not available for driver assignment'
        );
    END IF;
    
    -- Insert new driver_assignment with fresh 1 minute timer
    INSERT INTO driver_assignment (
        order_id,
        driver_id,
        supplier_id,
        time_limit_for_driver
    ) VALUES (
        p_order_id,
        p_driver_id,
        p_supplier_id,
        CURRENT_TIMESTAMP + INTERVAL '1 minute'
    );
    
    RETURN json_build_object(
        'code', 1,
        'message', 'Driver assigned successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to assign driver: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: Get order details for supplier
-- ============================================================================
-- Purpose: Returns order details including customer delivery location and driver info
--          Supplier can track order status and have contact details
-- Parameters:
--   p_supplier_id: Supplier user_id (for authorization)
--   p_order_id: Order ID to get details for
-- Returns: JSON object with order details
-- Code: 1=Success with data, 0=Failure/Not authorized
-- ============================================================================
CREATE OR REPLACE FUNCTION view_one_active_order_supplier(
    p_supplier_id INTEGER,
    p_order_id INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_order_record RECORD;
BEGIN
    PERFORM cleanup_expired_failures();

    -- Validate inputs
    IF p_supplier_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Supplier ID cannot be null'
        );
    END IF;
    
    IF p_order_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order ID cannot be null'
        );
    END IF;
    
    -- Get order details with customer and driver info
    SELECT 
        o.order_id,
        o.delivery_location,
        o.requested_capacity,
        o.accepted_price,
        o.status,
        o.order_confirmed_at,
        o.time_limit_for_supplier,
        cu.name AS customer_name,
        cu.phone AS customer_phone,
        du.name AS driver_name,
        du.phone AS driver_phone
    INTO v_order_record
    FROM orders o
    LEFT JOIN users cu ON o.customer_id = cu.user_id
    LEFT JOIN users du ON o.driver_id = du.user_id
    WHERE o.order_id = p_order_id
      AND o.supplier_id = p_supplier_id;
    
    -- Check if order exists and belongs to supplier
    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order not found or does not belong to you'
        );
    END IF;
    
    -- Return order details
    RETURN json_build_object(
        'code', 1,
        'order_id', v_order_record.order_id,
        'delivery_location', v_order_record.delivery_location,
        'quantity', v_order_record.requested_capacity,
        'accepted_price', v_order_record.accepted_price,
        'status', v_order_record.status,
        'order_confirmed_at', v_order_record.order_confirmed_at,
        'time_limit_for_supplier', v_order_record.time_limit_for_supplier,
        'customer_name', v_order_record.customer_name,
        'customer_phone', v_order_record.customer_phone,
        'driver_name', v_order_record.driver_name,
        'driver_phone', v_order_record.driver_phone
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
-- FUNCTION: Get active orders for supplier
-- ============================================================================
-- Purpose: Returns list of all active orders for a supplier
--          Active means status is supplier_timer, accepted, or ride_started
-- Parameters:
--   p_supplier_id: Supplier user_id
-- Returns: JSON array with active orders
-- ============================================================================
CREATE OR REPLACE FUNCTION list_active_orders_supplier(
    p_supplier_id INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_orders JSON;
BEGIN
    PERFORM cleanup_expired_failures();

    -- Validate supplier_id
    IF p_supplier_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Supplier ID cannot be null'
        );
    END IF;
    
    -- Get all active orders for this supplier
    SELECT COALESCE(json_agg(
        json_build_object(
            'order_id', o.order_id,
            'delivery_location', o.delivery_location,
            'quantity', o.requested_capacity,
            'accepted_price', o.accepted_price,
            'status', o.status,
            'created_at', o.created_at,
            'order_confirmed_at', o.order_confirmed_at,
            'time_limit_for_supplier', o.time_limit_for_supplier,
            'customer_name', cu.name,
            'customer_phone', cu.phone,
            'driver_name', du.name,
            'driver_phone', du.phone
                ) ORDER BY o.created_at DESC
    ), '[]'::json) INTO v_orders
    FROM orders o
    LEFT JOIN users cu ON o.customer_id = cu.user_id
    LEFT JOIN users du ON o.driver_id = du.user_id
    WHERE o.supplier_id = p_supplier_id
            AND o.status IN ('supplier_timer', 'accepted', 'ride_started', 'reached')
            AND (o.status != 'supplier_timer' OR o.time_limit_for_supplier IS NULL OR CURRENT_TIMESTAMP <= o.time_limit_for_supplier);
    
    RETURN json_build_object(
        'code', 1,
        'orders', v_orders
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to get active orders: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: View past order details for supplier
-- ============================================================================
-- Purpose: Get detailed information for a single past order from order_history
-- Parameters:
--   p_supplier_id: Supplier user_id (for authorization)
--   p_order_id: Order ID to view details for
-- Returns: JSON object with order details
-- ============================================================================
CREATE OR REPLACE FUNCTION view_past_order_details_supplier(
    p_supplier_id INTEGER,
    p_order_id INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_order_record RECORD;
    v_supplier_phone VARCHAR(20);
BEGIN
    -- Validate inputs
    IF p_supplier_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Supplier ID cannot be null'
        );
    END IF;
    
    IF p_order_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order ID cannot be null'
        );
    END IF;
    
    SELECT phone INTO v_supplier_phone
    FROM users
    WHERE user_id = p_supplier_id;

    -- Get order from order_history
    SELECT * INTO v_order_record
    FROM order_history
    WHERE order_id = p_order_id AND supplier_phone = v_supplier_phone;
    
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
            'driver_name', v_order_record.driver_name,
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


-- ============================================================================
-- FUNCTION: Logout supplier
-- ============================================================================
-- Purpose: Safely log out a supplier. 
--          1. Blocks logout if there is an active delivery or pending decision.
--             (supplier_timer, accepted, ride_started, reached).
--          2. Retracts all pending bids on open orders.
--          3. Deletes the session token.
-- Parameters:
--   p_user_id: Supplier user_id
--   p_session_token: The session token to delete
-- Returns: JSON object with status
-- ============================================================================
CREATE OR REPLACE FUNCTION logout_supplier(
    p_user_id INTEGER,
    p_session_token VARCHAR(255)
)
RETURNS JSON AS $$
DECLARE
    v_active_order_exists BOOLEAN;
BEGIN
    -- 1. Check for active orders
    -- This covers the 1-minute window (supplier_timer) AND active deliveries (accepted to reached).
    -- We ALLOW logout if the order is 'finished' (waiting for customer rating).
    SELECT EXISTS(
        SELECT 1 FROM orders 
        WHERE supplier_id = p_user_id 
        AND status IN ('supplier_timer', 'accepted', 'ride_started', 'reached')
    ) INTO v_active_order_exists;

    IF v_active_order_exists THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Cannot logout while you have a delivery in progress or a pending order decision.'
        );
    END IF;

    -- 2. Handle active bids: retract them
    DELETE FROM bids
    WHERE supplier_id = p_user_id;

    -- 3. Delete the session
    DELETE FROM sessions 
    WHERE token = p_session_token AND user_id = p_user_id;

    RETURN json_build_object(
        'code', 1,
        'message', 'Logged out successfully. All pending bids retracted.'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Logout failed: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: Delete supplier account
-- ============================================================================
-- Purpose: Permanently delete a supplier account. 
--          1. Blocks deletion if there is a delivery in progress.
--          2. Archives 'finished' orders into order_history.
--          3. Logs out all currently linked drivers (deletes their sessions).
--          4. Retracts all active bids.
--          5. Deletes the user record (cascading to profile and driver links).
-- Parameters:
--   p_user_id: Supplier user_id
-- Returns: JSON object with status
-- ============================================================================
CREATE OR REPLACE FUNCTION delete_supplier_account(
    p_user_id INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_active_order_exists BOOLEAN;
    v_order_record RECORD;
BEGIN
    -- 1. Check for active orders that MUST be physically completed first
    SELECT EXISTS(
        SELECT 1 FROM orders 
        WHERE supplier_id = p_user_id 
        AND status IN ('supplier_timer', 'accepted', 'ride_started', 'reached')
    ) INTO v_active_order_exists;

    IF v_active_order_exists THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Cannot delete account while there is a delivery in progress. Please wait for completion.'
        );
    END IF;

    -- 2. Snapshot any 'finished' orders to history
    FOR v_order_record IN (
        SELECT o.*, u.name AS customer_name, u.phone AS customer_phone,
               s.name AS supplier_name, s.phone AS supplier_phone,
               d.name AS driver_name, d.phone AS driver_phone,
               sp.yard_location AS yard_location
        FROM orders o
        LEFT JOIN users u ON o.customer_id = u.user_id
        LEFT JOIN users s ON o.supplier_id = s.user_id
        LEFT JOIN users d ON o.driver_id = d.user_id
        LEFT JOIN suppliers sp ON o.supplier_id = sp.user_id
        WHERE o.supplier_id = p_user_id AND o.status = 'finished'
    ) LOOP
        INSERT INTO order_history (
            order_id, supplier_id, customer_name, customer_phone, supplier_name, supplier_phone, driver_name, driver_phone,
            customer_location, yard_location, price, quantity, status, order_date, reason, customer_rating, rated_at, created_at
        ) VALUES (
            v_order_record.order_id, v_order_record.supplier_id,
            COALESCE(v_order_record.customer_name, ''),
            COALESCE(v_order_record.customer_phone, ''),
            v_order_record.supplier_name, v_order_record.supplier_phone,
            v_order_record.driver_name, v_order_record.driver_phone,
            v_order_record.delivery_location, COALESCE(v_order_record.yard_location, ''),
            v_order_record.accepted_price, v_order_record.requested_capacity,
            'completed', v_order_record.order_confirmed_at,
            NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        );
        
        DELETE FROM orders WHERE order_id = v_order_record.order_id;
    END LOOP;

    -- 3. Cascading Logout: Remove sessions for all linked drivers
    DELETE FROM sessions WHERE user_id IN (
        SELECT driver_user_id FROM supplier_drivers WHERE supplier_id = p_user_id
    );

    -- 4. Retract all active bids
    DELETE FROM bids WHERE supplier_id = p_user_id;

    -- 5. Delete the user (cascades to supplier profile, driver links, and tokens)
    DELETE FROM users WHERE user_id = p_user_id;

    RETURN json_build_object(
        'code', 1,
        'message', 'Account deleted successfully. All linked drivers have been logged out.'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Account deletion failed: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

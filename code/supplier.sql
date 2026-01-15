-- Purpose: Enter supplier details (name, yard location, business contact)
--          Role will be set later after CNIC upload
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
    
    -- Check if user already has supplier role
    SELECT role INTO v_current_role
    FROM users
    WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'User not found'
        );
    END IF;
    
    IF v_current_role = 'supplier' THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Supplier already exists'
        );
    END IF;
    
    -- Update user name (DO NOT set role yet)
    UPDATE users
    SET name = TRIM(p_name)
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
        -- Insert new supplier record (CNIC paths will be set later)
        INSERT INTO SUPPLIERS (USER_ID, YARD_LOCATION, BUSINESS_CONTACT, CNIC_FRONT_PATH, CNIC_BACK_PATH, CREATED_AT)
        VALUES (p_user_id, TRIM(p_yard_location), TRIM(p_business_contact), '', '', CURRENT_TIMESTAMP);
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


-- Purpose: Upload CNIC images for supplier
--          Updates CNIC paths in SUPPLIERS table and sets role to 'supplier'
-- Parameters:
--   p_user_id: User ID (supplier)
--   p_cnic_front_path: URL/path to CNIC front image
--   p_cnic_back_path: URL/path to CNIC back image
-- Returns: JSON object with success status
-- Code: 1=Success, 0=Failure/Already exists
CREATE OR REPLACE FUNCTION upload_cnic_supplier(
    p_user_id INTEGER,
    p_cnic_front_path TEXT,
    p_cnic_back_path TEXT
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
    
    
    
    -- Check if user already has supplier role
    SELECT role INTO v_current_role
    FROM users
    WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'User not found'
        );
    END IF;
    
    IF v_current_role = 'supplier' THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Supplier already exists'
        );
    END IF;
    
    
    
    -- Validate CNIC paths
    IF p_cnic_front_path IS NULL OR TRIM(p_cnic_front_path) = '' THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'CNIC front path cannot be empty'
        );
    END IF;
    
    IF p_cnic_back_path IS NULL OR TRIM(p_cnic_back_path) = '' THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'CNIC back path cannot be empty'
        );
    END IF;
    
    -- Check if supplier record exists
    SELECT EXISTS(SELECT 1 FROM SUPPLIERS WHERE USER_ID = p_user_id) INTO v_supplier_exists;
    
    IF NOT v_supplier_exists THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Supplier details not found. Please complete supplier details first.'
        );
    END IF;
    
    -- Update CNIC paths in SUPPLIERS table
    UPDATE SUPPLIERS
    SET CNIC_FRONT_PATH = TRIM(p_cnic_front_path),
        CNIC_BACK_PATH = TRIM(p_cnic_back_path)
    WHERE USER_ID = p_user_id;
    
    -- Finally, set role to 'supplier' in users table
    UPDATE users
    SET role = 'supplier'
    WHERE user_id = p_user_id;
    
    RETURN json_build_object(
        'code', 1,
        'message', 'CNIC uploaded successfully. Supplier registration complete.'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to upload CNIC: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;






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
    -- Query all open orders with customer details
    SELECT json_agg(
        json_build_object(
            'order_id', o.order_id,
            'customer_id', o.customer_id,
            'customer_name', u.name,
            'delivery_location', o.delivery_location,
            'requested_capacity', o.requested_capacity,
            'customer_bid_price', o.customer_bid_price
        )
    ) INTO v_orders
    FROM orders o
    INNER JOIN users u ON o.customer_id = u.user_id
    WHERE o.status = 'open'
      AND o.supplier_id IS NULL
      AND o.driver_id IS NULL
    ORDER BY o.created_at DESC;
    
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
CREATE OR REPLACE FUNCTION view_order_details(
    p_order_id INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_order_record RECORD;
BEGIN
    -- Validate order_id
    IF p_order_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order ID cannot be null'
        );
    END IF;
    
    -- Get order details
    SELECT 
        order_id,
        customer_id,
        delivery_location,
        requested_capacity,
        customer_bid_price,
        status
    INTO v_order_record
    FROM orders
    WHERE order_id = p_order_id;
    
    -- Check if order exists
    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order not found'
        );
    END IF;
    
    -- Check if order status is 'open'
    IF v_order_record.status != 'open' THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order is not available (status: ' || v_order_record.status || ')'
        );
    END IF;
    
    -- Return order details
    RETURN json_build_object(
        'code', 1,
        'order_id', v_order_record.order_id,
        'customer_id', v_order_record.customer_id,
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
    
    -- Insert bid into BIDS table
    INSERT INTO BIDS (
        ORDER_ID,
        SUPPLIER_ID,
        BID_PRICE,
        CREATED_AT
    ) VALUES (
        p_order_id,
        p_supplier_id,
        p_bid_price,
        CURRENT_TIMESTAMP
    );
    
    RETURN json_build_object(
        'code', 1,
        'message', 'Bid placed successfully'
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
BEGIN
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
BEGIN
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
    -- Must have: correct supplier_id, status='supplier_timer', and driver_id IS NULL
    SELECT EXISTS(
        SELECT 1 FROM orders
        WHERE order_id = p_order_id
        AND supplier_id = p_supplier_id
        AND status = 'supplier_timer'
        AND driver_id IS NULL
    ) INTO v_order_valid;
    
    IF NOT v_order_valid THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order not available for driver assignment'
        );
    END IF;
    
    -- Delete old expired assignment (timer ran out, not rejected)
    DELETE FROM driver_assignment
    WHERE order_id = p_order_id
      AND driver_id = p_driver_id
      AND order_rejected = FALSE;
    
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
CREATE OR REPLACE FUNCTION get_order_details_supplier(
    p_supplier_id INTEGER,
    p_order_id INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_order_record RECORD;
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
    
    -- Get order details with customer and driver info
    SELECT 
        o.order_id,
        o.delivery_location,
        o.requested_capacity,
        o.accepted_price,
        o.status,
        o.order_confirmed_at,
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
CREATE OR REPLACE FUNCTION get_active_orders_supplier(
    p_supplier_id INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_orders JSON;
BEGIN
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
        )
    ), '[]'::json) INTO v_orders
    FROM orders o
    LEFT JOIN users cu ON o.customer_id = cu.user_id
    LEFT JOIN users du ON o.driver_id = du.user_id
    WHERE o.supplier_id = p_supplier_id
      AND o.status IN ('supplier_timer', 'accepted', 'ride_started', 'reached')
    ORDER BY o.created_at DESC;
    
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
    v_driver_name TEXT;
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
    
    -- Get order from order_history
    SELECT * INTO v_order_record
    FROM order_history
    WHERE order_id = p_order_id AND supplier_id = p_supplier_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order not found in your history'
        );
    END IF;
    
    -- Get driver name (may be NULL if no driver was assigned)
    IF v_order_record.driver_id IS NOT NULL THEN
        SELECT name INTO v_driver_name
        FROM users
        WHERE user_id = v_order_record.driver_id;
    END IF;
    
    -- Return order details
    RETURN json_build_object(
        'code', 1,
        'order', json_build_object(
            'order_date', v_order_record.order_date,
            'price', v_order_record.price,
            'quantity', v_order_record.quantity,
            'customer_location', v_order_record.customer_location,
            'driver_name', v_driver_name,
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

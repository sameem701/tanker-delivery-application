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
            'customer_bid_price', o.customer_bid_price,
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

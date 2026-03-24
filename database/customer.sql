-- Purpose: Enter/update customer details (name and optional home address)
-- Parameters:
--   p_user_id: User ID
--   p_name: Customer name
--   p_home_address: Home address (optional, can be NULL or empty)
-- Returns: JSON object with success status
-- Code: 1=Success, 0=Failure/Already exists
CREATE OR REPLACE FUNCTION enter_details_customer(
    p_user_id INTEGER,
    p_name VARCHAR(25),
    p_home_address TEXT
)
RETURNS JSON AS $$
DECLARE
    v_address_exists BOOLEAN;
    v_current_role VARCHAR(20);
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
    
    
    -- Handle home address if provided
    IF p_home_address IS NOT NULL AND TRIM(p_home_address) != '' THEN
        -- Check if address record exists
        SELECT EXISTS(SELECT 1 FROM customer_address WHERE user_id = p_user_id) INTO v_address_exists;
        
        IF v_address_exists THEN
            -- Update existing address
            UPDATE customer_address
            SET home_address = TRIM(p_home_address)
            WHERE user_id = p_user_id;
        ELSE
            -- Insert new address
            INSERT INTO customer_address (user_id, home_address)
            VALUES (p_user_id, TRIM(p_home_address));
        END IF;
    END IF;
    
     -- Update user name and set role to customer
    UPDATE users
    SET name = TRIM(p_name),
        role = 'customer'
    WHERE user_id = p_user_id;
   

    RETURN json_build_object(
        'code', 1,
        'message', 'Customer details saved successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to save details: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


---------------------------------------
--              ORDERS
---------------------------------------

CREATE OR REPLACE FUNCTION START_ORDER (
    p_customer_id INTEGER,
    p_delivery_location TEXT,
    p_requested_capacity NUMERIC (5,0),
    p_customer_bid_price NUMERIC (7,0)
)
RETURNS JSON AS $$
DECLARE
    v_customer_role VARCHAR(20);
    v_new_order_id INTEGER;
    v_existing_active_order_id INTEGER;
    v_existing_active_order_status VARCHAR(20);
    v_base_price INTEGER;
    v_min_price NUMERIC(10,2);
    v_max_price NUMERIC(10,2);
BEGIN
    PERFORM cleanup_expired_failures();

    -- Validate customer_id
    IF p_customer_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Customer ID cannot be null'
        );
    END IF;
    
    -- Check if user exists and has customer role
    SELECT role INTO v_customer_role
    FROM users
    WHERE user_id = p_customer_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'User not found'
        );
    END IF;
    
    IF v_customer_role != 'customer' THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'User is not a customer'
        );
    END IF;
    
    -- Validate delivery location
    IF p_delivery_location IS NULL OR TRIM(p_delivery_location) = '' THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Delivery location cannot be empty'
        );
    END IF;
    
    -- Validate requested capacity exists in quantity_pricing table
    IF p_requested_capacity IS NULL OR p_requested_capacity <= 0 THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Requested capacity must be greater than 0'
        );
    END IF;
    
    -- Check if requested capacity is one of the allowed quantities
    SELECT base_price INTO v_base_price
    FROM quantity_pricing
    WHERE quantity_in_gallon = p_requested_capacity;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Invalid quantity. Please select from available options'
     );
    END IF;
    
    -- Calculate min and max allowed bid prices (85% to 300% of base price)
    v_min_price := v_base_price * 0.85;
    v_max_price := v_base_price * 3.0;
    
    -- Validate customer bid price
    IF p_customer_bid_price IS NULL OR p_customer_bid_price <= 0 THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Bid price must be greater than 0'
        );
    END IF;
    
    -- Check if bid price is within allowed range
    IF p_customer_bid_price < v_min_price OR p_customer_bid_price > v_max_price THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Incorrect pricing'
        );
    END IF;

    -- Enforce one active order per customer.
    SELECT order_id, status
    INTO v_existing_active_order_id, v_existing_active_order_status
    FROM orders
    WHERE customer_id = p_customer_id
      AND status IN ('open', 'supplier_timer', 'accepted', 'ride_started', 'reached')
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'You already have an active order. Complete or cancel it before placing a new one',
            'active_order_id', v_existing_active_order_id,
            'active_order_status', v_existing_active_order_status
        );
    END IF;
    
    -- Insert new order with status 'open'
    INSERT INTO ORDERS (
        CUSTOMER_ID,
        DELIVERY_LOCATION,
        REQUESTED_CAPACITY,
        CUSTOMER_BID_PRICE,
        STATUS,
        CREATED_AT
    ) VALUES (
        p_customer_id,
        TRIM(p_delivery_location),
        p_requested_capacity,
        p_customer_bid_price,
        'open',
        CURRENT_TIMESTAMP
    )
    RETURNING ORDER_ID INTO v_new_order_id;
    
    RETURN json_build_object(
        'code', 1,
        'order_id', v_new_order_id,
        'message', 'Order created successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to create order: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: Accept supplier bid
-- ============================================================================
-- Purpose: Customer accepts a supplier's bid on their order
--          Updates order with supplier details and changes status to 'supplier_timer'
-- Parameters:
--   p_bid_id: Bid ID to accept
--   p_customer_id: Customer user_id (for validation)
-- Returns: JSON object with success status
-- Code: 1=Success, 0=Failure/Bid not found or invalid
-- ============================================================================
CREATE OR REPLACE FUNCTION accept_bid(
    p_bid_id INTEGER,
    p_customer_id INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_bid_record RECORD;
    v_order_exists BOOLEAN;
    v_available_driver_count INTEGER;
    v_active_order_count INTEGER;
    v_rows_updated INTEGER;
BEGIN
    PERFORM cleanup_expired_failures();

    -- Validate inputs
    IF p_bid_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Bid ID cannot be null'
        );
    END IF;
    
    IF p_customer_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Customer ID cannot be null'
        );
    END IF;
    
        -- Remove this bid if it has already expired (90-second validity).
        DELETE FROM bids
        WHERE bid_id = p_bid_id
            AND created_at < (CURRENT_TIMESTAMP - INTERVAL '90 seconds');

        -- Get bid details only if still valid.
        SELECT order_id, supplier_id, bid_price INTO v_bid_record
    FROM bids
        WHERE bid_id = p_bid_id
            AND created_at >= (CURRENT_TIMESTAMP - INTERVAL '90 seconds');
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Bid not found or expired'
        );
    END IF;

    -- Serialize accepts for this supplier to avoid race-condition over-allocation.
    PERFORM 1
    FROM suppliers
    WHERE user_id = v_bid_record.supplier_id
    FOR UPDATE;
    
    -- Verify order belongs to customer AND is still open (combined check)
    SELECT EXISTS(
        SELECT 1 FROM orders
        WHERE order_id = v_bid_record.order_id
          AND customer_id = p_customer_id
          AND status = 'open'
    ) INTO v_order_exists;
    
    IF NOT v_order_exists THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order is not available for bid acceptance'
        );
    END IF;

    -- Supplier can hold multiple active orders only up to available linked drivers.
    SELECT COUNT(*)
    INTO v_available_driver_count
    FROM supplier_drivers
    WHERE supplier_user_id = v_bid_record.supplier_id
      AND driver_user_id IS NOT NULL
      AND available = TRUE;

    IF v_available_driver_count <= 0 THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Selected supplier has no available drivers for a new active order'
        );
    END IF;

    SELECT COUNT(*)
    INTO v_active_order_count
    FROM orders
    WHERE supplier_id = v_bid_record.supplier_id
      AND status IN ('supplier_timer', 'accepted', 'ride_started', 'reached');

    IF v_active_order_count >= v_available_driver_count THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Selected supplier has reached active-order capacity based on available drivers',
            'active_orders', v_active_order_count,
            'available_drivers', v_available_driver_count
        );
    END IF;
    
    -- Update order with accepted bid details
    UPDATE orders
    SET supplier_id = v_bid_record.supplier_id,
        accepted_price = v_bid_record.bid_price,
        time_limit_for_supplier = CURRENT_TIMESTAMP + INTERVAL '5 minutes',
        status = 'supplier_timer'
    WHERE order_id = v_bid_record.order_id
      AND customer_id = p_customer_id
      AND status = 'open';

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    IF v_rows_updated = 0 THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order is not available for bid acceptance'
        );
    END IF;
    
    RETURN json_build_object(
        'code', 1,
        'message', 'Bid accepted successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to accept bid: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: View bids for customer's open order
-- ============================================================================
-- Purpose: Returns currently valid supplier bids (90-second validity window)
--          for a customer's own order, only while order is still open.
-- ============================================================================
CREATE OR REPLACE FUNCTION view_order_bids_customer(
    p_customer_id INTEGER,
    p_order_id INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_order_customer_id INTEGER;
    v_order_status VARCHAR(20);
    v_bids JSON;
BEGIN
    IF p_customer_id IS NULL OR p_order_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Customer ID and Order ID cannot be null'
        );
    END IF;

        -- Remove expired bids first so customer only sees currently valid bids.
    DELETE FROM bids
    WHERE order_id = p_order_id
            AND created_at < (CURRENT_TIMESTAMP - INTERVAL '90 seconds');

    SELECT customer_id, status
    INTO v_order_customer_id, v_order_status
    FROM orders
    WHERE order_id = p_order_id;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order not found'
        );
    END IF;

    IF v_order_customer_id != p_customer_id THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order does not belong to you'
        );
    END IF;

    IF v_order_status != 'open' THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Bids are only visible while order is open'
        );
    END IF;

    SELECT COALESCE(json_agg(
        json_build_object(
            'bid_id', b.bid_id,
            'supplier_id', b.supplier_id,
            'supplier_name', u.name,
            'supplier_phone', u.phone,
            'supplier_rating', s.rating,
            'bid_price', b.bid_price,
            'created_at', b.created_at,
            'expires_at', (b.created_at + INTERVAL '90 seconds')
        ) ORDER BY b.bid_price ASC, b.created_at DESC
    ), '[]'::json) INTO v_bids
    FROM bids b
    JOIN users u ON u.user_id = b.supplier_id
    LEFT JOIN suppliers s ON s.user_id = b.supplier_id
    WHERE b.order_id = p_order_id
    AND b.created_at >= (CURRENT_TIMESTAMP - INTERVAL '90 seconds');

    RETURN json_build_object(
        'code', 1,
        'order_id', p_order_id,
        'bids', v_bids
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to view order bids: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: Update customer bid for open order
-- ============================================================================
-- Purpose: Customer can adjust own bid while order remains open.
--          Any existing supplier bids are cleared when customer changes price.
-- ============================================================================
CREATE OR REPLACE FUNCTION update_customer_open_order_bid(
    p_customer_id INTEGER,
    p_order_id INTEGER,
    p_customer_bid_price NUMERIC(7,0)
)
RETURNS JSON AS $$
DECLARE
    v_order_customer_id INTEGER;
    v_order_status VARCHAR(20);
    v_requested_capacity NUMERIC(5,0);
    v_base_price INTEGER;
    v_min_price NUMERIC(10,2);
    v_max_price NUMERIC(10,2);
BEGIN
    IF p_customer_id IS NULL OR p_order_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Customer ID and Order ID cannot be null'
        );
    END IF;

    IF p_customer_bid_price IS NULL OR p_customer_bid_price <= 0 THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Bid price must be greater than 0'
        );
    END IF;

    SELECT customer_id, status, requested_capacity
    INTO v_order_customer_id, v_order_status, v_requested_capacity
    FROM orders
    WHERE order_id = p_order_id;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order not found'
        );
    END IF;

    IF v_order_customer_id != p_customer_id THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order does not belong to you'
        );
    END IF;

    IF v_order_status != 'open' THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Cannot update bid after supplier bid acceptance or cancellation'
        );
    END IF;

    SELECT base_price INTO v_base_price
    FROM quantity_pricing
    WHERE quantity_in_gallon = v_requested_capacity;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Invalid order quantity pricing setup'
        );
    END IF;

    v_min_price := v_base_price * 0.85;
    v_max_price := v_base_price * 3.0;

    IF p_customer_bid_price < v_min_price OR p_customer_bid_price > v_max_price THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Incorrect pricing'
        );
    END IF;

    UPDATE orders
    SET customer_bid_price = p_customer_bid_price,
        updated_at = CURRENT_TIMESTAMP
    WHERE order_id = p_order_id
      AND customer_id = p_customer_id
      AND status = 'open';

    -- Customer changed expected price; previous supplier bids are no longer valid.
    DELETE FROM bids
    WHERE order_id = p_order_id;

    RETURN json_build_object(
        'code', 1,
        'message', 'Order bid updated successfully',
        'order_id', p_order_id,
        'customer_bid_price', p_customer_bid_price
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to update order bid: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: Get order details for customer
-- ============================================================================
-- Purpose: Returns complete order details including supplier and driver info
--          Customer can track their order status and contact details
-- Parameters:
--   p_customer_id: Customer user_id (for authorization)
--   p_order_id: Order ID to get details for
-- Returns: JSON object with order details
-- Code: 1=Success with data, 0=Failure/Not authorized
-- ============================================================================
CREATE OR REPLACE FUNCTION get_order_details_customer(
    p_customer_id INTEGER,
    p_order_id INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_order_record RECORD;
BEGIN
    -- Validate inputs
    IF p_customer_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Customer ID cannot be null'
        );
    END IF;
    
    IF p_order_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order ID cannot be null'
        );
    END IF;
    
    -- Get order details with supplier and driver info
    SELECT 
        o.order_id,
        o.customer_id,
        o.delivery_location,
        o.requested_capacity,
        o.accepted_price,
        o.status,
        o.created_at,
        s.yard_location AS supplier_yard_location,
        s.business_contact AS supplier_business_contact,
        su.name AS supplier_name,
        du.name AS driver_name,
        du.phone AS driver_phone
    INTO v_order_record
    FROM orders o
    LEFT JOIN suppliers s ON o.supplier_id = s.user_id
    LEFT JOIN users su ON s.user_id = su.user_id
    LEFT JOIN users du ON o.driver_id = du.user_id
    WHERE o.order_id = p_order_id
      AND o.customer_id = p_customer_id;
    
    -- Check if order exists and belongs to customer
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
        'supplier_name', v_order_record.supplier_name,
        'supplier_business_contact', v_order_record.supplier_business_contact,
        'supplier_yard_location', v_order_record.supplier_yard_location,
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
-- FUNCTION: Submit rating for completed order
-- ============================================================================
-- Purpose: Customer rates supplier after order completion
--          Calculates weighted average rating and updates supplier's rating,
--          increments supplier's total_orders count
-- Parameters:
--   p_customer_id: Customer user_id (for authorization)
--   p_order_id: Order ID to rate
--   p_rating: Rating value (1-5)
-- Returns: JSON object with code field
-- Code: 1=Success, 0=Failure
-- ============================================================================
CREATE OR REPLACE FUNCTION submit_rating(
    p_customer_id INTEGER,
    p_order_id INTEGER,
    p_rating INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_customer_phone VARCHAR(20);
    v_supplier_phone VARCHAR(20);
    v_supplier_id INTEGER;
    v_order_status VARCHAR(20);
    v_existing_rating INTEGER;
    v_already_processed BOOLEAN;
    v_current_rating DECIMAL(3,2);
    v_total_orders INTEGER;
    v_new_rating DECIMAL(3,2);
BEGIN
    PERFORM cleanup_expired_failures();

    -- Validate inputs
    IF p_customer_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Customer ID cannot be null'
        );
    END IF;
    
    IF p_order_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order ID cannot be null'
        );
    END IF;

    IF p_rating IS NOT NULL AND (p_rating < 1 OR p_rating > 5) THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Rating must be between 1 and 5'
        );
    END IF;

    -- Resolve and validate customer identity.
    SELECT phone INTO v_customer_phone
    FROM users
    WHERE user_id = p_customer_id
      AND role = 'customer';

    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Customer not found'
        );
    END IF;

    -- Get completed-order snapshot and verify ownership in history.
    SELECT supplier_phone, status, customer_rating, (rated_at IS NOT NULL)
    INTO v_supplier_phone, v_order_status, v_existing_rating, v_already_processed
    FROM order_history
    WHERE order_id = p_order_id
      AND customer_phone = v_customer_phone;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Completed order snapshot not found for this customer'
        );
    END IF;

    IF v_order_status != 'completed' THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Only completed orders can be rated. Current status: ' || v_order_status
        );
    END IF;

    -- Rating/skip can be submitted only once per order.
    IF v_already_processed OR v_existing_rating IS NOT NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Rating decision already submitted for this order'
        );
    END IF;

    -- Resolve supplier by phone from immutable history snapshot.
    SELECT user_id INTO v_supplier_id
    FROM users
    WHERE phone = v_supplier_phone
      AND role = 'supplier';

    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Supplier not found for this order'
        );
    END IF;

    -- Get supplier's current rating and total_orders
    SELECT rating, total_orders INTO v_current_rating, v_total_orders
    FROM suppliers
    WHERE user_id = v_supplier_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Supplier profile not found for this order'
        );
    END IF;

    IF p_rating IS NULL THEN
        -- Customer skipped rating: keep rating unchanged, increment total_orders.
        UPDATE suppliers
        SET total_orders = total_orders + 1
        WHERE user_id = v_supplier_id;

        UPDATE order_history
        SET customer_rating = NULL,
            rated_at = CURRENT_TIMESTAMP
        WHERE order_id = p_order_id
          AND customer_phone = v_customer_phone;

        RETURN json_build_object(
            'code', 1,
            'message', 'Rating skipped. Supplier total orders updated'
        );
    END IF;

    -- Customer provided rating: update weighted average and total_orders.
    v_new_rating := ((COALESCE(v_current_rating, 0) * COALESCE(v_total_orders, 0)) + p_rating)
                    / (COALESCE(v_total_orders, 0) + 1);

    UPDATE suppliers
    SET rating = v_new_rating,
        total_orders = total_orders + 1
    WHERE user_id = v_supplier_id;

    UPDATE order_history
    SET customer_rating = p_rating,
        rated_at = CURRENT_TIMESTAMP
    WHERE order_id = p_order_id
      AND customer_phone = v_customer_phone;

    RETURN json_build_object(
        'code', 1,
        'message', 'Rating submitted successfully'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Failed to submit rating: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FUNCTION: View past order details for customer
-- ============================================================================
-- Purpose: Get detailed information for a single past order from order_history
-- Parameters:
--   p_customer_id: Customer user_id (for authorization)
--   p_order_id: Order ID to view details for
-- Returns: JSON object with order details
-- ============================================================================
CREATE OR REPLACE FUNCTION view_past_order_details_customer(
    p_customer_id INTEGER,
    p_order_id INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_order_record RECORD;
    v_customer_phone VARCHAR(20);
BEGIN
    -- Validate inputs
    IF p_customer_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Customer ID cannot be null'
        );
    END IF;
    
    IF p_order_id IS NULL THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order ID cannot be null'
        );
    END IF;
    
    SELECT phone INTO v_customer_phone
    FROM users
    WHERE user_id = p_customer_id;

    -- Get order from order_history
    SELECT * INTO v_order_record
    FROM order_history
    WHERE order_id = p_order_id AND customer_phone = v_customer_phone;
    
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
            'quantity', v_order_record.quantity,
            'price', v_order_record.price,
            'status', v_order_record.status,
            'driver_name', v_order_record.driver_name,
            'supplier_name', v_order_record.supplier_name,
            'customer_location', v_order_record.customer_location,
            'yard_location', v_order_record.yard_location
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

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
    
    -- Check if user already has customer role
    SELECT role INTO v_current_role
    FROM users
    WHERE user_id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'User not found'
        );
    END IF;
    
    IF v_current_role = 'customer' THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Customer already exists'
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
    v_base_price INTEGER;
    v_min_price NUMERIC(10,2);
    v_max_price NUMERIC(10,2);
BEGIN
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
    
    -- Delete any existing open order for this customer
    DELETE FROM ORDERS 
    WHERE CUSTOMER_ID = p_customer_id AND STATUS = 'open';
    
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
BEGIN
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
    
    -- Get bid details
    SELECT order_id, supplier_id, bid_price INTO v_bid_record
    FROM bids
    WHERE bid_id = p_bid_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Bid not found'
        );
    END IF;
    
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
    
    -- Update order with accepted bid details
    UPDATE orders
    SET supplier_id = v_bid_record.supplier_id,
        accepted_price = v_bid_record.bid_price,
        time_limit_for_supplier = CURRENT_TIMESTAMP + INTERVAL '5 minutes',
        status = 'supplier_timer'
    WHERE order_id = v_bid_record.order_id;
    
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
    v_order_customer_id INTEGER;
    v_supplier_id INTEGER;
    v_order_status VARCHAR(20);
    v_current_rating DECIMAL(3,2);
    v_total_orders INTEGER;
    v_new_rating DECIMAL(3,2);
    v_already_rated BOOLEAN;
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
    
    IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Rating must be between 1 and 5'
        );
    END IF;
    
    -- Get order details and verify ownership
    SELECT customer_id, supplier_id, status 
    INTO v_order_customer_id, v_supplier_id, v_order_status
    FROM orders
    WHERE order_id = p_order_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order not found'
        );
    END IF;
    
    -- Verify customer owns this order
    IF v_order_customer_id != p_customer_id THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'This order does not belong to you'
        );
    END IF;
    
    -- Verify order is finished
    IF v_order_status != 'finished' THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Can only rate completed orders. Current status: ' || v_order_status
        );
    END IF;
    
    -- Check if order already rated (exists in order_history with status='completed')
    SELECT EXISTS(
        SELECT 1 FROM order_history 
        WHERE order_id = p_order_id AND status = 'completed'
    ) INTO v_already_rated;
    
    IF v_already_rated THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'You have already rated this order'
        );
    END IF;
    
    -- Get supplier's current rating and total_orders
    SELECT rating, total_orders INTO v_current_rating, v_total_orders
    FROM suppliers
    WHERE user_id = v_supplier_id;
    
    -- Calculate new weighted average rating
    -- Formula: new_rating = ((current_rating * total_orders) + new_rating) / (total_orders + 1)
    v_new_rating := ((v_current_rating * v_total_orders) + p_rating) / (v_total_orders + 1);
    
    -- Update supplier's rating and increment total_orders
    UPDATE suppliers
    SET rating = v_new_rating,
        total_orders = total_orders + 1
    WHERE user_id = v_supplier_id;
    
    -- Verify order exists in order_history (should have been inserted by finish_order)
    IF NOT EXISTS(SELECT 1 FROM order_history WHERE order_id = p_order_id) THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order not found in history. Order must be completed first.'
        );
    END IF;
    
    -- Delete from orders table
    DELETE FROM orders WHERE order_id = p_order_id;
    
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
    v_supplier_name TEXT;
    v_driver_name TEXT;
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
    
    -- Get order from order_history
    SELECT * INTO v_order_record
    FROM order_history
    WHERE order_id = p_order_id AND customer_id = p_customer_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'code', 0,
            'message', 'Order not found in your history'
        );
    END IF;
    
    -- Get supplier name
    SELECT name INTO v_supplier_name
    FROM users
    WHERE user_id = v_order_record.supplier_id;
    
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
            'quantity', v_order_record.quantity,
            'price', v_order_record.price,
            'status', v_order_record.status,
            'driver_name', v_driver_name,
            'supplier_name', v_supplier_name,
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

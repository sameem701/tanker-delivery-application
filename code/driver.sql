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

CREATE TRIGGER trigger_relink_driver_on_session_insert
    AFTER INSERT ON sessions
    FOR EACH ROW
    EXECUTE FUNCTION on_session_insert_relink_driver();


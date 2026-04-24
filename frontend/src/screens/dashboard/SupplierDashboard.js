import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Alert, ScrollView, StyleSheet } from 'react-native';
import BasicButton from '../../components/ui/BasicButton';
import {
    listAvailableOrders,
    placeSupplierBid,
    listActiveSupplierOrders,
    listSupplierPastOrders,
    listSupplierDrivers,
    addSupplierDriver,
    removeSupplierDriver,
    getActiveSupplierOrderDetails,
    getAssignableDriversForOrder,
    assignDriverToOrder,
    cancelSupplierOrder,
    getAvailableOrderDetail,
} from '../../api/supplierApi';

export default function SupplierDashboard({ sessionToken }) {
    const [activeTab, setActiveTab] = useState('market'); // market | orders | drivers
    const [ordersTab, setOrdersTab] = useState('active'); // active | past

    const [marketOrders, setMarketOrders] = useState([]);
    const [bids, setBids] = useState({});
    const [activeOrders, setActiveOrders] = useState([]);
    const [pastOrders, setPastOrders] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [newDriverPhone, setNewDriverPhone] = useState('');
    const [loadingMarket, setLoadingMarket] = useState(false);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [loadingDrivers, setLoadingDrivers] = useState(false);

    // Order detail view state
    const [selectedOrderId, setSelectedOrderId] = useState(null);
    const [orderDetail, setOrderDetail] = useState(null);
    const [assignableDrivers, setAssignableDrivers] = useState([]);
    const [loadingOrderDetail, setLoadingOrderDetail] = useState(false);
    const [loadingAssignableDrivers, setLoadingAssignableDrivers] = useState(false);
    const [timerTick, setTimerTick] = useState(0); // increments every second for timer display

    // Market order detail state (for viewing full order info before bidding)
    const [marketOrderDetail, setMarketOrderDetail] = useState(null);
    const [loadingMarketDetail, setLoadingMarketDetail] = useState(false);

    // Track which supplier_timer orders we've already auto-navigated to, so we only do it once per order
    const autoNavigatedRef = useRef(new Set());

    // ─── Helpers ───────────────────────────────────────────────────────────────

    const formatDuration = (secondsRaw) => {
        const total = Math.max(0, Math.floor(Number(secondsRaw || 0)));
        const m = Math.floor(total / 60);
        const s = total % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const getRemainingSeconds = (timeLimitISO) => {
        if (!timeLimitISO) return 0;
        const limit = new Date(timeLimitISO).getTime();
        if (Number.isNaN(limit)) return 0;
        return Math.max(0, Math.ceil((limit - Date.now()) / 1000));
    };

    const getRemainingSupplierSeconds = (detail) => {
        // Prefer server-computed seconds (avoids timestamp string parsing issues)
        const direct = Number(detail?.remaining_supplier_seconds);
        if (Number.isFinite(direct) && direct >= 0) return Math.max(0, Math.floor(direct) - timerTick);
        // Fallback to parsing ISO string
        return getRemainingSeconds(detail?.time_limit_for_supplier);
    };

    // ─── Data fetchers ─────────────────────────────────────────────────────────

    const fetchLiveMarket = async () => {
        if (!sessionToken) return;
        try {
            setLoadingMarket(true);
            const response = await listAvailableOrders(sessionToken);
            setMarketOrders(Array.isArray(response?.data?.orders) ? response.data.orders : []);
        } catch (error) {
            Alert.alert('Error', error.message || 'Failed to fetch live market orders');
        } finally {
            setLoadingMarket(false);
        }
    };

    const fetchActiveOrders = useCallback(async () => {
        if (!sessionToken) return;
        try {
            setLoadingOrders(true);
            const response = await listActiveSupplierOrders(sessionToken);
            setActiveOrders(Array.isArray(response?.data?.orders) ? response.data.orders : []);
        } catch (error) {
            Alert.alert('Error', error.message || 'Failed to fetch active orders');
        } finally {
            setLoadingOrders(false);
        }
    }, [sessionToken]);

    const fetchPastOrders = async () => {
        if (!sessionToken) return;
        try {
            setLoadingOrders(true);
            const response = await listSupplierPastOrders(sessionToken);
            setPastOrders(Array.isArray(response?.data?.orders) ? response.data.orders : []);
        } catch (error) {
            Alert.alert('Error', error.message || 'Failed to fetch past orders');
        } finally {
            setLoadingOrders(false);
        }
    };

    const fetchDrivers = async () => {
        if (!sessionToken) return;
        try {
            setLoadingDrivers(true);
            const response = await listSupplierDrivers(sessionToken);
            setDrivers(Array.isArray(response?.data?.drivers) ? response.data.drivers : []);
        } catch (error) {
            Alert.alert('Error', error.message || 'Failed to fetch drivers');
        } finally {
            setLoadingDrivers(false);
        }
    };

    const fetchOrderDetail = useCallback(async (orderId) => {
        if (!sessionToken || !orderId) return;
        try {
            setLoadingOrderDetail(true);
            const response = await getActiveSupplierOrderDetails(sessionToken, orderId);
            setOrderDetail(response?.data || null);
        } catch (error) {
            if (error.status === 410) {
                // Timer expired — order has been auto-cancelled
                setOrderDetail(null);
                setSelectedOrderId(null);
                setAssignableDrivers([]);
                Alert.alert('Timer Expired', 'The supplier timer has expired. The order has been cancelled.');
                await fetchActiveOrders();
            } else if (error.status === 404 || error.status === 409) {
                setOrderDetail(null);
                setSelectedOrderId(null);
                setAssignableDrivers([]);
                await fetchActiveOrders();
            } else {
                console.log('Order detail fetch failed:', error.message);
            }
        } finally {
            setLoadingOrderDetail(false);
        }
    }, [sessionToken, fetchActiveOrders]);

    const fetchAssignableDrivers = useCallback(async (orderId) => {
        if (!sessionToken || !orderId) return;
        try {
            setLoadingAssignableDrivers(true);
            const response = await getAssignableDriversForOrder(sessionToken, orderId);
            setAssignableDrivers(Array.isArray(response?.data?.drivers) ? response.data.drivers : []);
        } catch (error) {
            if (error.status !== 410 && error.status !== 404) {
                console.log('Assignable drivers fetch failed:', error.message);
            }
            setAssignableDrivers([]);
        } finally {
            setLoadingAssignableDrivers(false);
        }
    }, [sessionToken]);

    const fetchMarketOrderDetail = async (orderId) => {
        if (!sessionToken || !orderId) return;
        try {
            setLoadingMarketDetail(true);
            const response = await getAvailableOrderDetail(sessionToken, orderId);
            setMarketOrderDetail(response?.data || null);
        } catch (error) {
            // 403 means no available drivers — surface this clearly
            Alert.alert(
                'Cannot View Order',
                error.message || 'Failed to load order details'
            );
        } finally {
            setLoadingMarketDetail(false);
        }
    };

    // ─── Handlers ──────────────────────────────────────────────────────────────

    const handleSelectOrder = (orderId) => {
        setSelectedOrderId(orderId);
        setOrderDetail(null);
        setAssignableDrivers([]);
    };

    const handleAssignDriver = async (driverId) => {
        if (!sessionToken || !selectedOrderId) return;
        try {
            await assignDriverToOrder(sessionToken, selectedOrderId, driverId);
            Alert.alert('Success', 'Driver assigned successfully');
            await fetchOrderDetail(selectedOrderId);
            await fetchAssignableDrivers(selectedOrderId);
            await fetchActiveOrders();
        } catch (error) {
            Alert.alert('Error', error.message || 'Failed to assign driver');
        }
    };

    const handleCancelSupplierOrder = async () => {
        if (!sessionToken || !selectedOrderId) return;
        Alert.alert(
            'Cancel Order',
            'Are you sure you want to cancel this order?',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await cancelSupplierOrder(sessionToken, selectedOrderId);
                            setSelectedOrderId(null);
                            setOrderDetail(null);
                            setAssignableDrivers([]);
                            Alert.alert('Cancelled', 'Order has been cancelled.');
                            await fetchActiveOrders();
                        } catch (error) {
                            Alert.alert('Error', error.message || 'Failed to cancel order');
                        }
                    }
                }
            ]
        );
    };

    const handleSendBid = async (orderId) => {
        if (!sessionToken) {
            Alert.alert('Error', 'Missing session token. Please login again.');
            return;
        }

        const bidPriceRaw = bids[orderId];
        const bidPrice = Number(bidPriceRaw);

        if (!bidPriceRaw || !Number.isFinite(bidPrice) || bidPrice <= 0) {
            Alert.alert('Error', 'Enter a valid bid price');
            return;
        }

        try {
            await placeSupplierBid(sessionToken, Number(orderId), bidPrice);
            Alert.alert('Success', 'Bid placed successfully');
            setBids((prev) => ({ ...prev, [orderId]: '' }));
            setMarketOrderDetail(null);
            fetchLiveMarket();
        } catch (error) {
            Alert.alert('Error', error.message || 'Failed to place bid');
        }
    };

    const handleAddDriver = async () => {
        if (!sessionToken) {
            Alert.alert('Error', 'Missing session token. Please login again.');
            return;
        }

        const phone = newDriverPhone.trim();
        if (!phone) {
            Alert.alert('Error', 'Driver phone is required');
            return;
        }

        try {
            await addSupplierDriver(sessionToken, phone);
            setNewDriverPhone('');
            fetchDrivers();
            Alert.alert('Success', 'Driver added successfully');
        } catch (error) {
            Alert.alert('Error', error.message || 'Failed to add driver');
        }
    };

    const handleRemoveDriver = async (driverPhoneNum) => {
        if (!sessionToken) {
            Alert.alert('Error', 'Missing session token. Please login again.');
            return;
        }

        try {
            await removeSupplierDriver(sessionToken, driverPhoneNum);
            try {
                await fetchDrivers();
            } catch (refreshError) {
                console.warn('Failed to refresh driver list:', refreshError);
            }
            Alert.alert('Success', 'Driver removed successfully');
        } catch (error) {
            Alert.alert('Error', error.message || 'Failed to remove driver');
        }
    };

    // ─── Effects ───────────────────────────────────────────────────────────────

    // Poll market + active orders on mount and every 5 seconds
    useEffect(() => {
        if (!sessionToken) return;

        fetchLiveMarket();
        fetchActiveOrders();

        const interval = setInterval(() => {
            fetchLiveMarket();
            fetchActiveOrders();
        }, 5000);

        return () => clearInterval(interval);
    }, [sessionToken, fetchActiveOrders]);

    // Load tab-specific data when switching tabs
    useEffect(() => {
        if (!sessionToken) return;
        if (activeTab !== 'orders') return;

        if (ordersTab === 'active') {
            fetchActiveOrders();
        } else {
            fetchPastOrders();
        }
    }, [activeTab, ordersTab, sessionToken]);

    useEffect(() => {
        if (!sessionToken) return;
        if (activeTab !== 'drivers') return;
        fetchDrivers();
    }, [activeTab, sessionToken]);

    // Auto-navigate to orders → detail view when a supplier_timer order first appears
    useEffect(() => {
        const supplierTimerOrder = activeOrders.find((o) => o.status === 'supplier_timer');
        if (!supplierTimerOrder) return;

        const orderId = supplierTimerOrder.order_id || supplierTimerOrder.id;
        if (!orderId) return;
        if (autoNavigatedRef.current.has(orderId)) return;

        autoNavigatedRef.current.add(orderId);
        setActiveTab('orders');
        setOrdersTab('active');
        setSelectedOrderId(orderId);
        setOrderDetail(null);
        setAssignableDrivers([]);
    }, [activeOrders]);

    // Reset timerTick each time we get fresh order detail from the server
    useEffect(() => {
        setTimerTick(0);
    }, [orderDetail?.remaining_supplier_seconds]);

    // Fetch detail + assignable drivers when selectedOrderId changes
    useEffect(() => {
        if (!selectedOrderId) return;
        fetchOrderDetail(selectedOrderId);
        fetchAssignableDrivers(selectedOrderId);
    }, [selectedOrderId, fetchOrderDetail, fetchAssignableDrivers]);

    // While viewing a supplier_timer order: poll server every 3 seconds + tick timer every 1 second
    useEffect(() => {
        if (!selectedOrderId) return;
        if (!orderDetail) return;
        if (orderDetail.status !== 'supplier_timer') return;

        const pollInterval = setInterval(() => {
            fetchOrderDetail(selectedOrderId);
            fetchAssignableDrivers(selectedOrderId);
        }, 3000);

        const timerInterval = setInterval(() => {
            setTimerTick((t) => t + 1);
        }, 1000);

        return () => {
            clearInterval(pollInterval);
            clearInterval(timerInterval);
        };
    }, [selectedOrderId, orderDetail?.status, fetchOrderDetail, fetchAssignableDrivers]);

    // ─── Render helpers ────────────────────────────────────────────────────────

    const orderKey = (item) => String(item.order_id || item.id);

    // Extracts the area portion from a delivery_location stored as "address, area"
    const extractArea = (deliveryLocation) => {
        if (!deliveryLocation) return '-';
        const parts = deliveryLocation.split(', ');
        return parts.length > 1 ? parts[parts.length - 1] : deliveryLocation;
    };

    // ─── Market Order Detail View ───────────────────────────────────────────────

    const renderMarketDetail = () => {
        if (loadingMarketDetail && !marketOrderDetail) {
            return (
                <View style={styles.section}>
                    <BasicButton title="← Back to Market" onPress={() => setMarketOrderDetail(null)} style={styles.backButton} />
                    <Text>Loading order details...</Text>
                </View>
            );
        }

        if (!marketOrderDetail) {
            return (
                <View style={styles.section}>
                    <BasicButton title="← Back to Market" onPress={() => setMarketOrderDetail(null)} style={styles.backButton} />
                    <Text>Order details unavailable.</Text>
                </View>
            );
        }

        const orderId = marketOrderDetail.order_id;
        return (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                <BasicButton
                    title="← Back to Market"
                    onPress={() => setMarketOrderDetail(null)}
                    style={styles.backButton}
                />
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Order #{orderId}</Text>
                    <Text>Location: {marketOrderDetail.delivery_location || '-'}</Text>
                    <Text>Gallons: {marketOrderDetail.requested_capacity || '-'}</Text>
                    <Text>Customer Offer: {marketOrderDetail.customer_bid_price || '-'}</Text>
                    <Text>Customer: {marketOrderDetail.customer_name || '-'}</Text>
                </View>
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Place Your Bid</Text>
                    <TextInput
                        placeholder="Your bid price"
                        keyboardType="numeric"
                        value={bids[orderId] || ''}
                        style={styles.input}
                        onChangeText={(val) => setBids((prev) => ({ ...prev, [orderId]: val }))}
                    />
                    <BasicButton
                        title="Send Bid"
                        onPress={() => handleSendBid(orderId)}
                        style={styles.fullButton}
                    />
                </View>
            </ScrollView>
        );
    };

    // ─── Order Detail View ─────────────────────────────────────────────────────

    const renderOrderDetail = () => {
        if (loadingOrderDetail && !orderDetail) {
            return (
                <View style={styles.section}>
                    <BasicButton title="← Back to Orders" onPress={() => { setSelectedOrderId(null); setOrderDetail(null); setAssignableDrivers([]); }} style={styles.backButton} />
                    <Text>Loading order details...</Text>
                </View>
            );
        }

        if (!orderDetail) {
            return (
                <View style={styles.section}>
                    <BasicButton title="← Back to Orders" onPress={() => { setSelectedOrderId(null); setOrderDetail(null); setAssignableDrivers([]); }} style={styles.backButton} />
                    <Text>Order details unavailable.</Text>
                </View>
            );
        }

        const status = orderDetail.status;
        const timeLimitISO = orderDetail.time_limit_for_supplier;
        // timerTick is referenced so the component re-renders every second for accurate countdown
        const secondsLeft = status === 'supplier_timer' ? getRemainingSupplierSeconds(orderDetail) : null;
        const supplierCancelableStatuses = ['supplier_timer', 'accepted', 'ride_started', 'reached'];

        return (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                <BasicButton
                    title="← Back to Orders"
                    onPress={() => { setSelectedOrderId(null); setOrderDetail(null); setAssignableDrivers([]); }}
                    style={styles.backButton}
                />

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Order #{orderDetail.order_id || selectedOrderId}</Text>
                    <Text>Status: {status}</Text>
                    <Text>Address: {orderDetail.delivery_location || orderDetail.customer_location || '-'}</Text>
                    <Text>Gallons: {orderDetail.requested_capacity || orderDetail.quantity || '-'}</Text>
                    <Text>Accepted Price: {orderDetail.accepted_price || orderDetail.price || '-'}</Text>
                    {orderDetail.customer_name ? <Text>Customer: {orderDetail.customer_name}</Text> : null}
                    {orderDetail.customer_phone ? <Text>Customer Phone: {orderDetail.customer_phone}</Text> : null}
                </View>

                {/* Supplier timer banner + driver assignment */}
                {status === 'supplier_timer' && (
                    <View style={styles.timerCard}>
                        <Text style={styles.timerTitle}>Assign a Driver</Text>
                        <Text style={styles.timerLabel}>Time Remaining to Assign:</Text>
                        <Text style={[styles.timerValue, secondsLeft !== null && secondsLeft <= 30 ? styles.timerUrgent : null]}>
                            {secondsLeft !== null ? formatDuration(secondsLeft) : '--:--'}
                        </Text>
                        {secondsLeft === 0 ? (
                            <Text style={styles.timerExpiredText}>Timer has expired. Order may be cancelled.</Text>
                        ) : null}

                        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Available Drivers</Text>
                        {loadingAssignableDrivers ? <Text>Loading drivers...</Text> : null}
                        {!loadingAssignableDrivers && assignableDrivers.length === 0 ? (
                            <Text style={styles.emptyText}>No available drivers at the moment.</Text>
                        ) : null}
                        {assignableDrivers.map((driver) => {
                            const driverId = driver.driver_user_id || driver.driver_id;
                            const driverName = driver.driver_name || driver.name || '-';
                            const driverPhone = driver.driver_phone_num || driver.phone || '-';
                            return (
                                <View key={String(driverId)} style={styles.driverAssignCard}>
                                    <Text>Name: {driverName}</Text>
                                    <Text>Phone: {driverPhone}</Text>
                                    <BasicButton
                                        title="Assign This Driver"
                                        onPress={() => handleAssignDriver(driverId)}
                                        style={styles.fullButton}
                                    />
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Progress info for post-assignment statuses */}
                {(status === 'accepted' || status === 'ride_started' || status === 'reached') && (
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>Order Progress</Text>
                        <Text>Driver: {orderDetail.driver_name || 'Not assigned yet'}</Text>
                        <Text>Driver Phone: {orderDetail.driver_phone || '-'}</Text>
                        <Text>Status: {status}</Text>
                    </View>
                )}

                {/* Cancel button */}
                {supplierCancelableStatuses.includes(status) ? (
                    <BasicButton
                        title="Cancel Order"
                        onPress={handleCancelSupplierOrder}
                        style={styles.cancelButton}
                    />
                ) : null}
            </ScrollView>
        );
    };

    // ─── Main Render ───────────────────────────────────────────────────────────

    // If we're on the active orders tab with an order selected, show detail
    const showingOrderDetail = activeTab === 'orders' && ordersTab === 'active' && selectedOrderId !== null;
    const showingMarketDetail = activeTab === 'market' && marketOrderDetail !== null;

    return (
        <View style={styles.container}>
            {!showingOrderDetail && !showingMarketDetail && (
                <View style={styles.topTabsRow}>
                    <BasicButton title="Live Market" onPress={() => setActiveTab('market')} style={styles.tabButton} />
                    <BasicButton title="Orders" onPress={() => setActiveTab('orders')} style={styles.tabButton} />
                    <BasicButton title="Drivers" onPress={() => setActiveTab('drivers')} style={styles.tabButton} />
                </View>
            )}

            {showingOrderDetail ? (
                renderOrderDetail()
            ) : showingMarketDetail ? (
                renderMarketDetail()
            ) : activeTab === 'market' ? (
                <View style={styles.marketTabContainer}>
                    {/* Live orders — vertical scroll */}
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8 }}>
                        <Text style={styles.sectionTitle}>Live Orders</Text>
                        {loadingMarket ? <Text>Loading live market...</Text> : null}
                        {!sessionToken ? <Text>Session missing. Login again.</Text> : null}
                        {marketOrders.length === 0 && !loadingMarket ? <Text>No live orders</Text> : null}
                        {marketOrders.map((item) => {
                            const orderId = item.order_id || item.id;
                            const area = extractArea(item.delivery_location);
                            return (
                                <View key={orderKey(item)} style={styles.card}>
                                    <Text>Order #{orderId}</Text>
                                    <Text>Area: {area}</Text>
                                    <Text>Gallons: {item.requested_capacity} | Customer Offer: {item.customer_bid_price}</Text>
                                    <View style={styles.bidRow}>
                                        <TextInput
                                            placeholder="Bid price"
                                            keyboardType="numeric"
                                            value={bids[orderId] || ''}
                                            style={styles.bidInput}
                                            onChangeText={(val) => setBids((prev) => ({ ...prev, [orderId]: val }))}
                                        />
                                        <BasicButton
                                            title="Bid"
                                            onPress={() => handleSendBid(orderId)}
                                            style={styles.bidButton}
                                            textStyle={styles.bidButtonText}
                                        />
                                        <BasicButton
                                            title="View"
                                            onPress={() => fetchMarketOrderDetail(orderId)}
                                            style={styles.viewButton}
                                            textStyle={styles.bidButtonText}
                                        />
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>

                    {/* Active orders — pinned bottom, horizontal scroll */}
                    <View style={styles.activeOrdersBar}>
                        <BasicButton
                            title="View All Orders"
                            style={[styles.fullButton, { marginBottom: 6 }]}
                            onPress={() => {
                                setActiveTab('orders');
                                setOrdersTab('active');
                            }}
                        />
                        <Text style={styles.sectionTitle}>Active Orders ({activeOrders.length})</Text>
                        {activeOrders.length === 0 ? (
                            <Text style={styles.emptyText}>No active orders</Text>
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {activeOrders.map((item) => {
                                    const orderId = item.order_id || item.id;
                                    return (
                                        <View key={orderKey(item)} style={styles.activeOrderCard}>
                                            <Text>Order #{orderId}</Text>
                                            <Text>Status: {item.status}</Text>
                                            {item.status === 'supplier_timer' ? (
                                                <Text style={styles.timerBadge}>⏱ Assign driver!</Text>
                                            ) : null}
                                            <BasicButton
                                                title="Details"
                                                onPress={() => {
                                                    setActiveTab('orders');
                                                    setOrdersTab('active');
                                                    handleSelectOrder(orderId);
                                                }}
                                                style={{ marginTop: 4 }}
                                            />
                                        </View>
                                    );
                                })}
                            </ScrollView>
                        )}
                    </View>
                </View>
            ) : (
                <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                    {activeTab === 'orders' && (
                        <View style={styles.section}>
                            <View style={styles.subTabsRow}>
                                <BasicButton title="Active" onPress={() => setOrdersTab('active')} style={styles.subTabButton} />
                                <BasicButton title="Past" onPress={() => setOrdersTab('past')} style={styles.subTabButton} />
                            </View>

                            {loadingOrders ? <Text>Loading orders...</Text> : null}

                            {ordersTab === 'active' && (
                                <View>
                                    {activeOrders.length === 0 ? <Text>No active orders</Text> : null}
                                    {activeOrders.map((item) => {
                                        const orderId = item.order_id || item.id;
                                        return (
                                            <View key={orderKey(item)} style={styles.card}>
                                                <Text>Order #{orderId}</Text>
                                                <Text>Status: {item.status}</Text>
                                                {item.status === 'supplier_timer' ? (
                                                    <Text style={styles.timerBadge}>⏱ Assign a driver now</Text>
                                                ) : null}
                                                <BasicButton
                                                    title="View Details"
                                                    onPress={() => handleSelectOrder(orderId)}
                                                    style={styles.fullButton}
                                                />
                                            </View>
                                        );
                                    })}
                                </View>
                            )}

                            {ordersTab === 'past' && (
                                <View>
                                    {pastOrders.length === 0 ? <Text>No past orders</Text> : null}
                                    {pastOrders.map((item) => (
                                        <View key={orderKey(item)} style={styles.card}>
                                            <Text>Order #{item.order_id || item.id}</Text>
                                            <Text>Status: {item.status || 'Completed'}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}

                    {activeTab === 'drivers' && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Manage Drivers</Text>
                            {loadingDrivers ? <Text>Loading drivers...</Text> : null}
                            <View style={styles.card}>
                                <Text>Add Driver</Text>
                                <TextInput
                                    placeholder="Driver Phone Number"
                                    value={newDriverPhone}
                                    onChangeText={setNewDriverPhone}
                                    keyboardType="phone-pad"
                                    style={styles.input}
                                />
                                <BasicButton title="Add Driver" onPress={handleAddDriver} style={styles.fullButton} />
                            </View>
                            {drivers.map((item) => (
                                <View key={String(item.driver_phone_num || item.driver_user_id || item.id)} style={styles.card}>
                                    <Text>Driver: {item.driver_name || item.name || '-'}</Text>
                                    <Text>Phone: {item.driver_phone_num || item.linked_phone || '-'}</Text>
                                    <Text>Linked: {item.linked ? 'Yes' : 'No'}</Text>
                                    <Text>Status: {item.available ? 'available' : 'unavailable'}</Text>
                                    <BasicButton title="Remove Driver" onPress={() => handleRemoveDriver(item.driver_phone_num)} style={styles.fullButton} />
                                </View>
                            ))}
                        </View>
                    )}
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    marketTabContainer: {
        flex: 1,
        width: '90%',
        maxWidth: 420,
        alignSelf: 'center',
    },
    activeOrdersBar: {
        borderTopWidth: 1,
        borderTopColor: '#d0d0d0',
        paddingTop: 8,
        paddingBottom: 8,
    },
    activeOrderCard: {
        width: 155,
        borderWidth: 1,
        borderColor: '#d0d0d0',
        borderRadius: 4,
        padding: 8,
        marginRight: 8,
    },
    bidRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    bidInput: {
        flex: 1,
        height: 44,
        borderWidth: 1,
        borderColor: '#000',
        borderRadius: 4,
        paddingHorizontal: 8,
        marginRight: 6,
        fontSize: 14,
    },
    bidButton: {
        width: 72,
        height: 44,
        marginTop: 0,
        paddingVertical: 0,
        paddingHorizontal: 4,
        marginRight: 6,
    },
    viewButton: {
        width: 72,
        height: 44,
        marginTop: 0,
        paddingVertical: 0,
        paddingHorizontal: 4,
    },
    bidButtonText: {
        fontSize: 13,
    },
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scroll: {
        width: '90%',
        maxWidth: 420,
    },
    scrollContent: {
        paddingBottom: 16,
    },
    topTabsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    tabButton: {
        width: '32%',
        marginTop: 0,
    },
    subTabsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    subTabButton: {
        width: '49%',
        marginTop: 0,
    },
    section: {
        marginTop: 8,
    },
    sectionTitle: {
        marginBottom: 6,
    },
    card: {
        borderWidth: 1,
        borderColor: '#d0d0d0',
        borderRadius: 4,
        padding: 10,
        marginTop: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#000',
        paddingHorizontal: 8,
        paddingVertical: 6,
        marginTop: 8,
    },
    inputButtonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    rowInput: {
        flex: 1,
        marginTop: 0,
        marginRight: 8,
    },
    rowButton: {
        marginTop: 0,
        minWidth: 90,
    },
    fullButton: {
        alignSelf: 'stretch',
    },
    backButton: {
        alignSelf: 'flex-start',
        marginBottom: 8,
    },
    cancelButton: {
        alignSelf: 'stretch',
        marginTop: 16,
    },
    timerCard: {
        borderWidth: 2,
        borderColor: '#e67e00',
        borderRadius: 6,
        padding: 12,
        marginTop: 12,
    },
    timerTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    timerLabel: {
        marginTop: 4,
    },
    timerValue: {
        fontSize: 28,
        fontWeight: 'bold',
        letterSpacing: 2,
        marginTop: 2,
    },
    timerUrgent: {
        color: '#cc0000',
    },
    timerExpiredText: {
        color: '#cc0000',
        marginTop: 4,
    },
    timerBadge: {
        color: '#e67e00',
        fontWeight: 'bold',
        marginTop: 4,
    },
    driverAssignCard: {
        borderWidth: 1,
        borderColor: '#aaa',
        borderRadius: 4,
        padding: 8,
        marginTop: 8,
    },
    emptyText: {
        color: '#666',
        marginTop: 4,
    },
});
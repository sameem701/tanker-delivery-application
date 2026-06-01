import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { colors, spacing, radius, typography, shadow } from '../../theme/tokens';
import BasicButton from '../../components/ui/BasicButton';
import ErrorModal from '../../components/ui/ErrorModal';
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
    getPastSupplierOrderDetail,
} from '../../api/supplierApi';

function formatDate(val) {
    if (!val) return '-';
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
}

export default function SupplierDashboard({ sessionToken, socket }) {
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

    // Past order detail state
    const [pastOrderDetail, setPastOrderDetail] = useState(null);

    // Modal states
    const [cancelledModalData, setCancelledModalData] = useState(null);
    const [completedModalData, setCompletedModalData] = useState(null);
    const [pendingSupplierTimerOrder, setPendingSupplierTimerOrder] = useState(null);
    const [showSupplierTimerNotificationModal, setShowSupplierTimerNotificationModal] = useState(false);
    const [errorModalData, setErrorModalData] = useState(null);

    // Track which supplier_timer orders we've already shown notification for
    const notifiedOrdersRef = useRef(new Set());

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

    const fetchLiveMarket = useCallback(async () => {
        if (!sessionToken) return;
        try {
            setLoadingMarket(true);
            const response = await listAvailableOrders(sessionToken);
            setMarketOrders(Array.isArray(response?.data?.orders) ? response.data.orders : []);
        } catch (error) {
            setErrorModalData({ title: 'Error', message: error.message || 'Failed to fetch live market orders' });
        } finally {
            setLoadingMarket(false);
        }
    }, [sessionToken]);

    const fetchActiveOrders = useCallback(async () => {
        if (!sessionToken) return;
        try {
            setLoadingOrders(true);
            const response = await listActiveSupplierOrders(sessionToken);
            setActiveOrders(Array.isArray(response?.data?.orders) ? response.data.orders : []);
        } catch (error) {
            setErrorModalData({ title: 'Error', message: error.message || 'Failed to fetch active orders' });
        } finally {
            setLoadingOrders(false);
        }
    }, [sessionToken]);

    const fetchPastOrderDetail = useCallback(async (orderId) => {
        if (!sessionToken) return;
        try {
            const response = await getPastSupplierOrderDetail(sessionToken, orderId);
            setPastOrderDetail(response?.data || null);
        } catch (error) {
            setErrorModalData({ title: 'Error', message: error.message || 'Failed to fetch order details' });
        }
    }, [sessionToken]);

    const fetchPastOrders = useCallback(async () => {
        if (!sessionToken) return;
        try {
            setLoadingOrders(true);
            const response = await listSupplierPastOrders(sessionToken);
            setPastOrders(Array.isArray(response?.data?.orders) ? response.data.orders : []);
        } catch (error) {
            setErrorModalData({ title: 'Error', message: error.message || 'Failed to fetch past orders' });
        } finally {
            setLoadingOrders(false);
        }
    }, [sessionToken]);

    const fetchDrivers = useCallback(async () => {
        if (!sessionToken) return;
        try {
            setLoadingDrivers(true);
            const response = await listSupplierDrivers(sessionToken);
            setDrivers(Array.isArray(response?.data?.drivers) ? response.data.drivers : []);
        } catch (error) {
            setErrorModalData({ title: 'Error', message: error.message || 'Failed to fetch drivers' });
        } finally {
            setLoadingDrivers(false);
        }
    }, [sessionToken]);

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
                setErrorModalData({ title: 'Timer Expired', message: 'The supplier timer has expired. The order has been cancelled.' });
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
            setErrorModalData({ title: 'Cannot View Order', message: error.message || 'Failed to load order details' });
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
            setErrorModalData({ title: 'Success', message: 'Driver assigned successfully' });
            await fetchOrderDetail(selectedOrderId);
            await fetchAssignableDrivers(selectedOrderId);
            await fetchActiveOrders();
        } catch (error) {
            setErrorModalData({ title: 'Error', message: error.message || 'Failed to assign driver' });
        }
    };

    const handleCancelSupplierOrder = async () => {
        if (!sessionToken || !selectedOrderId) return;
        setErrorModalData({
            title: 'Cancel Order',
            message: 'Are you sure you want to cancel this order?',
            buttons: [
                { label: 'No', onPress: () => setErrorModalData(null) },
                {
                    label: 'Yes, Cancel',
                    danger: true,
                    onPress: async () => {
                        setErrorModalData(null);
                        try {
                            await cancelSupplierOrder(sessionToken, selectedOrderId);
                            setSelectedOrderId(null);
                            setOrderDetail(null);
                            setAssignableDrivers([]);
                            setErrorModalData({ title: 'Cancelled', message: 'Order has been cancelled.' });
                            await fetchActiveOrders();
                        } catch (error) {
                            setErrorModalData({ title: 'Error', message: error.message || 'Failed to cancel order' });
                        }
                    }
                }
            ]
        });
    };

    // Helper: Find the next unnotified supplier_timer order
    const getNextUnnotifiedSupplierTimerOrder = () => {
        for (const order of activeOrders) {
            if (order.status === 'supplier_timer') {
                const orderId = order.order_id || order.id;
                if (orderId && !notifiedOrdersRef.current.has(orderId)) {
                    return order;
                }
            }
        }
        return null;
    };

    const handleViewAndAssignDriver = () => {
        if (!pendingSupplierTimerOrder) return;
        const orderId = pendingSupplierTimerOrder.order_id || pendingSupplierTimerOrder.id;

        // Navigate to detail view
        setActiveTab('orders');
        setOrdersTab('active');
        setSelectedOrderId(orderId);
        setOrderDetail(null);
        setAssignableDrivers([]);

        // Check for next unnotified order
        const nextOrder = getNextUnnotifiedSupplierTimerOrder();
        if (nextOrder) {
            const nextOrderId = nextOrder.order_id || nextOrder.id;
            notifiedOrdersRef.current.add(nextOrderId);
            setPendingSupplierTimerOrder(nextOrder);
            setShowSupplierTimerNotificationModal(true);
        } else {
            setShowSupplierTimerNotificationModal(false);
            setPendingSupplierTimerOrder(null);
        }
    };

    const handleDismissSupplierTimerNotification = () => {
        // Check for next unnotified order
        const nextOrder = getNextUnnotifiedSupplierTimerOrder();
        if (nextOrder) {
            const nextOrderId = nextOrder.order_id || nextOrder.id;
            notifiedOrdersRef.current.add(nextOrderId);
            setPendingSupplierTimerOrder(nextOrder);
            setShowSupplierTimerNotificationModal(true);
        } else {
            setShowSupplierTimerNotificationModal(false);
            setPendingSupplierTimerOrder(null);
        }
    };

    const handleSendBid = async (orderId) => {
        if (!sessionToken) {
            setErrorModalData({ title: 'Error', message: 'Missing session token. Please login again.' });
            return;
        }

        const bidPriceRaw = bids[orderId];
        const bidPrice = Number(bidPriceRaw);

        if (!bidPriceRaw || !Number.isFinite(bidPrice) || bidPrice <= 0) {
            setErrorModalData({ title: 'Error', message: 'Enter a valid bid price' });
            return;
        }

        try {
            await placeSupplierBid(sessionToken, Number(orderId), bidPrice);
            setErrorModalData({ title: 'Success', message: 'Bid placed successfully' });
            setBids((prev) => ({ ...prev, [orderId]: '' }));
            setMarketOrderDetail(null);
            fetchLiveMarket();
        } catch (error) {
            setErrorModalData({ title: 'Error', message: error.message || 'Failed to place bid' });
        }
    };

    const handleAddDriver = async () => {
        if (!sessionToken) {
            setErrorModalData({ title: 'Error', message: 'Missing session token. Please login again.' });
            return;
        }

        const phone = newDriverPhone.trim();
        if (!phone) {
            setErrorModalData({ title: 'Error', message: 'Driver phone is required' });
            return;
        }

        try {
            await addSupplierDriver(sessionToken, phone);
            setNewDriverPhone('');
            fetchDrivers();
            setErrorModalData({ title: 'Success', message: 'Driver added successfully' });
        } catch (error) {
            setErrorModalData({ title: 'Error', message: error.message || 'Failed to add driver' });
        }
    };

    const handleRemoveDriver = async (driverPhoneNum) => {
        if (!sessionToken) {
            setErrorModalData({ title: 'Error', message: 'Missing session token. Please login again.' });
            return;
        }

        try {
            await removeSupplierDriver(sessionToken, driverPhoneNum);
            try {
                await fetchDrivers();
            } catch (refreshError) {
                console.warn('Failed to refresh driver list:', refreshError);
            }
            setErrorModalData({ title: 'Success', message: 'Driver removed successfully' });
        } catch (error) {
            setErrorModalData({ title: 'Error', message: error.message || 'Failed to remove driver' });
        }
    };

    // ─── Effects ───────────────────────────────────────────────────────────────

    // Socket: refresh market + active orders on relevant events
    useEffect(() => {
        if (!sessionToken) return;

        fetchLiveMarket();
        fetchActiveOrders();

        if (!socket) return;

        const onMarketUpdated = () => fetchLiveMarket();
        const onOrderStatusChanged = () => fetchActiveOrders();
        const onOrderUpdated = (data) => {
            fetchActiveOrders();
            if (selectedOrderId && Number(data?.order_id) === Number(selectedOrderId)) {
                fetchOrderDetail(selectedOrderId);
            }
        };
        const onOrderCancelled = (data) => {
            // Clear detail view if this is the order currently being viewed
            if (Number(selectedOrderId) === Number(data.order_id)) {
                setSelectedOrderId(null);
                setOrderDetail(null);
                setAssignableDrivers([]);
            }
            fetchActiveOrders();
            setCancelledModalData({ order_id: data.order_id, who: data.cancelled_by });
        };
        const onOrderCompleted = (data) => {
            // Clear detail view if this is the order currently being viewed
            if (Number(selectedOrderId) === Number(data.order_id)) {
                setSelectedOrderId(null);
                setOrderDetail(null);
                setAssignableDrivers([]);
            }
            fetchActiveOrders();
            setCompletedModalData({ order_id: data.order_id, quantity: data.quantity, price: data.price });
        };

        socket.on('market_updated', onMarketUpdated);
        socket.on('order_status_changed', onOrderStatusChanged);
        socket.on('order_updated', onOrderUpdated);
        socket.on('order_cancelled', onOrderCancelled);
        socket.on('order_completed', onOrderCompleted);

        return () => {
            socket.off('market_updated', onMarketUpdated);
            socket.off('order_status_changed', onOrderStatusChanged);
            socket.off('order_updated', onOrderUpdated);
            socket.off('order_cancelled', onOrderCancelled);
            socket.off('order_completed', onOrderCompleted);
        };
    }, [sessionToken, socket, fetchLiveMarket, fetchActiveOrders, selectedOrderId]);

    // Load tab-specific data when switching tabs
    useEffect(() => {
        if (!sessionToken) return;
        if (activeTab !== 'orders') return;

        if (ordersTab === 'active') {
            fetchActiveOrders();
        } else {
            fetchPastOrders();
        }
    }, [activeTab, ordersTab, sessionToken, fetchActiveOrders, fetchPastOrders]);

    useEffect(() => {
        if (!sessionToken) return;
        if (activeTab !== 'drivers') return;
        fetchDrivers();
    }, [activeTab, sessionToken, fetchDrivers]);

    // Show notification modal when a new supplier_timer order arrives
    useEffect(() => {
        const nextOrder = getNextUnnotifiedSupplierTimerOrder();
        if (!nextOrder) return;
        if (showSupplierTimerNotificationModal) return; // modal already open, chaining handles it
        const orderId = nextOrder.order_id || nextOrder.id;
        notifiedOrdersRef.current.add(orderId);
        setPendingSupplierTimerOrder(nextOrder);
        setShowSupplierTimerNotificationModal(true);
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

    // While viewing a supplier_timer order: refresh on driver_responded events and keep the local countdown tick
    useEffect(() => {
        if (!selectedOrderId) return;
        if (!orderDetail) return;
        if (orderDetail.status !== 'supplier_timer') return;

        const timerInterval = setInterval(() => {
            setTimerTick((t) => t + 1);
        }, 1000);

        if (!socket) {
            return () => clearInterval(timerInterval);
        }

        const onDriverResponded = () => {
            fetchOrderDetail(selectedOrderId);
            fetchAssignableDrivers(selectedOrderId);
        };

        const onAvailableDriversUpdated = () => {
            // When a driver comes online, refresh the assignable drivers list
            fetchAssignableDrivers(selectedOrderId);
        };

        socket.on('driver_responded', onDriverResponded);
        socket.on('available_drivers_updated', onAvailableDriversUpdated);
        return () => {
            clearInterval(timerInterval);
            socket.off('driver_responded', onDriverResponded);
            socket.off('available_drivers_updated', onAvailableDriversUpdated);
        };
    }, [selectedOrderId, orderDetail?.status, fetchOrderDetail, fetchAssignableDrivers, socket]);

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
                    <BasicButton title="← Back" onPress={() => setMarketOrderDetail(null)} style={styles.backButton} />
                    <Text>Loading order details...</Text>
                </View>
            );
        }

        if (!marketOrderDetail) {
            return (
                <View style={styles.section}>
                    <BasicButton title="← Back" onPress={() => setMarketOrderDetail(null)} style={styles.backButton} />
                    <Text>Order details unavailable.</Text>
                </View>
            );
        }

        const orderId = marketOrderDetail.order_id;
        return (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                <BasicButton
                    title="← Back"
                    onPress={() => setMarketOrderDetail(null)}
                    style={styles.backButton}
                />
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Order #{orderId}</Text>
                    <Text style={styles.cardRow}><Text style={styles.cardLabel}>Location: </Text>{marketOrderDetail.delivery_location || '-'}</Text>
                    <Text style={styles.cardRow}><Text style={styles.cardLabel}>Gallons: </Text>{marketOrderDetail.requested_capacity || '-'}</Text>
                    <Text style={styles.cardRow}><Text style={styles.cardLabel}>Offer: </Text>{marketOrderDetail.customer_bid_price || '-'}</Text>
                    <Text style={styles.cardRow}><Text style={styles.cardLabel}>Customer: </Text>{marketOrderDetail.customer_name || '-'}</Text>
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
                    title="← Back"
                    onPress={() => { setSelectedOrderId(null); setOrderDetail(null); setAssignableDrivers([]); }}
                    style={styles.backButton}
                />

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Order #{orderDetail.order_id || selectedOrderId}</Text>
                    <Text style={styles.cardRow}><Text style={styles.cardLabel}>Status: </Text>{status}</Text>
                    <Text style={styles.cardRow}><Text style={styles.cardLabel}>Date: </Text>{formatDate(orderDetail.order_date || orderDetail.created_at)}</Text>
                    <Text style={styles.cardRow}><Text style={styles.cardLabel}>Address: </Text>{orderDetail.delivery_location || orderDetail.customer_location || '-'}</Text>
                    <Text style={styles.cardRow}><Text style={styles.cardLabel}>Gallons: </Text>{orderDetail.requested_capacity || orderDetail.quantity || '-'}</Text>
                    <Text style={styles.cardRow}><Text style={styles.cardLabel}>Price: </Text>{orderDetail.accepted_price || orderDetail.price || '-'}</Text>
                    {orderDetail.customer_name ? <Text style={styles.cardRow}><Text style={styles.cardLabel}>Customer: </Text>{orderDetail.customer_name}</Text> : null}
                    {orderDetail.customer_phone ? <Text style={styles.cardRow}><Text style={styles.cardLabel}>Phone: </Text>{orderDetail.customer_phone}</Text> : null}
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
                                    <Text style={styles.cardRow}><Text style={styles.cardLabel}>Name: </Text>{driverName}</Text>
                                    <Text style={styles.cardRow}><Text style={styles.cardLabel}>Phone: </Text>{driverPhone}</Text>
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
            {/* App-styled alert/error modal */}
            <ErrorModal
                visible={errorModalData !== null}
                title={errorModalData?.title}
                message={errorModalData?.message}
                buttons={errorModalData?.buttons}
                onDismiss={() => setErrorModalData(null)}
            />

            {/* Supplier Timer Notification Modal */}
            <Modal
                visible={showSupplierTimerNotificationModal}
                transparent
                animationType="fade"
                onRequestClose={handleDismissSupplierTimerNotification}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>Order Accepted ✓</Text>
                        <Text style={{ marginBottom: spacing.md }}>
                            Order #{pendingSupplierTimerOrder?.order_id || '-'} has been accepted. Please assign a driver to confirm the delivery.
                        </Text>
                        <BasicButton
                            title="View & Assign Driver"
                            onPress={handleViewAndAssignDriver}
                            style={{ marginTop: 0 }}
                        />
                        <BasicButton
                            title="I'll Handle It Later"
                            onPress={handleDismissSupplierTimerNotification}
                            style={[{ marginTop: spacing.sm }, { backgroundColor: colors.primaryLight }]}
                        />
                    </View>
                </View>
            </Modal>

            {/* Cancellation Modal */}
            <Modal
                visible={cancelledModalData !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setCancelledModalData(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>Order Cancelled</Text>
                        <Text style={{ marginBottom: spacing.md }}>
                            Order #{cancelledModalData?.order_id} was cancelled by {cancelledModalData?.who}.
                        </Text>
                        <BasicButton
                            title="OK"
                            onPress={() => setCancelledModalData(null)}
                            style={{ marginTop: 0 }}
                        />
                    </View>
                </View>
            </Modal>

            {/* Completion Modal */}
            <Modal
                visible={completedModalData !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setCompletedModalData(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>Order Completed ✓</Text>
                        <Text style={{ marginBottom: spacing.md }}>
                            Order #{completedModalData?.order_id} has been successfully delivered.
                        </Text>
                        <BasicButton
                            title="OK"
                            onPress={() => setCompletedModalData(null)}
                            style={{ marginTop: 0 }}
                        />
                    </View>
                </View>
            </Modal>

            {!showingOrderDetail && !showingMarketDetail && (
                <View style={styles.topTabsRow}>
                    <BasicButton title="Live Market" selected={activeTab === 'market'} onPress={() => setActiveTab('market')} style={styles.tabButton} />
                    <BasicButton title="Orders" selected={activeTab === 'orders'} onPress={() => setActiveTab('orders')} style={styles.tabButton} />
                    <BasicButton title="Drivers" selected={activeTab === 'drivers'} onPress={() => setActiveTab('drivers')} style={styles.tabButton} />
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
                                    <Text style={styles.cardRow}><Text style={styles.cardLabel}>Area: </Text>{area}</Text>
                                    <Text style={styles.cardRow}><Text style={styles.cardLabel}>Gallons: </Text>{item.requested_capacity}<Text style={styles.cardLabel}>  Offer: </Text>{item.customer_bid_price}</Text>
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
                </View>
            ) : (
                <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                    {activeTab === 'orders' && (
                        <View style={styles.section}>
                            <View style={styles.subTabsRow}>
                                <BasicButton title="Active" selected={ordersTab === 'active'} onPress={() => setOrdersTab('active')} style={styles.subTabButton} />
                                <BasicButton title="Past" selected={ordersTab === 'past'} onPress={() => setOrdersTab('past')} style={styles.subTabButton} />
                            </View>

                            {loadingOrders ? <Text>Loading orders...</Text> : null}

                            {ordersTab === 'active' && (
                                <View>
                                    {activeOrders.length === 0 ? <Text>No active orders</Text> : null}
                                    {activeOrders.map((item) => {
                                        const orderId = item.order_id || item.id;
                                        return (
                                            <View key={orderKey(item)} style={styles.card}>
                                                <Text style={styles.cardRow}><Text style={styles.cardLabel}>Status: </Text>{item.status}</Text>
                                                <Text style={styles.cardRow}><Text style={styles.cardLabel}>Location: </Text>{item.delivery_location ? extractArea(item.delivery_location) : '-'}</Text>
                                                <Text style={styles.cardRow}><Text style={styles.cardLabel}>Qty: </Text>{item.requested_capacity || item.quantity || '-'} gal</Text>
                                                <Text style={styles.cardRow}><Text style={styles.cardLabel}>Date: </Text>{formatDate(item.order_date || item.created_at)}</Text>
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
                                    {pastOrderDetail ? (
                                        <View>
                                            <BasicButton
                                                title="← Back"
                                                onPress={() => setPastOrderDetail(null)}
                                                style={styles.backButton}
                                            />
                                            <View style={styles.card}>
                                                <Text style={styles.cardTitle}>Order #{pastOrderDetail.order_id || '-'}</Text>
                                                <Text style={styles.cardRow}><Text style={styles.cardLabel}>Status: </Text>{pastOrderDetail.status || '-'}</Text>
                                                <Text style={styles.cardRow}><Text style={styles.cardLabel}>Date: </Text>{formatDate(pastOrderDetail.order_date)}</Text>
                                                <Text style={styles.cardRow}><Text style={styles.cardLabel}>Customer: </Text>{pastOrderDetail.customer_name || '-'}</Text>
                                                <Text style={styles.cardRow}><Text style={styles.cardLabel}>Phone: </Text>{pastOrderDetail.customer_phone || '-'}</Text>
                                                <Text style={styles.cardRow}><Text style={styles.cardLabel}>Driver: </Text>{pastOrderDetail.driver_name || '-'}</Text>
                                                <Text style={styles.cardRow}><Text style={styles.cardLabel}>Quantity: </Text>{pastOrderDetail.quantity || '-'} gal</Text>
                                                <Text style={styles.cardRow}><Text style={styles.cardLabel}>Price: </Text>{pastOrderDetail.price || '-'}</Text>
                                            </View>
                                        </View>
                                    ) : (
                                        <View>
                                            {pastOrders.length === 0 ? <Text>No past orders</Text> : null}
                                            {pastOrders.map((item) => (
                                                <View key={orderKey(item)} style={styles.card}>
                                                    <Text style={styles.cardRow}><Text style={styles.cardLabel}>Status: </Text>{item.status || 'Completed'}</Text>
                                                    <Text style={styles.cardRow}><Text style={styles.cardLabel}>Location: </Text>{item.delivery_location ? extractArea(item.delivery_location) : '-'}</Text>
                                                    <Text style={styles.cardRow}><Text style={styles.cardLabel}>Qty: </Text>{item.requested_capacity || item.quantity || '-'} gal</Text>
                                                    <Text style={styles.cardRow}><Text style={styles.cardLabel}>Date: </Text>{formatDate(item.order_date || item.created_at)}</Text>
                                                    <BasicButton
                                                        title="View Details"
                                                        onPress={() => fetchPastOrderDetail(item.order_id || item.id)}
                                                        style={styles.fullButton}
                                                    />
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>
                    )}

                    {activeTab === 'drivers' && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Manage Drivers</Text>
                            {loadingDrivers ? <Text>Loading drivers...</Text> : null}
                            <View style={styles.card}>
                                <Text style={styles.sectionTitle}>Add Driver</Text>
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
                                    <Text style={styles.cardTitle}>{item.driver_name || item.name || '-'}</Text>
                                    <Text style={styles.cardRow}><Text style={styles.cardLabel}>Phone: </Text>{item.driver_phone_num || item.linked_phone || '-'}</Text>
                                    <Text style={styles.cardRow}><Text style={styles.cardLabel}>Linked: </Text>{item.linked ? 'Yes' : 'No'}</Text>
                                    <Text style={styles.cardRow}><Text style={styles.cardLabel}>Status: </Text>{item.available ? 'Available' : 'Unavailable'}</Text>
                                    <BasicButton title="Remove Driver" onPress={() => handleRemoveDriver(item.driver_phone_num)} style={[styles.fullButton, { backgroundColor: colors.danger }]} />
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
        width: '100%',
        paddingHorizontal: spacing.md,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalBox: {
        width: '88%',
        maxWidth: 380,
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        padding: spacing.lg,
        ...shadow.md,
    },
    modalTitle: {
        fontSize: typography.subtitle,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: spacing.sm,
    },
    bidRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.sm,
        gap: spacing.xs,
    },
    bidInput: {
        flex: 1,
        height: 44,
        borderWidth: 1.5,
        borderColor: colors.border,
        borderRadius: radius.sm,
        paddingHorizontal: spacing.sm,
        fontSize: typography.label,
        color: colors.textPrimary,
        backgroundColor: colors.surface,
    },
    bidButton: {
        width: 64,
        height: 44,
        marginTop: 0,
        paddingVertical: 0,
        paddingHorizontal: 4,
    },
    viewButton: {
        width: 64,
        height: 44,
        marginTop: 0,
        paddingVertical: 0,
        paddingHorizontal: 4,
    },
    bidButtonText: {
        fontSize: typography.small,
        color: colors.textOnPrimary,
    },
    container: {
        flex: 1,
        backgroundColor: colors.background,
        alignItems: 'center',
    },
    scroll: {
        width: '100%',
        paddingHorizontal: spacing.md,
    },
    scrollContent: {
        paddingBottom: spacing.xl,
    },
    topTabsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing.xs,
        marginBottom: spacing.sm,
        paddingTop: spacing.xs,
        width: '100%',
        paddingHorizontal: spacing.md,
    },
    tabButton: {
        flex: 1,
        marginTop: 0,
    },
    subTabsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: spacing.xs,
        marginBottom: spacing.sm,
    },
    subTabButton: {
        flex: 1,
        marginTop: 0,
    },
    section: {
        marginTop: spacing.xs,
    },
    sectionTitle: {
        fontSize: typography.label,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: spacing.xs,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.sm,
        marginTop: spacing.sm,
        ...shadow.sm,
    },
    cardTitle: {
        fontSize: typography.label,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    cardRow: {
        fontSize: typography.label,
        color: colors.textSecondary,
        marginBottom: 2,
    },
    cardLabel: {
        color: colors.textSecondary,
    },
    input: {
        borderWidth: 1.5,
        borderColor: colors.border,
        borderRadius: radius.sm,
        paddingHorizontal: spacing.sm,
        paddingVertical: 10,
        marginTop: spacing.sm,
        fontSize: typography.body,
        color: colors.textPrimary,
        backgroundColor: colors.surface,
    },
    inputButtonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: spacing.sm,
        gap: spacing.xs,
    },
    rowInput: {
        flex: 1,
        marginTop: 0,
    },
    rowButton: {
        marginTop: 0,
        minWidth: 90,
    },
    fullButton: {
        alignSelf: 'stretch',
        marginTop: spacing.xs,
    },
    backButton: {
        alignSelf: 'flex-start',
        marginBottom: spacing.sm,
        marginTop: 0,
    },
    cancelButton: {
        alignSelf: 'stretch',
        marginTop: spacing.md,
        backgroundColor: colors.danger,
    },
    timerCard: {
        backgroundColor: '#FFF8E1',
        borderWidth: 2,
        borderColor: colors.warning,
        borderRadius: radius.md,
        padding: spacing.md,
        marginTop: spacing.sm,
    },
    timerTitle: {
        fontSize: typography.body,
        fontWeight: '700',
        color: colors.warning,
        marginBottom: 4,
    },
    timerLabel: {
        marginTop: 4,
        fontSize: typography.label,
        color: colors.textSecondary,
    },
    timerValue: {
        fontSize: 32,
        fontWeight: '800',
        letterSpacing: 3,
        marginTop: 2,
        color: colors.textPrimary,
    },
    timerUrgent: {
        color: colors.danger,
    },
    timerExpiredText: {
        color: colors.danger,
        fontSize: typography.label,
        marginTop: 4,
    },
    timerBadge: {
        color: colors.warning,
        fontWeight: '700',
        fontSize: typography.small,
        marginTop: 4,
    },
    driverAssignCard: {
        backgroundColor: colors.background,
        borderRadius: radius.sm,
        padding: spacing.sm,
        marginTop: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    emptyText: {
        color: colors.textSecondary,
        fontSize: typography.body,
        marginTop: spacing.sm,
        textAlign: 'center',
    },
});
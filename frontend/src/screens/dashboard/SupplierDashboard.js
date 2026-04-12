import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Alert, ScrollView, StyleSheet } from 'react-native';
import BasicButton from '../../components/ui/BasicButton';
import {
    listAvailableOrders,
    placeSupplierBid,
    listActiveSupplierOrders,
    listSupplierPastOrders,
    listSupplierDrivers,
    addSupplierDriver,
    removeSupplierDriver
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

    const previewActiveOrders = activeOrders.slice(0, 3);

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

    const fetchActiveOrders = async () => {
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
    };

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

    useEffect(() => {
        if (!sessionToken) return;

        fetchLiveMarket();
        fetchActiveOrders();

        const interval = setInterval(() => {
            fetchLiveMarket();
            fetchActiveOrders();
        }, 5000);

        return () => clearInterval(interval);
    }, [sessionToken]);

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
            fetchDrivers();
            Alert.alert('Success', 'Driver removed successfully');
        } catch (error) {
            Alert.alert('Error', error.message || 'Failed to remove driver');
        }
    };

    const orderKey = (item) => String(item.order_id || item.id);

    return (
        <View style={styles.container}>
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
                <View style={styles.topTabsRow}>
                    <BasicButton title="Live Market" onPress={() => setActiveTab('market')} style={styles.tabButton} />
                    <BasicButton title="Orders" onPress={() => setActiveTab('orders')} style={styles.tabButton} />
                    <BasicButton title="Drivers" onPress={() => setActiveTab('drivers')} style={styles.tabButton} />
                </View>

                {activeTab === 'market' && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Live Orders</Text>
                        {loadingMarket ? <Text>Loading live market...</Text> : null}
                        {!sessionToken ? <Text>Session missing. Login again.</Text> : null}
                        {marketOrders.length === 0 ? <Text>No live orders</Text> : null}
                        {marketOrders.map((item) => (
                            <View key={orderKey(item)} style={styles.card}>
                                <Text>Order #{item.order_id || item.id}</Text>
                                <Text>Address: {item.delivery_location || item.address || '-'}</Text>
                                <Text>Gallons: {item.requested_capacity || item.gallons} | Customer Offer: {item.customer_bid_price || item.price}</Text>
                                <View style={styles.inputButtonRow}>
                                    <TextInput
                                        placeholder="Your Bid Price"
                                        keyboardType="numeric"
                                        value={bids[item.order_id || item.id] || ''}
                                        style={[styles.input, styles.rowInput]}
                                        onChangeText={(val) => setBids(prev => ({ ...prev, [item.order_id || item.id]: val }))}
                                    />
                                    <BasicButton title="Send Bid" onPress={() => handleSendBid(item.order_id || item.id)} style={styles.rowButton} />
                                </View>
                            </View>
                        ))}

                        <Text style={styles.sectionTitle}>Your Active Orders (Preview: up to 3)</Text>
                        {previewActiveOrders.length === 0 ? <Text>No active orders</Text> : null}
                        {previewActiveOrders.map((item) => (
                            <View key={orderKey(item)} style={styles.card}>
                                <Text>Order #{item.order_id || item.id}</Text>
                                <Text>Status: {item.status}</Text>
                            </View>
                        ))}

                        <BasicButton
                            title="View All Orders"
                            style={styles.fullButton}
                            onPress={() => {
                                setActiveTab('orders');
                                setOrdersTab('active');
                            }}
                        />
                    </View>
                )}

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
                                {activeOrders.map((item) => (
                                    <View key={orderKey(item)} style={styles.card}>
                                        <Text>Order #{item.order_id || item.id}</Text>
                                        <Text>Status: {item.status}</Text>
                                    </View>
                                ))}
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
        </View>
    );
}

const styles = StyleSheet.create({
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
});
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Alert, ScrollView, StyleSheet } from 'react-native';
import BasicButton from '../../components/ui/BasicButton';
import {
  getDriverOrderDetails,
  acceptDriverOrder,
  rejectDriverOrder,
  startDriverRide,
  markDriverReached,
  finishDriverOrder,
  cancelDriverOrder,
  listDriverHistory,
  getDriverHistoryDetails,
} from '../../api/driverApi';

export default function DriverDashboard({ sessionToken }) {
  const [activeTab, setActiveTab] = useState('task'); // task | history
  const [orderIdInput, setOrderIdInput] = useState('');
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [taskDetails, setTaskDetails] = useState(null);
  const [taskError, setTaskError] = useState('');
  const [loadingTask, setLoadingTask] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [historyOrders, setHistoryOrders] = useState([]);
  const [historyDetails, setHistoryDetails] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchTaskDetails = async (orderIdValue) => {
    if (!sessionToken) return;
    if (!orderIdValue) return;

    try {
      setLoadingTask(true);
      setTaskError('');
      const response = await getDriverOrderDetails(sessionToken, orderIdValue);
      setTaskDetails(response?.data || null);
    } catch (error) {
      setTaskDetails(null);
      setTaskError(error.message || 'Failed to load current task');
    } finally {
      setLoadingTask(false);
    }
  };

  const fetchHistory = async () => {
    if (!sessionToken) return;

    try {
      setLoadingHistory(true);
      const response = await listDriverHistory(sessionToken);
      setHistoryOrders(Array.isArray(response?.data?.orders) ? response.data.orders : []);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to load history');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (!sessionToken) return;
    if (activeTab !== 'task') return;
    if (!currentOrderId) return;

    fetchTaskDetails(currentOrderId);

    const interval = setInterval(() => {
      fetchTaskDetails(currentOrderId);
    }, 5000);

    return () => clearInterval(interval);
  }, [sessionToken, activeTab, currentOrderId]);

  useEffect(() => {
    if (!sessionToken) return;
    if (activeTab !== 'history') return;
    fetchHistory();
  }, [sessionToken, activeTab]);

  const handleLoadOrder = () => {
    const parsed = Number(orderIdInput);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      Alert.alert('Error', 'Enter a valid order ID');
      return;
    }

    setCurrentOrderId(parsed);
    setTaskDetails(null);
    setTaskError('');
    fetchTaskDetails(parsed);
  };

  const runDriverAction = async (actionFn) => {
    if (!sessionToken || !currentOrderId) {
      Alert.alert('Error', 'Missing session token or order ID');
      return;
    }

    try {
      setActionLoading(true);
      await actionFn(sessionToken, currentOrderId);
      await fetchTaskDetails(currentOrderId);
    } catch (error) {
      Alert.alert('Error', error.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!sessionToken || !currentOrderId) return;
    try {
      setActionLoading(true);
      await rejectDriverOrder(sessionToken, currentOrderId);
      setTaskDetails(null);
      setCurrentOrderId(null);
      setOrderIdInput('');
      setTaskError('Order rejected successfully.');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to reject order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinish = async () => {
    if (!sessionToken || !currentOrderId) return;
    try {
      setActionLoading(true);
      await finishDriverOrder(sessionToken, currentOrderId);
      setTaskDetails(null);
      setCurrentOrderId(null);
      setOrderIdInput('');
      setTaskError('Order finished successfully.');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to finish order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!sessionToken || !currentOrderId) return;
    try {
      setActionLoading(true);
      await cancelDriverOrder(sessionToken, currentOrderId);
      setTaskDetails(null);
      setCurrentOrderId(null);
      setOrderIdInput('');
      setTaskError('Order cancelled successfully.');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to cancel order');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewHistoryOrder = async (orderId) => {
    if (!sessionToken) return;
    try {
      const response = await getDriverHistoryDetails(sessionToken, orderId);
      setHistoryDetails(response?.data || null);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to fetch order details');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.topTabsRow}>
          <BasicButton title="Task" onPress={() => setActiveTab('task')} style={styles.tabButton} />
          <BasicButton title="History" onPress={() => setActiveTab('history')} style={styles.tabButton} />
        </View>

        {activeTab === 'task' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Task</Text>
            {!sessionToken ? <Text>Session missing. Login again.</Text> : null}

            <View style={styles.inputRow}>
              <TextInput
                value={orderIdInput}
                onChangeText={setOrderIdInput}
                keyboardType="numeric"
                placeholder="Enter assigned order ID"
                style={[styles.input, styles.rowInput]}
              />
              <BasicButton title="Load" onPress={handleLoadOrder} style={styles.rowButton} />
            </View>

            {loadingTask ? <Text>Loading task...</Text> : null}
            {taskError ? <Text>{taskError}</Text> : null}

            {taskDetails ? (
              <View style={styles.card}>
                <Text>Order ID: {taskDetails.order_id}</Text>
                <Text>Status: {taskDetails.status}</Text>
                <Text>Location: {taskDetails.delivery_location}</Text>
                <Text>Quantity: {taskDetails.quantity}</Text>
                <Text>Price: {taskDetails.price}</Text>
                <Text>Customer: {taskDetails.customer_name || '-'}</Text>
                <Text>Customer Phone: {taskDetails.customer_phone || '-'}</Text>

                {taskDetails.status === 'supplier_timer' && (
                  <View style={styles.actionRow}>
                    <BasicButton title={actionLoading ? 'Accepting...' : 'Accept'} onPress={() => runDriverAction(acceptDriverOrder)} disabled={actionLoading} style={styles.actionButton} />
                    <BasicButton title={actionLoading ? 'Rejecting...' : 'Reject'} onPress={handleReject} disabled={actionLoading} style={styles.actionButton} />
                  </View>
                )}

                {taskDetails.status === 'accepted' && (
                  <View style={styles.actionRow}>
                    <BasicButton title={actionLoading ? 'Starting...' : 'Start Ride'} onPress={() => runDriverAction(startDriverRide)} disabled={actionLoading} style={styles.actionButton} />
                    <BasicButton title={actionLoading ? 'Cancelling...' : 'Cancel'} onPress={handleCancel} disabled={actionLoading} style={styles.actionButton} />
                  </View>
                )}

                {taskDetails.status === 'ride_started' && (
                  <View style={styles.actionRow}>
                    <BasicButton title={actionLoading ? 'Updating...' : 'Mark Reached'} onPress={() => runDriverAction(markDriverReached)} disabled={actionLoading} style={styles.actionButton} />
                    <BasicButton title={actionLoading ? 'Cancelling...' : 'Cancel'} onPress={handleCancel} disabled={actionLoading} style={styles.actionButton} />
                  </View>
                )}

                {taskDetails.status === 'reached' && (
                  <View style={styles.actionRow}>
                    <BasicButton title={actionLoading ? 'Finishing...' : 'Finish Delivery'} onPress={handleFinish} disabled={actionLoading} style={styles.actionButton} />
                    <BasicButton title={actionLoading ? 'Cancelling...' : 'Cancel'} onPress={handleCancel} disabled={actionLoading} style={styles.actionButton} />
                  </View>
                )}
              </View>
            ) : null}
          </View>
        )}

        {activeTab === 'history' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Past Orders</Text>
            <BasicButton title="Refresh History" onPress={fetchHistory} style={styles.fullButton} />
            {loadingHistory ? <Text>Loading history...</Text> : null}
            {historyOrders.length === 0 ? <Text>No past orders.</Text> : null}

            {historyOrders.map((item) => (
              <View key={String(item.order_id || item.id)} style={styles.card}>
                <Text>Order ID: {item.order_id || item.id}</Text>
                <Text>Status: {item.status || '-'}</Text>
                <Text>Date: {item.order_date || item.created_at || '-'}</Text>
                <BasicButton title="View Details" onPress={() => handleViewHistoryOrder(item.order_id || item.id)} style={styles.fullButton} />
              </View>
            ))}

            {historyDetails ? (
              <View style={styles.card}>
                <Text>History Order Details</Text>
                <Text>Order ID: {historyDetails.order_id || '-'}</Text>
                <Text>Status: {historyDetails.status || '-'}</Text>
                <Text>Customer: {historyDetails.customer_name || '-'}</Text>
                <Text>Supplier: {historyDetails.supplier_name || '-'}</Text>
                <Text>Driver: {historyDetails.driver_name || '-'}</Text>
                <Text>Quantity: {historyDetails.quantity || '-'}</Text>
                <Text>Price: {historyDetails.price || '-'}</Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    width: '49%',
    marginTop: 0,
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#000',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  rowInput: {
    flex: 1,
    marginRight: 8,
  },
  rowButton: {
    marginTop: 0,
    minWidth: 90,
  },
  card: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 4,
    padding: 10,
    marginTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  actionButton: {
    width: '49%',
  },
  fullButton: {
    alignSelf: 'stretch',
  },
});

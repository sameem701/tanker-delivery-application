import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Alert, ScrollView, StyleSheet, Modal } from 'react-native';
import BasicButton from '../../components/ui/BasicButton';
import {
  getCurrentDriverOrder,
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

function formatSeconds(secs) {
  if (secs == null || secs < 0) return '00:00';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function DriverDashboard({ sessionToken }) {
  const [activeTab, setActiveTab] = useState('task'); // task | history
  const [currentOrder, setCurrentOrder] = useState(null); // full order data + source + timers
  const [taskMessage, setTaskMessage] = useState('');
  const [loadingTask, setLoadingTask] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Local countdown tick applied on top of server-provided remaining seconds
  const [supplierTimerTick, setSupplierTimerTick] = useState(0);
  const [driverTimerTick, setDriverTimerTick] = useState(0);

  const [historyOrders, setHistoryOrders] = useState([]);
  const [historyDetails, setHistoryDetails] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Receipt shown after finishing a delivery
  const [receiptOrder, setReceiptOrder] = useState(null);

  // Load (or refresh) the driver's current order via getCurrentDriverOrder
  const loadCurrentOrder = useCallback(async () => {
    if (!sessionToken) return;
    try {
      setLoadingTask(true);
      setTaskMessage('');
      const response = await getCurrentDriverOrder(sessionToken);
      const data = response?.data;
      if (!data) {
        setCurrentOrder(null);
        return;
      }
      setCurrentOrder(data);
      // Reset local tick counters when fresh server data arrives
      setSupplierTimerTick(0);
      setDriverTimerTick(0);
    } catch (error) {
      // 404 means no current order
      if (error?.status === 404 || /no (current|active|pending)/i.test(error?.message || '')) {
        setCurrentOrder(null);
      } else {
        setTaskMessage(error.message || 'Failed to load current task');
      }
    } finally {
      setLoadingTask(false);
    }
  }, [sessionToken]);

  // Polling: idle (no order) every 8s, pending assignment every 3s, active delivery every 5s
  useEffect(() => {
    if (!sessionToken || activeTab !== 'task') return;
    loadCurrentOrder();

    const isPendingPhase = currentOrder?.status === 'supplier_timer' && currentOrder?.source === 'pending_assignment';
    const isActivePhase = ['accepted', 'ride_started', 'reached'].includes(currentOrder?.status);
    const isIdle = !currentOrder;

    const interval = setInterval(
      loadCurrentOrder,
      isPendingPhase ? 3000 : isActivePhase ? 5000 : 5000
    );
    return () => clearInterval(interval);
  }, [sessionToken, activeTab, currentOrder?.status, currentOrder?.source]);

  // Local countdown ticks: decrement every second while in supplier_timer phase
  useEffect(() => {
    if (currentOrder?.status !== 'supplier_timer') return;
    if (currentOrder?.source !== 'pending_assignment') return;

    const tick = setInterval(() => {
      setSupplierTimerTick(t => t + 1);
      setDriverTimerTick(t => t + 1);
    }, 1000);
    return () => clearInterval(tick);
  }, [currentOrder?.status, currentOrder?.source]);

  // Fetch history on tab switch
  useEffect(() => {
    if (!sessionToken || activeTab !== 'history') return;
    fetchHistory();
  }, [sessionToken, activeTab]);

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

  const handleAccept = () => {
    if (!sessionToken || !currentOrder?.order_id) return;
    Alert.alert(
      'Accept Order',
      'Are you sure you want to accept this order?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              setActionLoading(true);
              await acceptDriverOrder(sessionToken, currentOrder.order_id);
              await loadCurrentOrder();
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to accept order');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleReject = () => {
    if (!sessionToken || !currentOrder?.order_id) return;
    Alert.alert(
      'Reject Order',
      'Are you sure you want to reject this order? You will not be able to accept it again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await rejectDriverOrder(sessionToken, currentOrder.order_id);
              setCurrentOrder(null);
              setTaskMessage('Order rejected. Waiting for new assignment.');
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to reject order');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const runDriverAction = async (actionFn) => {
    if (!sessionToken || !currentOrder?.order_id) return;
    try {
      setActionLoading(true);
      await actionFn(sessionToken, currentOrder.order_id);
      await loadCurrentOrder();
    } catch (error) {
      Alert.alert('Error', error.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinish = async () => {
    if (!sessionToken || !currentOrder?.order_id) return;
    const snapshot = { ...currentOrder };
    try {
      setActionLoading(true);
      await finishDriverOrder(sessionToken, currentOrder.order_id);
      setCurrentOrder(null);
      setTaskMessage('');
      setReceiptOrder(snapshot);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to finish delivery');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!sessionToken || !currentOrder?.order_id) return;
    try {
      setActionLoading(true);
      await cancelDriverOrder(sessionToken, currentOrder.order_id);
      setCurrentOrder(null);
      setTaskMessage('Order cancelled.');
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

  // Compute remaining seconds for display
  const getRemainingSupplierSecs = () => {
    if (currentOrder?.remaining_supplier_seconds == null) return null;
    return Math.max(0, currentOrder.remaining_supplier_seconds - supplierTimerTick);
  };

  const getRemainingDriverSecs = () => {
    if (currentOrder?.remaining_driver_seconds == null) return null;
    return Math.max(0, currentOrder.remaining_driver_seconds - driverTimerTick);
  };

  const supplierSecs = getRemainingSupplierSecs();
  const driverSecs = getRemainingDriverSecs();
  const supplierTimerExpired = supplierSecs != null && supplierSecs <= 0;
  const driverTimerExpired = driverSecs != null && driverSecs <= 0;

  return (
    <View style={styles.container}>
      {/* Delivery receipt modal */}
      <Modal
        visible={receiptOrder !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setReceiptOrder(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '85%', maxWidth: 380, backgroundColor: '#fff', borderRadius: 8, padding: 20 }}>
            <Text style={{ fontSize: 17, marginBottom: 12 }}>Delivery Complete ✓</Text>
            <View style={{ borderTopWidth: 1, borderColor: '#e0e0e0', marginBottom: 12 }} />
            <Text style={{ marginBottom: 4 }}>Order ID: #{receiptOrder?.order_id}</Text>
            <Text style={{ marginBottom: 4 }}>Location: {receiptOrder?.delivery_location || '-'}</Text>
            <Text style={{ marginBottom: 4 }}>Quantity: {receiptOrder?.quantity || '-'} gal</Text>
            <Text style={{ marginBottom: 4 }}>Price: {receiptOrder?.price || '-'}</Text>
            <Text style={{ marginBottom: 4 }}>Customer: {receiptOrder?.customer_name || '-'}</Text>
            <Text style={{ marginBottom: 4 }}>Customer Phone: {receiptOrder?.customer_phone || '-'}</Text>
            <Text style={{ marginBottom: 16 }}>Supplier: {receiptOrder?.supplier_name || '-'}</Text>
            <View style={{ borderTopWidth: 1, borderColor: '#e0e0e0', marginBottom: 12 }} />
            <BasicButton
              title="OK"
              onPress={() => setReceiptOrder(null)}
              style={{ marginTop: 0 }}
            />
          </View>
        </View>
      </Modal>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.topTabsRow}>
          <BasicButton title="Task" onPress={() => setActiveTab('task')} style={styles.tabButton} />
          <BasicButton title="History" onPress={() => setActiveTab('history')} style={styles.tabButton} />
        </View>

        {activeTab === 'task' && (
          <View style={styles.section}>
            <View style={styles.rowBetween}>
              <Text style={[styles.sectionTitle, { flex: 1 }]}>Current Task</Text>
              <BasicButton title="Refresh" onPress={loadCurrentOrder} style={styles.inlineButton} />
            </View>

            {!sessionToken ? <Text>Session missing. Login again.</Text> : null}
            {loadingTask ? <Text style={{ marginTop: 20 }}>Loading task...</Text> : null}
            {taskMessage ? <Text style={{ marginTop: 20 }}>{taskMessage}</Text> : null}

            {!currentOrder && !loadingTask && !taskMessage ? (
              <Text style={{ marginTop: 20 }}>No active task. Checking for new assignments automatically.</Text>
            ) : null}

            {currentOrder ? (
              <View>
                {/* Order info */}
                <View style={styles.card}>
                  <Text>Order #{currentOrder.order_id}</Text>
                  <Text>Status: {currentOrder.status}</Text>
                  <Text>Location: {currentOrder.delivery_location}</Text>
                  <Text>Quantity: {currentOrder.quantity}</Text>
                  <Text>Price: {currentOrder.price}</Text>
                </View>

                {/* Customer info */}
                <View style={styles.card}>
                  <Text>Customer: {currentOrder.customer_name || '-'}</Text>
                  <Text>Phone: {currentOrder.customer_phone || '-'}</Text>
                </View>

                {/* Pending assignment phase: timers + accept/reject */}
                {currentOrder.status === 'supplier_timer' && currentOrder.source === 'pending_assignment' && (
                  <View style={styles.card}>
                    {supplierSecs != null && (
                      <Text>Order timer: {supplierTimerExpired ? 'Expired' : formatSeconds(supplierSecs)}</Text>
                    )}
                    {driverSecs != null && (
                      <Text>Your response timer: {driverTimerExpired ? 'Expired' : formatSeconds(driverSecs)}</Text>
                    )}
                    {supplierTimerExpired ? (
                      <Text>This order has expired. Waiting for a new assignment.</Text>
                    ) : driverTimerExpired ? (
                      <Text>Your response time has expired. Waiting for new assignment.</Text>
                    ) : (
                      <View style={styles.actionRow}>
                        <BasicButton title={actionLoading ? 'Accepting...' : 'Accept'} onPress={handleAccept} disabled={actionLoading} style={styles.actionButton} />
                        <BasicButton title={actionLoading ? 'Rejecting...' : 'Reject'} onPress={handleReject} disabled={actionLoading} style={styles.actionButton} />
                      </View>
                    )}
                  </View>
                )}

                {/* Active delivery actions */}
                {currentOrder.status === 'accepted' && (
                  <View style={styles.actionRow}>
                    <BasicButton title={actionLoading ? 'Starting...' : 'Start Ride'} onPress={() => runDriverAction(startDriverRide)} disabled={actionLoading} style={styles.actionButton} />
                    <BasicButton title={actionLoading ? 'Cancelling...' : 'Cancel'} onPress={handleCancel} disabled={actionLoading} style={styles.actionButton} />
                  </View>
                )}
                {currentOrder.status === 'ride_started' && (
                  <View style={styles.actionRow}>
                    <BasicButton title={actionLoading ? 'Updating...' : 'Mark Reached'} onPress={() => runDriverAction(markDriverReached)} disabled={actionLoading} style={styles.actionButton} />
                    <BasicButton title={actionLoading ? 'Cancelling...' : 'Cancel'} onPress={handleCancel} disabled={actionLoading} style={styles.actionButton} />
                  </View>
                )}
                {currentOrder.status === 'reached' && (
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
            {historyDetails ? (
              <View>
                <BasicButton
                  title="← Back to History"
                  onPress={() => setHistoryDetails(null)}
                  style={styles.backButton}
                />
                <View style={styles.card}>
                  <Text>Order #{historyDetails.order_id || '-'}</Text>
                  <Text>Status: {historyDetails.status || '-'}</Text>
                  <Text>Date: {historyDetails.order_date || '-'}</Text>
                  <Text>Customer: {historyDetails.customer_name || '-'}</Text>
                  <Text>Supplier: {historyDetails.supplier_name || '-'}</Text>
                  <Text>Driver: {historyDetails.driver_name || '-'}</Text>
                  <Text>Quantity: {historyDetails.quantity || '-'}</Text>
                  <Text>Price: {historyDetails.price || '-'}</Text>
                </View>
              </View>
            ) : (
              <View>
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
              </View>
            )}
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
    alignSelf: 'stretch',
  },
  scrollContent: {
    paddingHorizontal: 16,
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
  card: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 4,
    padding: 8,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  actionButton: {
    width: '49%',
    marginTop: 0,
  },
  fullButton: {
    alignSelf: 'stretch',
    marginTop: 6,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  inlineButton: {
    marginTop: 0,
    minWidth: 90,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginTop: 0,
    marginBottom: 4,
  },
});

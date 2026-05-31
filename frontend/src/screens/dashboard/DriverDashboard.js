import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Alert, ScrollView, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { colors, spacing, radius, typography, shadow } from '../../theme/tokens';
import BasicButton from '../../components/ui/BasicButton';
import Toast from '../../components/ui/Toast';

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

function formatDate(val) {
  if (!val) return '-';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function formatSeconds(secs) {
  if (secs == null || secs < 0) return '00:00';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function DriverDashboard({ sessionToken, socket }) {
  const [activeTab, setActiveTab] = useState('task'); // task | history
  const [currentOrder, setCurrentOrder] = useState(null); // full order data + source + timers
  const [taskMessage, setTaskMessage] = useState('');
  const [loadingTask, setLoadingTask] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Local countdown tick applied on top of server-provided remaining seconds
  const [supplierTimerTick, setSupplierTimerTick] = useState(0);
  const [driverTimerTick, setDriverTimerTick] = useState(0);
  const [cancelledModalData, setCancelledModalData] = useState(null);


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

  // Socket: load order on mount and when assignment/status events arrive
  useEffect(() => {
    if (!sessionToken || activeTab !== 'task') return;
    loadCurrentOrder();
    if (!socket) return;
    socket.on('order_assigned', loadCurrentOrder);
    socket.on('order_updated', loadCurrentOrder);
    return () => {
      socket.off('order_assigned', loadCurrentOrder);
      socket.off('order_updated', loadCurrentOrder);
    };
  }, [sessionToken, activeTab, loadCurrentOrder, socket]);

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

  useEffect(() => {
    if (!sessionToken || !socket) return;

    const onOrderCancelled = ({ order_id, cancelled_by }) => {
      setCurrentOrder(null);
      setTaskMessage('');
      const who = cancelled_by === 'supplier' ? 'the supplier'
        : cancelled_by === 'customer' ? 'the customer'
          : cancelled_by === 'timer' ? 'timer expiry'
            : cancelled_by;
      setCancelledModalData({ order_id, who });
    };

    socket.on('order_cancelled', onOrderCancelled);
    return () => socket.off('order_cancelled', onOrderCancelled);
  }, [sessionToken, socket]);

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
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Delivery Complete ✓</Text>
            <View style={styles.divider} />
            <Text style={styles.receiptRow}><Text style={styles.receiptLabel}>Order: </Text>#{receiptOrder?.order_id}</Text>
            <Text style={styles.receiptRow}><Text style={styles.receiptLabel}>Location: </Text>{receiptOrder?.delivery_location || '-'}</Text>
            <Text style={styles.receiptRow}><Text style={styles.receiptLabel}>Quantity: </Text>{receiptOrder?.quantity || '-'} gal</Text>
            <Text style={styles.receiptRow}><Text style={styles.receiptLabel}>Price: </Text>{receiptOrder?.price || '-'}</Text>
            <Text style={styles.receiptRow}><Text style={styles.receiptLabel}>Customer: </Text>{receiptOrder?.customer_name || '-'}</Text>
            <Text style={styles.receiptRow}><Text style={styles.receiptLabel}>Customer Phone: </Text>{receiptOrder?.customer_phone || '-'}</Text>
            <Text style={styles.receiptRow}><Text style={styles.receiptLabel}>Supplier: </Text>{receiptOrder?.supplier_name || '-'}</Text>
            <View style={styles.divider} />
            <BasicButton
              title="OK"
              onPress={() => setReceiptOrder(null)}
              style={styles.okButton}
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
            <Text style={styles.receiptRow}>
              Your order was cancelled by {cancelledModalData?.who}.
            </Text>
            <View style={styles.divider} />
            <BasicButton
              title="OK"
              onPress={() => setCancelledModalData(null)}
              style={styles.okButton}
            />
          </View>
        </View>
      </Modal>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.topTabsRow}>
          <BasicButton title="Task" selected={activeTab === 'task'} onPress={() => setActiveTab('task')} style={styles.tabButton} />
          <BasicButton title="History" selected={activeTab === 'history'} onPress={() => setActiveTab('history')} style={styles.tabButton} />
        </View>

        {activeTab === 'task' && (
          <View style={styles.section}>
            <View style={styles.rowBetween}>
              <Text style={[styles.sectionTitle, { flex: 1 }]}>Current Task</Text>
              <BasicButton
                title="Refresh"
                onPress={loadCurrentOrder}
                disabled={loadingTask}
                style={styles.inlineButton}
              />
            </View>

            {!sessionToken ? <Text style={styles.errorText}>Session missing. Login again.</Text> : null}
            {loadingTask ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Loading task...</Text>
              </View>
            ) : null}
            {taskMessage ? <Text style={styles.hintText}>{taskMessage}</Text> : null}

            {!currentOrder && !loadingTask && !taskMessage ? (
              <Text style={styles.emptyText}>No active task. Checking for new assignments automatically.</Text>
            ) : null}

            {currentOrder ? (
              <View>
                {/* Order info */}
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Order #{currentOrder.order_id}</Text>
                  <Text style={styles.cardRow}><Text style={styles.cardLabel}>Status: </Text>{currentOrder.status}</Text>
                  <Text style={styles.cardRow}><Text style={styles.cardLabel}>Location: </Text>{currentOrder.delivery_location}</Text>
                  <Text style={styles.cardRow}><Text style={styles.cardLabel}>Qty: </Text>{currentOrder.quantity} gal</Text>
                  <Text style={styles.cardRow}><Text style={styles.cardLabel}>Price: </Text>{currentOrder.price}</Text>

                  <Text style={styles.cardRow}>
                    <Text style={styles.cardLabel}>Customer: </Text>
                    {currentOrder.status !== 'supplier_timer' ? (currentOrder.customer_name || '-') : '-'}
                  </Text>
                  <Text style={styles.cardRow}>
                    <Text style={styles.cardLabel}>Phone: </Text>
                    {currentOrder.status !== 'supplier_timer' ? (currentOrder.customer_phone || '-') : '-'}
                  </Text>
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
                  title="← Back"
                  onPress={() => setHistoryDetails(null)}
                  style={styles.backButton}
                />
                <View style={styles.card}>
                  <Text style={styles.cardRow}><Text style={styles.cardLabel}>Status: </Text>{historyDetails.status || '-'}</Text>
                  <Text style={styles.cardRow}><Text style={styles.cardLabel}>Date: </Text>{formatDate(historyDetails.order_date)}</Text>
                  <Text style={styles.cardRow}><Text style={styles.cardLabel}>Customer: </Text>{historyDetails.customer_name || '-'}</Text>
                  <Text style={styles.cardRow}><Text style={styles.cardLabel}>Supplier: </Text>{historyDetails.supplier_name || '-'}</Text>
                  <Text style={styles.cardRow}><Text style={styles.cardLabel}>Driver: </Text>{historyDetails.driver_name || '-'}</Text>
                  <Text style={styles.cardRow}><Text style={styles.cardLabel}>Qty: </Text>{historyDetails.quantity || '-'} gal</Text>
                  <Text style={styles.cardRow}><Text style={styles.cardLabel}>Price: </Text>{historyDetails.price || '-'}</Text>
                </View>
              </View>
            ) : (
              <View>
                <View style={styles.rowBetween}>
                  <Text style={styles.sectionTitle}>Past Orders</Text>
                  <BasicButton title="Refresh" onPress={fetchHistory} style={styles.inlineButton} />
                </View>
                {loadingHistory ? <Text>Loading history...</Text> : null}
                {historyOrders.length === 0 ? <Text>No past orders.</Text> : null}
                {historyOrders.map((item) => (
                  <View key={String(item.order_id || item.id)} style={styles.card}>
                    <Text style={styles.cardTitle}>Order #{item.order_id || item.id}</Text>
                    <Text style={styles.cardRow}><Text style={styles.cardLabel}>Status: </Text>{item.status || '-'}</Text>
                    <Text style={styles.cardRow}><Text style={styles.cardLabel}>Date: </Text>{formatDate(item.order_date || item.created_at)}</Text>
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
    backgroundColor: colors.background,
    alignItems: 'center',
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
  modalSubtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  scroll: {
    alignSelf: 'stretch',
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  topTabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  tabButton: {
    flex: 1,
    marginTop: 0,
  },
  section: {
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontSize: typography.body,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
    ...shadow.sm,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  actionButton: {
    flex: 1,
    marginTop: 0,
  },
  fullButton: {
    alignSelf: 'stretch',
    marginTop: spacing.xs,
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
    marginBottom: spacing.xs,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.label,
    marginTop: spacing.sm,
  },
  hintText: {
    color: colors.textSecondary,
    fontSize: typography.label,
    marginTop: spacing.sm,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.body,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: typography.body,
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
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  receiptRow: {
    fontSize: typography.label,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  receiptLabel: {
    color: colors.textSecondary,
  },
  okButton: {
    marginTop: 0,
  },
  cardTitle: {
    fontSize: typography.body,
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
});
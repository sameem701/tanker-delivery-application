import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../../state/AuthContext';
import { getActiveOrder } from '../../api/customerApi';

import CreateOrderScreen from '../customer/CreateOrderScreen';
import BiddingArenaScreen from '../customer/BiddingArenaScreen';
import CustomerTrackerScreen from '../customer/CustomerTrackerScreen';
import RatingScreen from '../customer/RatingScreen';

export default function CustomerDashboard() {
  const { userToken } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [orderStatus, setOrderStatus] = useState(null);

  useEffect(() => {
    checkActiveOrder();
    // Poll every 4s to keep state in sync (bidding -> tracking -> rating)
    const interval = setInterval(() => checkActiveOrder(), 4000);
    return () => clearInterval(interval);
  }, []);

  const checkActiveOrder = async () => {
    try {
      // Mock active order logic. To let user create order, no active order by default.
      if (loading) setLoading(false);
    } catch (error) {
      console.log('Error checking active order:', error);
    }
  };

  const handleOrderCreated = (newOrderId) => {
    setActiveOrderId(newOrderId);
    setOrderStatus('open');
  };

  const handleClear = () => {
    setActiveOrderId(null);
    setOrderStatus(null);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0066ff" />
      </View>
    );
  }

  // ── Screen routing based on live order status ──────────────────────────────
  // No order or terminal state → Create new order
  if (!activeOrderId || orderStatus === 'cancelled') {
    return <CreateOrderScreen token={userToken} onOrderCreated={handleOrderCreated} />;
  }

  // Order is open → Bidding arena (listening for supplier bids)
  if (orderStatus === 'open') {
    return <BiddingArenaScreen token={userToken} orderId={activeOrderId} />;
  }

  // Order is in active delivery → Tracker
  if (['supplier_timer', 'accepted', 'ride_started', 'reached'].includes(orderStatus)) {
    return (
      <CustomerTrackerScreen
        token={userToken}
        orderId={activeOrderId}
        onClear={handleClear}
      />
    );
  }

  // Delivery finished → Rating screen
  if (orderStatus === 'finished') {
    return (
      <RatingScreen
        token={userToken}
        orderId={activeOrderId}
        onDone={handleClear}
      />
    );
  }

  // Fallback
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text style={{ color: '#666' }}>Unknown state: {orderStatus}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

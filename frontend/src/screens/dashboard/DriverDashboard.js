import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../../state/AuthContext';
import { getActiveOrder } from '../../api/driverApi';
import { socket } from '../../api/socket';

import DriverOperationScreen from '../driver/DriverOperationScreen';

export default function DriverDashboard() {
  const { userToken } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [activeOrderId, setActiveOrderId] = useState(null);

  useEffect(() => {
    checkActiveOrder();

    const interval = setInterval(() => {
      checkActiveOrder();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const checkActiveOrder = async () => {
    try {
      setTimeout(() => {
        // Mocking an active order to let them click through the flow
        setActiveOrderId(101);
        if (loading) setLoading(false);
      }, 500);
    } catch (error) {
      console.log('Error checking active driver order:', error);
      if (loading) setLoading(false);
    }
  };

  const handleStateChange = (newOrderId) => {
    setActiveOrderId(newOrderId);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1a1a1a" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <DriverOperationScreen
        token={userToken}
        activeOrderId={activeOrderId}
        onStateChange={handleStateChange}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});

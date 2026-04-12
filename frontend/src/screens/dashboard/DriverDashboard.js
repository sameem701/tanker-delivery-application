import React, { useState } from 'react';
import { View, Text } from 'react-native';
import BasicButton from '../../components/ui/BasicButton';

export default function DriverDashboard() {
  const [activeOrder, setActiveOrder] = useState(null); // Simulate no active order by default

  const handleUpdateStatus = (newStatus) => {
    setActiveOrder({ ...activeOrder, status: newStatus });
  };

  const handleFinish = () => {
    setActiveOrder(null);
  };

  if (!activeOrder) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} />;
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: '90%', maxWidth: 420 }}>
        <Text>Active Delivery</Text>
        <View>
          <Text>Order ID: {activeOrder.id}</Text>
          <Text>Destination: {activeOrder.address}</Text>
          <Text>Status: {activeOrder.status}</Text>
        </View>

        {activeOrder.status === 'assigned' && (
          <BasicButton title="Accept Order" onPress={() => handleUpdateStatus('accepted')} />
        )}

        {activeOrder.status === 'accepted' && (
          <BasicButton title="Start Ride" onPress={() => handleUpdateStatus('en_route')} />
        )}

        {activeOrder.status === 'en_route' && (
          <BasicButton title="Mark Reached" onPress={() => handleUpdateStatus('reached')} />
        )}

        {activeOrder.status === 'reached' && (
          <BasicButton title="Complete Delivery" onPress={handleFinish} />
        )}
      </View>
    </View>
  );
}
